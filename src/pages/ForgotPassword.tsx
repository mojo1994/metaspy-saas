import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { IconLogo } from '../components/Icons'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmSenha, setConfirmSenha] = useState('')
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function checkEmail(e: FormEvent) {
    e.preventDefault()
    setErro(''); setMsg('')
    if (!email.trim()) { setErro('Digite seu email.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Email nao encontrado.'); return }
      setStep('reset')
    } catch { setErro('Erro de conexao com o servidor.') }
    setLoading(false)
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault()
    setErro(''); setMsg('')
    if (!novaSenha || novaSenha.length < 6) { setErro('Nova senha deve ter ao menos 6 caracteres.'); return }
    if (novaSenha !== confirmSenha) { setErro('Senhas nao conferem.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), new_password: novaSenha })
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao redefinir senha.'); return }
      setMsg('Senha redefinida com sucesso!')
      setStep('done')
    } catch { setErro('Erro de conexao com o servidor.') }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="sidebar-logo-icon" style={{ margin: '0 auto 12px', width: 48, height: 48, fontSize: 24 }}>
            <IconLogo size={24} />
          </div>
          <h2>{step === 'done' ? 'Pronto!' : 'Recuperar Senha'}</h2>
          <p>
            {step === 'email' && 'Digite seu email para recuperar a senha.'}
            {step === 'reset' && 'Crie uma nova senha.'}
            {step === 'done' && 'Sua senha foi redefinida com sucesso.'}
          </p>
        </div>

        {erro && <div className="auth-error">{erro}</div>}
        {msg && <div className="auth-error" style={{ background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--success)' }}>{msg}</div>}

        {step === 'email' && (
          <form className="auth-form" onSubmit={checkEmail}>
            <label>
              Email
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoFocus />
            </label>
            <button type="submit" className="btn btn-gradient" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Verificando...' : 'Continuar'}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form className="auth-form" onSubmit={resetPassword}>
            <label style={{ opacity: 0.6 }}>
              Email
              <input type="email" value={email} readOnly />
            </label>
            <label>
              Nova senha
              <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Minimo 6 caracteres" autoFocus />
            </label>
            <label>
              Confirmar senha
              <input type="password" value={confirmSenha} onChange={e => setConfirmSenha(e.target.value)} placeholder="Repita a senha" />
            </label>
            <button type="submit" className="btn btn-gradient" disabled={loading}>
              {loading ? 'Redefinindo...' : 'Redefinir Senha'}
            </button>
          </form>
        )}

        {step === 'done' ? (
          <Link to="/login" className="btn btn-gradient" style={{ display: 'block', textAlign: 'center', marginTop: 12 }}>
            Ir para o Login
          </Link>
        ) : (
          <p style={{ marginTop: 16 }}>
            <Link to="/login" style={{ fontSize: 12 }}>← Voltar ao login</Link>
          </p>
        )}
      </div>
    </div>
  )
}
