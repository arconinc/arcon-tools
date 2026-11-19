// Tool results in MCP content format. Data goes out as JSON text.

export function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true }
}

// Turns a route-style NextResponse from the shared task service into an MCP result.
export async function fromRouteResponse(res: Response) {
  const body = await res.json().catch(() => null)
  if (!res.ok) return errorResult(body?.error ?? 'Request failed.')
  return jsonResult(body)
}
