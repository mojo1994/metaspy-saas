import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import Planos from './pages/Planos'
import Ajuda from './pages/Ajuda'
import Dashboard from './pages/Dashboard'
import DashboardHome from './pages/DashboardHome'
import ExtensionDownload from './pages/ExtensionDownload'
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
import PrivacyPolicy from './pages/PrivacyPolicy'
import CookiePolicy from './pages/CookiePolicy'
import AccountDeletion from './pages/AccountDeletion'
import CookieConsentBanner from './components/CookieConsentBanner'
import { useAuth } from './contexts/AuthContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <>
      <Routes>
      <Route path="/" element={<Navigate to="/planos" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/redefinir-senha" element={<ForgotPassword />} />
      <Route path="/privacidade" element={<PrivacyPolicy />} />
      <Route path="/cookies" element={<CookiePolicy />} />
      <Route path="/excluir-conta" element={<AccountDeletion />} />
      <Route path="/planos" element={<Planos />} />
      <Route path="/ajuda" element={<Ajuda />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
        <Route index element={<DashboardHome />} />
        <Route path="extensao" element={<ExtensionDownload />} />
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <CookieConsentBanner />
    </>
  )
}
