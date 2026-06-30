import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { IconLogo } from '../components/Icons'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [step, setStep] = useState<'email' | 'form'>('email')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function checkEmail() {
    setErro('')
    if (!email) { setErro('Digite seu email.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })
      const data = await res.json()
      if (data.exists) {
        setErro('Email ja cadastrado! <a href="/login" style="color:var(--purple-400)">Faca login</a>')
      } else {
        setStep('form')
      }
    } catch { setErro('Erro de conexao com o servidor.') }
    setLoading(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!nome || !email || !senha) { setErro('Preencha todos os campos.'); return }
    if (senha.length < 6) { setErro('Senha deve ter ao menos 6 caracteres.'); return }
    setLoading(true)
    const error = await signup(email.trim(), nome.trim(), senha)
    setLoading(false)
    if (error === null) navigate('/planos')
    else setErro(error)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="sidebar-logo-icon" style={{ margin: '0 auto 12px', width: 48, height: 48, fontSize: 24 }}>
            <IconLogo size={24} />
          </div>
          <h2>{step === 'email' ? 'Teste Gratis' : 'Criar Conta'}</h2>
          <p>{step === 'email' ? 'Digite seu email para comecar' : 'Complete seu cadastro'}</p>
        </div>
        {erro && <div className="auth-error" dangerouslySetInnerHTML={{ __html: erro }} />}

        {step === 'email' && (
          <div className="auth-form">
            <label>
              Email
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoFocus />
            </label>
            <button type="button" className="btn btn-gradient" disabled={loading} onClick={checkEmail} style={{ marginTop: 4 }}>
              {loading ? 'Verificando...' : 'Continuar'}
            </button>
          </div>
        )}

        {step === 'form' && (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Nome
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" autoFocus />
            </label>
            <label style={{ opacity: 0.6 }}>
              Email
              <input type="email" value={email} readOnly />
            </label>
            <label>
              Senha
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Minimo 6 caracteres" />
            </label>
            <button type="submit" className="btn btn-gradient" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Criando...' : 'Criar Conta'}
            </button>
          </form>
        )}

        {step === 'email' && (
          <>
            <p>Ja tem conta? <Link to="/login">Entre</Link></p>
            <p><Link to="/" style={{ fontSize: 12 }}>← Voltar</Link></p>
          </>
        )}
        {step === 'form' && (
          <p style={{ textAlign: 'center' }}>
            <Link to="" onClick={(e) => { e.preventDefault(); setStep('email'); setErro('') }} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              ← Trocar email
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
