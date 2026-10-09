import nodemailer, { type Transporter } from 'nodemailer'

export type Mail = { to: string; subject: string; text: string; html: string }

let transporter: Transporter | undefined

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // nodemailer defaults are minutes long; a hung Gmail connection must not hold a function.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
  }
  return transporter
}

/** Sends via the church Gmail. With EMAIL_MODE=log nothing is sent (dev, preview, load tests). */
export async function sendMail(mail: Mail): Promise<'sent' | 'logged'> {
  if (process.env.EMAIL_MODE !== 'smtp') {
    console.log(JSON.stringify({ evt: 'email.log_mode', subject: mail.subject }))
    return 'logged'
  }
  await getTransporter().sendMail({
    from: { name: 'Citizens of Light Church', address: process.env.SMTP_USER ?? '' },
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  })
  return 'sent'
}

/**
 * Gmail's daily sending limit (shared with The Awakening's site, ~500/day):
 * "550 5.4.5 Daily user sending limit exceeded". Retrying every 5 minutes would burn all
 * 5 attempts within half an hour, so these are deferred instead.
 */
export function isDailyLimitError(err: unknown): boolean {
  const e = err as { response?: unknown; message?: unknown }
  const text = `${typeof e?.response === 'string' ? e.response : ''} ${typeof e?.message === 'string' ? e.message : ''}`
  return /\b5\.4\.5\b|sending (limit|quota) exceeded/i.test(text)
}
