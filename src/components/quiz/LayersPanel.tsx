import { useState, useCallback, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useQuizStore, type NodeType } from '../../stores/quizStore'
import { Play, HelpCircle, GitBranch, BarChart3, Trophy, ArrowRight, Clock, Webhook, Copy, Settings, Eye, EyeOff, Lock, Unlock, GripVertical, Plus, Trash2, Layers, Grid3X3 } from 'lucide-react'
import { FreehandWidgetToolbar } from './FreehandWidgetRenderer'

type Tab = 'layers' | 'add' | 'widgets'

const NODE_PALETTE: { type: NodeType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'start', label: 'Inicio', color: '#a855f7', icon: <Play size={12} /> },
  { type: 'question', label: 'Pergunta', color: '#3b82f6', icon: <HelpCircle size={12} /> },
  { type: 'logic', label: 'Condicao', color: '#f59e0b', icon: <GitBranch size={12} /> },
  { type: 'score', label: 'Pontuacao', color: '#10b981', icon: <BarChart3 size={12} /> },
  { type: 'result', label: 'Resultado', color: '#ec4899', icon: <Trophy size={12} /> },
  { type: 'redirect', label: 'Redirecionar', color: '#6366f1', icon: <ArrowRight size={12} /> },
  { type: 'wait', label: 'Aguardar', color: '#8b5cf6', icon: <Clock size={12} /> },
  { type: 'webhook', label: 'Webhook', color: '#06b6d4', icon: <Webhook size={12} /> },
  { type: 'subflow', label: 'Sub-quiz', color: '#f97316', icon: <Copy size={12} /> },
  { type: 'custom', label: 'Personalizado', color: '#6b7280', icon: <Settings size={12} /> },
]

export default function LayersPanel() {
  const [tab, setTab] = useState<Tab>('layers')
  const addNode = useQuizStore(s => s.addNode)
  const currentQuiz = useQuizStore(s => s.currentQuiz)
  const selectedNodeId = useQuizStore(s => s.selectedNodeId)
  const selectedFreehandId = useQuizStore(s => s.selectedFreehandId)
  const selectNode = useQuizStore(s => s.selectNode)
  const selectFreehandWidget = useQuizStore(s => s.selectFreehandWidget)
  const removeNode = useQuizStore(s => s.removeNode)
  const duplicateNode = useQuizStore(s => s.duplicateNode)
  const removeFreehandWidget = useQuizStore(s => s.removeFreehandWidget)
  const updateFreehandWidget = useQuizStore(s => s.updateFreehandWidget)
  const freehand = useQuizStore(s => s.currentQuiz?.freehand || [])
  const reactFlow = useReactFlow()

  const onDragStart = useCallback((e: React.DragEvent, type: NodeType) => {
    e.dataTransfer.setData('application/quiz-node-type', type)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const addNodeAtCenter = useCallback((type: NodeType) => {
    const viewport = reactFlow.getViewport()
    const pos = reactFlow.screenToFlowPosition({ x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 })
    addNode(type, pos)
  }, [reactFlow, addNode])

  const nodes = currentQuiz?.nodes || []

  const treeItems = useMemo(() => {
    const items: { id: string; label: string; type: string; color: string; visible: boolean; locked: boolean; index: number }[] = []
    nodes.forEach((n, i) => {
      const entry = NODE_PALETTE.find(e => e.type === n.data.type)
      items.push({ id: n.id, label: n.data.label, type: n.data.type, color: entry?.color || '#6b7280', visible: true, locked: false, index: i })
    })
    freehand.forEach((fw, i) => {
      items.push({ id: fw.id, label: fw.type, type: 'freehand', color: '#2dd4bf', visible: fw.visible, locked: fw.locked, index: nodes.length + i })
    })
    return items
  }, [nodes, freehand])

  return (
    <div className="quiz-layers">
      <div className="quiz-layers-tabs">
        <button className={`quiz-layers-tab${tab === 'layers' ? ' active' : ''}`} onClick={() => setTab('layers')}>
          <Layers size={12} /> <span>Camadas</span>
        </button>
        <button className={`quiz-layers-tab${tab === 'add' ? ' active' : ''}`} onClick={() => setTab('add')}>
          <Plus size={12} /> <span>Cards</span>
        </button>
        <button className={`quiz-layers-tab${tab === 'widgets' ? ' active' : ''}`} onClick={() => setTab('widgets')}>
          <Grid3X3 size={12} /> <span>Widgets</span>
        </button>
      </div>
      {tab === 'add' && (
        <div className="quiz-layers-add">
          <div className="quiz-layers-add-header">Cards</div>
          <div className="quiz-layers-add-list">
            {NODE_PALETTE.map(nt => (
              <div
                key={nt.type}
                className="quiz-layers-add-item"
                draggable={nt.type !== 'start'}
                onDragStart={e => onDragStart(e, nt.type)}
                onClick={() => addNodeAtCenter(nt.type)}
              >
                <div className="quiz-layers-add-icon" style={{ background: `${nt.color}15`, color: nt.color }}>{nt.icon}</div>
                <span>{nt.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'widgets' && <FreehandWidgetToolbar />}
      {tab === 'layers' && (
        <div className="quiz-layers-tree">
          <div className="quiz-layers-tree-header">{treeItems.length} itens</div>
          {treeItems.length === 0 && (
            <div className="quiz-layers-empty">Nenhum node no canvas</div>
          )}
          {treeItems.map(item => (
            <div
              key={item.id}
              className={`quiz-layers-item${(item.type === 'freehand' ? selectedFreehandId : selectedNodeId) === item.id ? ' selected' : ''}`}
              onClick={() => item.type === 'freehand' ? selectFreehandWidget(item.id) : selectNode(item.id)}
            >
              <span className="quiz-layers-item-grip"><GripVertical size={10} /></span>
              <span className="quiz-layers-item-color" style={{ background: item.color }} />
              <span className="quiz-layers-item-label">{item.label || item.type}</span>
              <span className="quiz-layers-item-type">{item.type}</span>
              <button className="quiz-layers-item-btn" title={item.visible ? 'Ocultar' : 'Exibir'} onClick={e => { e.stopPropagation(); if (item.type === 'freehand') updateFreehandWidget(item.id, { visible: !item.visible }) }}>
                {item.visible ? <EyeOff size={10} /> : <Eye size={10} />}
              </button>
              {item.type === 'freehand' && (
                <button className="quiz-layers-item-btn" title={item.locked ? 'Destravar' : 'Travar'} onClick={e => { e.stopPropagation(); updateFreehandWidget(item.id, { locked: !item.locked }) }}>
                  {item.locked ? <Lock size={10} /> : <Unlock size={10} />}
                </button>
              )}
              {item.type !== 'freehand' && (
                <button className="quiz-layers-item-btn" title="Duplicar" onClick={e => { e.stopPropagation(); duplicateNode(item.id) }}>
                  <Copy size={10} />
                </button>
              )}
              <button className="quiz-layers-item-btn danger" title="Remover" onClick={e => { e.stopPropagation(); item.type === 'freehand' ? removeFreehandWidget(item.id) : removeNode(item.id) }}>
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
