import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { McpUser } from './auth'
import { registerPeopleTools } from './tools/people'
import { registerTaskTools } from './tools/tasks'

function createMcpServer(user: McpUser) {
  const server = new McpServer({ name: 'arcon-tools', version: '1.0.0' })
  registerPeopleTools(server, user)
  registerTaskTools(server, user)
  return server
}

// Stateless: a fresh server and transport per request, so nothing is kept between calls.
export async function handleMcpRequest(req: Request, user: McpUser): Promise<Response> {
  const server = createMcpServer(user)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  return transport.handleRequest(req)
}
