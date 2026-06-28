import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useQuizStore, type FreehandWidgetData } from '../../stores/quizStore'
import { Type, Image, Square, Hash, Minus, MousePointer, Hash as CounterIcon, Clock, BarChart3 } from 'lucide-react'

const WIDGET_ICONS: Record<string, React.ReactNode> = {
  text: <Type size={14} />,
  image: <Image size={14} />,
  shape: <Square size={14} />,
  icon: <Hash size={14} />,
  divider: <Minus size={14} />,
  button: <MousePointer size={14} />,
  counter: <CounterIcon size={14} />,
  timer: <Clock size={14} />,
  progress_bar: <BarChart3 size={14} />,
}

export const WIDGET_TYPES: { type: FreehandWidgetData['type']; label: string; defaultSize: { width: number; height: number } }[] = [
  { type: 'text', label: 'Texto', defaultSize: { width: 200, height: 40 } },
  { type: 'image', label: 'Imagem', defaultSize: { width: 150, height: 150 } },
  { type: 'shape', label: 'Forma', defaultSize: { width: 80, height: 80 } },
  { type: 'icon', label: 'Icone', defaultSize: { width: 40, height: 40 } },
  { type: 'divider', label: 'Divisor', defaultSize: { width: 200, height: 2 } },
  { type: 'button', label: 'Botao', defaultSize: { width: 120, height: 36 } },
  { type: 'counter', label: 'Contador', defaultSize: { width: 80, height: 40 } },
  { type: 'timer', label: 'Temporizador', defaultSize: { width: 80, height: 40 } },
  { type: 'progress_bar', label: 'Barra progresso', defaultSize: { width: 200, height: 16 } },
]

function ResizeHandles({ onResize }: { onResize: (dx: number, dy: number, corner: string) => void }) {
  const corners = ['nw', 'ne', 'sw', 'se']
  return (
    <>
      {corners.map(corner => (
        <div
          key={corner}
          className={`fw-resize fw-resize-${corner}`}
          onMouseDown={e => {
            e.preventDefault(); e.stopPropagation()
            const startX = e.clientX; const startY = e.clientY
            const onMove = (ev: MouseEvent) => {
              onResize(ev.clientX - startX, ev.clientY - startY, corner)
            }
            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
            document.addEventListener('mousemove', onMove)
            document.addEventListener('mouseup', onUp)
          }}
        />
      ))}
    </>
  )
}

function WidgetContent({ widget }: { widget: FreehandWidgetData }) {
  const s = widget.styles
  const style: React.CSSProperties = {
    fontFamily: s.typography?.fontFamily,
    fontSize: s.typography?.fontSize,
    fontWeight: s.typography?.fontWeight,
    textAlign: s.typography?.textAlign,
    color: s.typography?.textColor,
    background: s.background?.bgColor,
    borderRadius: s.boxModel?.borderRadius,
  }

  switch (widget.type) {
    case 'text':
      return (
        <div style={{ padding: 8, ...style, width: '100%', height: '100%', overflow: 'hidden', wordBreak: 'break-word' }}>
          {widget.content || 'Texto livre'}
        </div>
      )
    case 'image':
      return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: style.borderRadius }}>
          {widget.content ? (
            <img src={widget.content} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
          ) : (
            <Image size={24} opacity={0.3} />
          )}
        </div>
      )
    case 'shape':
      return (
        <div style={{
          width: '100%', height: '100%',
          borderRadius: widget.shapeType === 'circle' ? '50%' : widget.shapeType === 'triangle' ? '0' : style.borderRadius,
          background: s.background?.bgColor || 'rgba(168,85,247,0.15)',
          border: `1px solid ${s.color || 'rgba(168,85,247,0.3)'}`,
          clipPath: widget.shapeType === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : undefined,
        }} />
      )
    case 'icon':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color || 'var(--text-secondary)' }}>
          {WIDGET_ICONS[widget.content || 'text'] || <Hash size={20} />}
        </div>
      )
    case 'divider':
      return <div style={{ width: '100%', height: '100%', borderTop: `1px solid ${s.color || 'var(--border)'}` }} />
    case 'button':
      return (
        <div style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: s.background?.bgColor || 'var(--purple-600)', color: s.typography?.textColor || '#fff',
          borderRadius: style.borderRadius || 6, fontSize: style.fontSize || 12, cursor: 'pointer',
          fontFamily: style.fontFamily, fontWeight: style.fontWeight,
        }}>
          {widget.content || 'Botao'}
        </div>
      )
    case 'counter':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: style.fontSize || 13, color: s.typography?.textColor || 'var(--text-primary)', fontFamily: style.fontFamily, fontWeight: style.fontWeight }}>
          <span style={{ cursor: 'pointer', userSelect: 'none', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)', borderRadius: 4 }}>-</span>
          <span>0</span>
          <span style={{ cursor: 'pointer', userSelect: 'none', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)', borderRadius: 4 }}>+</span>
        </div>
      )
    case 'timer':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: style.fontSize || 14, color: s.typography?.textColor || 'var(--text-primary)', fontFamily: 'monospace', fontWeight: style.fontWeight }}>
          <Clock size={14} />
          <span>00:30</span>
        </div>
      )
    case 'progress_bar':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '100%', height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: '60%', height: '100%', background: s.background?.bgColor || 'var(--purple-500)', borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
        </div>
      )
  }
}

export default function FreehandWidgetRenderer() {
  const currentQuiz = useQuizStore(s => s.currentQuiz)
  const updateFreehandWidget = useQuizStore(s => s.updateFreehandWidget)
  const selectedFreehandId = useQuizStore(s => s.selectedFreehandId)
  const selectFreehandWidget = useQuizStore(s => s.selectFreehandWidget)
  const isPreview = useQuizStore(s => s.isPreview)
  const widgets = currentQuiz?.freehand || []
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  const onWidgetMouseDown = useCallback((e: React.MouseEvent, widget: FreehandWidgetData) => {
    if (isPreview || widget.locked) return
    selectFreehandWidget(widget.id)
    e.preventDefault()
    setDragging({
      id: widget.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: widget.position.x,
      origY: widget.position.y,
    })
  }, [isPreview, selectFreehandWidget])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragging.startX)
      const dy = (e.clientY - dragging.startY)
      updateFreehandWidget(dragging.id, {
        position: { x: dragging.origX + dx, y: dragging.origY + dy },
      })
    }
    const onUp = () => { setDragging(null) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [dragging, updateFreehandWidget])

  const onResize = useCallback((widgetId: string, widget: FreehandWidgetData) => {
    return (dx: number, dy: number, corner: string) => {
      let newW = widget.size.width
      let newH = widget.size.height
      let newX = widget.position.x
      let newY = widget.position.y
      if (corner.includes('e')) newW = Math.max(20, widget.size.width + dx)
      if (corner.includes('w')) { newW = Math.max(20, widget.size.width - dx); newX = widget.position.x + dx }
      if (corner.includes('s')) newH = Math.max(20, widget.size.height + dy)
      if (corner.includes('n')) { newH = Math.max(20, widget.size.height - dy); newY = widget.position.y + dy }
      updateFreehandWidget(widgetId, { size: { width: newW, height: newH }, position: { x: newX, y: newY } })
    }
  }, [updateFreehandWidget])

  if (isPreview || widgets.length === 0) return null

  return (
    <div className="fw-layer">
      {widgets
        .filter(w => w.visible)
        .sort((a, b) => a.zIndex - b.zIndex)
        .map(widget => {
          const isSelected = selectedFreehandId === widget.id
          return (
            <div
              key={widget.id}
              className={`fw-widget${isSelected ? ' fw-selected' : ''}`}
              style={{
                position: 'absolute',
                left: widget.position.x,
                top: widget.position.y,
                width: widget.size.width,
                height: widget.size.height,
                zIndex: widget.zIndex,
                transform: widget.rotation ? `rotate(${widget.rotation}deg)` : undefined,
                cursor: widget.locked ? 'default' : 'move',
                opacity: widget.visible ? 1 : 0,
              }}
              onMouseDown={e => onWidgetMouseDown(e, widget)}
            >
              <WidgetContent widget={widget} />
              {isSelected && !widget.locked && (
                <ResizeHandles onResize={onResize(widget.id, widget)} />
              )}
            </div>
          )
        })}
    </div>
  )
}

export function FreehandWidgetToolbar() {
  const addFreehandWidget = useQuizStore(s => s.addFreehandWidget)
  const selectFreehandWidget = useQuizStore(s => s.selectFreehandWidget)

  return (
    <div className="quiz-layers-add">
      <div className="quiz-layers-add-header">Widgets</div>
      <div className="quiz-layers-add-list">
        {WIDGET_TYPES.map(wt => (
          <div
            key={wt.type}
            className="quiz-layers-add-item"
            onClick={() => {
              const id = crypto.randomUUID()
              const centerX = window.innerWidth / 2 - 100
              const centerY = window.innerHeight / 2 - 50
              const jitter = 30
              const widget: FreehandWidgetData = {
                id,
                type: wt.type,
                position: { x: centerX + Math.random() * jitter, y: centerY + Math.random() * jitter },
                size: { ...wt.defaultSize },
                rotation: 0,
                zIndex: 0,
                locked: false,
                visible: true,
                styles: {},
                content: wt.type === 'text' ? 'Novo texto' : wt.type === 'button' ? 'Clique aqui' : undefined,
                shapeType: wt.type === 'shape' ? 'rect' : undefined,
              }
              addFreehandWidget(widget)
              selectFreehandWidget(id)
            }}
          >
            <div className="quiz-layers-add-icon" style={{ background: 'rgba(45,212,191,0.1)', color: '#2dd4bf' }}>
              {WIDGET_ICONS[wt.type]}
            </div>
            <span>{wt.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
