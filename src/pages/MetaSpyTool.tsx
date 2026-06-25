import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { IconImage, IconClose, IconTarget, IconChevronDown, IconChevronRight, IconArrowUp } from '../components/Icons'
import type { Anuncio, FilterState } from '../types'
import HelpTooltip from '../components/HelpTooltip'

const FB_API_BASE = '/api/ads-archive'
const CF_WORKER_URL = 'https://metaspy-host.09santos-felipe.workers.dev'
const CAMPOS_API_PRINCIPAL = [
  'id', 'ad_creation_time', 'ad_creative_bodies', 'ad_creative_link_captions',
  'ad_creative_link_descriptions', 'ad_creative_link_titles', 'ad_delivery_start_time',
  'ad_delivery_stop_time', 'ad_snapshot_url', 'ad_active_status',
  'ad_creative_thumbnail_url', 'page_id', 'page_name', 'publisher_platforms',
  'ad_creative_link_url', 'object_story_spec'
].join(',')
const CAMPOS_API_FALLBACK = [
  'id', 'ad_creation_time', 'ad_creative_bodies', 'ad_delivery_start_time',
  'ad_snapshot_url', 'ad_creative_thumbnail_url', 'ad_creative_link_url',
  'page_id', 'page_name', 'publisher_platforms', 'object_story_spec'
].join(',')
const CAMPOS_API_MINIMO = [
  'id', 'ad_creation_time', 'ad_creative_bodies',
  'ad_snapshot_url', 'ad_creative_thumbnail_url', 'ad_creative_link_url',
  'page_id', 'page_name', 'publisher_platforms', 'object_story_spec'
].join(',')
const PAUSA_RATE_LIMIT_MS = 15000
const TIMEOUT_REQUISICAO_API_MS = 30000
const CACHE_EXPIRACAO_MS = 5 * 60 * 1000

const cacheApi = new Map<string, { valor: unknown; criadoEm: number }>()
const cacheImagensPreview = new Map<string, string>()

function obterCacheApi(chave: string): unknown | null {
  const entry = cacheApi.get(chave)
  if (entry && Date.now() - entry.criadoEm < CACHE_EXPIRACAO_MS) {
    return entry.valor
  }
  return null
}

function salvarCacheApi(chave: string, valor: unknown) {
  cacheApi.set(chave, { valor, criadoEm: Date.now() })
  if (cacheApi.size > 200) {
    const primeiro = cacheApi.keys().next().value
    if (primeiro) cacheApi.delete(primeiro)
  }
}

function normalizarTexto(t: string) {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function badgeScore(score: number) {
  if (score >= 80) return { texto: 'ALTA ESCALA', classe: 'alta' }
  if (score >= 60) return { texto: 'ESCALADA', classe: 'escalando' }
  return { texto: 'TESTANDO', classe: 'testando' }
}

function statusAnuncio(a: Anuncio) {
  if (!a.ativo) return 'Inativo'
  return 'Ativo'
}

function calcularScoreEscala(anuncio: {
  diasAtivo: number; impressionsMax: number; spendMax: number;
  variacoesAtivas: number; audienceMax: number; dataFimISO: string | null;
  plataformas: string[]
}): number {
  const variacoes = Math.min(10, Math.max(1, (() => {
    let pontos = 0
    if (anuncio.spendMax >= 100000) pontos += 4
    else if (anuncio.spendMax >= 50000) pontos += 3
    else if (anuncio.spendMax >= 10000) pontos += 2
    else if (anuncio.spendMax > 0) pontos += 1
    if (anuncio.impressionsMax >= 1000000) pontos += 4
    else if (anuncio.impressionsMax >= 250000) pontos += 3
    else if (anuncio.impressionsMax >= 50000) pontos += 2
    else if (anuncio.impressionsMax > 0) pontos += 1
    return pontos
  })()))
  const pVariacoes = Math.min(100, variacoes * 10)
  const pTempo = Math.min(100, (anuncio.diasAtivo / 90) * 100)
  const pConsistencia = !anuncio.dataFimISO ? 100 : Math.max(20, 100 - Math.min(80, anuncio.diasAtivo * 0.5))
  const pPlataformas = Math.min(100, (anuncio.plataformas.length / 4) * 100)
  const pEngajamento = Math.min(100, anuncio.impressionsMax / 10000)
  return Math.max(0, Math.min(100, Math.round(
    pVariacoes * 0.3 + pTempo * 0.25 + pConsistencia * 0.2 + pPlataformas * 0.15 + pEngajamento * 0.1
  )))
}

function extrairLimiteSuperior(campo: unknown): number {
  if (!campo) return 0
  if (typeof campo === 'number') return Math.max(0, campo)
  if (typeof campo === 'object') {
    const obj = campo as Record<string, unknown>
    const val = obj.upper_bound ?? obj.upperBound ?? obj.max ?? obj.value
    return Math.max(0, Number(val) || 0)
  }
  return 0
}

function normalizarPlataformas(plataformas: unknown): string[] {
  const lista = Array.isArray(plataformas) ? (plataformas as string[]) : []
  const mapa: Record<string, string> = {
    facebook: 'Facebook', instagram: 'Instagram', messenger: 'Messenger',
    audience_network: 'Audience Network', audiencenetwork: 'Audience Network'
  }
  const normalizadas = lista.map(p => mapa[p.toLowerCase()] || p.charAt(0).toUpperCase() + p.slice(1))
  return [...new Set(normalizadas)]
}

function detectarDestino(texto: string): string {
  const t = normalizarTexto(texto)
  if (/wa\.me|whatsapp/.test(t)) return 'WhatsApp'
  if (/instagram/.test(t)) return 'Instagram'
  return 'Pagina de vendas'
}

function detectarEntregavel(texto: string): string {
  const t = normalizarTexto(texto)
  const mapa = [
    { chave: 'Nutra', termos: ['nutra', 'suplemento', 'capsula', 'comprimido'] },
    { chave: 'App', termos: ['app', 'aplicativo', 'software', 'sistema'] },
    { chave: 'PDF', termos: ['pdf', 'ebook', 'apostila', 'guia'] },
    { chave: 'Curso', termos: ['curso', 'aula', 'treinamento', 'formacao'] },
    { chave: 'Instagram', termos: ['instagram', 'perfil', 'seguidores', 'reels'] },
    { chave: 'Mentoria', termos: ['mentoria', 'sessao', 'consultoria'] }
  ]
  for (const item of mapa) {
    if (item.termos.some(termo => t.includes(termo))) return item.chave
  }
  return 'Indefinido'
}

function normalizarAnuncioApi(ad: Record<string, unknown>): Anuncio | null {
  const id = String(ad.id || '').trim()
  if (!id) return null

  const corpos = (ad.ad_creative_bodies as string[]) || []
  const titulos = (ad.ad_creative_link_titles as string[]) || []
  const descricoes = (ad.ad_creative_link_descriptions as string[]) || []
  const textoCompleto = (corpos.filter(Boolean).join(' ') || descricoes.filter(Boolean).join(' ') || titulos.filter(Boolean).join(' ')).trim()
  const thumbnail = (ad.ad_creative_thumbnail_url as string) || ''
  const snapshot = (ad.ad_snapshot_url as string) || `https://www.facebook.com/ads/library/?id=${id}`
  const plataformas = normalizarPlataformas(ad.publisher_platforms)
  const criacao = (ad.ad_creation_time as string) || ''
  const pageName = String(ad.page_name || '').trim()
  const quantCopias = Math.max(1, corpos.length)
  const diasAtivo = criacao ? Math.floor((Date.now() - new Date(criacao).getTime()) / 86400000) : 0
  const ativo = true

  const score = calcularScoreEscala({
    diasAtivo, impressionsMax: 0, spendMax: 0,
    variacoesAtivas: quantCopias, audienceMax: 0,
    dataFimISO: null, plataformas
  })

  const textoAnuncio = `${textoCompleto} ${pageName} ${snapshot}`
  const urlDestino = (ad.ad_creative_link_url as string) || ''
  if (urlDestino) console.debug(`urlDestino set for ${id}:`, urlDestino.slice(0, 80))
  const anuncio: Anuncio = {
    idAnuncio: id,
    anunciante: pageName || titulos?.[0]?.slice(0, 40) || '(sem nome)',
    pageId: String(ad.page_id || ''),
    tituloOferta: titulos?.[0] || pageName || '',
    texto: textoCompleto.slice(0, 280),
    textoCompleto,
    midias: thumbnail ? [{ url: thumbnail, tipo: 'imagem' }] : [],
    dataInicioISO: criacao || null,
    dataFimISO: null,
    dataUltimaAtualizacaoISO: null,
    plataformas,
    urlDestino,
    urlBiblioteca: snapshot,
    objectStorySpec: ad.object_story_spec,
    cta: 'Saiba mais',
    adActiveStatus: 'ACTIVE',
    statusTexto: 'Ativo',
    ativo,
    diasAtivo,
    spendMax: 0,
    impressionsMax: 0,
    audienceMax: 0,
    variacoesAtivasEstimadas: quantCopias,
    variacoesAtivas: quantCopias,
    consistenciaTemporal: 100,
    engajamentoEstimado: 0,
    scoreEscala: score,
    statusEscala: score >= 80 ? 'ALTA ESCALA' : score >= 60 ? 'ESCALADA' : 'TESTANDO',
    evergreen: diasAtivo > 90,
    entregavel: detectarEntregavel(textoAnuncio),
    destino: detectarDestino(textoAnuncio),
    origem: 'api'
  }
  return anuncio
}

async function extrairImagemPreview(anuncio: Anuncio): Promise<string | null> {
  const chave = anuncio.urlBiblioteca || anuncio.idAnuncio
  if (!chave) return null
  const cacheado = cacheImagensPreview.get(chave)
  if (cacheado) return cacheado
  // Strategy 1: Apify Facebook Ads Scraper (busca imagem real do criativo, timeout 45s)
  if (anuncio.idAnuncio) {
    try {
      const resp = await fetch(`/api/ad-image-apify?adId=${encodeURIComponent(anuncio.idAnuncio)}`, {
        signal: AbortSignal.timeout(45000)
      })
      if (resp.ok) {
        const data = await resp.json()
        if (data.imageUrl) {
          cacheImagensPreview.set(chave, data.imageUrl)
          return data.imageUrl
        }
      }
    } catch (e) { console.error('[extrairImagemPreview] Apify falhou:', e) }
  }
  // Strategy 2: Render backend (Graph API creative fields + CDN, timeout 10s)
  try {
    const params = new URLSearchParams()
    if (anuncio.idAnuncio) params.set('id', anuncio.idAnuncio)
    if (anuncio.urlBiblioteca) params.set('snapshot', anuncio.urlBiblioteca)
    if (anuncio.urlDestino) params.set('linkUrl', anuncio.urlDestino)
    if (anuncio.pageId) params.set('pageId', anuncio.pageId)
    // @ts-ignore
    if (anuncio.objectStorySpec) params.set('objectStorySpec', JSON.stringify(anuncio.objectStorySpec))
    const resp = await fetch(`/api/ad-extract-image?${params.toString()}`, {
      signal: AbortSignal.timeout(10000)
    })
    if (resp.ok) {
      const data = await resp.json()
      if (data.imageUrl) {
        cacheImagensPreview.set(chave, data.imageUrl)
        return data.imageUrl
      }
    }
  } catch (e) { console.error('[extrairImagemPreview] Backend falhou:', e) }
  // Strategy 3: Page profile picture as guaranteed fallback
  if (anuncio.pageId) {
    try {
      const resp = await fetch(`/api/page-picture/${anuncio.pageId}`, { signal: AbortSignal.timeout(5000) })
      if (resp.ok) {
        const data = await resp.json()
        if (data.imageUrl) {
          cacheImagensPreview.set(chave, data.imageUrl)
          return data.imageUrl
        }
      }
    } catch (e) { console.error('[extrairImagemPreview] Page picture fallback falhou:', e) }
  }
  return null
}

function urlImagemProxy(url: string): string {
  if (!url) return url
  if (url.includes('fbcdn.net') || url.includes('facebook.com') || url.includes('fbsbx.com')) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`
  }
  return url
}

function gerarPaginas(total: number, atual: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const paginas: (number | '...')[] = []
  if (atual <= 4) {
    for (let i = 1; i <= 5; i++) paginas.push(i)
    paginas.push('...')
    paginas.push(total)
  } else if (atual >= total - 3) {
    paginas.push(1)
    paginas.push('...')
    for (let i = total - 4; i <= total; i++) paginas.push(i)
  } else {
    paginas.push(1)
    paginas.push('...')
    for (let i = atual - 1; i <= atual + 1; i++) paginas.push(i)
    paginas.push('...')
    paginas.push(total)
  }
  return paginas
}

export default function MetaSpyTool() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [anuncios, setAnuncios] = useState<Anuncio[]>([])
  const [carregando, setCarregando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [mensagem, setMensagem] = useState('')
  const [alerta, setAlerta] = useState('')
  const [modalAnuncio, setModalAnuncio] = useState<Anuncio | null>(null)
  const [erroDetalhado, setErroDetalhado] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filtrosExpandidos, setFiltrosExpandidos] = useState(false)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const ITENS_POR_PAGINA = 20
  const [filtros, setFiltros] = useState<FilterState>({
    ordenacao: 'maior_escala',
    plataforma: 'ambos',
    pais: 'BR',
    statusApi: 'ACTIVE',
    midia: 'todos',
    scoreMin: 0,
    diasMin: 0,
    destino: 'todos',
    entregavel: 'todos',
    segmento: '',
    palavrasNegativas: ''
  })

  const apiOnline = true
  const buscouAuto = useRef(false)
  const [debugInfo, setDebugInfo] = useState('')

  const TERMOS_EM_ALTA = ['comprar', 'receita', 'whatsapp', 'desconto', 'curso', 'resultado', 'academia', 'emagrecer', 'digital', 'saude']

  async function buscarEmAlta() {
    const termos = TERMOS_EM_ALTA
    let todos: Anuncio[] = []
    let log: string[] = []
    for (const termo of termos) {
      if (todos.length >= 40) break
      const params = new URLSearchParams({
        ad_active_status: 'ACTIVE',
        ad_reached_countries: JSON.stringify(['BR']),
        search_terms: termo,
        limit: '10',
        fields: CAMPOS_API_MINIMO
      })
      const url = `${FB_API_BASE}?${params.toString()}`
      try {
        const json = await requisicaoApiComRetry(url)
        const dados = (json.data || []).map(normalizarAnuncioApi).filter((a): a is Anuncio => a !== null)
        todos.push(...dados)
        log.push(`${termo}: ${dados.length} ads`)
      } catch (err) {
        log.push(`${termo}: erro - ${err instanceof Error ? err.message : '?'}`)
      }
    }
    if (todos.length === 0) {
      setMensagem('Nenhum anuncio encontrado')
      setDebugInfo(log.join('\n') || 'sem dados')
    } else {
      const vistos = new Set<string>()
      const unicos = todos.filter(a => { if (vistos.has(a.idAnuncio)) return false; vistos.add(a.idAnuncio); return true })
      unicos.sort((a, b) => (b.scoreEscala || 0) - (a.scoreEscala || 0))
      setAnuncios(unicos)
      setMensagem(`${unicos.length} anuncios em alta`)
      setAlerta(`${unicos.length} anuncios em alta carregados!`)
      carregarImagensPreview(unicos).then(imgs => {
        if (imgs.size > 0) {
          setAnuncios(prev => prev.map(a => ({
            ...a,
            midias: imgs.has(a.idAnuncio) ? [{ url: imgs.get(a.idAnuncio)!, tipo: 'imagem' }] : a.midias
          })))
        }
      })
      // Enqueue background extraction for ads without thumbnails
      try {
        const semImg = unicos.filter(a => !a.midias?.[0]?.url && a.urlBiblioteca)
        if (semImg.length > 0) {
          fetch('/api/enqueue-thumbnails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ads: semImg })
          }).catch(e => console.warn('enqueue-thumbnails falhou:', e))
        }
      } catch (e) { console.warn('enqueue-thumbnails erro:', e) }
      setDebugInfo(`Total: ${todos.length}, Unicos: ${unicos.length}\n${log.join('\n')}`)
    }
    setProgresso(100)
    setCarregando(false)
  }

  useEffect(() => {
    if (buscouAuto.current || anuncios.length > 0) return
    buscouAuto.current = true
    setMensagem('Carregando anuncios em alta...')
    setCarregando(true)
    buscarEmAlta()
  }, [])

  const anunciosFiltrados = useMemo(() => {
    let lista = [...anuncios]
    if (filtros.plataforma !== 'ambos') {
      lista = lista.filter(a => (a.plataformas || []).map(p => normalizarTexto(p)).includes(filtros.plataforma))
    }
    if (filtros.midia !== 'todos') {
      lista = lista.filter(a => (a.midias || []).map(m => normalizarTexto(m.tipo || '')).includes(filtros.midia))
    }
    if (filtros.scoreMin > 0) {
      lista = lista.filter(a => (a.scoreEscala || 0) >= filtros.scoreMin)
    }
    if (filtros.diasMin > 0) {
      lista = lista.filter(a => (a.diasAtivo || 0) >= filtros.diasMin || (a.diasAtivo || 0) === 0)
    }
    if (filtros.statusApi === 'ACTIVE') {
      lista = lista.filter(a => statusAnuncio(a) === 'Ativo')
    } else if (filtros.statusApi === 'INACTIVE') {
      lista = lista.filter(a => statusAnuncio(a) !== 'Ativo')
    }
    if (filtros.destino !== 'todos') {
      lista = lista.filter(a => normalizarTexto(a.destino || '') === normalizarTexto(filtros.destino))
    }
    if (filtros.entregavel !== 'todos') {
      lista = lista.filter(a => normalizarTexto(a.entregavel || '') === normalizarTexto(filtros.entregavel))
    }
    if (filtros.palavrasNegativas) {
      const palavras = filtros.palavrasNegativas.split(/\s+/).filter(Boolean).map(p => normalizarTexto(p))
      if (palavras.length) {
        lista = lista.filter(a => {
          const texto = normalizarTexto((a.textoCompleto || '') + ' ' + (a.anunciante || '') + ' ' + (a.urlDestino || ''))
          return !palavras.some(p => texto.includes(p))
        })
      }
    }
    if (filtros.segmento === 'nutra') {
      lista = lista.filter(a => normalizarTexto(a.entregavel || '') === 'nutra')
    } else if (filtros.segmento === 'info') {
      lista = lista.filter(a => ['curso', 'pdf', 'mentoria', 'tutorial', 'consultoria'].includes(normalizarTexto(a.entregavel || '')))
    }
    if (filtros.ordenacao === 'maior_escala') {
      lista.sort((a, b) => (b.scoreEscala || 0) - (a.scoreEscala || 0))
    } else if (filtros.ordenacao === 'maior_tempo') {
      lista.sort((a, b) => (b.diasAtivo || 0) - (a.diasAtivo || 0))
    } else {
      lista.sort((a, b) => new Date(b.dataInicioISO || 0).getTime() - new Date(a.dataInicioISO || 0).getTime())
    }
    return lista
  }, [anuncios, filtros])

  const totalPaginas = useMemo(() => Math.max(1, Math.ceil(anunciosFiltrados.length / ITENS_POR_PAGINA)), [anunciosFiltrados.length])
  const anunciosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA
    return anunciosFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA)
  }, [anunciosFiltrados, paginaAtual])

  useEffect(() => { setPaginaAtual(1) }, [anunciosFiltrados.length])

  const analise = useMemo(() => {
    const base = anunciosFiltrados.length ? anunciosFiltrados : anuncios
    if (!base.length) return null
    const ativos = base.filter(a => statusAnuncio(a) === 'Ativo').length
    const altos = base.filter(a => (a.scoreEscala || 0) >= 80).length
    const medios = base.filter(a => { const s = a.scoreEscala || 0; return s >= 60 && s < 80 }).length
    const baixos = base.filter(a => (a.scoreEscala || 0) < 60).length
    const comWhatsApp = base.filter(a => normalizarTexto(a.destino || '').includes('whatsapp')).length
    const nutraCount = base.filter(a => normalizarTexto(a.entregavel || '') === 'nutra').length
    const infoCount = base.filter(a => ['curso', 'pdf', 'mentoria', 'tutorial', 'consultoria'].includes(normalizarTexto(a.entregavel || ''))).length
    const scoreSum = base.reduce((acc, a) => acc + (a.scoreEscala || 0), 0)
    const top10 = [...base].sort((a, b) => (b.scoreEscala || 0) - (a.scoreEscala || 0)).slice(0, 10)
    return { total: base.length, ativos, altos, medios, baixos, comWhatsApp, nutraCount, infoCount, scoreMedia: (scoreSum / base.length).toFixed(1), top10 }
  }, [anuncios, anunciosFiltrados])

  const montarCenariosApi = useCallback((termo: string, pais: string, statusFiltro: string) => {
    const base: Record<string, string> = {
      ad_active_status: statusFiltro || 'ACTIVE',
      limit: '50',
      locale: 'pt_BR'
    }
    const termoSeguro = termo.trim()
    if (termoSeguro) base.search_terms = termoSeguro

    function montarUrl(params: Record<string, string>) {
      const p = new URLSearchParams()
      Object.entries({ ...base, ...params }).forEach(([k, v]) => p.set(k, v))
      return `${FB_API_BASE}?${p.toString()}`
    }

    return [
      { nome: 'ALL + JSON + campos principais', url: montarUrl({ ad_type: 'ALL', ad_reached_countries: JSON.stringify([pais]), fields: CAMPOS_API_PRINCIPAL }) },
      { nome: 'ALL + colchetes + campos principais', url: montarUrl({ ad_type: 'ALL', ad_reached_countries: `['${pais}']`, fields: CAMPOS_API_PRINCIPAL }) },
      { nome: 'ALL + JSON + campos fallback', url: montarUrl({ ad_type: 'ALL', ad_reached_countries: JSON.stringify([pais]), fields: CAMPOS_API_FALLBACK }) },
      { nome: 'ALL + colchetes + campos fallback', url: montarUrl({ ad_type: 'ALL', ad_reached_countries: `['${pais}']`, fields: CAMPOS_API_FALLBACK }) }
    ]
  }, [])

  const requisicaoApiComRetry = useCallback(async (url: string, tentativa = 0): Promise<{ data?: Record<string, unknown>[]; error?: { code?: number; message?: string; error_user_title?: string; error_user_msg?: string } }> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_REQUISICAO_API_MS)
    let resposta: Response
    try {
      resposta = await fetch(url, { method: 'GET', signal: controller.signal })
    } catch (erro) {
      clearTimeout(timeout)
      if ((erro as Error)?.name === 'AbortError') throw new Error('Tempo limite da API atingido.')
      throw erro
    }
    clearTimeout(timeout)

    if (resposta.status === 429) {
      if (tentativa >= 2) throw new Error('Rate limit da API (HTTP 429).')
      await new Promise(r => setTimeout(r, PAUSA_RATE_LIMIT_MS))
      return requisicaoApiComRetry(url, tentativa + 1)
    }

    let text: string
    try {
      text = await resposta.text()
    } catch {
      throw new Error(`Falha ao ler resposta (HTTP ${resposta.status})`)
    }
    let json: Record<string, unknown> = {}
    try {
      json = JSON.parse(text)
    } catch {
      const snippet = text.slice(0, 300)
      throw new Error(`Resposta invalida (nao e JSON). HTTP ${resposta.status}. ${snippet}`)
    }
    if (!resposta.ok || json.error) {
      const err = json.error as Record<string, unknown> | undefined
      const codigo = Number(err?.code || 0)
      const msg = String(err?.message || '')
      const errUser = String(err?.error_user_title || '')
      const errUserMsg = String(err?.error_user_msg || '')
      const detalhes = [`HTTP ${resposta.status}`, msg, errUser, errUserMsg].filter(Boolean).join(' | ')
      ;(window as any).__ultimoErroApi = detalhes
      setErroDetalhado(detalhes)
      if ((codigo === 4 || codigo === 800) && tentativa < 2) {
        await new Promise(r => setTimeout(r, PAUSA_RATE_LIMIT_MS))
        return requisicaoApiComRetry(url, tentativa + 1)
      }
      throw new Error(msg || `Erro na API (${resposta.status}).`)
    }
    return json as { data?: Record<string, unknown>[]; error?: { code?: number; message?: string } }
  }, [])

  const buscarDaApi = useCallback(async (termo: string): Promise<Anuncio[]> => {
    const cenarios = montarCenariosApi(termo, filtros.pais, filtros.statusApi)
    let ultimoErro: Error | null = null

    for (const cenario of cenarios) {
      const cacheado = obterCacheApi(cenario.url)
      if (cacheado) {
        const dados = (cacheado as { data?: Record<string, unknown>[] }).data || []
        return dados.map(normalizarAnuncioApi).filter((a): a is Anuncio => a !== null)
      }
      try {
        const json = await requisicaoApiComRetry(cenario.url)
        salvarCacheApi(cenario.url, json)
        const dados = json.data || []
        return dados.map(normalizarAnuncioApi).filter((a): a is Anuncio => a !== null)
      } catch (erro) {
        ultimoErro = erro instanceof Error ? erro : new Error(String(erro))
        const msg = ultimoErro.message.toLowerCase()
        if (msg.includes('invalid parameter') || msg.includes('param') || msg.includes('ad_reached_countries')) {
          continue
        }
        throw ultimoErro
      }
    }
    throw ultimoErro || new Error('Nenhum cenario de consulta funcionou.')
  }, [filtros.pais, filtros.statusApi, montarCenariosApi])

  async function iniciarBusca() {
    setCarregando(true)
    setProgresso(10)
    setMensagem('Analisando ofertas...')
    setAlerta('')
    const termo = searchTerm.trim()

    try {
      setProgresso(30)
      if (!termo) {
        setMensagem('Digite um termo de busca')
        setProgresso(100)
        setAlerta('Informe um termo de busca.')
        setCarregando(false)
        return
      }
      setMensagem('Consultando API do Facebook...')
      const dados = await buscarDaApi(termo)
      setProgresso(80)
      setAnuncios(dados)
      setMensagem('Carregando imagens...')
      carregarImagensPreview(dados).then(imgs => {
        if (imgs.size > 0) {
          setAnuncios(prev => prev.map(a => ({
            ...a,
            midias: imgs.has(a.idAnuncio) ? [{ url: imgs.get(a.idAnuncio)!, tipo: 'imagem' }] : a.midias
          })))
        }
      })
      // Enqueue background extraction for ads without thumbnails
      try {
        const semImg = dados.filter(a => !a.midias?.[0]?.url && a.urlBiblioteca)
        if (semImg.length > 0) {
          fetch('/api/enqueue-thumbnails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ads: semImg })
          }).catch(() => {})
        }
      } catch {}
      setProgresso(100)
      setMensagem('Busca concluida')
      setAlerta(`${dados.length} ofertas encontradas!`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na busca'
      setAlerta(`Erro: ${msg}`)
      if (!erroDetalhado) setErroDetalhado(msg)
      setMensagem('Erro na busca')
      console.error('iniciarBusca error:', err)
    } finally {
      setCarregando(false)
      setTimeout(() => { if (!carregando) setAlerta('') }, 4000)
    }
  }

  function limparResultados() {
    setAnuncios([])
    setProgresso(0)
    setMensagem('')
    setAlerta('')
  }

  async function carregarImagensPreview(lista: Anuncio[]): Promise<Map<string, string>> {
    const semImagem = lista.filter(a => !a.midias?.[0]?.url && a.urlBiblioteca)
    const resultados = new Map<string, string>()
    await Promise.allSettled(semImagem.map(async a => {
      const url = await extrairImagemPreview(a)
      if (url) resultados.set(a.idAnuncio, url)
    }))
    return resultados
  }

  return (
    <div>
      {user?.plano === 'nenhum' && (
        <div className="tool-locked">
          <div className="tool-locked-icon"><IconTarget size={24} /></div>
          <h3>MetaSpy Ads Intelligence</h3>
          <p>Esta ferramenta esta disponivel apenas para assinantes.</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Assine um dos planos e tenha acesso ao minerador de anuncios,
            cloacker, clonador e todas as ferramentas avancadas.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/planos')}>
            Ver Planos
          </button>
        </div>
      )}
      {user?.plano !== 'nenhum' && (
      <div>
      <div className="tool-header">
        <h3>MetaSpy Ad Intelligence</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`status on`}>API Online</span>
          <span className={`status ${anuncios.length ? 'on' : 'off'}`}>
            {anuncios.length ? `${anunciosFiltrados.length} ofertas` : 'offline'}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            raw: {anuncios.length} | filt: {anunciosFiltrados.length}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Pesquisar anuncios (termo de busca)..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') iniciarBusca() }}
          style={{ flex: 1, minWidth: 200 }}
        />
        <button className="btn btn-primary" onClick={iniciarBusca} disabled={carregando}>
          {carregando ? 'Buscando...' : 'Iniciar Busca'}
        </button>
        <button className="btn btn-secondary" onClick={limparResultados}>
          Limpar
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <button
          className="btn btn-secondary"
          onClick={() => setFiltrosExpandidos(!filtrosExpandidos)}
          style={{ width: '100%', justifyContent: 'flex-start', fontSize: 12 }}
        >
            {filtrosExpandidos ? <><IconChevronDown size={16} /> Filtros e Configuracoes</> : <><IconChevronRight size={16} /> Filtros e Configuracoes</>}
        </button>
        {filtrosExpandidos && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10,
            padding: 12,
            marginTop: 8,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)'
          }}>
            <div className="filter-group">
              <label>Ordenar por <HelpTooltip text="Define a ordem de exibicao dos resultados: mais recentes primeiro, maior score de escala, ou maior tempo ativo." /></label>
              <select value={filtros.ordenacao} onChange={e => setFiltros({ ...filtros, ordenacao: e.target.value })}>
                <option value="mais_recente">Mais recente</option>
                <option value="maior_escala">Maior escala</option>
                <option value="maior_tempo">Maior tempo ativo</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Plataforma <HelpTooltip text="Filtrar anuncios por plataforma de exibicao: Facebook, Instagram, ou ambas." /></label>
              <select value={filtros.plataforma} onChange={e => setFiltros({ ...filtros, plataforma: e.target.value })}>
                <option value="ambos">Facebook + Instagram</option>
                <option value="facebook">Somente Facebook</option>
                <option value="instagram">Somente Instagram</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Pais <HelpTooltip text="Selecionar o pais do anuncio. A API retorna anuncios segmentados para o pais escolhido." /></label>
              <select value={filtros.pais} onChange={e => setFiltros({ ...filtros, pais: e.target.value })}>
                <option value="BR">Brasil</option>
                <option value="US">Estados Unidos</option>
                <option value="PT">Portugal</option>
                <option value="MX">Mexico</option>
                <option value="AR">Argentina</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Status do anuncio <HelpTooltip text="Filtrar por anuncios ativos (exibindo atualmente), inativos (encerrados), ou todos." /></label>
              <select value={filtros.statusApi} onChange={e => setFiltros({ ...filtros, statusApi: e.target.value })}>
                <option value="ACTIVE">Somente ativos</option>
                <option value="INACTIVE">Somente inativos</option>
                <option value="ALL">Ativos e inativos</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Midia <HelpTooltip text="Tipo de midia do anuncio: imagem, video, carrossel, ou todos." /></label>
              <select value={filtros.midia} onChange={e => setFiltros({ ...filtros, midia: e.target.value })}>
                <option value="todos">Todos</option>
                <option value="imagem">Imagem</option>
                <option value="video">Video</option>
                <option value="carrossel">Carrossel</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Score minimo <HelpTooltip text="Filtrar anuncios com score de escala igual ou superior ao valor definido (0-100)." /></label>
              <input type="number" min={0} max={100} value={filtros.scoreMin} onChange={e => setFiltros({ ...filtros, scoreMin: Number(e.target.value) })} />
            </div>
            <div className="filter-group">
              <label>Dias minimo ativo <HelpTooltip text="Filtrar anuncios com pelo menos X dias em exibicao." /></label>
              <input type="number" min={0} value={filtros.diasMin} onChange={e => setFiltros({ ...filtros, diasMin: Number(e.target.value) })} />
            </div>
            <div className="filter-group">
              <label>Destino <HelpTooltip text="Filtrar pelo tipo de destino do anuncio: WhatsApp, Pagina de vendas, Instagram." /></label>
              <select value={filtros.destino} onChange={e => setFiltros({ ...filtros, destino: e.target.value })}>
                <option value="todos">Todos</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Pagina de vendas">Pagina de vendas</option>
                <option value="Instagram">Instagram</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Entregavel <HelpTooltip text="Tipo de produto ou conteudo entregue: PDF, Curso, App, Instagram." /></label>
              <select value={filtros.entregavel} onChange={e => setFiltros({ ...filtros, entregavel: e.target.value })}>
                <option value="todos">Todos</option>
                <option value="PDF">PDF</option>
                <option value="Curso">Curso</option>
                <option value="App">App</option>
                <option value="Instagram">Instagram</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Segmento <HelpTooltip text="Categoria de mercado: Nutra (suplementos), Info (cursos/mentorias)." /></label>
              <select value={filtros.segmento} onChange={e => setFiltros({ ...filtros, segmento: e.target.value })}>
                <option value="">Todos</option>
                <option value="nutra">Nutra</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Palavras negativas <HelpTooltip text="Excluir resultados que contenham estas palavras (separadas por espaco)." /></label>
              <input type="text" placeholder="ex: igreja politica" value={filtros.palavrasNegativas} onChange={e => setFiltros({ ...filtros, palavrasNegativas: e.target.value })} />
            </div>
          </div>
        )}
      </div>

      {(carregando || progresso > 0) && (
        <div className="progresso" style={{ marginBottom: 16 }}>
          <div className="progresso-label">{mensagem || 'Processando...'}</div>
          <div className="trilha">
            <div className="barra" style={{ width: `${progresso}%` }}></div>
          </div>
        </div>
      )}

      {alerta && <div className="alerta" style={{ marginBottom: 16 }}>{alerta}</div>}
      {erroDetalhado && (
        <details style={{ marginBottom: 16, border: '1px solid var(--danger)', borderRadius: 8, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
          <summary style={{ cursor: 'pointer', padding: '8px 12px', color: 'var(--danger)', fontSize: 12, fontWeight: 600, userSelect: 'none' }}>
            Log de Erro (clique para expandir)
          </summary>
          <pre style={{ padding: 12, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, maxHeight: 200, overflowY: 'auto', color: 'var(--text-muted)' }}>{erroDetalhado}</pre>
        </details>
      )}
      {debugInfo && (
        <details style={{ marginBottom: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
          <summary style={{ cursor: 'pointer', padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, userSelect: 'none' }}>
            Debug API (clique para expandir)
          </summary>
          <pre style={{ padding: 12, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, maxHeight: 200, overflowY: 'auto', color: 'var(--text-muted)' }}>{debugInfo}</pre>
        </details>
      )}

      <div className="results-area">
        <div className="results-header">
          <span>{anunciosFiltrados.length} resultado(s)</span>
          <span>Ofertas: {anunciosFiltrados.filter(a => (a.scoreEscala || 0) >= 60).length}</span>
        </div>

        {carregando ? (
          <div className="skeleton">
            {[1,2,3,4].map(i => <div key={i} className="skeleton-card" />)}
          </div>
        ) : anunciosFiltrados.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {anuncios.length === 0 ? 'Clique em "Iniciar Busca" para comecar.' : 'Nenhum resultado com esses filtros.'}
          </div>
        ) : (
          <>
            <div className="results-grid">
              {anunciosPaginados.map(a => {
                const badge = badgeScore(a.scoreEscala || 0)
                const ehDestaque = badge.texto === 'ALTA ESCALA' || badge.texto === 'ESCALADA'
                return (
                  <div key={a.idAnuncio} className={`ad-card${ehDestaque ? ' destaque' : ''}`}>
                    <div className="ad-card-img-wrap">
                      {a.midias?.[0]?.url && <img className="ad-card-image" src={urlImagemProxy(a.midias[0].url)} alt="" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                      <div className="ad-card-image-placeholder"><IconImage size={32} /></div>
                    </div>
                    <div className="ad-card-body">
                      <h3>{a.anunciante}</h3>
                      <div className="ad-card-text">{a.texto?.slice(0, 140) || 'Sem descricao capturada.'}</div>
                      <div className="ad-badges">
                        <span className={`badge ${badge.classe}`}>{badge.texto}</span>
                        <span className={`badge ${statusAnuncio(a) === 'Ativo' ? 'ativo' : 'inativo'}`}>{statusAnuncio(a)}</span>
                        <span className="badge info">{a.entregavel || 'Indefinido'}</span>
                      </div>
                      <div className="ad-card-footer">
                        <div className="score-wrap" style={{ '--score': `${(a.scoreEscala || 0) * 3.6}deg` } as React.CSSProperties}>
                          {a.scoreEscala || 0}
                        </div>
                        <div className="ad-card-actions">
                          <button className="btn btn-secondary" onClick={() => setModalAnuncio(a)}>Detalhes</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {totalPaginas > 1 && (
              <div className="paginacao">
                <button disabled={paginaAtual <= 1} onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}>
                  &laquo; Anterior
                </button>
                {gerarPaginas(totalPaginas, paginaAtual).map((p, i) =>
                  p === '...' ? (
                    <span key={`e${i}`} className="paginacao-ellipsis">...</span>
                  ) : (
                    <button key={p} className={p === paginaAtual ? 'paginacao-ativa' : ''} onClick={() => setPaginaAtual(p)}>
                      {p}
                    </button>
                  )
                )}
                <button disabled={paginaAtual >= totalPaginas} onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}>
                  Proximo &raquo;
                </button>
              </div>
            )}
          </>
        )}

        {analise && anuncios.length > 0 && (
          <details style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
            <summary style={{ cursor: 'pointer', padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', userSelect: 'none' }}>
              Análise Avançada
            </summary>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: 10, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: 13, color: 'var(--purple-300)', marginBottom: 8, fontWeight: 600 }}>Estatisticas Gerais</h4>
                  {[{ r: 'Total de ofertas', v: analise.total }, { r: 'Anúncios ativos', v: analise.ativos }, { r: 'Score medio', v: analise.scoreMedia }].map(s => (
                    <div key={s.r} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{s.r}</span><span style={{ fontWeight: 600 }}>{s.v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding: 10, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: 13, color: 'var(--purple-300)', marginBottom: 8, fontWeight: 600 }}>Distribuicao de Score</h4>
                  {[{ r: 'Alta escala (80+)', v: analise.altos }, { r: 'Escalando (60-79)', v: analise.medios }, { r: 'Testando (<60)', v: analise.baixos }].map(s => (
                    <div key={s.r} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{s.r}</span><span style={{ fontWeight: 600 }}>{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              {analise.top10.length > 0 && (
                <div style={{ padding: 10, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: 13, color: 'var(--purple-300)', marginBottom: 8, fontWeight: 600 }}>Top 10 Melhores Scores</h4>
                  <div style={{ display: 'grid', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                    {analise.top10.map((a, i) => (
                      <div key={a.idAnuncio} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-primary)', border: '1px solid var(--border)', fontSize: 11 }}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {i + 1}. {a.anunciante || '?'}
                        </span>
                        <span style={{ fontWeight: 700, marginLeft: 8, color: (a.scoreEscala || 0) >= 80 ? 'var(--purple-400)' : (a.scoreEscala || 0) >= 60 ? 'var(--purple-200)' : 'var(--warning)' }}>
                          {a.scoreEscala || 0}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        )}
      </div>

      {modalAnuncio && (
        <div className="modal-overlay" onClick={() => setModalAnuncio(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalAnuncio.anunciante}</h2>
              <button className="modal-close" onClick={() => setModalAnuncio(null)}><IconClose size={18} /></button>
            </div>
            <div className="modal-body">
              {modalAnuncio.midias?.[0]?.url && (
                <div className="modal-media"><img src={urlImagemProxy(modalAnuncio.midias[0].url)} alt="" /></div>
              )}
              <div className="modal-text">{modalAnuncio.textoCompleto || 'Sem texto disponivel.'}</div>
              <div className="modal-info">
                ID: {modalAnuncio.idAnuncio}<br />
                Inicio: {modalAnuncio.dataInicioISO ? new Date(modalAnuncio.dataInicioISO).toLocaleDateString('pt-BR') : '-'}<br />
                Tempo ativo: {modalAnuncio.diasAtivo || 0} dia(s)<br />
                Variacoes: {modalAnuncio.variacoesAtivas || 0}<br />
                Plataformas: {(modalAnuncio.plataformas || []).join(', ') || '-'}<br />
                Status: {statusAnuncio(modalAnuncio)}<br />
                Entregavel: {modalAnuncio.entregavel || 'Indefinido'}<br />
                Destino: {modalAnuncio.destino || '-'}<br />
                Score de escala: {modalAnuncio.scoreEscala || 0}<br />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => window.open(modalAnuncio.urlBiblioteca, '_blank')}>
                Abrir no Meta Ads Library
              </button>
              <button className="btn btn-primary" onClick={() => setModalAnuncio(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    )}
    </div>
  )
}