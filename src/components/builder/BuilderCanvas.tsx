import { useRef, useState, useCallback, DragEvent } from 'react'
import {
  DocumentNode, stylesToCss, hoverStyleToCss, scrollAnimationToCss,
  SCROLL_ANIMATION_KEYFRAMES, nodeTypeLabel,
} from './documentModel'

interface Props {
  tree: DocumentNode
  selectedId: string | null
  onSelect: (id: string) => void
  onDropWidget: (type: string, parentId: string, index?: number) => void
  onDropComponent?: (node: DocumentNode, parentId: string, index?: number) => void
  onMoveNode: (nodeId: string, newParentId: string, newIndex: number) => void
  onUpdateNode: (id: string, changes: Partial<DocumentNode>) => void
  zoom: number
  deviceWidth: number
  previewMode: boolean
}

export default function BuilderCanvas({ tree, selectedId, onSelect, onDropWidget, onMoveNode, zoom, deviceWidth, previewMode }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState<{ id: string; position: 'before' | 'after' | 'inside' } | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const handleDragOver = useCallback((e: DragEvent, nodeId: string) => {
    e.preventDefault(); e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top; const h = rect.height
    let position: 'before' | 'after' | 'inside' = 'inside'
    if (y < h * 0.25) position = 'before'
    else if (y > h * 0.75) position = 'after'
    setDragOver({ id: nodeId, position })
  }, [])

  const handleDrop = useCallback((e: DragEvent, targetId: string) => {
    e.preventDefault(); e.stopPropagation()
    const widgetType = e.dataTransfer.getData('application/metaspy-widget')
    const sourceId = e.dataTransfer.getData('text/plain')
    const compJson = e.dataTransfer.getData('application/metaspy-component')
    if (widgetType) onDropWidget(widgetType, targetId, 0)
    else if (compJson) {
      try {
        const compNode = JSON.parse(compJson) as DocumentNode
        onDropComponent?.(compNode, targetId, 0)
      } catch {}
    }
    else if (sourceId && sourceId !== targetId) onMoveNode(sourceId, targetId, 0)
    setDragOver(null)
  }, [onDropWidget, onDropComponent, onMoveNode])

  function renderNode(node: DocumentNode, depth: number = 0): JSX.Element {
    const isSelected = node.id === selectedId
    const isDropTarget = dragOver?.id === node.id
    const isFreehand = node.layoutMode === 'freehand'
    const css = stylesToCss(node.styles, node.layoutMode)
    const hoverCss = hoverStyleToCss(node.hoverStyle)
    const animCss = scrollAnimationToCss(node.scrollAnimation)
    const isHovered = hoveredId === node.id && !isSelected

    const baseStyle: React.CSSProperties = {
      position: isFreehand ? 'absolute' : 'relative',
      ...parseCss(css),
      outline: isSelected ? '2px solid #7c3aed' : depth > 0 && !previewMode ? '1px solid rgba(128,128,128,0.1)' : 'none',
      outlineOffset: isSelected ? 1 : 0,
      cursor: previewMode ? 'default' : 'pointer',
      minHeight: depth > 0 && !previewMode ? 20 : undefined,
      transition: isHovered && hoverCss ? 'all 0.2s' : isSelected ? 'outline 0.1s' : 'none',
    }

    if (hoverCss && isHovered) {
      hoverCss.split(';').filter(Boolean).forEach(rule => {
        const [prop, ...vals] = rule.split(':')
        if (prop && vals.length) (baseStyle as any)[prop.trim()] = vals.join(':').trim()
      })
    }

    if (depth > 0 && !previewMode && !node.styles.paddingTop) baseStyle.padding = '8px'

    const isWidget = ['heading', 'text', 'image', 'button', 'divider', 'icon', 'video'].includes(node.type)

    return (
      <div
        key={node.id}
        data-node-id={node.id}
        style={{
          ...baseStyle,
          animation: previewMode && animCss ? `${node.scrollAnimation!.type} ${node.scrollAnimation!.duration}ms ${node.scrollAnimation!.easing} ${node.scrollAnimation!.delay}ms both` : undefined,
        }}
        onClick={e => { e.stopPropagation(); if (!previewMode) onSelect(node.id) }}
        onMouseEnter={() => setHoveredId(node.id)}
        onMouseLeave={() => setHoveredId(null)}
        onDragOver={previewMode ? undefined : e => handleDragOver(e, node.id)}
        onDragLeave={() => setDragOver(null)}
        onDrop={previewMode ? undefined : e => handleDrop(e, node.id)}
        className={`builder-canvas-node${isDropTarget ? ' drop-target-' + dragOver?.position : ''}${isSelected ? ' selected' : ''}`}
      >
        {!previewMode && isSelected && (
          <div style={{ position: 'absolute', top: -20, left: 0, background: '#7c3aed', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: '4px 4px 0 0', zIndex: 999, whiteSpace: 'nowrap' }}>
            {nodeTypeLabel(node.type)} — {node.name}
          </div>
        )}
        {renderWidgetPreview(node, previewMode)}
        {!isWidget && node.children.length === 0 && !previewMode && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: 'rgba(128,128,128,0.4)' }}>
            {nodeTypeLabel(node.type)} — solte elementos aqui
          </div>
        )}
        {!isWidget && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <div
      ref={canvasRef}
      style={{
        flex: 1, overflow: 'auto', background: '#f0f0f0',
        display: 'flex', justifyContent: 'center', padding: previewMode ? 0 : '40px 0',
      }}
      onClick={() => { if (!previewMode) onSelect(tree.id) }}
    >
      <style>{SCROLL_ANIMATION_KEYFRAMES}{`
        .builder-canvas-node.drop-target-before { outline: 2px dashed #7c3aed !important; border-top: 3px solid #7c3aed !important; }
        .builder-canvas-node.drop-target-after { outline: 2px dashed #7c3aed !important; border-bottom: 3px solid #7c3aed !important; }
        .builder-canvas-node.drop-target-inside { outline: 2px dashed #7c3aed !important; background: rgba(124,58,237,0.04) !important; }
        .builder-canvas-node:hover { outline: ${previewMode ? 'none' : '1px solid rgba(124,58,237,0.3)'}; }
      `}</style>
      <div style={{
        width: deviceWidth === 1440 && !previewMode ? deviceWidth : previewMode ? '100%' : deviceWidth,
        minHeight: previewMode ? '100vh' : 600,
        background: '#fff',
        boxShadow: previewMode ? 'none' : '0 1px 10px rgba(0,0,0,0.08)',
        transform: `scale(${previewMode ? 1 : zoom})`,
        transformOrigin: 'top center',
        transition: 'transform 0.15s',
        borderRadius: deviceWidth < 1440 && !previewMode ? 12 : 0,
        overflow: 'hidden',
      }}>
        {tree.children.map(child => renderNode(child, 1))}
        {tree.children.length === 0 && !previewMode && (
          <div style={{ padding: 60, textAlign: 'center', fontSize: 14, color: '#999' }}>
            Arraste elementos do painel "Widgets" para comecar a construir
          </div>
        )}
      </div>
    </div>
  )
}

function renderWidgetPreview(node: DocumentNode, previewMode: boolean): JSX.Element | null {
  const w: React.CSSProperties = { pointerEvents: previewMode ? 'auto' : 'none' }
  switch (node.type) {
    case 'heading': {
      const level = node.props.level || 'h2'
      const sizes: Record<string, number> = { h1: 48, h2: 32, h3: 24, h4: 18 }
      return <div style={{ ...w, fontSize: sizes[level] || 32, fontWeight: 700, fontFamily: node.styles.fontFamily || 'Inter, sans-serif', color: node.styles.color || '#111', lineHeight: 1.2, margin: 0 }}>{node.props.text || ''}</div>
    }
    case 'text':
      return <div style={{ ...w, fontSize: 16, fontFamily: node.styles.fontFamily || 'Inter, sans-serif', color: node.styles.color || '#333', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: node.props.html || '' }} />
    case 'button':
      return <div style={{ ...w, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14, backgroundColor: '#7c3aed', color: '#fff', border: 'none', cursor: previewMode ? 'pointer' : 'default', textDecoration: 'none' }}>{node.props.text || ''}</div>
    case 'image':
      return <div style={{ ...w, width: '100%', minHeight: 100, background: node.props.src ? `url(${node.props.src}) center/cover no-repeat` : '#f0f0f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#999' }}>{node.props.src ? '' : 'Imagem'}</div>
    case 'divider':
      return <hr style={{ ...w, border: 'none', height: 1, backgroundColor: '#e0e0e0', margin: 0 }} />
    default:
      return null
  }
}

function parseCss(css: string): Record<string, string> {
  if (!css) return {}
  const obj: Record<string, string> = {}
  css.split(';').filter(Boolean).forEach(rule => {
    const [prop, ...vals] = rule.split(':')
    if (prop && vals.length) obj[prop.trim()] = vals.join(':').trim()
  })
  return obj
}
