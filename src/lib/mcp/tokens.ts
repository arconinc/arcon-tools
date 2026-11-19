import { createHash, randomBytes } from 'crypto'

export const MCP_TOKEN_PREFIX = 'arc_mcp_'

export function generateMcpToken(): string {
  return MCP_TOKEN_PREFIX + randomBytes(32).toString('base64url')
}

export function hashMcpToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// Accepts "Bearer arc_mcp_..." and returns the token, or null for anything else.
export function parseBearerToken(header: string | null): string | null {
  if (!header) return null
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  if (!match) return null
  return match[1].startsWith(MCP_TOKEN_PREFIX) ? match[1] : null
}
