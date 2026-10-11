import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import LanguageSelector from '../components/LanguageSelector'
import {
  Crosshair,
  Copy,
  Shield,
  ChartBar,
  Sliders,
  Download,
  Play,
  SealCheck,
  Minus,
  Star,
} from '@phosphor-icons/react'

const FEATURE_ITEMS = [
  { key: 'adintelligence', icon: Crosshair },
  { key: 'cloner', icon: Copy },
  { key: 'cloaker', icon: Shield },
  { key: 'analytics', icon: ChartBar },
  { key: 'filters', icon: Sliders },
  { key: 'csv', icon: Download },
  { key: 'bypass', icon: Play },
] as const

const PLAN_ORDER = ['basico', 'premium', 'gold'] as const
const HIGHLIGHTED = 'premium'

function delayStyle(delay: number): CSSProperties {
  return { ['--reveal-delay' as never]: `${delay}ms` } as CSSProperties
}

export default function Landing() {
  const { isAuthenticated } = useAuth()
  const { t } = useTranslation()

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
      <div className="landing-langbar">
        <LanguageSelector align="right" />
      </div>
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-badge" data-reveal style={delayStyle(40)}>
            <div className="landing-brand-mark landing-hero-mark">
              <Crosshair size={14} weight="regular" />
            </div>
            <span>{t('common.appName')}</span>
          </div>
          <h1 data-reveal style={delayStyle(120)}>
            {t('landing.hero.title')}
          </h1>
          <p data-reveal style={delayStyle(240)}>
            {t('landing.hero.subtitle')}
          </p>
          <div className="landing-cta" data-reveal style={delayStyle(360)}>
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn btn-gradient landing-cta-btn">
                {t('landing.hero.dashboard')}
              </Link>
            ) : (
              <>
                <Link to="/planos" className="btn btn-gradient landing-cta-btn">
                  {t('landing.hero.start')}
                </Link>
                <Link to="/login" className="btn btn-primary landing-cta-btn">
                  {t('landing.hero.login')}
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
              key={item.key}
              className="feature-card landing-feature-card"
              data-reveal
              style={delayStyle(index * 70)}
            >
              <div className="feature-icon">
                <Icon size={24} weight="regular" />
              </div>
              <h3>{t(`landing.features.${item.key}.title`)}</h3>
              <p>{t(`landing.features.${item.key}.description`)}</p>
            </article>
          )
        })}
      </section>

      <section className="landing-planos">
        <h2 data-reveal style={delayStyle(120)}>{t('landing.plans.title')}</h2>
        <p className="landing-planos-sub" data-reveal style={delayStyle(200)}>
          {t('landing.plans.subtitle')}
        </p>
        <div className="landing-planos-cards">
          {PLAN_ORDER.map((planKey, index) => {
            const highlighted = planKey === HIGHLIGHTED
            const features = t(`landing.plans.${planKey}.features`, { returnObjects: true }) as unknown as string[]
            return (
              <article
                key={planKey}
                className={`planos-card landing-plan-card ${highlighted ? 'planos-card-destaque' : ''}`}
                data-reveal
                style={delayStyle(index * 90)}
              >
                <div className="planos-card-header">
                  <div className="planos-card-title-row">
                    <h3>{t(`landing.plans.${planKey}.title`)}</h3>
                    {highlighted && (
                      <div className="planos-card-badge planos-card-badge-animated">
                        <Star size={10} weight="fill" /> {t('landing.plans.badge')}
                      </div>
                    )}
                  </div>
                  <p className="planos-card-desc">{t(`landing.plans.${planKey}.desc`)}</p>
                </div>

                <div className="planos-card-price">
                  <span className="planos-original">
                    <span>{t(`landing.plans.${planKey}.price.original`)}</span>
                  </span>
                  <span className="planos-current">{t(`landing.plans.${planKey}.price.current`)}</span>
                  <span className="planos-period">{t('landing.plans.period')}</span>
                </div>

                <ul className="planos-features">
                  {Array.isArray(features) && features.map(label => (
                    <li key={label}>
                      <span className="planos-check">
                        <SealCheck size={14} weight="fill" />
                      </span>
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/signup" className={`btn ${highlighted ? 'btn-gradient' : 'btn-primary'} planos-cta`}>
                  {t('landing.plans.start')}
                </Link>
              </article>
            )
          })}
        </div>
        <div className="landing-planos-footer" data-reveal style={delayStyle(220)}>
          <Link to="/planos" className="btn btn-secondary landing-comparison-btn">{t('landing.plans.comparison')}</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <p>{t('landing.footer.copyright')}</p>
        <nav className="legal-footer-links" aria-label={t('landing.footer.legal')}>
          <Link to="/privacidade">{t('landing.footer.privacy')}</Link>
          <Link to="/cookies">{t('landing.footer.cookies')}</Link>
          <Link to="/excluir-conta">{t('landing.footer.deletion')}</Link>
          <Link to="/redefinir-senha">{t('landing.footer.reset')}</Link>
        </nav>
      </footer>
    </div>
  )
}
