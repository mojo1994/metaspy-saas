import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Planos from './pages/Planos'
import Dashboard from './pages/Dashboard'
import DashboardHome from './pages/DashboardHome'
import MetaSpyTool from './pages/MetaSpyTool'
import PageVaultTool from './pages/PageVaultTool'
import CloackerTool from './pages/CloackerTool'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import { useAuth } from './contexts/AuthContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/planos" element={<Planos />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
        <Route index element={<DashboardHome />} />
        <Route path="metaspy" element={<MetaSpyTool />} />
        <Route path="pagevault" element={<PageVaultTool />} />
        <Route path="cloacker" element={<CloackerTool />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="configuracoes" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
