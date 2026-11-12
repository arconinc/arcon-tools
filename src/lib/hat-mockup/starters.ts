import { createAdminClient } from '@/lib/supabase/admin'
import { isClaudeConfigured, structuredCall } from '@/lib/ai/claude'

type Db = ReturnType<typeof createAdminClient>

export const MIN_SESSIONS_TO_LEARN = 20
const LEARN_WINDOW_DAYS = 60
const MAX_TEAM = 6

/** Fills `{customer}`; drops the starter when there's no customer to fill it with. */
export function fillTemplate(template: string, customerName: string | null): string | null {
  if (!template.includes('{customer}')) return template
  return customerName ? template.replaceAll('{customer}', customerName) : null
}

/** Swaps the customer a rep used last time for the one they're working on now. */
export function swapCustomer(text: string, oldName: string | null, newName: string | null): string {
  if (!oldName || !newName || oldName === newName) return text
  return text.replace(new RegExp(oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), newName)
}

export async function getStarters(db: Db, userId: string, customerName: string | null) {
  const { data: mine } = await db
    .from('hat_mockup_sessions')
    .select('first_message, crm_customers(name)')
    .eq('user_id', userId)
    .eq('saved', true)
    .not('first_message', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10)
  const recent: string[] = []
  for (const r of mine ?? []) {
    const old = (r.crm_customers as unknown as { name: string } | null)?.name ?? null
    const t = swapCustomer(r.first_message as string, old, customerName)
    if (!recent.includes(t)) recent.push(t)
    if (recent.length === 3) break
  }

  const { data: rows } = await db
    .from('hat_mockup_starters')
    .select('template, source, is_pinned, uses')
    .eq('is_hidden', false)
    .order('is_pinned', { ascending: false })
    .order('uses', { ascending: false })
  const learned = (rows ?? []).filter((r) => r.source === 'learned')
  const pool = [...(rows ?? []).filter((r) => r.is_pinned), ...(learned.length ? learned : (rows ?? []).filter((r) => r.source === 'curated'))]
  const team: string[] = []
  for (const r of pool) {
    const t = fillTemplate(r.template, customerName)
    if (t && !team.includes(t) && !recent.includes(t)) team.push(t)
    if (team.length === MAX_TEAM) break
  }
  return { recent, team }
}

const SCHEMA = {
  type: 'object',
  properties: {
    templates: {
      type: 'array',
      items: {
        type: 'object',
        properties: { template: { type: 'string' }, count: { type: 'integer' } },
        required: ['template', 'count'],
        additionalProperties: false,
      },
    },
  },
  required: ['templates'],
  additionalProperties: false,
}

/**
 * Nightly: groups reps' opening prompts from sessions that ended in a saved
 * mockup into a few reusable templates. Replaces the learned starters.
 */
export async function learnStarters(db: Db): Promise<{ learned: number; skipped?: string }> {
  if (!isClaudeConfigured()) return { learned: 0, skipped: 'ANTHROPIC_API_KEY not set' }
  const since = new Date(Date.now() - LEARN_WINDOW_DAYS * 86_400_000).toISOString()
  const { data } = await db
    .from('hat_mockup_sessions')
    .select('first_message, crm_customers(name)')
    .eq('saved', true)
    .gte('created_at', since)
    .not('first_message', 'is', null)
  const rows = data ?? []
  if (rows.length < MIN_SESSIONS_TO_LEARN) return { learned: 0, skipped: `Only ${rows.length} saved sessions` }

  const names = [...new Set(rows.map((r) => (r.crm_customers as unknown as { name: string } | null)?.name).filter((n): n is string => !!n))]
  const out = await structuredCall<{ templates: { template: string; count: number }[] }>({
    system:
      'You group sales reps\' opening requests to a hat mockup assistant into common patterns. For each pattern write one short, natural example request a rep could click. ' +
      'Replace any customer or company name with {customer}. Do not include any other names, emails or phone numbers. Use concrete hat words reps used (style numbers, colors, decoration). ' +
      `Return at most ${MAX_TEAM} templates, most common first, with how many requests fit each.`,
    content: rows.map((r) => `- ${r.first_message}`).join('\n'),
    schema: SCHEMA,
    maxTokens: 1500,
  })

  const lower = names.map((n) => n.toLowerCase())
  const safe = out.templates
    .map((t) => ({ template: t.template.trim(), uses: Math.max(0, Math.round(t.count)) }))
    .filter((t) => t.template && t.template.length <= 140 && !lower.some((n) => t.template.toLowerCase().includes(n)))
    .slice(0, MAX_TEAM)

  await db.from('hat_mockup_starters').delete().eq('source', 'learned').eq('is_pinned', false)
  if (safe.length) await db.from('hat_mockup_starters').insert(safe.map((t) => ({ ...t, source: 'learned' })))
  return { learned: safe.length }
}
