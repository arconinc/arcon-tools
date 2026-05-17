# Codex Instructions for Arcon Tools App

## Stack
- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Tailwind v4** — use `@plugin` directives in `globals.css`, NOT `tailwind.config.js` plugins
- **Supabase** — PostgreSQL + Auth + Storage (`@supabase/ssr` + `@supabase/supabase-js`)
- **Google OAuth** via Supabase Auth
- **Tiptap v3** for WYSIWYG editing (`@tiptap/react`)

## URLs
- **Production:** https://thearc.arconinc.com
- **Local dev:** http://localhost:3000

## Common Commands
```bash
npm run dev      # start dev server (port 3000)
npm run build    # production build
npm run lint     # ESLint
```

## Verification Preference
- Do not run `npm run lint`, `npm lit`, `npx tsc --noEmit --pretty false`, or other automated verification commands unless the user explicitly asks for them. When verification is skipped, state that clearly in the final response.

## Principles

- **Don't assume. Don't hide confusion. Surface tradeoffs.** — Ask clarifying questions upfront rather than inferring intent. Explicitly discuss trade-offs between approaches instead of choosing silently.
- **Minimum code that solves the problem. Nothing speculative.** — Only implement what's needed for the current requirement. Don't add infrastructure or patterns for hypothetical future use.
- **Touch only what you must.** — Avoid refactoring or cleaning code outside the scope of your current task. Limit changes to files directly related to the requirement.
- **Clean up only your own mess.** — You are responsible for the quality of code you write, not for fixing unrelated technical debt.
- **Define success criteria.** — Be explicit about what "done" means before starting. How will you know the change is working? What should be tested?
- **Security first — never shortcut auth, validation, or permission checks.** — Even when a shortcut *seems* safe or convenient, always follow the documented auth patterns. Never skip environment verification, permission checks, or role validation. Never use flags like `--no-verify` or similar bypasses. Always verify intended behavior against security patterns (RLS, auth checks, admin gates).

## Project Structure
```
src/
  app/
    api/                  # Route handlers
      admin/              # Admin-only mutations (check is_admin)
      crm/                # CRM CRUD endpoints
    admin/                # Admin UI pages (layout.tsx enforces is_admin)
    crm/                  # CRM pages
    dashboard/            # Main dashboard
    news/                 # News reader
    login/, auth/         # Auth flow
  components/
    layout/AppShell.tsx   # Nav, UserContext, StoreContext
    news/                 # Tiptap editor/renderer, article cards
  lib/
    supabase/
      client.ts           # Browser client (use in client components)
      server.ts           # createClient() — server components & route handlers
      admin.ts            # createAdminClient() — bypasses RLS, admin ops only
    ticker-sources.ts     # Banner strip data aggregation
    news-utils.ts         # Excerpt/reading-time helpers
    credentials.ts        # Per-user credential encryption
    audit.ts              # Audit log helpers
  types/index.ts          # All shared TypeScript types
```

## Supabase Patterns

**Always use the right client:**
- `createClient()` from `server.ts` — auth checks in route handlers and server components
- `createAdminClient()` from `admin.ts` — DB writes that bypass RLS; only after auth is verified
- Browser `createClient()` from `client.ts` — client components only

**Route handler auth pattern:**
```ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
// for admin routes:
const { data: dbUser } = await adminClient.from('users').select('is_admin').eq('google_id', user.id).single()
if (!dbUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

**Admin layout pattern:** `layout.tsx` files under `app/admin/` do server-side `is_admin` check and redirect to `/dashboard` if false.

## Context Hooks (client components only)
```ts
import { useAppUser } from '@/components/layout/AppShell'
import { useStore } from '@/components/layout/AppShell'

const { user } = useAppUser()   // { email, display_name, is_admin, avatar_url, clickup_user_id }
const { selectedStore } = useStore()  // current e-commerce store
```

## Styling Conventions
- Use **inline `<style>` tags** in dashboard/admin pages for page-specific styles (not separate CSS files)
- Tailwind utility classes for component-level styling
- Typography plugin loaded via `@plugin "@tailwindcss/typography"` in `globals.css`
- Color theme: **purple** as primary brand color

## Database Tables
| Table | Purpose |
|---|---|
| `users` | id, email, display_name, google_id, is_admin, birth_date (MM-DD), start_date (YYYY-MM-DD hire), address fields, phone, clickup_user_id |
| `stores` | e-commerce store config |
| `app_credentials` | per-user encrypted API credentials |
| `audit_logs` | user action log |
| `banner_config` | hero carousel slides — two rows: `draft` + `published` |
| `news_articles` | internal news/announcements |
| `ticker_config` | scrolling banner strip config (single row) |
| `countdown_config` | event countdown config (single row) |

## Key API Routes
| Route | Description |
|---|---|
| `GET/PUT /api/admin/banner` | Hero carousel slides |
| `POST /api/admin/banner/upload` | Upload to `banner-images` storage bucket |
| `GET/POST/PUT/DELETE /api/admin/news/[id]` | News article CRUD |
| `POST /api/admin/news/upload` | Upload to `news-images` storage bucket |
| `GET /api/news` | Public news listing |
| `GET/PUT /api/admin/banner-strip` | Ticker config |
| `GET /api/banner-strip` | Public ticker items |
| `GET/PUT /api/admin/countdown` | Countdown config |
| `GET /api/countdown` | Current countdown (auth required) |
| `GET /api/tasks` | User's ClickUp tasks |
| `GET /api/crm/*` | CRM CRUD |

## Tiptap Editor
- Use named import: `import { TextStyle } from '@tiptap/extension-text-style'`
- Store `content_json` (Tiptap JSON) and cache `content_html` on save
- `excerpt` and `reading_time_minutes` are auto-computed via `src/lib/news-utils.ts`

## Supabase Storage Buckets
- `banner-images` — public, hero carousel backgrounds (recommended 1440×480px)
- `news-images` — public, article cover images

## What NOT to do
- Do not use `tailwind.config.js` for plugins — use `@plugin` in `globals.css` (Tailwind v4)
- Do not call `createAdminClient()` without first verifying the user is authenticated
- Do not use the browser Supabase client in server components or route handlers
- Do not add ClickUp config directly to DB — it lives in `ticker_config` table
- Do not skip the admin `is_admin` check to "save time" on a "clearly admin-only" route
- Do not skip validation at security boundaries (auth, role checks, data access)
- Do not use `--force` flags with git, npm, or deployment tools without explicit reasoning and documentation
- Do not disable security features (RLS, CORS, auth) "temporarily" — temporary bypasses often become permanent vulnerabilities

## Security Considerations
- **Convenience is not a reason to bypass security.** Shortcuts that skip auth checks, skip permission validation, or circumvent role-based access controls create vulnerabilities even if they work initially.
- **Security shortcuts are tempting when:** you're late in a task, a check seems "obvious," you think "it's just this once," or you want a "quick fix." These are exactly when security shortcuts cause the most damage.
- **Never trade security for speed.** If an auth pattern is documented, use it exactly as written. If a validation check exists, run it in full. If a permission gate is in place, verify it before every sensitive operation.
- **Always follow the documented auth patterns for your project.** For this project: route handler auth pattern (lines 63–71), admin layout pattern (line 73), and client selection patterns (lines 58–61) are not suggestions — they are security boundaries.

<claude-mem-context>
# Memory Context

# claude-mem status

This project has no memory yet. The current session will seed it; subsequent sessions will receive auto-injected context for relevant past work.

Memory injection starts on your second session in a project.

`/learn-codebase` is available if the user wants to front-load the entire repo into memory in a single pass (~5 minutes on a typical repo, optional). Otherwise memory builds passively as work happens.

Live activity: http://localhost:37777
How it works: `/how-it-works`

This message disappears once the first observation lands.
</claude-mem-context>
