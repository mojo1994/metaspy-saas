import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Check, Minus } from '@phosphor-icons/react'

const FEATURES_BASICO = [
  { label: 'Minerador de Anúncios', ok: true },
  { label: 'Hospedar Páginas', ok: false },
  { label: 'Cloacker', ok: false },
  { label: 'Removedor de Metadados', ok: true },
]

const FEATURES_GOLD = [
  { label: 'Minerador de Anúncios', ok: true },
  { label: 'Hospedar Páginas', ok: true },
  { label: 'Cloacker', ok: false },
  { label: 'Removedor de Metadados', ok: true },
]

const FEATURES_PREMIUM = [
  { label: 'Minerador de Anúncios', ok: true },
  { label: 'Hospedar Páginas', ok: true },
  { label: 'Cloacker', ok: true },
  { label: 'Removedor de Metadados', ok: true },
]

const ALL_FEATURES = [
  'Minerador de Anúncios',
  'Hospedar Páginas',
  'Cloacker',
  'Removedor de Metadados',
]

const DEPO_IMAGENS = [
  { handle: '@thzmkt', idade: '25 anos', arquivo: '/depoimentos/foto1.jpg' },
  { handle: '@lucas.digital', idade: '23 anos', arquivo: '/depoimentos/foto2.jpg' },
  { handle: '@alberto nogueira', idade: '23 anos', arquivo: '/depoimentos/foto3.jpg' },
  { handle: '@nandokz', idade: '22 anos', arquivo: '/depoimentos/foto4.jpg' },
]

const PLAN_CARD_DATA = [
  {
    key: 'basico',
    title: 'Básico',
    description: 'Para quem quer começar a escalar agora',
    original: 'R$ 97',
    current: 'R$ 39,90',
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
    current: 'R$ 57,00',
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

    function resize() {
      canvas!.width = window.innerWidth * dpr
      canvas!.height = window.innerHeight * dpr
      canvas!.style.width = window.innerWidth + 'px'
      canvas!.style.height = window.innerHeight + 'px'
      ctx!.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    const count = Math.min(120, Math.floor(window.innerWidth * window.innerHeight / 12000))
    const pts: { x: number; y: number; vx: number; vy: number; s: number; o: number }[] = []

    for (let i = 0; i < count; i++) {
      pts.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        s: Math.random() * 2.4 + 0.6,
        o: Math.random() * 0.45 + 0.15,
      })
    }

    function draw() {
      const w = window.innerWidth
      const h = window.innerHeight
      ctx!.clearRect(0, 0, w, h)

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]
        const dx = mx - p.x
        const dy = my - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 180) {
          const f = ((180 - dist) / 180) * 0.015
          p.vx -= dx * f
          p.vy -= dy * f
        }
        p.vx += (Math.random() - 0.5) * 0.01
        p.vy += (Math.random() - 0.5) * 0.01
        p.vx *= 0.98
        p.vy *= 0.98
        p.x += p.vx
        p.y += p.vy
        if (p.x < -20) p.x = w + 20
        if (p.x > w + 20) p.x = -20
        if (p.y < -20) p.y = h + 20
        if (p.y > h + 20) p.y = -20

        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.s, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(168,85,247,${p.o})`
        ctx!.fill()
      }

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const d = dx * dx + dy * dy
          if (d < 150 * 150) {
            const alpha = (1 - Math.sqrt(d) / 150) * 0.12
            ctx!.beginPath()
            ctx!.moveTo(a.x, a.y)
            ctx!.lineTo(b.x, b.y)
            ctx!.strokeStyle = `rgba(168,85,247,${alpha})`
            ctx!.lineWidth = 0.8
            ctx!.stroke()
          }
        }
      }

      anim = requestAnimationFrame(draw)
    }
    draw()

    function onMouse(e: MouseEvent) { mx = e.clientX; my = e.clientY }
    function onLeave() { mx = -9999; my = -9999 }
    window.addEventListener('mousemove', onMouse)
    document.addEventListener('mouseleave', onLeave)

    return () => {
      cancelAnimationFrame(anim)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouse)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return <canvas ref={ref} className="planos-particles" />
}

export default function Planos() {
  const { isAuthenticated, fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState<string | null>(null)
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

  useEffect(() => {
    const el = pageRef.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame: number
    let mx = 0, my = 0

    function onMove(e: MouseEvent) {
      mx = (e.clientX / window.innerWidth - 0.5) * 2
      my = (e.clientY / window.innerHeight - 0.5) * 2
      if (!frame) {
        frame = requestAnimationFrame(apply)
      }
    }

    function apply() {
      frame = 0
      el!.style.setProperty('--tilt-x', `${my * -3}deg`)
      el!.style.setProperty('--tilt-y', `${mx * 3}deg`)
    }

    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(frame)
    }
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
    <div className="planos-page" ref={pageRef}>
      <ParticleField />
      <div className="planos-bg" />

      <section className="planos-hero" data-tilt>
        <div className="planos-hero-inner">
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
                Ir para o Dashboard
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-gradient planos-hero-cta" onClick={() => navigate('/signup')}>
                  TESTE GRATIS
                </button>
                <button type="button" className="btn btn-primary planos-hero-cta" onClick={() => navigate('/login')}>
                  Entrar
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
        <h2>conheca os top players do mercado que escalam com a gente</h2>
        <div className="planos-depo-grid-fotos">
          {DEPO_IMAGENS.map((d, index) => (
            <div key={d.handle} className="planos-depo-card-foto" data-reveal style={revealStyle(index * 60)}>
              <div className="planos-depo-moldura">
                <div className="planos-depo-moldura-borda" />
                <div className="planos-depo-moldura-brilho" />
                <img src={d.arquivo} alt={`Depoimento de ${d.handle}`} className="planos-depo-img" loading="lazy" />
                <div className="planos-depo-img-overlay" />
              </div>
              <div className="planos-depo-info">
                <strong className="planos-depo-handle">{d.handle}</strong>
                <span className="planos-depo-idade">{d.idade}</span>
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
            { p: 'Qual a diferença entre os planos?', r: 'O Básico dá acesso ao Minerador de Anúncios e ao Removedor de Metadados. O Gold inclui tudo isso mais Hospedar Páginas. O Premium libera todas as ferramentas incluindo o Cloacker profissional.' },
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
          COMEÇAR AGORA
        </button>
      </section>

      <footer className="planos-footer">
        <p>MetaSpy © 2026 — Inteligência de Ofertas em Escala. Todos os direitos reservados.</p>
      </footer>
    </div>
  )
}
