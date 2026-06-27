# Agent Instructions for Arcon Tools App

## Stack
- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Tailwind v4** — `@plugin` directives in `globals.css`, NOT `tailwind.config.js`
- **Supabase** — PostgreSQL + Auth + Storage (`@supabase/ssr` + `@supabase/supabase-js`)
- **Google OAuth** via Supabase Auth
- **Tiptap v3** — WYSIWYG (`@tiptap/react`)

## URLs
- **Production:** https://thearc.arconinc.com
- **Local dev:** http://localhost:3000

## Commands
```bash
npm run dev      # dev server (port 3000)
npm run build    # production build
npm run lint     # ESLint
npm run release  # interactive release script
```

Do NOT run build/dev/lint autonomously — the user verifies all changes manually.

## Supabase Client Rules
| Context | Import |
|---|---|
| Server components / route handlers | `createClient()` from `src/lib/supabase/server.ts` |
| Admin DB writes (bypass RLS) | `createAdminClient()` from `src/lib/supabase/admin.ts` — only after auth verified |
| Client components | `createClient()` from `src/lib/supabase/client.ts` — never in server code |

## Route Handler Auth Pattern
```ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
// admin routes additionally:
const { data: dbUser } = await adminClient.from('users').select('is_admin').eq('google_id', user.id).single()
if (!dbUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

`user.id` from Supabase auth IS the `google_id` — query `users` by `google_id`, not `id`.

## Key Patterns

**Admin layout:** `layout.tsx` under `app/admin/` server-checks `is_admin`, redirects to `/dashboard` if false.

**Impersonation:** `getEffectiveUser()` from `src/lib/auth/get-effective-user.ts` resolves the active (possibly impersonated) user. Does NOT replace the `is_admin` gate — check `realUserIsAdmin` before any admin action while impersonating.

**Context hooks (client components only):**
```ts
import { useAppUser, useStore, useFeatureFlags } from '@/components/layout/AppShell'
```

**Feature flags:** `<FeatureFlag name="key">` or `useFeatureFlags()`. Missing row in `feature_flags` = disabled.

**Notifications:** Define in `src/lib/notifications/registry.ts`, add to `NOTIFICATION_REGISTRY`, dispatch via `dispatchNotification()` from `dispatch.ts`.

**RBAC:** `permissions.ts` maps resources → roles. Private bucket files always via `GET /api/files/signed-url`.

**Universal search:** `GET /api/search?q=` — min 2 chars, parallel ILIKE. Source registry: `src/lib/search/sources.ts`.

**CRM API:** All CRM endpoints under `/api/marketing/` (not `/api/crm/`).

**Tiptap:** Named import: `import { TextStyle } from '@tiptap/extension-text-style'`.

## Directory Map (key files)
```
src/
  app/api/
    admin/            # Admin mutations (always check is_admin)
    marketing/        # CRM CRUD
    notifications/    # Notification endpoints
    search/           # Universal search
    files/signed-url  # Role-gated private file access
  components/layout/
    AppShell.tsx          # Nav + all contexts
    UniversalSearch.tsx   # Top-bar search
    RoleGate.tsx          # Client-side role guard
    NotificationBell.tsx
  lib/
    supabase/         # client.ts / server.ts / admin.ts
    auth/get-effective-user.ts
    notifications/    # registry.ts, dispatch.ts
    search/sources.ts
    permissions.ts
    access.ts
    task-constants.ts
  types/index.ts      # All shared types
```

## Do-Not Rules
- Never skip auth checks — not even on "obviously admin-only" routes
- Never call `createAdminClient()` before verifying the user is authenticated
- Never link directly to private storage buckets — use `/api/files/signed-url`
- Never use browser Supabase client in server code
- Never use `tailwind.config.js` for plugins — use `@plugin` in `globals.css`
- Never run `npm run build` or `npm run dev` autonomously
- Never add ClickUp config to DB directly — it lives in `ticker_config`
- Never disable security features "temporarily"
- Never fabricate DB columns, routes, or components — verify they exist first
