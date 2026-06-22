import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function CloakDetector() {
  const { fetchWithAuth } = useAuth()
  const [url, setUrl] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState('')

  async function handleDetectar() {
    if (!url) return
    setCarregando(true)
    setErro('')
    try {
      const res = await fetchWithAuth('/api/cloaker/detect', {
        method: 'POST',
        body: JSON.stringify({ url })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Falha na analise')
      setResultado(data)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="tool-page">
      <div className="tool-header">
        <h3>Quebra de Cloacker</h3>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 13 }}>
        Descubra se uma pagina esta usando cloaking. Comparamos a resposta para humanos e robos.
      </p>

      <div className="detector-input">
        <input
          type="url"
          placeholder="https://exemplo.com/pagina"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleDetectar()}
        />
        <button className="btn btn-gradient" onClick={handleDetectar} disabled={carregando || !url}>
          {carregando ? 'Analisando...' : 'Analisar'}
        </button>
      </div>

      {erro && <div className="alerta" style={{ marginTop: 12 }}>{erro}</div>}

      {resultado && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            className="detector-resumo"
            style={{
              background: resultado.temCloaking ? 'var(--danger-bg)' : 'var(--success-bg)',
              border: `1px solid ${resultado.temCloaking ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
              color: resultado.temCloaking ? 'var(--danger)' : 'var(--success)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {resultado.temCloaking ? '! ' : 'ok '}{resultado.resumo}
          </div>

          <div className="detector-grid">
            <div className="detector-col">
              <div className="detector-col-header">Humano</div>
              <div className="detector-col-body">
                <div className="detector-info"><span>Status</span><span className="badge ativo">{resultado.comparacao.humano?.status || 'erro'}</span></div>
                <div className="detector-info"><span>URL final</span><span style={{ fontSize: 11, wordBreak: 'break-all', textAlign: 'right' }}>{resultado.comparacao.humano?.urlFinal || '-'}</span></div>
                <div className="detector-info"><span>Tamanho</span><span>{(resultado.comparacao.humano?.tamanho || 0).toLocaleString()} bytes</span></div>
              </div>
              {resultado.comparacao.humano?.headers && (
                <details className="detector-details">
                  <summary>Headers</summary>
                  <pre>{JSON.stringify(resultado.comparacao.humano.headers, null, 2)}</pre>
                </details>
              )}
            </div>
            <div className="detector-col">
              <div className="detector-col-header">Googlebot</div>
              <div className="detector-col-body">
                <div className="detector-info"><span>Status</span><span className={`badge ${resultado.comparacao.bot_google?.status === resultado.comparacao.humano?.status ? 'ativo' : 'inativo'}`}>{resultado.comparacao.bot_google?.status || 'erro'}</span></div>
                <div className="detector-info"><span>URL final</span><span style={{ fontSize: 11, wordBreak: 'break-all', textAlign: 'right' }}>{resultado.comparacao.bot_google?.urlFinal || '-'}</span></div>
                <div className="detector-info"><span>Tamanho</span><span>{(resultado.comparacao.bot_google?.tamanho || 0).toLocaleString()} bytes</span></div>
              </div>
              {resultado.comparacao.bot_google?.headers && (
                <details className="detector-details">
                  <summary>Headers</summary>
                  <pre>{JSON.stringify(resultado.comparacao.bot_google.headers, null, 2)}</pre>
                </details>
              )}
            </div>
          </div>

          <details className="detector-details" style={{ marginTop: 4 }}>
            <summary>Ver corpo HTML completo (humano)</summary>
            <div className="detector-html" dangerouslySetInnerHTML={{ __html: resultado.comparacao.humano?.corpo || 'Sem conteudo' }} />
          </details>

          <details className="detector-details">
            <summary>Ver corpo HTML completo (Googlebot)</summary>
            <div className="detector-html" dangerouslySetInnerHTML={{ __html: resultado.comparacao.bot_google?.corpo || 'Sem conteudo' }} />
          </details>
        </div>
      )}
    </div>
  )
}
