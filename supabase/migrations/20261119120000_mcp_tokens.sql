-- Per-user tokens for the MCP server at /api/mcp.
-- Only a sha256 hash of each token is stored. The plaintext is shown once at creation.
-- RLS is on with no policies, so only the service role (createAdminClient) can read or write.
-- Not applied yet. Review first, then apply.

create table if not exists mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists mcp_tokens_user_id_idx on mcp_tokens (user_id);

alter table mcp_tokens enable row level security;
