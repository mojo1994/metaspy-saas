import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { IconLocked } from '../components/Icons'

interface LogEntry {
  id: number
  campaign_id: string
  ip: string
  user_agent: string
  score: number
  decision: 'redirect' | 'challenge' | 'block' | 'safe_page'
  url_destino: string
  created_at: string
}

export default function CloakerLogs() {
  const { user, fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<string>('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [connected, setConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadLogs()
    let aborted = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    async function connectSSE() {
      const token = localStorage.getItem('metaspy_access_token')
      if (!token) return
      try {
        const res = await fetch('/api/cloaker/logs/sse', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok || !res.body) { setConnected(false); return }
        setConnected(true)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (!aborted) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const entry = JSON.parse(line.slice(6))
                if (entry.connected) continue
                setLogs(prev => [entry, ...prev].slice(0, 200))
              } catch {}
            }
          }
        }
      } catch {}
      if (!aborted) {
        setConnected(false)
        reconnectTimer = setTimeout(connectSSE, 3000)
      }
    }

    connectSSE()
    return () => {
      aborted = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [])

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, autoScroll])

  async function loadLogs() {
    try {
      const res = await fetchWithAuth('/api/cloaker/logs?limit=100')
      if (res.ok) setLogs((await res.json()) || [])
    } catch {}
  }

  const filtered = logs.filter(l =>
    !filter || l.ip.includes(filter) || l.campaign_id.includes(filter) || l.url_destino?.includes(filter)
  )

  function decisionBadge(d: string) {
    const map: Record<string, string> = { redirect: 'badge ativo', challenge: 'badge warning', block: 'badge inativo', safe_page: 'badge neutro' }
    return <span className={map[d] || 'badge'}>{d}</span>
  }

  if (user?.plano !== 'premium') {
    return <div className="tool-locked"><div className="tool-locked-icon"><IconLocked size={24} /></div><h3>Logs de Cloaking</h3><p>Apenas no plano Premium.</p><button className="btn btn-primary" onClick={() => navigate('/planos')}>Ver Planos</button></div>
  }

  return (
    <div>
      <div className="tool-header">
        <h3>Logs de Redirecionamento</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`status ${connected ? 'on' : 'off'}`} style={{ fontSize: 10 }}>SSE {connected ? 'Conectado' : 'Offline'}</span>
          <span className="status on">{logs.length} logs</span>
        </div>
      </div>

      <div className="clone-config-section">
        <div className="clone-config-header">
          <span>Logs ao Vivo</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="text" placeholder="Filtrar por IP, campanha ou URL..." value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 220, padding: '4px 8px', fontSize: 11 }} />
            <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} /> Auto-scroll
            </label>
          </div>
        </div>
        <div style={{ maxHeight: 500, overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              Nenhum log encontrado. Os redirecionamentos aparecerao aqui em tempo real.
            </div>
          ) : (
            filtered.map(l => (
              <div key={l.id} style={{
                display: 'flex', gap: 10, alignItems: 'center', padding: '6px 10px', fontSize: 11,
                borderBottom: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace"
              }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  background: l.decision === 'redirect' ? 'var(--success)' : l.decision === 'challenge' ? 'var(--warning)' : 'var(--danger)'
                }} />
                <div style={{ width: 100, flexShrink: 0, color: 'var(--text-secondary)' }}>{new Date(l.created_at).toLocaleTimeString('pt-BR')}</div>
                <div style={{ width: 130, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)' }}>{l.ip}</div>
                {decisionBadge(l.decision)}
                <div style={{ width: 40, textAlign: 'right', fontWeight: 600, color: l.score >= 70 ? 'var(--danger)' : l.score >= 40 ? 'var(--warning)' : 'var(--success)' }}>{l.score}</div>
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{l.url_destino}</div>
              </div>
            ))
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        <strong>Legenda:</strong> {' '}
        <span style={{ color: 'var(--success)' }}>● Redirect</span> — humano redirecionado para URL de destino {' | '}
        <span style={{ color: 'var(--warning)' }}>● Challenge</span> — suspeito recebe pagina de desafio {' | '}
        <span style={{ color: 'var(--danger)' }}>● Block</span> — bot bloqueado {' | '}
        <span style={{ color: 'var(--text-muted)' }}>● Safe Page</span> — bot redirecionado para pagina segura
      </div>
    </div>
  )
}
