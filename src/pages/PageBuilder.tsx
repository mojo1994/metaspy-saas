import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  PageData, DocumentNode, SavedComponent, createDefaultPage, createDefaultNode,
  findNode, removeNode, insertNode, moveNode, cloneSubtree,
  NodeType, stylesToCss, hoverStyleToCss, SCROLL_ANIMATION_KEYFRAMES,
} from '../components/builder/documentModel'
import ElementTree from '../components/builder/ElementTree'
import BuilderCanvas from '../components/builder/BuilderCanvas'
import PropertyInspector from '../components/builder/PropertyInspector'

type Tab = 'tree' | 'widgets' | 'components'

function apiUrl(path: string) { return `/api${path}` }

const WIDGET_CATEGORIES = [
  {
    name: 'Estrutura',
    items: [
      { type: 'section', label: 'Secao', icon: 'Sec' },
      { type: 'container', label: 'Container', icon: 'Ctn' },
      { type: 'row', label: 'Linha', icon: '→' },
      { type: 'column', label: 'Coluna', icon: '↓' },
    ],
  },
  {
    name: 'Conteudo',
    items: [
      { type: 'heading', label: 'Titulo', icon: 'H' },
      { type: 'text', label: 'Texto', icon: 'T' },
      { type: 'image', label: 'Imagem', icon: 'Img' },
      { type: 'button', label: 'Botao', icon: 'Btn' },
      { type: 'divider', label: 'Divisor', icon: '—' },
      { type: 'icon', label: 'Icone', icon: '★' },
      { type: 'video', label: 'Video', icon: 'Vid' },
      { type: 'list', label: 'Lista', icon: 'Lista' },
    ],
  },
  {
    name: 'Marketing',
    items: [
      { type: 'hero', label: 'Hero', icon: 'Hero' },
      { type: 'pricing', label: 'Tabela', icon: '$' },
      { type: 'faq', label: 'FAQ', icon: '?' },
      { type: 'testimonial', label: 'Depoimento', icon: 'Qte' },
      { type: 'countdown', label: 'Timer', icon: 'Timer' },
      { type: 'tabs', label: 'Abas', icon: 'Tbs' },
      { type: 'form', label: 'Formulario', icon: 'Frm' },
      { type: 'nav', label: 'Nav Bar', icon: 'Nav' },
    ],
  },
  {
    name: 'Avancado',
    items: [
      { type: 'modal', label: 'Modal', icon: 'Modal' },
      { type: 'embed', label: 'Incorporar', icon: 'Embed' },
    ],
  },
]

const DEVICES = [
  { width: 1440, label: 'Desktop', icon: 'PC' },
  { width: 768, label: 'Tablet', icon: 'Tab' },
  { width: 375, label: 'Mobile', icon: 'Mob' },
]

const COMPONENTS_KEY = 'metaspy_builder_components'
const RECENT_PAGES_KEY = 'metaspy_builder_recent'

function loadComponents(): SavedComponent[] {
  try { return JSON.parse(localStorage.getItem(COMPONENTS_KEY) || '[]') } catch { return [] }
}
function saveComponents(components: SavedComponent[]) {
  localStorage.setItem(COMPONENTS_KEY, JSON.stringify(components))
}

const MAX_HISTORY = 50

export default function PageBuilder() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { fetchWithAuth, user } = useAuth()

  const editId = searchParams.get('edit')
  const [page, setPage] = useState<PageData>(() => {
    const p = createDefaultPage('Minha Pagina', 'minha-pagina')
    return p
  })
  const [dbId, setDbId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string>(page.tree.id)
  const [zoom, setZoom] = useState(1)
  const [deviceIndex, setDeviceIndex] = useState(0)
  const [previewMode, setPreviewMode] = useState(false)
  const [leftTab, setLeftTab] = useState<Tab>('tree')
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [searchFilter, setSearchFilter] = useState('')
  const [pageName, setPageName] = useState(page.name)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [savedComponents, setSavedComponents] = useState<SavedComponent[]>(loadComponents)
  const [publishUrl, setPublishUrl] = useState<string | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>()
  const loadingRef = useRef(false)
  const historyRef = useRef<DocumentNode[]>([])
  const historyIdxRef = useRef(-1)
  const clipboardRef = useRef<DocumentNode | null>(null)
  const hasUnsavedRef = useRef(false)
  const pageRootIdRef = useRef(page.tree.id)
  const lastHistoryPushRef = useRef(0)

  const selectedNode = selectedId ? findNode(page.tree, selectedId) : null

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  function pushHistory(tree: DocumentNode) {
    const clone = JSON.parse(JSON.stringify(tree))
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1)
    historyRef.current.push(clone)
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
    historyIdxRef.current = historyRef.current.length - 1
    setCanUndo(historyIdxRef.current > 0)
    setCanRedo(false)
  }

  function pushHistoryStructured(tree: DocumentNode) {
    const now = Date.now()
    if (now - lastHistoryPushRef.current > 800) {
      pushHistory(tree)
      lastHistoryPushRef.current = now
    }
  }

  function handleUndo() {
    if (historyIdxRef.current <= 0) return
    historyIdxRef.current--
    const snapshot = JSON.parse(JSON.stringify(historyRef.current[historyIdxRef.current]))
    setPage(prev => ({ ...prev, tree: snapshot }))
    setCanUndo(historyIdxRef.current > 0)
    setCanRedo(true)
    hasUnsavedRef.current = true
  }

  function handleRedo() {
    if (historyIdxRef.current >= historyRef.current.length - 1) return
    historyIdxRef.current++
    const snapshot = JSON.parse(JSON.stringify(historyRef.current[historyIdxRef.current]))
    setPage(prev => ({ ...prev, tree: snapshot }))
    setCanUndo(true)
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1)
    hasUnsavedRef.current = true
  }

  // Load from backend
  useEffect(() => {
    if (!editId || !fetchWithAuth || loadingRef.current) return
    loadingRef.current = true
    fetchWithAuth(apiUrl(`/builder/${editId}`))
      .then(res => {
        if (!res.ok) throw new Error('Falha ao carregar')
        return res.json()
      })
      .then(data => {
        let tree
        if (data.type === 'hosted') {
          const match = data.html.match(/<script id="__METASPY_TREE" type="application\/json">(.+?)<\/script>/)
          tree = match ? JSON.parse(match[1]) : null
        } else {
          tree = JSON.parse(data.html)
        }
        if (!tree) { loadingRef.current = false; throw new Error('Arvore nao encontrada') }
        setPage({
          id: data.id,
          name: data.title,
          slug: data.slug,
          tree,
          breakpoints: ['1440', '768', '375'],
          globalStyles: {},
        })
        setPageName(data.title)
        setDbId(data.id)
        setSelectedId(tree.id)
        pageRootIdRef.current = tree.id
        historyRef.current = [JSON.parse(JSON.stringify(tree))]
        historyIdxRef.current = 0
        setCanUndo(false)
        setCanRedo(false)
        hasUnsavedRef.current = false
        loadingRef.current = false
      })
      .catch(err => {
        console.error('Erro carregar builder:', err)
        showToast('error', 'Erro ao carregar pagina.')
        loadingRef.current = false
      })
  }, [editId, fetchWithAuth])

  function updatePageTree(updater: (tree: DocumentNode) => void) {
    setPage(prev => {
      const next = { ...prev, tree: JSON.parse(JSON.stringify(prev.tree)) }
      updater(next.tree)
      return next
    })
    hasUnsavedRef.current = true
  }

  const handleSelect = useCallback((id: string) => setSelectedId(id), [])
  const handleDelete = useCallback((id: string) => {
    setPage(prev => { pushHistory(prev.tree); return prev })
    updatePageTree(tree => removeNode(tree, id))
    setSelectedId(pageRootIdRef.current)
  }, [])
  const handleRename = useCallback((id: string, name: string) => {
    setPage(prev => { pushHistory(prev.tree); return prev })
    updatePageTree(tree => { const node = findNode(tree, id); if (node) node.name = name })
  }, [])
  const handleMove = useCallback((nodeId: string, newParentId: string, newIndex: number) => {
    setPage(prev => { pushHistory(prev.tree); return prev })
    updatePageTree(tree => moveNode(tree, nodeId, newParentId, newIndex))
  }, [])
  const handleDropWidget = useCallback((type: string, parentId: string, index?: number) => {
    setPage(prev => { pushHistory(prev.tree); return prev })
    const node = createDefaultNode(type as NodeType)
    updatePageTree(tree => insertNode(tree, parentId, node, index ?? 0))
    setSelectedId(node.id)
  }, [])
  const handleUpdateNode = useCallback((id: string, changes: Partial<DocumentNode>) => {
    setPage(prev => { pushHistoryStructured(prev.tree); return prev })
    updatePageTree(tree => { const node = findNode(tree, id); if (node) Object.assign(node, changes) })
  }, [])

  // Keyboard shortcuts
  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave
  const deleteRef = useRef(handleDelete)
  deleteRef.current = handleDelete
  const duplicateRef = useRef(handleDuplicate)
  duplicateRef.current = handleDuplicate
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (e.key === 'Escape' && !isInput) {
        setPreviewMode(false)
        setSelectedId(pageRootIdRef.current)
        return
      }
      if (isInput) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const sid = selectedId
        if (sid && sid !== pageRootIdRef.current) {
          e.preventDefault()
          deleteRef.current(sid)
        }
        return
      }
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault()
            if (e.shiftKey) handleRedo()
            else handleUndo()
            break
          case 'y':
            e.preventDefault()
            handleRedo()
            break
          case 's':
            e.preventDefault()
            handleSaveRef.current()
            break
          case 'c': {
            const sn = findNode(page.tree, selectedId)
            if (sn) {
              clipboardRef.current = JSON.parse(JSON.stringify(sn))
              showToast('success', 'Elemento copiado!')
            }
            break
          }
          case 'v':
            if (clipboardRef.current) {
              const cloned = cloneSubtree(clipboardRef.current)
              pushHistory(page.tree)
              updatePageTree(tree => insertNode(tree, selectedId || pageRootIdRef.current, cloned, 0))
              setSelectedId(cloned.id)
              showToast('success', 'Elemento colado!')
            }
            break
          case 'd':
            e.preventDefault()
            const sn = findNode(page.tree, selectedId)
            if (sn && sn.id !== pageRootIdRef.current) {
              duplicateRef.current(sn.id)
            }
            break
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, page.tree])

  // Beforeunload
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsavedRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  function handleDuplicate(nodeId: string) {
    const rootId = pageRootIdRef.current
    const node = findNode(page.tree, nodeId)
    if (!node) return
    const cloned = cloneSubtree(node)
    setPage(prev => { pushHistory(prev.tree); return prev })
    updatePageTree(tree => insertNode(tree, rootId, cloned, 0))
    setSelectedId(cloned.id)
  }

  function handleCopy(nodeId: string) {
    const node = findNode(page.tree, nodeId)
    if (node) {
      clipboardRef.current = JSON.parse(JSON.stringify(node))
      showToast('success', 'Elemento copiado!')
    }
  }

  function handlePaste() {
    if (clipboardRef.current) {
      const cloned = cloneSubtree(clipboardRef.current)
      setPage(prev => { pushHistory(prev.tree); return prev })
      updatePageTree(tree => insertNode(tree, selectedId || page.tree.id, cloned, 0))
      setSelectedId(cloned.id)
      showToast('success', 'Elemento colado!')
    }
  }

  // Save to backend
  async function handleSave() {
    if (!fetchWithAuth) return
    setSaving(true)
    try {
      const body: any = { name: pageName, tree: page.tree }
      if (dbId) body.id = dbId
      const res = await fetchWithAuth(apiUrl('/builder/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Falha ao salvar')
      const data = await res.json()
      if (!dbId) setDbId(data.id)
      setLastSaved(new Date())
      hasUnsavedRef.current = false
      showToast('success', 'Salvo com sucesso!')
    } catch (err) {
      console.error('Erro salvar:', err)
      showToast('error', 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  // Auto-save debounce
  useEffect(() => {
    if (!dbId) return
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => { handleSave() }, 10000)
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current) }
  }, [page.tree, dbId])

  // Publish
  async function handlePublish() {
    if (!fetchWithAuth || !dbId) { showToast('error', 'Salve a pagina primeiro.'); return }
    setPublishing(true)
    try {
      const res = await fetchWithAuth(apiUrl(`/builder/${dbId}/publish`), { method: 'POST' })
      if (!res.ok) throw new Error('Falha ao publicar')
      const data = await res.json()
      setPublishUrl(data.url || data.cf_url || '')
      showToast('success', 'Publicado com sucesso!')
    } catch (err) {
      console.error('Erro publicar:', err)
      showToast('error', 'Erro ao publicar.')
    } finally {
      setPublishing(false)
    }
  }

  // Image upload
  async function handleImageUpload(file: File) {
    if (!fetchWithAuth || !selectedId) return
    const formData = new FormData()
    formData.append('image', file)
    try {
      const res = await fetchWithAuth(apiUrl('/builder/upload'), {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Falha ao fazer upload')
      const data = await res.json()
      handleUpdateNode(selectedId, { props: { ...selectedNode?.props, src: data.url, alt: file.name } })
      showToast('success', 'Imagem enviada!')
    } catch (err) {
      console.error('Erro upload:', err)
      showToast('error', 'Erro ao enviar imagem.')
    }
  }

  function triggerImageUpload() { imageInputRef.current?.click() }

  // Components
  function handleSaveAsComponent() {
    if (!selectedNode || selectedNode.type === 'page') { showToast('error', 'Selecione um elemento para salvar como componente.'); return }
    const comp: SavedComponent = {
      id: `comp_${Date.now()}`,
      name: selectedNode.name,
      node: cloneSubtree(selectedNode),
      createdAt: new Date().toISOString(),
    }
    const updated = [...savedComponents, comp]
    setSavedComponents(updated)
    saveComponents(updated)
    showToast('success', 'Componente salvo!')
  }

  function handleInsertComponent(compNode: DocumentNode) {
    const node = cloneSubtree(compNode)
    updatePageTree(tree => insertNode(tree, selectedId || page.tree.id, node, 0))
    setSelectedId(node.id)
  }

  function handleDeleteComponent(id: string) {
    const updated = savedComponents.filter(c => c.id !== id)
    setSavedComponents(updated)
    saveComponents(updated)
  }

  // Export HTML
  function handleExport() {
    const html = generateHtml(page.tree)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${page.slug}.html`; a.click()
    URL.revokeObjectURL(url)
  }

  function handleWidgetDragStart(e: React.DragEvent, type: string) {
    e.dataTransfer.setData('application/metaspy-widget', type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  function handleComponentDragStart(e: React.DragEvent, comp: SavedComponent) {
    e.dataTransfer.setData('application/metaspy-component', JSON.stringify(comp.node))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const currentDevice = DEVICES[deviceIndex]

  return (
    <div className="builder-layout">
      <style>{`
        .builder-layout { display: flex; flex-direction: column; height: 100vh; width: 100%; }
        .builder-topbar {
          display: flex; align-items: center; gap: 8px; padding: 6px 12px;
          background: var(--bg-secondary); border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .builder-body { display: flex; flex: 1; overflow: hidden; }
        .builder-left {
          width: 260px; border-right: 1px solid var(--border);
          display: flex; flex-direction: column; background: var(--bg-secondary);
          flex-shrink: 0;
        }
        .builder-center { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
        .builder-right {
          width: 260px; border-left: 1px solid var(--border);
          display: flex; flex-direction: column; background: var(--bg-secondary);
          flex-shrink: 0; overflow-y: auto;
        }
        .builder-tabs {
          display: flex; border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .builder-tab {
          flex: 1; padding: 6px; text-align: center; font-size: 11px;
          cursor: pointer; border: none; background: none;
          color: var(--text-muted); border-bottom: 2px solid transparent;
          transition: all 0.15s;
        }
        .builder-tab:hover { color: var(--text-primary); }
        .builder-tab.active { color: var(--purple-400); border-bottom-color: var(--purple-400); }
        .builder-left-content { flex: 1; overflow-y: auto; padding: 4px 0; }
        .builder-widget-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 8px;
        }
        .builder-widget-item {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 10px 4px; background: var(--bg-primary);
          border: 1px solid var(--border); border-radius: 8px;
          cursor: grab; font-size: 11px; text-align: center;
          transition: all 0.15s; user-select: none;
        }
        .builder-widget-item:hover { border-color: var(--purple-400); background: rgba(124,58,237,0.05); }
        .builder-widget-item:active { cursor: grabbing; }
        .builder-widget-category { padding: 8px 12px 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); font-weight: 600; }
        .builder-device-btn {
          padding: 4px 8px; font-size: 11px; border-radius: 6px;
          border: 1px solid transparent; cursor: pointer;
          background: none; color: var(--text-muted); transition: all 0.15s;
          display: flex; align-items: center; gap: 4px;
        }
        .builder-device-btn:hover { color: var(--text-primary); }
        .builder-device-btn.active { border-color: var(--purple-400); color: var(--purple-400); }
        .builder-search { padding: 6px 8px; }
        .builder-search input {
          width: 100%; padding: 4px 8px; border: 1px solid var(--border);
          border-radius: 6px; background: var(--bg-primary);
          color: var(--text-primary); font-size: 11px; outline: none;
          box-sizing: border-box;
        }
        .builder-search input:focus { border-color: var(--purple-400); }
        .builder-toast {
          position: fixed; bottom: 20px; right: 20px; padding: 8px 16px;
          border-radius: 8px; font-size: 12px; z-index: 9999;
          animation: slideUp 0.3s ease;
        }
        .builder-toast.success { background: #059669; color: #fff; }
        .builder-toast.error { background: #dc2626; color: #fff; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .builder-comp-item {
          display: flex; align-items: center; gap: 6px; padding: 6px 12px;
          cursor: pointer; font-size: 11px; border-bottom: 1px solid var(--border);
          transition: all 0.15s;
        }
        .builder-comp-item:hover { background: rgba(124,58,237,0.05); }
        .builder-publish-url {
          padding: 8px 12px; background: rgba(5,150,105,0.1); border-radius: 6px;
          font-size: 11px; word-break: break-all;
        }
      `}</style>

      {toast && <div className={`builder-toast ${toast.type}`}>{toast.message}</div>}

      <div className="builder-topbar">
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/hospedar')} style={{ fontSize: 11, padding: '4px 8px' }}>
          ← Voltar
        </button>

        <input
          value={pageName}
          onChange={e => setPageName(e.target.value)}
          style={{
            border: 'none', background: 'transparent', color: 'var(--text-primary)',
            fontWeight: 600, fontSize: 14, padding: '4px 8px', borderRadius: 4,
            outline: 'none', width: 200,
          }}
          placeholder="Nome da pagina"
        />

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', gap: 2, marginRight: 8 }}>
          {DEVICES.map((d, i) => (
            <button
              key={d.label}
              className={`builder-device-btn ${i === deviceIndex ? 'active' : ''}`}
              onClick={() => setDeviceIndex(i)}
            >{d.icon} {d.label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>−</button>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>+</button>
        </div>

        <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
          <button className="builder-device-btn" onClick={handleUndo} disabled={!canUndo} title="Desfazer (Ctrl+Z)" style={{ opacity: canUndo ? 1 : 0.3 }}>↩</button>
          <button className="builder-device-btn" onClick={handleRedo} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)" style={{ opacity: canRedo ? 1 : 0.3 }}>↪</button>
        </div>

        <button className={`builder-device-btn ${previewMode ? 'active' : ''}`} onClick={() => setPreviewMode(p => !p)} style={{ marginLeft: 4 }}>
          ⊡ Preview
        </button>

        <div style={{ flex: 1 }} />

        {lastSaved && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            Salvo {lastSaved.toLocaleTimeString()}
          </span>
        )}

        <button className="btn btn-secondary" onClick={handleExport} style={{ fontSize: 11, padding: '4px 10px' }}>
          Exportar HTML
        </button>
        <button className="btn btn-gradient" onClick={handleSave} disabled={saving} style={{ fontSize: 11, padding: '4px 10px' }}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        {dbId && (
          <button className="btn btn-accent" onClick={handlePublish} disabled={publishing} style={{ fontSize: 11, padding: '4px 10px' }}>
            {publishing ? 'Publicando...' : 'Publicar'}
          </button>
        )}
      </div>

      <div className="builder-body">
        <div className="builder-left">
          <div className="builder-tabs">
            <button className={`builder-tab ${leftTab === 'tree' ? 'active' : ''}`} onClick={() => setLeftTab('tree')}>Arvore</button>
            <button className={`builder-tab ${leftTab === 'widgets' ? 'active' : ''}`} onClick={() => setLeftTab('widgets')}>Widgets</button>
            <button className={`builder-tab ${leftTab === 'components' ? 'active' : ''}`} onClick={() => setLeftTab('components')}>Componentes</button>
          </div>

          <div className="builder-left-content">
            {leftTab === 'tree' && (
              <ElementTree
                tree={page.tree}
                selectedId={selectedId}
                onSelect={handleSelect}
                onDelete={handleDelete}
                onRename={handleRename}
                onMove={handleMove}
                onDuplicate={handleDuplicate}
                onCopy={handleCopy}
                onPaste={handlePaste}
              />
            )}

            {leftTab === 'widgets' && (
              <div>
                <div className="builder-search">
                  <input placeholder="Buscar widget..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
                </div>
                {WIDGET_CATEGORIES.map(cat => {
                  const items = searchFilter ? cat.items.filter(i => i.label.toLowerCase().includes(searchFilter.toLowerCase())) : cat.items
                  if (items.length === 0) return null
                  return (
                    <div key={cat.name}>
                      <div className="builder-widget-category">{cat.name}</div>
                      <div className="builder-widget-grid">
                        {items.map(item => (
                          <div
                            key={item.type}
                            className="builder-widget-item"
                            draggable
                            onDragStart={e => handleWidgetDragStart(e, item.type)}
                            onClick={() => handleDropWidget(item.type, selectedId || page.tree.id, 0)}
                          >
                            <span style={{ fontSize: 20 }}>{item.icon}</span>
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {leftTab === 'components' && (
              <div>
                <div style={{ padding: '8px 12px' }}>
                  <button className="btn btn-secondary" onClick={handleSaveAsComponent} style={{ fontSize: 11, padding: '4px 10px', width: '100%' }}>
                    Salvar selecao como componente
                  </button>
                </div>
                <div className="builder-widget-category">Meus Componentes</div>
                {savedComponents.length === 0 && (
                  <div style={{ padding: '12px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                    Selecione um elemento na arvore e clique em "Salvar selecao como componente"
                  </div>
                )}
                {savedComponents.map(comp => (
                  <div key={comp.id} className="builder-comp-item" draggable onDragStart={e => handleComponentDragStart(e, comp)}>
                    <span style={{ flex: 1, cursor: 'grab' }} onClick={() => handleInsertComponent(comp.node)}>
                      ⊕ {comp.name}
                    </span>
                    <button
                      onClick={() => handleDeleteComponent(comp.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="builder-center">
          <BuilderCanvas
            tree={page.tree}
            selectedId={selectedId}
            onSelect={handleSelect}
            onDropWidget={handleDropWidget}
            onDropComponent={(node, parentId, index) => {
              const cloned = cloneSubtree(node)
              updatePageTree(tree => insertNode(tree, parentId, cloned, index ?? 0))
              setSelectedId(cloned.id)
            }}
            onMoveNode={handleMove}
            onUpdateNode={handleUpdateNode}
            zoom={zoom}
            deviceWidth={currentDevice.width}
            previewMode={previewMode}
          />
        </div>

        <div className="builder-right">
          <PropertyInspector node={selectedNode} onChange={handleUpdateNode} />
          {selectedNode?.type === 'image' && (
            <div style={{ padding: '4px 12px 12px' }}>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }}
              />
              <button className="btn btn-secondary" onClick={triggerImageUpload} style={{ fontSize: 11, padding: '4px 10px', width: '100%' }}>
                Enviar imagem
              </button>
            </div>
          )}
          {publishUrl && (
            <div style={{ padding: '8px 12px' }}>
              <div className="builder-section-title">Publicado em:</div>
              <div className="builder-publish-url">
                <a href={publishUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple-400)' }}>{publishUrl}</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function generateHtml(tree: DocumentNode): string {
  function renderNode(node: DocumentNode): string {
    const css = stylesToCss(node.styles, node.layoutMode)
    const styleAttr = css ? ` style="${css}"` : ''
    const animAttr = node.scrollAnimation ? ` data-scroll="${node.scrollAnimation.type}" data-duration="${node.scrollAnimation.duration}" data-delay="${node.scrollAnimation.delay}"` : ''
    const clickAttr = node.clickAction?.type === 'link' ? ` onclick="window.open('${node.clickAction.linkUrl}','${node.clickAction.linkTarget || '_self'}')"` : node.clickAction?.type === 'scrollTo' ? ` onclick="document.querySelector('${node.clickAction.scrollSelector}')?.scrollIntoView({behavior:'smooth'})"` : ''

    switch (node.type) {
      case 'page':
        return `<div${styleAttr}${animAttr}${clickAttr}>\n${node.children.map(renderNode).join('\n')}\n</div>`
      case 'section':
        return `<section${styleAttr}${animAttr}${clickAttr}>\n${node.children.map(renderNode).join('\n')}\n</section>`
      case 'container': case 'row': case 'column':
        return `<div${styleAttr}${animAttr}${clickAttr}>\n${node.children.map(renderNode).join('\n')}\n</div>`
      case 'heading': {
        const level = node.props.level || 'h2'
        return `<${level}${styleAttr}${animAttr}${clickAttr}>${node.props.text || ''}</${level}>`
      }
      case 'text':
        return `<div${styleAttr}${animAttr}${clickAttr}>${node.props.html || ''}</div>`
      case 'button': {
        const link = node.props.link || '#'
        const target = node.props.target || '_self'
        return `<a href="${link}" target="${target}"${styleAttr}${animAttr}${clickAttr}>${node.props.text || ''}</a>`
      }
      case 'image':
        return `<img src="${node.props.src || ''}" alt="${node.props.alt || ''}"${styleAttr}${animAttr}${clickAttr} />`
      case 'divider':
        return `<hr${styleAttr}${animAttr}${clickAttr} />`
      default:
        return `<div${styleAttr}${animAttr}${clickAttr}>\n${node.children.map(renderNode).join('\n')}\n</div>`
    }
  }

  function collectHoverStyles(node: DocumentNode): string {
    let css = ''
    if (node.hoverStyle) {
      css += `[data-node-id="${node.id}"]:hover { ${hoverStyleToCss(node.hoverStyle)} }\n`
    }
    node.children.forEach(c => { css += collectHoverStyles(c) })
    return css
  }

  const bodyContent = renderNode(tree)
  const hoverCss = collectHoverStyles(tree)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tree.props.title || 'Minha Pagina'}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }
    ${hoverCss}
    ${SCROLL_ANIMATION_KEYFRAMES}
    [data-scroll] { opacity: 0; }
  </style>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            var el = entry.target;
            el.style.animation = el.getAttribute('data-scroll') + ' ' + (el.getAttribute('data-duration') || 600) + 'ms ease ' + (el.getAttribute('data-delay') || 0) + 'ms both';
            entry.target.style.opacity = '';
            observer.unobserve(el);
          }
        });
      }, { threshold: 0.1 }).observe(document.querySelectorAll('[data-scroll]'));
    });
  </script>
</head>
<body>
${bodyContent}
</body>
</html>`
}
