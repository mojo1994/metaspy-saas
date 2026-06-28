import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useQuizStore } from '../stores/quizStore'
import { PenSquare } from 'lucide-react'

interface QuizListItem {
  id: string; title: string; description: string; slug: string; status: string; version: number; created_at: string; updated_at: string
}

export default function QuizzesList() {
  const { fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetchWithAuth('/api/quizzes')
      if (res.ok) setQuizzes(await res.json())
    } catch {}
    setLoading(false)
  }

  async function create() {
    setCreating(true)
    try {
      const id = await useQuizStore.getState().createNewQuiz(fetchWithAuth)
      if (!id) { setCreating(false); return }
      navigate(`/dashboard/quiz/${id}`)
    } catch {}
    setCreating(false)
  }

  async function duplicate(id: string) {
    try {
      const res = await fetchWithAuth(`/api/quizzes/${id}/duplicate`, { method: 'POST' })
      if (res.ok) load()
    } catch {}
  }

  async function deleteQuiz(id: string) {
    try {
      await fetchWithAuth(`/api/quizzes/${id}/delete`, { method: 'DELETE' })
      load()
    } catch {}
  }

  return (
    <div>
      <div className="tool-header">
        <h3>Meus Quizzes</h3>
        <button className="btn btn-gradient" onClick={create} disabled={creating}>{creating ? 'Criando...' : '+ Novo Quiz'}</button>
      </div>
      {loading ? <div className="quiz-list-empty">Carregando...</div> : quizzes.length === 0 ? (
        <div className="quiz-list-empty">
          <div className="quiz-list-empty-icon"><PenSquare size={32} /></div>
          <p>Nenhum quiz criado ainda.</p>
          <p className="quiz-list-empty-sub">Crie seu primeiro quiz interativo para capturar leads e engajar sua audiencia.</p>
          <button className="btn btn-gradient" onClick={create}>Criar Primeiro Quiz</button>
        </div>
      ) : (
        <div className="quiz-list-grid">
          {quizzes.map(q => (
            <div key={q.id} className="quiz-list-card">
              <div className="quiz-list-card-top">
                <span className={`quiz-list-status quiz-status-${q.status}`}>{q.status}</span>
                <span className="quiz-list-version">v{q.version}</span>
              </div>
              <h4 className="quiz-list-card-title">{q.title}</h4>
              <p className="quiz-list-card-desc">{q.description || 'Sem descricao'}</p>
              <div className="quiz-list-card-meta">
                <span>{new Date(q.updated_at).toLocaleString('pt-BR')}</span>
              </div>
              <div className="quiz-list-card-actions">
                <button className="btn btn-primary" onClick={() => navigate(`/dashboard/quiz/${q.id}`)}>Editar</button>
                {q.status === 'published' && (
                  <button className="btn btn-secondary" onClick={() => window.open(`/quiz/${q.slug}`, '_blank')}>Visualizar</button>
                )}
                <button className="btn btn-secondary" onClick={() => duplicate(q.id)}>Duplicar</button>
                <button className="btn btn-secondary quiz-btn-danger" onClick={() => { if (confirm('Arquivar este quiz?')) deleteQuiz(q.id) }}>Arquivar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
