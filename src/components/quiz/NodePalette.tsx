import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useQuizStore, type NodeType } from '../../stores/quizStore'
import { Play, HelpCircle, GitBranch, BarChart3, Trophy, ArrowRight, Clock, Webhook, Copy, Settings } from 'lucide-react'

const CARD_TYPES: { type: NodeType; label: string; desc: string; color: string; icon: React.ReactNode }[] = [
  { type: 'start', label: 'Inicio', desc: 'Ponto de partida', color: '#a855f7', icon: <Play size={12} /> },
  { type: 'question', label: 'Pergunta', desc: 'Multipla escolha', color: '#3b82f6', icon: <HelpCircle size={12} /> },
  { type: 'logic', label: 'Condicao', desc: 'Se / Senao', color: '#f59e0b', icon: <GitBranch size={12} /> },
  { type: 'score', label: 'Pontuacao', desc: 'Adicionar / Subtrair', color: '#10b981', icon: <BarChart3 size={12} /> },
  { type: 'result', label: 'Resultado', desc: 'Tela final', color: '#ec4899', icon: <Trophy size={12} /> },
  { type: 'redirect', label: 'Redirecionar', desc: 'URL externa', color: '#6366f1', icon: <ArrowRight size={12} /> },
  { type: 'wait', label: 'Aguardar', desc: 'Pausa temporizada', color: '#8b5cf6', icon: <Clock size={12} /> },
  { type: 'webhook', label: 'Webhook', desc: 'HTTP callback', color: '#06b6d4', icon: <Webhook size={12} /> },
  { type: 'subflow', label: 'Sub-quiz', desc: 'Quiz aninhado', color: '#f97316', icon: <Copy size={12} /> },
  { type: 'custom', label: 'Personalizado', desc: 'HTML/CSS livre', color: '#6b7280', icon: <Settings size={12} /> },
]

export default function NodePalette() {
  const addNode = useQuizStore(s => s.addNode)
  const reactFlow = useReactFlow()

  const onDragStart = useCallback((e: React.DragEvent, type: NodeType) => {
    e.dataTransfer.setData('application/quiz-node-type', type)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  return (
    <div className="quiz-palette">
      <div className="quiz-palette-header">Cards</div>
      <div className="quiz-palette-list">
        {CARD_TYPES.map(ct => (
          <div
            key={ct.type}
            className="quiz-palette-item"
            draggable={ct.type !== 'start'}
            onDragStart={e => onDragStart(e, ct.type)}
            onClick={() => {
              const viewport = reactFlow.getViewport()
              const pos = reactFlow.screenToFlowPosition({ x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 })
              addNode(ct.type, pos)
            }}
          >
            <div className="quiz-palette-item-icon" style={{ background: `${ct.color}15`, color: ct.color }}>{ct.icon}</div>
            <div className="quiz-palette-item-info">
              <span className="quiz-palette-item-label">{ct.label}</span>
              <span className="quiz-palette-item-desc">{ct.desc}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="quiz-palette-footer">Arraste para o canvas ou clique para adicionar</div>
    </div>
  )
}
