import { useState, useCallback, useMemo } from 'react'
import { useQuizStore, type QuizNodeData } from '../../stores/quizStore'

export default function PreviewQuiz() {
  const currentQuiz = useQuizStore(s => s.currentQuiz)
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(() => {
    const start = currentQuiz?.nodes.find(n => n.data.type === 'start')
    if (!start) return null
    const startEdge = currentQuiz?.edges.find(e => e.source === start.id)
    return startEdge?.target || null
  })
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)

  const currentNode = useMemo(() => {
    if (!currentNodeId || !currentQuiz) return null
    return currentQuiz.nodes.find(n => n.id === currentNodeId) || null
  }, [currentNodeId, currentQuiz])

  const getNextNode = useCallback((nodeId: string, answer?: string) => {
    if (!currentQuiz) return null
    const outgoing = currentQuiz.edges.filter(e => e.source === nodeId)
    if (outgoing.length === 0) return null
    if (outgoing.length === 1) return outgoing[0].target
    // Logic branch: find the right edge
    const sourceNode = currentQuiz.nodes.find(n => n.id === nodeId)
    if (sourceNode?.data.type === 'logic' && sourceNode.data.logic) {
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
  }, [currentQuiz, score])

  function handleAnswer(answer: string | string[]) {
    if (!currentNodeId) return
    setAnswers(prev => ({ ...prev, [currentNodeId]: answer }))

    // Check for score nodes connected
    const next = getNextNode(currentNodeId)
    if (!next) { setFinished(true); return }

    // Check if next node is a Score node and auto-process it
    const nextNode = currentQuiz?.nodes.find(n => n.id === next)
    if (nextNode?.data.type === 'score' && nextNode.data.score) {
      const sc = nextNode.data.score
      if (sc.action === 'add') setScore(s => s + sc.value)
      else if (sc.action === 'subtract') setScore(s => s - sc.value)
      else if (sc.action === 'set') setScore(sc.value)
      const afterScore = getNextNode(next)
      if (!afterScore) { setFinished(true); return }
      setCurrentNodeId(afterScore)
      return
    }

    // Check if next node is a Result/Redirect
    if (nextNode?.data.type === 'result' || nextNode?.data.type === 'redirect') {
      setCurrentNodeId(next)
      setFinished(true)
      return
    }

    setCurrentNodeId(next)
  }

  function restart() {
    const start = currentQuiz?.nodes.find(n => n.data.type === 'start')
    if (!start) return
    const startEdge = currentQuiz?.edges.find(e => e.source === start.id)
    setCurrentNodeId(startEdge?.target || null)
    setAnswers({})
    setScore(0)
    setFinished(false)
  }

  if (!currentQuiz) return null
  if (!currentNode && !finished) {
    return (
      <div className="quiz-preview-empty">
        <p>Configure o quiz conectando os cards para ver o preview.</p>
      </div>
    )
  }

  if (finished) {
    const node = currentNode
    const resultData = node?.data?.result
    const redirectData = node?.data?.redirect
    return (
      <div className="quiz-preview-result">
        {resultData && (
          <>
            {resultData.imageUrl && <img src={resultData.imageUrl} alt="" className="quiz-preview-result-img" />}
            <h2>{resultData.title || 'Quiz concluido'}</h2>
            <p>{resultData.content}</p>
          </>
        )}
        {redirectData && (
          <>
            <p>Redirecionando para: {redirectData.url}</p>
            {redirectData.url && <a href={redirectData.url} className="btn btn-gradient">Ir para o destino</a>}
          </>
        )}
        {!resultData && !redirectData && <p>Quiz concluido! Pontuacao: {score}</p>}
        <button className="btn btn-secondary" onClick={restart} style={{ marginTop: 16 }}>Refazer quiz</button>
      </div>
    )
  }

  const nodeData = currentNode?.data
  if (nodeData?.type === 'question' && nodeData.question) {
    const q = nodeData.question
    return (
      <div className="quiz-preview-card">
        <h3>{q.text || 'Sem pergunta'}</h3>
        {q.description && <p className="quiz-preview-desc">{q.description}</p>}
        <div className="quiz-preview-options">
          {q.options.map((opt, i) => (
            <button key={i} className="quiz-preview-option" onClick={() => handleAnswer(opt.value)}>
              {opt.label}
            </button>
          ))}
        </div>
        <div className="quiz-preview-score">Pontuacao: {score}</div>
      </div>
    )
  }

  if (nodeData?.type === 'result' && nodeData.result) {
    const r = nodeData.result
    return (
      <div className="quiz-preview-result">
        {r.imageUrl && <img src={r.imageUrl} alt="" className="quiz-preview-result-img" />}
        <h2>{r.title || 'Resultado'}</h2>
        <p>{r.content}</p>
        {r.redirectUrl && <a href={r.redirectUrl} className="btn btn-gradient">Continuar</a>}
        <button className="btn btn-secondary" onClick={restart} style={{ marginTop: 16 }}>Refazer quiz</button>
      </div>
    )
  }

  return (
    <div className="quiz-preview-empty">
      <p>Card nao suportado em preview: {nodeData?.type}</p>
      <button className="btn btn-secondary" onClick={restart}>Reiniciar</button>
    </div>
  )
}
