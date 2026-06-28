import { useState, useEffect } from 'react'
import { IconGear } from './Icons'

const messages = [
  'carregando servidores',
  'executando elementos',
  'renderizando arquivos'
]

export default function LoadingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % messages.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="loading-screen">
      <div className="loading-screen-content">
        <div className="loading-screen-gear-wrapper">
          <IconGear size={64} className="loading-screen-gear" />
        </div>
        <p className="loading-screen-text" key={currentIndex}>
          {messages[currentIndex]}
        </p>
      </div>
    </div>
  )
}
