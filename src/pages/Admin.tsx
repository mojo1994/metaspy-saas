import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface AdminUser {
  id: string
  name: string
  email: string
  plan: string
  subscription_status: string
  subscription_expiry: string | null
  clones_used: number
  created_at: string
}

export default function Admin() {
  const { fetchWithAuth, user } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [clock, setClock] = useState(new Date())
  const [setPlanLoading, setSetPlanLoading] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const res = await fetchWithAuth('/api/admin/users')
      const data = await res.json()
      if (data.users) setUsers(data.users)
    } catch {}
    setLoading(false)
  }

  async function setPlan(userId: string, plan: string) {
    setSetPlanLoading(userId)
    try {
      const res = await fetchWithAuth(`/api/admin/users/${userId}/plan`, {
        method: 'PUT',
        body: JSON.stringify({ plan }),
      })
      if (res.ok) await loadUsers()
    } catch {}
    setSetPlanLoading(null)
  }

  const activeUsers = users.filter(u => u.subscription_status === 'active')
  const totalUsers = users.length

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1>Painel Administrativo</h1>
          <p className="admin-clock">{clock.toLocaleString('pt-BR')}</p>
        </div>
        <div className="admin-stats">
          <div className="admin-stat-card">
            <span className="admin-stat-num">{totalUsers}</span>
            <span className="admin-stat-label">Total Usuários</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-num">{activeUsers.length}</span>
            <span className="admin-stat-label">Ativos</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-num">{totalUsers - activeUsers.length}</span>
            <span className="admin-stat-label">Sem Plano</span>
          </div>
        </div>
      </div>

      <div className="admin-chart-section">
        <h3>Usuários por Plano</h3>
        <div className="admin-chart">
          {['basico', 'gold', 'premium', 'nenhum'].map(p => {
            const count = users.filter(u => u.plan === p).length
            const pct = totalUsers > 0 ? (count / totalUsers * 100) : 0
            const label = p === 'nenhum' ? 'Sem Plano' : p === 'basico' ? 'Basico' : p === 'gold' ? 'Gold' : 'Premium'
            return (
              <div key={p} className="admin-chart-bar-wrap">
                <div className="admin-chart-label">{label}</div>
                <div className="admin-chart-bar">
                  <div className={`admin-chart-fill fill-${p}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="admin-chart-count">{count}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="admin-users-section">
        <div className="admin-table-header">
          <h3>Usuários</h3>
          <button className="btn btn-secondary" onClick={loadUsers} style={{ fontSize: 12, padding: '4px 12px' }}>
            Atualizar
          </button>
        </div>
        {loading ? (
          <p className="admin-loading">Carregando...</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Plano</th>
                  <th>Status</th>
                  <th>Expira em</th>
                  <th>Clones</th>
                  <th>Cadastro</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td className="admin-email">{u.email}</td>
                    <td>
                      <span className={`badge ${u.plan === 'premium' ? 'alta' : u.plan === 'gold' ? 'alta' : u.plan === 'basico' ? 'ativo' : 'info'}`}>
                        {u.plan === 'nenhum' ? 'Nenhum' : u.plan === 'basico' ? 'Basico' : u.plan === 'gold' ? 'Gold' : 'Premium'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.subscription_status === 'active' ? 'ativo' : ''}`}>
                        {u.subscription_status === 'active' ? 'Ativo' : u.subscription_status === 'inactive' ? 'Inativo' : u.subscription_status}
                      </span>
                    </td>
                    <td>{u.subscription_expiry ? new Date(u.subscription_expiry + 'Z').toLocaleDateString('pt-BR') : '—'}</td>
                    <td>{u.clones_used}</td>
                    <td>{new Date(u.created_at + 'Z').toLocaleDateString('pt-BR')}</td>
                    <td>
                      <div className="admin-actions">
                        {u.plan !== 'basico' && (
                          <button className="btn btn-sm btn-ativo" onClick={() => setPlan(u.id, 'basico')} disabled={setPlanLoading === u.id}>
                            Basico
                          </button>
                        )}
                        {u.plan !== 'gold' && (
                          <button className="btn btn-sm" onClick={() => setPlan(u.id, 'gold')} disabled={setPlanLoading === u.id}>
                            Gold
                          </button>
                        )}
                        {u.plan !== 'premium' && (
                          <button className="btn btn-sm btn-alta" onClick={() => setPlan(u.id, 'premium')} disabled={setPlanLoading === u.id}>
                            Premium
                          </button>
                        )}
                        {u.plan !== 'nenhum' && (
                          <button className="btn btn-sm btn-secondary" onClick={() => setPlan(u.id, 'nenhum')} disabled={setPlanLoading === u.id}>
                            Remover
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-wh-label">
        <span>Webhooks recebidos: <a href="/api/debug/webhooks" target="_blank" rel="noopener noreferrer">/api/debug/webhooks</a></span>
      </div>
    </div>
  )
}
