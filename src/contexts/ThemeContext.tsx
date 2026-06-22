import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type ThemeMode = 'dark' | 'light' | 'system'

interface ThemeContextType {
  theme: ThemeMode
  resolved: 'dark' | 'light'
  setTheme: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('metaspy_theme')
    return (stored as ThemeMode) || 'dark'
  })

  const [resolved, setResolved] = useState<'dark' | 'light'>(
    theme === 'system' ? getSystemTheme() : theme
  )

  function setTheme(mode: ThemeMode) {
    setThemeState(mode)
    localStorage.setItem('metaspy_theme', mode)
  }

  useEffect(() => {
    const r = theme === 'system' ? getSystemTheme() : theme
    setResolved(r)
    document.documentElement.setAttribute('data-theme', r)
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    function handler(e: MediaQueryListEvent) {
      const r = e.matches ? 'light' : 'dark'
      setResolved(r)
      document.documentElement.setAttribute('data-theme', r)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
