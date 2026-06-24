import { useState } from 'react'
import { DocumentNode, nodeTypeLabel } from './documentModel'
import { WidgetIcon } from './SymbolIcons'

interface Props {
  tree: DocumentNode
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onMove: (nodeId: string, newParentId: string, newIndex: number) => void
  onDuplicate?: (id: string) => void
  onCopy?: (id: string) => void
  onPaste?: () => void
}

export default function ElementTree({ tree, selectedId, onSelect, onDelete, onRename, onMove, onDuplicate, onCopy, onPaste }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startEdit(id: string, name: string) {
    setEditingId(id)
    setEditName(name)
  }

  function commitEdit(id: string) {
    if (editName.trim()) onRename(id, editName.trim())
    setEditingId(null)
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleContextMenu(e: React.MouseEvent, nodeId: string) {
    e.preventDefault()
    e.stopPropagation()
    onSelect(nodeId)
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const menu = document.createElement('div')
    menu.className = 'builder-context-menu'
    menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;z-index:10000;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:4px;min-width:160px;box-shadow:0 8px 30px rgba(0,0,0,0.2);font-size:12px;`
    const items = [
      { label: 'Duplicar', action: () => onDuplicate?.(nodeId) },
      { label: 'Copiar', action: () => onCopy?.(nodeId) },
      { label: 'Colar', action: () => onPaste?.() },
      { label: 'Remover', action: () => onDelete(nodeId), danger: true },
    ]
    items.forEach(item => {
      const btn = document.createElement('button')
      btn.textContent = item.label
      btn.style.cssText = `display:block;width:100%;padding:6px 12px;border:none;background:none;color:${(item as any).danger ? '#dc2626' : 'var(--text-primary)'};border-radius:4px;cursor:pointer;text-align:left;`
      btn.onmouseenter = () => btn.style.background = 'rgba(124,58,237,0.1)'
      btn.onmouseleave = () => btn.style.background = 'none'
      btn.onclick = () => { item.action(); menu.remove() }
      menu.appendChild(btn)
    })
    document.body.appendChild(menu)
    const close = (ev: MouseEvent) => { if (!menu.contains(ev.target as Node)) { menu.remove(); document.removeEventListener('click', close) } }
    setTimeout(() => document.addEventListener('click', close), 0)
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(id)
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData('text/plain')
    if (sourceId && sourceId !== targetId) {
      onMove(sourceId, targetId, 0)
    }
    setDragOverId(null)
  }

  function renderNode(node: DocumentNode, depth: number = 0): JSX.Element {
    const isSelected = node.id === selectedId
    const isCollapsed = collapsed.has(node.id)
    const hasChildren = node.children.length > 0
    const isDragOver = node.id === dragOverId

    const allowedTypes = ['page', 'section', 'container', 'row', 'column']
    const isContainer = allowedTypes.includes(node.type)

    return (
      <div key={node.id}>
        <div
          className={`builder-tree-node${isSelected ? ' selected' : ''}${isDragOver ? ' drag-over' : ''}`}
          style={{
            paddingLeft: 12 + depth * 16,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: `4px 8px 4px ${12 + depth * 16}px`,
            cursor: 'pointer',
            borderRadius: 4,
            background: isSelected ? 'var(--purple-400)' : isDragOver ? 'rgba(124,58,237,0.15)' : 'transparent',
            color: isSelected ? '#fff' : 'var(--text-primary)',
            fontSize: 12,
            userSelect: 'none',
            transition: 'background 0.15s',
          }}
          onClick={() => onSelect(node.id)}
          onContextMenu={e => handleContextMenu(e, node.id)}
          draggable={node.type !== 'page'}
          onDragStart={e => handleDragStart(e, node.id)}
          onDragOver={e => handleDragOver(e, node.id)}
          onDragLeave={() => setDragOverId(null)}
          onDrop={e => handleDrop(e, node.id)}
        >
          {hasChildren && (
            <span
              onClick={e => { e.stopPropagation(); toggleCollapse(node.id) }}
              style={{
                width: 16,
                textAlign: 'center',
                cursor: 'pointer',
                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s',
                fontSize: 10,
                opacity: 0.6,
              }}
            >
              ▼
            </span>
          )}
          {!hasChildren && <span style={{ width: 16 }} />}

          <WidgetIcon type={node.type} size={12} />

          {editingId === node.id ? (
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={() => commitEdit(node.id)}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(node.id); if (e.key === 'Escape') setEditingId(null) }}
              autoFocus
              style={{
                flex: 1,
                border: 'none',
                background: 'rgba(0,0,0,0.1)',
                color: 'inherit',
                fontSize: 12,
                padding: '1px 4px',
                borderRadius: 2,
                outline: 'none',
              }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span
              style={{ flex: 1 }}
              onDoubleClick={e => { e.stopPropagation(); startEdit(node.id, node.name) }}
            >
              {node.name}
            </span>
          )}

          <span style={{ fontSize: 10, opacity: 0.5, marginRight: 4, whiteSpace: 'nowrap' }}>
            {nodeTypeLabel(node.type)}
          </span>

          {!node.visible && (
            <span style={{ fontSize: 10, opacity: 0.4 }}>⊙</span>
          )}
          {node.locked && (
            <span style={{ fontSize: 10, opacity: 0.4 }}>⊠</span>
          )}

          {node.id !== tree.id && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(node.id) }}
              style={{
                background: 'none',
                border: 'none',
                color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 11,
                padding: '0 4px',
                opacity: 0,
                transition: 'opacity 0.15s',
              }}
              className="builder-tree-delete"
              title="Remover"
            >
              ✕
            </button>
          )}
        </div>
        {hasChildren && !isCollapsed && (
          <div style={{ borderLeft: depth < 10 ? '1px solid rgba(128,128,128,0.15)' : 'none', marginLeft: 8 }}>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      <style>{`
        .builder-tree-node:hover .builder-tree-delete { opacity: 1 !important; }
        .builder-tree-node.drag-over { outline: 2px dashed var(--purple-400); outline-offset: -2px; }
      `}</style>
      {renderNode(tree)}
    </div>
  )
}
