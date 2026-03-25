'use client' // if using App Router

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, usePathname } from 'next/navigation'

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
const RESERVED_FIRST_SEGMENTS = ['login', 'register', 'forgot-password', 'reset-password', 'auth', 'invite-accept', 'event-type', 'routingform', 'workflows', 'availability', 'team-members', 'departments', 'services', 'profile', 'integrations', 'contacts', 'billings', 'bookings', 'settings', 'booking-preview', 'api', '_next'];
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
    // Get current session and verify role
    const getSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.error(error)
        setLoading(false)
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
          setLoading(false)
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
          setLoading(false)
          if (!isPublicPath(pathname)) {
            router.push('/login')
          }
          return
        }

        if (userRole === 'customer' && !pathname.startsWith('/my-bookings') && !isPublicPath(pathname)) {
          router.push('/my-bookings')
          setUser(currentUser)
          setLoading(false)
          return
        }
      }

      setUser(currentUser)
      setLoading(false)
      
      if (!session && !isPublicPath(pathname)) {
        router.push('/login')
      }
    }

    getSession()

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
      }

      setUser(currentUser)
      
      if (!session && !isPublicPath(pathname)) {
        router.push('/login')
      }
      
      if (session && pathname === '/login') {
        const loginRole = session.user?.user_metadata?.role
        router.push(loginRole === 'customer' ? '/my-bookings' : '/')
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

