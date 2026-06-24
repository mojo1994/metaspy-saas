import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Radar,
  Copy,
  Shield,
  BarChart3,
  SlidersHorizontal,
  Download,
  Play,
  ArrowRight,
  Check,
  Minus,
  Sparkles,
  Layers3,
} from 'lucide-react'

const FEATURE_ITEMS = [
  {
    title: 'MetaSpy Ad Intelligence',
    description: 'Escaneie a Biblioteca de Anúncios do Facebook em tempo real. Descubra ofertas escaladas por score, tempo de atividade, variações criativas e muito mais.',
    icon: Radar,
  },
  {
    title: 'Clonador',
    description: 'Clone paginas web completas para o seu computador. Suporte a sites complexos, quizzes Inlead, e bypass de seguranca com engine multicamada.',
    icon: Copy,
  },
  {
    title: 'Cloacker',
    description: 'Gere scripts de cloaking profissionais para proteger suas campanhas. Detecção de bots, fingerprinting e bloqueio por IP em um clique.',
    icon: Shield,
  },
  {
    title: 'Analise Avancada',
    description: 'Dashboard completo com estatisticas de score, distribuicao por segmento, competitividade de nicho e top ofertas em escala.',
    icon: BarChart3,
  },
  {
    title: 'Filtros Inteligentes',
    description: 'Filtre por pais, plataforma, status, tipo de midia, score minimo, dias ativo, segmento (Nutra/Info), palavras negativas e muito mais.',
    icon: SlidersHorizontal,
  },
  {
    title: 'Exportacao CSV',
    description: 'Exporte todos os resultados para CSV com um clique. Perfeito para analises externas e relatorios personalizados.',
    icon: Download,
  },
  {
    title: 'Bypass Engine',
    description: 'Motor de bypass em JS, Python, Node e PHP. Suporta Cloudflare, SSL, quizzes interativos e sites com protecao avançada.',
    icon: Play,
  },
]

const PRICE_ROWS = [
  {
    title: 'Basico',
    original: 'R$ 97',
    current: 'R$ 49,90',
    features: [
      ['Clonador de Paginas', true],
      ['MetaSpy Minerador de Ads', true],
      ['Cloacker Profissional', false],
      ['Remover Metadados', false],
      ['Suporte Prioritario', false],
    ],
    highlighted: false,
  },
  {
    title: 'Gold',
    original: 'R$ 197',
    current: 'R$ 97,00',
    features: [
      ['Clonador de Paginas', true],
      ['MetaSpy Minerador de Ads', true],
      ['Cloacker Profissional', true],
      ['Analise Avancada + Suporte', true],
      ['Remover Metadados', false],
    ],
    highlighted: true,
  },
  {
    title: 'Premium',
    original: 'R$ 397',
    current: 'R$ 197,00',
    features: [
      ['Clonador de Paginas', true],
      ['MetaSpy Minerador de Ads', true],
      ['Cloacker Profissional', true],
      ['Remover Metadados', true],
      ['Suporte Prioritario', true],
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
            <Sparkles size={16} strokeWidth={2} />
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
              <Radar size={14} strokeWidth={2} />
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
                Ir para o Dashboard <ArrowRight size={18} strokeWidth={2} />
              </Link>
            ) : (
              <>
                <Link to="/planos" className="btn btn-gradient landing-cta-btn">
                  COMEÇAR AGORA <ArrowRight size={18} strokeWidth={2} />
                </Link>
                <Link to="/login" className="btn btn-primary landing-cta-btn">
                  Entrar <ArrowRight size={18} strokeWidth={2} />
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
                <Icon size={24} strokeWidth={2} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          )
        })}
      </section>

      <section className="landing-planos">
        <h2 data-reveal style={delayStyle(120)}>Escolha seu Arsenal</h2>
        <p className="landing-planos-sub" data-reveal style={delayStyle(200)}>
          Sem plano free. Sem enrolacao. Resultado do primeiro dia.
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
                      <Layers3 size={12} strokeWidth={2} />
                      MELHOR VALOR
                    </div>
                  )}
                </div>
                <p className="planos-card-desc">
                  {plan.title === 'Basico'
                    ? 'Para quem quer comecar a escalar agora'
                    : plan.title === 'Gold'
                      ? 'O pacote completo para maquinas de guerra'
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
                      {ok ? <Check size={12} strokeWidth={2.5} /> : <Minus size={12} strokeWidth={2.5} />}
                    </span>
                    {label}
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
        <p>MetaSpy &copy; 2026 — Inteligência de ofertas em escala. By Banshee.ads</p>
      </footer>
    </div>
  )
}
