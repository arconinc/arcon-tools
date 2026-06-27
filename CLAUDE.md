# Claude Instructions for Arcon Tools App

## Project Overview

Internal company intranet / CRM tool for Arcon Inc. Next.js 16 (App Router) + React 19 + TypeScript 5 + Supabase (PostgreSQL + Auth + Storage) + Tailwind v4. Deployed at https://thearc.arconinc.com.

## Common Commands

```bash
npm run dev      # dev server on port 3000
npm run build    # production build
npm run lint     # ESLint
npm run release  # interactive release (creates tag, updates releases.json)
```

> **User tests everything.** Do NOT run `npm run build`, `npm run dev`, or lint/typecheck unless explicitly asked. State what changed and what the user should verify.

## Repository Layout

```
src/
  app/
    api/
      admin/          # Admin-only mutations — always check is_admin
      marketing/      # CRM CRUD (customers, contacts, opportunities, tasks, specs, vendors)
      notifications/  # In-app + email notifications
      employees/      # Employee directory
      documents/      # Document library
      expense-reports/# User-facing expense workflow
      orders/         # Promobuillit order list + detail
      tracking/       # Shipment tracking
      files/signed-url# Role-gated signed URLs for private buckets
      search/         # GET /api/search — universal site search
    admin/            # Admin UI (layout.tsx enforces is_admin)
    marketing/        # CRM pages (contacts, customers, opportunities, tasks, specs)
    employees/        # Employee directory + profiles
    documents/        # Document library
    expense-reports/  # User expense reports
    my-tasks/         # Cross-department personal task view
    stores/[id]/      # E-commerce store detail
    releases/         # Release notes
    dashboard/        # Main dashboard
    news/             # News reader
  components/
    layout/
      AppShell.tsx        # Nav, UserContext, StoreContext, FeatureFlagsContext, NotificationBell
      UniversalSearch.tsx # Top-bar site-wide search (replaced Google Search form)
      NotificationBell.tsx
      RoleGate.tsx        # Client-side role guard
    crm/              # Task board, kanban, modals, quick-edit panel
    employees/        # EmployeeCard, EmployeeAvatar, OfficeLocationBadge
    specs/            # VendorSearch typeahead
    FeatureFlag.tsx   # <FeatureFlag name="key"> — renders only when flag enabled
  lib/
    supabase/
      client.ts       # Browser client (client components only)
      server.ts       # createClient() — server components + route handlers
      admin.ts        # createAdminClient() — bypasses RLS, use after auth check only
    auth/get-effective-user.ts  # Resolves real vs. impersonated user
    notifications/
      registry.ts     # NotificationDefinition + NOTIFICATION_REGISTRY
      dispatch.ts     # dispatchNotification()
    permissions.ts    # RESTRICTED_RESOURCES + PRIVATE_BUCKETS (RBAC)
    access.ts         # hasFileAccess(), requiredRoleFor(), shared doc access helpers
    search/sources.ts # SearchSource registry + runUniversalSearch()
    task-constants.ts # CrmTaskDepartment, enums, DEPARTMENT_ROUTES, ROUTE_TO_DEPARTMENT
    crm/require-user.ts  # Auth helper for CRM route handlers
  types/index.ts      # All shared TypeScript types
```

## Architecture & Conventions

### Supabase Client Selection
- `createClient()` from `server.ts` — route handlers and server components
- `createAdminClient()` from `admin.ts` — DB writes bypassing RLS; **only after auth is verified**
- `createClient()` from `client.ts` — client components only; never in server code

### Route Handler Auth Pattern
```ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
// admin routes additionally:
const { data: dbUser } = await adminClient.from('users').select('is_admin').eq('google_id', user.id).single()
if (!dbUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

`user.id` from Supabase auth **is** the `google_id` — query `users` by `google_id`, not `id`.

### Admin Layout Pattern
`layout.tsx` under `app/admin/` does server-side `is_admin` check and redirects to `/dashboard` if false.

### Impersonation
Admins can impersonate users via `arcon_impersonate` httpOnly cookie. Use `getEffectiveUser()` from `src/lib/auth/get-effective-user.ts` when effective user is needed. **`getEffectiveUser()` does NOT replace the `is_admin` gate.** Check `realUserIsAdmin` before any admin action while impersonating.

### Context Hooks (client components only)
```ts
import { useAppUser, useStore, useFeatureFlags } from '@/components/layout/AppShell'
const { user } = useAppUser()        // { email, display_name, is_admin, avatar_url, roles, department, ... }
const { selectedStore } = useStore() // current e-commerce store
const flags = useFeatureFlags()      // Record<string, boolean>
```

### Feature Flags
```tsx
<FeatureFlag name="my-feature">...</FeatureFlag>
// or: if (flags['my-feature']) { ... }
```
Flags are rows in `feature_flags` table. A missing row = disabled.

### Notifications System
Add new type: define `<Type>Payload` + `NotificationDefinition` in `registry.ts`, add to `NOTIFICATION_REGISTRY`. Dispatch via `dispatchNotification()`. No DB seed needed — registry key is source of truth.

### RBAC / Roles
`permissions.ts` maps resource → required role. `access.ts` provides helpers. Admins bypass all role checks. Private bucket files must be served via `GET /api/files/signed-url` — never direct links.

### Styling
- Page-specific styles: inline `<style>` tags, not separate CSS files
- Tailwind v4: plugins via `@plugin` in `globals.css`, NOT `tailwind.config.js`
- Typography: `@plugin "@tailwindcss/typography"` in `globals.css`
- Brand color: **purple**; page containers: full width (`width: '100%'`)

### Tiptap
Named import: `import { TextStyle } from '@tiptap/extension-text-style'`. Store `content_json`, cache `content_html` on save. `excerpt` + `reading_time_minutes` via `src/lib/news-utils.ts`.

### Universal Search
`GET /api/search?q=` — parallel ILIKE across customers, contacts, vendors, documents. Min 2 chars. Document results filtered by caller's roles. Source registry: `src/lib/search/sources.ts`.

### CRM / Marketing
All CRM API endpoints under `/api/marketing/`. Task departments: `CRM | E-Commerce | HR | IT | Accounting | Sales | Warehouse | General`. Board routes in `src/lib/task-constants.ts`.

### Spec Samples
Two-table: `spec_ideas` (catalog) + `spec_samples` (per-customer records). Storage: `spec-idea-images` (public).

### Storage Buckets
| Bucket | Access |
|---|---|
| `banner-images`, `news-images`, `spec-idea-images` | public |
| `financial-reports` | private — `accounting` role required |
| `hr-documents` | private — `hr` role required |

## Key Database Tables

| Table | Purpose |
|---|---|
| `users` | Profile: `google_id`, `is_admin`, `department` (TEXT[]), `manager_id`, `birth_date` (MM-DD), `start_date` (YYYY-MM-DD) |
| `crm_customers/contacts/opportunities/tasks/tags/vendors` | CRM entities |
| `spec_ideas` / `spec_samples` | Spec sample catalog + send records |
| `notifications` / `notification_preferences` | In-app notifications + per-user email prefs |
| `roles` / `user_roles` / `access_requests` | RBAC |
| `feature_flags` | Feature flag registry |
| `expense_reports` / `expense_report_config` | Expense workflow |
| `banner_config` | Hero carousel (two rows: `draft` + `published`) |
| `news_articles` | Internal news |
| `ticker_config` | Scrolling banner strip (single row) |
| `countdown_config` | Event countdown (single row) |
| `doc_sections` / `doc_folders` / `doc_items` | Document library |
| `promo_orders` | Cached Promobuillit orders |
| `app_credentials` | Per-user encrypted API credentials |

## Testing & Verification

No unit test suite. Playwright available (`playwright.config.ts`). **Done when:** TS would compile cleanly, ESLint clean, and user has verified the feature manually at http://localhost:3000. For auth/RBAC changes: verify both admin and non-admin paths. For private files: verify signed URL path is used.

## Agent Workflow

1. Read target files before editing — never edit from memory.
2. For multi-file changes, identify all affected files before touching any.
3. Smallest diff that satisfies the requirement. No speculative abstractions.
4. Touch only files directly related to the requirement.
5. After changes: summarize what changed, which files, what user should test.
6. New API routes → follow auth pattern exactly. New notification types → follow registry pattern.

## Safety, Security, and Do-Not Rules

- **Never skip auth checks** — not even on "obviously admin-only" routes.
- **Never call `createAdminClient()` without first verifying the user.**
- **Never link directly to private storage buckets** — use `/api/files/signed-url`.
- **Never use browser Supabase client in server components or route handlers.**
- **Never run `npm run build` or `npm run dev`** — user tests all changes.
- Do not use `tailwind.config.js` for plugins (Tailwind v4 uses `@plugin` in CSS).
- Do not add ClickUp config to DB directly — it lives in `ticker_config`.
- Do not disable security features "temporarily."
- Do not use `--force` / `--no-verify` without explicit user instruction.
- Do not fabricate DB columns, routes, or components — verify they exist first.

## Maintenance Notes

Update this file when: new API route groups added, auth patterns change, new shared libs created in `src/lib/`, major features shipped, or Supabase client patterns change. Target: under 200 lines. Move feature detail to `DESIGN.md` or linked docs.
