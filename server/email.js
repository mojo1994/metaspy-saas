const MAILEROO_API_KEY = process.env.MAILEROO_API_KEY || ''
const FROM_EMAIL_RAW = process.env.FROM_EMAIL || ''

const MAILEROO_API = 'https://smtp.maileroo.com/api/v2/emails'

const SITE = 'https://centralspyads.netlify.app'

function parseEmail(input) {
  const match = input.match(/^(?:(.+?)\s*)?<([^>]+)>$/)
  if (match) {
    return { address: match[2].trim(), name: (match[1] || '').trim() || 'MetaSpy' }
  }
  return { address: input.trim(), name: 'MetaSpy' }
}

async function sendWithFrom({ to, subject, html, from }) {
  const res = await fetch(MAILEROO_API, {
    method: 'POST',
    headers: {
      'X-Api-Key': MAILEROO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: { address: from.address, display_name: from.name },
      to: [{ address: to }],
      subject,
      html,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    const errMsg = `Maileroo ${res.status}: ${err.slice(0, 200)}`
    console.error('Erro Maileroo:', errMsg)
    return { error: errMsg }
  }
  const data = await res.json()
  return { sent: true, referenceId: data?.data?.reference_id }
}

export async function sendEmail({ to, subject, html }) {
  if (!MAILEROO_API_KEY) {
    console.log(`[EMAIL SIMULADO] Para: ${to} | Assunto: ${subject}`)
    console.log(`[EMAIL SIMULADO] HTML:`, html.slice(0, 200) + '...')
    return { simulated: true }
  }

  if (!FROM_EMAIL_RAW) {
    console.error('FROM_EMAIL nao configurada. Defina a env var FROM_EMAIL.')
    return { error: 'FROM_EMAIL nao configurada' }
  }

  const from = parseEmail(FROM_EMAIL_RAW)

  return await sendWithFrom({
    to,
    subject,
    html,
    from,
  })
}

const STRINGS = {
  'pt-BR': {
    lang: 'pt-BR',
    codeValid: 'Codigo valido por 5 minutos',
    rights: 'MetaSpy &mdash; Todos os direitos reservados',
    terms: 'Termos de Uso',
    privacy: 'Privacidade',
    contact: 'Contato',
    ignoreCode: 'Se nao solicitou este email, ignore-o.',
    spam: 'Nao encontrou? Verifique sua caixa de spam.',
    verifyTitle: 'Confirme seu Cadastro',
    verifySubtitle: 'Use o codigo abaixo para ativar sua conta no MetaSpy.',
    verifyExtra: 'Se nao criou uma conta, ignore este email.',
    verifySubject: 'Confirme seu cadastro - MetaSpy',
    recoveryTitle: 'Recuperacao de Senha',
    recoverySubtitle: 'Use o codigo abaixo para redefinir sua senha.',
    recoveryExtra: 'Se nao solicitou a recuperacao, ignore este email.',
    recoverySubject: 'Recuperacao de senha - MetaSpy',
    delTitle: 'Exclusao de Conta Agendada',
    delSubtitle: 'Sua conta sera excluida em {date}.',
    delExtra: 'Se nao solicitou esta acao, entre em contato com o suporte imediatamente.',
    delSubject: 'Exclusao de conta - MetaSpy',
    hi: 'Ola, {name}!',
    purchaseTitle: 'Compra Confirmada',
    purchaseSubtitle: 'Sua assinatura {plan} foi confirmada. Sua conta ja esta disponivel para uso.',
    purchaseSubject: 'Compra confirmada - MetaSpy',
    plan: 'Plano',
    days: 'Dias de acesso',
    status: 'Status',
    active: 'Ativo',
    access: 'Acessar MetaSpy',
    accessHint: 'Clique no botao acima para comecar a usar',
    questions: 'Qualquer duvida, responda a este email ou entre em contato pelo site.',
    pendingTitle: 'Voce esta a um passo de escalar',
    pendingSubtitle: 'Complete sua compra para liberar o nosso arsenal espiao massivo. Nao perca essa oportunidade!',
    pendingOffer: 'OFERTA POR TEMPO LIMITADO',
    pendingOfferText: 'Complete sua compra nos proximos 15 minutos e leve um desconto especial.',
    pendingCta: 'Voltar ao Checkout',
    pendingHint: 'Clique no botao acima para finalizar sua compra',
    pendingSentTo: 'Este email foi enviado para {email}.',
    pendingIgnore: 'Se nao iniciou esta compra, ignore-o.',
    pendingSubject: 'Finalize sua compra - MetaSpy',
  },
  en: {
    lang: 'en',
    codeValid: 'Code valid for 5 minutes',
    rights: 'MetaSpy &mdash; All rights reserved',
    terms: 'Terms of Use',
    privacy: 'Privacy',
    contact: 'Contact',
    ignoreCode: 'If you did not request this email, please ignore it.',
    spam: "Didn't find it? Check your spam folder.",
    verifyTitle: 'Confirm your Signup',
    verifySubtitle: 'Use the code below to activate your MetaSpy account.',
    verifyExtra: 'If you did not create an account, ignore this email.',
    verifySubject: 'Confirm your signup - MetaSpy',
    recoveryTitle: 'Password Recovery',
    recoverySubtitle: 'Use the code below to reset your password.',
    recoveryExtra: 'If you did not request a recovery, ignore this email.',
    recoverySubject: 'Password recovery - MetaSpy',
    delTitle: 'Account Deletion Scheduled',
    delSubtitle: 'Your account will be deleted on {date}.',
    delExtra: 'If you did not request this action, contact support immediately.',
    delSubject: 'Account deletion - MetaSpy',
    hi: 'Hello, {name}!',
    purchaseTitle: 'Purchase Confirmed',
    purchaseSubtitle: 'Your {plan} subscription has been confirmed. Your account is ready to use.',
    purchaseSubject: 'Purchase confirmed - MetaSpy',
    plan: 'Plan',
    days: 'Access days',
    status: 'Status',
    active: 'Active',
    access: 'Open MetaSpy',
    accessHint: 'Click the button above to get started',
    questions: 'If you have any questions, reply to this email or contact us through the site.',
    pendingTitle: "You're one step away from scaling",
    pendingSubtitle: 'Complete your purchase to unlock our massive spy arsenal. Don\'t miss this opportunity!',
    pendingOffer: 'LIMITED-TIME OFFER',
    pendingOfferText: 'Complete your purchase within the next 15 minutes and get a special discount.',
    pendingCta: 'Back to Checkout',
    pendingHint: 'Click the button above to finish your purchase',
    pendingSentTo: 'This email was sent to {email}.',
    pendingIgnore: 'If you did not start this purchase, ignore it.',
    pendingSubject: 'Complete your purchase - MetaSpy',
  },
  es: {
    lang: 'es',
    codeValid: 'Codigo valido por 5 minutos',
    rights: 'MetaSpy &mdash; Todos los derechos reservados',
    terms: 'Terminos de Uso',
    privacy: 'Privacidad',
    contact: 'Contacto',
    ignoreCode: 'Si no solicitaste este correo, ignoralo.',
    spam: 'No lo encontraste? Revisa tu carpeta de spam.',
    verifyTitle: 'Confirma tu Registro',
    verifySubtitle: 'Usa el codigo de abajo para activar tu cuenta de MetaSpy.',
    verifyExtra: 'Si no creaste una cuenta, ignora este correo.',
    verifySubject: 'Confirma tu registro - MetaSpy',
    recoveryTitle: 'Recuperacion de Contrasena',
    recoverySubtitle: 'Usa el codigo de abajo para restablecer tu contrasena.',
    recoveryExtra: 'Si no solicitaste la recuperacion, ignora este correo.',
    recoverySubject: 'Recuperacion de contrasena - MetaSpy',
    delTitle: 'Eliminacion de Cuenta Programada',
    delSubtitle: 'Tu cuenta sera eliminada el {date}.',
    delExtra: 'Si no solicitaste esta accion, contacta al soporte de inmediato.',
    delSubject: 'Eliminacion de cuenta - MetaSpy',
    hi: 'Hola, {name}!',
    purchaseTitle: 'Compra Confirmada',
    purchaseSubtitle: 'Tu suscripcion {plan} ha sido confirmada. Tu cuenta ya esta lista para usar.',
    purchaseSubject: 'Compra confirmada - MetaSpy',
    plan: 'Plan',
    days: 'Dias de acceso',
    status: 'Estado',
    active: 'Activo',
    access: 'Abrir MetaSpy',
    accessHint: 'Haz clic en el boton de arriba para comenzar',
    questions: 'Si tienes dudas, responde a este correo o contactanos desde el sitio.',
    pendingTitle: 'Estas a un paso de escalar',
    pendingSubtitle: 'Completa tu compra para desbloquear nuestro enorme arsenal espia. No pierdas esta oportunidad!',
    pendingOffer: 'OFERTA POR TIEMPO LIMITADO',
    pendingOfferText: 'Completa tu compra en los proximos 15 minutos y obten un descuento especial.',
    pendingCta: 'Volver al Checkout',
    pendingHint: 'Haz clic en el boton de arriba para finalizar tu compra',
    pendingSentTo: 'Este correo fue enviado a {email}.',
    pendingIgnore: 'Si no iniciaste esta compra, ignoralo.',
    pendingSubject: 'Finaliza tu compra - MetaSpy',
  },
  fr: {
    lang: 'fr',
    codeValid: 'Code valable 5 minutes',
    rights: 'MetaSpy &mdash; Tous droits reserves',
    terms: "Conditions d'utilisation",
    privacy: 'Confidentialite',
    contact: 'Contact',
    ignoreCode: "Si vous n'etes pas a l'origine de cet email, ignorez-le.",
    spam: 'Introuvable ? Verifiez vos spams.',
    verifyTitle: 'Confirmez votre Inscription',
    verifySubtitle: 'Utilisez le code ci-dessous pour activer votre compte MetaSpy.',
    verifyExtra: "Si vous n'avez pas cree de compte, ignorez cet email.",
    verifySubject: 'Confirmez votre inscription - MetaSpy',
    recoveryTitle: 'Recuperation du Mot de Passe',
    recoverySubtitle: 'Utilisez le code ci-dessous pour reinitialiser votre mot de passe.',
    recoveryExtra: "Si vous n'avez pas demande de recuperation, ignorez cet email.",
    recoverySubject: 'Recuperation du mot de passe - MetaSpy',
    delTitle: 'Suppression de Compte Programmee',
    delSubtitle: 'Votre compte sera supprime le {date}.',
    delExtra: "Si vous n'etes pas a l'origine de cette action, contactez le support immediatement.",
    delSubject: 'Suppression de compte - MetaSpy',
    hi: 'Bonjour, {name} !',
    purchaseTitle: 'Achat Confirme',
    purchaseSubtitle: "Votre abonnement {plan} a ete confirme. Votre compte est pret a l'emploi.",
    purchaseSubject: 'Achat confirme - MetaSpy',
    plan: 'Formule',
    days: "Jours d'acces",
    status: 'Statut',
    active: 'Actif',
    access: 'Ouvrir MetaSpy',
    accessHint: 'Cliquez sur le bouton ci-dessus pour commencer',
    questions: 'Pour toute question, repondez a cet email ou contactez-nous via le site.',
    pendingTitle: "Vous etes a un pas de scaler",
    pendingSubtitle: 'Finalisez votre achat pour debloquer notre enorme arsenal espion. Ne manquez pas cette opportunite !',
    pendingOffer: 'OFFRE A DUREE LIMITEE',
    pendingOfferText: 'Finalisez votre achat dans les 15 prochaines minutes et obtenez une remise speciale.',
    pendingCta: 'Retour au Checkout',
    pendingHint: 'Cliquez sur le bouton ci-dessus pour finaliser votre achat',
    pendingSentTo: 'Cet email a ete envoye a {email}.',
    pendingIgnore: "Si vous n'avez pas initie cet achat, ignorez-le.",
    pendingSubject: 'Finalisez votre achat - MetaSpy',
  },
  de: {
    lang: 'de',
    codeValid: 'Code 5 Minuten gueltig',
    rights: 'MetaSpy &mdash; Alle Rechte vorbehalten',
    terms: 'Nutzungsbedingungen',
    privacy: 'Datenschutz',
    contact: 'Kontakt',
    ignoreCode: 'Wenn Sie diese E-Mail nicht angefordert haben, ignorieren Sie sie.',
    spam: 'Nicht gefunden? Prufen Sie Ihren Spam-Ordner.',
    verifyTitle: 'Bestatigen Sie Ihre Anmeldung',
    verifySubtitle: 'Verwenden Sie den Code unten, um Ihr MetaSpy-Konto zu aktivieren.',
    verifyExtra: 'Wenn Sie kein Konto erstellt haben, ignorieren Sie diese E-Mail.',
    verifySubject: 'Bestatigen Sie Ihre Anmeldung - MetaSpy',
    recoveryTitle: 'Passwort-Wiederherstellung',
    recoverySubtitle: 'Verwenden Sie den Code unten, um Ihr Passwort zuruckzusetzen.',
    recoveryExtra: 'Wenn Sie keine Wiederherstellung angefordert haben, ignorieren Sie diese E-Mail.',
    recoverySubject: 'Passwort-Wiederherstellung - MetaSpy',
    delTitle: 'Kontoloschung Geplant',
    delSubtitle: 'Ihr Konto wird am {date} geloscht.',
    delExtra: 'Wenn Sie diese Aktion nicht angefordert haben, kontaktieren Sie sofort den Support.',
    delSubject: 'Kontoloschung - MetaSpy',
    hi: 'Hallo, {name}!',
    purchaseTitle: 'Kauf Bestatigt',
    purchaseSubtitle: 'Ihr {plan}-Abonnement wurde bestatigt. Ihr Konto ist einsatzbereit.',
    purchaseSubject: 'Kauf bestatigt - MetaSpy',
    plan: 'Tarif',
    days: 'Zugriffstage',
    status: 'Status',
    active: 'Aktiv',
    access: 'MetaSpy offnen',
    accessHint: 'Klicken Sie oben, um zu starten',
    questions: 'Bei Fragen antworten Sie auf diese E-Mail oder kontaktieren Sie uns uber die Website.',
    pendingTitle: 'Sie sind einen Schritt vom Skalieren entfernt',
    pendingSubtitle: 'Schliessen Sie Ihren Kauf ab, um unser riesiges Spionage-Arsenal freizuschalten. Verpassen Sie diese Chance nicht!',
    pendingOffer: 'ANGEBOT FUR BEGRENZTE ZEIT',
    pendingOfferText: 'Schliessen Sie Ihren Kauf innerhalb der nachsten 15 Minuten ab und erhalten Sie einen Sonderrabatt.',
    pendingCta: 'Zuruck zum Checkout',
    pendingHint: 'Klicken Sie oben, um Ihren Kauf abzuschliessen',
    pendingSentTo: 'Diese E-Mail wurde an {email} gesendet.',
    pendingIgnore: 'Wenn Sie diesen Kauf nicht gestartet haben, ignorieren Sie ihn.',
    pendingSubject: 'Schliessen Sie Ihren Kauf ab - MetaSpy',
  },
  it: {
    lang: 'it',
    codeValid: 'Codice valido per 5 minuti',
    rights: 'MetaSpy &mdash; Tutti i diritti riservati',
    terms: 'Termini di Utilizzo',
    privacy: 'Privacy',
    contact: 'Contatto',
    ignoreCode: 'Se non hai richiesto questa email, ignorala.',
    spam: 'Non la trovi? Controlla la cartella spam.',
    verifyTitle: 'Conferma la tua Registrazione',
    verifySubtitle: 'Usa il codice qui sotto per attivare il tuo account MetaSpy.',
    verifyExtra: 'Se non hai creato un account, ignora questa email.',
    verifySubject: 'Conferma la tua registrazione - MetaSpy',
    recoveryTitle: 'Recupero Password',
    recoverySubtitle: 'Usa il codice qui sotto per reimpostare la tua password.',
    recoveryExtra: 'Se non hai richiesto il recupero, ignora questa email.',
    recoverySubject: 'Recupero password - MetaSpy',
    delTitle: 'Eliminazione Account Programmata',
    delSubtitle: 'Il tuo account sara eliminato il {date}.',
    delExtra: 'Se non hai richiesto questa azione, contatta subito il supporto.',
    delSubject: 'Eliminazione account - MetaSpy',
    hi: 'Ciao, {name}!',
    purchaseTitle: 'Acquisto Confermato',
    purchaseSubtitle: 'Il tuo abbonamento {plan} e stato confermato. Il tuo account e pronto all\'uso.',
    purchaseSubject: 'Acquisto confermato - MetaSpy',
    plan: 'Piano',
    days: 'Giorni di accesso',
    status: 'Stato',
    active: 'Attivo',
    access: 'Apri MetaSpy',
    accessHint: 'Clicca il pulsante sopra per iniziare',
    questions: 'Per qualsiasi domanda, rispondi a questa email o contattaci tramite il sito.',
    pendingTitle: 'Sei a un passo dallo scalare',
    pendingSubtitle: 'Completa il tuo acquisto per sbloccare il nostro enorme arsenale spia. Non perdere questa opportunita!',
    pendingOffer: 'OFFERTA A TEMPO LIMITATO',
    pendingOfferText: 'Completa il tuo acquisto entro i prossimi 15 minuti e ottieni uno sconto speciale.',
    pendingCta: 'Torna al Checkout',
    pendingHint: 'Clicca il pulsante sopra per completare l\'acquisto',
    pendingSentTo: 'Questa email e stata inviata a {email}.',
    pendingIgnore: 'Se non hai avviato questo acquisto, ignorala.',
    pendingSubject: 'Completa il tuo acquisto - MetaSpy',
  },
}

export function normalizeLang(lang) {
  if (!lang) return 'pt-BR'
  if (STRINGS[lang]) return lang
  const normalized = String(lang).replace('_', '-')
  if (STRINGS[normalized]) return normalized
  const lower = String(lang).toLowerCase()
  if (lower.startsWith('pt')) return 'pt-BR'
  if (lower.startsWith('en')) return 'en'
  if (lower.startsWith('es')) return 'es'
  if (lower.startsWith('fr')) return 'fr'
  if (lower.startsWith('de')) return 'de'
  if (lower.startsWith('it')) return 'it'
  return 'pt-BR'
}

function S(lang) {
  return STRINGS[normalizeLang(lang)] || STRINGS['pt-BR']
}

function fmt(str, vars) {
  if (!str) return ''
  return str.replace(/\{(\w+)\}/g, (_, key) => (vars && vars[key] != null ? String(vars[key]) : `{${key}}`))
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

function emailLayout(content, lang) {
  const htmlLang = S(lang).lang
  return `<!DOCTYPE html>
<html lang="${htmlLang}">
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

function baseEmail({ code, title, subtitle, extraText, extraLink, extraLinkText, lang }) {
  const s = S(lang)
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
                ${s.codeValid}
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
              ${s.rights}
            </td>
          </tr>
          <tr>
            <td style="text-align:center;font-size:11px;color:#3a3a50">
              <a href="${SITE}/termos" style="color:#6c6c88;text-decoration:none">${s.terms}</a>
              &nbsp;&bull;&nbsp;
              <a href="${SITE}/privacidade" style="color:#6c6c88;text-decoration:none">${s.privacy}</a>
              &nbsp;&bull;&nbsp;
              <a href="${SITE}/contato" style="color:#6c6c88;text-decoration:none">${s.contact}</a>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding-top:8px;font-size:10px;color:#34344a">
              ${s.ignoreCode}
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding-top:16px;font-size:11px;color:#a855f7;font-weight:600">
              ${s.spam}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `, lang)
}

export function verificationEmailHtml(code, lang) {
  const s = S(lang)
  return baseEmail({
    code,
    title: s.verifyTitle,
    subtitle: s.verifySubtitle,
    extraText: s.verifyExtra,
    lang,
  })
}

export function recoveryEmailHtml(code, lang) {
  const s = S(lang)
  return baseEmail({
    code,
    title: s.recoveryTitle,
    subtitle: s.recoverySubtitle,
    extraText: s.recoveryExtra,
    lang,
  })
}

export function accountDeletionEmailHtml(scheduledDate, lang) {
  const s = S(lang)
  return emailLayout(`
    <tr><td height="16"></td></tr>
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
    <tr>
      <td style="background:#12121e;border:1px solid #1e1e32;border-radius:16px;padding:36px 32px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="font-size:20px;font-weight:700;color:#fff;padding-bottom:12px">${s.delTitle}</td></tr>
          <tr>
            <td align="center" style="font-size:14px;color:#8484a0;line-height:1.6;padding-bottom:24px">
              ${fmt(s.delSubtitle, { date: scheduledDate })}
            </td>
          </tr>
          <tr>
            <td align="center" style="font-size:13px;color:#6c6c88;line-height:1.5">
              ${s.delExtra}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 16px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom:8px;text-align:center;font-size:11px;color:#42425a">
              ${s.rights}
            </td>
          </tr>
          <tr>
            <td style="text-align:center;font-size:11px;color:#3a3a50">
              <a href="${SITE}/termos" style="color:#6c6c88;text-decoration:none">${s.terms}</a>
              &nbsp;&bull;&nbsp;
              <a href="${SITE}/privacidade" style="color:#6c6c88;text-decoration:none">${s.privacy}</a>
              &nbsp;&bull;&nbsp;
              <a href="${SITE}/contato" style="color:#6c6c88;text-decoration:none">${s.contact}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `, lang)
}

export function purchaseConfirmationEmailHtml({ name, plan, days, lang }) {
  const s = S(lang)
  const planLabel = { basico: 'Basico', gold: 'Gold', premium: 'Premium' }[plan] || 'Premium'
  return emailLayout(`
    <tr><td height="16"></td></tr>

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

    <tr>
      <td style="background:#12121e;border:1px solid #1e1e32;border-radius:16px;padding:36px 32px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="font-size:20px;font-weight:700;color:#fff;padding-bottom:6px">${fmt(s.hi, { name })}</td>
          </tr>
          <tr>
            <td align="center" style="font-size:14px;color:#8484a0;line-height:1.6;padding-bottom:24px">
              ${s.purchaseTitle}<br>${fmt(s.purchaseSubtitle, { plan: planLabel })}
            </td>
          </tr>

          <tr>
            <td style="background:#0a0a14;border:1px solid #1a1a2e;border-radius:12px;padding:20px 24px;margin-bottom:24px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#8484a0;padding-bottom:6px">${s.plan}</td>
                  <td align="right" style="font-size:13px;color:#fff;font-weight:600">${planLabel}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#8484a0;padding-bottom:6px">${s.days}</td>
                  <td align="right" style="font-size:13px;color:#fff;font-weight:600">${days}</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#8484a0">${s.status}</td>
                  <td align="right" style="font-size:13px;color:#16a34a;font-weight:600">${s.active}</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding-bottom:8px">
              <a href="${SITE}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px">
                ${s.access}
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="font-size:12px;color:#5c5c78">
              ${s.accessHint}
            </td>
          </tr>

          <tr>
            <td style="height:1px;background:linear-gradient(90deg,transparent,#2a2a44,transparent);padding:0 40px"><div style="height:1px"></div></td>
          </tr>

          <tr>
            <td align="center" style="font-size:13px;color:#6c6c88;line-height:1.5;padding-top:20px">
              ${s.questions}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:24px 16px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom:8px;text-align:center;font-size:11px;color:#42425a">
              ${s.rights}
            </td>
          </tr>
          <tr>
            <td style="text-align:center;font-size:11px;color:#3a3a50">
              <a href="${SITE}/termos" style="color:#6c6c88;text-decoration:none">${s.terms}</a>
              &nbsp;&bull;&nbsp;
              <a href="${SITE}/privacidade" style="color:#6c6c88;text-decoration:none">${s.privacy}</a>
              &nbsp;&bull;&nbsp;
              <a href="${SITE}/contato" style="color:#6c6c88;text-decoration:none">${s.contact}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `, lang)
}

export function pendingCheckoutEmailHtml({ name, email, lang }) {
  const s = S(lang)
  return emailLayout(`
    <tr><td height="16"></td></tr>

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

    <tr>
      <td style="background:#12121e;border:1px solid #1e1e32;border-radius:16px;padding:36px 32px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="font-size:20px;font-weight:700;color:#fff;padding-bottom:12px">${fmt(s.hi, { name })}</td>
          </tr>
          <tr>
            <td align="center" style="font-size:14px;color:#c084fc;font-weight:600;padding-bottom:8px">${s.pendingTitle}</td>
          </tr>
          <tr>
            <td align="center" style="font-size:14px;color:#8484a0;line-height:1.6;padding-bottom:24px">
              ${s.pendingSubtitle}
            </td>
          </tr>

          <tr>
            <td style="background:linear-gradient(135deg,rgba(168,85,247,0.12),rgba(124,58,237,0.06));border:1px solid rgba(168,85,247,0.25);border-radius:12px;padding:20px 24px;margin-bottom:24px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-size:13px;color:#f59e0b;font-weight:600;padding-bottom:8px">${s.pendingOffer}</td>
                </tr>
                <tr>
                  <td align="center" style="font-size:12px;color:#8484a0;line-height:1.5">
                    ${s.pendingOfferText}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding-bottom:8px">
              <a href="${SITE}/planos" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px">
                ${s.pendingCta}
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="font-size:12px;color:#5c5c78">
              ${s.pendingHint}
            </td>
          </tr>

          <tr>
            <td style="height:1px;background:linear-gradient(90deg,transparent,#2a2a44,transparent);padding:0 40px"><div style="height:1px"></div></td>
          </tr>

          <tr>
            <td align="center" style="font-size:13px;color:#6c6c88;line-height:1.5;padding-top:20px">
              ${fmt(s.pendingSentTo, { email })}<br>
              ${s.pendingIgnore}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:24px 16px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom:8px;text-align:center;font-size:11px;color:#42425a">
              ${s.rights}
            </td>
          </tr>
          <tr>
            <td style="text-align:center;font-size:11px;color:#3a3a50">
              <a href="${SITE}/termos" style="color:#6c6c88;text-decoration:none">${s.terms}</a>
              &nbsp;&bull;&nbsp;
              <a href="${SITE}/privacidade" style="color:#6c6c88;text-decoration:none">${s.privacy}</a>
              &nbsp;&bull;&nbsp;
              <a href="${SITE}/contato" style="color:#6c6c88;text-decoration:none">${s.contact}</a>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding-top:8px;font-size:11px;color:#a855f7;font-weight:600">
              ${s.spam}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `, lang)
}

export function emailSubject(kind, lang) {
  const s = S(lang)
  const map = {
    verification: s.verifySubject,
    recovery: s.recoverySubject,
    account_deletion: s.delSubject,
    purchase: s.purchaseSubject,
    pending_checkout: s.pendingSubject,
  }
  return map[kind] || s.verifySubject
}
