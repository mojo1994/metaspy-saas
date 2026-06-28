import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuizStore, type CardElement, type NodeStyles } from '../../stores/quizStore'
import { Type, Image, Square, Minus, Star, MousePointer2, Trash2, Copy, Plus, GripVertical, X, ChevronDown, Palette, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline } from 'lucide-react'

const ELEMENT_TYPES: { type: CardElement['type']; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: 'Texto', icon: <Type size={14} /> },
  { type: 'image', label: 'Imagem', icon: <Image size={14} /> },
  { type: 'button', label: 'Botao', icon: <MousePointer2 size={14} /> },
  { type: 'icon', label: 'Icone', icon: <Star size={14} /> },
  { type: 'divider', label: 'Divisor', icon: <Minus size={14} /> },
  { type: 'shape', label: 'Forma', icon: <Square size={14} /> },
]

const FONTS = ['Arial', 'Helvetica', 'Georgia', 'Courier New', 'Verdana', 'Trebuchet MS', 'Impact', 'monospace']

function applyStyle(el: CardElement, key: string, value: any): CardElement {
  return { ...el, styles: { ...el.styles, [key]: value } }
}

function applyTypo(el: CardElement, key: string, value: any): CardElement {
  return { ...el, styles: { ...el.styles, typography: { ...(el.styles?.typography || {}), [key]: value } } }
}

function applyBg(el: CardElement, key: string, value: any): CardElement {
  return { ...el, styles: { ...el.styles, background: { ...(el.styles?.background || {}), [key]: value } } }
}

function applyBox(el: CardElement, key: string, value: any): CardElement {
  return { ...el, styles: { ...el.styles, boxModel: { ...(el.styles?.boxModel || {}), [key]: value } } }
}

function InlineEditor({ el, section, onDone }: { el: CardElement; section: 'header' | 'contentSection' | 'button'; onDone: () => void }) {
  const updateCardElement = useQuizStore(s => s.updateCardElement)
  const editingCardNodeId = useQuizStore(s => s.editingCardNodeId)
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null)
  const [val, setVal] = useState(el.content || '')

  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])

  function commit() {
    if (editingCardNodeId) updateCardElement(editingCardNodeId, section, el.id, { content: val })
    onDone()
  }

  if (el.type === 'text') {
    return (
      <textarea
        ref={ref as any}
        className="card-el-inline-textarea"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Escape') { setVal(el.content || ''); onDone() } }}
        style={{
          fontFamily: el.styles?.typography?.fontFamily || 'inherit',
          fontSize: el.styles?.typography?.fontSize || 16,
          fontWeight: el.styles?.typography?.fontWeight || 400,
          textAlign: el.styles?.typography?.textAlign || 'left',
          color: el.styles?.typography?.textColor || '#e2e8f0',
          width: '100%',
          minHeight: 40,
          background: 'transparent',
          border: '1px dashed #a855f7',
          borderRadius: 4,
          padding: 4,
          outline: 'none',
          resize: 'none',
        }}
      />
    )
  }

  return (
    <input
      ref={ref as any}
      className="card-el-inline-input"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(el.content || ''); onDone() } }}
      style={{
        fontFamily: el.styles?.typography?.fontFamily || 'inherit',
        fontSize: el.styles?.typography?.fontSize || 14,
        fontWeight: el.styles?.typography?.fontWeight || 600,
        textAlign: 'center',
        color: el.styles?.typography?.textColor || '#ffffff',
        width: '100%',
        background: 'transparent',
        border: '1px dashed #a855f7',
        borderRadius: 4,
        padding: '4px 8px',
        outline: 'none',
      }}
    />
  )
}

function ContextMenu({ el, section, position, onClose }: { el: CardElement; section: 'header' | 'contentSection' | 'button'; position: { x: number; y: number }; onClose: () => void }) {
  const updateCardElement = useQuizStore(s => s.updateCardElement)
  const removeCardElement = useQuizStore(s => s.removeCardElement)
  const editingCardNodeId = useQuizStore(s => s.editingCardNodeId)
  const [tab, setTab] = useState<'style' | 'action'>('style')

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  function update(key: string, value: any) {
    if (editingCardNodeId) updateCardElement(editingCardNodeId, section, el.id, applyStyle(el, key, value))
  }

  function updateTypo(key: string, value: any) {
    if (editingCardNodeId) updateCardElement(editingCardNodeId, section, el.id, applyTypo(el, key, value))
  }

  function updateBg(key: string, value: any) {
    if (editingCardNodeId) updateCardElement(editingCardNodeId, section, el.id, applyBg(el, key, value))
  }

  function updateBox(key: string, value: any) {
    if (editingCardNodeId) updateCardElement(editingCardNodeId, section, el.id, applyBox(el, key, value))
  }

  function remove() {
    if (editingCardNodeId) removeCardElement(editingCardNodeId, section, el.id)
    onClose()
  }

  function setAction(action: any) {
    if (editingCardNodeId) updateCardElement(editingCardNodeId, section, el.id, { action })
  }

  const typo = el.styles?.typography || {}
  const bg = el.styles?.background || {}

  return (
    <div ref={menuRef} className="card-context-menu" style={{ left: position.x, top: position.y }} onClick={e => e.stopPropagation()}>
      <div className="card-context-tabs">
        <button className={`card-context-tab${tab === 'style' ? ' active' : ''}`} onClick={() => setTab('style')}><Palette size={12} /> Estilo</button>
        {el.type === 'button' && <button className={`card-context-tab${tab === 'action' ? ' active' : ''}`} onClick={() => setTab('action')}><MousePointer2 size={12} /> Acao</button>}
      </div>

      {tab === 'style' && (
        <div className="card-context-body">
          <div className="card-context-section">
            <label>Cor do texto</label>
            <div className="card-context-color-row">
              <input type="color" value={typo.textColor || '#e2e8f0'} onChange={e => updateTypo('textColor', e.target.value)} />
              <input type="text" value={typo.textColor || ''} onChange={e => updateTypo('textColor', e.target.value)} placeholder="#e2e8f0" />
            </div>
          </div>

          <div className="card-context-section">
            <label>Cor de fundo</label>
            <div className="card-context-color-row">
              <input type="color" value={bg.bgColor || '#00000000'} onChange={e => updateBg('bgColor', e.target.value)} />
              <input type="text" value={bg.bgColor || ''} onChange={e => updateBg('bgColor', e.target.value)} placeholder="transparente" />
            </div>
          </div>

          <div className="card-context-section">
            <label>Fonte</label>
            <select value={typo.fontFamily || 'Arial'} onChange={e => updateTypo('fontFamily', e.target.value)}>
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div className="card-context-section-row">
            <div className="card-context-section">
              <label>Tamanho</label>
              <input type="number" value={typo.fontSize || 16} onChange={e => updateTypo('fontSize', parseInt(e.target.value) || 16)} min={8} max={72} />
            </div>
            <div className="card-context-section">
              <label>Peso</label>
              <select value={typo.fontWeight || 400} onChange={e => updateTypo('fontWeight', parseInt(e.target.value))}>
                {[100, 200, 300, 400, 500, 600, 700, 800, 900].map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>

          <div className="card-context-section">
            <label>Alinhamento</label>
            <div className="card-context-align-row">
              {(['left', 'center', 'right'] as const).map(a => (
                <button key={a} className={`card-context-align-btn${typo.textAlign === a ? ' active' : ''}`} onClick={() => updateTypo('textAlign', a)}>
                  {a === 'left' ? <AlignLeft size={14} /> : a === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
                </button>
              ))}
            </div>
          </div>

          {(el.type === 'shape' || el.type === 'button') && (
            <>
              <div className="card-context-section">
                <label>Borda (px)</label>
                <input type="number" value={el.styles?.boxModel?.borderRadius || 8} onChange={e => updateBox('borderRadius', parseInt(e.target.value) || 0)} min={0} max={50} />
              </div>
              <div className="card-context-section">
                <label>Borda</label>
                <div className="card-context-color-row">
                  <input type="color" value={el.styles?.boxModel?.borderColor || '#a855f7'} onChange={e => updateBox('borderColor', e.target.value)} />
                  <input type="number" value={el.styles?.boxModel?.borderWidth || 0} onChange={e => updateBox('borderWidth', parseInt(e.target.value) || 0)} min={0} max={10} style={{ width: 50 }} />
                </div>
              </div>
            </>
          )}

          {el.type === 'divider' && (
            <div className="card-context-section">
              <label>Espessura (px)</label>
              <input type="number" value={el.styles?.boxModel?.borderWidth || 1} onChange={e => updateBox('borderWidth', parseInt(e.target.value) || 1)} min={1} max={10} />
            </div>
          )}

          <div className="card-context-divider" />

          <div className="card-context-actions">
            <button className="card-context-action-btn" onClick={remove}><Trash2 size={14} /> Excluir</button>
            <button className="card-context-action-btn" onClick={() => { if (editingCardNodeId) { useQuizStore.getState().addCardElement(editingCardNodeId, section, el.type); useQuizStore.getState().updateCardElement(editingCardNodeId, section, el.id, { ...el }) }; onClose() }}><Copy size={14} /> Duplicar</button>
          </div>
        </div>
      )}

      {tab === 'action' && (
        <div className="card-context-body">
          <div className="card-context-section">
            <label>Tipo de acao</label>
            <select value={el.action?.type || 'redirect'} onChange={e => {
              if (e.target.value === 'none') setAction(undefined)
              else setAction({ type: e.target.value })
            }}>
              <option value="none">Nenhuma</option>
              <option value="redirect">Redirecionar</option>
              <option value="jump">Pular para</option>
              <option value="update_score">Pontuar</option>
              <option value="set_variable">Definir variavel</option>
              <option value="submit">Enviar quiz</option>
              <option value="webhook">Webhook</option>
            </select>
          </div>
          {el.action && el.action.type === 'redirect' && (
            <>
              <div className="card-context-section">
                <label>URL</label>
                <input type="text" value={el.action.url || ''} onChange={e => setAction({ ...el.action, url: e.target.value })} placeholder="https://..." />
              </div>
              <label className="card-context-checkbox">
                <input type="checkbox" checked={!!el.action.newTab} onChange={e => setAction({ ...el.action, newTab: e.target.checked })} />
                Nova aba
              </label>
            </>
          )}
          {el.action && el.action.type === 'update_score' && (
            <div className="card-context-section-row">
              <div className="card-context-section">
                <label>Acao</label>
                <select value={el.action.scoreAction || 'add'} onChange={e => setAction({ ...el.action, scoreAction: e.target.value })}>
                  <option value="add">Adicionar</option>
                  <option value="subtract">Subtrair</option>
                  <option value="set">Definir</option>
                </select>
              </div>
              <div className="card-context-section">
                <label>Valor</label>
                <input type="number" value={el.action.scoreValue || 0} onChange={e => setAction({ ...el.action, scoreValue: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          )}
          {el.action && el.action.type === 'set_variable' && (
            <div className="card-context-section-row">
              <div className="card-context-section">
                <label>Variavel</label>
                <input type="text" value={el.action.variableName || ''} onChange={e => setAction({ ...el.action, variableName: e.target.value })} />
              </div>
              <div className="card-context-section">
                <label>Valor</label>
                <input type="text" value={el.action.variableValue || ''} onChange={e => setAction({ ...el.action, variableValue: e.target.value })} />
              </div>
            </div>
          )}
          {el.action && el.action.type === 'webhook' && (
            <div className="card-context-section">
              <label>Webhook URL</label>
              <input type="text" value={el.action.webhookUrl || ''} onChange={e => setAction({ ...el.action, webhookUrl: e.target.value })} placeholder="https://..." />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ImageUrlEditor({ el, section, onDone }: { el: CardElement; section: 'header' | 'contentSection' | 'button'; onDone: () => void }) {
  const updateCardElement = useQuizStore(s => s.updateCardElement)
  const editingCardNodeId = useQuizStore(s => s.editingCardNodeId)
  const ref = useRef<HTMLInputElement>(null)
  const [val, setVal] = useState(el.imageUrl || '')

  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])

  function commit() {
    if (editingCardNodeId) updateCardElement(editingCardNodeId, section, el.id, { imageUrl: val || undefined })
    onDone()
  }

  return (
    <input
      ref={ref}
      type="url"
      className="card-el-inline-input"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { onDone() } }}
      placeholder="https://..."
      style={{ width: '100%', padding: '4px 8px', background: 'transparent', border: '1px dashed #a855f7', borderRadius: 4, outline: 'none', color: '#e2e8f0', fontSize: 13 }}
    />
  )
}

function CardElementView({ el, section, index, total }: { el: CardElement; section: 'header' | 'contentSection' | 'button'; index: number; total: number }) {
  const [editing, setEditing] = useState(false)
  const [editingImage, setEditingImage] = useState(false)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const updateCardElement = useQuizStore(s => s.updateCardElement)
  const reorderCardElements = useQuizStore(s => s.reorderCardElements)
  const editingCardNodeId = useQuizStore(s => s.editingCardNodeId)

  const handleDragStart = useCallback((e: React.DragEvent) => {
    setDragging(true)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `${index}`)
  }, [index])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const from = parseInt(e.dataTransfer.getData('text/plain'))
    if (!isNaN(from) && from !== index && editingCardNodeId) {
      reorderCardElements(editingCardNodeId, section, from, index)
    }
  }, [index, section, editingCardNodeId, reorderCardElements])

  const handleDragEnd = useCallback(() => setDragging(false), [])

  const typo = el.styles?.typography || {}
  const bg = el.styles?.background || {}
  const box = el.styles?.boxModel || {}

  const baseStyle: React.CSSProperties = {
    fontFamily: typo.fontFamily || 'inherit',
    fontSize: typo.fontSize || (el.type === 'text' ? 16 : 14),
    fontWeight: typo.fontWeight || (el.type === 'text' ? 400 : 600),
    textAlign: typo.textAlign || (el.type === 'text' ? 'left' : 'center'),
    color: typo.textColor || (el.type === 'button' ? '#ffffff' : '#e2e8f0'),
    background: bg.bgColor || (el.type === 'button' ? '#a855f7' : 'transparent'),
    borderRadius: box.borderRadius || (el.type === 'shape' || el.type === 'button' ? 8 : 0),
    border: box.borderWidth ? `${box.borderWidth}px solid ${box.borderColor || '#a855f7'}` : undefined,
    width: '100%',
    padding: el.type === 'button' ? '8px 16px' : el.type === 'text' ? '4px 0' : 0,
    cursor: 'pointer',
    userSelect: 'none',
    outline: 'none',
  }

  function renderIcon() {
    const icons: Record<string, React.ReactNode> = {
      star: <Star size={24} />,
      heart: '❤️',
      check: '✓',
      x: '✕',
      arrow: '→',
      info: 'ℹ',
      warning: '⚠',
    }
    return icons[el.iconName || 'star'] || <Star size={24} />
  }

  return (
    <div
      className={`card-el-wrapper${dragging ? ' card-el-dragging' : ''}`}
      onDoubleClick={el.type === 'image' ? (e) => { e.stopPropagation(); setEditingImage(true) } : el.type !== 'divider' && el.type !== 'shape' ? (e) => { e.stopPropagation(); setEditing(true) } : undefined}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setMenuPos({ x: e.clientX, y: e.clientY }) }}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      <div className="card-el-drag-handle"><GripVertical size={12} /></div>

      {editing ? (
        <InlineEditor el={el} section={section} onDone={() => setEditing(false)} />
      ) : el.type === 'text' ? (
        <div style={baseStyle}>{el.content || 'Texto'}</div>
      ) : el.type === 'image' ? (
        editingImage ? (
          <ImageUrlEditor el={el} section={section} onDone={() => setEditingImage(false)} />
        ) : (
          <div className="card-el-image" style={baseStyle}>
            {el.imageUrl ? <img src={el.imageUrl} alt="" style={{ maxWidth: '100%', borderRadius: box.borderRadius || 0 }} /> : <span style={{ opacity: 0.4, fontSize: 12 }}>Duplo clique para URL</span>}
          </div>
        )
      ) : el.type === 'button' ? (
        <button style={baseStyle} className="card-el-button">{el.content || 'Botao'}</button>
      ) : el.type === 'icon' ? (
        <div style={{ ...baseStyle, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 8 }}>{renderIcon()}</div>
      ) : el.type === 'divider' ? (
        <hr style={{ width: '100%', border: 'none', borderTop: `${box.borderWidth || 1}px solid ${bg.bgColor || '#a855f740'}` }} />
      ) : el.type === 'shape' ? (
        <div style={{
          ...baseStyle,
          width: el.styles?.width || 60,
          height: el.styles?.height || 60,
          borderRadius: el.shapeType === 'circle' ? '50%' : box.borderRadius || 8,
          background: bg.bgColor || '#a855f740',
          margin: '0 auto',
        }} />
      ) : null}

      {menuPos && editingCardNodeId && (
        <ContextMenu el={el} section={section} position={menuPos} onClose={() => setMenuPos(null)} />
      )}
    </div>
  )
}

function CardSection({ section, label }: { section: 'header' | 'contentSection' | 'button'; label: string }) {
  const editingCardNodeId = useQuizStore(s => s.editingCardNodeId)
  const currentQuiz = useQuizStore(s => s.currentQuiz)
  const addCardElement = useQuizStore(s => s.addCardElement)
  const [showPicker, setShowPicker] = useState(false)

  const node = editingCardNodeId ? currentQuiz?.nodes.find(n => n.id === editingCardNodeId) : null
  const cardContent = node?.data?.cardContent
  const elements = cardContent?.[section]?.elements || []

  function add(type: CardElement['type']) {
    const id = editingCardNodeId
    if (id) {
      addCardElement(id, section, type)
      setShowPicker(false)
    }
  }

  return (
    <div className="card-section">
      <div className="card-section-header">
        <span className="card-section-label">{label}</span>
        <span className="card-section-count">{elements.length} elemento{elements.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="card-section-body">
        {elements.length === 0 && !showPicker && (
          <div className="card-section-empty" onClick={() => setShowPicker(true)}>
            <Plus size={16} /> Adicionar elemento
          </div>
        )}
        {elements.map((el, i) => (
          <CardElementView key={el.id} el={el} section={section} index={i} total={elements.length} />
        ))}
        {showPicker ? (
          <div className="card-el-picker">
            {ELEMENT_TYPES.map(et => (
              <button key={et.type} className="card-el-picker-item" onClick={() => add(et.type)}>
                {et.icon} {et.label}
              </button>
            ))}
            <button className="card-el-picker-close" onClick={() => setShowPicker(false)}><X size={14} /></button>
          </div>
        ) : elements.length > 0 ? (
          <button className="card-section-add-btn" onClick={() => setShowPicker(true)}>
            <Plus size={14} /> Adicionar
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default function CardEditorModal() {
  const editingCardNodeId = useQuizStore(s => s.editingCardNodeId)
  const closeCardEditor = useQuizStore(s => s.closeCardEditor)
  const currentQuiz = useQuizStore(s => s.currentQuiz)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeCardEditor()
    }
    if (editingCardNodeId) {
      document.addEventListener('keydown', handleKey)
      return () => document.removeEventListener('keydown', handleKey)
    }
  }, [editingCardNodeId, closeCardEditor])

  const node = editingCardNodeId ? currentQuiz?.nodes.find(n => n.id === editingCardNodeId) : null
  if (!editingCardNodeId || !node) return null

  const data = node.data
  const content = data.cardContent || { header: { elements: [] }, contentSection: { elements: [] }, button: { elements: [] } }
  if (!data.cardContent) {
    useQuizStore.getState().updateNodeData(editingCardNodeId, { cardContent: content })
  }

  return (
    <div className="modal-overlay" onClick={closeCardEditor}>
      <div className="card-editor-modal" onClick={e => e.stopPropagation()}>
        <div className="card-editor-header">
          <div className="card-editor-title">
            <span className="card-editor-type-badge">{data.type}</span>
            <span>{data.label}</span>
          </div>
          <button className="modal-close" onClick={closeCardEditor}><X size={18} /></button>
        </div>

        <div className="card-editor-body">
          <CardSection section="header" label="Cabecalho" />
          <CardSection section="contentSection" label="Conteudo" />
          <CardSection section="button" label="Botao" />
        </div>
      </div>
    </div>
  )
}
