import { useMemo, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { QuizNodeData, QuizSettings } from '../../stores/quizStore'

interface QuizRendererProps {
  nodes: Node<QuizNodeData>[]
  edges: Edge[]
  settings: QuizSettings
  currentNodeId: string | null
  answers: Record<string, string | string[]>
  score: number
  finished: boolean
  questionIndex?: number
  totalQuestions?: number
  onAnswer: (nodeId: string, answer: string | string[]) => void
  onRestart: () => void
  deviceMode?: 'desktop' | 'tablet' | 'mobile'
}

function getNextNode(
  nodeId: string,
  edges: Edge[],
  nodes: Node<QuizNodeData>[],
  score: number,
  answer?: string
): string | null {
  const outgoing = edges.filter(e => e.source === nodeId)
  if (outgoing.length === 0) return null
  if (outgoing.length === 1) return outgoing[0].target

  const sourceNode = nodes.find(n => n.id === nodeId)
  if (!sourceNode) return outgoing[0].target

  if (sourceNode.data.type === 'logic' && sourceNode.data.logic) {
    const logic = sourceNode.data.logic
    let conditionMet = false
    if (logic.conditionType === 'score') {
      const val = parseInt(logic.value) || 0
      if (logic.operator === '>=') conditionMet = score >= val
      else if (logic.operator === '>') conditionMet = score > val
      else if (logic.operator === '<=') conditionMet = score <= val
      else if (logic.operator === '<') conditionMet = score < val
      else if (logic.operator === '==') conditionMet = score === val
      else if (logic.operator === '!=') conditionMet = score !== val
    } else if (logic.conditionType === 'answer' && answer) {
      const val = logic.value
      if (logic.operator === '==') conditionMet = answer === val
      else if (logic.operator === '!=') conditionMet = answer !== val
      else if (logic.operator === 'contains') conditionMet = answer.includes(val)
    }
    if (conditionMet) {
      const trueEdge = outgoing.find(e => e.sourceHandle === 'true')
      return trueEdge?.target || outgoing[0].target
    } else {
      const falseEdge = outgoing.find(e => e.sourceHandle === 'false')
      return falseEdge?.target || (outgoing.length > 1 ? outgoing[1].target : outgoing[0].target)
    }
  }

  return outgoing[0].target
}

function getNodeStyle(data: QuizNodeData): React.CSSProperties {
  const styles: React.CSSProperties = {}
  if (data.styles?.color) styles.borderColor = data.styles.color
  return styles
}

interface DeviceFrameProps {
  mode: 'desktop' | 'tablet' | 'mobile'
  children: React.ReactNode
}

function DeviceFrame({ mode, children }: DeviceFrameProps) {
  if (mode === 'desktop') {
    return <>{children}</>
  }

  const deviceWidth = mode === 'tablet' ? 768 : 375
  const scale = mode === 'tablet' ? 0.85 : 0.7

  return (
    <div className="quiz-device-frame">
      <div className="quiz-device-bezel">
        <div
          className="quiz-device-content"
          style={{
            width: deviceWidth,
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function renderNodeContent(
  data: QuizNodeData,
  score: number,
  questionIndex: number,
  totalQuestions: number,
  onAnswer: (answer: string | string[]) => void,
  onRestart: () => void
) {
  const settings = {
    progressBar: true,
    ...(data.settings || {}),
  }

  if (data.type === 'question' && data.question) {
    const q = data.question
    return (
      <>
        {settings.progressBar && totalQuestions > 0 && (
          <div className="play-quiz-progress">
            <div
              className="play-quiz-progress-bar"
              style={{ width: `${((questionIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
        )}
        <h3 className="play-quiz-question">{q.text || '...'}</h3>
        {q.description && <p className="play-quiz-desc">{q.description}</p>}
        <div className="play-quiz-options">
          {q.options.map((opt, i) => (
            <button
              key={i}
              className="play-quiz-option"
              onClick={() => onAnswer(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="play-quiz-score">Score: {score}</div>
      </>
    )
  }

  if (data.type === 'result' && data.result) {
    const r = data.result
    return (
      <div className="quiz-preview-result">
        {r.imageUrl && <img src={r.imageUrl} alt="" className="play-quiz-img" />}
        <h2>{r.title || 'Resultado'}</h2>
        <p>{r.content || ''}</p>
        {r.redirectUrl && (
          <a href={r.redirectUrl} className="btn btn-gradient play-quiz-cta">
            Continuar
          </a>
        )}
        <button className="btn btn-secondary" onClick={onRestart} style={{ marginTop: 16 }}>
          Refazer quiz
        </button>
      </div>
    )
  }

  if (data.type === 'redirect' && data.redirect) {
    const r = data.redirect
    return (
      <div className="quiz-preview-result">
        <p>Redirecionando para: {r.url}</p>
        {r.url && (
          <a href={r.url} className="btn btn-gradient play-quiz-cta">
            Ir para o destino
          </a>
        )}
        <button className="btn btn-secondary" onClick={onRestart} style={{ marginTop: 16 }}>
          Refazer quiz
        </button>
      </div>
    )
  }

  return (
    <div className="quiz-preview-empty">
      <p>Quiz concluido! Score: {score}</p>
      <button className="btn btn-secondary" onClick={onRestart} style={{ marginTop: 16 }}>
        Refazer quiz
      </button>
    </div>
  )
}

export default function QuizRenderer({
  nodes,
  edges,
  currentNodeId,
  answers,
  score,
  finished,
  questionIndex = 0,
  totalQuestions = 0,
  onAnswer,
  onRestart,
  deviceMode = 'desktop',
}: QuizRendererProps) {
  const currentNode = useMemo(() => {
    if (!currentNodeId) return null
    return nodes.find(n => n.id === currentNodeId) || null
  }, [currentNodeId, nodes])

  const handleAnswer = useCallback(
    (answer: string | string[]) => {
      if (!currentNodeId) return
      onAnswer(currentNodeId, answer)
    },
    [currentNodeId, onAnswer]
  )

  const content = useMemo(() => {
    if (!currentNode && !finished) {
      return (
        <div className="quiz-preview-empty">
          <p>Configure o quiz conectando os cards para ver o preview.</p>
        </div>
      )
    }

    if (finished && currentNode) {
      return renderNodeContent(
        currentNode.data,
        score,
        questionIndex,
        totalQuestions,
        handleAnswer,
        onRestart
      )
    }

    if (currentNode) {
      return renderNodeContent(
        currentNode.data,
        score,
        questionIndex,
        totalQuestions,
        handleAnswer,
        onRestart
      )
    }

    return (
      <div className="quiz-preview-empty">
        <p>Quiz concluido! Score: {score}</p>
        <button className="btn btn-secondary" onClick={onRestart} style={{ marginTop: 16 }}>
          Refazer quiz
        </button>
      </div>
    )
  }, [currentNode, finished, score, questionIndex, totalQuestions, handleAnswer, onRestart])

  return (
    <div className="play-quiz" style={getNodeStyle(currentNode?.data || {} as QuizNodeData)}>
      <DeviceFrame mode={deviceMode}>
        <div className="quiz-renderer-content">
          {content}
        </div>
      </DeviceFrame>
    </div>
  )
}

export { getNextNode, getNodeStyle }
