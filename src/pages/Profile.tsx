import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Profile() {
  const { user, logout } = useAuth()
  const [nome, setNome] = useState(user?.nome || '')
  const [email, setEmail] = useState(user?.email || '')
  const [senha, setSenha] = useState('')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')

  function salvarPerfil() {
    setErro('')
    setMsg('')
    if (!nome.trim()) { setErro('Nome obrigatorio.'); return }
    if (!email.trim()) { setErro('Email obrigatorio.'); return }

    const users = JSON.parse(localStorage.getItem('metaspy_users') || '[]')
    const idx = users.findIndex((u: any) => u.email === user?.email)
    if (idx >= 0) {
      if (email !== user?.email && users.some((u: any, i: number) => i !== idx && u.email === email)) {
        setErro('Email ja em uso.')
        return
      }
      users[idx] = { ...users[idx], nome: nome.trim(), email: email.trim() }
      if (senha) users[idx].senha = senha
      localStorage.setItem('metaspy_users', JSON.stringify(users))
    }

    const updated = { email: email.trim(), nome: nome.trim(), plano: user?.plano || 'Free' }
    localStorage.setItem('metaspy_session', JSON.stringify(updated))
    setMsg('Perfil atualizado com sucesso.')
    setSenha('')
    setTimeout(() => setMsg(''), 3000)
  }

  const clonesTotal = (() => {
    try { return JSON.parse(localStorage.getItem('pagevault_jobs') || '[]').length } catch { return 0 }
  })()

  const scriptsTotal = (() => {
    try { return JSON.parse(localStorage.getItem('cloacker_scripts') || '[]').length } catch { return 0 }
  })()

  const plano = user?.plano || 'nenhum'
  const hasPlan = plano !== 'nenhum'
  const planName = plano === 'anual' ? 'Anual' : plano === 'mensal' ? 'Mensal' : 'Nenhum'
  const planColor = plano === 'anual' ? 'var(--purple-300)' : plano === 'mensal' ? 'var(--success)' : 'var(--text-secondary)'

  return (
    <div>
      <div className="tool-header">
        <h3>Perfil da Conta</h3>
        <span className={`status ${hasPlan ? 'on' : 'off'}`}>
          {planName}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="clone-config-section">
          <div className="clone-config-header">Informacoes Pessoais</div>
          <div className="clone-config-body" style={{ gap: 12 }}>
            <div className="filter-group">
              <label>Nome</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div className="filter-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="filter-group">
              <label>Nova senha (deixe em branco para manter)</label>
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Nova senha" />
            </div>
            {erro && <div className="alerta">{erro}</div>}
            {msg && <div style={{ fontSize: 12, borderRadius: 'var(--radius-md)', padding: '8px 12px', background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--success)' }}>{msg}</div>}
            <button className="btn btn-gradient" onClick={salvarPerfil}>Salvar Alteracoes</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="clone-config-section">
            <div className="clone-config-header">Plano e Uso</div>
            <div className="clone-config-body" style={{ gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Plano atual</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: planColor }}>
                    {planName}
                  </div>
                </div>
                <span className={`badge ${hasPlan ? 'ativo' : 'info'}`}>
                  {hasPlan ? 'Ativo' : 'Sem plano'}
                </span>
              </div>

              <div className="stat-card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="label">Clones realizados</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--purple-300)' }}>{clonesTotal}</span>
              </div>
              <div className="stat-card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="label">Scripts de cloaking</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--purple-300)' }}>{scriptsTotal}</span>
              </div>
              <div className="stat-card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="label">Membros na conta</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--purple-300)' }}>1</span>
              </div>

              {!hasPlan && (
                <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 12, color: 'var(--warning)' }}>
                  Voce ainda nao possui um plano. <a href="/planos" style={{ color: 'var(--purple-400)' }}>Ver planos</a> para desbloquear todas as ferramentas.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
