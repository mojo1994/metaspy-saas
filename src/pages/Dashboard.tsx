import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useEffect } from 'react'

export default function Dashboard() {
  const { user, logout, isAuthenticated } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated) navigate('/login', { replace: true })
  }, [isAuthenticated, navigate])

  function handleLogout() {
    logout()
    navigate('/')
  }

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
          <NavLink to="/dashboard" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            MetaSpy
          </NavLink>
          <NavLink to="/dashboard/pagevault" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            Clonador
          </NavLink>
          <NavLink to="/dashboard/cloacker" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            Cloacker
          </NavLink>
        </nav>

        <div className="sidebar-section-label">Conta</div>
        <div style={{ padding: '4px 12px 10px' }}>
          {user && (
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.nome}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{user.email}</div>
              <div style={{ marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className={`badge ${user.plano === 'anual' ? 'alta' : user.plano === 'mensal' ? 'ativo' : 'info'}`}>
                  {user.plano === 'anual' ? 'Anual' : user.plano === 'mensal' ? 'Mensal' : 'Nenhum'}
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
              ⚙ PAINEL
            </NavLink>
          )}
        </nav>

        <div className="sidebar-section-label">Aparencia</div>
        <div style={{ padding: '4px 12px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['dark', 'light', 'system'] as const).map(m => (
              <button
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
          <button className="sidebar-link" onClick={handleLogout} style={{ fontSize: 12, color: 'var(--text-muted)', justifyContent: 'center' }}>
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
