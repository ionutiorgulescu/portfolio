import nodemailer from 'nodemailer'
import { env } from './env'

const transport = env.SMTP
  ? nodemailer.createTransport({
      host: env.SMTP.host,
      port: env.SMTP.port,
      secure: env.SMTP.secure,
      auth: env.SMTP.user ? { user: env.SMTP.user, pass: env.SMTP.pass } : undefined,
    })
  : null

export async function sendVerificationEmail(to: string, code: string, expiresInMinutes: number): Promise<void> {
  if (!transport || !env.SMTP) {
    console.log(`[mailer] SMTP not configured; verification code for ${to}: ${code}`)
    return
  }

  await transport.sendMail({
    from: env.SMTP.from,
    to,
    subject: `${code} is your Portfolio verification code`,
    text: [
      `Your verification code is ${code}.`,
      '',
      `It expires in ${expiresInMinutes} minutes. If you did not create an account, you can ignore this email.`,
    ].join('\n'),
    html: `<p>Your verification code is:</p>
<p style="font-size:28px;font-weight:600;letter-spacing:6px;margin:16px 0">${code}</p>
<p>It expires in ${expiresInMinutes} minutes. If you did not create an account, you can ignore this email.</p>`,
  })
}
