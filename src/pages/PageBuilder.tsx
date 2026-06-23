import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  PageData, DocumentNode, createDefaultPage, createDefaultNode,
  findNode, removeNode, insertNode, moveNode, NodeType, stylesToCss,
} from '../components/builder/documentModel'
import ElementTree from '../components/builder/ElementTree'
import BuilderCanvas from '../components/builder/BuilderCanvas'
import PropertyInspector from '../components/builder/PropertyInspector'

type Tab = 'tree' | 'widgets' | 'pages'

const WIDGET_CATEGORIES = [
  {
    name: 'Estrutura',
    items: [
      { type: 'section', label: 'Secao', icon: '📐' },
      { type: 'container', label: 'Container', icon: '🔲' },
      { type: 'row', label: 'Linha', icon: '➡️' },
      { type: 'column', label: 'Coluna', icon: '⬇️' },
    ],
  },
  {
    name: 'Conteudo',
    items: [
      { type: 'heading', label: 'Titulo', icon: '📰' },
      { type: 'text', label: 'Texto', icon: '📝' },
      { type: 'image', label: 'Imagem', icon: '🖼️' },
      { type: 'button', label: 'Botao', icon: '🔘' },
      { type: 'divider', label: 'Divisor', icon: '➖' },
    ],
  },
  {
    name: 'Marketing',
    items: [
      { type: 'hero', label: 'Hero', icon: '🏆' },
      { type: 'pricing', label: 'Tabela', icon: '💰' },
      { type: 'faq', label: 'FAQ', icon: '❓' },
      { type: 'testimonial', label: 'Depoimento', icon: '💬' },
      { type: 'countdown', label: 'Timer', icon: '⏱️' },
      { type: 'tabs', label: 'Abas', icon: '📑' },
    ],
  },
]

const DEVICES = [
  { width: 1440, label: 'Desktop', icon: '🖥️' },
  { width: 768, label: 'Tablet', icon: '📱' },
  { width: 375, label: 'Mobile', icon: '📲' },
]

export default function PageBuilder() {
  const navigate = useNavigate()
  const { fetchWithAuth } = useAuth()

  const [page, setPage] = useState<PageData>(() => createDefaultPage('Minha Pagina', 'minha-pagina'))
  const [selectedId, setSelectedId] = useState<string>(page.tree.id)
  const [zoom, setZoom] = useState(1)
  const [deviceIndex, setDeviceIndex] = useState(0)
  const [leftTab, setLeftTab] = useState<Tab>('tree')
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [searchFilter, setSearchFilter] = useState('')
  const [pageName, setPageName] = useState(page.name)
  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>()

  const selectedNode = selectedId ? findNode(page.tree, selectedId) : null

  function updatePageTree(updater: (tree: DocumentNode) => void) {
    setPage(prev => {
      const next = { ...prev, tree: JSON.parse(JSON.stringify(prev.tree)) }
      updater(next.tree)
      return next
    })
  }

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  const handleDelete = useCallback((id: string) => {
    updatePageTree(tree => removeNode(tree, id))
    if (selectedId === id) setSelectedId(page.tree.id)
  }, [selectedId])

  const handleRename = useCallback((id: string, name: string) => {
    updatePageTree(tree => {
      const node = findNode(tree, id)
      if (node) node.name = name
    })
  }, [])

  const handleMove = useCallback((nodeId: string, newParentId: string, newIndex: number) => {
    updatePageTree(tree => moveNode(tree, nodeId, newParentId, newIndex))
  }, [])

  const handleDropWidget = useCallback((type: string, parentId: string, index?: number) => {
    const node = createDefaultNode(type as NodeType)
    updatePageTree(tree => insertNode(tree, parentId, node, index ?? 0))
    setSelectedId(node.id)
  }, [])

  const handleUpdateNode = useCallback((id: string, changes: Partial<DocumentNode>) => {
    updatePageTree(tree => {
      const node = findNode(tree, id)
      if (node) Object.assign(node, changes)
    })
  }, [])

  function handleSave() {
    setSaving(true)
    // Simulated save for now - will integrate with backend later
    setTimeout(() => {
      setSaving(false)
      setLastSaved(new Date())
    }, 500)
  }

  function handleExport() {
    const html = generateHtml(page.tree)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${page.slug}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleWidgetDragStart(e: React.DragEvent, type: string) {
    e.dataTransfer.setData('application/metaspy-widget', type)
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
        .builder-center { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
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
      `}</style>

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
            >
              {d.icon} {d.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => setZoom(z => Math.max(0.25, z - 0.1))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}
          >
            −
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 36, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => Math.min(2, z + 0.1))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}
          >
            +
          </button>
        </div>

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
      </div>

      <div className="builder-body">
        <div className="builder-left">
          <div className="builder-tabs">
            {(leftTab === 'tree' || leftTab === 'widgets') && (
              <>
                <button className={`builder-tab ${leftTab === 'tree' ? 'active' : ''}`} onClick={() => setLeftTab('tree')}>
                  Arvore
                </button>
                <button className={`builder-tab ${leftTab === 'widgets' ? 'active' : ''}`} onClick={() => setLeftTab('widgets')}>
                  Widgets
                </button>
              </>
            )}
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
              />
            )}

            {leftTab === 'widgets' && (
              <div>
                <div className="builder-search">
                  <input
                    placeholder="Buscar widget..."
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                  />
                </div>
                {WIDGET_CATEGORIES.map(cat => {
                  const items = searchFilter
                    ? cat.items.filter(i => i.label.toLowerCase().includes(searchFilter.toLowerCase()))
                    : cat.items
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
          </div>
        </div>

        <div className="builder-center">
          <BuilderCanvas
            tree={page.tree}
            selectedId={selectedId}
            onSelect={handleSelect}
            onDropWidget={handleDropWidget}
            onMoveNode={handleMove}
            onUpdateNode={handleUpdateNode}
            zoom={zoom}
            deviceWidth={currentDevice.width}
          />
        </div>

        <div className="builder-right">
          <PropertyInspector
            node={selectedNode}
            onChange={handleUpdateNode}
          />
        </div>
      </div>
    </div>
  )
}

function generateHtml(tree: DocumentNode): string {
  function renderNode(node: DocumentNode): string {
    const css = stylesToCss(node.styles, node.layoutMode)
    const styleAttr = css ? ` style="${css}"` : ''

    switch (node.type) {
      case 'page':
        return `<div${styleAttr}>\n${node.children.map(renderNode).join('\n')}\n</div>`
      case 'section':
        return `<section${styleAttr}>\n${node.children.map(renderNode).join('\n')}\n</section>`
      case 'container':
      case 'row':
      case 'column':
        return `<div${styleAttr}>\n${node.children.map(renderNode).join('\n')}\n</div>`
      case 'heading': {
        const level = node.props.level || 'h2'
        return `<${level}${styleAttr}>${node.props.text || ''}</${level}>`
      }
      case 'text':
        return `<p${styleAttr}>${node.props.text || ''}</p>`
      case 'button':
        return `<a href="${node.props.link || '#'}" target="${node.props.target || '_self'}"${styleAttr}>${node.props.text || ''}</a>`
      case 'image':
        return `<img src="${node.props.src || ''}" alt="${node.props.alt || ''}"${styleAttr} />`
      case 'divider':
        return `<hr${styleAttr} />`
      default:
        return `<div${styleAttr}>${node.children.map(renderNode).join('\n')}</div>`
    }
  }

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
  </style>
</head>
<body>
${renderNode(tree)}
</body>
</html>`
}
