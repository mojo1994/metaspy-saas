import { useState } from 'react'

const PAGES: Record<string, { titulo: string; conteudo: string }> = {
  about: {
    titulo: 'Sobre o MetaSpy',
    conteudo: `O MetaSpy e uma plataforma completa de inteligencia de anuncios e clonagem de paginas web.

Fundado com o objetivo de oferecer ferramentas profissionais para analise de concorrencia e arquivamento de paginas, o MetaSpy combina:

- MetaSpy Ads: Inteligencia de anuncios do Facebook com analise de score de escala, deteccao de destino e entregavel.
- Clonador: Clonagem offline de paginas web com suporte a sites complexos e bypass de seguranca.
- Cloacker: Geracao de scripts de cloaking para protecao de campanhas.

Todas as ferramentas sao projetadas para serem simples, rapidas e eficientes.`
  },
  terms: {
    titulo: 'Termos de Uso',
    conteudo: `1. Aceitacao dos Termos
Ao utilizar o MetaSpy, voce concorda com estes termos de uso.

2. Uso Permitido
O MetaSpy deve ser utilizado apenas para fins legais e eticos. E proibido o uso das ferramentas para atividades ilegais, violacao de direitos autorais, ou qualquer outra atividade que infrinja leis aplicaveis.

3. Conta e Seguranca
Voce e responsavel por manter a confidencialidade de sua conta e senha. Notifique-nos imediatamente sobre qualquer uso nao autorizado.

4. Limitacao de Responsabilidade
O MetaSpy e fornecido "como esta", sem garantias de qualquer tipo. Nao nos responsabilizamos por danos diretos ou indiretos decorrentes do uso da plataforma.

5. Alteracoes
Reservamo-nos o direito de modificar estes termos a qualquer momento. Alteracoes serao comunicadas via email ou notificacao na plataforma.`
  },
  privacy: {
    titulo: 'Politica de Privacidade',
    conteudo: `1. Dados Coletados
Coletamos apenas os dados necessarios para o funcionamento da plataforma: nome, email, e preferencias de configuracao.

2. Uso dos Dados
Seus dados sao utilizados exclusivamente para:
- Fornecer acesso a plataforma
- Melhorar a experiencia do usuario
- Comunicacoes sobre atualizacoes e suporte

3. Armazenamento
Os dados sao armazenados localmente no navegador (localStorage). Nao mantemos servidores externos com dados pessoais dos usuarios.

4. Compartilhamento
Nao compartilhamos seus dados com terceiros. Nenhuma informacao pessoal e vendida ou transferida.

5. Seguranca
Utilizamos praticas recomendadas de seguranca para proteger seus dados contra acesso nao autorizado.

6. Seus Direitos
Voce pode solicitar a qualquer momento a exportacao ou exclusao dos seus dados entrando em contato conosco.`
  }
}

export default function Settings() {
  const [page, setPage] = useState('about')

  return (
    <div>
      <div className="tool-header">
        <h3>Configuracoes</h3>
      </div>

      <div className="clone-layout">
        <div className="clone-config">
          <div className="clone-config-section">
            <div className="clone-config-header">Navegacao</div>
            <div className="clone-config-body" style={{ gap: 4 }}>
              {Object.entries(PAGES).map(([key, p]) => (
                <button
                  key={key}
                  className={`sidebar-link ${page === key ? 'active' : ''}`}
                  onClick={() => setPage(key)}
                  style={{ fontSize: 13 }}
                >
                  {p.titulo}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="clone-right">
          <div className="clone-progress-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
              {PAGES[page].titulo}
            </h3>
            <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
              {PAGES[page].conteudo}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
