import { useState, useRef, useEffect } from 'react'

interface HelpTooltipProps {
  text: string
}

export default function HelpTooltip({ text }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const iconRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  function show() {
    clearTimeout(timeoutRef.current)
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect()
      setPos({ x: rect.right + 8, y: rect.top - 4 })
    }
    setVisible(true)
  }

  function hide() {
    timeoutRef.current = setTimeout(() => setVisible(false), 150)
  }

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current)
  }, [])

  useEffect(() => {
    if (!visible || !tipRef.current) return
    const rect = tipRef.current.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      setPos(prev => ({ ...prev, x: window.innerWidth - rect.width - 16 }))
    }
    if (rect.bottom > window.innerHeight) {
      setPos(prev => ({ ...prev, y: window.innerHeight - rect.height - 16 }))
    }
  }, [visible])

  return (
    <>
      <button
        ref={iconRef}
        type="button"
        className="help-icon"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-label="Ajuda"
      >
        ?
      </button>
      {visible && (
        <div
          ref={tipRef}
          className="help-tooltip"
          style={{ left: pos.x, top: pos.y }}
          onMouseEnter={() => { clearTimeout(timeoutRef.current); setVisible(true) }}
          onMouseLeave={hide}
        >
          {text}
        </div>
      )}
    </>
  )
}
