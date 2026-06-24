import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Profile() {
  const { user, fetchWithAuth, updateUser } = useAuth()
  const [nome, setNome] = useState(user?.nome || '')
  const [email, setEmail] = useState(user?.email || '')
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')

  async function salvarPerfil() {
    setErro('')
    setMsg('')
    if (!nome.trim()) { setErro('Nome obrigatorio.'); return }
    if (!email.trim()) { setErro('Email obrigatorio.'); return }

    try {
      const res = await fetchWithAuth('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: nome.trim(), email: email.trim() })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErro(data.error || 'Erro ao atualizar perfil')
        return
      }
      const data = await res.json()
      updateUser({ nome: data.user.name, email: data.user.email })
      setMsg('Perfil atualizado com sucesso.')
      setTimeout(() => setMsg(''), 3000)
    } catch {
      setErro('Erro de conexao com o servidor')
    }
  }

  async function alterarSenha() {
    setErro('')
    setMsg('')
    if (!senhaAtual) { setErro('Digite sua senha atual.'); return }
    if (!novaSenha || novaSenha.length < 6) { setErro('Nova senha deve ter ao menos 6 caracteres.'); return }

    try {
      const res = await fetchWithAuth('/api/user/password', {
        method: 'PUT',
        body: JSON.stringify({ current_password: senhaAtual, new_password: novaSenha })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErro(data.error || 'Erro ao alterar senha')
        return
      }
      setMsg('Senha alterada com sucesso.')
      setSenhaAtual('')
      setNovaSenha('')
      setTimeout(() => setMsg(''), 3000)
    } catch {
      setErro('Erro de conexao com o servidor')
    }
  }

  const clonesTotal = (() => {
    try { return JSON.parse(localStorage.getItem('pagevault_jobs') || '[]').length } catch { return 0 }
  })()

  const scriptsTotal = (() => {
    try { return JSON.parse(localStorage.getItem('cloacker_scripts') || '[]').length } catch { return 0 }
  })()

  const plano = user?.plano || 'nenhum'
  const hasPlan = plano !== 'nenhum'
  const planName = plano === 'premium' ? 'Premium' : plano === 'gold' ? 'Gold' : plano === 'basico' ? 'Basico' : 'Nenhum'
  const planColor = plano === 'premium' ? 'var(--purple-300)' : plano === 'gold' ? 'var(--warning)' : plano === 'basico' ? 'var(--success)' : 'var(--text-secondary)'

  return (
    <div>
      <div className="tool-header">
        <h3>Perfil da Conta</h3>
        <span className={`status ${hasPlan ? 'on' : 'off'}`}>
          {planName}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              {erro && <div className="alerta">{erro}</div>}
              {msg && <div style={{ fontSize: 12, borderRadius: 'var(--radius-md)', padding: '8px 12px', background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--success)' }}>{msg}</div>}
              <button className="btn btn-gradient" onClick={salvarPerfil}>Salvar Alteracoes</button>
            </div>
          </div>

          <div className="clone-config-section">
            <div className="clone-config-header">Alterar Senha</div>
            <div className="clone-config-body" style={{ gap: 12 }}>
              <div className="filter-group">
                <label>Senha atual</label>
                <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} placeholder="Senha atual" />
              </div>
              <div className="filter-group">
                <label>Nova senha</label>
                <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Minimo 6 caracteres" />
              </div>
              <button className="btn btn-secondary" onClick={alterarSenha} style={{ alignSelf: 'flex-start' }}>Alterar Senha</button>
            </div>
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
