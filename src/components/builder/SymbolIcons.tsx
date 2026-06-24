import { ReactNode } from 'react'

const S = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }

function wrap(icon: ReactNode) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.12" />
      {icon}
    </svg>
  )
}

const STROKE = { ...S }

export function WidgetIcon({ type, size }: { type: string; size?: number }) {
  const icon = ICON_MAP[type]
  if (!icon) return null
  return <span style={{ fontSize: size || 16, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{wrap(icon)}</span>
}

const ICON_MAP: Record<string, ReactNode> = {
  page: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" {...STROKE} />
      <line x1="8" y1="8" x2="16" y2="8" {...STROKE} />
      <line x1="8" y1="12" x2="14" y2="12" {...STROKE} />
      <line x1="8" y1="16" x2="12" y2="16" {...STROKE} />
    </>
  ),
  section: (
    <>
      <rect x="4" y="4" width="16" height="6" rx="1.5" {...STROKE} />
      <rect x="4" y="14" width="16" height="6" rx="1.5" {...STROKE} />
    </>
  ),
  container: (
    <rect x="3" y="3" width="18" height="18" rx="2" {...STROKE} strokeDasharray="3 2" />
  ),
  row: (
    <>
      <line x1="18" y1="12" x2="6" y2="12" {...STROKE} />
      <polyline points="10,8 6,12 10,16" {...STROKE} />
    </>
  ),
  column: (
    <>
      <line x1="12" y1="6" x2="12" y2="18" {...STROKE} />
      <polyline points="8,10 12,6 16,10" {...STROKE} />
    </>
  ),
  heading: (
    <>
      <line x1="6" y1="4" x2="18" y2="4" {...STROKE} />
      <line x1="12" y1="4" x2="12" y2="20" {...STROKE} />
    </>
  ),
  text: (
    <>
      <line x1="6" y1="6" x2="18" y2="6" {...STROKE} />
      <line x1="6" y1="11" x2="15" y2="11" {...STROKE} />
      <line x1="6" y1="16" x2="17" y2="16" {...STROKE} />
    </>
  ),
  image: (
    <>
      <path d="M3 17l5-7 4 5 3-3 6 6" {...STROKE} />
      <circle cx="8" cy="8" r="1.5" {...STROKE} />
    </>
  ),
  button: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="4" {...STROKE} />
      <line x1="8" y1="12" x2="16" y2="12" {...STROKE} />
    </>
  ),
  icon: (
    <path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" {...STROKE} />
  ),
  video: (
    <>
      <circle cx="12" cy="12" r="8" {...STROKE} />
      <path d="M10 8l6 4-6 4V8z" {...STROKE} />
    </>
  ),
  divider: (
    <>
      <line x1="4" y1="12" x2="20" y2="12" {...STROKE} />
      <polygon points="12,9 14,12 12,15 10,12" {...STROKE} />
    </>
  ),
  list: (
    <>
      <line x1="10" y1="6" x2="20" y2="6" {...STROKE} />
      <line x1="10" y1="12" x2="20" y2="12" {...STROKE} />
      <line x1="10" y1="18" x2="20" y2="18" {...STROKE} />
      <circle cx="6" cy="6" r="1.5" {...STROKE} />
      <circle cx="6" cy="12" r="1.5" {...STROKE} />
      <circle cx="6" cy="18" r="1.5" {...STROKE} />
    </>
  ),
  form: (
    <>
      <rect x="4" y="3" width="16" height="4" rx="1" {...STROKE} />
      <rect x="4" y="10" width="16" height="4" rx="1" {...STROKE} />
      <rect x="4" y="17" width="10" height="4" rx="2" {...STROKE} />
    </>
  ),
  nav: (
    <>
      <line x1="4" y1="5" x2="20" y2="5" {...STROKE} />
      <line x1="4" y1="10" x2="20" y2="10" {...STROKE} />
      <line x1="4" y1="15" x2="20" y2="15" {...STROKE} />
      <line x1="4" y1="20" x2="20" y2="20" {...STROKE} />
    </>
  ),
  hero: (
    <>
      <path d="M12 3l2 5 5-1-3 5 4 3-5 3 2 5-5-3-5 3 2-5-5-3 4-3-3-5 5 1z" {...STROKE} />
    </>
  ),
  pricing: (
    <>
      <circle cx="6" cy="6" r="2" {...STROKE} />
      <path d="M20 7l-9 14-4-3" {...STROKE} />
    </>
  ),
  faq: (
    <>
      <circle cx="12" cy="12" r="8" {...STROKE} />
      <path d="M9 9c0-2 1-3 3-3s3 1 3 3c0 2-3 3-3 5" {...STROKE} />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </>
  ),
  testimonial: (
    <path d="M4 4h16v11h-8l-4 4v-4H4V4z" {...STROKE} />
  ),
  countdown: (
    <>
      <circle cx="12" cy="12" r="8" {...STROKE} />
      <polyline points="12,7 12,12 16,14" {...STROKE} />
    </>
  ),
  tabs: (
    <>
      <rect x="3" y="10" width="18" height="10" rx="1.5" {...STROKE} />
      <path d="M5 10V6a1 1 0 011-1h4l2 3h6a1 1 0 011 1v1" {...STROKE} />
    </>
  ),
  modal: (
    <>
      <rect x="6" y="8" width="15" height="13" rx="2" {...STROKE} />
      <rect x="3" y="3" width="15" height="13" rx="2" {...STROKE} />
    </>
  ),
  embed: (
    <>
      <polyline points="8,6 2,12 8,18" {...STROKE} />
      <polyline points="16,6 22,12 16,18" {...STROKE} />
    </>
  ),
  pc: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" {...STROKE} />
      <line x1="12" y1="17" x2="12" y2="20" {...STROKE} />
      <line x1="8" y1="20" x2="16" y2="20" {...STROKE} />
    </>
  ),
  tablet: (
    <rect x="5" y="2" width="13" height="20" rx="2" {...STROKE} strokeWidth={1.6} />
  ),
  mobile: (
    <rect x="7" y="2" width="10" height="20" rx="2" {...STROKE} strokeWidth={1.6} />
  ),
}
