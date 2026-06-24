import { useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { IconVideo, IconImage } from '../components/Icons'

export default function MetadataCleaner() {
  const { fetchWithAuth } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isVideo = (mime: string) => mime.startsWith('video/')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    const maxSize = isVideo(selected.type) ? 200 * 1024 * 1024 : 30 * 1024 * 1024
    if (selected.size > maxSize) {
      setErrorMsg(`Arquivo muito grande. Max: ${maxSize / (1024 * 1024)} MB.`)
      setFile(null)
      return
    }
    setErrorMsg('')
    setFile(selected)
    setStatus('idle')
    setResult(null)
  }

  function handleUpload() {
    if (!file) return
    setStatus('uploading')
    setUploadProgress(0)

    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/cleaner/upload', true)
    const token = localStorage.getItem('metaspy_access_token')
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setResult(JSON.parse(xhr.responseText))
        setStatus('done')
        setUploadProgress(100)
      } else {
        try {
          const err = JSON.parse(xhr.responseText)
          setErrorMsg(err.error || 'Falha no upload.')
        } catch { setErrorMsg(`Upload falhou: ${xhr.status}`) }
        setStatus('error')
      }
    }

    xhr.onerror = () => {
      setErrorMsg('Erro de rede durante o upload.')
      setStatus('error')
    }

    xhr.send(formData)
  }

  async function handleDownload(url: string, filename: string) {
    const response = await fetchWithAuth(url)
    if (!response.ok) return
    const blob = await response.blob()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  function handleReset() {
    setFile(null)
    setResult(null)
    setStatus('idle')
    setUploadProgress(0)
    setErrorMsg('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h3>Remover Metadados</h3>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 13 }}>
        Remova metadados ocultos de imagens e videos: GPS, dados de camera, software de edicao,
        timestamps e tags de rastreamento.
      </p>

      <div className="cleaner-upload-area" style={{ maxWidth: 600 }}>
        <div
          className="cleaner-dropzone"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const dropped = e.dataTransfer.files[0]
            if (dropped) {
              const event = { target: { files: [dropped] } } as unknown as React.ChangeEvent<HTMLInputElement>
              handleFileChange(event)
            }
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/x-msvideo,video/webm"
            disabled={status === 'uploading' || status === 'processing'}
            style={{ display: 'none' }}
          />
          {!file ? (
            <div className="cleaner-dropzone-placeholder" onClick={() => fileInputRef.current?.click()}>
              <span style={{ fontSize: 32, opacity: 0.3 }}>+</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Arraste ou clique para selecionar</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>JPEG, PNG, WebP, GIF — MP4, MOV, AVI, WebM</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Imagem ate 30MB / Video ate 200MB</span>
            </div>
          ) : (
            <div className="cleaner-file-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{isVideo(file.type) ? <IconVideo size={24} /> : <IconImage size={24} />}</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {(file.size / (1024 * 1024)).toFixed(1)}MB — {isVideo(file.type) ? 'Video' : 'Imagem'}
                  </div>
                </div>
                <button className="btn btn-secondary" onClick={handleReset} disabled={status === 'uploading'}>
                  Remover
                </button>
              </div>
              {status === 'idle' && (
                <button className="btn btn-gradient" onClick={handleUpload} style={{ width: '100%', marginTop: 12 }}>
                  Limpar Metadados
                </button>
              )}
            </div>
          )}
        </div>

        {status === 'uploading' && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              <span>Enviando...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="cleaner-progress-bar">
              <div className="cleaner-progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {status === 'processing' && (
          <div style={{ marginTop: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Processando arquivo...
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="alerta" style={{ maxWidth: 600 }}>{errorMsg}</div>
      )}

      {status === 'done' && result && (
        <div className="cleaner-result" style={{ maxWidth: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="badge ativo">ok</span>
            <span style={{ fontWeight: 600 }}>Metadados removidos com sucesso</span>
          </div>
          <div className="cleaner-result-stats">
            <div className="cleaner-stat">
              <span className="cleaner-stat-label">Arquivo original</span>
              <span className="cleaner-stat-value">{result.originalName}</span>
            </div>
            <div className="cleaner-stat">
              <span className="cleaner-stat-label">Tamanho limpo</span>
              <span className="cleaner-stat-value">{(result.cleanedSize / 1024).toFixed(0)} KB</span>
            </div>
            <div className="cleaner-stat">
              <span className="cleaner-stat-label">Tags removidas</span>
              <span className="cleaner-stat-value">{result.metadataRemoved}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              className="btn btn-gradient"
              onClick={() => {
                const cleanName = result.originalName.replace(/\.[^.]+$/, '') + '_clean' + result.originalName.substring(result.originalName.lastIndexOf('.'))
                handleDownload(result.downloadUrl, cleanName)
              }}
              style={{ flex: 1 }}
            >
              Baixar Arquivo Limpo
            </button>
            <button className="btn btn-primary" onClick={handleReset}>
              Novo Arquivo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
