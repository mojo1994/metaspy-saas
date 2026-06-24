import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import HelpTooltip from '../components/HelpTooltip'
import { IconLocked } from '../components/Icons'

interface CloackerScript {
  id: string
  targetUrl: string
  safeUrl: string
  createdAt: string
  scriptCode: string
}

export default function CloackerTool() {
  const { user, fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const [targetUrl, setTargetUrl] = useState('')
  const [safeUrl, setSafeUrl] = useState('')
  const [scriptCode, setScriptCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [scripts, setScripts] = useState<CloackerScript[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadScripts()
  }, [])

  async function loadScripts() {
    try {
      const res = await fetchWithAuth('/api/cloaker/scripts')
      if (res.ok) {
        const data = await res.json()
        setScripts(data.scripts || [])
      }
    } catch {}
  }

  async function generate() {
    setError('')
    if (!targetUrl || !safeUrl) {
      setError('Preencha todas as URLs')
      return
    }
    try { new URL(targetUrl) } catch { setError('URL de destino invalida'); return }
    try { new URL(safeUrl) } catch { setError('URL segura invalida'); return }

    setGenerating(true)
    try {
      const res = await fetchWithAuth('/api/cloaker/generate', {
        method: 'POST',
        body: JSON.stringify({ targetUrl, safeUrl })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao gerar script')
        return
      }
      setScriptCode(data.scriptCode)
      setCopied(false)
      await loadScripts()
    } catch {
      setError('Erro de conexao com o servidor')
    } finally {
      setGenerating(false)
    }
  }

  async function removeScript(id: string) {
    const res = await fetchWithAuth(`/api/cloaker/script/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setScripts(prev => prev.filter(s => s.id !== id))
    }
  }

  async function downloadScript(script: CloackerScript) {
    try {
      const res = await fetchWithAuth(`/api/cloaker/script/${script.id}/download`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `cloaker-${script.id.slice(0, 8)}.js`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {}
  }

  function copyCode() {
    navigator.clipboard.writeText(scriptCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const hasCloaker = user?.plano === 'gold' || user?.plano === 'premium'

  if (!hasCloaker) {
    return (
      <div className="tool-locked">
        <div className="tool-locked-icon"><IconLocked size={24} /></div>
        <h3>Cloacker</h3>
        <p>Disponivel apenas nos planos Gold e Premium.</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Assine o plano Gold ou Premium e tenha acesso ao gerador de scripts de cloaking,
          minerador de anuncios, clonador de paginas e todas as ferramentas.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/planos')}>
          Ver Planos
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="tool-header">
        <h3>Cloacker — Gerador de Scripts de Cloaking</h3>
        <span className={`status ${scriptCode ? 'on' : 'off'}`}>
          {scriptCode ? 'Script pronto' : 'Aguardando'}
        </span>
      </div>

      <div className="clone-layout">
        <div className="clone-config">
          <div className="clone-config-section">
            <div className="clone-config-header">Configuracao do Cloaking</div>
            <div className="clone-config-body" style={{ gap: 12 }}>
              <div className="filter-group">
                <label>
                  URL de destino (para humanos) <HelpTooltip text="URL real da sua pagina de oferta que sera mostrada para visitantes reais." />
                </label>
                <input
                  type="url"
                  placeholder="https://exemplo.com/oferta"
                  value={targetUrl}
                  onChange={e => setTargetUrl(e.target.value)}
                />
              </div>
              <div className="filter-group">
                <label>
                  URL segura (para bots) <HelpTooltip text="URL que sera mostrada para bots, crawlers e visitantes suspeitos (ex: pagina generica)." />
                </label>
                <input
                  type="url"
                  placeholder="https://exemplo.com/seguro"
                  value={safeUrl}
                  onChange={e => setSafeUrl(e.target.value)}
                />
              </div>
              {error && <div className="alerta">{error}</div>}
              <button className="btn btn-gradient" onClick={generate} disabled={generating || !targetUrl || !safeUrl}>
                {generating ? 'Gerando...' : 'Gerar Script de Cloaking'}
              </button>
            </div>
          </div>

          {scriptCode && (
            <div className="clone-config-section">
              <div className="clone-config-header">Script Gerado</div>
              <div className="clone-config-body" style={{ gap: 8 }}>
                <div style={{
                  maxHeight: 260, overflow: 'auto',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {scriptCode}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={copyCode} style={{ flex: 1 }}>
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <strong>Como usar:</strong> Cole este script antes do <code style={{ background: 'var(--bg-primary)', padding: '1px 5px', borderRadius: 3 }}>{'</head>'}</code> da sua pagina de entrada (landing page).
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="clone-right">
          <div className="clone-history-card">
            <div className="clone-history-header">
              <span>Historico de Scripts ({scripts.length})</span>
            </div>
            {scripts.length === 0 ? (
              <div className="clone-history-empty">
                Nenhum script gerado. Preencha as URLs acima e clique em "Gerar Script de Cloaking".
              </div>
            ) : (
              <div className="clone-history-list">
                {scripts.map(s => (
                  <div key={s.id} className="clone-job-card">
                    <div className="clone-job-top">
                      <span className="badge ativo">Gerado</span>
                      <span className="clone-job-time">{new Date(s.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Destino: <span style={{ color: 'var(--text-secondary)' }}>{s.targetUrl}</span></div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Seguro: <span style={{ color: 'var(--text-secondary)' }}>{s.safeUrl}</span></div>
                    <div className="clone-job-actions">
                      <button className="btn btn-secondary" onClick={() => { setTargetUrl(s.targetUrl); setSafeUrl(s.safeUrl); setScriptCode(s.scriptCode) }}>Usar</button>
                      <button className="btn btn-secondary" onClick={() => downloadScript(s)}>Download</button>
                      <button className="btn btn-secondary" onClick={() => removeScript(s.id)}>Remover</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
