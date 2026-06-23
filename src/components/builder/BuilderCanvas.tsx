import { useRef, useState, useCallback, DragEvent } from 'react'
import { DocumentNode, stylesToCss, nodeTypeLabel } from './documentModel'

interface Props {
  tree: DocumentNode
  selectedId: string | null
  onSelect: (id: string) => void
  onDropWidget: (type: string, parentId: string, index?: number) => void
  onMoveNode: (nodeId: string, newParentId: string, newIndex: number) => void
  onUpdateNode: (id: string, changes: Partial<DocumentNode>) => void
  zoom: number
  deviceWidth: number
}

export default function BuilderCanvas({ tree, selectedId, onSelect, onDropWidget, onMoveNode, onUpdateNode, zoom, deviceWidth }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState<{ id: string; position: 'before' | 'after' | 'inside' } | null>(null)

  const handleDragOver = useCallback((e: DragEvent, nodeId: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    const h = rect.height
    let position: 'before' | 'after' | 'inside' = 'inside'
    if (y < h * 0.25) position = 'before'
    else if (y > h * 0.75) position = 'after'
    setDragOver({ id: nodeId, position })
  }, [])

  const handleDrop = useCallback((e: DragEvent, targetId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const widgetType = e.dataTransfer.getData('application/metaspy-widget')
    const sourceId = e.dataTransfer.getData('text/plain')
    if (widgetType) {
      onDropWidget(widgetType, targetId, 0)
    } else if (sourceId && sourceId !== targetId) {
      onMoveNode(sourceId, targetId, 0)
    }
    setDragOver(null)
  }, [onDropWidget, onMoveNode])

  function renderNode(node: DocumentNode, depth: number = 0): JSX.Element {
    const isSelected = node.id === selectedId
    const isDropTarget = dragOver?.id === node.id
    const isFreehand = node.layoutMode === 'freehand'
    const css = stylesToCss(node.styles, node.layoutMode)

    const baseStyle: React.CSSProperties = {
      position: isFreehand ? 'absolute' : 'relative',
      ...parseCssToObject(css),
      outline: isSelected ? '2px solid #7c3aed' : depth > 0 ? '1px solid rgba(128,128,128,0.1)' : 'none',
      outlineOffset: isSelected ? 1 : 0,
      cursor: 'pointer',
      minHeight: depth > 0 ? 20 : undefined,
      transition: 'outline 0.1s',
    }

    if (depth > 0) {
      baseStyle.padding = node.styles.paddingTop ? undefined : '8px'
    }

    const isWidget = ['heading', 'text', 'image', 'button', 'divider', 'icon', 'video'].includes(node.type)

    return (
      <div
        key={node.id}
        data-node-id={node.id}
        style={baseStyle}
        onClick={e => { e.stopPropagation(); onSelect(node.id) }}
        onDragOver={e => handleDragOver(e, node.id)}
        onDragLeave={() => setDragOver(null)}
        onDrop={e => handleDrop(e, node.id)}
        className={`builder-canvas-node${isDropTarget ? ' drop-target-' + dragOver?.position : ''}${isSelected ? ' selected' : ''}`}
      >
        {isWidget && (
          <div style={renderWidgetContent(node)} />
        )}
        {!isWidget && node.children.length === 0 && depth > 0 && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: 'rgba(128,128,128,0.4)' }}>
            {nodeTypeLabel(node.type)} — solte elementos aqui
          </div>
        )}
        {!isWidget && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  function renderWidgetContent(node: DocumentNode): React.CSSProperties {
    switch (node.type) {
      case 'heading': {
        const level = node.props.level || 'h2'
        const Tag = level as keyof JSX.IntrinsicElements
        const fontSizeMap: Record<string, number> = { h1: 48, h2: 32, h3: 24, h4: 18 }
        return {
          fontSize: fontSizeMap[level] || 32,
          fontWeight: 700,
          fontFamily: node.styles.fontFamily || 'Inter, sans-serif',
          color: node.styles.color || '#111',
          lineHeight: 1.2,
          margin: 0,
        } as any
      }
      case 'text':
        return {
          fontSize: 16,
          fontFamily: node.styles.fontFamily || 'Inter, sans-serif',
          color: node.styles.color || '#333',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        } as any
      case 'button':
        return {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 20px',
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 14,
          cursor: 'pointer',
          backgroundColor: '#7c3aed',
          color: '#fff',
          border: 'none',
        } as any
      case 'image':
        return {
          width: '100%',
          minHeight: 100,
          background: node.props.src ? `url(${node.props.src}) center/cover no-repeat` : '#f0f0f0',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: '#999',
        } as any
      default:
        return {} as any
    }
  }

  return (
    <div
      ref={canvasRef}
      style={{
        flex: 1,
        overflow: 'auto',
        background: '#f5f5f5',
        display: 'flex',
        justifyContent: 'center',
        padding: '40px 0',
      }}
      onClick={() => onSelect(tree.id)}
    >
      <style>{`
        .builder-canvas-node.drop-target-before { outline: 2px dashed #7c3aed !important; outline-offset: -2px; border-top: 3px solid #7c3aed !important; }
        .builder-canvas-node.drop-target-after { outline: 2px dashed #7c3aed !important; outline-offset: -2px; border-bottom: 3px solid #7c3aed !important; }
        .builder-canvas-node.drop-target-inside { outline: 2px dashed #7c3aed !important; outline-offset: -2px; background: rgba(124,58,237,0.04) !important; }
        .builder-canvas-node:hover { outline: 1px solid rgba(124,58,237,0.3); }
      `}</style>
      <div
        style={{
          width: deviceWidth,
          minHeight: 600,
          background: '#fff',
          boxShadow: '0 1px 10px rgba(0,0,0,0.08)',
          transform: `scale(${zoom})`,
          transformOrigin: 'top center',
          transition: 'transform 0.15s',
          borderRadius: deviceWidth < 1440 ? 12 : 0,
        }}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
        onDrop={e => handleDrop(e, tree.id)}
      >
        {tree.children.map(child => renderNode(child, 1))}
        {tree.children.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', fontSize: 14, color: '#999' }}>
            Arraste elementos do painel "Widgets" para comecar a construir
          </div>
        )}
      </div>
    </div>
  )
}

function parseCssToObject(css: string): Record<string, string> {
  if (!css) return {}
  const obj: Record<string, string> = {}
  css.split(';').filter(Boolean).forEach(rule => {
    const [prop, ...vals] = rule.split(':')
    if (prop && vals.length) {
      obj[prop.trim()] = vals.join(':').trim()
    }
  })
  return obj
}
