import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { IconCheck, IconDash, IconStar, IconLogo } from '../components/Icons'

const FEATURES_BASICO = [
  { label: 'Clonador de Paginas', ok: true },
  { label: 'MetaSpy Minerador de Ads', ok: true },
  { label: 'Editor Visual de Paginas', ok: false },
  { label: 'Estrutura de Arquivos + ZIP', ok: false },
  { label: 'Cloacker Profissional', ok: false },
  { label: 'Analise Avancada de Ofertas', ok: false },
  { label: 'Bypass Engine Multicamada', ok: false },
  { label: 'Remover Metadados', ok: false },
  { label: 'Suporte Prioritario', ok: false },
]

const FEATURES_GOLD = [
  { label: 'Clonador de Paginas', ok: true },
  { label: 'MetaSpy Minerador de Ads', ok: true },
  { label: 'Editor Visual de Paginas', ok: true },
  { label: 'Estrutura de Arquivos + ZIP', ok: true },
  { label: 'Cloacker Profissional', ok: true },
  { label: 'Analise Avancada de Ofertas', ok: true },
  { label: 'Bypass Engine Multicamada', ok: true },
  { label: 'Remover Metadados', ok: false },
  { label: 'Suporte Prioritario', ok: true },
]

const FEATURES_PREMIUM = [
  { label: 'Clonador de Paginas', ok: true },
  { label: 'MetaSpy Minerador de Ads', ok: true },
  { label: 'Editor Visual de Paginas', ok: true },
  { label: 'Estrutura de Arquivos + ZIP', ok: true },
  { label: 'Cloacker Profissional', ok: true },
  { label: 'Analise Avancada de Ofertas', ok: true },
  { label: 'Bypass Engine Multicamada', ok: true },
  { label: 'Remover Metadados', ok: true },
  { label: 'Suporte Prioritario', ok: true },
]

const ALL_FEATURES = [
  'Clonador de Paginas',
  'MetaSpy Minerador de Ads',
  'Editor Visual de Paginas',
  'Estrutura de Arquivos + ZIP',
  'Cloacker Profissional',
  'Analise Avancada de Ofertas',
  'Bypass Engine Multicamada',
  'Remover Metadados',
  'Suporte Prioritario',
]

const DEPOIMENTOS = [
  { nome: 'Rafael M.', cargo: 'Afiliado, 2 anos', texto: 'O MetaSpy mudou completamente minha forma de analisar ofertas. Em 3 meses passei de R$3k para R$15k/mês.' },
  { nome: 'Camila S.', cargo: 'Media Buyer', texto: 'O clonador + editor é absurdo de bom. Editar página em tempo real direto no canvas é outro nível.' },
  { nome: 'Lucas O.', cargo: 'Diretor de Tráfego', texto: 'Uso o cloacker em todas as campanhas. Zero denúncias desde que comecei a usar. Vale cada centavo.' },
]

export default function Planos() {
  const { isAuthenticated, fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleCheckout(plan: string) {
    if (!isAuthenticated) { navigate('/signup?redirect=planos'); return }
    setLoading(plan)
    try {
      const resp = await fetchWithAuth('/api/subscription/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ plan })
      })
      const data = await resp.json()
      if (data.checkoutUrl) window.location.href = data.checkoutUrl
    } catch {}
    setLoading(null)
  }

  return (
    <div className="planos-page">
      <div className="planos-bg" />

      <nav className="planos-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="sidebar-logo-icon" style={{ width: 28, height: 28 }}>
            <IconLogo size={18} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>MetaSpy</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAuthenticated ? (
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Dashboard</button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => navigate('/login')}>Entrar</button>
              <button className="btn btn-gradient" onClick={() => navigate('/signup')}>Criar Conta</button>
            </>
          )}
        </div>
      </nav>

      <section className="planos-hero">
        <div className="planos-hero-badge">ACESSO IMEDIATO • CANCELAMENTO LIVRE</div>
        <h1>Escolha seu Arsenal de Guerra</h1>
        <p className="planos-subtitle">
          As ferramentas que os top players usam para escalar ofertas no Meta Ads. <br />
          Sem plano free. Sem enrolação. Resultado do primeiro dia.
        </p>
      </section>

      <section className="planos-cards">
        <div className="planos-card">
          <div className="planos-card-header">
            <h2>Basico</h2>
            <p className="planos-card-desc">Para quem quer comecar a escalar agora</p>
          </div>
          <div className="planos-card-price">
            <span className="planos-original">R$ 97</span>
            <span className="planos-current">R$ 49,90</span>
            <span className="planos-period">/mes</span>
          </div>
          <ul className="planos-features">
            {FEATURES_BASICO.map(f => (
              <li key={f.label} className={f.ok ? '' : 'off'}>
                <span className="planos-check">{f.ok ? <IconCheck size={12} /> : <IconDash size={12} />}</span>
                {f.label}
              </li>
            ))}
          </ul>
          <button className="btn btn-primary planos-cta" onClick={() => handleCheckout('basico')} disabled={loading === 'basico'}>
            {loading === 'basico' ? 'Redirecionando...' : 'Assinar Agora'}
          </button>
        </div>

        <div className="planos-card planos-card-destaque">
          <div className="planos-card-badge">MELHOR VALOR</div>
          <div className="planos-card-header">
            <h2>Gold</h2>
            <p className="planos-card-desc">O pacote completo para maquinas de guerra</p>
          </div>
          <div className="planos-card-price">
            <span className="planos-original">R$ 197</span>
            <span className="planos-current">R$ 97,00</span>
            <span className="planos-period">/mes</span>
          </div>
          <ul className="planos-features">
            {FEATURES_GOLD.map(f => (
              <li key={f.label} className={f.ok ? '' : 'off'}>
                <span className="planos-check">{f.ok ? <IconCheck size={12} /> : <IconDash size={12} />}</span>
                {f.label}
              </li>
            ))}
          </ul>
          <button className="btn btn-gradient planos-cta" onClick={() => handleCheckout('gold')} disabled={loading === 'gold'}>
            {loading === 'gold' ? 'Redirecionando...' : 'Assinar Agora'}
          </button>
        </div>

        <div className="planos-card">
          <div className="planos-card-header">
            <h2>Premium</h2>
            <p className="planos-card-desc">Todas as ferramentas sem limites</p>
          </div>
          <div className="planos-card-price">
            <span className="planos-original">R$ 397</span>
            <span className="planos-current">R$ 197,00</span>
            <span className="planos-period">/mes</span>
          </div>
          <ul className="planos-features">
            {FEATURES_PREMIUM.map(f => (
              <li key={f.label} className={f.ok ? '' : 'off'}>
                <span className="planos-check">{f.ok ? <IconCheck size={12} /> : <IconDash size={12} />}</span>
                {f.label}
              </li>
            ))}
          </ul>
          <button className="btn btn-primary planos-cta" onClick={() => handleCheckout('premium')} disabled={loading === 'premium'}>
            {loading === 'premium' ? 'Redirecionando...' : 'Assinar Agora'}
          </button>
        </div>
      </section>

      <section className="planos-comparison">
        <h2>Comparativo Completo</h2>
        <div className="planos-table">
          <div className="planos-table-row header">
            <div className="planos-table-cell">Funcionalidade</div>
            <div className="planos-table-cell">Basico</div>
            <div className="planos-table-cell">Gold</div>
            <div className="planos-table-cell">Premium</div>
          </div>
          {ALL_FEATURES.map(f => (
            <div key={f} className="planos-table-row">
              <div className="planos-table-cell">{f}</div>
              <div className={`planos-table-cell ${FEATURES_BASICO.find(x => x.label === f)?.ok ? 'check' : ''}`}>
                {FEATURES_BASICO.find(x => x.label === f)?.ok ? <IconCheck size={12} /> : <IconDash size={12} />}
              </div>
              <div className={`planos-table-cell ${FEATURES_GOLD.find(x => x.label === f)?.ok ? 'check' : ''}`}>
                {FEATURES_GOLD.find(x => x.label === f)?.ok ? <IconCheck size={12} /> : <IconDash size={12} />}
              </div>
              <div className={`planos-table-cell check`}><IconCheck size={12} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="planos-depoimentos">
        <h2>Quem usa, recomenda</h2>
        <div className="planos-depoimentos-grid">
          {DEPOIMENTOS.map(d => (
            <div key={d.nome} className="planos-depoimento-card">
              <div className="planos-depoimento-stars">
                <IconStar size={14} /><IconStar size={14} /><IconStar size={14} /><IconStar size={14} /><IconStar size={14} />
              </div>
              <p className="planos-depoimento-texto">"{d.texto}"</p>
              <div className="planos-depoimento-autor">
                <strong>{d.nome}</strong>
                <span>{d.cargo}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="planos-faq">
        <h2>Duvidas Frequentes</h2>
        <div className="planos-faq-grid">
          {[
            { p: 'Posso cancelar quando quiser?', r: 'Sim. Cancele a qualquer momento. Seu acesso continua ate o fim do periodo pago.' },
            { p: 'O pagamento e seguro?', r: 'Totalmente. Processamos via Kirvano com cartao, Pix ou boleto. Seus dados estao protegidos.' },
            { p: 'Funciona para qualquer nicho?', r: 'Sim. O MetaSpy funciona para Nutra, Info, Ecommerce, leads e qualquer vertical do Meta Ads.' },
            { p: 'Precisa de conhecimento tecnico?', r: 'Nao. A ferramenta foi feita para ser usada por afiliados, media buyers e diretos sem experiencia em programacao.' },
            { p: 'Qual a diferenca entre os planos?', r: 'O Basico da acesso ao Clonador de Paginas e MetaSpy Minerador. O Gold libera todas as ferramentas exceto Remover Metadados. O Premium libera todas as ferramentas sem excecao.' },
          ].map(faq => (
            <details key={faq.p} className="planos-faq-item">
              <summary>{faq.p}</summary>
              <p>{faq.r}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="planos-cta-bottom">
        <h2>Pronto para escalar?</h2>
        <p>Junte-se a centenas de profissionais que ja usam o MetaSpy para dominar o Meta Ads.</p>
        <button className="btn btn-gradient" style={{ padding: '14px 40px', fontSize: 16 }} onClick={() => handleCheckout('basico')}>
          COMECAR AGORA
        </button>
      </section>

      <footer className="planos-footer">
        <p>MetaSpy © 2026 — Inteligencia de ofertas em escala. By Banshee.ads</p>
      </footer>
    </div>
  )
}
