import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export type EmailSendResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string }

export async function sendNotificationEmail(args: {
  to: string
  subject: string
  html: string
}): Promise<EmailSendResult> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY is not configured' }
  }

  // Dev override: when set, all notification emails are redirected to this
  // address. Subject is prefixed and a banner is injected at the top of the
  // body so it's obvious the email was redirected. Leave unset in production.
  const override = process.env.NOTIFICATION_EMAIL_OVERRIDE
  const realTo = args.to
  const finalTo = override && override.trim().length > 0 ? override.trim() : realTo
  const finalSubject = override
    ? `[TEST → ${realTo}] ${args.subject}`
    : args.subject
  const finalHtml = override
    ? injectOverrideBanner(args.html, realTo)
    : args.html

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
      to: finalTo,
      subject: finalSubject,
      html: finalHtml,
    })
    if (error) {
      return { ok: false, error: error.message ?? 'Resend error' }
    }
    return { ok: true, id: data?.id ?? null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

function injectOverrideBanner(html: string, originalRecipient: string): string {
  const banner = `<div style="background:#fef3c7;border:1px solid #fbbf24;color:#92400e;padding:10px 14px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:600;text-align:center">⚠ Test mode — this email would have been delivered to <strong>${escapeHtml(originalRecipient)}</strong></div>`
  // Insert immediately after <body...> if present; otherwise prepend.
  const bodyMatch = html.match(/<body[^>]*>/i)
  if (bodyMatch && bodyMatch.index !== undefined) {
    const insertAt = bodyMatch.index + bodyMatch[0].length
    return html.slice(0, insertAt) + banner + html.slice(insertAt)
  }
  return banner + html
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
