import LegalPage from '../components/LegalPage'

export default function CookiePolicy() {
  return (
    <LegalPage title="Política de Cookies" updatedAt="11/10/2026">
      <p>
        Esta política explica como o MetaSpy utiliza cookies e tecnologias de armazenamento local semelhantes.
      </p>

      <h3>1. O que usamos</h3>
      <ul>
        <li><strong>metaspy_session</strong> — mantém seus dados de sessão para que você permaneça logado.</li>
        <li><strong>metaspy_access_token</strong> — token de acesso de curta duração, usado para autenticar chamadas à API.</li>
        <li><strong>metaspy_refresh_token</strong> — cookie httpOnly usado para renovar a sessão com segurança.</li>
        <li><strong>metaspy_lang</strong> — guarda o idioma escolhido por você.</li>
        <li><strong>metaspy_consent_v1</strong> — registra sua escolha de consentimento de cookies.</li>
      </ul>

      <h3>2. Cookies de terceiros</h3>
      <p>
        Durante o checkout, a Kirvano pode definir cookies próprios para processar o pagamento. Consulte a
        política de privacidade da Kirvano para mais detalhes.
      </p>

      <h3>2.1 Armazenamento local</h3>
      <p>
        Alguns dados de sessão e preferências são guardados no armazenamento local do navegador (localStorage),
        que não é enviado automaticamente ao servidor e pode ser apagado por você a qualquer momento nas
        configurações do navegador.
      </p>

      <h3>2. Categorias</h3>
      <ul>
        <li><strong>Essenciais:</strong> necessários para login, segurança e funcionamento da plataforma. Não podem ser desativados.</li>
        <li><strong>Preferências:</strong> guardam escolhas como idioma.</li>
        <li><strong>Analíticos:</strong> ajudam a entender o uso da plataforma para melhorias.</li>
      </ul>

      <h3>3. Gerenciamento</h3>
      <p>
        Ao acessar a plataforma pela primeira vez, exibimos um banner de consentimento onde você pode aceitar todos
        os cookies ou manter apenas os essenciais. Você também pode limpar os cookies e o armazenamento local
        diretamente nas configurações do seu navegador a qualquer momento.
      </p>
    </LegalPage>
  )
}
