import { useState, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Trash2, Type, Layout as LayoutIcon, Layers, Play as PlayIcon, Settings, Grid3X3 } from 'lucide-react'
import { useQuizStore, type QuizNodeData, type NodeStyles, type ActionConfig, type FreehandWidgetData } from '../../stores/quizStore'

type TabId = 'content' | 'style' | 'layout' | 'interactions'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'content', label: 'Conteudo', icon: <PlayIcon size={12} /> },
  { id: 'style', label: 'Estilo', icon: <Type size={12} /> },
  { id: 'layout', label: 'Layout', icon: <LayoutIcon size={12} /> },
  { id: 'interactions', label: 'Acoes', icon: <Layers size={12} /> },
]

export default function PropertyPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('content')
  const selectedNodeId = useQuizStore(s => s.selectedNodeId)
  const selectedFreehandId = useQuizStore(s => s.selectedFreehandId)
  const currentQuiz = useQuizStore(s => s.currentQuiz)
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const removeNode = useQuizStore(s => s.removeNode)
  const updateFreehandWidget = useQuizStore(s => s.updateFreehandWidget)
  const removeFreehandWidget = useQuizStore(s => s.removeFreehandWidget)

  const node = currentQuiz?.nodes.find(n => n.id === selectedNodeId)
  const freehandWidget = currentQuiz?.freehand?.find(fw => fw.id === selectedFreehandId)

  if (freehandWidget) {
    return <FreehandPropertyPanel widget={freehandWidget} />
  }

  if (!node) {
    return (
      <div className="quiz-panel quiz-panel-empty">
        <div className="quiz-panel-empty-icon"><Settings size={28} /></div>
        <p>Selecione um card para editar suas propriedades</p>
      </div>
    )
  }

  return (
    <div className="quiz-panel">
      <div className="quiz-panel-header">
        <span>{node.data.label}</span>
        <button className="quiz-panel-remove" onClick={() => removeNode(node.id)} title="Remover card"><Trash2 size={12} /></button>
      </div>
      <div className="quiz-panel-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`quiz-panel-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="quiz-panel-body">
        {activeTab === 'content' && <ContentTab nodeId={node.id} />}
        {activeTab === 'style' && <StyleTab nodeId={node.id} />}
        {activeTab === 'layout' && <LayoutTab nodeId={node.id} />}
        {activeTab === 'interactions' && <InteractionsTab nodeId={node.id} />}
      </div>
    </div>
  )
}

function FreehandPropertyPanel({ widget }: { widget: FreehandWidgetData }) {
  const updateFreehandWidget = useQuizStore(s => s.updateFreehandWidget)
  const removeFreehandWidget = useQuizStore(s => s.removeFreehandWidget)
  const [activeTab, setActiveTab] = useState<TabId>('content')

  return (
    <div className="quiz-panel">
      <div className="quiz-panel-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Grid3X3 size={12} /> {widget.type}</span>
        <button className="quiz-panel-remove" onClick={() => removeFreehandWidget(widget.id)} title="Remover widget"><Trash2 size={12} /></button>
      </div>
      <div className="quiz-panel-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`quiz-panel-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="quiz-panel-body">
        {activeTab === 'content' && <FreehandContentTab widget={widget} />}
        {activeTab === 'style' && <FreehandStyleTab widget={widget} />}
        {activeTab === 'layout' && <FreehandLayoutTab widget={widget} />}
      </div>
    </div>
  )
}

function FreehandContentTab({ widget }: { widget: FreehandWidgetData }) {
  const updateFreehandWidget = useQuizStore(s => s.updateFreehandWidget)
  return (
    <>
      {(widget.type === 'text' || widget.type === 'button') && (
        <div className="quiz-panel-field">
          <label>Conteudo</label>
          <textarea value={widget.content || ''} onChange={e => updateFreehandWidget(widget.id, { content: e.target.value })} rows={3} />
        </div>
      )}
      {widget.type === 'image' && (
        <div className="quiz-panel-field">
          <label>URL da imagem</label>
          <input type="text" value={widget.content || ''} onChange={e => updateFreehandWidget(widget.id, { content: e.target.value })} placeholder="https://..." />
        </div>
      )}
      {widget.type === 'shape' && (
        <div className="quiz-panel-field">
          <label>Tipo de forma</label>
          <select value={widget.shapeType || 'rect'} onChange={e => updateFreehandWidget(widget.id, { shapeType: e.target.value as any })}>
            <option value="rect">Retangulo</option>
            <option value="circle">Circulo</option>
            <option value="triangle">Triangulo</option>
          </select>
        </div>
      )}
      {widget.type === 'icon' && (
        <div className="quiz-panel-field">
          <label>Icone</label>
          <select value={widget.content || 'text'} onChange={e => updateFreehandWidget(widget.id, { content: e.target.value })}>
            <option value="text">Texto</option>
            <option value="image">Imagem</option>
            <option value="shape">Forma</option>
            <option value="icon">Icone</option>
            <option value="divider">Divisor</option>
            <option value="button">Botao</option>
            <option value="counter">Contador</option>
            <option value="timer">Temporizador</option>
            <option value="progress_bar">Barra progresso</option>
          </select>
        </div>
      )}
      <div className="quiz-panel-field">
        <label>Z-Index</label>
        <input type="number" value={widget.zIndex} onChange={e => updateFreehandWidget(widget.id, { zIndex: parseInt(e.target.value) || 0 })} />
      </div>
    </>
  )
}

function FreehandStyleTab({ widget }: { widget: FreehandWidgetData }) {
  const updateFreehandWidget = useQuizStore(s => s.updateFreehandWidget)
  const s = widget.styles || {}
  function updateStyle(partial: Partial<NodeStyles>) {
    updateFreehandWidget(widget.id, { styles: { ...s, ...partial } })
  }
  return (
    <>
      <div className="quiz-panel-field">
        <label>Cor de destaque</label>
        <div className="quiz-panel-color-row">
          <input type="color" value={s.color || '#2dd4bf'} onChange={e => updateStyle({ color: e.target.value })} />
          <input type="text" value={s.color || ''} onChange={e => updateStyle({ color: e.target.value })} placeholder="#2dd4bf" />
        </div>
      </div>
      <div className="quiz-panel-field">
        <label>Opacidade</label>
        <input type="range" min={0} max={1} step={0.05} value={s.opacity ?? 1} onChange={e => updateStyle({ opacity: parseFloat(e.target.value) })} />
        <span className="quiz-panel-range-value">{Math.round((s.opacity ?? 1) * 100)}%</span>
      </div>
      <div className="quiz-panel-divider" />
      <div className="quiz-panel-field">
        <label>Familia da fonte</label>
        <input type="text" value={s.typography?.fontFamily || ''} onChange={e => updateStyle({ typography: { ...s.typography, fontFamily: e.target.value } })} placeholder="Inter, sans-serif" />
      </div>
      <div className="quiz-panel-field">
        <label>Tamanho da fonte</label>
        <input type="number" min={8} max={120} value={s.typography?.fontSize || 14} onChange={e => updateStyle({ typography: { ...s.typography, fontSize: Math.min(120, Math.max(8, parseInt(e.target.value) || 14)) } })} />
      </div>
      <div className="quiz-panel-field">
        <label>Cor do texto</label>
        <input type="color" value={s.typography?.textColor || '#ffffff'} onChange={e => updateStyle({ typography: { ...s.typography, textColor: e.target.value } })} />
      </div>
      <div className="quiz-panel-divider" />
      <div className="quiz-panel-field">
        <label>Background</label>
        <input type="color" value={s.background?.bgColor || '#1a1a2e'} onChange={e => updateStyle({ background: { ...s.background, bgColor: e.target.value } })} />
      </div>
      <div className="quiz-panel-field">
        <label>Borda radius</label>
        <input type="number" min={0} max={50} value={s.boxModel?.borderRadius || 8} onChange={e => updateStyle({ boxModel: { ...s.boxModel, borderRadius: Math.min(50, Math.max(0, parseInt(e.target.value) || 0)) } })} />
      </div>
    </>
  )
}

function FreehandLayoutTab({ widget }: { widget: FreehandWidgetData }) {
  const updateFreehandWidget = useQuizStore(s => s.updateFreehandWidget)
  return (
    <>
      <div className="quiz-panel-field">
        <label>Posicao X</label>
        <input type="number" value={Math.round(widget.position.x)} onChange={e => updateFreehandWidget(widget.id, { position: { ...widget.position, x: parseInt(e.target.value) || 0 } })} />
      </div>
      <div className="quiz-panel-field">
        <label>Posicao Y</label>
        <input type="number" value={Math.round(widget.position.y)} onChange={e => updateFreehandWidget(widget.id, { position: { ...widget.position, y: parseInt(e.target.value) || 0 } })} />
      </div>
      <div className="quiz-panel-field">
        <label>Largura</label>
        <input type="number" min={10} value={Math.round(widget.size.width)} onChange={e => updateFreehandWidget(widget.id, { size: { ...widget.size, width: Math.max(10, parseInt(e.target.value) || widget.size.width) } })} />
      </div>
      <div className="quiz-panel-field">
        <label>Altura</label>
        <input type="number" min={10} value={Math.round(widget.size.height)} onChange={e => updateFreehandWidget(widget.id, { size: { ...widget.size, height: Math.max(10, parseInt(e.target.value) || widget.size.height) } })} />
      </div>
      <div className="quiz-panel-field">
        <label>Rotacao</label>
        <input type="number" min={-360} max={360} value={widget.rotation || 0} onChange={e => updateFreehandWidget(widget.id, { rotation: Math.min(360, Math.max(-360, parseInt(e.target.value) || 0)) })} />
      </div>
      <div className="quiz-panel-field">
        <label>Z-Index</label>
        <input type="number" value={widget.zIndex} onChange={e => updateFreehandWidget(widget.id, { zIndex: parseInt(e.target.value) || 0 })} />
      </div>
      <div className="quiz-panel-divider" />
      <div className="quiz-panel-field-row">
        <label><input type="checkbox" checked={widget.visible} onChange={e => updateFreehandWidget(widget.id, { visible: e.target.checked })} /> Visivel</label>
        <label><input type="checkbox" checked={widget.locked} onChange={e => updateFreehandWidget(widget.id, { locked: e.target.checked })} /> Bloqueado</label>
      </div>
    </>
  )
}

function ContentTab({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const data = node?.data

  if (!data) return null

  return (
    <>
      <div className="quiz-panel-field">
        <label>Rotulo</label>
        <input type="text" value={data.label} onChange={e => updateNodeData(nodeId, { label: e.target.value })} />
      </div>
      <div className="quiz-panel-divider" />
      {data.type === 'question' && <QuestionFields nodeId={nodeId} />}
      {data.type === 'logic' && <LogicFields nodeId={nodeId} />}
      {data.type === 'result' && <ResultFields nodeId={nodeId} />}
      {data.type === 'redirect' && <RedirectFields nodeId={nodeId} />}
      {data.type === 'score' && <ScoreFields nodeId={nodeId} />}
      {data.type === 'wait' && <WaitFields nodeId={nodeId} />}
      {data.type === 'webhook' && <WebhookFields nodeId={nodeId} />}
      {data.type === 'subflow' && <SubflowFields nodeId={nodeId} />}
    </>
  )
}

function StyleTab({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const styles = node?.data?.styles || {}

  function updateStyle(partial: Partial<NodeStyles>) {
    updateNodeData(nodeId, { styles: { ...styles, ...partial } })
  }

  return (
    <>
      <div className="quiz-panel-field">
        <label>Cor de destaque</label>
        <div className="quiz-panel-color-row">
          <input type="color" value={styles.color || '#a855f7'} onChange={e => updateStyle({ color: e.target.value })} />
          <input type="text" value={styles.color || ''} onChange={e => updateStyle({ color: e.target.value })} placeholder="#a855f7" />
        </div>
      </div>
      <div className="quiz-panel-field">
        <label>Opacidade</label>
        <input type="range" min={0} max={1} step={0.05} value={styles.opacity ?? 1} onChange={e => updateStyle({ opacity: parseFloat(e.target.value) })} />
        <span className="quiz-panel-range-value">{Math.round((styles.opacity ?? 1) * 100)}%</span>
      </div>
      <div className="quiz-panel-field">
        <label>Rotacao</label>
        <input type="number" min={-360} max={360} value={styles.rotation ?? 0} onChange={e => updateStyle({ rotation: Math.min(360, Math.max(-360, parseInt(e.target.value) || 0)) })} />
      </div>
      <div className="quiz-panel-divider" />
      <div className="quiz-panel-field">
        <label>Familia da fonte</label>
        <input type="text" value={styles.typography?.fontFamily || ''} onChange={e => updateStyle({ typography: { ...styles.typography, fontFamily: e.target.value } })} placeholder="Inter, sans-serif" />
      </div>
      <div className="quiz-panel-field">
        <label>Tamanho da fonte</label>
        <input type="number" min={8} max={120} value={styles.typography?.fontSize || 14} onChange={e => updateStyle({ typography: { ...styles.typography, fontSize: Math.min(120, Math.max(8, parseInt(e.target.value) || 14)) } })} />
      </div>
      <div className="quiz-panel-field">
        <label>Peso da fonte</label>
        <select value={styles.typography?.fontWeight || 400} onChange={e => updateStyle({ typography: { ...styles.typography, fontWeight: parseInt(e.target.value) } })}>
          <option value={100}>Thin (100)</option>
          <option value={300}>Light (300)</option>
          <option value={400}>Regular (400)</option>
          <option value={500}>Medium (500)</option>
          <option value={600}>Semibold (600)</option>
          <option value={700}>Bold (700)</option>
          <option value={900}>Black (900)</option>
        </select>
      </div>
      <div className="quiz-panel-field">
        <label>Alinhamento</label>
        <select value={styles.typography?.textAlign || 'left'} onChange={e => updateStyle({ typography: { ...styles.typography, textAlign: e.target.value as any } })}>
          <option value="left">Esquerda</option>
          <option value="center">Centro</option>
          <option value="right">Direita</option>
          <option value="justify">Justificado</option>
        </select>
      </div>
      <div className="quiz-panel-field">
        <label>Cor do texto</label>
        <input type="color" value={styles.typography?.textColor || '#ffffff'} onChange={e => updateStyle({ typography: { ...styles.typography, textColor: e.target.value } })} />
      </div>
      <div className="quiz-panel-divider" />
      <div className="quiz-panel-field">
        <label>Background</label>
        <input type="color" value={styles.background?.bgColor || '#1a1a2e'} onChange={e => updateStyle({ background: { ...styles.background, bgColor: e.target.value } })} />
      </div>
      <div className="quiz-panel-field">
        <label>Borda radius</label>
        <input type="number" min={0} max={50} value={styles.boxModel?.borderRadius || 8} onChange={e => updateStyle({ boxModel: { ...styles.boxModel, borderRadius: Math.min(50, Math.max(0, parseInt(e.target.value) || 0)) } })} />
      </div>
    </>
  )
}

function LayoutTab({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const styles = node?.data?.styles || {}

  function updateStyle(partial: Partial<NodeStyles>) {
    updateNodeData(nodeId, { styles: { ...styles, ...partial } })
  }

  return (
    <>
      <div className="quiz-panel-field">
        <label>Largura</label>
        <input type="text" value={styles.width || ''} onChange={e => updateStyle({ width: e.target.value })} placeholder="auto" />
      </div>
      <div className="quiz-panel-field">
        <label>Altura</label>
        <input type="text" value={styles.height || ''} onChange={e => updateStyle({ height: e.target.value })} placeholder="auto" />
      </div>
      <div className="quiz-panel-field">
        <label>Z-Index</label>
        <input type="number" value={styles.zIndex ?? 0} onChange={e => updateStyle({ zIndex: parseInt(e.target.value) || 0 })} />
      </div>
    </>
  )
}

function InteractionsTab({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const actions = node?.data?.actions || []

  function updateActions(newActions: ActionConfig[]) {
    updateNodeData(nodeId, { actions: newActions })
  }

  function addAction() {
    const newAction: ActionConfig = { type: 'redirect', url: '' }
    updateActions([...actions, newAction])
  }

  function removeAction(index: number) {
    updateActions(actions.filter((_, i) => i !== index))
  }

  function updateAction(index: number, partial: Partial<ActionConfig>) {
    const updated = actions.map((a, i) => i === index ? { ...a, ...partial } : a)
    updateActions(updated)
  }

  return (
    <>
      <div className="quiz-panel-field">
        <label>Acoes</label>
        {actions.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Nenhuma acao configurada.</div>
        )}
        {actions.map((action, i) => (
          <div key={i} className="quiz-panel-action-row">
            <select value={action.type} onChange={e => updateAction(i, { type: e.target.value as any })}>
              <option value="redirect">Redirecionar URL</option>
              <option value="jump">Pular para node</option>
              <option value="update_score">Atualizar score</option>
              <option value="set_variable">Definir variavel</option>
              <option value="webhook">Disparar webhook</option>
            </select>
            {action.type === 'redirect' && (
              <input type="text" value={action.url || ''} onChange={e => updateAction(i, { url: e.target.value })} placeholder="https://..." />
            )}
            <button className="quiz-panel-remove-opt" onClick={() => removeAction(i)}>X</button>
          </div>
        ))}
        <button className="quiz-panel-add-opt" onClick={addAction}>+ Adicionar acao</button>
      </div>
    </>
  )
}

function QuestionFields({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const q = node?.data?.question
  if (!q) return null

  return (
    <>
      <div className="quiz-panel-field">
        <label>Tipo</label>
        <select value={q.type} onChange={e => updateNodeData(nodeId, { question: { ...q, type: e.target.value as any } })}>
          <option value="multiple">Multipla escolha</option>
          <option value="truefalse">Verdadeiro/Falso</option>
          <option value="text">Texto curto</option>
          <option value="text_area">Texto longo</option>
          <option value="rating">Avaliacao</option>
          <option value="number">Numero</option>
          <option value="date">Data</option>
          <option value="consent">Consentimento</option>
          <option value="range">Intervalo</option>
          <option value="ranking">Ordenacao</option>
        </select>
      </div>
      <div className="quiz-panel-field">
        <label>Texto da pergunta</label>
        <textarea value={q.text} onChange={e => updateNodeData(nodeId, { question: { ...q, text: e.target.value } })} rows={3} />
      </div>
      <div className="quiz-panel-field">
        <label>Descricao (opcional)</label>
        <textarea value={q.description} onChange={e => updateNodeData(nodeId, { question: { ...q, description: e.target.value } })} rows={2} />
      </div>
      <div className="quiz-panel-field">
        <label>Opcoes</label>
        {q.options.map((opt, i) => (
          <div key={i} className="quiz-panel-option-row">
            <input type="text" value={opt.label} onChange={e => {
              const opts = [...q.options]; opts[i] = { ...opts[i], label: e.target.value }; updateNodeData(nodeId, { question: { ...q, options: opts } })
            }} placeholder="Rotulo" />
            <input type="checkbox" checked={opt.correct} onChange={e => {
              const opts = [...q.options]; opts[i] = { ...opts[i], correct: e.target.checked }; updateNodeData(nodeId, { question: { ...q, options: opts } })
            }} title="Correta" />
            <button className="quiz-panel-remove-opt" onClick={() => {
              const opts = q.options.filter((_, idx) => idx !== i); updateNodeData(nodeId, { question: { ...q, options: opts } })
            }}>X</button>
          </div>
        ))}
        <button className="quiz-panel-add-opt" onClick={() => {
          const opts = [...q.options, { label: `Opcao ${q.options.length + 1}`, value: String(q.options.length + 1), correct: false }]
          updateNodeData(nodeId, { question: { ...q, options: opts } })
        }}>+ Adicionar opcao</button>
      </div>
      <div className="quiz-panel-field">
        <label>URL de midia (opcional)</label>
        <input type="text" value={q.mediaUrl} onChange={e => updateNodeData(nodeId, { question: { ...q, mediaUrl: e.target.value } })} placeholder="https://..." />
      </div>
      <div className="quiz-panel-field-row">
        <label><input type="checkbox" checked={q.required} onChange={e => updateNodeData(nodeId, { question: { ...q, required: e.target.checked } })} /> Obrigatorio</label>
        <label><input type="checkbox" checked={q.multiple} onChange={e => updateNodeData(nodeId, { question: { ...q, multiple: e.target.checked } })} /> Multiplas respostas</label>
      </div>
    </>
  )
}

function LogicFields({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const l = node?.data?.logic
  if (!l) return null
  return (
    <>
      <div className="quiz-panel-field">
        <label>Modo</label>
        <select value={l.mode} onChange={e => updateNodeData(nodeId, { logic: { ...l, mode: e.target.value as any } })}>
          <option value="if_else">Se / Senao</option>
          <option value="switch">Multiplos caminhos</option>
          <option value="weighted">Aleatorio ponderado</option>
        </select>
      </div>
      {l.mode === 'if_else' && (
        <>
          <div className="quiz-panel-field">
            <label>Tipo de condicao</label>
            <select value={l.conditionType} onChange={e => updateNodeData(nodeId, { logic: { ...l, conditionType: e.target.value as any } })}>
              <option value="score">Pontuacao</option>
              <option value="answer">Resposta</option>
              <option value="custom_variable">Variavel personalizada</option>
            </select>
          </div>
          <div className="quiz-panel-field">
            <label>Operador</label>
            <select value={l.operator} onChange={e => updateNodeData(nodeId, { logic: { ...l, operator: e.target.value as any } })}>
              <option value=">">Maior que (&gt;)</option>
              <option value="<">Menor que (&lt;)</option>
              <option value=">=">Maior ou igual (&gt;=)</option>
              <option value="<=">Menor ou igual (&lt;=)</option>
              <option value="==">Igual (==)</option>
              <option value="!=">Diferente (!=)</option>
              <option value="contains">Contem</option>
              <option value="starts_with">Comeca com</option>
              <option value="ends_with">Termina com</option>
            </select>
          </div>
          <div className="quiz-panel-field">
            <label>Valor</label>
            <input type="text" value={l.value} onChange={e => updateNodeData(nodeId, { logic: { ...l, value: e.target.value } })} />
          </div>
        </>
      )}
      {l.mode === 'switch' && (
        <div className="quiz-panel-field">
          <label>Ramos</label>
          {l.branches.map((b, i) => (
            <div key={b.id} className="quiz-panel-option-row">
              <input type="text" value={b.label} onChange={e => {
                const branches = [...l.branches]; branches[i] = { ...branches[i], label: e.target.value }; updateNodeData(nodeId, { logic: { ...l, branches } })
              }} placeholder="Rotulo do ramo" />
              <button className="quiz-panel-remove-opt" onClick={() => {
                const branches = l.branches.filter((_, idx) => idx !== i); updateNodeData(nodeId, { logic: { ...l, branches } })
              }}>X</button>
            </div>
          ))}
          <button className="quiz-panel-add-opt" onClick={() => {
            const branches = [...l.branches, { id: crypto.randomUUID(), label: `Ramo ${l.branches.length + 1}`, conditionType: 'always' as const, operator: '==' as const, value: 'true', variable: '' }]
            updateNodeData(nodeId, { logic: { ...l, branches } })
          }}>+ Adicionar ramo</button>
        </div>
      )}
    </>
  )
}

function ResultFields({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const r = node?.data?.result
  if (!r) return null
  return (
    <>
      <div className="quiz-panel-field">
        <label>Titulo</label>
        <input type="text" value={r.title} onChange={e => updateNodeData(nodeId, { result: { ...r, title: e.target.value } })} />
      </div>
      <div className="quiz-panel-field">
        <label>Conteudo</label>
        <textarea value={r.content} onChange={e => updateNodeData(nodeId, { result: { ...r, content: e.target.value } })} rows={4} />
      </div>
      <div className="quiz-panel-field">
        <label>URL de imagem (opcional)</label>
        <input type="text" value={r.imageUrl} onChange={e => updateNodeData(nodeId, { result: { ...r, imageUrl: e.target.value } })} />
      </div>
      <div className="quiz-panel-field">
        <label>URL de redirecionamento (opcional)</label>
        <input type="text" value={r.redirectUrl} onChange={e => updateNodeData(nodeId, { result: { ...r, redirectUrl: e.target.value } })} />
      </div>
    </>
  )
}

function RedirectFields({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const r = node?.data?.redirect
  if (!r) return null
  return (
    <>
      <div className="quiz-panel-field">
        <label>URL de destino</label>
        <input type="text" value={r.url} onChange={e => updateNodeData(nodeId, { redirect: { ...r, url: e.target.value } })} placeholder="https://..." />
      </div>
      <div className="quiz-panel-field">
        <label>Timeout (segundos)</label>
        <input type="number" value={r.timeout} onChange={e => updateNodeData(nodeId, { redirect: { ...r, timeout: parseInt(e.target.value) || 5 } })} />
      </div>
    </>
  )
}

function ScoreFields({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const s = node?.data?.score
  if (!s) return null
  return (
    <>
      <div className="quiz-panel-field">
        <label>Acao</label>
        <select value={s.action} onChange={e => updateNodeData(nodeId, { score: { ...s, action: e.target.value as any } })}>
          <option value="add">Adicionar</option>
          <option value="subtract">Subtrair</option>
          <option value="set">Definir</option>
        </select>
      </div>
      <div className="quiz-panel-field">
        <label>Valor</label>
        <input type="number" value={s.value} onChange={e => updateNodeData(nodeId, { score: { ...s, value: parseInt(e.target.value) || 0 } })} />
      </div>
    </>
  )
}

function WaitFields({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const w = node?.data?.wait
  if (!w) return null
  return (
    <div className="quiz-panel-field">
      <label>Segundos</label>
      <input type="number" min={0} max={300} value={w.seconds} onChange={e => updateNodeData(nodeId, { wait: { seconds: Math.max(0, parseInt(e.target.value) || 0) } })} />
    </div>
  )
}

function WebhookFields({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const w = node?.data?.webhook
  if (!w) return null
  return (
    <>
      <div className="quiz-panel-field">
        <label>URL</label>
        <input type="text" value={w.url} onChange={e => updateNodeData(nodeId, { webhook: { ...w, url: e.target.value } })} placeholder="https://..." />
      </div>
      <div className="quiz-panel-field">
        <label>Metodo</label>
        <select value={w.method} onChange={e => updateNodeData(nodeId, { webhook: { ...w, method: e.target.value as any } })}>
          <option value="POST">POST</option>
          <option value="GET">GET</option>
        </select>
      </div>
      <div className="quiz-panel-field">
        <label>Body (JSON template)</label>
        <textarea value={w.bodyTemplate} onChange={e => updateNodeData(nodeId, { webhook: { ...w, bodyTemplate: e.target.value } })} rows={4} />
      </div>
    </>
  )
}

function SubflowFields({ nodeId }: { nodeId: string }) {
  const updateNodeData = useQuizStore(s => s.updateNodeData)
  const node = useQuizStore(s => s.currentQuiz?.nodes.find(n => n.id === nodeId))
  const s = node?.data?.subflow
  if (!s) return null
  return (
    <>
      <div className="quiz-panel-field">
        <label>ID do Quiz</label>
        <input type="text" value={s.quizId} onChange={e => updateNodeData(nodeId, { subflow: { ...s, quizId: e.target.value } })} />
      </div>
      <div className="quiz-panel-field">
        <label>Titulo</label>
        <input type="text" value={s.quizTitle} onChange={e => updateNodeData(nodeId, { subflow: { ...s, quizTitle: e.target.value } })} />
      </div>
    </>
  )
}
