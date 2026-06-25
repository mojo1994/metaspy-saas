import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { IconLocked } from '../components/Icons'

interface Campaign {
  id: string; name: string; default_safe_url: string; is_active: number; created_at: string
}

interface PoolUrl {
  id: string; url: string; weight: number; hit_count: number; max_hits: number | null
}

export default function CloakerCampanhas() {
  const { user, fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [name, setName] = useState('')
  const [safeUrl, setSafeUrl] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [poolUrls, setPoolUrls] = useState<PoolUrl[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [newWeight, setNewWeight] = useState('10')
  const [newMaxHits, setNewMaxHits] = useState('')
  const [hmacLink, setHmacLink] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { loadCampaigns() }, [])

  async function loadCampaigns() {
    const res = await fetchWithAuth('/api/cloaker/campaigns')
    if (res.ok) setCampaigns(await res.json())
  }

  async function createCampaign() {
    setError('')
    if (!name || !safeUrl) { setError('Nome e URL obrigatorios'); return }
    const res = await fetchWithAuth('/api/cloaker/campaign', {
      method: 'POST',
      body: JSON.stringify({ name, default_safe_url: safeUrl })
    })
    if (!res.ok) { setError((await res.json()).error || 'Erro'); return }
    setName(''); setSafeUrl('')
    await loadCampaigns()
  }

  function selectCampaign(c: Campaign) {
    setSelectedId(c.id)
    setPoolUrls([])
    setNewUrl(''); setNewWeight('10'); setNewMaxHits('')
    setHmacLink(`${window.location.origin}/go/${c.id}`)
  }

  async function addUrl() {
    setError('')
    if (!newUrl) { setError('URL obrigatoria'); return }
    const res = await fetchWithAuth(`/api/cloaker/campaign/${selectedId}/url`, {
      method: 'POST',
      body: JSON.stringify({ url: newUrl, weight: parseInt(newWeight) || 10, max_hits: parseInt(newMaxHits) || null })
    })
    if (!res.ok) { setError((await res.json()).error || 'Erro'); return }
    setNewUrl('')
    const urls = await fetchWithAuth(`/api/cloaker/campaign/${selectedId}/urls`)
    if (urls.ok) setPoolUrls(await urls.json())
  }

  if (user?.plano !== 'premium') {
    return <div className="tool-locked"><div className="tool-locked-icon"><IconLocked size={24} /></div><h3>Campanhas</h3><p>Apenas no plano Premium.</p><button className="btn btn-primary" onClick={() => navigate('/planos')}>Ver Planos</button></div>
  }

  return (
    <div>
      <div className="tool-header">
        <h3>Campanhas de Cloaking</h3>
        <span className={`status ${campaigns.length > 0 ? 'on' : 'off'}`}>{campaigns.length} campanhas</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Crie campanhas com multiplas URLs de destino e links assinados HMAC. O sistema faz rotacao ponderada
        entre as URLs e redireciona em 3 estagios (302 → meta-refresh → JS) para burlar scanners.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="clone-config-section">
          <div className="clone-config-header">Nova Campanha</div>
          <div className="clone-config-body" style={{ gap: 10 }}>
            <div className="filter-group">
              <label>Nome da campanha</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Campanha AM 01" />
            </div>
            <div className="filter-group">
              <label>URL segura padrao (para bots)</label>
              <input type="url" value={safeUrl} onChange={e => setSafeUrl(e.target.value)} placeholder="https://exemplo.com/seguro" />
            </div>
            {error && <div className="alerta">{error}</div>}
            <button className="btn btn-gradient" onClick={createCampaign}>Criar Campanha</button>
          </div>
        </div>

        <div className="clone-config-section">
          <div className="clone-config-header">Suas Campanhas</div>
          <div className="clone-config-body" style={{ gap: 6, maxHeight: 300, overflow: 'auto' }}>
            {campaigns.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhuma campanha ainda.</div> : (
              campaigns.map(c => (
                <div key={c.id} className={`clone-job-card${selectedId === c.id ? '' : ''}`} onClick={() => selectCampaign(c)} style={{ cursor: 'pointer', border: selectedId === c.id ? '1px solid var(--purple-400)' : '1px solid var(--border)' }}>
                  <div className="clone-job-top"><span className="badge ativo">{c.name}</span></div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Safe: {c.default_safe_url}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleString('pt-BR')}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedId && (
        <div style={{ marginTop: 16 }}>
          <div className="clone-config-section">
            <div className="clone-config-header">Link de Redirecionamento</div>
            <div className="clone-config-body" style={{ gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="text" value={hmacLink} readOnly style={{ flex: 1, fontSize: 11 }} />
                <button className="btn btn-secondary" onClick={() => { navigator.clipboard.writeText(hmacLink) }}>Copiar Link</button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Use este link no seu gerenciador de anuncios. O sistema detecta bots automaticamente
                e redireciona humanos para a URL de destino com chain 3-estagios.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
            <div className="clone-config-section">
              <div className="clone-config-header">Adicionar URL ao Pool</div>
              <div className="clone-config-body" style={{ gap: 8 }}>
                <div className="filter-group">
                  <label>URL de destino</label>
                  <input type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://exemplo.com/oferta" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div className="filter-group" style={{ flex: 1 }}>
                    <label>Peso</label>
                    <input type="number" value={newWeight} onChange={e => setNewWeight(e.target.value)} min={1} max={100} />
                  </div>
                  <div className="filter-group" style={{ flex: 1 }}>
                    <label>Max hits</label>
                    <input type="number" value={newMaxHits} onChange={e => setNewMaxHits(e.target.value)} placeholder="Ilimitado" />
                  </div>
                </div>
                <button className="btn btn-gradient" onClick={addUrl}>Adicionar URL</button>
              </div>
            </div>
            <div className="clone-config-section">
              <div className="clone-config-header">URLs no Pool ({poolUrls.length})</div>
              <div className="clone-config-body" style={{ gap: 4, maxHeight: 200, overflow: 'auto' }}>
                {poolUrls.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhuma URL no pool.</div> : (
                  poolUrls.map(u => (
                    <div key={u.id} style={{ fontSize: 11, padding: '6px 8px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.url}</div>
                      <div style={{ color: 'var(--text-muted)' }}>Peso: {u.weight} | Hits: {u.hit_count}{u.max_hits ? ` / ${u.max_hits}` : ''}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
