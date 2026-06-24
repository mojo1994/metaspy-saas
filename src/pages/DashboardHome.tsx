import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { IconTarget, IconDiamond, IconLocked } from '../components/Icons'

export default function DashboardHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hour = time.getHours()
  const greeting = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite'

  const isAtivo = user?.plano === 'basico' || user?.plano === 'gold' || user?.plano === 'premium'

  return (
    <div className="dashboard-home">
      <div className="dashboard-header">
        <div>
          <h2>
            {greeting}, {user?.nome?.split(' ')[0] || 'Usuario'}
          </h2>
        </div>
        <div className="clock-display">
          {time.toLocaleTimeString('pt-BR')}
        </div>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, marginTop: 8 }}>Acesso rapido</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div
          className={`feature-card${user?.plano === 'nenhum' ? ' locked' : ''}`}
          onClick={() => user?.plano === 'nenhum' ? navigate('/planos') : navigate('/dashboard/metaspy')}
          style={{ cursor: 'pointer', '--i': 0 } as React.CSSProperties}
        >
          <div className="feature-icon">{user?.plano === 'nenhum' ? <IconLocked size={24} /> : <IconTarget size={24} />}</div>
          <h3>MetaSpy Ads</h3>
          <p>Analise anuncios do Facebook com score de escala e deteccao de estrategias.</p>
          <div className="feature-action">
            {user?.plano === 'nenhum' ? 'Desbloquear →' : 'Acessar →'}
          </div>
        </div>
        <div
          className={`feature-card${user?.plano === 'nenhum' ? ' locked' : ''}`}
          onClick={() => user?.plano === 'nenhum' ? navigate('/planos') : navigate('/dashboard/pagevault')}
          style={{ cursor: 'pointer', '--i': 1 } as React.CSSProperties}
        >
          <div className="feature-icon"><IconDiamond size={24} /></div>
          <h3>Clonador</h3>
          <p>Clone paginas web offline com suporte a sites complexos e bypass.</p>
          <div className="feature-action">
            {user?.plano === 'nenhum' ? 'Desbloquear →' : 'Acessar →'}
          </div>
        </div>
        <div
          className={`feature-card${user?.plano === 'nenhum' || user?.plano === 'basico' ? ' locked' : ''}`}
          onClick={() => user?.plano === 'nenhum' || user?.plano === 'basico' ? navigate('/planos') : navigate('/dashboard/cloacker')}
          style={{ cursor: 'pointer', '--i': 2 } as React.CSSProperties}
        >
          <div className="feature-icon"><IconLocked size={24} /></div>
          <h3>Cloacker</h3>
          <p>Gere scripts de cloaking para proteger suas campanhas de bots.</p>
          <div className="feature-action">
            {user?.plano === 'nenhum' || user?.plano === 'basico' ? 'Desbloquear →' : 'Acessar →'}
          </div>
        </div>
      </div>
    </div>
  )
}
