import type Anthropic from '@anthropic-ai/sdk'
import * as Sentry from '@sentry/nextjs'
import { claude, FALLBACK, MOCKUP_MODEL, textOf } from '@/lib/ai/claude'
import { createAdminClient } from '@/lib/supabase/admin'
import { METHOD_LABELS, type MockupSelection } from './service'
import { executeTool, parseAsk, TOOLS, type Ask, type Preview, type ToolContext } from './tools'

type Db = ReturnType<typeof createAdminClient>
type Msg = Anthropic.Beta.BetaMessageParam

const SYSTEM = `You help Arcon sales reps make hat mockups in The Arc, Arcon's intranet. Reps type a request in any form:
a customer, a hat, a logo, what the hats are for, or "same as last time". Work out what is missing (customer, logo,
hat style, decoration method, color) and get it.

Rules:
- Ask at most one question per turn, with ask_user and clickable options. When only one option fits, use it and move on.
- Only offer customers, logos, hats, colors and decoration methods that a tool returned. Never invent style numbers, colors, prices or minimums.
- Mention the vendor minimum when the rep picks a decoration method (e.g. "embroidery, minimum 6").
- If the logo has embroidery warnings, say so briefly before rendering an embroidered mockup.
- Never set a logo size from memory; render_mockup applies Arcon's placement rules. Always state the final size in inches.
- For color choices, prefer suggest_colors so the logo stays readable, and say why in a few words.
- When the rep is undecided between colors, use compare_mockups.
- Keep replies to one or two short sentences. Plain language, no markdown headings.
- A message starting with [Selections changed with the pickers] reports the rep's own changes; respect them.`

const MAX_STEPS = 8

export type SessionRow = {
  id: string
  messages: Msg[]
  state: MockupSelection & { pending?: Record<string, string> }
}

export type TurnResult = {
  reply: string
  ask: Ask | null
  previews: Preview[]
  activity: string[]
  messages: Msg[]
  state: SessionRow['state']
}

/** Tool results owed for the last assistant turn (answers to ask_user plus anything run alongside it). */
function pendingResults(messages: Msg[], answer: string, pending: Record<string, string> = {}): Anthropic.Beta.BetaToolResultBlockParam[] {
  const last = messages.at(-1)
  if (!last || last.role !== 'assistant' || typeof last.content === 'string') return []
  return last.content
    .filter((b): b is Anthropic.Beta.BetaToolUseBlockParam => b.type === 'tool_use')
    .map((b) => ({
      type: 'tool_result' as const,
      tool_use_id: b.id,
      content: b.name === 'ask_user' ? `The rep answered: ${answer}` : (pending[b.id] ?? 'Done.'),
    }))
}

export function describeSelectionChange(before: MockupSelection, after: MockupSelection, names: Record<string, string>): string | null {
  const parts: string[] = []
  const label = (k: keyof MockupSelection, v: unknown) => (typeof v === 'string' ? (names[v] ?? (k === 'method' ? METHOD_LABELS[v] ?? v : v)) : String(v))
  for (const k of ['customerId', 'artworkId', 'styleId', 'colorId', 'method', 'heightIn', 'offsetYIn'] as const) {
    if (after[k] !== undefined && after[k] !== before[k]) parts.push(`${k.replace(/Id$/, '')} → ${label(k, after[k])}${k.endsWith('In') ? ' in' : ''}`)
  }
  return parts.length ? `[Selections changed with the pickers] ${parts.join(', ')}` : null
}

export async function runAgentTurn(db: Db, session: SessionRow, userText: string, note: string | null): Promise<TurnResult> {
  const messages: Msg[] = [...session.messages]
  const state = { ...session.state }
  const ctx: ToolContext = { db, state, previews: [], activity: [] }

  const results = pendingResults(messages, userText, state.pending)
  delete state.pending
  const text = [note, userText].filter(Boolean).join('\n\n')
  const context = state.customerName ? `(Current customer: ${state.customerName}, id ${state.customerId})\n` : ''
  messages.push({ role: 'user', content: [...results, { type: 'text', text: context + text }] })

  let ask: Ask | null = null
  const replies: string[] = []

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await claude().beta.messages.create({
      model: MOCKUP_MODEL,
      max_tokens: 4096,
      ...FALLBACK,
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      messages,
    })
    // Append the response unchanged (thinking blocks included); history is append-only.
    messages.push({ role: 'assistant', content: res.content as Anthropic.Beta.BetaContentBlockParam[] })
    const said = textOf(res).trim()
    if (said) replies.push(said)

    if (res.stop_reason === 'refusal') {
      replies.push("I can't help with that request. Try describing the hat and logo you need.")
      break
    }
    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    if (!uses.length) break

    const out: Anthropic.Beta.BetaToolResultBlockParam[] = []
    let askUse: Anthropic.Beta.BetaToolUseBlock | null = null
    for (const u of uses) {
      if (u.name === 'ask_user') {
        askUse = u
        continue
      }
      try {
        const r = await executeTool(ctx, u.name, (u.input ?? {}) as Record<string, unknown>)
        out.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(r) })
      } catch (err) {
        if (!(err instanceof Error) || !/must be an id|not found|cannot go on a hat|not available/i.test(err.message)) Sentry.captureException(err)
        out.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: (err as Error).message })
      }
    }

    if (askUse) {
      // Pause for the rep. Results of tools run alongside ask_user are sent with the answer.
      ask = parseAsk((askUse.input ?? {}) as Record<string, unknown>)
      state.pending = Object.fromEntries(out.map((r) => [r.tool_use_id, typeof r.content === 'string' ? r.content : 'Done.']))
      break
    }
    messages.push({ role: 'user', content: out })
    if (step === MAX_STEPS - 1) replies.push('That took more steps than expected. Tell me what to change and I will continue.')
  }

  return { reply: replies.join('\n\n'), ask, previews: ctx.previews, activity: ctx.activity, messages, state }
}
