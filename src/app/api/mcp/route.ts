import { NextRequest, NextResponse } from 'next/server'
import { resolveMcpUser } from '@/lib/mcp/auth'
import { handleMcpRequest } from '@/lib/mcp/server'

// MCP endpoint (Streamable HTTP). Auth is a per-user bearer token, not the session cookie.
async function handle(req: NextRequest) {
  const user = await resolveMcpUser(req)
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
    )
  }
  return handleMcpRequest(req, user)
}

export const POST = handle
export const GET = handle
export const DELETE = handle
