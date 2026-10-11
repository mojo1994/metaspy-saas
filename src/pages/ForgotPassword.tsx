import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSelector from '../components/LanguageSelector'
import { IconLogo } from '../components/Icons'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmSenha, setConfirmSenha] = useState('')
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function requestCode(e: FormEvent) {
    e.preventDefault()
    setErro(''); setMsg('')
    if (!email) { setErro(t('auth.signup.noEmail')); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErro(data.error || t('auth.forgot.connectionError')); setLoading(false); return }
      setMsg(t('auth.forgot.codeToEmail'))
      setStep('code')
    } catch { setErro(t('auth.forgot.connectionError')) }
    setLoading(false)
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault()
    setErro(''); setMsg('')
    if (code.trim().length !== 6) { setErro(t('auth.forgot.requiredCode')); return }
    if (!novaSenha || novaSenha.length < 6) { setErro(t('auth.forgot.shortPassword')); return }
    if (novaSenha !== confirmSenha) { setErro(t('auth.forgot.mismatch')); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim(), new_password: novaSenha })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErro(data.error || t('auth.forgot.connectionError')); setLoading(false); return }
      setMsg(t('auth.forgot.codeOk'))
      setStep('done')
    } catch { setErro(t('auth.forgot.connectionError')) }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <LanguageSelector align="right" />
        </div>
        <div className="auth-header">
          <div className="sidebar-logo-icon" style={{ margin: '0 auto 12px', width: 48, height: 48, fontSize: 24 }}>
            <IconLogo size={24} />
          </div>
          <h2>{step === 'done' ? t('auth.forgot.doneTitle') : t('auth.forgot.title')}</h2>
          <p>
            {step === 'email' && t('auth.forgot.descEmail')}
            {step === 'code' && t('auth.forgot.descCode')}
            {step === 'done' && t('auth.forgot.descDone')}
          </p>
        </div>

        {erro && <div className="auth-error">{erro}</div>}
        {msg && <div className="auth-error" style={{ background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--success)' }}>{msg}</div>}

        {step === 'email' && (
          <form className="auth-form" onSubmit={requestCode}>
            <label>
              {t('auth.forgot.email')}
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" autoFocus />
            </label>
            <button type="submit" className="btn btn-gradient" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? t('auth.forgot.sending') : t('auth.forgot.sendCode')}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form className="auth-form" onSubmit={resetPassword}>
            <label style={{ opacity: 0.6 }}>
              {t('auth.forgot.email')}
              <input type="email" value={email} readOnly />
            </label>
            <label>
              {t('auth.forgot.codeLabel')}
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
              />
            </label>
            <label>
              {t('auth.forgot.newPassword')}
              <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder={t('auth.forgot.newPasswordPlaceholder')} />
            </label>
            <label>
              {t('auth.forgot.confirmPassword')}
              <input type="password" value={confirmSenha} onChange={e => setConfirmSenha(e.target.value)} placeholder={t('auth.forgot.confirmPlaceholder')} />
            </label>
            <button type="submit" className="btn btn-gradient" disabled={loading}>
              {loading ? t('auth.forgot.resetting') : t('auth.forgot.resetPassword')}
            </button>
          </form>
        )}

        {step === 'done' ? (
          <Link to="/login" className="btn btn-gradient" style={{ display: 'block', textAlign: 'center', marginTop: 12 }}>
            {t('auth.forgot.gotoLogin')}
          </Link>
        ) : (
          <p style={{ marginTop: 16 }}>
            <Link to="/login" style={{ fontSize: 12 }}>← {t('auth.forgot.backToLogin')}</Link>
          </p>
        )}
      </div>
    </div>
  )
}
