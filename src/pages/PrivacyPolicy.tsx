import LegalPage from '../components/LegalPage'

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt="11/10/2026">
      <p>
        Esta Política de Privacidade descreve como o MetaSpy coleta, usa, armazena e protege seus dados pessoais,
        em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
      </p>

      <h3>1. Dados coletados</h3>
      <ul>
        <li><strong>Cadastro:</strong> nome, e-mail e senha (armazenada de forma criptografada).</li>
        <li><strong>Uso das ferramentas:</strong> URLs informadas, arquivos enviados (imagens/vídeos/ZIP) e registros de uso (data, tipo de ação).</li>
        <li><strong>Pagamento:</strong> processado pela Kirvano — não armazenamos dados de cartão.</li>
        <li><strong>Técnicos:</strong> endereço IP, user-agent e idioma, para segurança e prevenção a fraude.</li>
      </ul>

      <h3>2. Finalidade e base legal</h3>
      <p>
        Tratamos seus dados para executar o contrato (fornecer o serviço), cumprir obrigações legais e, quando
        aplicável, com base no seu consentimento. Não utilizamos seus dados para finalidades distintas destas.
      </p>

      <h3>3. Compartilhamento com terceiros</h3>
      <ul>
        <li><strong>Kirvano</strong> — processamento de pagamentos e assinaturas.</li>
        <li><strong>Maileroo</strong> — envio de e-mails transacionais (verificação, recuperação, confirmações).</li>
        <li><strong>Cloudflare / R2</strong> — hospedagem e armazenamento das páginas publicadas.</li>
        <li><strong>Neon / Render</strong> — banco de dados e infraestrutura de servidores.</li>
      </ul>
      <p>Não vendemos nem alugamos seus dados pessoais.</p>

      <h3>4. Tempo de retenção</h3>
      <p>
        Mantemos seus dados enquanto sua conta existir. Após a exclusão da conta, os dados são eliminados,
        ressalvadas as informações que precisamos manter por obrigação legal (por exemplo, registros fiscais).
      </p>

      <h3>5. Seus direitos (Art. 18 da LGPD)</h3>
      <p>Você pode, a qualquer momento, solicitar:</p>
      <ul>
        <li>Confirmação da existência de tratamento e acesso aos dados;</li>
        <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
        <li>Portabilidade dos dados a outro fornecedor;</li>
        <li>Eliminação dos dados tratados com consentimento;</li>
        <li>Informação sobre compartilhamentos realizados.</li>
      </ul>
      <p>
        Para exercer seus direitos ou excluir sua conta, acesse a página <a href="/excluir-conta">Exclusão de Conta</a> ou
        entre em contato pelo e-mail de suporte da plataforma.
      </p>

      <h3>6. Segurança</h3>
      <p>
        Adotamos medidas técnicas e administrativas para proteger seus dados, incluindo criptografia de senhas,
        controle de acesso, limitação de tentativas de login e registro de auditoria.
      </p>

      <h3>7. Controlador e contato</h3>
      <p>
        O controlador dos dados é o MetaSpy. Dúvidas sobre privacidade podem ser encaminhadas ao nosso encarregado
        (DPO) pelo e-mail de suporte da plataforma.
      </p>
    </LegalPage>
  )
}
