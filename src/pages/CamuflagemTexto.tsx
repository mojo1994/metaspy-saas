import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function CamuflagemTexto() {
  const { fetchWithAuth } = useAuth()
  const [textoOriginal, setTextoOriginal] = useState('')
  const [urlDestino, setUrlDestino] = useState('')
  const [palavrasSensiveis, setPalavrasSensiveis] = useState('')
  const [scriptGerado, setScriptGerado] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleGerar() {
    if (!textoOriginal || !urlDestino) return
    setCarregando(true)
    setErro('')
    try {
      const res = await fetchWithAuth('/api/cloaker/camouflage', {
        method: 'POST',
        body: JSON.stringify({
          texto_original: textoOriginal,
          url_destino: urlDestino,
          palavras_sensiveis: palavrasSensiveis.split(',').map((p: string) => p.trim()).filter(Boolean)
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Falha ao gerar')
      setScriptGerado(data.script)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  function handleCopiar() {
    navigator.clipboard.writeText(scriptGerado)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 3000)
  }

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h3>Camuflagem de Texto</h3>
        <span className="tool-subtitle">Oculta textos e links sensiveis dos robos de revisao</span>
      </div>

      <div className="clone-config-section">
        <div className="clone-config-body" style={{ gap: 12 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            Gere um script que oculta textos e links sensiveis dos robos de revisao, mantendo-os visiveis para humanos.
          </p>
          <div className="filter-group">
            <label>Texto original (o que sera exibido para humanos)</label>
            <input type="text" value={textoOriginal} onChange={e => setTextoOriginal(e.target.value)} placeholder="Ex: Compre agora com 50% de desconto" />
          </div>
          <div className="filter-group">
            <label>URL de destino (link da oferta)</label>
            <input type="url" value={urlDestino} onChange={e => setUrlDestino(e.target.value)} placeholder="https://exemplo.com/oferta" />
          </div>
          <div className="filter-group">
            <label>Palavras sensiveis (separadas por virgula)</label>
            <input type="text" value={palavrasSensiveis} onChange={e => setPalavrasSensiveis(e.target.value)} placeholder="comprar, desconto, oferta, gratis" />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Essas palavras serao substituidas por "....." para robos.</div>
          </div>
          {erro && <div className="alerta">{erro}</div>}
          <button className="btn btn-gradient" onClick={handleGerar} disabled={carregando || !textoOriginal || !urlDestino}>
            {carregando ? 'Gerando...' : 'Gerar Script de Camuflagem'}
          </button>
          {scriptGerado && (
            <div className="clone-config-section" style={{ marginTop: 8 }}>
              <div className="clone-config-header">Script gerado</div>
              <div className="clone-config-body" style={{ gap: 8 }}>
                <div className="script-box"><pre>{scriptGerado}</pre></div>
                <button className="btn btn-primary" onClick={handleCopiar}>{copiado ? 'Copiado!' : 'Copiar script'}</button>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Cole este script dentro da tag <code style={{ background: 'var(--bg-primary)', padding: '1px 5px', borderRadius: 3 }}>{'<head>'}</code> da sua pagina.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}