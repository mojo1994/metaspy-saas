import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import LanguageSelector from '../components/LanguageSelector'
import { Minus, SealCheck } from '@phosphor-icons/react'

const FEATURE_KEYS = {
  basico: ['minerador', 'analise_concorrentes', 'limpeza_metadados'],
  gold: ['minerador', 'analise_concorrentes', 'limpeza_metadados', 'clonagem', 'hospedagem', 'paginas_ocultas', 'analise_avancada'],
  premium: ['minerador', 'analise_concorrentes', 'limpeza_metadados', 'clonagem', 'hospedagem', 'paginas_ocultas', 'analise_avancada', 'clonagem_50', 'quebra_cloaker', 'camuflagem', 'suporte'],
} as const

const ALL_FEATURES = [
  'minerador',
  'analise_concorrentes',
  'limpeza_metadados',
  'clonagem',
  'hospedagem',
  'paginas_ocultas',
  'analise_avancada',
  'clonagem_50',
  'quebra_cloaker',
  'camuflagem',
  'suporte',
] as const

const DEPO_IMAGENS = [
  { handle: '@thzmkt', idade: '25', arquivo: '/depoimentos/foto1.jpg' },
  { handle: '@lucas.digital', idade: '23', arquivo: '/depoimentos/foto2.jpg' },
  { handle: '@alberto nogueira', idade: '23', arquivo: '/depoimentos/foto3.jpg' },
  { handle: '@nandokz', idade: '22', arquivo: '/depoimentos/foto4.jpg' },
]

const PLAN_CARD_DATA = [
  { key: 'basico', current: 'R$ 39,90', features: FEATURE_KEYS.basico, className: 'plan-card-basic', highlighted: false },
  { key: 'gold', current: 'R$ 57,90', features: FEATURE_KEYS.gold, className: 'plan-card-gold', highlighted: true },
  { key: 'premium', current: 'R$ 197,00', original: 'R$ 397', features: FEATURE_KEYS.premium, className: 'plan-card-premium', highlighted: false },
] as const

function revealStyle(delayMs: number): CSSProperties {
  return { ['--reveal-delay' as never]: `${delayMs}ms` } as CSSProperties
}

function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let anim: number
    let mx = -9999, my = -9999
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function getPageH() {
      return Math.max(document.documentElement.scrollHeight, window.innerHeight)
    }

    function resize() {
      const pw = window.innerWidth
      const ph = getPageH()
      canvas!.width = pw * dpr
      canvas!.height = ph * dpr
      canvas!.style.width = pw + 'px'
      canvas!.style.height = ph + 'px'
      ctx!.scale(dpr, dpr)
    }

    resize()

    const pts: { x: number; y: number; vx: number; vy: number; s: number; o: number }[] = []
    const W = window.innerWidth
    const H = getPageH()
    const count = Math.min(90, Math.floor((W * H) / 26000))
    for (let i = 0; i < count; i++) {
      pts.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        s: Math.random() * 1.6 + 0.4,
        o: Math.random() * 0.5 + 0.15,
      })
    }

    function draw() {
      const h = getPageH()
      ctx!.clearRect(0, 0, window.innerWidth, h)
      for (const p of pts) {
        const dx = mx - p.x
        const dy = (my + window.scrollY) - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 160) {
          const f = ((160 - dist) / 160) * 0.012
          p.vx -= dx * f
          p.vy -= dy * f
        }
        p.vx *= 0.99
        p.vy *= 0.99
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > window.innerWidth || p.y < 0 || p.y > h) {
          p.x = Math.random() * window.innerWidth
          p.y = Math.random() * h
        }
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.s, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(168,85,247,${p.o})`
        ctx!.fill()
      }
      anim = requestAnimationFrame(draw)
    }

    draw()

    function onMove(e: MouseEvent) {
      mx = e.clientX
      my = e.clientY
    }
    function onLeave() {
      mx = -9999
      my = -9999
    }

    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)

    return () => {
      cancelAnimationFrame(anim)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return <canvas ref={ref} className="planos-particles" />
}

export default function Planos() {
  const { isAuthenticated, fetchWithAuth } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)

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
    setError(null)
    try {
      const resp = await fetchWithAuth('/api/subscription/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ plan })
      })
      const data = await resp.json()
      if (resp.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return
      }
      setError(data.error || t('planos.checkoutError'))
    } catch {
      setError(t('planos.connectionError'))
    }
    setLoading(null)
  }

  function hasFeature(planKey: keyof typeof FEATURE_KEYS, feature: string) {
    return (FEATURE_KEYS[planKey] as readonly string[]).includes(feature)
  }

  const planDescKey: Record<string, string> = {
    basico: 'planos.plan.basicoDesc',
    gold: 'planos.plan.goldDesc',
    premium: 'planos.plan.premiumDesc',
  }
  const planTitleKey: Record<string, string> = {
    basico: 'planos.plan.basicoTitle',
    gold: 'planos.plan.goldTitle',
    premium: 'planos.plan.premiumTitle',
  }

  return (
    <div className="planos-page" ref={pageRef}>
      <div className="planos-langbar">
        <LanguageSelector align="right" />
      </div>
      <ParticleField />
      <div className="planos-bg" />

      <section className="planos-hero" data-tilt>
        <div className="planos-hero-inner">
          <h1 className="reveal-lift planos-hero-title" data-reveal style={revealStyle(120)}>
            {t('planos.hero.title')}
          </h1>
          <p className="planos-subtitle reveal-lift" data-reveal style={revealStyle(240)}>
            {t('planos.hero.subtitle')}
          </p>
          <div className="planos-hero-cta-row" data-reveal style={revealStyle(360)}>
            {isAuthenticated ? (
              <button type="button" className="btn btn-gradient planos-hero-cta" onClick={() => navigate('/dashboard')}>
                {t('planos.hero.ctaDashboard')}
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-gradient planos-hero-cta" onClick={() => navigate('/signup')}>
                  {t('planos.hero.ctaStart')}
                </button>
                <button type="button" className="btn btn-primary planos-hero-cta" onClick={() => navigate('/login')}>
                  {t('planos.hero.ctaLogin')}
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="planos-vsl" data-reveal style={revealStyle(120)}>
        <div className="planos-vsl-wrapper">
          <iframe
            src="https://www.youtube.com/embed/5biW6t1NAkM?start=3"
            title="MetaSpy VSL"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="planos-vsl-iframe"
          />
        </div>
      </section>

      {error && (
        <div className="planos-error" data-reveal style={revealStyle(100)}>
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>&times;</button>
        </div>
      )}
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
                <h2>{t(planTitleKey[plan.key])}</h2>
                {plan.highlighted && (
                  <div className="planos-card-badge planos-card-badge-animated">
                    {t('planos.badge')}
                  </div>
                )}
              </div>
              <p className="planos-card-desc">{t(planDescKey[plan.key])}</p>
            </div>

            <div className="planos-card-price">
              {'original' in plan && plan.original && (
                <span className="planos-original">
                  <span>{plan.original}</span>
                </span>
              )}
              <span className="planos-current">{plan.current}</span>
              <span className="planos-period">{t('planos.period')}</span>
            </div>

            <ul className="planos-features">
              {plan.features.map(f => (
                <li key={f}>
                  <span className="planos-check">
                    <SealCheck size={14} weight="fill" />
                  </span>
                  <span>{t(`planos.features.${f}`)}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              className={`btn ${plan.highlighted ? 'btn-gradient' : 'btn-primary'} planos-cta`}
              onClick={() => handleCheckout(plan.key)}
              disabled={loading === plan.key}
            >
              {loading === plan.key ? t('planos.redirecting') : t('planos.start')}
            </button>
          </article>
        ))}
      </section>

      <div className="planos-trust" data-reveal style={revealStyle(160)}>
        <div className="planos-trust-item"><svg className="planos-trust-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> {t('planos.trust.secure')}</div>
        <div className="planos-trust-item"><svg className="planos-trust-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> {t('planos.trust.instant')}</div>
        <div className="planos-trust-item"><svg className="planos-trust-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> {t('planos.trust.cancel')}</div>
      </div>

      <div className="planos-help-btn" data-reveal style={revealStyle(160)}>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/ajuda')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          {t('planos.help')}
        </button>
      </div>

      <section className="planos-comparison" data-reveal style={revealStyle(160)}>
        <div className="planos-section-heading">
          <h2>{t('planos.comparison.title')}</h2>
        </div>
        <div className="planos-table-shell">
          <div className="planos-table" role="table" aria-label={t('planos.comparison.aria')}>
            <div className="planos-table-row planos-table-header" role="row">
              <div className="planos-table-cell planos-table-plan-col planos-table-header-filler" role="columnheader" />
              <div className="planos-table-cell planos-table-plan-col" role="columnheader">
                <span className="planos-plan-name">{t('planos.plan.basicoTitle')}</span>
              </div>
              <div className="planos-table-cell planos-plan-col planos-plan-col-highlight" role="columnheader">
                <span className="planos-plan-name">{t('planos.plan.goldTitle')}</span>
              </div>
              <div className="planos-table-cell planos-table-plan-col" role="columnheader">
                <span className="planos-plan-name">{t('planos.plan.premiumTitle')}</span>
              </div>
            </div>

            {ALL_FEATURES.map((feature, index) => {
              const basic = hasFeature('basico', feature)
              const gold = hasFeature('gold', feature)
              const premium = hasFeature('premium', feature)

              return (
                <div
                  key={feature}
                  className="planos-table-row planos-table-data"
                  role="row"
                  data-reveal
                  style={revealStyle(80 + index * 70)}
                >
                  <div className="planos-table-cell planos-table-feature" role="cell">
                    {t(`planos.features.${feature}`)}
                  </div>
                  <div className="planos-table-cell planos-table-flag" role="cell">
                    {basic ? <SealCheck size={16} weight="fill" /> : <Minus size={16} weight="bold" />}
                  </div>
                  <div className="planos-table-cell planos-table-flag planos-table-flag-highlight" role="cell">
                    {gold ? <SealCheck size={16} weight="fill" /> : <Minus size={16} weight="bold" />}
                  </div>
                  <div className="planos-table-cell planos-table-flag" role="cell">
                    {premium ? <SealCheck size={16} weight="fill" /> : <Minus size={16} weight="bold" />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="planos-depoimentos" data-reveal style={revealStyle(160)}>
        <h2>{t('planos.depo.title')}</h2>
        <div className="planos-depo-grid-fotos">
          {DEPO_IMAGENS.map((d, index) => (
            <div key={d.handle} className="planos-depo-card-foto" data-reveal style={revealStyle(index * 60)}>
              <div className="planos-depo-moldura">
                <div className="planos-depo-moldura-borda" />
                <div className="planos-depo-moldura-brilho" />
                <img src={d.arquivo} alt={d.handle} className="planos-depo-img" />
              </div>
              <div className="planos-depo-tag">
                <span className="planos-depo-handle">{d.handle}</span>
                <span className="planos-depo-idade">{d.idade}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="planos-faq" data-reveal style={revealStyle(160)}>
        <div className="planos-section-heading">
          <h2>{t('planos.faq.title')}</h2>
        </div>
        <div className="planos-faq-list">
          {[1, 2, 3, 4, 5].map(n => (
            <details key={n} className="planos-faq-item" data-reveal style={revealStyle(80 + n * 60)}>
              <summary>{t(`planos.faq.q${n}`)}</summary>
              <p>{t(`planos.faq.a${n}`)}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="planos-cta-bottom" data-reveal style={revealStyle(180)}>
        <h2>{t('planos.bottom.title')}</h2>
        <p>{t('planos.bottom.subtitle')}</p>
        <button
          type="button"
          className="btn btn-gradient planos-cta-bottom-btn"
          onClick={() => navigate('/signup')}
          style={{ marginTop: 20 }}
        >
          {t('planos.bottom.cta')}
        </button>
      </section>

      <footer className="planos-footer">
        <p>{t('planos.footer.copyright')}</p>
        <nav className="planos-footer-links">
          <Link to="/privacidade">{t('planos.footer.privacy')}</Link>
          <Link to="/cookies">{t('planos.footer.cookies')}</Link>
          <Link to="/excluir-conta">{t('planos.footer.deletion')}</Link>
          <Link to="/redefinir-senha">{t('planos.footer.reset')}</Link>
        </nav>
      </footer>
    </div>
  )
}
