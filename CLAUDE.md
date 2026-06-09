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
npm run release  # interactive release script (creates tag, updates releases.json)
```

## Principles

- **Don't assume. Don't hide confusion. Surface tradeoffs.** — Ask clarifying questions upfront rather than inferring intent. Explicitly discuss trade-offs between approaches instead of choosing silently.
- **Minimum code that solves the problem. Nothing speculative.** — Only implement what's needed for the current requirement. Don't add infrastructure or patterns for hypothetical future use.
- **Touch only what you must.** — Avoid refactoring or cleaning code outside the scope of your current task. Limit changes to files directly related to the requirement.
- **Clean up only your own mess.** — You are responsible for the quality of code you write, not for fixing unrelated technical debt.
- **Define success criteria.** — Be explicit about what "done" means before starting. How will you know the change is working? What should be tested?
- **Security first — never shortcut auth, validation, or permission checks.** — Even when a shortcut *seems* safe or convenient, always follow the documented auth patterns. Never skip environment verification, permission checks, or role validation. Never use flags like `--no-verify` or similar bypasses. Always verify intended behavior against security patterns (RLS, auth checks, admin gates).
- **User tests everything. Never run build or test yourself.** — Do not invoke `npm run build`, `npm run test`, `npm run dev`, or similar commands. The user will test all changes. Focus on code changes only.

## Project Structure
```
src/
  app/
    api/                    # Route handlers
      admin/                # Admin-only mutations (check is_admin)
        access-requests/    # Approve/deny role access requests
        expense-reports/    # Admin review of expense reports + config
        feature-flags/[key] # Feature flag enable/disable
        roles/              # List roles (read-only, any auth'd user)
        user-roles/         # Assign/revoke roles for users
      marketing/            # Marketing/CRM CRUD endpoints
      notifications/        # In-app + email notification endpoints
      employees/            # Employee directory endpoints
      documents/            # Document library endpoints
      forms/                # Form submission endpoints
      expense-reports/      # User-facing expense report endpoints
      access-requests/      # User submits role access requests
      orders/               # Promobuillit order list + detail
      tracking/             # Add shipment tracking to Promobuillit orders
      files/signed-url      # Signed URLs for private storage buckets (role-gated)
      cron/sync-orders      # Vercel cron — sync Promobuillit orders to DB
    admin/                  # Admin UI pages (layout.tsx enforces is_admin)
      users/                # User management + impersonation
      employees/[id]/       # Employee profile editor
      banner/               # Hero carousel editor
      banner-strip/         # Ticker config editor
      news/                 # News article CRUD
      documents/            # Document library admin
      forms/                # Form builder admin
      marketing-goals/      # Marketing goal editor
      stores/               # E-commerce store config + sync
      audit-log/            # Audit log viewer
      expense-reports/[id]/ # Admin expense report review
      feature-flags/        # Feature flag management
      specs/ideas/          # Admin spec idea CRUD + editor
    marketing/              # Marketing CRM pages (contacts, customers, opportunities, tasks)
      specs/                # Spec sample list
      specs/new/            # Create spec sample
      specs/[id]/           # Spec sample detail
      specs/ideas/          # Spec idea catalog browser
    employees/              # Employee directory + profile pages
    documents/              # Document library (Google Drive links)
    my-tasks/               # Cross-department personal task view
    accounting/tasks/       # Accounting department task board
    sales/tasks/            # Sales department task board
    warehouse/tasks/        # Warehouse department task board
    hr/tasks/               # HR department task board
    it/tasks/               # IT department task board
    ecommerce/tasks/        # E-Commerce department task board
    dashboard/              # Main dashboard
    news/                   # News reader
    profile/                # User profile + notification preferences
    settings/               # User settings
    birthdays/              # Birthday/anniversary viewer
    stores/[id]/            # E-commerce store detail (tabs: Overview, Tasks, Team, CRM Links, AddTracking)
    expense-reports/        # User expense report list + detail
    access-requests/new     # Role access request form
    tasks/                  # Task detail + add-tracking
    order/rapala-lure/      # Lure order submission
    releases/               # Release notes
    login/, auth/           # Auth flow
  components/
    layout/AppShell.tsx     # Nav, UserContext, StoreContext, FeatureFlagsContext, NotificationBell
    layout/NotificationBell.tsx  # In-app notification dropdown
    FeatureFlag.tsx         # <FeatureFlag name="key"> — renders children only if flag is enabled
    news/                   # Tiptap editor/renderer, article cards
    crm/                    # Task board, kanban, modals, quick-edit panel
    employees/              # EmployeeCard, EmployeeAvatar, OfficeLocationBadge
    forms/                  # FormRecommender, TaxFormCard
    specs/VendorSearch.tsx  # Vendor typeahead linked to crm_vendors
    stores/CredentialPrompt.tsx  # Prompts user to configure store API credentials
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
    permissions.ts          # RESTRICTED_RESOURCES map + PRIVATE_BUCKETS set (RBAC)
    access.ts               # hasFileAccess(), requiredRoleFor() — role-check helpers
    ticker-sources.ts       # Banner strip data aggregation
    news-utils.ts           # Excerpt/reading-time helpers
    credentials.ts          # Per-user credential encryption
    encryption.ts           # Low-level encrypt/decrypt utilities
    audit.ts                # Audit log helpers
    task-constants.ts       # CrmTaskDepartment, CrmTaskStatus, CrmTaskPriority, CrmTaskCategory constants + DEPARTMENT_ROUTES
    crm/require-user.ts     # Auth helper used in marketing/CRM route handlers
    email.ts                # Generic email sending
    phone.ts                # Phone formatting helpers
    cloudinary.ts           # Cloudinary image helpers
    google-calendar.ts      # Google Calendar API integration
    google-drive.ts         # Google Drive API integration (expense report file ops)
    google-sheets.ts        # Google Sheets API integration
    company-calendar-config.ts  # Calendar event type definitions
    forms-utils.ts          # Form submission helpers
    analytics.ts            # Analytics helpers
    env.ts                  # Environment variable helpers
    slog.ts                 # Structured logging
    promobuillit/api.ts     # Promobuillit/Uducat API client (orders, stores, tracking)
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

**Entities:** Customers, Contacts, Opportunities, Tasks, Tags, Artwork, Vendors, Spec Ideas, Spec Samples

**Task departments:** `CRM | E-Commerce | HR | IT | Accounting | Sales | Warehouse | General`

**Department task boards:**
- `/marketing/tasks` — Marketing/CRM tasks
- `/ecommerce/tasks` — E-Commerce tasks
- `/hr/tasks` — HR tasks
- `/it/tasks` — IT tasks
- `/accounting/tasks` — Accounting tasks
- `/sales/tasks` — Sales tasks
- `/warehouse/tasks` — Warehouse tasks
- `/my-tasks` — cross-department personal view

See `src/lib/task-constants.ts` for `DEPARTMENT_ROUTES` and `ROUTE_TO_DEPARTMENT` maps.

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
- `GET/POST /api/marketing/specs` — spec sample list + create (filters: customer_id, csr_id, status, vendor, month)
- `GET/PUT/DELETE /api/marketing/specs/[id]` — spec sample CRUD
- `GET /api/marketing/specs/stats` — aggregate stats (counts by status)
- `GET/POST /api/marketing/spec-ideas` — spec idea catalog list + create
- `GET/PUT/DELETE /api/marketing/spec-ideas/[id]` — spec idea CRUD
- `POST /api/marketing/spec-ideas/[id]/upload` — upload image to `spec-idea-images` bucket
- `POST /api/marketing/spec-ideas/[id]/fetch-image` — fetch + cache remote image to storage
- `POST /api/marketing/spec-ideas/suggest` — AI-assisted spec idea suggestions

## Spec Samples

Tracks physical samples sent to customers. Two-table system: `spec_ideas` (catalog of products) + `spec_samples` (per-customer send records).

**Tables:** `spec_ideas`, `spec_samples`

**Pages:**
- `/marketing/specs` — spec sample list (filterable by status, CSR, customer, month)
- `/marketing/specs/new` — create new spec sample (wizard-style)
- `/marketing/specs/[id]` — spec sample detail + status tracking
- `/marketing/specs/ideas` — spec idea catalog browser
- `/admin/specs/ideas` — admin spec idea CRUD
- `/admin/specs/ideas/[id]` — admin spec idea editor

**Statuses:** `not_contacted | ordered | in_production | shipped | delivered | approved | declined | no_response`

**Key types:** `SpecSample`, `SpecSampleListItem`, `SpecSampleStatus`, `SpecIdea` in `src/types/index.ts`

**Component:** `src/components/specs/VendorSearch.tsx` — vendor typeahead linked to `crm_vendors`

**Storage bucket:** `spec-idea-images` — public bucket for spec idea product images

**Required DB setup:**
```sql
-- Run supabase/migrations/spec_samples.sql in Supabase SQL editor
-- Also create a PUBLIC bucket named spec-idea-images in Supabase Storage dashboard
```

## Feature Flags

Feature flags control access to in-progress or experimental features.

**Table:** `feature_flags` (key, label, enabled)

**Admin UI:** `/admin/feature-flags` — toggle flags on/off

**API:** `GET/PUT /api/admin/feature-flags/[key]` — admin only

**Usage in components:**
```tsx
import { FeatureFlag } from '@/components/FeatureFlag'
// renders children only when flag is enabled:
<FeatureFlag name="my-feature">...</FeatureFlag>

// or via hook:
import { useFeatureFlags } from '@/components/layout/AppShell'
const flags = useFeatureFlags()
if (flags['my-feature']) { ... }
```

Flags are fetched in AppShell on mount and cached. Adding a new flag requires a row in the `feature_flags` table.

## RBAC / Roles

Fine-grained role-based access control layered on top of the is_admin gate.

**Tables:** `roles` (name, label, description, color), `user_roles` (user_id, role_id), `access_requests`

**How it works:**
- `src/lib/permissions.ts` defines `RESTRICTED_RESOURCES` (maps resource key → required role) and `PRIVATE_BUCKETS` (set of role-gated storage buckets)
- `src/lib/access.ts` provides `hasFileAccess()` and `requiredRoleFor()` helpers
- Admins bypass all role checks; non-admin users need the matching role
- Users request access via `/access-requests/new`; admins approve/deny at `/api/admin/access-requests`
- Approved/denied requests trigger notifications via the Notifications system

**Checking roles in a route handler:**
```ts
// Verify user has a specific role (after auth check):
const { data: userRoles } = await adminClient
  .from('user_roles')
  .select('roles(name)')
  .eq('user_id', dbUser.id)
const hasRole = userRoles?.some(r => (r.roles as any)?.name === 'accounting')
if (!hasRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

**Private file serving:** `GET /api/files/signed-url?bucket=<name>&path=<path>` — verifies role before issuing a 1-hour signed URL. Never link directly to private bucket files.

## Expense Reports

Employee expense report workflow integrated with Google Drive.

**Tables:** `expense_reports`, `expense_report_config`

**Status flow:** `draft` → `submitted` → `needs_changes` | `approved` → `submitted_to_payroll`

**Pages:**
- `/expense-reports` — user's report list
- `/expense-reports/[id]` — report detail (submit, view Drive link)
- `/admin/expense-reports` — admin review queue
- `/admin/expense-reports/[id]` — admin review a specific report

**API routes:**
- `GET/POST /api/expense-reports` — list/create user's reports
- `GET/PUT /api/expense-reports/[id]` — report detail/update
- `POST /api/expense-reports/[id]/drive-action` — Google Drive operations (copy template, share with reviewer, etc.)
- `GET /api/admin/expense-reports` — admin list all reports
- `PUT /api/admin/expense-reports/[id]` — admin sets status + reviewer_comment
- `GET/PUT /api/admin/expense-reports/config` — configure reviewer, template Drive file ID, expense folder ID

**Key types:** `ExpenseReport`, `ExpenseReportConfig`, `ExpenseReportStatus` in `src/types/index.ts`

## E-Commerce / Promobuillit

Promobuillit (a.k.a. Uducat) is the e-commerce platform. Store data and orders are synced to the local DB and displayed in the stores UI.

**Store detail page:** `/stores/[id]` — tabbed interface:
- **Overview** — store info, status, dates
- **Tasks** — CRM tasks linked to this store
- **Team** — team members
- **CRM Links** — linked customers/opportunities
- **Add Tracking** — submit shipment tracking numbers to Promobuillit

**API routes:**
- `GET /api/orders?storeId=...` — order list (paginated, searchable)
- `GET /api/orders/[orderId]` — order detail
- `POST /api/tracking` — add shipment tracking (calls Promobuillit API + sends email)
- `POST /api/admin/stores/sync` — sync store list from Promobuillit
- `GET /api/cron/sync-orders` — Vercel cron job (syncs orders nightly)

**Promobuillit API client:** `src/lib/promobuillit/api.ts` — `listStores()`, `listOrders()`, `fetchOrdersPage()`, `addShipment()`, `sendNotificationEmail()`

**Credentials:** Per-user Promobuillit API credentials stored in `app_credentials`. `CredentialPrompt` component prompts users to configure credentials if missing.

**Key types:** `PromoOrder`, `PromoOrderDetail`, `PromoOrderProduct`, `PromoOrdersResponse` in `src/types/index.ts`

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

## Release Notes

Release notes are managed via an interactive script and stored as JSON.

**Data:** [`src/data/releases.json`](src/data/releases.json)

**Pages:**
- `/releases` — list of all releases with version badges and change counts
- `/releases/[version]` — detailed release page with changes grouped by category

**Release format:**
```json
{
  "version": "0.4.0",           // semantic version
  "date": "2026-05-16",         // YYYY-MM-DD
  "title": "Release Title",     // headline
  "summary": "Brief overview.", // one-line summary
  "changes": [
    {
      "category": "feature",                  // or: improvement, bug_fix, breaking_change
      "description": "What changed"
    }
  ]
}
```

**Creating a release:**
```bash
npm run release
```

The interactive script will:
1. Show commits since the last git tag
2. Prompt for version bump type (patch / minor / major / custom)
3. Ask for release title and summary
4. Let you categorize each commit (feature / improvement / bug_fix / breaking_change / skip)
5. Update `src/data/releases.json` and `package.json`
6. Create a git tag `v{newVersion}`
7. Print instructions for commit and push

**Valid change categories:**
- `feature` — new functionality (shown with ✨)
- `improvement` — enhancements to existing features (shown with ⚡)
- `bug_fix` — bug fixes (shown with 🐛)
- `breaking_change` — breaking changes (shown with ⚠️)

## Context Hooks (client components only)
```ts
import { useAppUser, useStore, useFeatureFlags } from '@/components/layout/AppShell'

const { user } = useAppUser()        // { email, display_name, is_admin, avatar_url, clickup_user_id, department, roles, ... }
const { selectedStore } = useStore() // current e-commerce store
const flags = useFeatureFlags()      // Record<string, boolean> — feature flag state
```

## Styling Conventions
- Use **inline `<style>` tags** in dashboard/admin pages for page-specific styles (not separate CSS files)
- Tailwind utility classes for component-level styling
- Typography plugin loaded via `@plugin "@tailwindcss/typography"` in `globals.css`
- Color theme: **purple** as primary brand color
- **Page containers default to full width** — use `width: '100%'` instead of `maxWidth` for main page containers, allowing content to span full viewport width

## Database Tables
| Table | Purpose |
|---|---|
| `users` | Full user + employee profile (see Employee Directory section) |
| `stores` | E-commerce store config (domain, launch_date, takedown_date, is_active, in_production, last_order_at) |
| `promo_orders` | Cached Promobuillit orders synced via cron |
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
| `roles` | RBAC role definitions (name, label, description, color) |
| `user_roles` | User-to-role assignments |
| `access_requests` | User requests for role access (status: pending/approved/denied) |
| `feature_flags` | Feature flag registry (key, label, enabled) |
| `expense_reports` | Expense reports (period_month, status, drive_file_id, reviewer_comment) |
| `expense_report_config` | Global expense config (reviewer, template Drive file, expense folder) |
| `spec_ideas` | Spec sample product catalog (vendor, item_name, image_urls, tags, ordering instructions) |
| `spec_samples` | Per-customer spec sample send records (status, dates, tracking, linked task) |

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
| `GET/POST /api/expense-reports` | User expense report list + create |
| `GET/PUT /api/expense-reports/[id]` | Expense report detail + update |
| `POST /api/expense-reports/[id]/drive-action` | Google Drive file actions (copy, share, etc.) |
| `GET /api/admin/expense-reports` | Admin expense report list |
| `PUT /api/admin/expense-reports/[id]` | Admin review (status, reviewer_comment) |
| `GET/PUT /api/admin/expense-reports/config` | Expense report global config |
| `GET/PUT /api/admin/feature-flags/[key]` | Enable/disable a feature flag |
| `GET /api/admin/roles` | List all roles |
| `GET/PUT /api/admin/user-roles` | Manage user role assignments |
| `GET /api/admin/access-requests` | List access requests (admin) |
| `PUT /api/admin/access-requests` | Approve or deny an access request |
| `POST /api/access-requests` | User submits a role access request |
| `GET /api/orders` | Promobuillit order list (filtered by store + query) |
| `GET /api/orders/[orderId]` | Promobuillit order detail |
| `POST /api/tracking` | Add shipment tracking to a Promobuillit order |
| `GET /api/files/signed-url` | Issue signed URL for private storage bucket (role-gated) |
| `GET /api/cron/sync-orders` | Vercel cron — sync Promobuillit orders to DB |
| `POST /api/admin/stores/sync` | Manual sync of Promobuillit store list |
| `GET/POST /api/marketing/specs` | Spec sample list + create |
| `GET/PUT/DELETE /api/marketing/specs/[id]` | Spec sample detail CRUD |
| `GET /api/marketing/specs/stats` | Spec sample aggregate stats |
| `GET/POST /api/marketing/spec-ideas` | Spec idea catalog list + create |
| `GET/PUT/DELETE /api/marketing/spec-ideas/[id]` | Spec idea CRUD |
| `POST /api/marketing/spec-ideas/suggest` | AI spec idea suggestions |

## Tiptap Editor
- Use named import: `import { TextStyle } from '@tiptap/extension-text-style'`
- Store `content_json` (Tiptap JSON) and cache `content_html` on save
- `excerpt` and `reading_time_minutes` are auto-computed via `src/lib/news-utils.ts`

## Supabase Storage Buckets
- `banner-images` — public, hero carousel backgrounds (recommended 1440×480px)
- `news-images` — public, article cover images
- `financial-reports` — **private**, role-gated (`accounting` role required); files served via `/api/files/signed-url`
- `hr-documents` — **private**, role-gated (`hr` role required); files served via `/api/files/signed-url`
- `spec-idea-images` — public, spec idea product images

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
- Do not link directly to private storage buckets — always serve via `/api/files/signed-url` with a role check
- Do not hard-code feature availability — check `feature_flags` via `useFeatureFlags()` or query the DB; a flag absent from the table is treated as disabled

## Security Considerations
- **Convenience is not a reason to bypass security.** Shortcuts that skip auth checks, skip permission validation, or circumvent role-based access controls create vulnerabilities even if they work initially.
- **Security shortcuts are tempting when:** you're late in a task, a check seems "obvious," you think "it's just this once," or you want a "quick fix." These are exactly when security shortcuts cause the most damage.
- **Never trade security for speed.** If an auth pattern is documented, use it exactly as written. If a validation check exists, run it in full. If a permission gate is in place, verify it before every sensitive operation.
- **Always follow the documented auth patterns for your project.** For this project: route handler auth pattern, admin layout pattern, and client selection patterns are not suggestions — they are security boundaries.
- **Impersonation boundary:** `realUserIsAdmin` must be checked before any admin action taken while `isImpersonating === true`. Never let an impersonated session gain admin privileges.
