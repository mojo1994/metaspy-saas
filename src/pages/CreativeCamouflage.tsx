import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { IconVideo, IconImage, IconDownload, IconCheck } from '../components/Icons'

export default function CreativeCamouflage() {
  const { fetchWithAuth } = useAuth()
  const [textoOriginal, setTextoOriginal] = useState('')
  const [urlDestino, setUrlDestino] = useState('')
  const [palavrasSensiveis, setPalavrasSensiveis] = useState('')
  const [scriptGerado, setScriptGerado] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [safeUrl, setSafeUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [uploadErro, setUploadErro] = useState('')
  const [copiadoEmbed, setCopiadoEmbed] = useState(false)

  // Dual-layer
  const [realMedia, setRealMedia] = useState<File | null>(null)
  const [disguiseMedia, setDisguiseMedia] = useState<File | null>(null)
  const [strategy, setStrategy] = useState<'thumbnail_spoofing' | 'click_to_reveal'>('thumbnail_spoofing')
  const [camoSafeUrl, setCamoSafeUrl] = useState('')
  const [camoLoading, setCamoLoading] = useState(false)
  const [camoResult, setCamoResult] = useState<any>(null)
  const [camoError, setCamoError] = useState('')

  async function handleGerar() {
    if (!textoOriginal || !urlDestino) return
    setCarregando(true)
    setErro('')
    try {
      const res = await fetchWithAuth('/api/cloaker/camouflage', {
        method: 'POST',
        body: JSON.stringify({
          texto_original: textoOriginal,
          url_destino: urlDestino,
          palavras_sensiveis: palavrasSensiveis.split(',').map((p: string) => p.trim()).filter(Boolean)
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Falha ao gerar')
      setScriptGerado(data.script)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  function handleCopiar() {
    navigator.clipboard.writeText(scriptGerado)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 3000)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const isVideo = f.type.startsWith('video/')
    const maxSize = isVideo ? 200 * 1024 * 1024 : 30 * 1024 * 1024
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
    if (!allowedTypes.includes(f.type)) {
      setUploadErro('Formato nao suportado. Aceitamos: JPG, PNG, GIF, WebP, MP4, WebM, OGG, MOV.')
      setFile(null)
      return
    }
    if (f.size > maxSize) {
      setUploadErro(`Arquivo muito grande. Limite: ${isVideo ? '200MB para video' : '30MB para imagem'}.`)
      setFile(null)
      return
    }
    setUploadErro('')
    setFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setUploadErro('')
    setUploadResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (safeUrl) formData.append('safe_url', safeUrl)
      const token = localStorage.getItem('metaspy_access_token')
      const res = await fetch('/api/cloaker/upload-camouflage', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Falha no upload')
      setUploadResult(data)
    } catch (err: any) {
      setUploadErro(err.message)
    } finally {
      setUploading(false)
    }
  }

  function handleCopiarEmbed() {
    if (!uploadResult?.embedHtml) return
    navigator.clipboard.writeText(uploadResult.embedHtml)
    setCopiadoEmbed(true)
    setTimeout(() => setCopiadoEmbed(false), 3000)
  }

  async function handleDownload() {
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
    a.click()
    URL.revokeObjectURL(url)
  }

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

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h3>Camuflagem de Criativos</h3>
      </div>

      {/* ─── TEXT CAMOUFLAGE ─── */}
      <div className="clone-config-section" style={{ marginBottom: 24 }}>
        <div className="clone-config-header">Camuflagem de Texto</div>
        <div className="clone-config-body" style={{ gap: 12 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            Gere um script que oculta textos e links sensiveis dos robos de revisao, mantendo-os visiveis para humanos.
          </p>
          <div className="filter-group">
            <label>Texto original (o que sera exibido para humanos)</label>
            <input type="text" value={textoOriginal} onChange={e => setTextoOriginal(e.target.value)} placeholder="Ex: Compre agora com 50% de desconto" />
          </div>
          <div className="filter-group">
            <label>URL de destino (link da oferta)</label>
            <input type="url" value={urlDestino} onChange={e => setUrlDestino(e.target.value)} placeholder="https://exemplo.com/oferta" />
          </div>
          <div className="filter-group">
            <label>Palavras sensiveis (separadas por virgula)</label>
            <input type="text" value={palavrasSensiveis} onChange={e => setPalavrasSensiveis(e.target.value)} placeholder="comprar, desconto, oferta, gratis" />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Essas palavras serao substituidas por "....." para robos.</div>
          </div>
          {erro && <div className="alerta">{erro}</div>}
          <button className="btn btn-gradient" onClick={handleGerar} disabled={carregando || !textoOriginal || !urlDestino}>
            {carregando ? 'Gerando...' : 'Gerar Script de Camuflagem'}
          </button>
          {scriptGerado && (
            <div className="clone-config-section" style={{ marginTop: 8 }}>
              <div className="clone-config-header">Script gerado</div>
              <div className="clone-config-body" style={{ gap: 8 }}>
                <div className="script-box"><pre>{scriptGerado}</pre></div>
                <button className="btn btn-primary" onClick={handleCopiar}>{copiado ? 'Copiado!' : 'Copiar script'}</button>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Cole este script dentro da tag <code style={{ background: 'var(--bg-primary)', padding: '1px 5px', borderRadius: 3 }}>{'<head>'}</code> da sua pagina.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── DUAL-LAYER MEDIA CAMOUFLAGE ─── */}
      <div className="clone-config-section" style={{ marginBottom: 24 }}>
        <div className="clone-config-header">Camuflagem Avancada de Midia (Dual-Layer)</div>
        <div className="clone-config-body" style={{ gap: 12 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            Envie uma midia "Real" (sua oferta) e uma midia "Disfarcce" (conteudo seguro). O sistema gera um unico arquivo onde
            o scanner da plataforma ve apenas a midia segura, mas o usuario ve a midia real ao interagir.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Real Media */}
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
                    <>
                      <span style={{ fontSize: 28, opacity: 0.4 }}>+</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Clique ou arraste a midia REAL</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Imagem ou Video — ate 200MB</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Disguise Media */}
            <div className="filter-group" style={{ margin: 0 }}>
              <label style={{ color: 'var(--success)' }}>Midia Disfarcce (conteudo seguro)</label>
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
                    <>
                      <span style={{ fontSize: 28, opacity: 0.4 }}>+</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Clique ou arraste a midia DISFARCE</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Imagem ou Video — ate 200MB</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="filter-group">
            <label>Estrategia de Camuflagem</label>
            <select value={strategy} onChange={e => setStrategy(e.target.value as any)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
              <option value="thumbnail_spoofing">Thumbnail Spoofing (Video) — A plataforma ve o thumbnail seguro</option>
              <option value="click_to_reveal">Click-to-Reveal (Interativo) — Conteudo real aparece apos clique</option>
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
            <>
              {/* Preview Split Screen */}
              <div className="clone-config-section" style={{ marginTop: 8 }}>
                <div className="clone-config-header">Pre-visualizacao</div>
                <div className="clone-config-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Midia Disfarcce (vista pelo scanner)</div>
                      <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: 12, minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {disguiseMedia?.type.startsWith('video/')
                          ? <video src={URL.createObjectURL(disguiseMedia)} style={{ maxWidth: '100%', maxHeight: 140, borderRadius: 4 }} controls />
                          : <img src={realMedia ? URL.createObjectURL(disguiseMedia!) : ''} alt="disguise" style={{ maxWidth: '100%', maxHeight: 140, borderRadius: 4 }} />}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Output Camuflado</div>
                      <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: 12, minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {strategy === 'thumbnail_spoofing' ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                            <IconVideo size={32} /><br />
                            Video .mp4 gerado
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                            <IconImage size={32} /><br />
                            ZIP + index.html
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Download + Instructions */}
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
            </>
          )}
        </div>
      </div>

      {/* ─── OLD MEDIA CAMOUFLAGE ─── */}
      <div className="clone-config-section">
        <div className="clone-config-header">Camuflagem Simples de Midia</div>
        <div className="clone-config-body" style={{ gap: 12 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            Envie uma imagem ou video e receba uma pagina HTML com protecao contra bots de revisao.
          </p>

          <div className="camouflage-upload-area"
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover') }}
            onDragLeave={e => e.currentTarget.classList.remove('dragover')}
            onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); const dt = e.dataTransfer.files; if (dt.length) { const input = document.getElementById('camo-file-input') as HTMLInputElement; if (input) { input.files = dt; handleFileChange({ target: { files: dt } } as any) } } }}
          >
            <input id="camo-file-input" type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,video/quicktime" onChange={handleFileChange} style={{ display: 'none' }} />
            <div className="camouflage-upload-placeholder" onClick={() => document.getElementById('camo-file-input')?.click()}>
              {file ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{file.type.startsWith('video/') ? <IconVideo size={28} /> : <IconImage size={28} />}</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(1)}MB — {file.type.startsWith('video/') ? 'Video' : 'Imagem'}</div>
                  </div>
                  <button className="btn btn-secondary" onClick={e => { e.stopPropagation(); setFile(null); setUploadResult(null) }}>Remover</button>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: 32, opacity: 0.4 }}>+</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Clique ou arraste arquivo aqui</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Imagem ate 30MB — Video ate 200MB</span>
                </>
              )}
            </div>
          </div>

          <div className="filter-group">
            <label>URL segura (opcional — para onde robos serao redirecionados)</label>
            <input type="url" value={safeUrl} onChange={e => setSafeUrl(e.target.value)} placeholder="https://exemplo.com/safe" />
          </div>

          {uploadErro && <div className="alerta">{uploadErro}</div>}

          <button className="btn btn-gradient" onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? 'Processando...' : 'Enviar e Camuflar'}
          </button>

          {uploadResult && (
            <div className="clone-config-section" style={{ marginTop: 8 }}>
              <div className="clone-config-header">Resultado</div>
              <div className="clone-config-body" style={{ gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={handleDownload} style={{ flex: 1 }}>Baixar ZIP</button>
                  <button className="btn btn-primary" onClick={handleCopiarEmbed} style={{ flex: 1 }}>{copiadoEmbed ? 'Copiado!' : 'Copiar HTML'}</button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  O ZIP contem o arquivo de midia + pagina HTML com protecao contra bots.
                  Extraia ambos na mesma pasta e abra o HTML.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}