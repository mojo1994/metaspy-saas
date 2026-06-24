import { useState, FormEvent, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { IconWarning, IconLogo } from '../components/Icons'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  useEffect(() => {
    if (resendTimer <= 0) return
    const id = setInterval(() => setResendTimer(t => t - 1), 1000)
    return () => clearInterval(id)
  }, [resendTimer])

  async function sendCode(e?: FormEvent) {
    if (e) e.preventDefault()
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
      if (!res.ok) { setErro(data.error || 'Erro ao enviar codigo.'); return }
      setMsg(data.message || 'Codigo enviado!')
      setResendTimer(30)
      setStep('code')
    } catch { setErro('Erro de conexao com o servidor.') }
    setLoading(false)
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault()
    setErro(''); setMsg('')
    if (!code.trim() || code.length !== 6) { setErro('Digite o codigo de 6 digitos.'); return }
    if (!novaSenha || novaSenha.length < 6) { setErro('Nova senha deve ter ao menos 6 caracteres.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim(), new_password: novaSenha })
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
        <div style={{ textAlign: 'center' }}>
          <div className="sidebar-logo-icon" style={{ margin: '0 auto 12px', width: 48, height: 48, fontSize: 24 }}>
            <IconLogo size={24} />
          </div>
          <h2>{step === 'done' ? 'Pronto!' : 'Recuperar Senha'}</h2>
          <p>
            {step === 'email' && 'Digite seu email para receber um codigo de 6 digitos.'}
            {step === 'code' && 'Digite o codigo enviado e sua nova senha.'}
            {step === 'done' && 'Sua senha foi redefinida com sucesso.'}
          </p>
        </div>

        {erro && <div className="auth-error">{erro}</div>}
        {msg && <div className="auth-error" style={{ background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--success)' }}>{msg}</div>}

        {step === 'email' && (
          <form className="auth-form" onSubmit={sendCode}>
            <label>
              Email
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
            </label>
            <button type="submit" className="btn btn-gradient" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Enviando...' : 'Enviar Codigo'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form className="auth-form" onSubmit={resetPassword}>
            <label>
              Codigo de 6 digitos
              <input type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, fontFamily: 'monospace' }} />
            </label>
            <label>
              Nova senha
              <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Minimo 6 caracteres" />
            </label>
            <button type="submit" className="btn btn-gradient" disabled={loading}>
              {loading ? 'Redefinindo...' : 'Redefinir Senha'}
            </button>
            <p style={{ fontSize: 12, textAlign: 'center', marginTop: 12, color: 'var(--text-muted)' }}>
              Nao recebeu?{' '}
              {resendTimer > 0 ? (
                <span style={{ color: 'var(--text-secondary)' }}>Reenviar em {resendTimer}s</span>
              ) : (
                <Link to="" onClick={(e) => { e.preventDefault(); sendCode() }} style={{ color: 'var(--purple-400)' }}>
                  Reenviar codigo
                </Link>
              )}
            </p>
            <p style={{ fontSize: 11, textAlign: 'center', marginTop: 4, color: 'var(--purple-400)' }}>
              <IconWarning /> Nao encontrou? Verifique sua caixa de spam.
            </p>
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
