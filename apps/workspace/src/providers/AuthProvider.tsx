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

const ONBOARDING_AUTH_CHECK_TIMEOUT_MS = 15_000;
/** Cap entire syncAuthFromSession so LayoutWrapper never spins forever on stuck getUser / network. */
const AUTH_SYNC_TIMEOUT_MS = 25_000;

class AuthSyncTimeoutError extends Error {
  constructor() {
    super('AUTH_SYNC_TIMEOUT')
    this.name = 'AuthSyncTimeoutError'
  }
}

async function workspaceAdminIncompleteOnboardingWithTimeout(
  supabaseClient: Parameters<typeof workspaceAdminIncompleteOnboarding>[0],
  user: SupabaseUser
): Promise<boolean> {
  return Promise.race([
    workspaceAdminIncompleteOnboarding(supabaseClient, user),
    new Promise<boolean>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('ONBOARDING_CHECK_TIMEOUT')),
        ONBOARDING_AUTH_CHECK_TIMEOUT_MS
      );
    }),
  ]);
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
          incomplete = await workspaceAdminIncompleteOnboardingWithTimeout(
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

    const syncAuthFromSessionWithTimeout = (
      session: Session | null,
      authEvent?: AuthChangeEvent
    ) =>
      Promise.race([
        syncAuthFromSessionInner(session, authEvent),
        new Promise<void>((_, reject) => {
          window.setTimeout(() => reject(new AuthSyncTimeoutError()), AUTH_SYNC_TIMEOUT_MS)
        }),
      ])

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
        await syncAuthFromSessionWithTimeout(data.session ?? null)
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
        await syncAuthFromSessionWithTimeout(session, event)
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

