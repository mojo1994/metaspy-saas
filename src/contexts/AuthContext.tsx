import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

interface User {
  id: string
  email: string
  nome: string
  plano: string
  subscription_status: string
  subscription_expiry: string | null
  clones_used: number
  email_verified: number
}

interface AuthContextType {
  user: User | null
  login: (email: string, senha: string) => Promise<string | null>
  signup: (email: string, nome: string, senha: string) => Promise<string | null>
  logout: () => void
  isAuthenticated: boolean
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>
  updateUser: (data: Partial<User>) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('metaspy_session')
    const storedAccess = localStorage.getItem('metaspy_access_token')
    if (stored && storedAccess) {
      try {
        setUser(JSON.parse(stored))
        setAccessToken(storedAccess)
      } catch {
        localStorage.removeItem('metaspy_session')
        localStorage.removeItem('metaspy_access_token')
      }
    }
  }, [])

  async function login(email: string, password: string): Promise<string | null> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        return body.error || 'Erro ao fazer login'
      }
      const data = await res.json()
      const u: User = {
        id: data.user.id,
        email: data.user.email,
        nome: data.user.name || '',
        plano: data.user.plan || 'nenhum',
        subscription_status: data.user.subscription_status || 'inactive',
        subscription_expiry: data.user.subscription_expiry || null,
        clones_used: data.user.clones_used || 0,
        email_verified: data.user.email_verified || 0
      }
      setUser(u)
      setAccessToken(data.accessToken)
      localStorage.setItem('metaspy_session', JSON.stringify(u))
      localStorage.setItem('metaspy_access_token', data.accessToken)
      return null
    } catch {
      return 'Erro de conexão com o servidor'
    }
  }

  async function signup(email: string, name: string, password: string): Promise<string | null> {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, name, password })
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        return body.error || 'Erro ao criar conta'
      }
      const data = await res.json()
      const u: User = {
        id: data.user.id,
        email: data.user.email,
        nome: data.user.name || '',
        plano: data.user.plan || 'nenhum',
        subscription_status: data.user.subscription_status || 'inactive',
        subscription_expiry: data.user.subscription_expiry || null,
        clones_used: data.user.clones_used || 0,
        email_verified: data.user.email_verified || 0
      }
      setUser(u)
      setAccessToken(data.accessToken)
      localStorage.setItem('metaspy_session', JSON.stringify(u))
      localStorage.setItem('metaspy_access_token', data.accessToken)
      return null
    } catch {
      return 'Erro de conexão com o servidor'
    }
  }

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    setUser(null)
    setAccessToken(null)
    localStorage.removeItem('metaspy_session')
    localStorage.removeItem('metaspy_access_token')
  }

  function updateUser(data: Partial<User>) {
    setUser(prev => {
      if (!prev) return null
      const updated = { ...prev, ...data }
      localStorage.setItem('metaspy_session', JSON.stringify(updated))
      return updated
    })
  }

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers || {})
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    let res = await fetch(url, { ...options, headers, credentials: 'include' })

    if (res.status === 401) {
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        setAccessToken(data.accessToken)
        localStorage.setItem('metaspy_access_token', data.accessToken)
        headers.set('Authorization', `Bearer ${data.accessToken}`)
        res = await fetch(url, { ...options, headers, credentials: 'include' })
      }
    }

    return res
  }, [accessToken])

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isAuthenticated: !!user, fetchWithAuth, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
