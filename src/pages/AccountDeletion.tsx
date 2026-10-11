import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import LegalPage from '../components/LegalPage'
import { useAuth } from '../contexts/AuthContext'

export default function AccountDeletion() {
  const { isAuthenticated, fetchWithAuth } = useAuth()
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState<{ scheduled_for: string } | null>(null)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    fetchWithAuth('/api/account/deletion-status')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.request) setPending(d.request) })
      .catch(() => {})
  }, [isAuthenticated, fetchWithAuth])

  async function requestDeletion(e: FormEvent) {
    e.preventDefault()
    setErro(''); setMsg('')
    if (!password) { setErro('Informe sua senha para confirmar.'); return }
    setLoading(true)
    try {
      const res = await fetchWithAuth('/api/account/deletion-request', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErro(data.error || 'Erro ao solicitar exclusão.'); return }
      setPending({ scheduled_for: data.scheduledFor })
      setMsg('Solicitação registrada. Sua conta será excluída após o prazo de 7 dias.')
      setPassword('')
    } catch { setErro('Erro de conexão.') }
    setLoading(false)
  }

  async function cancelDeletion() {
    setErro(''); setMsg('')
    setLoading(true)
    try {
      const res = await fetchWithAuth('/api/account/deletion-cancel', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErro(data.error || 'Erro ao cancelar.'); return }
      setPending(null)
      setMsg('Exclusão cancelada. Sua conta está segura.')
    } catch { setErro('Erro de conexão.'); }
    setLoading(false)
  }

  return (
    <LegalPage title="Exclusão de Conta" updatedAt="11/10/2026">
      <p>
        Você pode solicitar a exclusão definitiva da sua conta MetaSpy a qualquer momento. O processo segue as
        diretrizes da LGPD e respeita uma janela de arrependimento de <strong>7 dias</strong>.
      </p>

      <h3>O que será excluído</h3>
      <ul>
        <li>Dados de cadastro (nome, e-mail, senha e preferências);</li>
        <li>Páginas criadas/hospedadas e seus arquivos;</li>
        <li>Arquivos processados no Removedor de Metadados;</li>
        <li>Scripts de cloaking e registros de uso vinculados à sua conta.</li>
      </ul>

      <h3>O que pode ser mantido</h3>
      <p>
        Registros de pagamento podem ser mantidos pelo prazo exigido pela legislação fiscal, mesmo após a exclusão
        da conta. Esses dados são mantidos apenas para cumprimento de obrigação legal.
      </p>

      <h3>Como funciona</h3>
      <ol>
        <li>Você solicita a exclusão confirmando sua senha.</li>
        <li>A conta fica em uma janela de 7 dias, durante a qual você pode cancelar.</li>
        <li>Após esse prazo, todos os dados aplicáveis são excluídos definitivamente.</li>
      </ol>
      <p><strong>A exclusão é irreversível após o prazo de 7 dias.</strong></p>

      {!isAuthenticated ? (
        <p style={{ marginTop: 20 }}>
          Para excluir sua conta, <Link to="/login" style={{ color: 'var(--purple-400)' }}>faça login</Link> primeiro.
        </p>
      ) : pending ? (
        <div style={{ marginTop: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 12 }}>
          <p style={{ marginBottom: 12 }}>
            Exclusão agendada para <strong>{new Date(pending.scheduled_for).toLocaleDateString('pt-BR')}</strong>.
          </p>
          <button className="btn btn-gradient" onClick={async () => {
            setLoading(true); setErro(''); setMsg('')
            try {
              const res = await fetchWithAuth('/api/account/deletion-cancel', { method: 'POST' })
              const data = await res.json().catch(() => ({}))
              if (!res.ok) { setErro(data.error || 'Erro ao cancelar exclusão.'); return }
              setPending(null)
              setMsg('Solicitação de exclusão cancelada.')
            } catch { setErro('Erro de conexão.') }
            setLoading(false)
          }} disabled={loading}>
            {loading ? 'Processando...' : 'Cancelar exclusão'}
          </button>
          {erro && <p style={{ color: 'var(--danger, #ef4444)', marginTop: 8, fontSize: 12 }}>{erro}</p>}
          {msg && <p style={{ color: 'var(--success, #10b981)', marginTop: 8, fontSize: 12 }}>{msg}</p>}
        </div>
      ) : (
        <form onSubmit={requestDeletion} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
          {erro && <div className="auth-error">{erro}</div>}
          {msg && <div className="auth-error" style={{ background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--success)' }}>{msg}</div>}
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Confirme sua senha
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha atual" style={{ display: 'block', width: '100%', marginTop: 6 }} />
          </label>
          <button type="submit" className="btn btn-gradient" disabled={loading}>
            {loading ? 'Processando...' : 'Solicitar exclusão da conta'}
          </button>
        </form>
      )}
    </LegalPage>
  )
}
