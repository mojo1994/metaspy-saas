import { memo, useMemo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Play, HelpCircle, GitBranch, BarChart3, Trophy, ArrowRight, Clock, Webhook, Copy, Settings, GripHorizontal } from 'lucide-react'
import type { QuizNodeData, HandleConfig } from '../../stores/quizStore'
import { getHandlesForNode } from '../../stores/quizStore'

const NODE_ICONS: Record<string, React.ReactNode> = {
  start: <Play size={14} />,
  question: <HelpCircle size={14} />,
  logic: <GitBranch size={14} />,
  result: <Trophy size={14} />,
  redirect: <ArrowRight size={14} />,
  score: <BarChart3 size={14} />,
  wait: <Clock size={14} />,
  webhook: <Webhook size={14} />,
  subflow: <Copy size={14} />,
  custom: <Settings size={14} />,
}

const NODE_COLORS: Record<string, string> = {
  start: '#a855f7',
  question: '#3b82f6',
  logic: '#f59e0b',
  result: '#ec4899',
  redirect: '#6366f1',
  score: '#10b981',
  wait: '#8b5cf6',
  webhook: '#06b6d4',
  subflow: '#f97316',
  custom: '#6b7280',
}

const HANDLE_POSITIONS: Record<string, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
}

interface HandleRowProps {
  handle: HandleConfig
  isInput: boolean
}

function HandleRow({ handle, isInput }: HandleRowProps) {
  const position = HANDLE_POSITIONS[handle.position] || Position.Right
  return (
    <div className="quiz-handle-row">
      <Handle
        type={isInput ? 'target' : 'source'}
        position={position}
        id={handle.id}
        className={`quiz-handle quiz-handle-${isInput ? 'input' : 'output'}`}
        title={handle.label || undefined}
      />
      {handle.label && (
        <span className="quiz-handle-label">{handle.label}</span>
      )}
    </div>
  )
}

function QuizNodeComponent({ data, selected }: NodeProps<Node<QuizNodeData>>) {
  const icon = NODE_ICONS[data.type] || <Settings size={14} />
  const color = data.styles?.color || NODE_COLORS[data.type] || '#6b7280'
  const handles = useMemo(() => getHandlesForNode(data), [data])

  const previewText = useMemo(() => {
    if (data.type === 'question' && data.question) {
      return data.question.text || 'Sem pergunta'
    }
    if (data.type === 'result' && data.result) {
      return data.result.title || 'Sem titulo'
    }
    if (data.type === 'logic' && data.logic) {
      return `${data.logic.conditionType} ${data.logic.operator} ${data.logic.value}`
    }
    if (data.type === 'redirect' && data.redirect) {
      return data.redirect.url || 'Sem URL'
    }
    if (data.type === 'score' && data.score) {
      const prefix = data.score.action === 'add' ? '+' : data.score.action === 'subtract' ? '-' : '='
      return `${prefix}${data.score.value}`
    }
    if (data.type === 'wait' && data.wait) {
      return `${data.wait.seconds}s`
    }
    if (data.type === 'webhook' && data.webhook) {
      return data.webhook.url || 'Sem URL'
    }
    if (data.type === 'subflow' && data.subflow) {
      return data.subflow.quizTitle || 'Sem quiz'
    }
    if (data.type === 'start') {
      return 'Ponto de partida do quiz'
    }
    return ''
  }, [data])

  const optionCount = data.type === 'question' && data.question ? data.question.options.length : 0

  return (
    <div
      className={`quiz-node-card quiz-node-${data.type}${selected ? ' quiz-node-selected' : ''}`}
      style={{
        borderColor: selected ? color : undefined,
        ...(data.styles?.opacity ? { opacity: data.styles.opacity } : {}),
        ...(data.styles?.rotation ? { transform: `rotate(${data.styles.rotation}deg)` } : {}),
      }}
    >
      {/* Input handle on left */}
      {data.type !== 'start' && (
        <Handle type="target" position={Position.Left} className="quiz-handle quiz-handle-input" />
      )}

      <div className="quiz-node-header" style={{ background: `${color}0a` }}>
        <span className="quiz-node-icon" style={{ background: `${color}15`, color }}>{icon}</span>
        <span className="quiz-node-type-label">{data.label}</span>
      </div>

      <div className="quiz-node-preview">
        {previewText && (
          <span className="quiz-node-preview-text">{previewText}</span>
        )}
        {optionCount > 0 && (
          <span className="quiz-node-option-count">{optionCount} opcao{optionCount !== 1 ? 'es' : ''}</span>
        )}
      </div>

      {/* Output handles */}
      {data.type !== 'result' && data.type !== 'redirect' && (
        <div className="quiz-node-handles">
          {handles.map((handle, i) => {
            const position = HANDLE_POSITIONS[handle.position] || Position.Right
            if (i === handles.length - 1 && handles.length > 1) {
              // Last handle on bottom
              return (
                <div key={handle.id} className="quiz-handle-row quiz-handle-row-bottom">
                  <Handle type="source" position={Position.Bottom} id={handle.id} className="quiz-handle quiz-handle-output" title={handle.label || undefined} />
                  {handle.label && <span className="quiz-handle-label">{handle.label}</span>}
                </div>
              )
            }
            return (
              <HandleRow key={handle.id} handle={handle} isInput={false} />
            )
          })}
        </div>
      )}
    </div>
  )
}

export default memo(QuizNodeComponent)
