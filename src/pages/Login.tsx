import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!email || !senha) { setErro('Preencha todos os campos.'); return }
    setLoading(true)
    const error = await login(email, senha)
    setLoading(false)
    if (error === null) navigate('/dashboard')
    else setErro(error)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center' }}>
          <div className="sidebar-logo-icon" style={{ margin: '0 auto 12px', width: 48, height: 48, fontSize: 24 }}>
            ◉
          </div>
          <h2>Entrar</h2>
          <p>Entre na sua conta MetaSpy</p>
        </div>
        {erro && <div className="auth-error">{erro}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
          </label>
          <label>
            Senha
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" />
          </label>
          <button type="submit" className="btn btn-gradient" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p>
          Não tem conta? <Link to="/signup">Cadastre-se</Link>
        </p>
        <p>
          <Link to="/" style={{ fontSize: 12 }}>← Voltar</Link>
        </p>
      </div>
    </div>
  )
}
