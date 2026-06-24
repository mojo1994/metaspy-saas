import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { IconRocket } from '../components/Icons'

function getFilesFromEntry(entry: FileSystemEntry, path = ''): Promise<{ file: File; path: string }[]> {
  return new Promise(resolve => {
    if (entry.isFile) {
      ;(entry as FileSystemFileEntry).file(file => {
        const name = file.name
        resolve(path ? [{ file, path: path + '/' + name }] : [{ file, path: name }])
      })
    } else if (entry.isDirectory) {
      const dirReader = (entry as FileSystemDirectoryEntry).createReader()
      const all: FileSystemEntry[] = []
      const readBatch = () => {
        dirReader.readEntries(entries => {
          if (entries.length === 0) {
            Promise.all(all.map(e => getFilesFromEntry(e, path ? path + '/' + entry.name : entry.name)))
              .then(results => resolve(results.flat()))
          } else {
            all.push(...entries)
            readBatch()
          }
        })
      }
      readBatch()
    } else {
      resolve([])
    }
  })
}

export default function HostPage() {
  const { fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const dropRef = useRef<HTMLDivElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ slug: string; url: string; title: string } | null>(null)
  const [erro, setErro] = useState('')
  const [progress, setProgress] = useState('')
  const [pageSlug, setPageSlug] = useState('')

  function slugify(text: string) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .slice(0, 60)
  }

  useEffect(() => {
    const el = dropRef.current
    if (!el) return
    const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragging(true) }
    const onDragLeave = () => setDragging(false)
    const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      setErro('')
      const items = e.dataTransfer?.items
      if (!items || items.length === 0) return

      const entries: FileSystemEntry[] = []
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry()
        if (entry) entries.push(entry)
      }

      const hasDir = entries.some(e => e.isDirectory)
      if (hasDir) {
        const all = await Promise.all(entries.map(e => getFilesFromEntry(e)))
        const flat = all.flat()
        if (flat.length === 0) { setErro('Nenhum arquivo encontrado na pasta.'); return }
        if (!flat.some(f => f.path === 'index.html')) { setErro('A pasta deve conter um arquivo index.html na raiz.'); return }
        uploadFolder(flat)
      } else {
        const file = items[0].getAsFile()
        if (!file) return
        if (!file.name.endsWith('.zip')) { setErro('Apenas arquivos .zip sao aceitos.'); return }
        if (file.size > 200 * 1024 * 1024) { setErro('Arquivo muito grande. Maximo: 200MB.'); return }
        uploadZip(file)
      }
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

  function handleZipSelect(files: FileList) {
    const file = files[0]
    if (!file) return
    if (!file.name.endsWith('.zip')) { setErro('Apenas arquivos .zip sao aceitos.'); return }
    if (file.size > 200 * 1024 * 1024) { setErro('Arquivo muito grande. Maximo: 200MB.'); return }
    setErro('')
    uploadZip(file)
  }

  function handleFolderSelect(files: FileList) {
    if (!files || files.length === 0) return
    const entries: { file: File; path: string }[] = []
    let rootName = ''
    for (const f of files) {
      rootName = f.webkitRelativePath.split('/')[0]
      break
    }
    for (const f of files) {
      const parts = f.webkitRelativePath.split('/')
      parts.shift()
      entries.push({ file: f, path: parts.join('/') })
    }
    if (!entries.some(e => e.path === 'index.html')) { setErro('A pasta deve conter um arquivo index.html na raiz.'); return }
    uploadFolder(entries)
  }

  async function uploadZip(file: File) {
    setUploading(true)
    setResult(null)
    setProgress('Enviando arquivo...')
    const form = new FormData()
    form.append('files', file)
    form.append('title', file.name.replace(/\.zip$/i, ''))
    if (pageSlug.trim()) form.append('slug', slugify(pageSlug))
    try {
      const res = await fetchWithAuth('/api/pages/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro no upload.'); setUploading(false); return }
      setResult(data)
    } catch { setErro('Erro de conexao com o servidor.') }
    setUploading(false)
  }

  async function uploadFolder(files: { file: File; path: string }[]) {
    setUploading(true)
    setResult(null)
    setProgress('Enviando pasta...')
    const form = new FormData()
    for (const { file, path } of files) {
      form.append('files', file, path)
    }
    const title = pageSlug.trim() || files.find(f => f.path === 'index.html')?.file.name?.replace('/index.html', '') || 'Pagina hospedada'
    form.append('title', title)
    if (pageSlug.trim()) form.append('slug', slugify(pageSlug))
    try {
      const res = await fetchWithAuth('/api/pages/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro no upload.'); setUploading(false); return }
      setResult(data)
    } catch { setErro('Erro de conexao com o servidor.') }
    setUploading(false)
  }

  function copyUrl() {
    if (result) navigator.clipboard.writeText(result.url)
  }

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h3>Hospedar Pagina</h3>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/hospedar')} style={{ fontSize: 13 }}>
          Minhas Paginas
        </button>
      </div>

      {erro && <div className="auth-error">{erro}</div>}

      {!result ? (
        <>
          <div style={{
            marginTop: 16,
            marginBottom: 16,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 16px',
          }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Nome da pagina (personalize a URL)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-muted)' }}>
              <span>seusite.com/p/</span>
              <input
                type="text"
                value={pageSlug}
                onChange={e => setPageSlug(slugify(e.target.value))}
                placeholder="minha-pagina"
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontFamily: 'monospace',
                  minWidth: 120,
                }}
              />
            </div>
          </div>

          <div
          ref={dropRef}
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
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            {uploading ? progress : dragging ? 'Solte a pasta aqui' : 'Arraste sua pasta ou arquivo .zip'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Deve conter um <strong>index.html</strong> e seus assets (CSS, JS, imagens)
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Maximo: 200MB</p>

          <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click() }} style={{ fontSize: 12 }}>
              Selecionar Pasta
            </button>
            <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); zipInputRef.current?.click() }} style={{ fontSize: 12 }}>
              Selecionar .zip
            </button>
          </div>

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
            ref={zipInputRef}
            type="file"
            accept=".zip"
            style={{ display: 'none' }}
            onChange={e => e.target.files?.length && handleZipSelect(e.target.files)}
          />
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore
            webkitdirectory=""
            multiple
            style={{ display: 'none' }}
            onChange={e => e.target.files?.length && handleFolderSelect(e.target.files)}
          />
        </div>
        </>
      ) : (
        <div style={{
          marginTop: 20,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 32,
          textAlign: 'center',
        }}>
          <div style={{ marginBottom: 12 }}>
            <IconRocket size={48} />
          </div>
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
          <li>Arraste a pasta aqui, clique em <strong style={{ color: 'var(--text-primary)' }}>Selecionar Pasta</strong> ou envie um <strong style={{ color: 'var(--text-primary)' }}>.zip</strong></li>
        </ol>
      </div>
    </div>
  )
}
