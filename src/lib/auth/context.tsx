'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { User } from '@/types'

interface AuthContextType {
  supabaseUser: SupabaseUser | null
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  supabaseUser: null,
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  async function fetchUser(id: string) {
    const { data } = await supabase
      .from('users')
      .select('*, location:locations(*)')
      .eq('id', id)
      .single()
    if (data) setUser(data as User)
  }

  async function refreshUser() {
    if (supabaseUser) await fetchUser(supabaseUser.id)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setSupabaseUser(null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null)
      if (session?.user) fetchUser(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null)
      if (session?.user) fetchUser(session.user.id)
      else setUser(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ supabaseUser, user, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
