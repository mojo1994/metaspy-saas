import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'metaspy_cookie_consent'

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch { /* ignore */ }
  }, [])

  function decide(choice: 'all' | 'essential') {
    try { localStorage.setItem(STORAGE_KEY, choice) } catch { /* ignore */ }
    setVisible(false)
    let anonymousId = ''
    try {
      anonymousId = localStorage.getItem('metaspy_anon_id') || ''
      if (!anonymousId) {
        anonymousId = Math.random().toString(36).slice(2) + Date.now().toString(36)
        localStorage.setItem('metaspy_anon_id', anonymousId)
      }
    } catch { /* ignore */ }
    fetch('/api/cookies/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice, anonymousId }),
    }).catch(() => {})
  }

  if (!visible) return null

  return (
    <div className="cookie-consent" role="dialog" aria-live="polite" aria-label="Aviso de cookies">
      <div className="cookie-consent-inner">
        <p>
          Usamos cookies e armazenamento local para manter você conectado e melhorar sua experiência.
          Saiba mais na nossa <Link to="/cookies">Política de Cookies</Link>.
        </p>
        <div className="cookie-consent-actions">
          <button type="button" className="btn btn-secondary" onClick={() => decide('essential')}>Apenas essenciais</button>
          <button type="button" className="btn btn-gradient" onClick={() => decide('all')}>Aceitar todos</button>
        </div>
      </div>
    </div>
  )
}
