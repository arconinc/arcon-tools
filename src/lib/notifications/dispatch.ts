import { createAdminClient } from '@/lib/supabase/admin'
import { resolveRecipients, RecipientSpec, ResolvedRecipient } from './recipients'
import { NotificationDefinition } from './registry'
import { sendNotificationEmail } from './email'

export interface DispatchResult {
  created: number
  emailsSent: number
  emailsFailed: number
  emailsDisabled: number
}

interface InsertedRow {
  id: string
  user_id: string
}

const EMAIL_CONCURRENCY = 5

async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number
): Promise<void> {
  const queue = items.slice()
  const runners: Promise<void>[] = []
  const next = async (): Promise<void> => {
    while (queue.length > 0) {
      const item = queue.shift() as T
      await worker(item)
    }
  }
  for (let i = 0; i < Math.min(concurrency, items.length); i++) runners.push(next())
  await Promise.all(runners)
}

export async function dispatchNotification<T>(args: {
  definition: NotificationDefinition<T>
  payload: T
  recipientSpec: RecipientSpec
  suppressUserIds?: string[]
}): Promise<DispatchResult> {
  const { definition, payload, recipientSpec, suppressUserIds = [] } = args

  const recipients = await resolveRecipients(recipientSpec)
  const suppressed = new Set(suppressUserIds)
  const finalRecipients = recipients.filter(r => !suppressed.has(r.id))

  const result: DispatchResult = { created: 0, emailsSent: 0, emailsFailed: 0, emailsDisabled: 0 }
  if (finalRecipients.length === 0) return result

  const adminClient = createAdminClient()
  const rendered = definition.render(payload)

  const insertRows = finalRecipients.map(r => ({
    user_id: r.id,
    type: definition.type,
    title: rendered.title,
    body: rendered.body,
    link_url: rendered.linkUrl,
    metadata: payload as unknown as Record<string, unknown>,
    email_status: 'pending' as const,
  }))

  const { data: inserted, error: insertErr } = await adminClient
    .from('notifications')
    .insert(insertRows)
    .select('id, user_id')

  if (insertErr || !inserted) {
    console.error('[notifications] insert failed:', insertErr)
    return result
  }
  result.created = inserted.length

  // Look up email preferences for these (user_id, type) pairs in one round trip.
  const userIds = inserted.map((r: InsertedRow) => r.user_id)
  const { data: prefRows } = await adminClient
    .from('notification_preferences')
    .select('user_id, email')
    .eq('type', definition.type)
    .in('user_id', userIds)

  const prefMap = new Map<string, boolean>()
  for (const p of prefRows ?? []) prefMap.set(p.user_id, !!p.email)

  const recipientById = new Map<string, ResolvedRecipient>()
  for (const r of finalRecipients) recipientById.set(r.id, r)

  type EmailJob = { row: InsertedRow; recipient: ResolvedRecipient; emailEnabled: boolean }
  const jobs: EmailJob[] = (inserted as InsertedRow[]).map(row => {
    const recipient = recipientById.get(row.user_id)!
    const emailEnabled = prefMap.get(row.user_id) ?? definition.defaultEmail
    return { row, recipient, emailEnabled }
  })

  await runWithConcurrency(
    jobs,
    async ({ row, recipient, emailEnabled }) => {
      if (!emailEnabled) {
        await adminClient
          .from('notifications')
          .update({ email_status: 'disabled' })
          .eq('id', row.id)
        result.emailsDisabled++
        return
      }
      try {
        const { subject, html } = definition.email(payload, {
          display_name: recipient.display_name,
          email: recipient.email,
        })
        const send = await sendNotificationEmail({ to: recipient.email, subject, html })
        if (send.ok) {
          await adminClient
            .from('notifications')
            .update({ email_status: 'sent', email_sent_at: new Date().toISOString() })
            .eq('id', row.id)
          result.emailsSent++
        } else {
          console.error(`[notifications] email send failed for ${recipient.email}:`, send.error)
          await adminClient
            .from('notifications')
            .update({ email_status: 'failed' })
            .eq('id', row.id)
          result.emailsFailed++
        }
      } catch (err) {
        console.error('[notifications] email worker error:', err)
        await adminClient
          .from('notifications')
          .update({ email_status: 'failed' })
          .eq('id', row.id)
        result.emailsFailed++
      }
    },
    EMAIL_CONCURRENCY
  )

  return result
}

// ─── Helpers exposed for callers ─────────────────────────────────────────────

export async function fetchActor(userId: string): Promise<{ id: string; display_name: string }> {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('users')
    .select('id, display_name')
    .eq('id', userId)
    .single()
  return {
    id: userId,
    display_name: (data?.display_name as string | undefined) ?? 'Someone',
  }
}
