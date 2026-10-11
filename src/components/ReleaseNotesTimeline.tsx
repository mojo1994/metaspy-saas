import { useEffect, useState } from 'react'

interface ReleaseChange {
  type: 'novo' | 'correcao' | 'melhoria' | 'seguranca'
  description: string
}

interface ReleaseNote {
  id: string
  version: string
  title: string
  release_date: string
  category: 'seguranca' | 'novo' | 'correcao' | 'melhoria'
  changes: ReleaseChange[]
  created_at: string
}

const CATEGORY_BADGE: Record<string, string> = {
  seguranca: 'alta',
  novo: 'ativo',
  correcao: 'info',
  melhoria: 'info',
}

const CATEGORY_LABEL: Record<string, string> = {
  seguranca: 'Segurança',
  novo: 'Novo',
  correcao: 'Correção',
  melhoria: 'Melhoria',
}

const CHANGE_TYPE_LABEL: Record<string, string> = {
  novo: 'Novo',
  correcao: 'Correção',
  melhoria: 'Melhoria',
  seguranca: 'Segurança',
}

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('pt-BR')
}

export default function ReleaseNotesTimeline() {
  const [notes, setNotes] = useState<ReleaseNote[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const PAGE_SIZE = 20

  async function loadNotes(offset: number) {
    const res = await fetch(`/api/release-notes?limit=${PAGE_SIZE}&offset=${offset}`)
    if (!res.ok) throw new Error('Falha ao carregar')
    return res.json() as Promise<{ notes: ReleaseNote[]; total: number }>
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    loadNotes(0)
      .then(data => {
        if (!alive) return
        setNotes(data.notes || [])
        setTotal(data.total || 0)
      })
      .catch(() => alive && setError('Não foi possível carregar o histórico.'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const data = await loadNotes(notes.length)
      setNotes(prev => [...prev, ...(data.notes || [])])
      setTotal(data.total || 0)
    } catch {
      setError('Não foi possível carregar mais itens.')
    }
    setLoadingMore(false)
  }

  if (loading) {
    return (
      <div className="release-timeline" aria-busy="true" aria-live="polite">
        {[0, 1, 2].map(i => (
          <div key={i} className="release-card skeleton-card">
            <div className="skeleton skeleton-line" style={{ width: '30%' }} />
            <div className="skeleton skeleton-line" style={{ width: '70%' }} />
            <div className="skeleton skeleton-line" style={{ width: '55%' }} />
          </div>
        ))}
      </div>
    )
  }

  if (error && !notes.length) {
    return <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{error}</p>
  }

  if (!notes.length) {
    return <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhuma atualização publicada ainda.</p>
  }

  return (
    <div className="release-timeline">
      {notes.map(note => (
        <article
          key={note.id}
          className="release-card"
          aria-label={`Versão ${note.version}, ${formatDate(note.release_date)}`}
        >
          <div className="release-card-head">
            <div className="release-version">v{note.version}</div>
            <span className={`badge ${CATEGORY_BADGE[note.category] || 'info'}`}>
              {CATEGORY_LABEL[note.category] || note.category}
            </span>
            <time className="release-date" dateTime={note.release_date}>{formatDate(note.release_date)}</time>
          </div>
          <h4 className="release-title">{note.title}</h4>
          <ul className="release-changes">
            {note.changes?.map((c, i) => (
              <li key={i} className={`release-change change-${c.type}`}>
                <span className={`badge ${CATEGORY_BADGE[c.type] || 'info'}`} style={{ marginRight: 8 }}>
                  {CHANGE_TYPE_LABEL[c.type] || c.type}
                </span>
                <span>{c.description}</span>
              </li>
            ))}
          </ul>
        </article>
      ))}

      {notes.length < total && (
        <button type="button" className="btn btn-secondary" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </div>
  )
}
