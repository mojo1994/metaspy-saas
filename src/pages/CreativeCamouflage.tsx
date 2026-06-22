import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

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
            <input
              type="text"
              value={textoOriginal}
              onChange={e => setTextoOriginal(e.target.value)}
              placeholder="Ex: Compre agora com 50% de desconto"
            />
          </div>
          <div className="filter-group">
            <label>URL de destino (link da oferta)</label>
            <input
              type="url"
              value={urlDestino}
              onChange={e => setUrlDestino(e.target.value)}
              placeholder="https://exemplo.com/oferta"
            />
          </div>
          <div className="filter-group">
            <label>Palavras sensiveis (separadas por virgula)</label>
            <input
              type="text"
              value={palavrasSensiveis}
              onChange={e => setPalavrasSensiveis(e.target.value)}
              placeholder="comprar, desconto, oferta, gratis"
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Essas palavras serao substituidas por "....." para robos.
            </div>
          </div>
          {erro && <div className="alerta">{erro}</div>}
          <button className="btn btn-gradient" onClick={handleGerar} disabled={carregando || !textoOriginal || !urlDestino}>
            {carregando ? 'Gerando...' : 'Gerar Script de Camuflagem'}
          </button>
          {scriptGerado && (
            <div className="clone-config-section" style={{ marginTop: 8 }}>
              <div className="clone-config-header">Script gerado</div>
              <div className="clone-config-body" style={{ gap: 8 }}>
                <div className="script-box">
                  <pre>{scriptGerado}</pre>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={handleCopiar} style={{ flex: 1 }}>
                    {copiado ? 'Copiado!' : 'Copiar script'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Cole este script dentro da tag <code style={{ background: 'var(--bg-primary)', padding: '1px 5px', borderRadius: 3 }}>{'<head>'}</code> da sua pagina.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── MEDIA CAMOUFLAGE ─── */}
      <div className="clone-config-section">
        <div className="clone-config-header">Camuflagem de Midia</div>
        <div className="clone-config-body" style={{ gap: 12 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            Envie uma imagem ou video e receba uma pagina HTML com protecao contra bots de revisao.
            A pagina exibe o conteudo para humanos e bloqueia/redireciona robos.
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
                  <span style={{ fontSize: 28 }}>{file.type.startsWith('video/') ? '▷' : '◇'}</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {(file.size / 1024 / 1024).toFixed(1)}MB — {file.type.startsWith('video/') ? 'Video' : 'Imagem'}
                    </div>
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
            <input
              type="url"
              value={safeUrl}
              onChange={e => setSafeUrl(e.target.value)}
              placeholder="https://exemplo.com/safe"
            />
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
                  <button className="btn btn-primary" onClick={handleDownload} style={{ flex: 1 }}>
                    Baixar ZIP
                  </button>
                  <button className="btn btn-primary" onClick={handleCopiarEmbed} style={{ flex: 1 }}>
                    {copiadoEmbed ? 'Copiado!' : 'Copiar HTML'}
                  </button>
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
