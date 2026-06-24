import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { IconLogo, IconTarget, IconDiamond, IconLocked, IconPlay, IconBoxPlus, IconArrowDown, IconCheck, IconDash } from '../components/Icons'

export default function Landing() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="sidebar-logo-icon" style={{ width: 28, height: 28 }}>
            <IconLogo size={18} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>MetaSpy</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn btn-gradient">Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary">Entrar</Link>
              <Link to="/signup" className="btn btn-gradient">Criar Conta</Link>
            </>
          )}
        </div>
      </nav>

      <section className="landing-hero">
        <h1>Inteligência de Ofertas em Escala</h1>
        <p>
          Identifique, analise e clone as melhores ofertas da Biblioteca de Anúncios do Meta
          com filtros avançados e destaque visual em tempo real.
        </p>
        <div className="landing-cta">
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn btn-gradient" style={{ padding: '14px 32px', fontSize: 15 }}>
              Ir para o Dashboard
            </Link>
          ) : (
            <>
              <Link to="/planos" className="btn btn-gradient" style={{ padding: '14px 32px', fontSize: 15 }}>
                COMEÇAR AGORA
              </Link>
              <Link to="/login" className="btn btn-primary" style={{ padding: '14px 32px', fontSize: 15 }}>
                Entrar
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="landing-features">
        <div className="feature-card">
          <div className="feature-icon"><IconTarget size={24} /></div>
          <h3>MetaSpy Ad Intelligence</h3>
          <p>
            Escaneie a Biblioteca de Anúncios do Facebook em tempo real. Descubra ofertas
            escaladas por score, tempo de atividade, variações criativas e muito mais.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon"><IconDiamond size={24} /></div>
          <h3>Clonador</h3>
          <p>
            Clone paginas web completas para o seu computador. Suporte a sites complexos,
            quizzes Inlead, e bypass de seguranca com engine multicamada.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon"><IconLocked size={24} /></div>
          <h3>Cloacker</h3>
          <p>
            Gere scripts de cloaking profissionais para proteger suas campanhas. Deteccao
            de bots, fingerprinting e bloqueio por IP em um clique.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon"><IconTarget size={24} /></div>
          <h3>Analise Avancada</h3>
          <p>
            Dashboard completo com estatisticas de score, distribuicao por segmento,
            competitividade de nicho e top ofertas em escala.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon"><IconBoxPlus size={24} /></div>
          <h3>Filtros Inteligentes</h3>
          <p>
            Filtre por pais, plataforma, status, tipo de midia, score minimo, dias ativo,
            segmento (Nutra/Info), palavras negativas e muito mais.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon"><IconArrowDown size={24} /></div>
          <h3>Exportacao CSV</h3>
          <p>
            Exporte todos os resultados para CSV com um clique. Perfeito para analises
            externas e relatorios personalizados.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon"><IconPlay size={24} /></div>
          <h3>Bypass Engine</h3>
          <p>
            Motor de bypass em JS, Python, Node e PHP. Suporta Cloudflare, SSL,
            quizzes interativos e sites com protecao avançada.
          </p>
        </div>
      </section>

      <section className="landing-planos">
        <h2>Escolha seu Arsenal</h2>
        <p className="landing-planos-sub">Sem plano free. Sem enrolação. Resultado do primeiro dia.</p>
        <div className="landing-planos-cards">
          <div className="planos-card">
            <div className="planos-card-header">
              <h3>Mensal</h3>
              <p className="planos-card-desc">Para quem quer começar a escalar agora</p>
            </div>
            <div className="planos-card-price">
              <span className="planos-original">R$ 197</span>
              <span className="planos-current">R$ 49,90</span>
              <span className="planos-period">/mês</span>
            </div>
            <ul className="planos-features">
              <li><span className="planos-check"><IconCheck size={12} /></span>Clonador + Editor Visual</li>
              <li><span className="planos-check"><IconCheck size={12} /></span>MetaSpy Minerador de Ads</li>
              <li><span className="planos-check"><IconCheck size={12} /></span>Estrutura de Arquivos + ZIP</li>
              <li className="off"><span className="planos-check"><IconDash size={12} /></span>Cloacker Profissional</li>
              <li className="off"><span className="planos-check"><IconDash size={12} /></span>Análise Avançada</li>
            </ul>
            <Link to="/signup" className="btn btn-primary planos-cta">Assinar Agora</Link>
          </div>

          <div className="planos-card planos-card-destaque">
            <div className="planos-card-badge">MELHOR VALOR</div>
            <div className="planos-card-header">
              <h3>Anual</h3>
              <p className="planos-card-desc">O pacote completo para máquinas de guerra</p>
            </div>
            <div className="planos-card-price">
              <span className="planos-original">R$ 397</span>
              <span className="planos-current">R$ 110,90</span>
              <span className="planos-period">/ano</span>
              <span className="planos-renovation">Renova por R$ 97/ano</span>
            </div>
            <ul className="planos-features">
              <li><span className="planos-check"><IconCheck size={12} /></span>Clonador + Editor Visual</li>
              <li><span className="planos-check"><IconCheck size={12} /></span>MetaSpy Minerador de Ads</li>
              <li><span className="planos-check"><IconCheck size={12} /></span>Estrutura de Arquivos + ZIP</li>
              <li><span className="planos-check"><IconCheck size={12} /></span>Cloacker Profissional</li>
              <li><span className="planos-check"><IconCheck size={12} /></span>Análise Avançada + Suporte</li>
            </ul>
            <Link to="/signup" className="btn btn-gradient planos-cta">Assinar Agora</Link>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link to="/planos" className="btn btn-secondary" style={{ padding: '12px 28px' }}>Ver Comparativo Completo</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <p>MetaSpy &copy; 2026 — Inteligência de ofertas em escala. By Banshee.ads</p>
      </footer>
    </div>
  )
}
