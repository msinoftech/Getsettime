'use client' // if using App Router

import { createContext, useContext, useCallback, useEffect, useMemo, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { installWorkspaceApiUnauthorizedHandler } from '@/src/lib/install_workspace_api_unauthorized_handler'
import { IdleSessionWarningModal } from '@/src/components/ui/IdleSessionWarningModal'
import { useIdleLogout } from '@/src/hooks/useIdleLogout'
import { useRemoteSessionInvalidation } from '@/src/hooks/useRemoteSessionInvalidation'
import { getWorkspaceIdleLogoutDurations } from '@/src/utils/workspace_idle_logout'
import { useRouter, usePathname } from 'next/navigation'
import type { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js'
import {
  workspaceAdminIncompleteOnboarding,
  isAllowedPathDuringWorkspaceOnboarding,
  workspaceOnboardingRegisterUrl,
} from '@/lib/auth_onboarding'

type User = any

interface AuthContextType {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
})

export const useAuth = () => useContext(AuthContext)

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password", "/auth/login", "/auth/register", "/auth/forgot-password", "/auth/callback", "/invite-accept", "/my-bookings"];

// Reserved first path segments (app routes) - embed booking uses /[workspaceSlug] or /[workspaceSlug]/[eventTypeSlug]
const RESERVED_FIRST_SEGMENTS = ['login', 'register', 'forgot-password', 'reset-password', 'auth', 'invite-accept', 'event-type', 'routingform', 'workflows', 'availability', 'team-members', 'departments', 'services', 'profile', 'integrations', 'contacts', 'billings', 'bookings', 'settings', 'roles-permissions', 'booking-preview', 'api', '_next'];
function isPublicRoutePattern(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return (segments.length === 1 || segments.length === 2) && !RESERVED_FIRST_SEGMENTS.includes(segments[0]);
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname) || isPublicRoutePattern(pathname) || pathname.startsWith('/booking-preview/');
}

// Allowed roles for workspace app
const ALLOWED_ROLES = ['workspace_admin', 'customer', 'manager', 'service_provider'];

const ONBOARDING_AUTH_CHECK_TIMEOUT_MS = 30_000;
/** Cap entire syncAuthFromSession so LayoutWrapper never spins forever on stuck getUser / network. */
const AUTH_SYNC_TIMEOUT_MS = 30_000;

const AUTH_RETRY_MAX_ATTEMPTS = 3
const AUTH_RETRY_INITIAL_DELAY_MS = 1_000

class AuthSyncTimeoutError extends Error {
  constructor() {
    super('AUTH_SYNC_TIMEOUT')
    this.name = 'AuthSyncTimeoutError'
  }
}

class OnboardingCheckTimeoutError extends Error {
  constructor() {
    super('ONBOARDING_CHECK_TIMEOUT')
    this.name = 'OnboardingCheckTimeoutError'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/**
 * Races `promise` against a timer; clears the timer when `promise` settles first
 * so a late timer reject does not become an unhandled rejection.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  // Browser timers use numeric handles; Node typings may use `Timeout` — normalize for `clearTimeout`.
  let timeoutId: number | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(onTimeout()), ms) as unknown as number
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
    }
  }
}

async function workspaceAdminIncompleteOnboardingWithTimeout(
  supabaseClient: Parameters<typeof workspaceAdminIncompleteOnboarding>[0],
  user: SupabaseUser
): Promise<boolean> {
  return withTimeout(
    workspaceAdminIncompleteOnboarding(supabaseClient, user),
    ONBOARDING_AUTH_CHECK_TIMEOUT_MS,
    () => new OnboardingCheckTimeoutError()
  )
}

async function workspaceAdminIncompleteOnboardingWithRetry(
  supabaseClient: Parameters<typeof workspaceAdminIncompleteOnboarding>[0],
  user: SupabaseUser
): Promise<boolean> {
  let delay = AUTH_RETRY_INITIAL_DELAY_MS
  for (let i = 0; i < AUTH_RETRY_MAX_ATTEMPTS; i++) {
    try {
      return await workspaceAdminIncompleteOnboardingWithTimeout(supabaseClient, user)
    } catch (e) {
      if (e instanceof OnboardingCheckTimeoutError && i < AUTH_RETRY_MAX_ATTEMPTS - 1) {
        console.warn(`Onboarding check timed out, retrying in ${delay}ms...`)
        await sleep(delay)
        delay *= 2
      } else {
        throw e
      }
    }
  }
  throw new Error('workspaceAdminIncompleteOnboardingWithRetry: exhausted retries')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const idleDurations = useMemo(() => getWorkspaceIdleLogoutDurations(), [])

  const handleIdleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error(err)
    }
    router.push('/login?reason=idle')
  }, [router])

  const { showWarning, secondsRemaining, staySignedIn } = useIdleLogout(
    Boolean(user) && !loading,
    idleDurations.idleMs,
    idleDurations.warningMs,
    handleIdleLogout
  )

  useRemoteSessionInvalidation(Boolean(user) && !loading, pathname)

  useEffect(() => {
    installWorkspaceApiUnauthorizedHandler()
  }, [])

  useEffect(() => {
    const clearInvalidSession = async () => {
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch {
        /* ignore */
      }
      setUser(null)
      if (!isPublicPath(pathname)) {
        router.push('/login?reason=session_invalid')
      }
    }

    const syncAuthFromSessionInner = async (
      session: Session | null,
      authEvent?: AuthChangeEvent
    ) => {
      if (!session?.user) {
        setUser(null)
        if (!isPublicPath(pathname)) {
          router.push('/login')
        }
        return
      }

      const isAuthCallback = pathname === '/auth/callback'

      // OAuth callback sets the session client-side; Supabase /auth/v1/user can briefly return 403
      // while the access token propagates. Verifying here would sign the user out (clearInvalidSession)
      // without redirect on this public route — leaving /auth/callback stuck on "Finishing sign-in…".
      //
      // USER_UPDATED / TOKEN_REFRESHED: do not call getUser() here. updateUser() and refresh hold the
      // GoTrueClient mutex until _notifyAllSubscribers finishes; getUser() also acquires that lock
      // → deadlock. The event session already carries the server-updated user (e.g. onboarding metadata).
      const skipVerifyGetUser =
        authEvent === 'USER_UPDATED' || authEvent === 'TOKEN_REFRESHED'

      let currentUser: SupabaseUser
      if (isAuthCallback) {
        currentUser = session.user as SupabaseUser
      } else if (skipVerifyGetUser) {
        currentUser = session.user as SupabaseUser
      } else {
        const { data: verified, error: verifyErr } = await supabase.auth.getUser()
        if (verifyErr || !verified.user) {
          console.error(verifyErr ?? new Error('getUser returned no user'))
          await clearInvalidSession()
          return
        }
        currentUser = verified.user
      }

      const userRole = currentUser.user_metadata?.role
      const isDeactivated = currentUser.user_metadata?.deactivated === true

      if (isDeactivated) {
        await supabase.auth.signOut()
        setUser(null)
        if (!isPublicPath(pathname)) {
          router.push('/login')
        }
        return
      }

      if (!isAuthCallback && (!userRole || !ALLOWED_ROLES.includes(userRole))) {
        await supabase.auth.signOut()
        setUser(null)
        if (!isPublicPath(pathname)) {
          router.push('/login')
        }
        return
      }

      if (userRole === 'customer' && !pathname.startsWith('/my-bookings') && !isPublicPath(pathname)) {
        router.push('/my-bookings')
        setUser(currentUser)
        return
      }

      if (
        userRole === 'workspace_admin' &&
        !isPublicPath(pathname) &&
        !isAllowedPathDuringWorkspaceOnboarding(pathname)
      ) {
        let incomplete: boolean
        try {
          incomplete = await workspaceAdminIncompleteOnboardingWithRetry(
            supabase,
            currentUser as SupabaseUser
          )
        } catch (e) {
          console.error(e)
          await clearInvalidSession()
          return
        }
        if (incomplete) {
          const meta = currentUser.user_metadata as Record<string, unknown> | undefined
          router.push(workspaceOnboardingRegisterUrl(meta ?? {}))
          setUser(currentUser)
          return
        }
      }

      setUser(currentUser)
    }

    const syncAuthFromSessionWithTimeout = (session: Session | null, authEvent?: AuthChangeEvent) =>
      withTimeout(syncAuthFromSessionInner(session, authEvent), AUTH_SYNC_TIMEOUT_MS, () => new AuthSyncTimeoutError())

    const syncAuthFromSessionWithRetry = async (
      session: Session | null,
      authEvent?: AuthChangeEvent
    ): Promise<void> => {
      let delay = AUTH_RETRY_INITIAL_DELAY_MS
      for (let i = 0; i < AUTH_RETRY_MAX_ATTEMPTS; i++) {
        try {
          await syncAuthFromSessionWithTimeout(session, authEvent)
          return
        } catch (err) {
          if (err instanceof AuthSyncTimeoutError && i < AUTH_RETRY_MAX_ATTEMPTS - 1) {
            console.warn(`Auth sync timed out, retrying in ${delay}ms...`)
            await sleep(delay)
            delay *= 2
          } else {
            throw err
          }
        }
      }
    }

    const handleAuthSyncFailure = async (err: unknown) => {
      console.error(err)
      if (err instanceof AuthSyncTimeoutError) {
        try {
          await supabase.auth.signOut({ scope: 'local' })
        } catch {
          /* ignore */
        }
        setUser(null)
        if (!isPublicPath(pathname)) {
          router.push('/login?reason=auth_timeout')
        }
        return
      }
      setUser(null)
      if (!isPublicPath(pathname)) {
        router.push('/login')
      }
    }

    const runInitial = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.error(error)
          setUser(null)
          if (!isPublicPath(pathname)) {
            router.push('/login')
          }
          return
        }
        await syncAuthFromSessionWithRetry(data.session ?? null)
      } catch (err) {
        await handleAuthSyncFailure(err)
      } finally {
        setLoading(false)
      }
    }

    void runInitial()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        await syncAuthFromSessionWithRetry(session, event)
      } catch (err) {
        await handleAuthSyncFailure(err)
      } finally {
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, pathname])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      <IdleSessionWarningModal
        open={showWarning}
        secondsRemaining={secondsRemaining}
        onStaySignedIn={staySignedIn}
      />
      {children}
    </AuthContext.Provider>
  )
}

