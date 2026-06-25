import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { QuizNodeData } from '../../stores/quizStore'

const NODE_ICONS: Record<string, string> = {
  start: '▶',
  question: '?',
  logic: '◇',
  result: '★',
  redirect: '↗',
  score: '+/-',
  custom: '⚙',
}

function QuizNodeComponent({ data, selected }: NodeProps<Node<QuizNodeData>>) {
  const icon = NODE_ICONS[data.type] || '◻'
  return (
    <div className={`quiz-node-card quiz-node-${data.type}${selected ? ' quiz-node-selected' : ''}`}>
      {data.type !== 'start' && <Handle type="target" position={Position.Left} className="quiz-handle quiz-handle-input" />}
      <div className="quiz-node-header">
        <span className="quiz-node-icon">{icon}</span>
        <span className="quiz-node-type-label">{data.label}</span>
      </div>
      <div className="quiz-node-preview">
        {data.type === 'question' && data.question && (
          <span className="quiz-node-preview-text">{data.question.text || 'Sem pergunta'}</span>
        )}
        {data.type === 'question' && data.question && (
          <span className="quiz-node-option-count">{data.question.options.length} opcao{data.question.options.length !== 1 ? 'es' : ''}</span>
        )}
        {data.type === 'result' && data.result && (
          <span className="quiz-node-preview-text">{data.result.title || 'Sem titulo'}</span>
        )}
        {data.type === 'logic' && data.logic && (
          <span className="quiz-node-preview-text">{data.logic.conditionType} {data.logic.operator} {data.logic.value}</span>
        )}
        {data.type === 'redirect' && data.redirect && (
          <span className="quiz-node-preview-text">{data.redirect.url || 'Sem URL'}</span>
        )}
        {data.type === 'score' && data.score && (
          <span className="quiz-node-preview-text">{data.score.action === 'add' ? '+' : data.score.action === 'subtract' ? '-' : '='}{data.score.value}</span>
        )}
        {data.type === 'start' && <span className="quiz-node-preview-text">Ponto de partida do quiz</span>}
      </div>
      {(data.type === 'logic') && (
        <>
          <Handle type="source" position={Position.Right} id="true" className="quiz-handle quiz-handle-output quiz-handle-true" title="Sim" />
          <Handle type="source" position={Position.Bottom} id="false" className="quiz-handle quiz-handle-output quiz-handle-false" title="Nao" />
        </>
      )}
      {(data.type !== 'logic' && data.type !== 'result' && data.type !== 'redirect') && (
        <Handle type="source" position={Position.Right} className="quiz-handle quiz-handle-output" />
      )}
    </div>
  )
}

export default memo(QuizNodeComponent)
