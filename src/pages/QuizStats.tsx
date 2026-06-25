import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface SessionStats {
  total: number
  completed: number
  inProgress: number
  avgScore: number
  sessions: { id: string; score: number; status: string; created_at: string; completed_at: string }[]
}

export default function QuizStats() {
  const { id } = useParams<{ id: string }>()
  const { fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchWithAuth(`/api/quizzes/${id}/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div>
      <div className="tool-header">
        <h3>Estatisticas do Quiz</h3>
        <button className="btn btn-secondary" onClick={() => navigate(`/dashboard/quiz/${id}`)}>Voltar ao Editor</button>
      </div>
      {loading ? <p>Carregando...</p> : !stats ? (
        <div className="quiz-list-empty">
          <p>Nenhuma sessao encontrada.</p>
          <p className="quiz-list-empty-sub">Compartilhe seu quiz para comecar a receber respostas.</p>
        </div>
      ) : (
        <div className="quiz-stats">
          <div className="quiz-stats-grid">
            <div className="quiz-stats-card">
              <span className="quiz-stats-number">{stats.total}</span>
              <span className="quiz-stats-label">Total de sessoes</span>
            </div>
            <div className="quiz-stats-card">
              <span className="quiz-stats-number">{stats.completed}</span>
              <span className="quiz-stats-label">Concluidas</span>
            </div>
            <div className="quiz-stats-card">
              <span className="quiz-stats-number">{stats.inProgress}</span>
              <span className="quiz-stats-label">Em andamento</span>
            </div>
            <div className="quiz-stats-card">
              <span className="quiz-stats-number">{stats.avgScore.toFixed(1)}</span>
              <span className="quiz-stats-label">Pontuacao media</span>
            </div>
          </div>
          <div className="quiz-stats-sessions">
            <h4>Sessoes recentes</h4>
            {stats.sessions.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma sessao registrada.</p> : (
              <table className="quiz-stats-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Inicio</th>
                    <th>Fim</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.sessions.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{s.id.slice(0, 8)}...</td>
                      <td><span className={`badge ${s.status === 'completed' ? 'ativo' : 'warning'}`}>{s.status}</span></td>
                      <td>{s.score}</td>
                      <td style={{ fontSize: 12 }}>{new Date(s.created_at).toLocaleString('pt-BR')}</td>
                      <td style={{ fontSize: 12 }}>{s.completed_at ? new Date(s.completed_at).toLocaleString('pt-BR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
