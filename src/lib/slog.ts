/**
 * Minimal structured logger for server-side route handlers.
 * Emits JSON lines so Vercel's log search can filter by service/level/msg.
 *
 * Usage:
 *   import { slog } from '@/lib/slog'
 *   const log = slog('lure-order')
 *   log.error('submission failed', { orderId, email })
 */

type Level = 'info' | 'warn' | 'error'
type Context = Record<string, unknown>

function emit(level: Level, service: string, msg: string, ctx?: Context) {
  const line = JSON.stringify({ level, service, msg, ...ctx, ts: new Date().toISOString() })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export function slog(service: string) {
  return {
    info: (msg: string, ctx?: Context) => emit('info', service, msg, ctx),
    warn: (msg: string, ctx?: Context) => emit('warn', service, msg, ctx),
    error: (msg: string, ctx?: Context) => emit('error', service, msg, ctx),
  }
}
