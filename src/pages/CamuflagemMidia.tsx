import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { IconVideo, IconImage, IconDownload } from '../components/Icons'

export default function CamuflagemMidia() {
  const { fetchWithAuth } = useAuth()

  // Dual-layer
  const [realMedia, setRealMedia] = useState<File | null>(null)
  const [disguiseMedia, setDisguiseMedia] = useState<File | null>(null)
  const [strategy, setStrategy] = useState<'thumbnail_spoofing' | 'click_to_reveal'>('thumbnail_spoofing')
  const [camoSafeUrl, setCamoSafeUrl] = useState('')
  const [camoLoading, setCamoLoading] = useState(false)
  const [camoResult, setCamoResult] = useState<any>(null)
  const [camoError, setCamoError] = useState('')

  // Simple
  const [file, setFile] = useState<File | null>(null)
  const [safeUrl, setSafeUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [uploadErro, setUploadErro] = useState('')
  const [copiadoEmbed, setCopiadoEmbed] = useState(false)

  function handleRealMediaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 200 * 1024 * 1024) { setCamoError('Arquivo muito grande. Maximo: 200MB.'); return }
    setRealMedia(f); setCamoError('')
  }

  function handleDisguiseMediaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 200 * 1024 * 1024) { setCamoError('Arquivo muito grande. Maximo: 200MB.'); return }
    setDisguiseMedia(f); setCamoError('')
  }

  async function handleDualUpload() {
    if (!realMedia || !disguiseMedia) return
    setCamoLoading(true); setCamoError(''); setCamoResult(null)
    try {
      const fd = new FormData()
      fd.append('real_media', realMedia)
      fd.append('disguise_media', disguiseMedia)
      fd.append('strategy', strategy)
      if (camoSafeUrl) fd.append('safe_url', camoSafeUrl)
      const token = localStorage.getItem('metaspy_access_token')
      const res = await fetch('/api/cloaker/camouflage/media', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Falha no processamento')
      setCamoResult(data)
    } catch (err: any) {
      setCamoError(err.message)
    } finally {
      setCamoLoading(false)
    }
  }

  async function handleCamoDownload() {
    if (!camoResult?.downloadUrl) return
    const token = localStorage.getItem('metaspy_access_token')
    const res = await fetch(camoResult.downloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = camoResult.fileName || 'camouflage-output.mp4'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const isVideo = f.type.startsWith('video/')
    const maxSize = isVideo ? 200 * 1024 * 1024 : 30 * 1024 * 1024
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
    if (!allowedTypes.includes(f.type)) {
      setUploadErro('Formato nao suportado.'); setFile(null); return
    }
    if (f.size > maxSize) {
      setUploadErro(`Limite: ${isVideo ? '200MB' : '30MB'}.`); setFile(null); return
    }
    setUploadErro(''); setFile(f)
  }

  async function handleSimpleUpload() {
    if (!file) return
    setUploading(true); setUploadErro(''); setUploadResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (safeUrl) fd.append('safe_url', safeUrl)
      const token = localStorage.getItem('metaspy_access_token')
      const res = await fetch('/api/cloaker/upload-camouflage', {
        method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Falha')
      setUploadResult(data)
    } catch (err: any) { setUploadErro(err.message) }
    finally { setUploading(false) }
  }

  function handleCopiarEmbed() {
    if (!uploadResult?.embedHtml) return
    navigator.clipboard.writeText(uploadResult.embedHtml)
    setCopiadoEmbed(true); setTimeout(() => setCopiadoEmbed(false), 3000)
  }

  async function handleSimpleDownload() {
    if (!uploadResult?.downloadUrl) return
    const token = localStorage.getItem('metaspy_access_token')
    const res = await fetch(uploadResult.downloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = uploadResult.fileName?.replace('.html', '.zip') || 'camuflado.zip'
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h3>Camuflagem de Midia</h3>
        <span className="tool-subtitle">Protege seus criativos contra scanners de IA</span>
      </div>

      {/* ─── DUAL-LAYER ─── */}
      <div className="clone-config-section" style={{ marginBottom: 24 }}>
        <div className="clone-config-header">Camuflagem Avancada (Dual-Layer)</div>
        <div className="clone-config-body" style={{ gap: 12 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            Envie uma midia "Real" (sua oferta) e uma midia "Disfarce" (conteudo seguro). O sistema gera um unico arquivo onde
            o scanner da plataforma ve apenas a midia segura, mas o usuario ve a midia real ao interagir.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="filter-group" style={{ margin: 0 }}>
              <label style={{ color: 'var(--danger)' }}>Midia Real (sua oferta)</label>
              <div className="camouflage-upload-area" style={{ minHeight: 120 }}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover') }}
                onDragLeave={e => e.currentTarget.classList.remove('dragover')}
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); const dt = e.dataTransfer.files; if (dt.length) { const inp = document.getElementById('camo-real-input') as HTMLInputElement; if (inp) { inp.files = dt; handleRealMediaChange({ target: { files: dt } } as any) } } }}
              >
                <input id="camo-real-input" type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,video/quicktime" onChange={handleRealMediaChange} style={{ display: 'none' }} />
                <div className="camouflage-upload-placeholder" onClick={() => document.getElementById('camo-real-input')?.click()}>
                  {realMedia ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span>{realMedia.type.startsWith('video/') ? <IconVideo size={24} /> : <IconImage size={24} />}</span>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{realMedia.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(realMedia.size / 1024 / 1024).toFixed(1)}MB</div>
                      </div>
                      <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={e => { e.stopPropagation(); setRealMedia(null) }}>X</button>
                    </div>
                  ) : (
                    <><span style={{ fontSize: 28, opacity: 0.4 }}>+</span><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Clique ou arraste a midia REAL</span><span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Imagem ou Video — ate 200MB</span></>
                  )}
                </div>
              </div>
            </div>
            <div className="filter-group" style={{ margin: 0 }}>
              <label style={{ color: 'var(--success)' }}>Midia Disfarce (conteudo seguro)</label>
              <div className="camouflage-upload-area" style={{ minHeight: 120 }}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover') }}
                onDragLeave={e => e.currentTarget.classList.remove('dragover')}
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); const dt = e.dataTransfer.files; if (dt.length) { const inp = document.getElementById('camo-disguise-input') as HTMLInputElement; if (inp) { inp.files = dt; handleDisguiseMediaChange({ target: { files: dt } } as any) } } }}
              >
                <input id="camo-disguise-input" type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,video/quicktime" onChange={handleDisguiseMediaChange} style={{ display: 'none' }} />
                <div className="camouflage-upload-placeholder" onClick={() => document.getElementById('camo-disguise-input')?.click()}>
                  {disguiseMedia ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span>{disguiseMedia.type.startsWith('video/') ? <IconVideo size={24} /> : <IconImage size={24} />}</span>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{disguiseMedia.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(disguiseMedia.size / 1024 / 1024).toFixed(1)}MB</div>
                      </div>
                      <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={e => { e.stopPropagation(); setDisguiseMedia(null) }}>X</button>
                    </div>
                  ) : (
                    <><span style={{ fontSize: 28, opacity: 0.4 }}>+</span><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Clique ou arraste a midia DISFARCE</span><span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Imagem ou Video — ate 200MB</span></>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="filter-group">
            <label>Estrategia</label>
            <select value={strategy} onChange={e => setStrategy(e.target.value as any)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
              <option value="thumbnail_spoofing">Thumbnail Spoofing (Video) — Plataforma ve o thumbnail seguro</option>
              <option value="click_to_reveal">Click-to-Reveal (Interativo) — Conteudo real apos clique</option>
            </select>
          </div>

          <div className="filter-group">
            <label>URL segura para bots (opcional)</label>
            <input type="url" value={camoSafeUrl} onChange={e => setCamoSafeUrl(e.target.value)} placeholder="https://exemplo.com/pagina-segura" />
          </div>

          {camoError && <div className="alerta">{camoError}</div>}

          <button className="btn btn-gradient" onClick={handleDualUpload} disabled={camoLoading || !realMedia || !disguiseMedia}>
            {camoLoading ? 'Processando...' : 'Gerar Midia Camuflada'}
          </button>

          {camoResult && (
            <div className="clone-config-section" style={{ marginTop: 8 }}>
              <div className="clone-config-header">Download e Instrucoes</div>
              <div className="clone-config-body" style={{ gap: 8 }}>
                <button className="btn btn-primary" onClick={handleCamoDownload} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconDownload size={18} /> Baixar {strategy === 'thumbnail_spoofing' ? 'Video MP4' : 'ZIP'}
                </button>
                <div style={{ padding: 12, background: 'var(--bg-primary)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {camoResult.instructions}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── SIMPLE ─── */}
      <div className="clone-config-section">
        <div className="clone-config-header">Camuflagem Simples</div>
        <div className="clone-config-body" style={{ gap: 12 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            Envie uma imagem ou video e receba uma pagina HTML com protecao basica contra bots.
          </p>

          <div className="camouflage-upload-area"
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover') }}
            onDragLeave={e => e.currentTarget.classList.remove('dragover')}
            onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); const dt = e.dataTransfer.files; if (dt.length) { const inp = document.getElementById('camo-simple-input') as HTMLInputElement; if (inp) { inp.files = dt; handleFileChange({ target: { files: dt } } as any) } } }}
          >
            <input id="camo-simple-input" type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,video/quicktime" onChange={handleFileChange} style={{ display: 'none' }} />
            <div className="camouflage-upload-placeholder" onClick={() => document.getElementById('camo-simple-input')?.click()}>
              {file ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{file.type.startsWith('video/') ? <IconVideo size={28} /> : <IconImage size={28} />}</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(1)}MB</div>
                  </div>
                  <button className="btn btn-secondary" onClick={e => { e.stopPropagation(); setFile(null); setUploadResult(null) }}>Remover</button>
                </div>
              ) : (
                <><span style={{ fontSize: 32, opacity: 0.4 }}>+</span><span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Clique ou arraste arquivo aqui</span><span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Imagem ate 30MB — Video ate 200MB</span></>
              )}
            </div>
          </div>

          <div className="filter-group">
            <label>URL segura (opcional — redirecionamento de robos)</label>
            <input type="url" value={safeUrl} onChange={e => setSafeUrl(e.target.value)} placeholder="https://exemplo.com/safe" />
          </div>

          {uploadErro && <div className="alerta">{uploadErro}</div>}

          <button className="btn btn-gradient" onClick={handleSimpleUpload} disabled={uploading || !file}>
            {uploading ? 'Processando...' : 'Enviar e Camuflar'}
          </button>

          {uploadResult && (
            <div className="clone-config-section" style={{ marginTop: 8 }}>
              <div className="clone-config-header">Resultado</div>
              <div className="clone-config-body" style={{ gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={handleSimpleDownload} style={{ flex: 1 }}>Baixar ZIP</button>
                  <button className="btn btn-primary" onClick={handleCopiarEmbed} style={{ flex: 1 }}>{copiadoEmbed ? 'Copiado!' : 'Copiar HTML'}</button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Extraia o ZIP e abra o index.html. A pagina protege o conteudo contra bots.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}