// Tool results in MCP content format. Data goes out as JSON text.

export function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true }
}
