import nodemailer from 'nodemailer'

const SMTP_HOST = process.env.SMTP_HOST || ''
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587')
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASS = process.env.SMTP_PASS || ''
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@metaspy.app'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

let transporter = null

function initTransporter() {
  if (transporter) return transporter
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('EMAIL: SMTP nao configurado. Verifique SMTP_HOST, SMTP_USER, SMTP_PASS no .env')
    return null
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  return transporter
}

export async function sendEmail({ to, subject, html }) {
  const t = initTransporter()
  if (!t) {
    console.log(`[EMAIL SIMULADO] Para: ${to} | Assunto: ${subject}`)
    return { simulated: true }
  }
  await t.sendMail({ from: EMAIL_FROM, to, subject, html })
  return { sent: true }
}

export function recoveryEmailHtml(code) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#0a0a0d;padding:40px 20px">
  <div style="max-width:480px;margin:0 auto;background:#1a1a24;border-radius:14px;padding:32px;border:1px solid #2a2a3a">
    <div style="text-align:center;font-size:32px;margin-bottom:16px;color:#a855f7">◉</div>
    <h2 style="color:#fff;text-align:center;margin:0 0 8px">Recuperacao de Senha</h2>
    <p style="color:#a0a0b8;text-align:center;font-size:14px;margin:0 0 24px">
      Seu codigo de recuperacao de 6 digitos:
    </p>
    <div style="text-align:center;font-size:42px;font-weight:700;letter-spacing:8px;color:#c084fc;background:#0a0a0d;border-radius:10px;padding:16px;margin-bottom:24px;font-family:monospace">
      ${code}
    </div>
    <p style="color:#a0a0b8;font-size:13px;text-align:center">
      Este codigo expira em 15 minutos.<br>
      Se voce nao solicitou esta recuperacao, ignore este email.
    </p>
  </div>
</body></html>`
}

export function verificationEmailHtml(code) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#0a0a0d;padding:40px 20px">
  <div style="max-width:480px;margin:0 auto;background:#1a1a24;border-radius:14px;padding:32px;border:1px solid #2a2a3a">
    <div style="text-align:center;font-size:32px;margin-bottom:16px;color:#a855f7">◉</div>
    <h2 style="color:#fff;text-align:center;margin:0 0 8px">Codigo de Confirmacao</h2>
    <p style="color:#a0a0b8;text-align:center;font-size:14px;margin:0 0 24px">
      Seu codigo de confirmacao de 6 digitos:
    </p>
    <div style="text-align:center;font-size:42px;font-weight:700;letter-spacing:8px;color:#c084fc;background:#0a0a0d;border-radius:10px;padding:16px;margin-bottom:24px;font-family:monospace">
      ${code}
    </div>
    <p style="color:#a0a0b8;font-size:13px;text-align:center">
      Este codigo expira em 15 minutos.
    </p>
  </div>
</body></html>`
}
