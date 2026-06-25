import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'

export default function PlayQuiz() {
  const { slug } = useParams<{ slug: string }>()
  const [quiz, setQuiz] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [sessionToken, setSessionToken] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    fetch(`/api/quizzes/slug/${slug}`)
      .then(r => r.json())
      .then(data => {
        setQuiz(data)
        const start = data.nodes?.find((n: any) => n.data?.type === 'start')
        if (start) {
          const edge = data.edges?.find((e: any) => e.source === start.id)
          setCurrentNodeId(edge?.target || null)
        }
        // Start session
        fetch(`/api/quizzes/${data.id}/run`, { method: 'POST' })
          .then(r => r.json())
          .then(s => setSessionToken(s.session_token || ''))
          .catch(() => {})
      })
      .catch(() => setError('Quiz nao encontrado'))
      .finally(() => setLoading(false))
  }, [slug])

  const currentNode = useMemo(() => {
    if (!currentNodeId || !quiz) return null
    return quiz.nodes.find((n: any) => n.id === currentNodeId)
  }, [currentNodeId, quiz])

  const getNextNode = useCallback((nodeId: string) => {
    if (!quiz) return null
    const outgoing = quiz.edges.filter((e: any) => e.source === nodeId)
    if (outgoing.length === 0) return null
    if (outgoing.length === 1) return outgoing[0].target
    const sourceNode = quiz.nodes.find((n: any) => n.id === nodeId)
    if (sourceNode?.data?.type === 'logic' && sourceNode.data.logic) {
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
        const trueEdge = outgoing.find((e: any) => e.sourceHandle === 'true')
        return trueEdge?.target || outgoing[0].target
      } else {
        const falseEdge = outgoing.find((e: any) => e.sourceHandle === 'false')
        return falseEdge?.target || outgoing[outgoing.length - 1].target
      }
    }
    return outgoing[0].target
  }, [quiz, score])

  function handleAnswer(value: string | string[]) {
    if (!currentNodeId) return
    setAnswers(prev => ({ ...prev, [currentNodeId]: value }))
    if (sessionToken) {
      fetch(`/api/sessions/${sessionToken}/answer`, {
        method: 'POST',
        body: JSON.stringify({ nodeId: currentNodeId, answer: value }),
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {})
    }
    const next = getNextNode(currentNodeId)
    if (!next) { finish(); return }
    const nextNode = quiz?.nodes.find((n: any) => n.id === next)
    if (nextNode?.data?.type === 'score' && nextNode.data.score) {
      const sc = nextNode.data.score
      if (sc.action === 'add') setScore(s => s + sc.value)
      else if (sc.action === 'subtract') setScore(s => s - sc.value)
      else if (sc.action === 'set') setScore(sc.value)
      const after = getNextNode(next)
      if (!after) { finish(); return }
      setCurrentNodeId(after)
      return
    }
    if (nextNode?.data?.type === 'result' || nextNode?.data?.type === 'redirect') {
      setCurrentNodeId(next)
      finish()
      return
    }
    setCurrentNodeId(next)
  }

  function finish() {
    setFinished(true)
    if (sessionToken) {
      fetch(`/api/sessions/${sessionToken}/complete`, { method: 'POST' }).catch(() => {})
    }
  }

  if (loading) return <div className="play-quiz-loading"><div className="play-quiz-spinner" /><p>Carregando quiz...</p></div>
  if (error) return <div className="play-quiz-error"><h2>Quiz nao encontrado</h2><p>Verifique o link e tente novamente.</p></div>
  if (!quiz) return null

  const settings = quiz.settings || {}

  if (finished) {
    const node = currentNode ? quiz.nodes.find((n: any) => n.id === currentNode) : null
    const resultData = node?.data?.result
    const redirectData = node?.data?.redirect
    return (
      <div className="play-quiz play-quiz-result">
        {resultData?.imageUrl && <img src={resultData.imageUrl} alt="" className="play-quiz-img" />}
        <h2>{resultData?.title || 'Quiz concluido'}</h2>
        <p>{resultData?.content || `Sua pontuacao: ${score}`}</p>
        {resultData?.redirectUrl && <a href={resultData.redirectUrl} className="btn btn-gradient play-quiz-cta">Continuar</a>}
        {redirectData?.url && (
          <>
            <p>Redirecionando em {redirectData.timeout || 5}s...</p>
            <a href={redirectData.url} className="btn btn-gradient play-quiz-cta">Ir agora</a>
          </>
        )}
      </div>
    )
  }

  const nodeData = currentNode?.data
  if (nodeData?.type === 'question' && nodeData.question) {
    const q = nodeData.question
    return (
      <div className="play-quiz">
        {settings.progressBar && <div className="play-quiz-progress"><div className="play-quiz-progress-bar" style={{ width: '30%' }} /></div>}
        <h3 className="play-quiz-question">{q.text || '...'}</h3>
        {q.description && <p className="play-quiz-desc">{q.description}</p>}
        <div className="play-quiz-options">
          {q.options.map((opt: any, i: number) => (
            <button key={i} className="play-quiz-option" onClick={() => handleAnswer(opt.value)}>{opt.label}</button>
          ))}
        </div>
      </div>
    )
  }

  return <div className="play-quiz play-quiz-empty"><p>Quiz em branco</p></div>
}
