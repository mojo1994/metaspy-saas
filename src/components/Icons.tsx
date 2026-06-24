import { JSX } from 'react'

type Props = { size?: number; className?: string }

export function IconGear({ size = 16, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __spin{to{transform:rotate(360deg)}}.__gear{transform-origin:12px 12px;animation:__spin 3s linear infinite}@media(prefers-reduced-motion:no-preference){.__gear:hover{animation-duration:.8s}}`}</style>
    <circle cx="12" cy="12" r="3" className="__gear"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" className="__gear"/>
  </svg>
}

export function IconWarning({ size = 14, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __pulse{0%,100%{opacity:1}50%{opacity:.6}}.__warn{animation:__pulse 2s ease-in-out infinite}`}</style>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" className="__warn"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
}

export function IconRocket({ size = 48, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}@keyframes __flame{0%,100%{opacity:.4}50%{opacity:1}}.__fly{animation:__float 2s ease-in-out infinite}@media(prefers-reduced-motion:no-preference){.__fly:hover{animation-duration:.6s}}.__fire{animation:__flame .8s ease-in-out infinite}`}</style>
    <g className="__fly">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
    </g>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" className="__fire"/>
  </svg>
}

export function IconPlay({ size = 24, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __playPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.8;transform:scale(1.08)}}.__play{transform-origin:12px 12px;animation:__playPulse 2.5s ease-in-out infinite}`}</style>
    <polygon points="5 3 19 12 5 21 5 3" className="__play"/>
  </svg>
}

export function IconCheck({ size = 14, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __draw{to{stroke-dashoffset:0}}.__check{stroke-dasharray:25;stroke-dashoffset:25;animation:__draw .3s ease-out forwards}`}</style>
    <polyline points="20 6 9 17 4 12" className="__check"/>
  </svg>
}

export function IconDash({ size = 14, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={className}>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
}

export function IconStar({ size = 16, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __twinkle{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(.92)}}.__star{transform-origin:12px 12px;animation:__twinkle 2s ease-in-out infinite}`}</style>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" className="__star"/>
  </svg>
}

export function IconImage({ size = 24, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __fadeIn{to{opacity:1}}.__img{opacity:0;animation:__fadeIn .4s ease-out forwards}`}</style>
    <rect x="3" y="3" width="18" height="18" rx="3" ry="3"/>
    <circle cx="8.5" cy="8.5" r="1.5" className="__img" style={{ animationDelay: '.1s' }}/>
    <polyline points="21 15 16 10 5 21" className="__img" style={{ animationDelay: '.2s' }}/>
  </svg>
}

export function IconClose({ size = 18, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __hoverSpin{to{transform:rotate(90deg)}}.__close{transform-origin:12px 12px;transition:transform .3s ease}.__close:hover{animation:__hoverSpin .3s ease forwards}`}</style>
    <g className="__close">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </g>
  </svg>
}

export function IconLogo({ size = 24, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __ringPulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:.6;transform:scale(1.12)}}.__ring{transform-origin:12px 12px;animation:__ringPulse 2.5s ease-in-out infinite}.__dot{animation:__ringPulse 2.5s ease-in-out infinite;animation-delay:.3s}`}</style>
    <circle cx="12" cy="12" r="10" className="__ring"/>
    <circle cx="12" cy="12" r="3" className="__dot"/>
  </svg>
}

export function IconTarget({ size = 24, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __targetPulse{0%,100%{opacity:.3}50%{opacity:.7}}.__t1{animation:__targetPulse 2s ease-in-out infinite}.__t2{animation:__targetPulse 2s ease-in-out infinite;animation-delay:.3s}.__t3{animation:__targetPulse 2s ease-in-out infinite;animation-delay:.6s}`}</style>
    <circle cx="12" cy="12" r="10" className="__t1"/>
    <circle cx="12" cy="12" r="6" className="__t2"/>
    <circle cx="12" cy="12" r="2" className="__t3"/>
  </svg>
}

export function IconDiamond({ size = 24, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __diamondGlow{0%,100%{opacity:1;filter:drop-shadow(0 0 2px currentColor)}50%{opacity:.7;filter:drop-shadow(0 0 6px currentColor)}}.__diamond{animation:__diamondGlow 2.5s ease-in-out infinite;transform-origin:12px 14px}`}</style>
    <path d="M2 8l4-4h12l4 4-10 12z" className="__diamond"/>
  </svg>
}

export function IconLocked({ size = 24, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-1.5px)}75%{transform:translateX(1.5px)}}.__lock{transform-origin:12px 12px}@media(hover:hover){.__lock:hover{animation:__shake .3s ease-in-out}}`}</style>
    <g className="__lock">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </g>
  </svg>
}

export function IconBoxPlus({ size = 24, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __plusPop{0%{transform:scale(0)}60%{transform:scale(1.3)}100%{transform:scale(1)}}.__plus{transform-origin:12px 12px;animation:__plusPop .4s ease-out forwards}`}</style>
    <rect x="3" y="3" width="18" height="18" rx="3" ry="3"/>
    <g className="__plus">
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </g>
  </svg>
}

export function IconArrowDown({ size = 24, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}.__down{animation:__bounce 1.5s ease-in-out infinite;transform-origin:12px 12px}@media(prefers-reduced-motion:no-preference){.__down:hover{animation-duration:.4s}}`}</style>
    <g className="__down">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <polyline points="19 12 12 19 5 12"/>
    </g>
  </svg>
}

export function IconClock({ size = 14, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __tick{to{transform:rotate(360deg)}}.__hand{transform-origin:12px 12px;animation:__tick 6s linear infinite}.__hand2{transform-origin:12px 12px;animation:__tick 30s linear infinite}`}</style>
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14" className="__hand"/>
  </svg>
}

export function IconVideo({ size = 24, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __vidPulse{0%,100%{opacity:1}50%{opacity:.6}}.__vid{animation:__vidPulse 2s ease-in-out infinite;transform-origin:16px 12px}`}</style>
    <rect x="1" y="5" width="15" height="14" rx="3" ry="3"/>
    <polygon points="23 7 16 12 23 17 23 7" className="__vid"/>
  </svg>
}

export function IconChevronDown({ size = 14, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
}

export function IconChevronRight({ size = 14, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
}

export function IconDownload({ size = 18, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
}

export function IconArrowUp({ size = 14, className }: Props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <style>{`@keyframes __upBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}.__up{animation:__upBounce 1.5s ease-in-out infinite;transform-origin:12px 12px}`}</style>
    <g className="__up">
      <line x1="12" y1="19" x2="12" y2="5"/>
      <polyline points="5 12 12 5 19 12"/>
    </g>
  </svg>
}
