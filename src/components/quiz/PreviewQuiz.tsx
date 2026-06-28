import { useState, useCallback, useMemo } from 'react'
import { useQuizStore } from '../../stores/quizStore'
import QuizRenderer, { getNextNode } from './QuizRenderer'

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
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

  const questionIndex = useMemo(() => {
    if (!currentQuiz) return 0
    const questionNodes = currentQuiz.nodes.filter(n => n.data.type === 'question')
    return currentNodeId ? questionNodes.findIndex(n => n.id === currentNodeId) : 0
  }, [currentQuiz, currentNodeId])

  const totalQuestions = useMemo(() => {
    return currentQuiz?.nodes.filter(n => n.data.type === 'question').length || 0
  }, [currentQuiz])

  const handleAnswer = useCallback((nodeId: string, answer: string | string[]) => {
    setAnswers(prev => ({ ...prev, [nodeId]: answer }))

    const next = getNextNode(nodeId, currentQuiz?.edges || [], currentQuiz?.nodes || [], score, Array.isArray(answer) ? answer[0] : answer)
    if (!next) { setFinished(true); return }

    const nextNode = currentQuiz?.nodes.find(n => n.id === next)
    if (nextNode?.data.type === 'score' && nextNode.data.score) {
      const sc = nextNode.data.score
      if (sc.action === 'add') setScore(s => s + sc.value)
      else if (sc.action === 'subtract') setScore(s => s - sc.value)
      else if (sc.action === 'set') setScore(sc.value)
      const afterScore = getNextNode(next, currentQuiz?.edges || [], currentQuiz?.nodes || [], score)
      if (!afterScore) { setFinished(true); return }
      setCurrentNodeId(afterScore)
      return
    }

    if (nextNode?.data.type === 'result' || nextNode?.data.type === 'redirect') {
      setCurrentNodeId(next)
      setFinished(true)
      return
    }

    setCurrentNodeId(next)
  }, [currentQuiz, score])

  const restart = useCallback(() => {
    const start = currentQuiz?.nodes.find(n => n.data.type === 'start')
    if (!start) return
    const startEdge = currentQuiz?.edges.find(e => e.source === start.id)
    setCurrentNodeId(startEdge?.target || null)
    setAnswers({})
    setScore(0)
    setFinished(false)
  }, [currentQuiz])

  if (!currentQuiz) return null

  return (
    <div className="quiz-preview-scene">
      <div className="quiz-device-bar">
        {(['desktop', 'tablet', 'mobile'] as const).map(mode => (
          <button
            key={mode}
            className={`quiz-device-btn${deviceMode === mode ? ' active' : ''}`}
            onClick={() => setDeviceMode(mode)}
          >
            {mode === 'desktop' ? 'laptop' : mode === 'tablet' ? 'tablet' : 'smartphone'}
          </button>
        ))}
        <span className="quiz-device-label">Score: {score}</span>
      </div>
      <QuizRenderer
        nodes={currentQuiz.nodes}
        edges={currentQuiz.edges}
        settings={currentQuiz.settings}
        currentNodeId={currentNodeId}
        answers={answers}
        score={score}
        finished={finished}
        questionIndex={questionIndex}
        totalQuestions={totalQuestions}
        onAnswer={handleAnswer}
        onRestart={restart}
        deviceMode={deviceMode}
      />
    </div>
  )
}
