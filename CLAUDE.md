# Claude Instructions for Arcon Tools App

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
    api/                    # Route handlers
      admin/                # Admin-only mutations (check is_admin)
      marketing/            # Marketing/CRM CRUD endpoints
      notifications/        # In-app + email notification endpoints
      employees/            # Employee directory endpoints
      documents/            # Document library endpoints
      forms/                # Form submission endpoints
    admin/                  # Admin UI pages (layout.tsx enforces is_admin)
      users/                # User management + impersonation
      employees/[id]/       # Employee profile editor
      banner/               # Hero carousel editor
      banner-strip/         # Ticker config editor
      news/                 # News article CRUD
      documents/            # Document library admin
      forms/                # Form builder admin
      marketing-goals/      # Marketing goal editor
      stores/               # E-commerce store config
      audit-log/            # Audit log viewer
    marketing/              # Marketing CRM pages (contacts, customers, opportunities, tasks)
    employees/              # Employee directory + profile pages
    documents/              # Document library (Google Drive links)
    my-tasks/               # Cross-department personal task view
    accounting/tasks/       # Accounting department task board
    sales/tasks/            # Sales department task board
    warehouse/tasks/        # Warehouse department task board
    dashboard/              # Main dashboard
    news/                   # News reader
    profile/                # User profile + notification preferences
    settings/               # User settings
    birthdays/              # Birthday/anniversary viewer
    stores/[id]/            # E-commerce store detail with tabs
    tasks/                  # Task detail + add-tracking
    order/rapala-lure/      # Lure order submission
    releases/               # Release notes
    login/, auth/           # Auth flow
  components/
    layout/AppShell.tsx     # Nav, UserContext, StoreContext, NotificationBell
    layout/NotificationBell.tsx  # In-app notification dropdown
    news/                   # Tiptap editor/renderer, article cards
    crm/                    # Task board, kanban, modals, quick-edit panel
    employees/              # EmployeeCard, EmployeeAvatar, OfficeLocationBadge
    forms/                  # FormRecommender, TaxFormCard
    profile/NotificationPreferences.tsx  # Per-user notification opt-in/out
  lib/
    supabase/
      client.ts             # Browser client (use in client components)
      server.ts             # createClient() — server components & route handlers
      admin.ts              # createAdminClient() — bypasses RLS, admin ops only
    auth/get-effective-user.ts  # Resolves real vs. impersonated user (see Impersonation)
    notifications/
      registry.ts           # NotificationDefinition types + NOTIFICATION_REGISTRY
      dispatch.ts           # dispatchNotification() — inserts rows + sends email
      recipients.ts         # resolveRecipients() — user or department fan-out
      email.ts              # sendNotificationEmail() via Resend/SMTP
      template.ts           # renderGenericEmail() HTML template
    ticker-sources.ts       # Banner strip data aggregation
    news-utils.ts           # Excerpt/reading-time helpers
    credentials.ts          # Per-user credential encryption
    audit.ts                # Audit log helpers
    task-constants.ts       # CrmTaskDepartment, CrmTaskStatus, CrmTaskPriority, CrmTaskCategory constants
    crm/require-user.ts     # Auth helper used in marketing/CRM route handlers
    email.ts                # Generic email sending
    phone.ts                # Phone formatting helpers
    cloudinary.ts           # Cloudinary image helpers
    google-calendar.ts      # Google Calendar API integration
    company-calendar-config.ts  # Calendar event type definitions
    forms-utils.ts          # Form submission helpers
    analytics.ts            # Analytics helpers
  types/index.ts            # All shared TypeScript types
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

## Impersonation

Admins can impersonate non-admin users. The effective user (real or impersonated) is resolved via `getEffectiveUser()` in `src/lib/auth/get-effective-user.ts`.

- Sets/reads an `arcon_impersonate` httpOnly cookie containing the target user's UUID
- `POST /api/admin/impersonate` — starts impersonation (admin-only, cannot impersonate admins or deactivated users)
- `POST /api/admin/stop-impersonation` — clears the cookie
- Route handlers and layouts that need the effective user (not just the real user) should call `getEffectiveUser()` instead of reading `auth.getUser()` directly
- Impersonation is audit-logged with action `impersonation.start`
- Returns `{ effectiveUser, isImpersonating, realUserIsAdmin }` — use `realUserIsAdmin` to gate admin actions

## Notifications System

In-app + email notifications with per-user preferences.

**Tables:** `notifications`, `notification_preferences`

**Adding a new notification type:**
1. Define `<Type>Payload` interface in `src/lib/notifications/registry.ts`
2. Export a `NotificationDefinition<Payload>` constant with `type`, `label`, `description`, `defaultEmail`, `render()`, and `email()` methods
3. Add it to `NOTIFICATION_REGISTRY` — no DB seed needed, the key IS the source of truth

**Dispatching:**
```ts
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { taskAssigned } from '@/lib/notifications/registry'

await dispatchNotification({
  definition: taskAssigned,
  payload: { ... },
  recipientSpec: { kind: 'user', userId } | { kind: 'department', department },
  suppressUserIds: [actorId],   // optional — omit the actor from fan-out
})
```

**API routes:**
- `GET /api/notifications` — list user's notifications (unread count, paginated)
- `POST /api/notifications/mark-read` — mark notification(s) read
- `GET/PUT /api/notifications/preferences` — user's per-type email opt-in/out
- `GET/DELETE /api/notifications/[id]` — single notification

**UI:**
- `NotificationBell` in AppShell topbar — polling dropdown with unread badge
- `NotificationPreferences` in `/profile` — per-type email toggle

## Employee Directory

Full employee profiles with org chart relationships.

**Key fields on `users`:** `department` (TEXT[]), `manager_id`, `profile_image_url`, `job_title`, `office_location` (`Remote|Minnesota|Arizona|Colorado`), `employment_type` (`full-time|part-time|contractor`), `bio_json`, `bio_html`, `skills`, `interests`, `linkedin_url`, `timezone`, `deactivated_at`

**Pages:**
- `/employees` — searchable/filterable directory grid
- `/employees/[id]` — public profile with bio, org chart, skills
- `/admin/employees/[id]` — admin editor for all profile fields

**API routes:**
- `GET /api/employees` — directory listing (`EmployeeSummary[]`)
- `GET /api/employees/[id]` — full profile (`EmployeeProfile`)
- `GET/PUT /api/admin/employees/[id]` — admin CRUD
- `POST /api/admin/employees/upload` — profile image upload
- `POST /api/admin/sync-avatars` — sync Google OAuth avatars to `users.avatar_url`
- `POST /api/admin/sync-google-photos` — sync Google profile photos

## Marketing / CRM

Full CRM under `/marketing` (was previously `/crm`). Departments use `CrmTaskDepartment` values.

**Entities:** Customers, Contacts, Opportunities, Tasks, Tags, Artwork, Vendors

**Task departments:** `CRM | E-Commerce | HR | IT | Accounting | Sales | Warehouse | General`

**Department task boards:**
- `/marketing/tasks` — Marketing/CRM tasks
- `/accounting/tasks` — Accounting tasks
- `/sales/tasks` — Sales tasks
- `/warehouse/tasks` — Warehouse tasks
- `/my-tasks` — cross-department personal view

**Key API routes:**
- `GET/POST /api/marketing/tasks` — task list + create
- `GET/PUT/DELETE /api/marketing/tasks/[id]` — task CRUD
- `GET/POST /api/marketing/customers` — customer list + create
- `GET/PUT/DELETE /api/marketing/customers/[id]` — customer CRUD
- `GET/POST /api/marketing/contacts` — contact list + create
- `GET/PUT/DELETE /api/marketing/contacts/[id]` — contact CRUD
- `GET/POST /api/marketing/opportunities` — opportunity list + create
- `GET/PUT/DELETE /api/marketing/opportunities/[id]` — opportunity CRUD
- `GET/POST /api/marketing/artwork` — artwork asset CRUD
- `GET /api/marketing/brand-fetch` — Brandfetch brand data lookup
- `GET/PUT /api/admin/marketing/import` — bulk contact import
- `GET/PUT /api/admin/marketing-goals/[user_id]` — per-user marketing goals
- `GET /api/marketing/pipeline-chart` — opportunity pipeline chart data

## Document Library

Hierarchical Google Drive link library: Sections → Folders → Documents.

**Tables:** `doc_sections`, `doc_folders`, `doc_items`

**Pages:** `/documents` (read), `/admin/documents` (admin CRUD)

**API routes:**
- `GET/POST /api/admin/documents/sections` + `[id]`
- `GET/POST /api/admin/documents/folders` + `[id]`
- `GET/POST /api/admin/documents/items` + `[id]`
- `GET /api/documents` — public tree

## Forms

Admin-managed form definitions with submissions and delivery logging.

**Pages:** `/admin/forms` (builder + settings)

**API routes:**
- `GET/POST /api/admin/forms` — form list + create
- `GET/PUT/DELETE /api/admin/forms/[id]` — form CRUD
- `GET /api/admin/forms/[id]/delivery-log` — submission delivery log
- `GET /api/admin/forms/[id]/public-link` — shareable link
- `POST /api/admin/forms/[id]/upload` — file upload for form
- `POST /api/forms` — public form submission

## Context Hooks (client components only)
```ts
import { useAppUser } from '@/components/layout/AppShell'
import { useStore } from '@/components/layout/AppShell'

const { user } = useAppUser()   // { email, display_name, is_admin, avatar_url, clickup_user_id, department, ... }
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
| `users` | Full user + employee profile (see Employee Directory section) |
| `stores` | E-commerce store config |
| `app_credentials` | Per-user encrypted API credentials |
| `audit_logs` | User action log |
| `banner_config` | Hero carousel slides — two rows: `draft` + `published` |
| `news_articles` | Internal news/announcements |
| `ticker_config` | Scrolling banner strip config (single row) |
| `countdown_config` | Event countdown config (single row) |
| `notifications` | In-app notifications (type, title, body, link_url, read_at, email_status) |
| `notification_preferences` | Per-user, per-type email opt-in (user_id, type, email) |
| `doc_sections` | Document library top-level sections |
| `doc_folders` | Document library folders (belong to a section) |
| `doc_items` | Google Drive document links (belong to a folder) |
| `crm_customers` | CRM customer records |
| `crm_contacts` | CRM contacts (linked to customers) |
| `crm_opportunities` | CRM opportunities / pipeline |
| `crm_tasks` | Cross-department task board tasks |
| `crm_tags` | Tags for CRM entities |
| `crm_artwork` | Artwork/asset records for customers |
| `crm_brand_data` | Brandfetch brand data cache |

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
| `GET /api/employees` | Employee directory |
| `GET /api/marketing/tasks` | Marketing/CRM tasks |
| `GET /api/notifications` | User notifications |
| `POST /api/admin/impersonate` | Start admin impersonation |
| `POST /api/admin/stop-impersonation` | End impersonation |
| `GET /api/admin/audit-log` | Audit log |
| `GET /api/addon/*` | Gmail add-on endpoints |

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
- Do not call `getEffectiveUser()` in place of the standard admin auth check — `getEffectiveUser()` resolves impersonation but does NOT replace the `is_admin` gate

## Security Considerations
- **Convenience is not a reason to bypass security.** Shortcuts that skip auth checks, skip permission validation, or circumvent role-based access controls create vulnerabilities even if they work initially.
- **Security shortcuts are tempting when:** you're late in a task, a check seems "obvious," you think "it's just this once," or you want a "quick fix." These are exactly when security shortcuts cause the most damage.
- **Never trade security for speed.** If an auth pattern is documented, use it exactly as written. If a validation check exists, run it in full. If a permission gate is in place, verify it before every sensitive operation.
- **Always follow the documented auth patterns for your project.** For this project: route handler auth pattern, admin layout pattern, and client selection patterns are not suggestions — they are security boundaries.
- **Impersonation boundary:** `realUserIsAdmin` must be checked before any admin action taken while `isImpersonating === true`. Never let an impersonated session gain admin privileges.
