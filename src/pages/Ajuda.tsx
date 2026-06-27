import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

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

    function getPageH() {
      return Math.max(document.documentElement.scrollHeight, window.innerHeight)
    }

    function resize() {
      const pw = window.innerWidth
      const ph = getPageH()
      canvas!.width = pw * dpr
      canvas!.height = ph * dpr
      canvas!.style.width = pw + 'px'
      canvas!.style.height = ph + 'px'
      ctx!.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    const ph = getPageH()
    const count = Math.min(120, Math.floor(window.innerWidth * ph / 12000))
    const pts: { x: number; y: number; vx: number; vy: number; s: number; o: number }[] = []

    for (let i = 0; i < count; i++) {
      pts.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * ph,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        s: Math.random() * 2.4 + 0.6,
        o: Math.random() * 0.45 + 0.15,
      })
    }

    function draw() {
      const w = window.innerWidth
      const h = getPageH()
      ctx!.clearRect(0, 0, w, h)

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]
        const dx = mx - p.x
        const dy = (my + window.scrollY) - p.y

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

  return <canvas ref={ref} className="ajuda-particles" />
}

interface CategoriaProps {
  titulo: string
  icone: string
  itens: { pergunta: string; resposta: string }[]
  index: number
}

function iconeSvg(nome: string) {
  const svgs: Record<string, string> = {
    'inicio': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    'search': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    'copy': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    'shield': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    'eye': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    'image': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    'upload': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    'settings': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    'help': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    'user': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    'zap': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    'layers': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    'code': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    'alert': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    'link': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    'download': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    'grid': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    'lock': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    'filter': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    'bar-chart': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    'play': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    'file': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    'check-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    'x-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    'refresh': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    'chevron-down': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    'search-icon': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  }
  return svgs[nome] || svgs['help']
}

const CATEGORIAS: CategoriaProps[] = [
  {
    titulo: 'Primeiros Passos',
    icone: 'inicio',
    itens: [
      {
        pergunta: 'Como criar uma conta no MetaSpy?',
        resposta: 'Acesse a pagina de cadastro em /signup. Digite seu email no primeiro passo. Se o email nao estiver cadastrado, preencha seu nome e crie uma senha com no minimo 6 caracteres. Um codigo de verificacao sera enviado ao seu email. Insira o codigo para ativar sua conta.',
      },
      {
        pergunta: 'Nao recebi o codigo de verificacao',
        resposta: 'Verifique a pasta de spam ou lixo eletronico. O codigo pode levar alguns minutos para chegar. Na pagina de cadastro, clique em "Reenviar codigo" apos 30 segundos. Se o problema persistir, tente usar outro email ou entre em contato com o suporte.',
      },
      {
        pergunta: 'Como faco login na plataforma?',
        resposta: 'Acesse /login e informe seu email e senha. Se as credenciais estiverem corretas, voce sera redirecionado ao dashboard. Caso receba "Credenciais invalidas", verifique se os dados estao corretos ou utilize a recuperacao de senha.',
      },
      {
        pergunta: 'Esqueci minha senha. O que fazer?',
        resposta: 'Acesse /esqueci-senha e digite seu email. Um codigo de 6 digitos sera enviado para recuperacao. Insira o codigo e crie uma nova senha com no minimo 6 caracteres. A senha sera redefinida imediatamente.',
      },
      {
        pergunta: 'Como escolher o melhor plano para mim?',
        resposta: 'Analise as ferramentas que voce precisa: o plano Basico (R$ 39,90/mes) inclui Minerador de Anuncios e Removedor de Metadados. O Gold (R$ 57,90/mes) adiciona Hospedar Paginas. O Premium (R$ 197/mes) libera todas as ferramentas incluindo Cloacker profissional.',
      },
      {
        pergunta: 'Como assinar um plano?',
        resposta: 'Acesse a pagina /planos, escolha o plano desejado e clique em "Assinar Agora". Se ja estiver logado, sera redirecionado ao checkout da Kirvano para pagamento via cartao, Pix ou boleto. Apos a confirmacao, seu plano sera ativado automaticamente.',
      },
    ],
  },
  {
    titulo: 'MetaSpy - Minerador de Anuncios',
    icone: 'search',
    itens: [
      {
        pergunta: 'Como buscar anuncios na Biblioteca do Meta?',
        resposta: 'No MetaSpy Tool, digite uma palavra-chave, URL ou nome de pagina no campo de busca. Use o botao "Buscar" para iniciar. Os resultados serao exibidos com anunciante, texto, plataformas, score, escala e outras metricas.',
      },
      {
        pergunta: 'Quais filtros estao disponiveis?',
        resposta: 'Filtre por pais, plataforma (Facebook/Instagram), status, tipo de midia, score minimo, dias ativo, segmento (Nutra/Info) e palavras negativas. Use combinacoes de filtros para refinar sua busca.',
      },
      {
        pergunta: 'Como interpretar o score e as metricas?',
        resposta: 'O score indica a relevancia do anuncio baseado em tempo de atividade, engajamento e variacoes criativas. A escala mostra o volume estimado de gasto. Quanto maior o score e a escala, mais promissora a oferta.',
      },
      {
        pergunta: 'Como exportar resultados para CSV?',
        resposta: 'Apos realizar uma busca, clique no botao "Exportar CSV" no topo da tabela de resultados. O arquivo sera baixado automaticamente com todos os dados da busca atual, perfeito para analises externas.',
      },
      {
        pergunta: 'O que sao palavras negativas?',
        resposta: 'Palavras negativas sao termos que voce pode adicionar para excluir anuncios irrelevantes dos resultados. Por exemplo, ao buscar "emagrecedor", adicione "detox" como negativa se quiser evitar anuncios de detox.',
      },
      {
        pergunta: 'Erro na API do Facebook: como resolver?',
        resposta: 'O MetaSpy utiliza a Graph API do Facebook. Se ocorrer erro na API, pode ser devido a limite de requisicoes ou instabilidade temporaria. Aguarde alguns minutos e tente novamente.',
      },
      {
        pergunta: 'Resultados de busca nao aparecem',
        resposta: 'Verifique se os filtros nao estao muito restritivos. Tente ampliar o periodo de busca ou remover filtros. Se o problema persistir, a Biblioteca de Anuncios do Meta pode estar temporariamente indisponivel.',
      },
    ],
  },
  {
    titulo: 'PageVault - Clonador de Paginas',
    icone: 'copy',
    itens: [
      {
        pergunta: 'Como clonar uma pagina?',
        resposta: 'No PageVault Tool, insira a URL completa da pagina que deseja clonar. Clique em "Clonar Pagina". Acompanhe o progresso em etapas: HTML, Recursos, Render e Salvar. Ao final, voce pode baixar o clone ou copiar o HTML.',
      },
      {
        pergunta: 'Qual a diferenca entre clonagem basica e profunda?',
        resposta: 'A clonagem basica baixa o HTML e recursos principais. A clonagem profunda (disponivel nos planos com bypass) utiliza engine multicamada para capturar paginas com protecao Cloudflare, SSL, quizzes interativos e sites com bloqueio avançado.',
      },
      {
        pergunta: 'O que e o Bypass Engine?',
        resposta: 'O Bypass Engine e um motor multi-linguagem (JS, Python, Node, PHP) que contorna protecoes como Cloudflare, SSL e quizzes interativos. Quanto maior o plano, mais camadas de bypass estao disponiveis.',
      },
      {
        pergunta: 'Como baixar o clone para meu computador?',
        resposta: 'Apos a clonagem, clique em "Salvar no Computador" para baixar um arquivo ZIP com todos os recursos da pagina. Clique em "Copiar HTML" para copiar apenas o codigo HTML para a area de transferencia.',
      },
      {
        pergunta: 'Erro "URL invalida" ao clonar',
        resposta: 'Verifique se a URL esta completa (incluindo https://). Certifique-se de que o site esta acessivel publicamente. Alguns sites bloqueiam acesso automatizado, nesse caso tente a clonagem profunda.',
      },
      {
        pergunta: 'Atingi o limite de clones',
        resposta: 'Cada plano tem um limite mensal de clones. Para aumentar seu limite, faca upgrade para um plano superior em /planos. O limite e resetado a cada ciclo de faturamento.',
      },
    ],
  },
  {
    titulo: 'Cloacker - Script Basico',
    icone: 'shield',
    itens: [
      {
        pergunta: 'Como gerar um script de cloaking?',
        resposta: 'No Cloacker Tool, preencha a URL de destino (para humanos) e a URL segura (para robos/revisores). Clique em "Gerar Script". O script gerado redireciona revisores para a URL segura enquanto usuarios reais veem a pagina de destino.',
      },
      {
        pergunta: 'Como copiar e usar o script?',
        resposta: 'Apos gerar o script, clique em "Copiar Script". Cole o codigo antes da tag </body> no HTML da sua pagina de destino. O script funciona automaticamente sem necessidade de configuracao adicional.',
      },
      {
        pergunta: 'O que colocar nas URLs de destino e segura?',
        resposta: 'A URL de destino e a pagina que usuarios reais devem ver (sua oferta). A URL segura e a pagina que robos e revisores veem (pode ser uma pagina comum, branca ou qualquer URL que nao queime sua oferta).',
      },
      {
        pergunta: 'Erro ao gerar script de cloaking',
        resposta: 'Verifique se todas as URLs sao validas (comecam com https://). Certifique-se de que o servico esta online. Se o erro persistir, tente gerar o script avancado ou entre em contato com o suporte.',
      },
    ],
  },
  {
    titulo: 'Cloacker - Script Avancado',
    icone: 'zap',
    itens: [
      {
        pergunta: 'Como funciona o script avancado?',
        resposta: 'O script avancado utiliza um sistema de fraud score que analisa multiple fatores: ASN, TCP fingerprint, JA4 hash, User-Agent, idioma, timing e referrer. Cada fator tem um peso configurado para decidir se o visitante e humano ou robo.',
      },
      {
        pergunta: 'Como configurar os pesos do fraud score?',
        resposta: 'No Cloaker Enhanced, ajuste os pesos de cada fator conforme sua necessidade. Os pesos determinam a importancia de cada criterio na decisao final. Valores mais altos significam maior influencia no score.',
      },
      {
        pergunta: 'Diferenca entre script basico e avancado?',
        resposta: 'O script basico usa apenas User-Agent para detectar robos. O avancado utiliza multiplas camadas de deteccao (fingerprint, JA4, ASN, timing) oferecendo protecao muito mais robusta contra revisores sofisticados.',
      },
    ],
  },
  {
    titulo: 'Cloak Detector',
    icone: 'eye',
    itens: [
      {
        pergunta: 'Como detectar se uma pagina usa cloaking?',
        resposta: 'No Cloak Detector, insira a URL da pagina que deseja analisar e clique em "Analisar". A ferramenta compara a resposta para 3 User-Agents diferentes (humano, Googlebot, robo) e calcula a probabilidade de cloaking.',
      },
      {
        pergunta: 'Como interpretar os resultados do detector?',
        resposta: 'O resultado mostra a Probabilidade de Cloaking (0-100%), Score detalhado, IP utilizado, User-Agent de cada teste, Status Code e um preview do HTML retornado. Quanto maior a probabilidade, mais indicios de cloaking.',
      },
      {
        pergunta: 'O que significa cada metrica no resultado?',
        resposta: 'Score: nota geral baseada nas diferencas entre respostas. IP: endereco usado na requisicao. Status Code: codigo HTTP retornado (200 = sucesso). HTML Preview: amostra do codigo recebido em cada cenario.',
      },
    ],
  },
  {
    titulo: 'Camuflagem de Texto',
    icone: 'code',
    itens: [
      {
        pergunta: 'Como ocultar textos sensiveis?',
        resposta: 'No Camuflagem de Texto, digite ou cole o texto que deseja proteger. Clique em "Gerar Script". O script ofusca o texto usando tecnicas de codificacao que sao invisiveis para robos mas legiveis para usuarios.',
      },
      {
        pergunta: 'Como usar o script de camuflagem gerado?',
        resposta: 'Copie o script gerado e insira no HTML da sua pagina. O texto camuflado sera renderizado normalmente para usuarios, enquanto robos de revisao veem apenas o codigo ofuscado.',
      },
      {
        pergunta: 'A ofuscacao afeta o carregamento da pagina?',
        resposta: 'Nao. O script e leve e executa instantaneamente no navegador do usuario. O impacto no carregamento e imperceptivel, e o texto permanece legivel e funcional para quem acessa a pagina.',
      },
    ],
  },
  {
    titulo: 'Camuflagem de Midia',
    icone: 'image',
    itens: [
      {
        pergunta: 'O que e Thumbnail Spoofing?',
        resposta: 'O Thumbnail Spoofing exibe uma imagem segura (thumbnail) para robos de revisao, enquanto usuarios reais veem a midia real apos interacao (clique ou hover). Ideal para proteger criativos de ofertas.',
      },
      {
        pergunta: 'O que e Click to Reveal?',
        resposta: 'O modo Click to Reveal mostra uma capa segura sobre a midia. O usuario precisa clicar para revelar o conteudo real. Isso impede que robos de revisao identifiquem a midia verdadeira durante a inspecao.',
      },
      {
        pergunta: 'Quais os limites de arquivo para upload?',
        resposta: 'O limite maximo e de 200MB por arquivo. Formatos aceitos: MP4, JPG, PNG, GIF. Para arquivos muito grandes, recomendamos comprimir antes do upload.',
      },
    ],
  },
  {
    titulo: 'Campanhas de Cloaking',
    icone: 'layers',
    itens: [
      {
        pergunta: 'Como criar uma campanha de cloaking?',
        resposta: 'No Cloaker Campanhas, clique em "Criar Campanha", de um nome e informe a URL de destino. Apos criar, voce recebera um link unico de redirecionamento para usar em seus anuncios.',
      },
      {
        pergunta: 'Como gerenciar URLs no pool da campanha?',
        resposta: 'Apos criar a campanha, voce pode adicionar multiplas URLs ao pool. O sistema distribui o trafego entre as URLs configuradas, permitindo rodar varias ofertas em uma mesma campanha.',
      },
      {
        pergunta: 'Como funciona o link de redirecionamento?',
        resposta: 'O link gerado para cada campanha possui assinatura HMAC com SHA-512 para seguranca. Quando um usuario acessa o link, o sistema calcula o fraud score e decide se redireciona para a oferta ou para uma pagina segura.',
      },
      {
        pergunta: 'Onde vejo os logs da campanha?',
        resposta: 'No Cloaker Logs, voce ve os redirecionamentos em tempo real via SSE (Server-Sent Events). Filtre por IP, URL, campanha ou score. As colunas mostram IP, User-Agent, Score, Decisao e Data.',
      },
    ],
  },
  {
    titulo: 'Esteganografia (Premium)',
    icone: 'lock',
    itens: [
      {
        pergunta: 'Como esconder uma mensagem em uma imagem?',
        resposta: 'No Cloaker Steganografia, selecione o modo "Esconder Mensagem", faca upload de uma imagem PNG e digite a mensagem. Clique em "Processar". A mensagem sera incorporada na imagem usando tecnica LSB (Least Significant Bit).',
      },
      {
        pergunta: 'Como extrair uma mensagem oculta?',
        resposta: 'Selecione o modo "Extrair Mensagem" e faca upload da imagem que contem a mensagem oculta. Clique em "Processar". O sistema extraira e exibira a mensagem incorporada.',
      },
      {
        pergunta: 'O que e LSB e como funciona?',
        resposta: 'LSB (Least Significant Bit) e uma tecnica que altera os bits menos significativos dos pixels da imagem para armazenar dados. A alteracao e imperceptivel ao olho humano, mas perfeitamente recuperavel com a ferramenta certa.',
      },
    ],
  },
  {
    titulo: 'Fingerprint Detector (Premium)',
    icone: 'shield',
    itens: [
      {
        pergunta: 'Como funciona o detector de fingerprint?',
        resposta: 'O Fingerprint Detector analisa 15 caracteristicas do navegador do visitante: WebGL, Canvas, AudioContext, Fontes, Resolucao, Plugins, DoNotTrack, etc. Gera um score de 0 a 100 indicando o nivel de suspeita.',
      },
      {
        pergunta: 'Como interpretar o score de fingerprint?',
        resposta: 'Score 0-20: navegador natural. 20-50: levemente suspeito. 50-80: moderadamente suspeito. 80-100: muito provavelmente automatizado. A lista "suspicious_reasons" detalha quais caracteristicas geraram alerta.',
      },
      {
        pergunta: 'Quais detalhes de seguranca sao analisados?',
        resposta: 'WebGL renderer, Canvas fingerprint, AudioContext, fontes instaladas, resolucao da tela, plugins, DoNotTrack, idiomas, timezone, hardware concurrency, device memory, touch support, cookies enabled, indexed DB e localStorage.',
      },
    ],
  },
  {
    titulo: 'Logs de Cloaking',
    icone: 'bar-chart',
    itens: [
      {
        pergunta: 'Como visualizar logs em tempo real?',
        resposta: 'No Cloaker Logs, os logs sao exibidos automaticamente via conexao SSE. O indicador verde mostra "Conectado" e vermelho "Desconectado". Os logs aparecem em tempo real sem necessidade de recarregar a pagina.',
      },
      {
        pergunta: 'Como filtrar os logs?',
        resposta: 'Use o campo de busca para filtrar por IP, URL, campanha ou score. A lista e atualizada instantaneamente conforme voce digita. Para limpar o filtro, apague o texto do campo.',
      },
      {
        pergunta: 'Nenhum log aparecendo, o que fazer?',
        resposta: 'Verifique se o indicador de conexao esta verde. Se estiver vermelho, recarregue a pagina. Certifique-se de que ha trafego sendo direcionado para suas campanhas. Os logs so aparecem quando ha requisicoes.',
      },
    ],
  },
  {
    titulo: 'Host de Paginas',
    icone: 'upload',
    itens: [
      {
        pergunta: 'Como hospedar uma pagina?',
        resposta: 'No Host Page, arraste um arquivo ZIP contendo seu site ou clique para selecionar. O upload processa e publica automaticamente. Ao final, voce recebe uma URL unica para acessar a pagina hospedada.',
      },
      {
        pergunta: 'Quais formatos sao aceitos?',
        resposta: 'Apenas arquivos ZIP sao aceitos. O ZIP deve conter um arquivo index.html na raiz. Outros formatos como RAR ou 7z nao sao suportados. O tamanho maximo depende do seu plano.',
      },
      {
        pergunta: 'Como acessar minha pagina publicada?',
        resposta: 'Apos o upload, um slug unico e gerado. Sua pagina fica disponivel em metaspy-saas.onrender.com/api/page/{slug}. Copie o link clicando em "Copiar Link" na lista de sites hospedados.',
      },
      {
        pergunta: 'Como gerenciar meus sites hospedados?',
        resposta: 'Na seccao "Meus Sites", voce ve todos os sites que ja hospedou. Cada site mostra o slug, data de criacao e botoes para "Copiar Link" ou "Excluir". Para atualizar um site, exclua e faca upload novamente.',
      },
      {
        pergunta: 'Como excluir um site hospedado?',
        resposta: 'Na lista de "Meus Sites", clique em "Excluir" ao lado do site que deseja remover. A exclusao e imediata e o link de acesso para de funcionar. Esta acao nao pode ser desfeita.',
      },
    ],
  },
  {
    titulo: 'Metadata Cleaner',
    icone: 'file',
    itens: [
      {
        pergunta: 'Como limpar metadados de um arquivo?',
        resposta: 'No Metadata Cleaner, arraste o arquivo ou clique para selecionar. O sistema remove automaticamente metadados como GPS, camera, data, software e informacoes pessoais. Apos o processamento, baixe o arquivo limpo.',
      },
      {
        pergunta: 'Quais formatos sao suportados?',
        resposta: 'Imagens: JPG, PNG, WEBP. Videos: MP4. Outros formatos podem nao ter suporte completo para remocao de metadados.',
      },
      {
        pergunta: 'Quais os limites de tamanho?',
        resposta: 'O limite e de 200 MB para videos e 30 MB para imagens. Arquivos maiores que esses limites serao rejeitados. Comprima o arquivo antes do upload se necessario.',
      },
      {
        pergunta: 'Como baixar o arquivo limpo?',
        resposta: 'Apos o processamento, clique em "Baixar Arquivo Limpo". O arquivo sera baixado sem metadados. O nome do arquivo original e preservado com sufixo "_clean".',
      },
    ],
  },
  {
    titulo: 'Quizzes',
    icone: 'grid',
    itens: [
      {
        pergunta: 'Como criar um quiz?',
        resposta: 'Em "Meus Quizzes", clique em "+ Novo Quiz". No construtor, arraste nos da paleta para o canvas. Conecte os nos para criar o fluxo. Cada no pode ser configurado no painel lateral.',
      },
      {
        pergunta: 'Quais tipos de no existem?',
        resposta: 'Sao 6 tipos: Inicio (ponto de partida), Pergunta (texto + opcoes), Condicao (logica), Pontuacao (adiciona/remove pontos), Resultado (tela final), Redirecionar (URL externa). Cada um tem propriedades especificas.',
      },
      {
        pergunta: 'Como publicar um quiz?',
        resposta: 'No Quiz Builder, clique em "Publicar". Um slug unico sera gerado. Compartilhe o link publico em /quiz/{slug}. Os usuarios podem jogar sem precisar de cadastro.',
      },
      {
        pergunta: 'Como ver as estatisticas do quiz?',
        resposta: 'Na lista de quizzes, clique em "Estatisticas" ao lado do quiz desejado. Veja: total de sessoes, concluidas, em andamento, media de acertos e dados detalhados de cada sessao.',
      },
      {
        pergunta: 'Como funciona o quiz publico?',
        resposta: 'Qualquer pessoa com o link /quiz/{slug} pode jogar. Navega entre os nos, responde perguntas, acumula pontos e ve o resultado final. Nao requer login ou cadastro.',
      },
    ],
  },
  {
    titulo: 'Conta e Configuracoes',
    icone: 'settings',
    itens: [
      {
        pergunta: 'Como editar meu perfil?',
        resposta: 'No Dashboard, acesse "Perfil" no menu lateral. Altere nome e email. Clique em "Salvar" para confirmar as alteracoes. As informacoes sao atualizadas imediatamente.',
      },
      {
        pergunta: 'Como alterar minha senha?',
        resposta: 'No Perfil, na seccao "Alterar Senha", digite sua senha atual, a nova senha e a confirmacao. A nova senha deve ter no minimo 6 caracteres. Clique em "Salvar" para confirmar.',
      },
      {
        pergunta: 'Onde vejo meu plano e assinatura?',
        resposta: 'No Dashboard, acesse "Perfil". Suas informacoes de plano, status da assinatura e data de expiracao sao exibidas. Para fazer upgrade, va em /planos.',
      },
      {
        pergunta: 'Como cancelar minha assinatura?',
        resposta: 'O cancelamento pode ser solicitado diretamente pelo Kirvano ou entrando em contato com o suporte. Apos o cancelamento, seu acesso continua ate o fim do periodo pago.',
      },
    ],
  },
  {
    titulo: 'Erros e Solucoes',
    icone: 'alert',
    itens: [
      {
        pergunta: 'Credenciais invalidas ao fazer login',
        resposta: 'Esse erro ocorre quando email ou senha estao incorretos. Verifique se o email esta correto e a senha foi digitada sem espacos extras. Utilize "Esqueci minha senha" se necessario.',
      },
      {
        pergunta: 'Erro de conexao com o servidor',
        resposta: 'Pode ser causado por instabilidade na rede, servidor temporariamente offline ou bloqueio de firewall. Verifique sua conexao com a internet e tente novamente em alguns minutos.',
      },
      {
        pergunta: 'Codigo de verificacao invalido ou expirado',
        resposta: 'O codigo de verificacao expira apos alguns minutos. Solicite um novo codigo clicando em "Reenviar". Certifique-se de digitar exatamente os 6 digitos recebidos no email.',
      },
      {
        pergunta: 'Limite de uso atingido',
        resposta: 'Cada plano possui limites de uso para cada ferramenta (clones, buscas, etc). Quando o limite e atingido, voce precisa esperar o reset do ciclo ou fazer upgrade para um plano superior.',
      },
      {
        pergunta: 'Arquivo muito grande para upload',
        resposta: 'O limite de upload e de 200 MB para videos e 30 MB para imagens no Metadata Cleaner, e 200MB para midia no Camuflagem de Midia. Comprima o arquivo antes de tentar novamente.',
      },
      {
        pergunta: 'Formato de arquivo invalido',
        resposta: 'Verifique se o arquivo esta em um formato aceito: ZIP para host de paginas, JPG/PNG/WEBP/MP4 para Metadata Cleaner e midia. Formatos nao suportados serao rejeitados.',
      },
      {
        pergunta: 'Funcionalidade bloqueada para meu plano',
        resposta: 'Algumas ferramentas sao exclusivas dos planos Gold e Premium. Va em /planos para comparar os recursos de cada plano e fazer upgrade se desejar.',
      },
    ],
  },
]

export default function Ajuda() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
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
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' })

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

  const categoriasFiltradas = CATEGORIAS.map(cat => ({
    ...cat,
    itens: cat.itens.filter(
      item =>
        item.pergunta.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.resposta.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  })).filter(cat => cat.itens.length > 0)

  function toggleAberto(key: string) {
    setAbertos(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="ajuda-page" ref={pageRef}>
      <ParticleField />
      <div className="ajuda-bg" />

      <section className="ajuda-hero" data-tilt>
        <div className="ajuda-hero-inner">
          <h1 className="reveal-lift ajuda-hero-title" data-reveal style={revealStyle(120)}>
            Central de Ajuda
          </h1>
          <p className="ajuda-subtitle reveal-lift" data-reveal style={revealStyle(240)}>
            Tire suas duvidas sobre todas as ferramentas do MetaSpy
          </p>

          <div className="ajuda-search" data-reveal style={revealStyle(360)}>
            <div className="ajuda-search-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <input
              type="text"
              className="ajuda-search-input"
              placeholder="Pesquisar duvidas, ferramentas, erros..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="ajuda-hero-cta-row" data-reveal style={revealStyle(480)}>
            {isAuthenticated ? (
              <button type="button" className="btn btn-gradient" onClick={() => navigate('/dashboard')}>
                Ir para o Dashboard
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-gradient" onClick={() => navigate('/signup')}>
                  CRIAR CONTA
                </button>
                <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>
                  Entrar
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="ajuda-categorias">
        <div className="ajuda-categorias-grid">
          {categoriasFiltradas.map((cat, catIndex) => (
            <article
              key={cat.titulo}
              className="ajuda-categoria-card"
              data-reveal
              style={revealStyle(catIndex * 60)}
            >
              <button
                type="button"
                className="ajuda-categoria-header"
                onClick={() => toggleAberto(cat.titulo)}
                aria-expanded={!!abertos[cat.titulo]}
              >
                <div className="ajuda-categoria-icon" dangerouslySetInnerHTML={{ __html: iconeSvg(cat.icone) }} />
                <div className="ajuda-categoria-info">
                  <h2 className="ajuda-categoria-titulo">{cat.titulo}</h2>
                  <span className="ajuda-categoria-count">{cat.itens.length} {cat.itens.length === 1 ? 'artigo' : 'artigos'}</span>
                </div>
                <div className={`ajuda-chevron ${abertos[cat.titulo] ? 'ajuda-chevron-open' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </button>

              <div className={`ajuda-categoria-body ${abertos[cat.titulo] ? 'ajuda-categoria-body-open' : ''}`}>
                <div className="ajuda-categoria-itens">
                  {cat.itens.map((item, itemIndex) => (
                    <details key={itemIndex} className="ajuda-item">
                      <summary className="ajuda-item-summary">{item.pergunta}</summary>
                      <div className="ajuda-item-resposta">
                        <p>{item.resposta}</p>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>

        {categoriasFiltradas.length === 0 && (
          <div className="ajuda-empty" data-reveal style={revealStyle(120)}>
            <div className="ajuda-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h3>Nenhum resultado encontrado</h3>
            <p>Tente termos diferentes ou navegue pelas categorias acima.</p>
          </div>
        )}
      </section>

      <section className="ajuda-cta-bottom" data-reveal style={revealStyle(180)}>
        <h2>Precisa de mais ajuda?</h2>
        <p>Entre em contato com nosso time de suporte</p>
        <button type="button" className="btn btn-gradient" onClick={() => navigate(isAuthenticated ? '/dashboard/perfil' : '/signup')}>
          FALAR COM SUPORTE
        </button>
      </section>

      <footer className="ajuda-footer">
        <p>MetaSpy (c) 2026 — Central de Ajuda. Todos os direitos reservados.</p>
      </footer>
    </div>
  )
}
