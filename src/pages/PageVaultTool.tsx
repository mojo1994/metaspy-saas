import { useState, useCallback } from 'react'
import type { CloneJob } from '../types'
import HelpTooltip from '../components/HelpTooltip'
import PageEditor from '../components/PageEditor'
import { IconCheck, IconArrowDown, IconTarget, IconChevronDown, IconChevronRight } from '../components/Icons'
import { useAuth } from '../contexts/AuthContext'

declare global {
  interface Window {
    showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
  }
}

const STEPS = ['HTML', 'Recursos', 'Render', 'Salvar']

export default function PageVaultTool() {
  const { fetchWithAuth } = useAuth()
  const [mode, setMode] = useState<'clone' | 'editor'>('clone')
  const [cloneHtml, setCloneHtml] = useState('')
  const [cloneUrl, setCloneUrl] = useState('')
  const [jobs, setJobs] = useState<CloneJob[]>(() => {
    try { return JSON.parse(localStorage.getItem('pagevault_jobs') || '[]') } catch { return [] }
  })
  const [running, setRunning] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const [showLog, setShowLog] = useState(false)
  const [includeExternal, setIncludeExternal] = useState(false)
  const [respectRobots, setRespectRobots] = useState(true)
  const [flat, setFlat] = useState(false)
  const [rescueMode, setRescueMode] = useState(false)
  const [concurrency, setConcurrency] = useState(8)
  const [timeout, setTimeout_] = useState(15)
  const [renderWait, setRenderWait] = useState(8)

  function addLog(msg: string) {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`])
  }

  function saveJobs(updated: CloneJob[]) {
    setJobs(updated)
    localStorage.setItem('pagevault_jobs', JSON.stringify(updated))
  }

  function validUrl(url: string) {
    try {
      const u = new URL(url)
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch { return false }
  }

  async function salvarHtml(dir: FileSystemDirectoryHandle, nome: string, html: string) {
    const fileHandle = await dir.getFileHandle(nome, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(html)
    await writable.close()
  }

  async function startClone() {
    setError('')
    const urlTrimmed = url.trim()
    if (!urlTrimmed || !validUrl(urlTrimmed)) { setError('Informe uma URL http/https valida.'); return }

    setRunning(true)
    setProgress(0)
    setLog([])
    setShowLog(true)

    const slug = urlTrimmed.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
    let dirHandle: FileSystemDirectoryHandle | null = null
    let savedDir = ''
    let fallbackDownload = false

    addLog('Abrindo seletor de pasta do Windows...')

    try {
      if (typeof window.showDirectoryPicker === 'function') {
        dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
        savedDir = `${dirHandle.name}\\${slug}`
        addLog(`Pasta selecionada: ${dirHandle.name}`)
      } else {
        fallbackDownload = true
        addLog('Navegador nao suporta seletor de pastas. Usando download.')
      }
    } catch (e) {
      addLog('Selecao de pasta cancelada pelo usuario.')
      setRunning(false)
      return
    }

    const job: CloneJob = {
      id: `clone-${Date.now()}`,
      url: urlTrimmed,
      status: 'running',
      progress: 0,
      createdAt: new Date().toISOString(),
      options: { includeExternal, respectRobots, flat, rescueMode, concurrency, timeout, renderWait }
    }

    saveJobs([job, ...jobs])
    addLog(`Clonando: ${urlTrimmed}`)
    addLog(`Opcoes: concorrencia=${concurrency}, timeout=${timeout}s, render_wait=${renderWait}s`)
    if (rescueMode) addLog('Modo Resgate ativado: recursos externos forcados.')

    setProgress(30)
    addLog('Buscando pagina original...')

    let htmlContent = ''
    try {
      addLog(`URL: /api/page-fetch?url=${encodeURIComponent(urlTrimmed)}`)
      const resp = await fetchWithAuth(`/api/page-fetch?url=${encodeURIComponent(urlTrimmed)}`)
      if (!resp.ok) {
        let errorMsg = `HTTP ${resp.status}`
        try { const errBody = await resp.json(); errorMsg = errBody.error || errBody.message || errorMsg } catch {}
        throw new Error(errorMsg)
      }
      htmlContent = await resp.text()
      addLog(`Pagina baixada (${htmlContent.length} bytes)`)
    } catch (e) {
      const msg = (e as Error)?.message || 'desconhecido'
      addLog(`Erro ao buscar pagina: ${msg}`)
      addLog('Usando conteudo minimo como fallback.')
      htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${slug}</title></head><body><p>Falha ao baixar ${urlTrimmed}</p><p>Erro: ${msg}</p></body></html>`
    }

    setProgress(60)
    addLog('Salvando arquivos...')

    try {
      if (dirHandle) {
        await salvarHtml(dirHandle, `${slug}.html`, htmlContent)
        addLog(`Salvo: ${slug}.html`)
      } else if (fallbackDownload) {
        const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${slug}.html`
        a.click()
        URL.revokeObjectURL(a.href)
        savedDir = `${slug}.html`
        addLog(`Download: ${savedDir}`)
      }
    } catch (e) {
      addLog(`Erro ao salvar: ${(e as Error)?.message || 'desconhecido'}`)
    }

    setProgress(100)
    setCloneHtml(htmlContent)
    setCloneUrl(urlTrimmed)
    const updated: CloneJob = {
      ...job,
      status: savedDir ? 'completed' : 'failed',
      progress: 100,
      output: savedDir || undefined
    }
    saveJobs(jobs.map(j => j.id === job.id ? updated : j))
    setRunning(false)
  }

  function removeJob(id: string) {
    saveJobs(jobs.filter(j => j.id !== id))
  }

  function retryJob(job: CloneJob) {
    setUrl(job.url)
  }

  function statusLabel(status: string) {
    switch (status) {
      case 'running': return { text: 'Em andamento', cls: 'alta' }
      case 'completed': return { text: 'Concluido', cls: 'ativo' }
      case 'failed': return { text: 'Falha', cls: 'inativo' }
      default: return { text: 'Pendente', cls: 'info' }
    }
  }

  function openEditor(htmlContent: string, sourceUrl: string) {
    setCloneHtml(htmlContent)
    setCloneUrl(sourceUrl)
    setMode('editor')
  }

  function handleExtract(extractedHtml: string) {
    const blob = new Blob([extractedHtml], { type: 'text/html; charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `editado-${cloneUrl.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.html`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // ─── Deep / Completo Clone ──────────────────────────────────────
  const [deepCloneId, setDeepCloneId] = useState<string | null>(null)
  const [deepCloneFiles, setDeepCloneFiles] = useState<any[] | null>(null)
  const [deepDownloadUrl, setDeepDownloadUrl] = useState<string | null>(null)
  const [deepLoading, setDeepLoading] = useState(false)
  const [deepError, setDeepError] = useState('')

  async function startDeepClone() {
    const urlTrimmed = url.trim()
    if (!urlTrimmed || !validUrl(urlTrimmed)) { setError('Informe uma URL valida'); return }
    setDeepLoading(true)
    setDeepError('')
    setDeepCloneFiles(null)
    setDeepCloneId(null)
    setDeepDownloadUrl(null)
    try {
      const resp = await fetchWithAuth('/api/clone/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlTrimmed })
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      setDeepCloneId(data.cloneId)
      setDeepCloneFiles(data.files)
      setDeepDownloadUrl(data.downloadUrl)
      addLog('Clone completo realizado com sucesso!')
      addLog(`Recursos baixados e organizados em pastas.`)
    } catch (e: any) {
      setDeepError(e.message || 'Erro no clone completo')
      addLog(`Erro: ${e.message}`)
    }
    setDeepLoading(false)
  }

  async function downloadDeepZip() {
    if (!deepDownloadUrl) { addLog('downloadDeepZip: URL de download nao disponivel'); return }
    addLog(`Baixando ZIP de ${deepDownloadUrl}`)
    try {
      const resp = await fetchWithAuth(deepDownloadUrl)
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        let msg = `HTTP ${resp.status}`
        try { const j = JSON.parse(text); msg = j.error || j.erro || msg } catch {}
        addLog(`Resposta do servidor: ${msg}`)
        throw new Error(msg)
      }
      const blob = await resp.blob()
      const dlUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = dlUrl
      a.download = 'clone-completo.zip'
      a.click()
      URL.revokeObjectURL(dlUrl)
    } catch (e: any) {
      setDeepError(e.message || 'Erro ao baixar ZIP')
      addLog(`Erro no download: ${e.message}`)
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  function FileTreeNode({ node, depth }: { node: any; depth?: number }) {
    const [open, setOpen] = useState(true)
    const indent = depth || 0
    if (node.type === 'directory') {
      return (
        <div>
          <div className="ft-node" style={{ paddingLeft: 12 + indent * 16, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
            <span className="ft-arrow">{open ? '▾' : '▸'}</span>
            <span className="ft-icon">{'📁'}</span>
            <span className="ft-name ft-dir">{node.name}</span>
          </div>
          {open && node.children && node.children.map((c: any) => (
            <FileTreeNode key={c.path} node={c} depth={indent + 1} />
          ))}
        </div>
      )
    }
    return (
      <div className="ft-node" style={{ paddingLeft: 12 + indent * 16 }}>
        <span className="ft-arrow" style={{ visibility: 'hidden' }}>▸</span>
        <span className="ft-icon">{'📄'}</span>
        <span className="ft-name ft-file">{node.name}</span>
        {node.size != null && <span className="ft-size">{formatSize(node.size)}</span>}
      </div>
    )
  }

  return (
    <div>
      <div className="tool-header">
        <h3>Clonador — Clonagem Offline de Páginas Web</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`btn ${mode === 'clone' ? 'btn-accent' : 'btn-secondary'}`} onClick={() => setMode('clone')} style={{ fontSize: 12 }}>
            <IconArrowDown size={14} /> Clonar
          </button>
          <button className={`btn ${mode === 'editor' ? 'btn-accent' : 'btn-secondary'}`} onClick={() => setMode('editor')} style={{ fontSize: 12 }}>
            ◎ Editor
          </button>
        </div>
      </div>

      {mode === 'clone' ? (
      <>
      <div className="clone-url-bar">
        <div className="clone-url-input">
          <input
            type="url"
            placeholder="https://exemplo.com/pagina"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !running) startClone() }}
          />
        </div>
        <button className="btn btn-gradient" onClick={startClone} disabled={running}>
          {running ? 'Clonando...' : 'Clonar HTML'}
        </button>
        <button className="btn btn-accent" onClick={startDeepClone} disabled={deepLoading}>
          {deepLoading ? 'Processando...' : 'Clone Completo'}
        </button>
        <button className="btn btn-secondary" onClick={() => { setLog([]); setProgress(0); setError(''); setDeepError(''); setDeepCloneFiles(null); setDeepCloneId(null); setDeepDownloadUrl(null) }}>
          Limpar
        </button>
      </div>

      <div className="clone-layout">
        <div className="clone-config">
          <div className="clone-config-section">
            <div className="clone-config-header">Recursos</div>
            <div className="clone-config-body">
              <label className="filter-checkbox">
                <input type="checkbox" checked={includeExternal} onChange={e => setIncludeExternal(e.target.checked)} />
                Incluir recursos externos <HelpTooltip text="Baixar tambem CSS, JS, e imagens hospedados em outros dominios." />
              </label>
              <label className="filter-checkbox">
                <input type="checkbox" checked={respectRobots} onChange={e => setRespectRobots(e.target.checked)} />
                Respeitar robots.txt <HelpTooltip text="Nao baixar recursos bloqueados pelo arquivo robots.txt do site." />
              </label>
              <label className="filter-checkbox">
                <input type="checkbox" checked={flat} onChange={e => setFlat(e.target.checked)} />
                Modo plano (sem pastas) <HelpTooltip text="Salvar todos os arquivos em uma unica pasta, sem subdiretorios." />
              </label>
              <label className="filter-checkbox">
                <input type="checkbox" checked={rescueMode} onChange={e => { setRescueMode(e.target.checked); if (e.target.checked) setIncludeExternal(true) }} />
                Modo Resgate (renderizado) <HelpTooltip text="Usa engine headless para renderizar JavaScript e capturar o conteudo completo da pagina." />
              </label>
            </div>
          </div>

          <div className="clone-config-section">
            <div className="clone-config-header">Desempenho</div>
            <div className="clone-config-body clone-config-grid">
              <div className="filter-group">
                <label>Concorrencia <HelpTooltip text="Numero de downloads simultaneos. Maior valor acelera, mas consome mais recursos." /></label>
                <input type="number" min={1} max={32} value={concurrency} onChange={e => setConcurrency(Math.max(1, Number(e.target.value)))} />
              </div>
              <div className="filter-group">
                <label>Timeout (s) <HelpTooltip text="Tempo maximo em segundos para cada requisicao individual." /></label>
                <input type="number" min={1} value={timeout} onChange={e => setTimeout_(Math.max(1, Number(e.target.value)))} />
              </div>
              <div className="filter-group">
                <label>Render Wait (s) <HelpTooltip text="Tempo de espera para renderizacao de JavaScript antes de capturar o conteudo." /></label>
                <input type="number" min={1} value={renderWait} onChange={e => setRenderWait(Math.max(1, Number(e.target.value)))} />
              </div>
            </div>
          </div>

          {error && <div className="alerta">{error}</div>}
        </div>

        <div className="clone-right">
          <div className="clone-progress-card">
            <div className="clone-progress-header">
              <span>Progresso</span>
              <span className={running ? 'badge alta' : progress === 100 ? 'badge ativo' : 'badge info'}>
                {running ? `${progress}%` : progress === 100 ? 'Concluido' : 'Aguardando'}
              </span>
            </div>
            <div className="trilha" style={{ marginTop: 8 }}>
              <div className="barra" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="clone-progress-steps">
              {STEPS.map((step, i) => {
                const thresholds = [25, 50, 75, 100]
                const done = progress >= thresholds[i]
                return (
                  <div key={step} className={`step ${done ? 'done' : ''}`}>
                    <span className="step-dot">{done ? <><IconCheck size={14} /></> : `0${i + 1}`}</span>
                    <span className="step-label">{step}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {log.length > 0 && (
            <div className="clone-log-card">
              <div className="clone-log-header" onClick={() => setShowLog(!showLog)}>
                <span>Log ao vivo ({log.length} linhas)</span>
                <span>{showLog ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}</span>
              </div>
              {showLog && (
                <div className="clone-log-body">
                  {log.map((msg, i) => (
                    <div key={i} className="clone-log-line">{msg}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {deepError && <div className="alerta" style={{ marginBottom: 8 }}>{deepError}</div>}

          {deepCloneFiles && deepCloneId && (
            <div className="clone-log-card">
              <div className="clone-log-header">
                <span>Clone Completo - Arquivos Organizados</span>
                <button className="btn btn-primary" onClick={downloadDeepZip} style={{ fontSize: 11, padding: '2px 10px' }}>
                  Baixar ZIP
                </button>
              </div>
              <div className="clone-log-body" style={{ maxHeight: 300, overflow: 'auto' }}>
                {deepCloneFiles.map((node: any) => (
                  <FileTreeNode key={node.path} node={node} />
                ))}
              </div>
            </div>
          )}

          <div className="clone-history-card">
            <div className="clone-history-header">
              <span>Historico de Clones ({jobs.length})</span>
            </div>
            {jobs.length === 0 ? (
              <div className="clone-history-empty">
                Nenhum clone realizado. Cole uma URL acima e clique em "Clonar".
              </div>
            ) : (
              <div className="clone-history-list">
                {jobs.map(job => {
                  const sl = statusLabel(job.status)
                  return (
                    <div key={job.id} className="clone-job-card">
                      <div className="clone-job-top">
                        <span className={`badge ${sl.cls}`}>{sl.text}</span>
                        <span className="clone-job-time">
                          {new Date(job.createdAt).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="clone-job-url" title={job.url}>{job.url}</div>
                      {job.output && <div className="clone-job-output">Salvo em: {job.output}</div>}
                      <div className="clone-job-actions">
                        <button className="btn btn-secondary" onClick={() => retryJob(job)} title="Usar esta URL">
                          Clonar novamente
                        </button>
                        <button className="btn btn-secondary" onClick={() => removeJob(job.id)} title="Remover">
                          Remover
                        </button>
                        {job.status === 'completed' && cloneHtml && job.url === cloneUrl && (
                          <button className="btn btn-primary" onClick={() => openEditor(cloneHtml, cloneUrl)} title="Editar no editor visual">
                            <IconTarget size={14} /> Editar
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      </>
      ) : (
        <div style={{ height: 'calc(100vh - 160px)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Editando: {cloneUrl}</span>
            <button className="btn btn-secondary" onClick={() => setMode('clone')} style={{ marginLeft: 'auto', fontSize: 11 }}>✕ Fechar editor</button>
          </div>
          <PageEditor html={cloneHtml} sourceUrl={cloneUrl} onExtract={handleExtract} fetchWithAuth={fetchWithAuth} />
        </div>
      )}
    </div>
  )
}
