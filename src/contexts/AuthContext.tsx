import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

interface User {
  id: string
  email: string
  nome: string
  plano: string
  subscription_status: string
  subscription_expiry: string | null
  clones_used: number
}

interface AuthContextType {
  user: User | null
  login: (email: string, senha: string) => Promise<boolean>
  signup: (email: string, nome: string, senha: string) => Promise<boolean>
  logout: () => void
  isAuthenticated: boolean
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('metaspy_session')
    const storedAccess = localStorage.getItem('metaspy_access_token')
    const storedRefresh = localStorage.getItem('metaspy_refresh_token')
    if (stored && storedAccess) {
      try {
        setUser(JSON.parse(stored))
        setAccessToken(storedAccess)
        if (storedRefresh) setRefreshToken(storedRefresh)
      } catch {
        localStorage.removeItem('metaspy_session')
        localStorage.removeItem('metaspy_access_token')
        localStorage.removeItem('metaspy_refresh_token')
      }
    }
  }, [])

  async function login(email: string, password: string): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      if (!res.ok) return false
      const data = await res.json()
      const u: User = {
        id: data.user.id,
        email: data.user.email,
        nome: data.user.name || '',
        plano: data.user.plan || 'nenhum',
        subscription_status: data.user.subscription_status || 'inactive',
        subscription_expiry: data.user.subscription_expiry || null,
        clones_used: data.user.clones_used || 0
      }
      setUser(u)
      setAccessToken(data.accessToken)
      setRefreshToken(data.refreshToken)
      localStorage.setItem('metaspy_session', JSON.stringify(u))
      localStorage.setItem('metaspy_access_token', data.accessToken)
      localStorage.setItem('metaspy_refresh_token', data.refreshToken)
      return true
    } catch {
      return false
    }
  }

  async function signup(email: string, name: string, password: string): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password })
      })
      if (!res.ok) return false
      const data = await res.json()
      const u: User = {
        id: data.user.id,
        email: data.user.email,
        nome: data.user.name || name,
        plano: data.user.plan || 'nenhum',
        subscription_status: data.user.subscription_status || 'inactive',
        subscription_expiry: null,
        clones_used: 0
      }
      setUser(u)
      setAccessToken(data.accessToken)
      setRefreshToken(data.refreshToken)
      localStorage.setItem('metaspy_session', JSON.stringify(u))
      localStorage.setItem('metaspy_access_token', data.accessToken)
      localStorage.setItem('metaspy_refresh_token', data.refreshToken)
      return true
    } catch {
      return false
    }
  }

  function logout() {
    setUser(null)
    setAccessToken(null)
    setRefreshToken(null)
    localStorage.removeItem('metaspy_session')
    localStorage.removeItem('metaspy_access_token')
    localStorage.removeItem('metaspy_refresh_token')
  }

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers || {})
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    let res = await fetch(url, { ...options, headers })

    if (res.status === 401 && refreshToken) {
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      })
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        setAccessToken(data.accessToken)
        setRefreshToken(data.refreshToken)
        localStorage.setItem('metaspy_access_token', data.accessToken)
        localStorage.setItem('metaspy_refresh_token', data.refreshToken)
        headers.set('Authorization', `Bearer ${data.accessToken}`)
        res = await fetch(url, { ...options, headers })
      }
    }

    return res
  }, [accessToken, refreshToken])

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isAuthenticated: !!user, fetchWithAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
