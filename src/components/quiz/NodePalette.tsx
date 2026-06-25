import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useQuizStore, type NodeType } from '../../stores/quizStore'

const CARD_TYPES: { type: NodeType; label: string; desc: string; color: string }[] = [
  { type: 'start', label: 'Inicio', desc: 'Ponto de partida', color: '#a855f7' },
  { type: 'question', label: 'Pergunta', desc: 'Multipla escolha', color: '#3b82f6' },
  { type: 'logic', label: 'Condicao', desc: 'Se / Senao', color: '#f59e0b' },
  { type: 'score', label: 'Pontuacao', desc: 'Adicionar / Subtrair', color: '#10b981' },
  { type: 'result', label: 'Resultado', desc: 'Tela final', color: '#ec4899' },
  { type: 'redirect', label: 'Redirecionar', desc: 'URL externa', color: '#6366f1' },
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
            <div className="quiz-palette-item-dot" style={{ background: ct.color }} />
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
