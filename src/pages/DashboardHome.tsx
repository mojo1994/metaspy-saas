import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    setDisplay(0)
    const from = 0
    const to = value
    const duration = 1000
    const start = performance.now()
    let frame: number

    function update(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.floor(from + (to - from) * eased))
      if (progress < 1) frame = requestAnimationFrame(update)
    }

    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <>{display}{suffix}</>
}

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

  const isAtivo = user?.plano === 'mensal' || user?.plano === 'anual'

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
    <div className="dashboard-home">
      <div className="dashboard-header">
        <div>
          <h2>
            {greeting}, {user?.nome?.split(' ')[0] || 'Usuario'}
          </h2>
          <div className="dashboard-greeting-sub">
            <span className={`pulse-dot ${isAtivo ? 'active' : ''}`} />
            <span>
              {isAtivo
                ? user?.plano === 'anual'
                  ? 'Plano Anual — recursos liberados'
                  : 'Plano Mensal — recursos liberados'
                : 'Sem plano ativo'}
            </span>
          </div>
        </div>
        <div className="clock-display">
          {time.toLocaleTimeString('pt-BR')}
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card" style={{ '--i': 0 } as React.CSSProperties}>
          <div className="stat-card-icon">◎</div>
          <div className="value"><AnimatedCounter value={anunciosTotal} /></div>
          <div className="label">Anuncios analisados</div>
        </div>
        <div className="stat-card" style={{ '--i': 1 } as React.CSSProperties}>
          <div className="stat-card-icon">◈</div>
          <div className="value"><AnimatedCounter value={clonesTotal} /></div>
          <div className="label">Paginas clonadas</div>
        </div>
        <div className="stat-card" style={{ '--i': 2 } as React.CSSProperties}>
          <div className="stat-card-icon">⊘</div>
          <div className="value"><AnimatedCounter value={scriptsTotal} /></div>
          <div className="label">Scripts de cloaking</div>
        </div>
        <div className="stat-card" style={{ '--i': 3 } as React.CSSProperties}>
          <div className="stat-card-icon">◉</div>
          <div className="value">
            {isAtivo
              ? <span style={{ fontSize: 24, lineHeight: 1 }}>∞</span>
              : <AnimatedCounter value={0} />}
          </div>
          <div className="label">Clones restantes</div>
        </div>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, marginTop: 8 }}>Acesso rapido</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div
          className={`feature-card${user?.plano === 'nenhum' ? ' locked' : ''}`}
          onClick={() => user?.plano === 'nenhum' ? navigate('/planos') : navigate('/dashboard/metaspy')}
          style={{ cursor: 'pointer', '--i': 0 } as React.CSSProperties}
        >
          <div className="feature-icon">{user?.plano === 'nenhum' ? '◉' : '◎'}</div>
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
          <div className="feature-icon">◈</div>
          <h3>Clonador</h3>
          <p>Clone paginas web offline com suporte a sites complexos e bypass.</p>
          <div className="feature-action">
            {user?.plano === 'nenhum' ? 'Desbloquear →' : 'Acessar →'}
          </div>
        </div>
        <div
          className={`feature-card${user?.plano !== 'anual' ? ' locked' : ''}`}
          onClick={() => user?.plano !== 'anual' ? navigate('/planos') : navigate('/dashboard/cloacker')}
          style={{ cursor: 'pointer', '--i': 2 } as React.CSSProperties}
        >
          <div className="feature-icon">⊘</div>
          <h3>Cloacker</h3>
          <p>Gere scripts de cloaking para proteger suas campanhas de bots.</p>
          <div className="feature-action">
            {user?.plano !== 'anual' ? 'Desbloquear →' : 'Acessar →'}
          </div>
        </div>
      </div>
    </div>
  )
}
