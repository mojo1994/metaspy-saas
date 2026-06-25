import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { IconLocked } from '../components/Icons'

interface FingerprintResult {
  score: number
  suspicious_reasons: string[]
  details: {
    user_agent_mismatch: boolean
    headless_chrome: boolean
    missing_plugins: boolean
    missing_mime_types: boolean
    no_touch_support: boolean
    webdriver_detected: boolean
    languages_mismatch: boolean
    inconsistent_platform: boolean
    screen_anomaly: boolean
    no_battery: boolean
    missing_webgl: boolean
    memory_anomaly: boolean
    canvas_fingerprint: string
    timezone_mismatch: boolean
    storage_inconsistent: boolean
  }
}

export default function CloakerFingerprint() {
  const { user, fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [result, setResult] = useState<FingerprintResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function testFingerprint() {
    setError('')
    if (!url) { setError('URL obrigatoria'); return }
    setLoading(true)
    try {
      const res = await fetchWithAuth('/api/cloaker/fingerprint', {
        method: 'POST',
        body: JSON.stringify({ url })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro'); return }
      setResult(data)
    } catch { setError('Erro de conexao') }
    setLoading(false)
  }

  if (user?.plano !== 'premium') {
    return <div className="tool-locked"><div className="tool-locked-icon"><IconLocked size={24} /></div><h3>Detector de Fingerprint</h3><p>Apenas no plano Premium.</p><button className="btn btn-primary" onClick={() => navigate('/planos')}>Ver Planos</button></div>
  }

  return (
    <div>
      <div className="tool-header">
        <h3>Detector de Fingerprint</h3>
        <span className={`status ${result ? 'on' : 'off'}`}>{result ? `Score: ${result.score}/100` : 'Aguardando'}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Analise uma URL com o motor de deteccao de 13 heuristicas. Veja se um visitante parece
        humano ou bot antes de decidir o redirecionamento.
      </div>

      <div className="clone-config-section">
        <div className="clone-config-header">Testar URL</div>
        <div className="clone-config-body" style={{ gap: 10 }}>
          <div className="filter-group">
            <label>URL para testar</label>
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://exemplo.com/oferta" />
          </div>
          {error && <div className="alerta">{error}</div>}
          <button className="btn btn-gradient" onClick={testFingerprint} disabled={loading || !url}>
            {loading ? 'Testando...' : 'Testar Fingerprint'}
          </button>
        </div>
      </div>

      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div className="clone-config-section">
            <div className="clone-config-header">Pontuacao</div>
            <div className="clone-config-body">
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 700,
                  background: result.score >= 70 ? 'var(--danger-bg)' : result.score >= 40 ? 'var(--warning-bg)' : 'var(--success-bg)',
                  color: result.score >= 70 ? 'var(--danger)' : result.score >= 40 ? 'var(--warning)' : 'var(--success)',
                  border: `3px solid ${result.score >= 70 ? 'var(--danger)' : result.score >= 40 ? 'var(--warning)' : 'var(--success)'}`
                }}>{result.score}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                  {result.score >= 70 ? 'Provavel bot' : result.score >= 40 ? 'Suspeito' : 'Provavel humano'}
                </div>
              </div>
              {result.suspicious_reasons.length > 0 && (
                <>
                  <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600, marginBottom: 4 }}>Razoes suspeitas:</div>
                  {result.suspicious_reasons.map((r, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--danger)', padding: '2px 0' }}>• {r}</div>
                  ))}
                </>
              )}
            </div>
          </div>
          <div className="clone-config-section">
            <div className="clone-config-header">Deteccoes Detalhadas</div>
            <div className="clone-config-body" style={{ gap: 2 }}>
              {Object.entries(result.details).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid var(--border)', color: val === true ? 'var(--danger)' : val === false ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                  <span>{key.replace(/_/g, ' ')}</span>
                  <span>{typeof val === 'boolean' ? (val ? 'SIM' : 'OK') : String(val).substring(0, 16)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
