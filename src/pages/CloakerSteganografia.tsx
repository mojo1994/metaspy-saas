import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { IconLocked } from '../components/Icons'

export default function CloakerSteganografia() {
  const { user, fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'embed' | 'extract'>('embed')
  const [message, setMessage] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [result, setResult] = useState<{ downloadUrl?: string; extracted?: string; error?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleProcess() {
    if (!image) return
    setLoading(true); setResult(null)
    const form = new FormData()
    form.append('image', image)
    if (mode === 'embed') form.append('message', message)
    try {
      const token = localStorage.getItem('metaspy_access_token')
      const res = await fetch(`/api/cloaker/steg/${mode}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      const data = await res.json()
      if (!res.ok) setResult({ error: data.erro || 'Erro' })
      else if (mode === 'embed') setResult({ downloadUrl: data.downloadUrl })
      else setResult({ extracted: data.data })
    } catch { setResult({ error: 'Erro de conexao' }) }
    setLoading(false)
  }

  if (user?.plano !== 'premium') {
    return <div className="tool-locked"><div className="tool-locked-icon"><IconLocked size={24} /></div><h3>Esteganografia</h3><p>Apenas no plano Premium.</p><button className="btn btn-primary" onClick={() => navigate('/planos')}>Ver Planos</button></div>
  }

  return (
    <div>
      <div className="tool-header">
        <h3>Esteganografia — Ocultar Dados em Imagens</h3>
        <span className={`status ${result ? 'on' : 'off'}`}>{result ? 'Processado' : 'Aguardando'}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Incorpore dados ocultos no canal Alpha de imagens PNG com criptografia AES-256-CBC e
        verificacao HMAC. A imagem resultante parece identica visualmente mas contem seu payload.
      </div>

      <div className="clone-config-section">
        <div className="clone-config-header">
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn ${mode === 'embed' ? 'btn-accent' : 'btn-secondary'}`} onClick={() => { setMode('embed'); setResult(null) }}>Incorporar</button>
            <button className={`btn ${mode === 'extract' ? 'btn-accent' : 'btn-secondary'}`} onClick={() => { setMode('extract'); setResult(null) }}>Extrair</button>
          </div>
        </div>
        <div className="clone-config-body" style={{ gap: 12 }}>
          <div className="filter-group">
            <label>Imagem PNG</label>
            <input type="file" ref={fileRef} accept="image/png,image/webp" onChange={e => setImage(e.target.files?.[0] || null)} />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Recomendado: PNG de alta resolucao (1920x1080+) para maior capacidade.</div>
          </div>
          {mode === 'embed' && (
            <div className="filter-group">
              <label>Mensagem ou dados para ocultar</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Digite a mensagem secreta..." rows={4} style={{ width: '100%', padding: 8, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical' }} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Limite: ~2MB para imagem 1920x1080 (canal Alpha).</div>
            </div>
          )}
          <button className="btn btn-gradient" onClick={handleProcess} disabled={loading || !image}>
            {loading ? 'Processando...' : mode === 'embed' ? 'Incorporar Dados' : 'Extrair Dados'}
          </button>

          {result?.error && <div className="alerta">{result.error}</div>}

          {result?.downloadUrl && (
            <div style={{ padding: 12, background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 13, color: 'var(--success)', marginBottom: 8 }}>✓ Dados incorporados com sucesso!</div>
              <a href={result.downloadUrl} className="btn btn-primary" download style={{ textDecoration: 'none', display: 'inline-block' }}>Baixar Imagem com Dados Ocultos</a>
            </div>
          )}

          {result?.extracted && (
            <div className="clone-config-section">
              <div className="clone-config-header">Dados Extraidos</div>
              <div className="clone-config-body">
                <div style={{ maxHeight: 200, overflow: 'auto', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {result.extracted}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
