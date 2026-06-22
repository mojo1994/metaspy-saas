import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function HostPage() {
  const { fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const dropRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ slug: string; url: string; title: string } | null>(null)
  const [erro, setErro] = useState('')
  const [progress, setProgress] = useState('')

  useEffect(() => {
    const el = dropRef.current
    if (!el) return
    const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragging(true) }
    const onDragLeave = () => setDragging(false)
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const files = e.dataTransfer?.files
      if (files?.length) handleFiles(files)
    }
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
    }
  }, [])

  function handleFiles(files: FileList) {
    const file = files[0]
    if (!file) return
    if (!file.name.endsWith('.zip')) { setErro('Apenas arquivos .zip sao aceitos.'); return }
    if (file.size > 200 * 1024 * 1024) { setErro('Arquivo muito grande. Maximo: 200MB.'); return }
    setErro('')
    uploadFile(file)
  }

  async function uploadFile(file: File) {
    setUploading(true)
    setResult(null)
    setProgress('Enviando arquivo...')
    const form = new FormData()
    form.append('file', file)
    form.append('title', file.name.replace(/\.zip$/i, ''))

    try {
      const res = await fetchWithAuth('/api/pages/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro no upload.'); setUploading(false); return }
      setResult(data)
      setProgress('')
    } catch {
      setErro('Erro de conexao com o servidor.')
    }
    setUploading(false)
  }

  function copyUrl() {
    if (result) navigator.clipboard.writeText(result.url)
  }

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h3>Hospedar Pagina</h3>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/paginas')} style={{ fontSize: 13 }}>
          Minhas Paginas
        </button>
      </div>

      {erro && <div className="auth-error">{erro}</div>}

      {!result ? (
        <div
          ref={dropRef}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--purple-400)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            padding: 60,
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'rgba(168,85,247,0.06)' : 'transparent',
            transition: 'all 0.2s',
            marginTop: 20,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.6 }}>📦</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            {uploading ? progress : dragging ? 'Solte o arquivo aqui' : 'Arraste seu ZIP ou clique para selecionar'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            A pasta deve conter um <strong>index.html</strong> e seus assets (CSS, JS, imagens)
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Maximo: 200MB</p>

          {uploading && (
            <div style={{
              margin: '20px auto 0',
              width: 200,
              height: 4,
              borderRadius: 2,
              background: 'var(--border)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: '40%',
                height: '100%',
                background: 'linear-gradient(90deg, var(--purple-400), var(--purple-600))',
                borderRadius: 2,
                animation: 'shimmer 1.2s ease-in-out infinite',
              }} />
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".zip"
            style={{ display: 'none' }}
            onChange={e => e.target.files?.length && handleFiles(e.target.files)}
          />
        </div>
      ) : (
        <div style={{
          marginTop: 20,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 32,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
          <h3 style={{ marginBottom: 6 }}>Pagina hospedada com sucesso!</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{result.title}</p>

          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 16px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            fontFamily: 'monospace',
            color: 'var(--purple-400)',
            marginBottom: 20,
          }}>
            <span style={{ color: 'var(--text-primary)' }}>{result.url}</span>
            <button className="btn btn-accent" onClick={copyUrl} style={{ fontSize: 11, padding: '4px 10px' }}>
              Copiar
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-gradient" onClick={() => window.open(result.url, '_blank')}>
              Abrir Pagina
            </button>
            <button className="btn btn-secondary" onClick={() => setResult(null)}>
              Hospedar Outra
            </button>
          </div>
        </div>
      )}

      <div style={{
        marginTop: 32,
        background: 'rgba(168,85,247,0.06)',
        border: '1px solid rgba(168,85,247,0.15)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
      }}>
        <h4 style={{ fontSize: 14, marginBottom: 8, color: 'var(--purple-400)' }}>Como preparar sua pagina</h4>
        <ol style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 2, paddingLeft: 20 }}>
          <li>Crie sua pagina de vendas ou quiz em qualquer ferramenta</li>
          <li>Exporte os arquivos (HTML, CSS, JS, imagens) em uma pasta</li>
          <li>Certifique-se de que o arquivo principal se chama <strong style={{ color: 'var(--text-primary)' }}>index.html</strong></li>
          <li>Compacte a pasta em um arquivo <strong style={{ color: 'var(--text-primary)' }}>.zip</strong></li>
          <li>Arraste o ZIP aqui ou clique para fazer upload</li>
        </ol>
      </div>
    </div>
  )
}
