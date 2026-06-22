const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const EMAIL_FROM = process.env.EMAIL_FROM || 'MetaSpy <noreply@metaspy.app>'

const RESEND_API = 'https://api.resend.com/emails'

export async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.log(`[EMAIL SIMULADO] Para: ${to} | Assunto: ${subject}`)
    console.log(`[EMAIL SIMULADO] HTML:`, html.slice(0, 200) + '...')
    return { simulated: true }
  }

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Erro ao enviar email Resend:', err)
    throw new Error(`Resend error: ${res.status}`)
  }

  return { sent: true }
}

const BASE_STYLE = `
body,table,td,p,a,li,blockquote {
  -webkit-text-size-adjust: 100%;
  -ms-text-size-adjust: 100%;
}
body {
  margin: 0;
  padding: 0;
  width: 100% !important;
  height: 100% !important;
}
table {
  border-collapse: collapse;
  mso-table-lspace: 0;
  mso-table-rspace: 0;
}
img {
  border: 0;
  line-height: 100%;
  text-decoration: none;
  -ms-interpolation-mode: bicubic;
}
`

function emailLayout(content) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>${BASE_STYLE}</style>
</head>
<body style="margin:0;padding:0;background:#08080e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#08080e">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%">
          ${content}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function codeBox(code) {
  const digits = code.split('')
  const digitHtml = digits.map(d =>
    `<td align="center" style="padding:0 4px">
      <div style="background:#0a0a12;border:1px solid #1e1e30;border-radius:8px;width:48px;height:56px;line-height:56px;font-size:28px;font-weight:700;font-family:Inter,'SF Mono',monospace;color:#c084fc;text-align:center">${d}</div>
    </td>`
  ).join('')

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto">
    <tr>${digitHtml}</tr>
  </table>`
}

function baseEmail({ code, title, subtitle, extraText, extraLink, extraLinkText }) {
  return emailLayout(`
    ${/* Header spacer */''}
    <tr><td height="16"></td></tr>

    ${/* Logo */''}
    <tr>
      <td align="center" style="padding-bottom:24px">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="width:52px;height:52px;background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:14px;font-size:26px;line-height:52px;color:#fff;font-weight:700">M</td>
            <td style="padding-left:12px;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px">MetaSpy</td>
          </tr>
        </table>
      </td>
    </tr>

    ${/* Card */''}
    <tr>
      <td style="background:#12121e;border:1px solid #1e1e32;border-radius:16px;padding:36px 32px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${/* Title */''}
          <tr>
            <td align="center" style="font-size:20px;font-weight:700;color:#fff;padding-bottom:6px">${title}</td>
          </tr>
          ${/* Subtitle */''}
          <tr>
            <td align="center" style="font-size:14px;color:#8484a0;line-height:1.5;padding-bottom:28px">${subtitle}</td>
          </tr>

          ${/* Code */''}
          <tr>
            <td align="center" style="padding-bottom:28px">${codeBox(code)}</td>
          </tr>

          ${/* Expiry */''}
          <tr>
            <td align="center" style="font-size:12px;color:#5c5c78;padding-bottom:24px">
              <span style="display:inline-block;background:#0a0a14;border:1px solid #1a1a2e;border-radius:20px;padding:6px 14px">
                ⏱ Codigo valido por 5 minutos
              </span>
            </td>
          </tr>

          ${/* Divider */''}
          <tr>
            <td style="height:1px;background:linear-gradient(90deg,transparent,#2a2a44,transparent);padding:0 40px;margin-bottom:20px"><div style="height:1px"></div></td>
          </tr>

          ${/* Extra text */''}
          ${extraText ? `
          <tr>
            <td align="center" style="font-size:13px;color:#6c6c88;line-height:1.5;padding-top:20px">
              ${extraText}
              ${extraLink ? `<br><a href="${extraLink}" style="color:#a855f7;text-decoration:none;font-weight:600">${extraLinkText || extraLink}</a>` : ''}
            </td>
          </tr>` : ''}

          ${/* Extra link alone */''}
          ${!extraText && extraLink ? `
          <tr>
            <td align="center" style="padding-top:20px">
              <a href="${extraLink}" style="color:#a855f7;text-decoration:none;font-size:13px;font-weight:600">${extraLinkText || extraLink}</a>
            </td>
          </tr>` : ''}
        </table>
      </td>
    </tr>

    ${/* Footer */''}
    <tr>
      <td style="padding:24px 16px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom:8px;text-align:center;font-size:11px;color:#42425a">
              MetaSpy &mdash; Todos os direitos reservados
            </td>
          </tr>
          <tr>
            <td style="text-align:center;font-size:11px;color:#3a3a50">
              <a href="https://centralspyads.netlify.app/termos" style="color:#6c6c88;text-decoration:none">Termos de Uso</a>
              &nbsp;&bull;&nbsp;
              <a href="https://centralspyads.netlify.app/privacidade" style="color:#6c6c88;text-decoration:none">Privacidade</a>
              &nbsp;&bull;&nbsp;
              <a href="https://centralspyads.netlify.app/contato" style="color:#6c6c88;text-decoration:none">Contato</a>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding-top:8px;font-size:10px;color:#34344a">
              Se nao solicitou este email, ignore-o.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `)
}

export function verificationEmailHtml(code) {
  return baseEmail({
    code,
    title: 'Confirme seu Cadastro',
    subtitle: 'Use o codigo abaixo para ativar sua conta no MetaSpy.',
    extraText: 'Se nao criou uma conta, ignore este email.',
  })
}

export function recoveryEmailHtml(code) {
  return baseEmail({
    code,
    title: 'Recuperacao de Senha',
    subtitle: 'Use o codigo abaixo para redefinir sua senha.',
    extraText: 'Se nao solicitou a recuperacao, ignore este email.',
  })
}
