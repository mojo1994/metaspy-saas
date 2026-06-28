import { useEffect, useRef } from 'react'
import { Undo2, Redo2, Save, Eye, EyeOff } from 'lucide-react'
import { useQuizStore } from '../../stores/quizStore'
import { useAuth } from '../../contexts/AuthContext'

export default function QuizTopBar({ quizId }: { quizId: string }) {
  const { fetchWithAuth } = useAuth()
  const title = useQuizStore(s => s.currentQuiz?.title || '')
  const setTitle = useQuizStore(s => s.setTitle)
  const isDirty = useQuizStore(s => s.isDirty)
  const isSaving = useQuizStore(s => s.isSaving)
  const isPreview = useQuizStore(s => s.isPreview)
  const togglePreview = useQuizStore(s => s.togglePreview)
  const saveQuiz = useQuizStore(s => s.saveQuiz)
  const undo = useQuizStore(s => s.undo)
  const redo = useQuizStore(s => s.redo)
  const past = useQuizStore(s => s.past)
  const future = useQuizStore(s => s.future)
  const publishQuiz = useQuizStore(s => s.publishQuiz)
  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!isDirty) return
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => saveQuiz(fetchWithAuth), 30000)
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current) }
  }, [isDirty, saveQuiz, fetchWithAuth])

  return (
    <div className="quiz-topbar">
      <div className="quiz-topbar-left">
        <input
          type="text"
          className="quiz-topbar-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Nome do Quiz"
        />
        <span className={`quiz-topbar-dot ${isDirty ? 'quiz-dot-unsaved' : 'quiz-dot-saved'}`} title={isDirty ? 'Nao salvo' : 'Salvo'} />
        {isSaving && <span className="quiz-topbar-saving">Salvando...</span>}
      </div>
      <div className="quiz-topbar-center">
        <button className="quiz-topbar-btn" onClick={undo} disabled={past.length === 0} title="Desfazer (Ctrl+Z)"><Undo2 size={14} /></button>
        <button className="quiz-topbar-btn" onClick={redo} disabled={future.length === 0} title="Refazer (Ctrl+Shift+Z)"><Redo2 size={14} /></button>
      </div>
      <div className="quiz-topbar-right">
        <span className="quiz-topbar-version">v{useQuizStore(s => s.savedVersion)}</span>
        <button className="quiz-topbar-btn" onClick={() => saveQuiz(fetchWithAuth)} title="Salvar"><Save size={14} /></button>
        <label className="quiz-topbar-toggle">
          <input type="checkbox" checked={isPreview} onChange={togglePreview} />
          {isPreview ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>{isPreview ? 'Editar' : 'Preview'}</span>
        </label>
        {!isPreview && (
          <button className="quiz-topbar-publish" onClick={async () => {
            const ok = await publishQuiz(fetchWithAuth)
            if (ok) alert('Quiz publicado com sucesso!')
            else alert('Erro ao publicar quiz')
          }}>Publicar</button>
        )}
      </div>
    </div>
  )
}
