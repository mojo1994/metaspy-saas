import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import LanguageSelector from '../components/LanguageSelector'
import { IconLogo } from '../components/Icons'

export default function Login() {
  const { login } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!email || !senha) { setErro(t('auth.login.required')); return }
    setLoading(true)
    const error = await login(email, senha)
    setLoading(false)
    if (error === null) navigate('/dashboard')
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
          <h2>{t('auth.login.title')}</h2>
          <p>{t('auth.login.subtitle')}</p>
        </div>
        {erro && <div className="auth-error">{erro}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            {t('auth.login.email')}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
          </label>
          <label>
            {t('auth.login.password')}
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link to="/redefinir-senha" style={{ fontSize: 12, color: 'var(--purple-400)' }}>{t('auth.login.forgot')}</Link>
          </div>
          <button type="submit" className="btn btn-gradient" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? t('auth.login.submitting') : t('auth.login.submit')}
          </button>
        </form>
        <p>{t('auth.login.noAccount')} <Link to="/signup">{t('auth.login.signupLink')}</Link></p>
        <p><Link to="/" style={{ fontSize: 12 }}>← {t('auth.login.back')}</Link></p>
      </div>
    </div>
  )
}
