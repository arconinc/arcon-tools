import { describe, expect, it } from 'vitest'
import { MCP_TOKEN_PREFIX, generateMcpToken, hashMcpToken, parseBearerToken } from './tokens'

describe('generateMcpToken', () => {
  it('has the prefix and is unique per call', () => {
    const a = generateMcpToken()
    const b = generateMcpToken()
    expect(a.startsWith(MCP_TOKEN_PREFIX)).toBe(true)
    expect(a).not.toBe(b)
  })
})

describe('hashMcpToken', () => {
  it('returns a stable 64-char hex sha256 and never the plaintext', () => {
    const token = 'arc_mcp_example'
    const hash = hashMcpToken(token)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(hashMcpToken(token))
    expect(hash).not.toContain(token)
  })
})

describe('parseBearerToken', () => {
  it('extracts a valid arc_mcp_ token', () => {
    expect(parseBearerToken('Bearer arc_mcp_abc123')).toBe('arc_mcp_abc123')
  })

  it('accepts a lowercase scheme and surrounding whitespace', () => {
    expect(parseBearerToken('  bearer arc_mcp_abc123  ')).toBe('arc_mcp_abc123')
  })

  it('rejects missing, wrong-scheme, and wrong-prefix headers', () => {
    expect(parseBearerToken(null)).toBeNull()
    expect(parseBearerToken('')).toBeNull()
    expect(parseBearerToken('Basic arc_mcp_abc123')).toBeNull()
    expect(parseBearerToken('Bearer some_other_token')).toBeNull()
    expect(parseBearerToken('Bearer arc_mcp_abc 123')).toBeNull()
  })
})
