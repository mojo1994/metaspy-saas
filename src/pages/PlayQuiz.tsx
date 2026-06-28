import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import QuizRenderer, { getNextNode } from '../components/quiz/QuizRenderer'

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
        fetch(`/api/quizzes/${data.id}/run`, { method: 'POST' })
          .then(r => r.json())
          .then(s => setSessionToken(s.session_token || ''))
          .catch(() => {})
      })
      .catch(() => setError('Quiz nao encontrado'))
      .finally(() => setLoading(false))
  }, [slug])

  const getNodeAnswerForSession = useCallback((nodeId: string, answer: string | string[]) => {
    return answer
  }, [])

  const handleAnswer = useCallback((nodeId: string, answer: string | string[]) => {
    setAnswers(prev => ({ ...prev, [nodeId]: answer }))

    if (sessionToken) {
      fetch(`/api/sessions/${sessionToken}/answer`, {
        method: 'POST',
        body: JSON.stringify({ nodeId, answer }),
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {})
    }

    const next = getNextNode(nodeId, quiz?.edges || [], quiz?.nodes || [], score, Array.isArray(answer) ? answer[0] : answer)
    if (!next) { finish(); return }

    const nextNode = quiz?.nodes.find((n: any) => n.id === next)
    if (nextNode?.data?.type === 'score' && nextNode.data.score) {
      const sc = nextNode.data.score
      if (sc.action === 'add') setScore(s => s + sc.value)
      else if (sc.action === 'subtract') setScore(s => s - sc.value)
      else if (sc.action === 'set') setScore(sc.value)
      const after = getNextNode(next, quiz?.edges || [], quiz?.nodes || [], score)
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
  }, [quiz, score, sessionToken])

  function finish() {
    setFinished(true)
    if (sessionToken) {
      fetch(`/api/sessions/${sessionToken}/complete`, {
        method: 'POST',
        body: JSON.stringify({ score }),
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {})
    }
  }

  const restart = useCallback(() => {
    const start = quiz?.nodes?.find((n: any) => n.data?.type === 'start')
    if (!start) return
    const edge = quiz?.edges?.find((e: any) => e.source === start.id)
    setCurrentNodeId(edge?.target || null)
    setAnswers({})
    setScore(0)
    setFinished(false)
  }, [quiz])

  const questionIndex = useMemo(() => {
    if (!quiz) return 0
    const questionNodes = quiz.nodes.filter((n: any) => n.data?.type === 'question')
    return currentNodeId ? questionNodes.findIndex((n: any) => n.id === currentNodeId) : 0
  }, [quiz, currentNodeId])

  const totalQuestions = useMemo(() => {
    return quiz?.nodes?.filter((n: any) => n.data?.type === 'question').length || 0
  }, [quiz])

  if (loading) {
    return (
      <div className="play-quiz-loading">
        <div className="play-quiz-spinner" />
        <p>Carregando quiz...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="play-quiz-error">
        <h2>Quiz nao encontrado</h2>
        <p>Verifique o link e tente novamente.</p>
      </div>
    )
  }

  if (!quiz) return null

  return (
    <QuizRenderer
      nodes={quiz.nodes || []}
      edges={quiz.edges || []}
      settings={quiz.settings || {}}
      currentNodeId={currentNodeId}
      answers={answers}
      score={score}
      finished={finished}
      questionIndex={questionIndex}
      totalQuestions={totalQuestions}
      onAnswer={handleAnswer}
      onRestart={restart}
    />
  )
}
