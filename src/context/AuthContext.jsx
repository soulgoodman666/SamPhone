import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const DEMO_KEY = 'samphone.demo.entered'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [demo, setDemo] = useState(false)
  const [connection, setConnection] = useState(isSupabaseConfigured ? 'belum diuji' : 'tidak dikonfigurasi')

  useEffect(() => {
    if (!supabase) {
      setDemo(localStorage.getItem(DEMO_KEY) === '1')
      setLoading(false)
      return undefined
    }

    let active = true
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setConnection(`Gagal menghubungi Supabase: ${error.message}`)
          setSession(null)
        } else {
          setSession(data.session)
          setConnection(data.session ? 'sesi aktif' : 'belum diverifikasi')
        }
      })
      .catch((error) => {
        if (active) setConnection(`Gagal menghubungi Supabase: ${error.message}`)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setConnection(nextSession ? 'sesi aktif' : 'belum diverifikasi')
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({
    configured: isSupabaseConfigured,
    loading,
    session,
    user: session?.user ?? null,
    demo,
    connection,
    async signIn(email, password) {
      const result = await supabase.auth.signInWithPassword({ email, password })
      if (result.error) throw new Error(result.error.message)
      return result.data
    },
    async signUp(email, password, fullName) {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (result.error) throw new Error(result.error.message)
      return result.data
    },
    async signOut() {
      if (supabase) {
        const result = await supabase.auth.signOut()
        if (result.error) throw new Error(result.error.message)
      }
      localStorage.removeItem(DEMO_KEY)
      setDemo(false)
    },
    enterDemo() {
      localStorage.setItem(DEMO_KEY, '1')
      setDemo(true)
    },
  }), [connection, demo, loading, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return value
}
