'use client' // if using App Router

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { installWorkspaceApiUnauthorizedHandler } from '@/src/lib/install_workspace_api_unauthorized_handler'
import { useRouter, usePathname } from 'next/navigation'
import type { User as SupabaseUser } from '@supabase/supabase-js'
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    installWorkspaceApiUnauthorizedHandler()
  }, [])

  useEffect(() => {
    // Get current session and verify role
    const getSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.error(error)
          if (!isPublicPath(pathname)) {
            router.push('/login')
          }
          return
        }

        const session = data.session
        const currentUser = session?.user ?? null

        // If user is logged in, verify role and deactivated status
        if (currentUser) {
          const userRole = currentUser.user_metadata?.role
          const isDeactivated = currentUser.user_metadata?.deactivated === true
          const isAuthCallback = pathname === "/auth/callback"

          // Check if user is deactivated
          if (isDeactivated) {
            await supabase.auth.signOut()
            setUser(null)
            if (!isPublicPath(pathname)) {
              router.push('/login')
            }
            return
          }

          // Block superadmin and only allow workspace roles
          // NOTE: For /auth/callback allow a temporary missing role so the callback page can set it.
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
            const incomplete = await workspaceAdminIncompleteOnboarding(
              supabase,
              currentUser as SupabaseUser
            )
            if (incomplete) {
              const meta = currentUser.user_metadata as Record<string, unknown> | undefined
              router.push(workspaceOnboardingRegisterUrl(meta ?? {}))
              setUser(currentUser)
              return
            }
          }
        }

        setUser(currentUser)

        if (!session && !isPublicPath(pathname)) {
          router.push('/login')
        }
      } catch (err) {
        console.error(err)
        setUser(null)
        if (!isPublicPath(pathname)) {
          router.push('/login')
        }
      } finally {
        setLoading(false)
      }
    }

    getSession()

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        const currentUser = session?.user ?? null

        // If user is logged in, verify role and deactivated status
        if (currentUser) {
          const userRole = currentUser.user_metadata?.role
          const isDeactivated = currentUser.user_metadata?.deactivated === true
          const isAuthCallback = pathname === "/auth/callback"

          // Check if user is deactivated
          if (isDeactivated) {
            await supabase.auth.signOut()
            setUser(null)
            if (!isPublicPath(pathname)) {
              router.push('/login')
            }
            return
          }

          // Block superadmin and only allow workspace roles
          // NOTE: For /auth/callback allow a temporary missing role so the callback page can set it.
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
            const incomplete = await workspaceAdminIncompleteOnboarding(
              supabase,
              currentUser as SupabaseUser
            )
            if (incomplete) {
              const meta = currentUser.user_metadata as Record<string, unknown> | undefined
              router.push(workspaceOnboardingRegisterUrl(meta ?? {}))
              setUser(currentUser)
              return
            }
          }
        }

        setUser(currentUser)

        if (!session && !isPublicPath(pathname)) {
          router.push('/login')
        }
        // Post-login navigation is handled by LoginForm (onboarding, bootstrap, role targets) to avoid racing redirects.
      } catch (err) {
        console.error(err)
        setUser(null)
        if (!isPublicPath(pathname)) {
          router.push('/login')
        }
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
      {children}
    </AuthContext.Provider>
  )
}

