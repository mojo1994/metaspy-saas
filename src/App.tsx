import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import Planos from './pages/Planos'
import Dashboard from './pages/Dashboard'
import DashboardHome from './pages/DashboardHome'
import MetaSpyTool from './pages/MetaSpyTool'
import PageVaultTool from './pages/PageVaultTool'
import CloackerTool from './pages/CloackerTool'
import CloakDetector from './pages/CloakDetector'
import CamuflagemTexto from './pages/CamuflagemTexto'
import CamuflagemMidia from './pages/CamuflagemMidia'
import CloakerEnhanced from './pages/CloakerEnhanced'
import CloakerCampanhas from './pages/CloakerCampanhas'
import CloakerSteganografia from './pages/CloakerSteganografia'
import CloakerFingerprint from './pages/CloakerFingerprint'
import CloakerLogs from './pages/CloakerLogs'
import HostPage from './pages/HostPage'
import MetadataCleaner from './pages/MetadataCleaner'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import QuizzesList from './pages/QuizzesList'
import QuizBuilder from './pages/QuizBuilder'
import QuizStats from './pages/QuizStats'
import PlayQuiz from './pages/PlayQuiz'
import { useAuth } from './contexts/AuthContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/planos" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/planos" element={<Planos />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
        <Route index element={<DashboardHome />} />
        <Route path="metaspy" element={<MetaSpyTool />} />
        <Route path="pagevault" element={<PageVaultTool />} />
        <Route path="cloacker" element={<CloackerTool />} />
        <Route path="cloacker/detector" element={<CloakDetector />} />
        <Route path="cloacker/camouflage/texto" element={<CamuflagemTexto />} />
        <Route path="cloacker/camouflage/midia" element={<CamuflagemMidia />} />
        <Route path="cloacker/avancado" element={<CloakerEnhanced />} />
        <Route path="cloacker/campanhas" element={<CloakerCampanhas />} />
        <Route path="cloacker/steganografia" element={<CloakerSteganografia />} />
        <Route path="cloacker/fingerprint" element={<CloakerFingerprint />} />
        <Route path="cloacker/logs" element={<CloakerLogs />} />
        <Route path="hospedar" element={<HostPage />} />
        <Route path="cleaner" element={<MetadataCleaner />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="configuracoes" element={<Settings />} />
        <Route path="admin" element={<Admin />} />
        <Route path="quizzes" element={<QuizzesList />} />
        <Route path="quiz/:id" element={<QuizBuilder />} />
        <Route path="quiz/:id/stats" element={<QuizStats />} />
      </Route>
      <Route path="/quiz/:slug" element={<PlayQuiz />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
