import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

const LEGAL_LINKS = [
  { to: '/privacidade', label: 'Privacidade' },
  { to: '/cookies', label: 'Cookies' },
  { to: '/excluir-conta', label: 'Exclusão de Conta' },
  { to: '/redefinir-senha', label: 'Redefinir Senha' },
]

export default function LegalPage({ title, updatedAt, children }: { title: string; updatedAt?: string; children: ReactNode }) {
  return (
    <div className="auth-page" style={{ alignItems: 'flex-start', paddingTop: 40 }}>
      <div className="clone-progress-card" style={{ maxWidth: 820, width: '100%', padding: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</h1>
        {updatedAt && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>Última atualização: {updatedAt}</p>}
        <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>{children}</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 28, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          {LEGAL_LINKS.map(l => (
            <Link key={l.to} to={l.to} style={{ fontSize: 12, color: 'var(--purple-400)' }}>{l.label}</Link>
          ))}
          <Link to="/planos" style={{ fontSize: 12, color: 'var(--purple-400)', marginLeft: 'auto' }}>← Voltar</Link>
        </div>
      </div>
    </div>
  )
}
