import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useEffect, useState } from 'react'
import { IconGear } from '../components/Icons'

export default function Dashboard() {
  const { user, logout, isAuthenticated } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const isFree = user?.plano === 'nenhum'
  function redirectIfFree(e: React.MouseEvent) {
    if (isFree) { e.preventDefault(); navigate('/planos') }
  }

  useEffect(() => {
    if (!isAuthenticated) navigate('/login', { replace: true })
  }, [isAuthenticated, navigate])

  useEffect(() => {
    if (!user || user.plano !== 'nenhum') return
    const path = location.pathname
    if (path === '/dashboard') return
    if (path === '/dashboard/perfil' || path === '/dashboard/configuracoes' || path === '/dashboard/admin') return
    navigate('/planos', { replace: true })
  }, [location.pathname, user, navigate])

  function handleLogout() {
    logout()
    navigate('/')
  }

  const isCloackerSub = location.pathname.startsWith('/dashboard/cloacker')
  const [cloackerOpen, setCloackerOpen] = useState(isCloackerSub)
  const isCamoSub = location.pathname.startsWith('/dashboard/cloacker/camouflage')
  const [camoOpen, setCamoOpen] = useState(isCamoSub)
  const isHospedarSub = location.pathname.startsWith('/dashboard/hospedar')
  const [hospedarOpen, setHospedarOpen] = useState(isHospedarSub)

  useEffect(() => {
    if (isCloackerSub) setCloackerOpen(true)
  }, [isCloackerSub])

  useEffect(() => {
    if (isCamoSub) setCamoOpen(true)
  }, [isCamoSub])

  useEffect(() => {
    if (isHospedarSub) setHospedarOpen(true)
  }, [isHospedarSub])

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-text">
            <h1>MetaSpy</h1>
            <p>Inteligencia de ofertas</p>
          </div>
        </div>

        <div className="sidebar-section-label">Ferramentas</div>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" end onClick={redirectIfFree} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            MetaSpy
          </NavLink>
          <NavLink to="/dashboard/pagevault" onClick={redirectIfFree} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            Clonador
          </NavLink>
          <div className="sidebar-group">
            <button
              type="button"
              className={`sidebar-link sidebar-group-toggle${location.pathname.startsWith('/dashboard/cloacker') ? ' active' : ''}`}
              onClick={() => setCloackerOpen(!cloackerOpen)}
              aria-expanded={cloackerOpen}
            >
              <span>Cloacker</span>
              <span className="sidebar-arrow" data-open={cloackerOpen}>›</span>
            </button>
            <div className={`sidebar-subnav${cloackerOpen ? ' open' : ''}`}>
              <NavLink to="/dashboard/cloacker" end onClick={redirectIfFree} className={({ isActive }) => `sidebar-sublink ${isActive ? 'active' : ''}`}>
                Gerar Script
              </NavLink>
              <NavLink to="/dashboard/cloacker/avancado" onClick={redirectIfFree} className={({ isActive }) => `sidebar-sublink ${isActive ? 'active' : ''}`}>
                Script Avancado
              </NavLink>
              <NavLink to="/dashboard/cloacker/campanhas" onClick={redirectIfFree} className={({ isActive }) => `sidebar-sublink ${isActive ? 'active' : ''}`}>
                Campanhas
              </NavLink>
              <NavLink to="/dashboard/cloacker/steganografia" onClick={redirectIfFree} className={({ isActive }) => `sidebar-sublink ${isActive ? 'active' : ''}`}>
                Esteganografia
              </NavLink>
              <NavLink to="/dashboard/cloacker/fingerprint" onClick={redirectIfFree} className={({ isActive }) => `sidebar-sublink ${isActive ? 'active' : ''}`}>
                Detector Fingerprint
              </NavLink>
              <NavLink to="/dashboard/cloacker/logs" onClick={redirectIfFree} className={({ isActive }) => `sidebar-sublink ${isActive ? 'active' : ''}`}>
                Logs
              </NavLink>
              <NavLink to="/dashboard/cloacker/detector" onClick={redirectIfFree} className={({ isActive }) => `sidebar-sublink ${isActive ? 'active' : ''}`}>
                Quebra de Cloacker
              </NavLink>
              <div className="sidebar-group">
                <button
                  type="button"
                  className={`sidebar-link sidebar-group-toggle${location.pathname.startsWith('/dashboard/cloacker/camouflage') ? ' active' : ''}`}
                  onClick={() => setCamoOpen(!camoOpen)}
                  style={{ paddingLeft: 16, fontSize: 12 }}
                  aria-expanded={camoOpen}
                >
                  <span>Camuflagem</span>
                  <span className="sidebar-arrow" data-open={camoOpen}>›</span>
                </button>
                <div className={`sidebar-subnav${camoOpen ? ' open' : ''}`}>
                  <NavLink to="/dashboard/cloacker/camouflage/texto" onClick={redirectIfFree} className={({ isActive }) => `sidebar-sublink ${isActive ? 'active' : ''}`}>
                    Texto
                  </NavLink>
                  <NavLink to="/dashboard/cloacker/camouflage/midia" onClick={redirectIfFree} className={({ isActive }) => `sidebar-sublink ${isActive ? 'active' : ''}`}>
                    Midia
                  </NavLink>
                </div>
              </div>
            </div>
          </div>
          <div className="sidebar-group">
            <button
              type="button"
              className={`sidebar-link sidebar-group-toggle${location.pathname.startsWith('/dashboard/hospedar') ? ' active' : ''}`}
              onClick={() => setHospedarOpen(!hospedarOpen)}
              aria-expanded={hospedarOpen}
            >
              <span>Hospedar</span>
              <span className="sidebar-arrow" data-open={hospedarOpen}>›</span>
            </button>
            <div className={`sidebar-subnav${hospedarOpen ? ' open' : ''}`}>
              <NavLink to="/dashboard/hospedar" end onClick={redirectIfFree} className={({ isActive }) => `sidebar-sublink ${isActive ? 'active' : ''}`}>
                Hospedar Pagina
              </NavLink>
            </div>
          </div>
          <NavLink to="/dashboard/cleaner" onClick={redirectIfFree} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            Remover Metadados
          </NavLink>
        </nav>

        <div className="sidebar-section-label">Conta</div>
        <div style={{ padding: '4px 12px 10px' }}>
          {user && (
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.nome}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{user.email}</div>
              <div style={{ marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className={`badge ${user.plano === 'premium' ? 'alta' : user.plano === 'gold' ? 'alta' : user.plano === 'basico' ? 'ativo' : 'info'}`}>
                  {user.plano === 'premium' ? 'Premium' : user.plano === 'gold' ? 'Gold' : user.plano === 'basico' ? 'Básico' : 'Nenhum'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {user.plano === 'nenhum' ? 'Sem plano' : 'Ilimitado'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-section-label">Navegacao</div>
        <nav className="sidebar-nav" style={{ flex: 'none' }}>
          <NavLink to="/dashboard/perfil" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            Perfil
          </NavLink>
          <NavLink to="/dashboard/configuracoes" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            Configuracoes
          </NavLink>
          {user?.email === '09santos.felipe@gmail.com' && (
            <NavLink to="/dashboard/admin" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <IconGear size={14} /> PAINEL
            </NavLink>
          )}
        </nav>

        <div className="sidebar-section-label">Aparencia</div>
        <div style={{ padding: '4px 12px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['dark', 'light', 'system'] as const).map(m => (
              <button
                type="button"
                key={m}
                className={`btn ${theme === m ? 'btn-accent' : 'btn-secondary'}`}
                onClick={() => setTheme(m)}
                style={{ padding: '4px 8px', fontSize: 10, flex: 1, textTransform: 'capitalize' }}
              >
                {m === 'dark' ? 'Escuro' : m === 'light' ? 'Claro' : 'Sistema'}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <button type="button" className="sidebar-link" onClick={handleLogout} style={{ fontSize: 12, color: 'var(--text-muted)', justifyContent: 'center' }}>
            Sair
          </button>
        </div>
      </aside>
      <main className="main-area">
        <Outlet />
      </main>
    </div>
  )
}
