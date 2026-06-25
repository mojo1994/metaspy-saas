import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Crosshair,
  Copy,
  Shield,
  ChartBar,
  Sliders,
  Download,
  Play,
  ArrowRight,
  Check,
  Minus,
  Stack,
} from '@phosphor-icons/react'

const FEATURE_ITEMS = [
  {
    title: 'MetaSpy Ad Intelligence',
    description: 'Escaneie a Biblioteca de Anúncios do Facebook em tempo real. Descubra ofertas escaladas por score, tempo de atividade, variações criativas e muito mais.',
    icon: Crosshair,
  },
  {
    title: 'Clonador',
    description: 'Clone páginas web completas para o seu computador. Suporte a sites complexos, quizzes Inlead, e bypass de segurança com engine multicamada.',
    icon: Copy,
  },
  {
    title: 'Cloacker',
    description: 'Gere scripts de cloaking profissionais para proteger suas campanhas. Detecção de bots, fingerprinting e bloqueio por IP em um clique.',
    icon: Shield,
  },
  {
    title: 'Análise Avançada',
    description: 'Dashboard completo com estatísticas de score, distribuição por segmento, competitividade de nicho e top ofertas em escala.',
    icon: ChartBar,
  },
  {
    title: 'Filtros Inteligentes',
    description: 'Filtre por pais, plataforma, status, tipo de midia, score minimo, dias ativo, segmento (Nutra/Info), palavras negativas e muito mais.',
    icon: Sliders,
  },
  {
    title: 'Exportação CSV',
    description: 'Exporte todos os resultados para CSV com um clique. Perfeito para análises externas e relatórios personalizados.',
    icon: Download,
  },
  {
    title: 'Bypass Engine',
    description: 'Motor de bypass em JS, Python, Node e PHP. Suporta Cloudflare, SSL, quizzes interativos e sites com proteção avançada.',
    icon: Play,
  },
]

const PRICE_ROWS = [
  {
    title: 'Básico',
    original: 'R$ 97',
    current: 'R$ 57,90',
    features: [
      ['Clonador de Páginas', true],
      ['MetaSpy Minerador de Ads', true],
      ['Cloacker Profissional', false],
      ['Remover Metadados', false],
      ['Suporte Prioritário', false],
    ],
    highlighted: false,
  },
  {
    title: 'Gold',
    original: 'R$ 197',
    current: 'R$ 97,00',
    features: [
      ['Clonador de Páginas', true],
      ['MetaSpy Minerador de Ads', true],
      ['Cloacker Profissional', true],
      ['Análise Avançada + Suporte', true],
      ['Remover Metadados', false],
    ],
    highlighted: true,
  },
  {
    title: 'Premium',
    original: 'R$ 397',
    current: 'R$ 197,00',
    features: [
      ['Clonador de Páginas', true],
      ['MetaSpy Minerador de Ads', true],
      ['Cloacker Profissional', true],
      ['Remover Metadados', true],
      ['Suporte Prioritário', true],
    ],
    highlighted: false,
  },
] as const

function delayStyle(delay: number): CSSProperties {
  return { ['--reveal-delay' as never]: `${delay}ms` } as CSSProperties
}

export default function Landing() {
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (targets.length === 0) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      targets.forEach(target => target.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' })

    targets.forEach(target => observer.observe(target))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="landing">
      <nav className="landing-nav" data-reveal style={delayStyle(0)}>
        <div className="landing-brand">
          <div className="sidebar-logo-icon landing-brand-mark">
            <Crosshair size={16} weight="regular" />
          </div>
          <span className="landing-brand-name">MetaSpy</span>
        </div>
        <div className="landing-nav-actions">
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn btn-gradient landing-nav-btn">Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary landing-nav-btn">Entrar</Link>
              <Link to="/signup" className="btn btn-gradient landing-nav-btn">Criar Conta</Link>
            </>
          )}
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-badge" data-reveal style={delayStyle(40)}>
            <div className="landing-brand-mark landing-hero-mark">
              <Crosshair size={14} weight="regular" />
            </div>
            <span>MetaSpy</span>
          </div>
          <h1 data-reveal style={delayStyle(120)}>
            Inteligência de Ofertas em Escala
          </h1>
          <p data-reveal style={delayStyle(240)}>
            Identifique, analise e clone as melhores ofertas da Biblioteca de Anúncios do Meta
            com filtros avançados e destaque visual em tempo real.
          </p>
          <div className="landing-cta" data-reveal style={delayStyle(360)}>
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn btn-gradient landing-cta-btn">
                Ir para o Dashboard <ArrowRight size={18} weight="regular" />
              </Link>
            ) : (
              <>
                <Link to="/planos" className="btn btn-gradient landing-cta-btn">
                  COMEÇAR AGORA <ArrowRight size={18} weight="regular" />
                </Link>
                <Link to="/login" className="btn btn-primary landing-cta-btn">
                  Entrar <ArrowRight size={18} weight="regular" />
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="landing-features">
        {FEATURE_ITEMS.map((item, index) => {
          const Icon = item.icon
          return (
            <article
              key={item.title}
              className="feature-card landing-feature-card"
              data-reveal
              style={delayStyle(index * 70)}
            >
              <div className="feature-icon">
                <Icon size={24} weight="regular" />
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          )
        })}
      </section>

      <section className="landing-planos">
        <h2 data-reveal style={delayStyle(120)}>Escolha o Plano Ideal para Escalar</h2>
        <p className="landing-planos-sub" data-reveal style={delayStyle(200)}>
          Sem plano free. Sem enrolação. Resultado do primeiro dia.
        </p>
        <div className="landing-planos-cards">
          {PRICE_ROWS.map((plan, index) => (
            <article
              key={plan.title}
              className={`planos-card landing-plan-card ${plan.highlighted ? 'planos-card-destaque' : ''}`}
              data-reveal
              style={delayStyle(index * 90)}
            >
              <div className="planos-card-header">
                <div className="planos-card-title-row">
                  <h3>{plan.title}</h3>
                  {plan.highlighted && (
                    <div className="planos-card-badge planos-card-badge-animated">
                      <Stack size={12} weight="regular" />
                      MELHOR VALOR
                    </div>
                  )}
                </div>
                <p className="planos-card-desc">
                  {plan.title === 'Básico'
                    ? 'Para quem quer começar a escalar agora'
                    : plan.title === 'Gold'
                      ? 'O pacote completo para máquinas de guerra'
                      : 'Todas as ferramentas sem limites'}
                </p>
              </div>

              <div className="planos-card-price">
                <span className="planos-original">
                  <span>{plan.original}</span>
                </span>
                <span className="planos-current">{plan.current}</span>
                <span className="planos-period">/mes</span>
              </div>

              <ul className="planos-features">
                {plan.features.map(([label, ok]) => (
                  <li key={label} className={ok ? '' : 'off'}>
                    <span className="planos-check">
                      {ok ? <Check size={12} weight="bold" /> : <Minus size={12} weight="bold" />}
                    </span>
                    <span>{label}</span>
                  </li>
                ))}
              </ul>

              <Link to="/signup" className={`btn ${plan.highlighted ? 'btn-gradient' : 'btn-primary'} planos-cta`}>
                Assinar Agora
              </Link>
            </article>
          ))}
        </div>
        <div className="landing-planos-footer" data-reveal style={delayStyle(220)}>
          <Link to="/planos" className="btn btn-secondary landing-comparison-btn">Ver Comparativo Completo</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <p>MetaSpy © 2026 — Inteligência de Ofertas em Escala. Todos os direitos reservados.</p>
      </footer>
    </div>
  )
}
