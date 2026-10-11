import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import LanguageSelector from '../components/LanguageSelector'
import { IconLogo } from '../components/Icons'

export default function Signup() {
  const { signup } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [step, setStep] = useState<'email' | 'form'>('email')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function checkEmail() {
    setErro('')
    if (!email) { setErro(t('auth.signup.noEmail')); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })
      const data = await res.json()
      if (data.exists) {
        setErro(`${t('auth.signup.emailExists')} <a href="/login" style="color:var(--purple-400)">${t('auth.signup.loginHere')}</a>`)
      } else {
        setStep('form')
      }
    } catch { setErro(t('auth.signup.connectionError')) }
    setLoading(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!nome || !email || !senha) { setErro(t('auth.signup.required')); return }
    if (senha.length < 6) { setErro(t('auth.signup.shortPassword')); return }
    setLoading(true)
    const error = await signup(email.trim(), nome.trim(), senha)
    setLoading(false)
    if (error === null) navigate('/planos')
    else setErro(error)
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
          <h2>{step === 'email' ? t('auth.signup.titleFree') : t('auth.signup.titleCreate')}</h2>
          <p>{step === 'email' ? t('auth.signup.descEmail') : t('auth.signup.descForm')}</p>
        </div>
        {erro && <div className="auth-error" dangerouslySetInnerHTML={{ __html: erro }} />}

        {step === 'email' && (
          <div className="auth-form">
            <label>
              {t('auth.signup.email')}
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" autoFocus />
            </label>
            <button type="button" className="btn btn-gradient" disabled={loading} onClick={checkEmail} style={{ marginTop: 4 }}>
              {loading ? t('auth.signup.checking') : t('auth.signup.continue')}
            </button>
          </div>
        )}

        {step === 'form' && (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              {t('auth.signup.name')}
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder={t('auth.signup.namePlaceholder')} autoFocus />
            </label>
            <label style={{ opacity: 0.6 }}>
              {t('auth.signup.email')}
              <input type="email" value={email} readOnly />
            </label>
            <label>
              {t('auth.signup.password')}
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder={t('auth.signup.passwordPlaceholder')} />
            </label>
            <button type="submit" className="btn btn-gradient" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? t('auth.signup.submitting') : t('auth.signup.submit')}
            </button>
          </form>
        )}

        {step === 'email' && (
          <>
            <p>{t('auth.signup.haveAccount')} <Link to="/login">{t('auth.signup.enter')}</Link></p>
            <p><Link to="/" style={{ fontSize: 12 }}>← {t('auth.signup.back')}</Link></p>
          </>
        )}
        {step === 'form' && (
          <p style={{ textAlign: 'center' }}>
            <Link to="" onClick={(e) => { e.preventDefault(); setStep('email'); setErro('') }} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              ← {t('auth.signup.switchEmail')}
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
