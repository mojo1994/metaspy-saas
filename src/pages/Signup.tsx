import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!nome || !email || !senha) { setErro('Preencha todos os campos.'); return }
    if (senha.length < 6) { setErro('Senha deve ter ao menos 6 caracteres.'); return }
    setLoading(true)
    const error = await signup(email, nome, senha)
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
          <h2>Criar Conta</h2>
          <p>Comece a usar o MetaSpy grátis</p>
        </div>
        {erro && <div className="auth-error">{erro}</div>}
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
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)}             placeholder="Mínimo 6 caracteres" />
          </label>
          <button type="submit" className="btn btn-gradient" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Criando...' : 'Criar Conta'}
          </button>
        </form>
        <p>
          Já tem conta? <Link to="/login">Entre</Link>
        </p>
        <p>
          <Link to="/" style={{ fontSize: 12 }}>← Voltar</Link>
        </p>
      </div>
    </div>
  )
}
