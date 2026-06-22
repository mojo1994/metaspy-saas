import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function DashboardPages() {
  const { fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const [pages, setPages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWithAuth('/api/pages')
      .then(r => r.json())
      .then(data => { setPages(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function deletar(id: string) {
    if (!confirm('Deletar esta pagina?')) return
    await fetchWithAuth(`/api/pages/${id}`, { method: 'DELETE' })
    setPages(p => p.filter(x => x.id !== id))
  }

  function copyLink(slug: string) {
    navigator.clipboard.writeText(`https://centralspyads.netlify.app/p/${slug}`)
  }

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h3>Paginas</h3>
        <button className="btn btn-gradient" onClick={() => navigate('/dashboard/paginas/nova')} style={{ fontSize: 13 }}>
          + Nova Pagina
        </button>
      </div>

      {loading ? <p style={{ color: 'var(--text-muted)' }}>Carregando...</p> : (
        pages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <p>Nenhuma pagina publicada ainda.</p>
            <button className="btn btn-gradient" onClick={() => navigate('/dashboard/paginas/nova')} style={{ marginTop: 12 }}>
              Criar primeira pagina
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pages.map(p => (
              <div key={p.id} style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {p.slug} • {p.updated_at?.slice(0, 10)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary" onClick={() => copyLink(p.slug)} style={{ fontSize: 11, padding: '4px 10px' }}>
                    Copiar Link
                  </button>
                  <button className="btn btn-accent" onClick={() => navigate(`/dashboard/paginas/editar/${p.id}`)} style={{ fontSize: 11, padding: '4px 10px' }}>
                    Editar
                  </button>
                  <button className="btn btn-secondary" onClick={() => deletar(p.id)} style={{ fontSize: 11, padding: '4px 10px', color: 'var(--danger)' }}>
                    Deletar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
