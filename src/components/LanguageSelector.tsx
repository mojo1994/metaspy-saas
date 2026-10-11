import { useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { normalizeLanguage, SUPPORTED_LANGUAGES } from '../i18n'
import { IconChevronDown } from './Icons'

interface Props {
  className?: string
  align?: 'left' | 'right'
}

export default function LanguageSelector({ className = '', align = 'right' }: Props) {
  const { t, i18n } = useTranslation()
  const { isAuthenticated, fetchWithAuth, updateUser } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const active = normalizeLanguage(i18n.language)
  const activeLang = SUPPORTED_LANGUAGES.find(l => l.code === active) || SUPPORTED_LANGUAGES[0]

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function choose(code: string) {
    await i18n.changeLanguage(code)
    try { localStorage.setItem('metaspy_lang', code) } catch {}
    if (isAuthenticated) {
      updateUser({ preferred_language: code } as never)
      fetchWithAuth('/api/user/language', { method: 'PUT', body: JSON.stringify({ preferred_language: code }) }).catch(() => {})
    }
    setOpen(false)
  }

  const menuPos: CSSProperties = align === 'right' ? { right: 0 } : { left: 0 }

  return (
    <div ref={ref} className={`lang-selector ${className}`} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('language.select')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'transparent', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '6px 10px',
          cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{activeLang.flag}</span>
        <span>{t('language.label')}</span>
        <IconChevronDown size={12} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={t('language.select')}
          style={{
            position: 'absolute', ...menuPos, top: 'calc(100% + 6px)', minWidth: 200,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            padding: 6, zIndex: 50,
          }}
        >
          {SUPPORTED_LANGUAGES.map(l => (
            <button
              key={l.code}
              type="button"
              role="option"
              aria-selected={l.code === active}
              onClick={() => choose(l.code)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                textAlign: 'left',
                background: l.code === active ? 'rgba(168,85,247,0.12)' : 'transparent',
                border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 10px',
                cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13,
              }}
            >
              <span style={{ fontSize: 16 }}>{l.flag}</span>
              <span style={{ flex: 1 }}>{l.name}</span>
              {l.code === active && <span style={{ color: 'var(--purple-400)' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
