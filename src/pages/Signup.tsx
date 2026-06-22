import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Signup() {
  const { verifySignup } = useAuth()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [step, setStep] = useState<'form' | 'code'>('form')
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(''); setMsg('')
    if (!nome || !email || !senha) { setErro('Preencha todos os campos.'); return }
    if (senha.length < 6) { setErro('Senha deve ter ao menos 6 caracteres.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: nome.trim(), password: senha })
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao criar conta.'); setLoading(false); return }
      setMsg('Codigo de confirmacao enviado para seu email!')
      setStep('code')
    } catch { setErro('Erro de conexao com o servidor.') }
    setLoading(false)
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    setErro(''); setMsg('')
    if (!codigo || codigo.length !== 6) { setErro('Digite o codigo de 6 digitos.'); return }
    setLoading(true)
    const error = await verifySignup(email.trim(), codigo)
    setLoading(false)
    if (error === null) navigate('/planos')
    else setErro(error)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center' }}>
          <div className="sidebar-logo-icon" style={{ margin: '0 auto 12px', width: 48, height: 48, fontSize: 24 }}>
            ◉
          </div>
          <h2>{step === 'form' ? 'Criar Conta' : 'Confirmar Email'}</h2>
          <p>
            {step === 'form' ? 'Comece a usar o MetaSpy gratis' : 'Digite o codigo enviado para seu email'}
          </p>
        </div>
        {erro && <div className="auth-error">{erro}</div>}
        {msg && <div className="auth-error" style={{ background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--success)' }}>{msg}</div>}

        {step === 'form' && (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Nome
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
            </label>
            <label>
              Senha
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Minimo 6 caracteres" />
            </label>
            <button type="submit" className="btn btn-gradient" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Enviando...' : 'Criar Conta'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form className="auth-form" onSubmit={handleVerify}>
            <label>
              Codigo de confirmacao
              <input type="text" value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, fontFamily: 'monospace' }} />
            </label>
            <button type="submit" className="btn btn-gradient" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Confirmando...' : 'Confirmar Cadastro'}
            </button>
            <p style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              <Link to="" onClick={(e) => { e.preventDefault(); setStep('form'); setMsg(''); setErro('') }} style={{ color: 'var(--purple-400)' }}>
                Voltar e corrigir dados
              </Link>
            </p>
          </form>
        )}

        {step === 'form' && (
          <>
            <p>Ja tem conta? <Link to="/login">Entre</Link></p>
            <p><Link to="/" style={{ fontSize: 12 }}>← Voltar</Link></p>
          </>
        )}
      </div>
    </div>
  )
}
