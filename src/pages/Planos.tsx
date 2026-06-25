import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Check, Minus, Star, Sparkle, ArrowRight } from '@phosphor-icons/react'

const FEATURES_BASICO = [
  { label: 'Clonador de Páginas', ok: true },
  { label: 'MetaSpy Minerador de Ads', ok: true },
  { label: 'Filtros Inteligentes', ok: true },
  { label: 'Editor Visual de Páginas', ok: false },
  { label: 'Exportação CSV', ok: false },
  { label: 'Estrutura de Arquivos + ZIP', ok: false },
  { label: 'Análise Avançada de Ofertas', ok: false },
  { label: 'Bypass Engine Multicamada', ok: false },
  { label: 'Cloacker Profissional', ok: false },
  { label: 'Remover Metadados', ok: false },
  { label: 'Suporte Prioritário', ok: false },
]

const FEATURES_GOLD = [
  { label: 'Clonador de Páginas', ok: true },
  { label: 'MetaSpy Minerador de Ads', ok: true },
  { label: 'Filtros Inteligentes', ok: true },
  { label: 'Editor Visual de Páginas', ok: true },
  { label: 'Exportação CSV', ok: true },
  { label: 'Estrutura de Arquivos + ZIP', ok: true },
  { label: 'Análise Avançada de Ofertas', ok: true },
  { label: 'Bypass Engine Multicamada', ok: true },
  { label: 'Cloacker Profissional', ok: true },
  { label: 'Remover Metadados', ok: false },
  { label: 'Suporte Prioritário', ok: true },
]

const FEATURES_PREMIUM = [
  { label: 'Clonador de Páginas', ok: true },
  { label: 'MetaSpy Minerador de Ads', ok: true },
  { label: 'Filtros Inteligentes', ok: true },
  { label: 'Editor Visual de Páginas', ok: true },
  { label: 'Exportação CSV', ok: true },
  { label: 'Estrutura de Arquivos + ZIP', ok: true },
  { label: 'Análise Avançada de Ofertas', ok: true },
  { label: 'Bypass Engine Multicamada', ok: true },
  { label: 'Cloacker Profissional', ok: true },
  { label: 'Remover Metadados', ok: true },
  { label: 'Suporte Prioritário', ok: true },
]

const ALL_FEATURES = [
  'Clonador de Páginas',
  'MetaSpy Minerador de Ads',
  'Filtros Inteligentes',
  'Editor Visual de Páginas',
  'Exportação CSV',
  'Estrutura de Arquivos + ZIP',
  'Análise Avançada de Ofertas',
  'Bypass Engine Multicamada',
  'Cloacker Profissional',
  'Remover Metadados',
  'Suporte Prioritário',
]

const DEPOIMENTOS = [
  { nome: 'Rafael M.', cargo: 'Afiliado, 2 anos', texto: 'O MetaSpy mudou completamente minha forma de analisar ofertas. Em 3 meses passei de R$3k para R$15k/mês.' },
  { nome: 'Camila S.', cargo: 'Media Buyer', texto: 'O clonador + editor é absurdo de bom. Editar página em tempo real direto no canvas é outro nível.' },
  { nome: 'Lucas O.', cargo: 'Diretor de Tráfego', texto: 'Uso o cloacker em todas as campanhas. Zero denúncias desde que comecei a usar. Vale cada centavo.' },
]

const PLAN_CARD_DATA = [
  {
    key: 'basico',
    title: 'Básico',
    description: 'Para quem quer começar a escalar agora',
    original: 'R$ 97',
    current: 'R$ 57,90',
    button: 'Assinar Agora',
    features: FEATURES_BASICO,
    className: 'plan-card-basic',
    highlighted: false,
  },
  {
    key: 'gold',
    title: 'Gold',
    description: 'O pacote completo para máquinas de guerra',
    original: 'R$ 197',
    current: 'R$ 97,00',
    button: 'Assinar Agora',
    features: FEATURES_GOLD,
    className: 'plan-card-gold',
    highlighted: true,
  },
  {
    key: 'premium',
    title: 'Premium',
    description: 'Todas as ferramentas sem limites',
    original: 'R$ 397',
    current: 'R$ 197,00',
    button: 'Assinar Agora',
    features: FEATURES_PREMIUM,
    className: 'plan-card-premium',
    highlighted: false,
  },
] as const

function revealStyle(delayMs: number): CSSProperties {
  return { ['--reveal-delay' as never]: `${delayMs}ms` } as CSSProperties
}

export default function Planos() {
  const { isAuthenticated, fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (targets.length === 0) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      targets.forEach(target => target.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' })

    targets.forEach(target => observer.observe(target))
    return () => observer.disconnect()
  }, [])

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

      <section className="planos-hero">
        <div className="planos-hero-inner">
          <div className="planos-hero-badge reveal-lift" data-reveal style={revealStyle(0)}>
            ACESSO IMEDIATO • CANCELAMENTO LIVRE
          </div>
          <h1 className="reveal-lift planos-hero-title" data-reveal style={revealStyle(120)}>
            Escolha o Plano Ideal para Escalar suas Campanhas
          </h1>
          <p className="planos-subtitle reveal-lift" data-reveal style={revealStyle(240)}>
            As ferramentas que os top players usam para escalar ofertas no Meta Ads. <br />
            Sem plano free. Sem enrolação. Resultado do primeiro dia.
          </p>
          <div className="planos-hero-cta-row" data-reveal style={revealStyle(360)}>
            {isAuthenticated ? (
              <button type="button" className="btn btn-gradient planos-hero-cta" onClick={() => navigate('/dashboard')}>
                Ir para o Dashboard <ArrowRight size={18} weight="regular" />
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-gradient planos-hero-cta" onClick={() => navigate('/signup')}>
                  COMEÇAR AGORA <ArrowRight size={18} weight="regular" />
                </button>
                <button type="button" className="btn btn-primary planos-hero-cta" onClick={() => navigate('/login')}>
                  Entrar <ArrowRight size={18} weight="regular" />
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="planos-cards" data-reveal style={revealStyle(120)}>
        {PLAN_CARD_DATA.map((plan, index) => (
          <article
            key={plan.key}
            className={`planos-card ${plan.highlighted ? 'planos-card-destaque' : ''} ${plan.className}`}
            data-reveal
            style={revealStyle(index * 80)}
          >
            <div className="planos-card-header">
              <div className="planos-card-title-row">
                <h2>{plan.title}</h2>
                {plan.highlighted && (
                  <div className="planos-card-badge planos-card-badge-animated">
                    <Sparkle size={12} weight="regular" />
                    MELHOR VALOR
                  </div>
                )}
              </div>
              <p className="planos-card-desc">{plan.description}</p>
            </div>

            <div className="planos-card-price">
              <span className="planos-original">
                <span>{plan.original}</span>
              </span>
              <span className="planos-current">{plan.current}</span>
              <span className="planos-period">/mes</span>
            </div>

            <ul className="planos-features">
              {plan.features.map(f => (
                <li key={f.label} className={f.ok ? '' : 'off'}>
                  <span className="planos-check">
                    {f.ok ? <Check size={12} weight="bold" /> : <Minus size={12} weight="bold" />}
                  </span>
                    <span>{f.label}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              className={`btn ${plan.highlighted ? 'btn-gradient' : 'btn-primary'} planos-cta`}
              onClick={() => handleCheckout(plan.key)}
              disabled={loading === plan.key}
            >
              {loading === plan.key ? 'Redirecionando...' : plan.button}
            </button>
          </article>
        ))}
      </section>

      <section className="planos-comparison" data-reveal style={revealStyle(160)}>
        <div className="planos-section-heading">
          <h2>Comparativo Completo</h2>
        </div>
        <div className="planos-table-shell">
          <div className="planos-table" role="table" aria-label="Comparativo completo dos planos">
            <div className="planos-table-row planos-table-header" role="row">
              <div className="planos-table-cell planos-table-feature" role="columnheader">Funcionalidade</div>
              <div className="planos-table-cell planos-plan-col" role="columnheader">
                <span className="planos-plan-name">Básico</span>
              </div>
              <div className="planos-table-cell planos-plan-col planos-plan-col-highlight" role="columnheader">
                <span className="planos-plan-name">Gold</span>
                <span className="planos-plan-badge">MELHOR VALOR</span>
              </div>
              <div className="planos-table-cell planos-plan-col" role="columnheader">
                <span className="planos-plan-name">Premium</span>
              </div>
            </div>

            {ALL_FEATURES.map((feature, index) => {
              const basic = FEATURES_BASICO.find(x => x.label === feature)?.ok
              const gold = FEATURES_GOLD.find(x => x.label === feature)?.ok
              const premium = FEATURES_PREMIUM.find(x => x.label === feature)?.ok

              return (
                <div
                  key={feature}
                  className="planos-table-row planos-table-data"
                  role="row"
                  data-reveal
                  style={revealStyle(80 + index * 70)}
                >
                  <div className="planos-table-cell planos-table-feature" role="cell">
                    {feature}
                  </div>
                  <div className="planos-table-cell planos-table-flag" role="cell">
                    {basic ? <Check size={16} weight="bold" /> : <Minus size={16} weight="bold" />}
                  </div>
                  <div className="planos-table-cell planos-table-flag planos-table-flag-highlight" role="cell">
                    {gold ? <Check size={16} weight="bold" /> : <Minus size={16} weight="bold" />}
                  </div>
                  <div className="planos-table-cell planos-table-flag" role="cell">
                    {premium ? <Check size={16} weight="bold" /> : <Minus size={16} weight="bold" />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="planos-depoimentos" data-reveal style={revealStyle(160)}>
        <h2>Quem usa, recomenda</h2>
        <div className="planos-depoimentos-grid">
          {DEPOIMENTOS.map((d, index) => (
            <div key={d.nome} className="planos-depoimento-card" data-reveal style={revealStyle(index * 80)}>
              <div className="planos-depoimento-stars" aria-hidden="true">
                <Star size={14} weight="fill" />
                <Star size={14} weight="fill" />
                <Star size={14} weight="fill" />
                <Star size={14} weight="fill" />
                <Star size={14} weight="fill" />
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

      <section className="planos-faq" data-reveal style={revealStyle(160)}>
        <h2>Dúvidas Frequentes</h2>
        <div className="planos-faq-grid">
          {[
            { p: 'Posso cancelar quando quiser?', r: 'Sim. Cancele a qualquer momento. Seu acesso continua até o fim do período pago.' },
            { p: 'O pagamento é seguro?', r: 'Totalmente. Processamos via Kirvano com cartão, Pix ou boleto. Seus dados estão protegidos.' },
            { p: 'Funciona para qualquer nicho?', r: 'Sim. O MetaSpy funciona para Nutra, Info, Ecommerce, leads e qualquer vertical do Meta Ads.' },
            { p: 'Precisa de conhecimento técnico?', r: 'Não. A ferramenta foi feita para ser usada por afiliados, media buyers e diretos sem experiência em programação.' },
            { p: 'Qual a diferença entre os planos?', r: 'O Básico dá acesso ao Clonador de Páginas, MetaSpy Minerador e Filtros Inteligentes. O Gold libera todas as ferramentas exceto Remover Metadados. O Premium libera todas as ferramentas sem exceção.' },
          ].map((faq, index) => (
            <details key={faq.p} className="planos-faq-item" data-reveal style={revealStyle(index * 60)}>
              <summary>{faq.p}</summary>
              <p>{faq.r}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="planos-cta-bottom" data-reveal style={revealStyle(180)}>
        <h2>Pronto para escalar?</h2>
        <p>Junte-se a centenas de profissionais que ja usam o MetaSpy para dominar o Meta Ads.</p>
        <button type="button" className="btn btn-gradient planos-bottom-cta" onClick={() => handleCheckout('basico')}>
          COMEÇAR AGORA <ArrowRight size={18} weight="regular" />
        </button>
      </section>

      <footer className="planos-footer">
        <p>MetaSpy © 2026 — Inteligência de Ofertas em Escala. Todos os direitos reservados.</p>
      </footer>
    </div>
  )
}
