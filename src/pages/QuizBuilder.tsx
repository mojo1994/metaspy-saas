import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { useAuth } from '../contexts/AuthContext'
import { useQuizStore } from '../stores/quizStore'
import QuizCanvas from '../components/quiz/QuizCanvas'
import LayersPanel from '../components/quiz/LayersPanel'
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
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoadError(false)
    const timer = setTimeout(() => setLoadError(true), 10000)
    loadQuiz(id, fetchWithAuth).then(() => clearTimeout(timer))
  }, [id])

  if (!currentQuiz) {
    return (
      <div className="quiz-builder-loading">
        {loadError ? (
          <div style={{ textAlign: 'center', gap: 12 }}>
            <p>Nao foi possivel carregar o quiz.</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard/quizzes')}>Voltar</button>
          </div>
        ) : (
          <p>Carregando quiz...</p>
        )}
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <div className="quiz-builder">
        <QuizTopBar quizId={id!} />
        <div className="quiz-builder-body">
          {isPreview ? (
            <div className="quiz-preview-container">
              <PreviewQuiz />
            </div>
          ) : (
            <>
              <LayersPanel />
              <QuizCanvas />
              <PropertyPanel />
            </>
          )}
        </div>
      </div>
    </ReactFlowProvider>
  )
}
