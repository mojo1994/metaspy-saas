import { useRef, useState, useCallback, memo, DragEvent } from 'react'
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

export default function BuilderCanvas({ tree, selectedId, onSelect, onDropWidget, onDropComponent, onMoveNode, zoom, deviceWidth, previewMode }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState<{ id: string; position: 'before' | 'after' | 'inside' } | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

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
        {tree.children.map(child => (
          <CanvasNode key={child.id} node={child} selectedId={selectedId} depth={1}
            onSelect={onSelect} onDropWidget={onDropWidget} onDropComponent={onDropComponent}
            onMoveNode={onMoveNode} previewMode={previewMode}
            dragOver={dragOver} hoveredId={hoveredId}
            setHoveredId={setHoveredId} setDragOver={setDragOver} />
        ))}
        {tree.children.length === 0 && !previewMode && (
          <div style={{ padding: 60, textAlign: 'center', fontSize: 14, color: '#999' }}>
            Arraste elementos do painel "Widgets" para comecar a construir
          </div>
        )}
      </div>
    </div>
  )
}

const CanvasNode = memo(function CanvasNode({ node, selectedId, depth, onSelect, onDropWidget, onDropComponent, onMoveNode, previewMode, dragOver, hoveredId, setHoveredId, setDragOver }: {
  node: DocumentNode; selectedId: string | null; depth: number;
  onSelect: (id: string) => void;
  onDropWidget: (type: string, parentId: string, index?: number) => void;
  onDropComponent?: (node: DocumentNode, parentId: string, index?: number) => void;
  onMoveNode: (nodeId: string, newParentId: string, newIndex: number) => void;
  previewMode: boolean;
  dragOver: { id: string; position: 'before' | 'after' | 'inside' } | null;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  setDragOver: (d: { id: string; position: 'before' | 'after' | 'inside' } | null) => void;
}) {
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

  const isWidget = ['heading', 'text', 'image', 'button', 'divider', 'icon', 'video', 'list', 'form', 'hero', 'pricing', 'faq', 'testimonial', 'countdown', 'tabs', 'modal', 'embed', 'nav'].includes(node.type)

  function handleDragOver(e: DragEvent) {
    e.preventDefault(); e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top; const h = rect.height
    let position: 'before' | 'after' | 'inside' = 'inside'
    if (y < h * 0.25) position = 'before'
    else if (y > h * 0.75) position = 'after'
    setDragOver({ id: node.id, position })
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault(); e.stopPropagation()
    const widgetType = e.dataTransfer.getData('application/metaspy-widget')
    const sourceId = e.dataTransfer.getData('text/plain')
    const compJson = e.dataTransfer.getData('application/metaspy-component')
    if (widgetType) onDropWidget(widgetType, node.id, 0)
    else if (compJson) {
      try {
        const compNode = JSON.parse(compJson) as DocumentNode
        onDropComponent?.(compNode, node.id, 0)
      } catch {}
    } else if (sourceId && sourceId !== node.id) onMoveNode(sourceId, node.id, 0)
    setDragOver(null)
  }

  return (
    <div
      data-node-id={node.id}
      style={{
        ...baseStyle,
        animation: previewMode && animCss ? `${node.scrollAnimation!.type} ${node.scrollAnimation!.duration}ms ${node.scrollAnimation!.easing} ${node.scrollAnimation!.delay}ms both` : undefined,
      }}
      onClick={e => { e.stopPropagation(); if (!previewMode) onSelect(node.id) }}
      onMouseEnter={() => setHoveredId(node.id)}
      onMouseLeave={() => setHoveredId(null)}
      onDragOver={previewMode ? undefined : handleDragOver}
      onDragLeave={() => setDragOver(null)}
      onDrop={previewMode ? undefined : handleDrop}
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
      {!isWidget && node.children.map(child => (
        <CanvasNode key={child.id} node={child} selectedId={selectedId} depth={depth + 1}
          onSelect={onSelect} onDropWidget={onDropWidget} onDropComponent={onDropComponent}
          onMoveNode={onMoveNode} previewMode={previewMode}
          dragOver={dragOver} hoveredId={hoveredId}
          setHoveredId={setHoveredId} setDragOver={setDragOver} />
      ))}
    </div>
  )
})

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
    case 'icon':
      return <div style={{ ...w, fontSize: node.props.size || 32, color: node.styles.color || '#7c3aed', textAlign: 'center' }}>✦</div>
    case 'video': {
      const src = node.props.src
      if (src && node.props.type === 'youtube') {
        const embedUrl = src.includes('watch?v=') ? src.replace('watch?v=', 'embed/') : src.includes('youtu.be/') ? src.replace('youtu.be/', 'youtube.com/embed/') : src
        return <div style={{ ...w, width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#666' }}>{src ? <iframe src={embedUrl} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }} title="Video" /> : 'Video'}</div>
      }
      return <div style={{ ...w, width: '100%', aspectRatio: '16/9', background: '#e0e0e0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#999' }}>Video</div>
    }
    case 'list': {
      const items: string[] = node.props.items || []
      const tag = node.props.style === 'ordered' ? 'ol' : 'ul'
      const Tag = tag as keyof JSX.IntrinsicElements
      return <Tag style={{ ...w, margin: 0, paddingLeft: 24, fontSize: 16, color: node.styles.color || '#333' }}>{items.map((item: string, i: number) => <li key={i}>{item}</li>)}</Tag>
    }
    case 'form':
      return <div style={{ ...w, display: 'flex', flexDirection: 'column', gap: 12, padding: 24, background: '#f9fafb', borderRadius: 8 }}>
        {(node.props.fields || []).map((f: any, i: number) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>{f.label}{f.required ? ' *' : ''}</label>
            <input type={f.type || 'text'} placeholder={f.placeholder || ''} disabled style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, background: '#fff' }} />
          </div>
        ))}
        <button disabled style={{ padding: '10px 20px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 14, cursor: 'default' }}>{node.props.submitText || 'Enviar'}</button>
      </div>
    case 'nav':
      return <div style={{ ...w, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <span style={{ fontWeight: 700, fontSize: 18 }}>{node.props.logo || 'Logo'}</span>
        <div style={{ display: 'flex', gap: 16 }}>{(node.props.links || []).map((l: any, i: number) => <span key={i} style={{ fontSize: 14, color: '#666', cursor: 'default' }}>{l.label}</span>)}</div>
      </div>
    case 'hero':
      return <div style={{ ...w, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16, padding: '100px 24px', background: node.styles.backgroundColor || '#f0f0ff' }}>
        <h1 style={{ fontSize: 48, fontWeight: 800, margin: 0, color: '#111' }}>{node.props.title || 'Titulo'}</h1>
        <p style={{ fontSize: 18, color: '#666', maxWidth: 600, margin: 0 }}>{node.props.subtitle || ''}</p>
        {node.props.ctaText && <div style={{ padding: '12px 28px', background: '#7c3aed', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 16 }}>{node.props.ctaText}</div>}
      </div>
    case 'faq':
      return <div style={{ ...w, display: 'flex', flexDirection: 'column', gap: 12, padding: '40px 24px', maxWidth: 800, margin: '0 auto' }}>
        {(node.props.items || []).map((item: any, i: number) => (
          <div key={i} style={{ padding: '16px 20px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{item.question || ''}</div>
            <div style={{ fontSize: 14, color: '#666' }}>{item.answer || ''}</div>
          </div>
        ))}
      </div>
    case 'testimonial':
      return <div style={{ ...w, padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, maxWidth: 600 }}>
        <div style={{ fontSize: 16, fontStyle: 'italic', color: '#555', lineHeight: 1.6 }}>"{node.props.quote || ''}"</div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{node.props.author || ''}</div>
        {node.props.role && <div style={{ fontSize: 12, color: '#999' }}>{node.props.role}</div>}
      </div>
    case 'pricing':
      return <div style={{ ...w, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', padding: '60px 24px' }}>
        {(node.props.plans || []).map((plan: any, i: number) => (
          <div key={i} style={{ flex: 1, minWidth: 240, maxWidth: 300, padding: 24, background: plan.highlighted ? '#7c3aed' : '#fff', borderRadius: 12, boxShadow: plan.highlighted ? '0 8px 30px rgba(124,58,237,0.3)' : '0 2px 12px rgba(0,0,0,0.08)', color: plan.highlighted ? '#fff' : '#111' }}>
            <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>{plan.name}</div>
            <div style={{ fontSize: 36, fontWeight: 800 }}>{plan.price}<span style={{ fontSize: 14, fontWeight: 400, opacity: 0.7 }}>{plan.period}</span></div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0', fontSize: 14, lineHeight: 2 }}>{(plan.features || []).map((f: string, j: number) => <li key={j}>✓ {f}</li>)}</ul>
            <div style={{ padding: '10px 20px', background: plan.highlighted ? '#fff' : '#7c3aed', color: plan.highlighted ? '#7c3aed' : '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, textAlign: 'center', cursor: 'default' }}>{plan.cta}</div>
          </div>
        ))}
      </div>
    case 'countdown': {
      const target = node.props.targetDate || new Date(Date.now() + 7 * 86400000).toISOString()
      const remaining = Math.max(0, new Date(target).getTime() - Date.now())
      const days = Math.floor(remaining / 86400000)
      const hours = Math.floor((remaining % 86400000) / 3600000)
      return <div style={{ ...w, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 32 }}>
        {node.props.label && <div style={{ fontSize: 14, color: '#666' }}>{node.props.label}</div>}
        <div style={{ display: 'flex', gap: 16, fontSize: 24, fontWeight: 700 }}>
          <div style={{ textAlign: 'center' }}><div>{days}d</div>{node.props.showLabels && <div style={{ fontSize: 11, fontWeight: 400, color: '#999' }}>Dias</div>}</div>
          <div style={{ textAlign: 'center' }}><div>{hours}h</div>{node.props.showLabels && <div style={{ fontSize: 11, fontWeight: 400, color: '#999' }}>Horas</div>}</div>
        </div>
      </div>
    }
    case 'embed':
      return <div style={{ ...w, width: '100%', minHeight: 200, background: '#f0f0f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#999' }}>
        {node.props.code ? 'Embed' : 'Cole o codigo de incorporacao'}
      </div>
    case 'tabs':
      return <div style={{ ...w, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb' }}>
          {(node.props.tabs || []).map((tab: any, i: number) => (
            <div key={i} style={{ padding: '10px 20px', fontSize: 14, fontWeight: i === (node.props.activeTab || 0) ? 600 : 400, borderBottom: i === (node.props.activeTab || 0) ? '2px solid #7c3aed' : '2px solid transparent', color: i === (node.props.activeTab || 0) ? '#7c3aed' : '#666', marginBottom: -2, cursor: 'default' }}>{tab.label}</div>
          ))}
        </div>
        <div style={{ padding: 20, fontSize: 14, color: '#333' }}>{(node.props.tabs || [])[(node.props.activeTab || 0)]?.content || ''}</div>
      </div>
    case 'modal':
      return <div style={{ ...w, padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxWidth: 500, position: 'relative' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{node.props.title || ''}</div>
        <div style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>{node.props.content || ''}</div>
        <div style={{ padding: '8px 20px', background: '#7c3aed', color: '#fff', borderRadius: 6, fontWeight: 600, fontSize: 13, display: 'inline-block' }}>{node.props.triggerText || 'Abrir'}</div>
      </div>
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
