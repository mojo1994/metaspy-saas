const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@metaspy.app'

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

function emailTemplate(code, title, description, extra) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#0a0a0d;padding:40px 20px;margin:0">
  <div style="max-width:480px;margin:0 auto;background:#1a1a24;border-radius:14px;padding:32px;border:1px solid #2a2a3a">
    <div style="text-align:center;font-size:32px;margin-bottom:4px;color:#a855f7">◉</div>
    <h2 style="color:#fff;text-align:center;margin:0 0 4px;font-size:20px;font-weight:700">${title}</h2>
    <p style="color:#a0a0b8;text-align:center;font-size:14px;margin:0 0 24px;line-height:1.5">${description}</p>
    <div style="text-align:center;font-size:40px;font-weight:700;letter-spacing:10px;color:#c084fc;background:#0a0a0d;border-radius:10px;padding:20px 16px;margin-bottom:24px;font-family:monospace">${code}</div>
    <p style="color:#6b6b80;font-size:12px;text-align:center;line-height:1.5;margin:0">Este codigo expira em 15 minutos.${extra ? '<br>' + extra : ''}</p>
  </div>
</body></html>`
}

export function recoveryEmailHtml(code) {
  return emailTemplate(code,
    'Recuperacao de Senha',
    'Seu codigo de recuperacao de 6 digitos:',
    'Se voce nao solicitou esta recuperacao, ignore este email.'
  )
}

export function verificationEmailHtml(code) {
  return emailTemplate(code,
    'Confirmacao de Cadastro',
    'Seu codigo de confirmacao de 6 digitos:'
  )
}
