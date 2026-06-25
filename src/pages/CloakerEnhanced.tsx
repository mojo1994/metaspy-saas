import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { IconLocked } from '../components/Icons'

interface Script {
  id: string
  target_url: string
  safe_url: string
  script_code: string
  created_at: string
}

export default function CloakerEnhanced() {
  const { user, fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const [targetUrl, setTargetUrl] = useState('')
  const [safeUrl, setSafeUrl] = useState('')
  const [scriptCode, setScriptCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [scripts, setScripts] = useState<Script[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadScripts() }, [])

  async function loadScripts() {
    try {
      const res = await fetchWithAuth('/api/cloaker/scripts')
      if (res.ok) setScripts((await res.json()) || [])
    } catch {}
  }

  async function generate() {
    setError('')
    if (!targetUrl || !safeUrl) { setError('Preencha todas as URLs'); return }
    try { new URL(targetUrl) } catch { setError('URL de destino invalida'); return }
    try { new URL(safeUrl) } catch { setError('URL segura invalida'); return }
    setGenerating(true)
    try {
      const res = await fetchWithAuth('/api/cloaker/generate-enhanced', {
        method: 'POST',
        body: JSON.stringify({ target_url: targetUrl, safe_url: safeUrl })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao gerar'); return }
      setScriptCode(data.script_code)
      setCopied(false)
      await loadScripts()
    } catch { setError('Erro de conexao') }
    setGenerating(false)
  }

  function copyCode() {
    navigator.clipboard.writeText(scriptCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  if (user?.plano !== 'premium') {
    return <div className="tool-locked"><div className="tool-locked-icon"><IconLocked size={24} /></div><h3>Script Avançado</h3><p>Apenas no plano Premium.</p><button className="btn btn-primary" onClick={() => navigate('/planos')}>Ver Planos</button></div>
  }

  return (
    <div>
      <div className="tool-header">
        <h3>Script de Cloaking Avançado</h3>
        <span className={`status ${scriptCode ? 'on' : 'off'}`}>{scriptCode ? 'Pronto' : 'Aguardando'}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Versao com sistema de pontuacao de fraude multicamada (13 heuristicas). Bloqueia headless browsers,
        scrapers e bots analisando navegador, plugins, memoria, tempo de carregamento e mais.
      </div>
      <div className="clone-layout">
        <div className="clone-config">
          <div className="clone-config-section">
            <div className="clone-config-header">Configuracao</div>
            <div className="clone-config-body" style={{ gap: 12 }}>
              <div className="filter-group">
                <label>URL de destino (para humanos)</label>
                <input type="url" placeholder="https://exemplo.com/oferta" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} />
              </div>
              <div className="filter-group">
                <label>URL segura (para bots)</label>
                <input type="url" placeholder="https://exemplo.com/seguro" value={safeUrl} onChange={e => setSafeUrl(e.target.value)} />
              </div>
              {error && <div className="alerta">{error}</div>}
              <button className="btn btn-gradient" onClick={generate} disabled={generating || !targetUrl || !safeUrl}>
                {generating ? 'Gerando...' : 'Gerar Script Avancado'}
              </button>
            </div>
          </div>
          {scriptCode && (
            <div className="clone-config-section">
              <div className="clone-config-header">Script Gerado</div>
              <div className="clone-config-body" style={{ gap: 8 }}>
                <div style={{ maxHeight: 260, overflow: 'auto', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {scriptCode}
                </div>
                <button className="btn btn-primary" onClick={copyCode} style={{ flex: 1 }}>{copied ? 'Copiado!' : 'Copiar'}</button>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <strong>Como usar:</strong> Cole antes do <code style={{ background: 'var(--bg-primary)', padding: '1px 5px', borderRadius: 3 }}>{'</head>'}</code> da sua landing page.
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="clone-right">
          <div className="clone-history-card">
            <div className="clone-history-header"><span>Scripts Gerados ({scripts.length})</span></div>
            {scripts.length === 0 ? <div className="clone-history-empty">Nenhum script ainda.</div> : (
              <div className="clone-history-list">{scripts.map(s => (
                <div key={s.id} className="clone-job-card">
                  <div className="clone-job-top"><span className="badge ativo">Avancado</span><span className="clone-job-time">{new Date(s.created_at).toLocaleString('pt-BR')}</span></div>
                  <div className="clone-job-actions" style={{ marginTop: 6 }}>
                    <button className="btn btn-secondary" onClick={() => { setTargetUrl(s.target_url); setSafeUrl(s.safe_url); setScriptCode(s.script_code) }}>Usar</button>
                  </div>
                </div>
              ))}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
