import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { badRequest, fail, notFound, ok, serverError } from '@/lib/api/respond'
import { isClaudeConfigured } from '@/lib/ai/claude'
import { describeSelectionChange, runAgentTurn, type SessionRow } from '@/lib/hat-mockup/agent'
import { requireMockupUser } from '@/lib/hat-mockup/guard'
import { isUuid, parseSelection } from '@/lib/hat-mockup/request'
import type { MockupSelection } from '@/lib/hat-mockup/service'

export const runtime = 'nodejs'
export const maxDuration = 90

type Db = ReturnType<typeof createAdminClient>

/** Display names for ids in a picker change, so the agent reads "color → Navy" not a uuid. */
async function namesFor(db: Db, sel: MockupSelection): Promise<Record<string, string>> {
  const names: Record<string, string> = {}
  const lookups: [string | null | undefined, string, string][] = [
    [sel.customerId, 'crm_customers', 'name'],
    [sel.artworkId, 'crm_artwork', 'name'],
    [sel.colorId, 'hat_colors', 'name'],
  ]
  await Promise.all(
    lookups.map(async ([id, table, col]) => {
      if (!id) return
      const { data } = await db.from(table).select(col).eq('id', id).maybeSingle()
      const v = (data as Record<string, string> | null)?.[col]
      if (v) names[id] = v
    }),
  )
  if (sel.styleId) {
    const { data } = await db.from('hat_styles').select('style_number, name').eq('id', sel.styleId).maybeSingle()
    if (data) names[sel.styleId] = `${data.style_number} ${data.name}`
  }
  return names
}

// POST /api/marketing/mockups/chat  { session_id?, customer_id?, message, selection? }
export async function POST(req: NextRequest) {
  const guard = await requireMockupUser()
  if (guard.res) return guard.res
  if (!isClaudeConfigured()) return fail(503, 'The assistant is not configured yet (ANTHROPIC_API_KEY). Use the pickers instead.')

  const body = await req.json().catch(() => ({}))
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : ''
  if (!message) return badRequest('Type a message')

  const db = createAdminClient()
  let session: SessionRow & { first_message: string | null }

  if (isUuid(body.session_id)) {
    const { data } = await db
      .from('hat_mockup_sessions')
      .select('id, messages, state, first_message')
      .eq('id', body.session_id)
      .eq('user_id', guard.user.id)
      .maybeSingle()
    if (!data) return notFound('Conversation not found')
    session = data
  } else {
    const state: SessionRow['state'] = {}
    if (isUuid(body.customer_id)) {
      const { data: c } = await db.from('crm_customers').select('id, name').eq('id', body.customer_id).maybeSingle()
      if (c) Object.assign(state, { customerId: c.id, customerName: c.name })
    }
    const { data, error } = await db
      .from('hat_mockup_sessions')
      .insert({ user_id: guard.user.id, customer_id: state.customerId ?? null, state, messages: [] })
      .select('id, messages, state, first_message')
      .single()
    if (error || !data) return serverError('Could not start a conversation')
    session = data
  }

  // Changes the rep made with the pickers since the last turn.
  const picked = parseSelection(body.selection)
  const note = describeSelectionChange(session.state, picked, await namesFor(db, picked))
  session.state = { ...session.state, ...picked }

  try {
    const turn = await runAgentTurn(db, session, message, note)
    await db
      .from('hat_mockup_sessions')
      .update({
        messages: turn.messages,
        state: turn.state,
        customer_id: turn.state.customerId ?? null,
        first_message: session.first_message ?? message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    const { pending: _pending, ...state } = turn.state
    return ok({ session_id: session.id, reply: turn.reply, ask: turn.ask, previews: turn.previews, activity: turn.activity, state })
  } catch (err) {
    Sentry.captureException(err)
    console.error('[mockup chat] turn failed:', err) // ponytail: temporary, remove once the 500 cause is fixed
    if (err instanceof Anthropic.RateLimitError) return fail(429, 'The assistant is busy. Try again in a moment.')
    return serverError('The assistant ran into a problem. Your selections are kept; try again or use the pickers.')
  }
}
