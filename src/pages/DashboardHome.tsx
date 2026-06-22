import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function DashboardHome() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const clonesTotal = (() => {
    try { return JSON.parse(localStorage.getItem('pagevault_jobs') || '[]').length } catch { return 0 }
  })()

  const scriptsTotal = (() => {
    try { return JSON.parse(localStorage.getItem('cloacker_scripts') || '[]').length } catch { return 0 }
  })()

  const anunciosTotal = (() => {
    try { return JSON.parse(localStorage.getItem('metaspy_results') || '[]').length } catch { return 0 }
  })()

  return (
    <div>
      <div className="dashboard-header">
        <h2>Bem-vindo, {user?.nome || 'Usuario'}</h2>
        <span className={`status ${user?.plano === 'Free' ? 'off' : 'on'}`}>
          {user?.plano || 'Free'}
        </span>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="value">{anunciosTotal}</div>
          <div className="label">Anuncios analisados</div>
        </div>
        <div className="stat-card">
          <div className="value">{clonesTotal}</div>
          <div className="label">Paginas clonadas</div>
        </div>
        <div className="stat-card">
          <div className="value">{scriptsTotal}</div>
          <div className="label">Scripts de cloaking</div>
        </div>
        <div className="stat-card">
          <div className="value">{user?.plano === 'Free' ? '3' : '∞'}</div>
          <div className="label">Clones restantes</div>
        </div>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, marginTop: 8 }}>Acesso rapido</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div className={`feature-card${user?.plano === 'nenhum' ? ' locked' : ''}`} onClick={() => user?.plano === 'nenhum' ? navigate('/planos') : navigate('/dashboard/metaspy')} style={{ cursor: 'pointer' }}>
          <div className="feature-icon">{user?.plano === 'nenhum' ? '◉' : '◎'}</div>
          <h3>MetaSpy Ads {user?.plano === 'nenhum' && <span style={{ fontSize: 10, color: 'var(--warning)', marginLeft: 4 }}>(bloqueado)</span>}</h3>
          <p>Analise anuncios do Facebook com score de escala e deteccao de estrategias.</p>
        </div>
        <div className={`feature-card${user?.plano === 'nenhum' ? ' locked' : ''}`} onClick={() => user?.plano === 'nenhum' ? navigate('/planos') : navigate('/dashboard/pagevault')} style={{ cursor: 'pointer' }}>
          <div className="feature-icon">◈</div>
          <h3>Clonador {user?.plano === 'nenhum' && <span style={{ fontSize: 10, color: 'var(--warning)', marginLeft: 4 }}>(bloqueado)</span>}</h3>
          <p>Clone paginas web offline com suporte a sites complexos e bypass.</p>
        </div>
        <div className={`feature-card${user?.plano !== 'anual' ? ' locked' : ''}`} onClick={() => user?.plano !== 'anual' ? navigate('/planos') : navigate('/dashboard/cloacker')} style={{ cursor: 'pointer' }}>
          <div className="feature-icon">⊘</div>
          <h3>Cloacker {user?.plano !== 'anual' && <span style={{ fontSize: 10, color: 'var(--warning)', marginLeft: 4 }}>(anual)</span>}</h3>
          <p>Gere scripts de cloaking para proteger suas campanhas de bots.</p>
        </div>
      </div>
    </div>
  )
}
