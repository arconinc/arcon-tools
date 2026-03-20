# Claude Instructions for Arcon Tools App

## Stack
- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Tailwind v4** — use `@plugin` directives in `globals.css`, NOT `tailwind.config.js` plugins
- **Supabase** — PostgreSQL + Auth + Storage (`@supabase/ssr` + `@supabase/supabase-js`)
- **Google OAuth** via Supabase Auth
- **Tiptap v3** for WYSIWYG editing (`@tiptap/react`)

## Common Commands
```bash
npm run dev      # start dev server (port 3000)
npm run build    # production build
npm run lint     # ESLint
```

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
const { data: dbUser } = await adminClient.from('users').select('is_admin').eq('id', user.id).single()
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
