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
const PUBLIC_ROUTES = ["/login", "/forgot-password", "/reset-password", "/auth/login", "/auth/forgot-password"];

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
        if (!PUBLIC_ROUTES.includes(pathname)) {
          router.push('/login')
        }
        return
      }

      const session = data.session
      const currentUser = session?.user ?? null
      
      // If user is logged in, verify role
      if (currentUser) {
        const userRole = currentUser.user_metadata?.role
        // Only allow superadmin role
        if (userRole !== 'superadmin') {
          // Sign out user with wrong role
          await supabase.auth.signOut()
          setUser(null)
          setLoading(false)
          if (!PUBLIC_ROUTES.includes(pathname)) {
            router.push('/login')
          }
          return
        }
      }

      setUser(currentUser)
      setLoading(false)
      
      // Only redirect to login if not on a public route
      if (!session && !PUBLIC_ROUTES.includes(pathname)) {
        router.push('/login')
      }
    }

    getSession()

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null
      
      // If user is logged in, verify role
      if (currentUser) {
        const userRole = currentUser.user_metadata?.role
        // Only allow superadmin role
        if (userRole !== 'superadmin') {
          // Sign out user with wrong role
          await supabase.auth.signOut()
          setUser(null)
          if (!PUBLIC_ROUTES.includes(pathname)) {
            router.push('/login')
          }
          return
        }
      }

      setUser(currentUser)
      
      // Only redirect to login if not on a public route
      if (!session && !PUBLIC_ROUTES.includes(pathname)) {
        router.push('/login')
      }
      
      // If logged in and on login page, redirect to home
      if (session && pathname === '/login') {
        router.push('/')
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

