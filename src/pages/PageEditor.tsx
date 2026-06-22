import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function PageEditor() {
  const { fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const [title, setTitle] = useState('')
  const [html, setHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [slug, setSlug] = useState('')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!isEdit) return
    fetchWithAuth(`/api/pages/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { navigate('/dashboard/paginas'); return }
        setTitle(data.title)
        setHtml(data.html)
        setSlug(data.slug)
      })
  }, [id])

  useEffect(() => {
    if (!iframeRef.current || !html) return
    const doc = iframeRef.current.contentDocument
    if (doc) {
      doc.open()
      doc.write(html)
      doc.close()
    }
  }, [html])

  async function save() {
    if (!title.trim()) { setMsg('Defina um titulo.'); return }
    if (!html.trim()) { setMsg('Adicione o HTML da pagina.'); return }
    setSaving(true); setMsg('')
    try {
      const url = isEdit ? `/api/pages/${id}` : '/api/pages'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), html }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg(data.error || 'Erro'); setSaving(false); return }
      setSlug(data.slug)
      setMsg(isEdit ? 'Salvo!' : 'Pagina criada!')
      if (!isEdit) navigate(`/dashboard/paginas/editar/${data.id}`, { replace: true })
    } catch { setMsg('Erro de conexao.') }
    setSaving(false)
  }

  function copyLink() {
    if (!slug) return
    navigator.clipboard.writeText(`https://centralspyads.netlify.app/p/${slug}`)
    setMsg('Link copiado!')
  }

  return (
    <div className="tool-page" style={{ maxWidth: '100%' }}>
      <div className="tool-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard/paginas')} style={{ fontSize: 12, padding: '4px 10px' }}>←</button>
          <h3 style={{ margin: 0 }}>{isEdit ? 'Editar Pagina' : 'Nova Pagina'}</h3>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {slug && (
            <button className="btn btn-secondary" onClick={copyLink} style={{ fontSize: 12, padding: '6px 14px' }}>
              Copiar Link
            </button>
          )}
          <button className="btn btn-gradient" onClick={save} disabled={saving} style={{ fontSize: 12, padding: '6px 14px' }}>
            {saving ? 'Salvando...' : 'Publicar'}
          </button>
        </div>
      </div>

      {msg && <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: msg === 'Salvo!' || msg === 'Pagina criada!' || msg === 'Link copiado!' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: msg === 'Salvo!' || msg === 'Pagina criada!' || msg === 'Link copiado!' ? 'var(--success)' : 'var(--danger)', marginBottom: 12 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Titulo da pagina"
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: 15,
            fontWeight: 600,
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, height: 'calc(100vh - 280px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>HTML</label>
          <textarea
            value={html}
            onChange={e => setHtml(e.target.value)}
            placeholder="<html><body><h1>Minha pagina</h1></body></html>"
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              fontSize: 13,
              resize: 'none',
              whiteSpace: 'pre-wrap',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Preview</label>
          <iframe
            ref={iframeRef}
            title="preview"
            sandbox="allow-scripts allow-same-origin"
            style={{
              flex: 1,
              width: '100%',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: '#fff',
            }}
          />
        </div>
      </div>
    </div>
  )
}
