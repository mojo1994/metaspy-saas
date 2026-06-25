import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useQuizStore } from '../stores/quizStore'
import QuizCanvas from '../components/quiz/QuizCanvas'
import NodePalette from '../components/quiz/NodePalette'
import PropertyPanel from '../components/quiz/PropertyPanel'
import QuizTopBar from '../components/quiz/QuizTopBar'
import PreviewQuiz from '../components/quiz/PreviewQuiz'

export default function QuizBuilder() {
  const { id } = useParams<{ id: string }>()
  const { fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const loadQuiz = useQuizStore(s => s.loadQuiz)
  const currentQuiz = useQuizStore(s => s.currentQuiz)
  const isPreview = useQuizStore(s => s.isPreview)

  useEffect(() => {
    if (!id) return
    loadQuiz(id, fetchWithAuth)
  }, [id])

  if (!currentQuiz) {
    return (
      <div className="quiz-builder-loading">
        <p>Carregando quiz...</p>
      </div>
    )
  }

  return (
    <div className="quiz-builder">
      <QuizTopBar quizId={id!} />
      <div className="quiz-builder-body">
        {isPreview ? (
          <div className="quiz-preview-container">
            <PreviewQuiz />
          </div>
        ) : (
          <>
            <NodePalette />
            <QuizCanvas />
            <PropertyPanel />
          </>
        )}
      </div>
    </div>
  )
}
