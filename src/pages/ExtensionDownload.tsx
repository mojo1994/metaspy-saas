import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { IconDownload, IconTarget, IconLocked, IconCheck } from '../components/Icons'

interface ReleaseNote { type: string; description: string }
interface ExtensionInfo {
  version: string
  downloadUrl: string | null
  releaseNotes: ReleaseNote[]
  minBrowserVersion: string
  releaseDate: string | null
}

const INSTALL_STEPS = [
  'Clique em "Baixar Extensão" e salve o arquivo .zip no seu computador.',
  'Descompacte o arquivo em uma pasta de sua preferência.',
  'Abra o Chrome e acesse chrome://extensions.',
  'Ative o "Modo do desenvolvedor" no canto superior direito.',
  'Clique em "Carregar sem compactação" e selecione a pasta descompactada.',
  'Pronto! O ícone do MetaSpy aparecerá na sua barra de extensões.',
]

const TYPE_LABEL: Record<string, string> = {
  novo: 'Novo',
  melhoria: 'Melhoria',
  corrigido: 'Correção',
  seguranca: 'Segurança',
}

export default function ExtensionDownload() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [info, setInfo] = useState<ExtensionInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const isFree = !user || user.plano === 'nenhum'
  const downloadUrl = info?.downloadUrl || (import.meta.env.VITE_EXTENSION_DOWNLOAD_URL as string | undefined) || '/metaspy-extensao.zip'

  useEffect(() => {
    fetch('/api/extension/latest')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setInfo(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (isFree) {
    return (
      <div className="dashboard-home">
        <div className="feature-card locked" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
          <div className="feature-icon"><IconLocked size={32} /></div>
          <h3>MetaSpy — Minerador de Anúncios</h3>
          <p>Baixe a extensão MetaSpy e minere ofertas direto no navegador. Disponível nos planos Básico, Gold e Premium.</p>
          <button className="btn btn-gradient" style={{ marginTop: 12 }} onClick={() => navigate('/planos')}>
            Desbloquear acesso
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-home">
      <div className="dashboard-header">
        <div>
          <h2>Extensão MetaSpy</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Minerador de Anúncios — minere ofertas direto no navegador
          </p>
        </div>
        {info?.version && <span className="badge info">v{info.version}</span>}
      </div>

      <div className="feature-card" style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <div className="feature-icon" style={{ margin: 0 }}><IconTarget size={32} /></div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3 style={{ marginBottom: 6 }}>MetaSpy — Minerador de Anúncios</h3>
          <p>
            Analise anúncios do Facebook com score de escala, detecção de estratégias e extração de criativos,
            sem sair da Biblioteca de Anúncios.
          </p>
          {info?.minBrowserVersion && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              Requer navegador baseado em Chromium versão {info.minBrowserVersion}+ (Chrome, Edge, Brave).
            </p>
          )}
        </div>
        <div>
          {downloadUrl ? (
            <a href={downloadUrl} className="btn btn-gradient" target="_blank" rel="noopener noreferrer" download>
              <IconDownload size={18} /> Baixar Extensão
            </a>
          ) : (
            <button className="btn btn-secondary" disabled title="Link de download ainda não configurado">
              <IconDownload size={18} /> Em breve
            </button>
          )}
        </div>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>Como instalar</h3>
      <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {INSTALL_STEPS.map((step, i) => (
          <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{step}</li>
        ))}
      </ol>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>Novidades desta versão</h3>
      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Carregando...</p>
      ) : info?.releaseNotes?.length ? (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 0, listStyle: 'none' }}>
          {info.releaseNotes.map((note, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
              <span className="badge info" style={{ flexShrink: 0 }}>{TYPE_LABEL[note.type] || note.type}</span>
              <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconCheck size={14} /> {note.description}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sem novidades registradas.</p>
      )}
    </div>
  )
}
