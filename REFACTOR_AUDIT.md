# Arcon Tools App — Architecture & Refactor Audit

_Analysis-only review. No application code was modified. Date: 2026-06-09._

---

## Executive Summary

**Overall health: B-.** The app is functional, internally consistent in many places, and follows sensible Next.js App Router conventions. But it has crossed the size threshold where *accidental complexity* is now compounding: 137 API routes, 66 pages, several 1,000–2,000 line files, and three parallel auth patterns. None of this is broken — but the cost of every new feature is rising because of duplication and oversized files.

The biggest risks are not bugs; they are **velocity and consistency erosion**:

- **No shared formatting / UI-state / API-response layer.** Date, currency, byte, and status-badge formatting are re-implemented inline across dozens of files. Loading/empty/error states are hand-rolled per page.
- **Three different auth/permission patterns** coexist (`requireUser()`, per-file `requireAdmin()`, raw `auth.getUser()`), making security review harder and inconsistent.
- **Mega-files** (`customers/[id]/page.tsx` at 1,956 lines with 46 `useState` and 19 `fetch` calls) mix rendering, data fetching, mutations, modals, and business logic. These are fragile and hard to onboard onto.
- **API surface is granular and page-coupled.** ~520 hand-written error responses, repeated read-only-field stripping in 50+ route files, repeated admin checks.

### Top 5 Recommendations
1. **Extract a shared formatting module** (`lib/format.ts`): date, currency, bytes, relative-time. Lowest risk, touches the most files, immediate consistency win.
2. **Centralize status-badge logic** into `lib/badges.ts` (or per-domain `*-constants.ts`) — currently duplicated across 9+ files with subtly different color maps.
3. **Consolidate API auth** behind a single `requireUser` / `requireAdmin` / `requireRole` helper set in `lib/auth/`, then migrate routes incrementally.
4. **Add an API response/handler helper** (`lib/api/respond.ts` + `withAuth` wrapper) to kill ~520 repeated `NextResponse.json({error}, {status})` lines and the read-only-strip boilerplate.
5. **Decompose `customers/[id]/page.tsx`** into a data hook + section components — the single highest-leverage maintainability win, but do it *after* the shared utilities exist so the extracted pieces reuse them.

---

## Codebase Structure Observations

**Layout** is conventional and readable:
- `src/app/**` — App Router pages + `api/**/route.ts` handlers.
- `src/components/**` — grouped by domain (`crm/`, `news/`, `employees/`, `layout/`, `dashboard/`, `stores/`, `specs/`, `forms/`, `documents/`, `profile/`).
- `src/lib/**` — services & helpers (supabase clients, notifications, auth, promobuillit, permissions, domain constants).
- `src/types/index.ts` — single 1,173-line shared type barrel.

**What's working well:**
- Clean Supabase client separation (`client.ts` / `server.ts` / `admin.ts`) with documented rules.
- Notifications subsystem is well-factored (registry + dispatch + recipients + email + template) — a good model for the rest of the app.
- `lib/task-constants.ts`, `lib/expense-constants.ts`, `lib/permissions.ts`, `lib/access.ts` show the team already knows how to centralize. The pattern just hasn't been applied to formatting/UI/auth.
- One emergent good pattern: `app/stores/[id]/tabs/shared.ts` already extracts `formatDate`, `statusColor`, `todayISO` for one feature — this should be promoted app-wide.

**What's accumulating accidental complexity:**
- **No `src/hooks/` directory** (the `hooks` path is empty). All data-fetching/state logic lives inline in page components → no reuse, no testability.
- **No shared UI primitives** for Loading / Empty / Error / Modal shells. Each page re-creates them.
- **No API helper layer.** Every route re-implements auth check + error JSON + body sanitation.
- **`src/types/index.ts` as a single barrel** — at 1,173 lines it's a merge-conflict magnet and hides which types belong to which feature.
- **Server/client boundary**: pages are nearly all client components (`useState`-heavy) fetching from API routes, rather than using Server Components for initial load. This is a legitimate choice but means *every* page pays the loading-state boilerplate tax.

---

## Key Findings

| # | Finding | Evidence |
|---|---------|----------|
| 1 | Three parallel auth patterns | `lib/crm/require-user.ts` (`requireUser`, 55 routes) vs. inline `requireAdmin()` redefined per file (`app/api/admin/users/route.ts:5`) vs. raw `auth.getUser()` (60 routes) |
| 2 | ~520 hand-written error responses | `grep status: 4xx/500` → 400×172, 401×186, 403×83, 404×78, 500×185 |
| 3 | Read-only-field stripping duplicated | 50+ route files destructure `{ id:_id, created_at:_ca, ... }` before update (e.g. `customers/[id]/route.ts:75`) |
| 4 | Status-badge color maps duplicated | 9 files: `customers/[id]`, `opportunities/[id]`, `opportunities/page`, `marketing/page`, `stores/.../AddTrackingTab`, `stores/.../shared.ts`, `tasks/[id]`, `TaskTableView`, `DashboardTasksWidget` |
| 5 | No shared formatters | `formatBytes` only in customers page; `toLocaleDateString` in 25 files; money formatting ~103 sites; `formatDate` re-defined in `stores/.../shared.ts` |
| 6 | Mega-files | `customers/[id]/page.tsx` 1,956 LOC / 46 `useState` / 6 `useEffect` / 19 `fetch`; also `tasks/[id]` 1,395, `documents/[section]` 1,395, `expense-reports/[id]/edit` 1,195, `specs/new` 1,145, `opportunities/[id]` 1,033 |
| 7 | `createAdminClient` in 134/137 routes | Bypasses RLS broadly; correct per project docs, but means auth correctness rests entirely on the hand-rolled checks in finding #1 |
| 8 | Inline modals in pages | Artwork-upload + add-contact modals are inlined in `customers/[id]/page.tsx` (lines ~1688, ~1786) rather than reusable modal components |
| 9 | `fetch + setLoading(false)` pattern | 45 files repeat the same load/loading/error scaffolding |
| 10 | `src/types/index.ts` monolith | 1,173 lines, single import target for all features |

---

## Duplication Analysis

| Duplication area | Files involved | Current problem | Recommended abstraction | Target location | Effort | Risk | Payoff |
|---|---|---|---|---|---|---|---|
| Date formatting | 25 files using `toLocaleDateString`; `stores/.../shared.ts:formatDate` | Inconsistent formats, copy-paste | `formatDate`, `formatDateTime`, `formatRelative` | `lib/format.ts` | S | Low | High |
| Currency formatting | ~103 money sites across marketing/stores/expense | Inconsistent `$`/`toLocaleString` | `formatCurrency(cents/number)` | `lib/format.ts` | S | Low | High |
| Byte formatting | `customers/[id]/page.tsx:366` | One-off, will be re-needed | `formatBytes` | `lib/format.ts` | XS | Low | Med |
| Status badge colors | 9 files (see Finding #4) | Divergent color maps for same statuses | `badgeClass(domain, status)` + maps | `lib/badges.ts` (or per `*-constants.ts`) | S | Low→Med | High |
| Loading/empty/error UI | 45 files w/ `setLoading` | Re-built per page | `<LoadingState/>`, `<EmptyState/>`, `<ErrorState/>`, `<AsyncBoundary/>` | `components/ui/` | M | Low | High |
| Client fetch+state | 45 files | No reuse/testability | `useApiResource(url)` / per-entity hooks | `src/hooks/` | M | Med | High |
| API auth check | 115 routes (55 `requireUser` + 60 raw) | 3 patterns, security drift | Unify `requireUser`/`requireAdmin`/`requireRole` + `withAuth()` | `lib/auth/` + `lib/api/` | M | Med | High |
| API error responses | ~520 sites | Verbose, inconsistent shapes | `ok()`, `fail(status,msg)`, `unauthorized()` | `lib/api/respond.ts` | S→M | Low | Med |
| Read-only field strip | 50+ routes | Copy-pasted destructure | `stripReadOnly(body, extra[])` | `lib/api/sanitize.ts` | S | Med | Med |
| Modal shell | inline in pages + `components/*Modal.tsx` | Inconsistent modal markup | `<Modal>` shell component | `components/ui/Modal.tsx` | M | Med | Med |
| Tag fan-out (entity_tags) | `lib/crm/tags.ts` exists but PATCH handlers re-inline delete+insert (`customers/[id]/route.ts:81`) | Partial extraction | Route handlers should call `tags.ts` helpers | `lib/crm/tags.ts` (exists) | S | Low | Med |
| Feature types | `src/types/index.ts` (1,173 LOC) | Monolith barrel | Split into `types/{crm,expense,store,...}.ts`, re-export | `src/types/` | M | Med | Med |

---

## `customers/[id]/page.tsx` Refactor Plan

### Current responsibilities (all in one 1,956-line client component)
- **Data fetching**: 19 `fetch` calls — customer, users list, tags, artwork, specs, brand data, contacts, opportunities, files.
- **Local state**: 46 `useState` (edit form, editing flag, modal toggles, artwork upload, vectorize IDs, tax state, errors…).
- **Mutations**: customer PATCH, add-contact, artwork upload + vectorize, tag updates.
- **Rendering**: header, edit/view toggle for every field, billing/shipping addresses, notes, tax section, contacts list, opportunities list, files, artwork grid, specs list.
- **Inline modals**: artwork upload (~line 1688), quick-create contact (~line 1786), plus the imported `CreateTaskModal`.
- **Formatting/business logic**: `SocialIcon`, `buildCompanySummary`, `STATUS_BADGE`, `OPP_STATUS_BADGE`, `Field`, `FieldInput`, `formatBytes` — all defined in-file.

### Problems caused by the size
- Any change risks unrelated regressions (46 interdependent states).
- Impossible to unit-test pieces in isolation.
- High merge-conflict probability — multiple devs editing one file.
- New devs must read 2,000 lines to make a small edit.

### Proposed decomposition

**Hooks (data + mutations):**
- `useCustomer(id)` → customer + related (contacts, opps, files, stores, brand_data, tags); exposes `refetch`.
- `useCustomerEdit(customer)` → edit form state, `startEdit/cancelEdit/handleChange/save`.
- `useArtwork(customerId)` → list, upload, vectorize, delete.
- `useCrmUsers()`, `useCrmTags()` → shared lookups (reused by other CRM pages).

**Section components (`components/crm/customer/`):**
- `CustomerHeader.tsx`, `CustomerDetailsCard.tsx` (view/edit fields), `CustomerAddressCard.tsx`, `CustomerTaxSection.tsx`, `CustomerContactsList.tsx`, `CustomerOpportunitiesList.tsx`, `CustomerFilesList.tsx`, `CustomerArtworkGrid.tsx`, `CustomerSpecsList.tsx`.

**Shared primitives (used here + everywhere):**
- `Field`, `FieldInput` → `components/ui/Field.tsx`.
- `SocialIcon` → `components/ui/SocialIcon.tsx`.
- `formatBytes` → `lib/format.ts`. Badge maps → `lib/badges.ts`.
- Artwork-upload & add-contact modals → `components/crm/*Modal.tsx` using `components/ui/Modal.tsx` shell.

### Suggested file structure
```
app/marketing/customers/[id]/page.tsx        # orchestration only (~150 LOC)
hooks/useCustomer.ts
hooks/useCustomerEdit.ts
hooks/useArtwork.ts
hooks/useCrmUsers.ts
hooks/useCrmTags.ts
components/crm/customer/CustomerHeader.tsx
components/crm/customer/CustomerDetailsCard.tsx
components/crm/customer/CustomerAddressCard.tsx
components/crm/customer/CustomerTaxSection.tsx
components/crm/customer/CustomerContactsList.tsx
components/crm/customer/CustomerOpportunitiesList.tsx
components/crm/customer/CustomerFilesList.tsx
components/crm/customer/CustomerArtworkGrid.tsx
components/crm/customer/AddContactModal.tsx
components/crm/customer/ArtworkUploadModal.tsx
```

### Step-by-step incremental plan (each step independently shippable)
1. **Extract pure helpers** (`formatBytes`, badge maps, `SocialIcon`, `buildCompanySummary`, `Field`, `FieldInput`) to `lib/`/`components/ui/`. Zero behavior change. **(Low risk)**
2. **Extract `useCustomer(id)` hook** — move all read fetches; page consumes hook. **(Low–Med)**
3. **Extract presentational section components** one at a time (start with read-only lists: files, opportunities, contacts). **(Low)**
4. **Extract modals** (`AddContactModal`, `ArtworkUploadModal`) + their state into `useArtwork`. **(Med)**
5. **Extract `useCustomerEdit`** (the editing state machine — highest coupling). **(Med–High, do last)**

### Tests needed
- **Before**: a Playwright smoke test of `/marketing/customers/[id]` — load, edit a field + save, add a contact, upload artwork, navigate to a related opportunity. This is the regression net.
- **After each step**: re-run smoke test + `npm run build` + type-check. Unit tests on extracted pure helpers (`formatBytes`, badge maps).

---

## API Route Audit

**Scale:** 137 routes / 66 pages (>2:1). Granularity itself is acceptable for REST-style resources, but the *implementation* is duplicated.

### Duplicative / consolidation candidates
- **Comments + attachments sub-trees** under `marketing/tasks/[id]/comments/[cid]/attachments/[aid]` and `expense-reports/[id]/comments/[commentId]/resolve` are deeply nested and near-identical in shape (comment CRUD + resolve + attachments). A shared comment/attachment service module could back both.
- **`documents/manage/*`** has 15 routes (folders, items, permissions, move, replace, reorder, access-summary…). Many are thin wrappers; some could merge (e.g. `permissions` + `access-summary` + `permissions-summary`). Verify caller usage before merging — these are permission-sensitive.
- **`public/*`** (lure-order, product-showcase, checkin, checkin-count, sales-employees) repeat unauth + validation + insert patterns; share a `lib/public/` validation+insert helper.
- **`*/upload` routes** (`banner/upload`, `news/upload`, `employees/upload`, `marketing/upload`, `marketing/artwork/upload`, `forms/[id]/upload`, `profile/upload-photo`, `spec-ideas/[id]/upload`, `documents/manage/upload`) — 9 near-identical Supabase Storage upload handlers. Extract `lib/storage/upload.ts(bucket, file, opts)`.

### Candidates for shared handlers/services
- **`withAuth(handler, {admin?, role?})`** wrapper to replace the per-route auth preamble.
- **`lib/api/respond.ts`** — `ok(data)`, `created(data)`, `fail(status, msg)`, `unauthorized()`, `forbidden()`, `notFound()`.
- **`lib/api/sanitize.ts`** — `stripReadOnly(body, extraKeys)` for the 50+ PATCH/PUT routes.
- **`lib/storage/upload.ts`** — unify the 9 upload routes.
- **`lib/crm/tags.ts`** already exists — route handlers should call it instead of re-inlining `crm_entity_tags` delete+insert.

### Auth / validation / error inconsistencies
- **Auth**: `requireUser()` (CRM) vs. per-file `requireAdmin()` (admin) vs. raw `auth.getUser()` (mixed). Unify so security review has one surface.
- **Validation**: ad-hoc per route; no shared schema layer (no zod observed). Consider introducing zod *only* at public/untrusted boundaries first.
- **Errors**: inconsistent shapes (`{error: string}` vs `{error: error.message}`); centralize.

### Reducing surface area safely
Do **not** delete routes wholesale. Instead: (1) unify the *implementation* behind shared helpers (invisible to callers), then (2) only merge endpoints where a single page is the sole caller and the merge is trivial. API contracts consumed by multiple pages (tasks, customers, notifications) must stay stable.

---

## Prioritized Action Plan

| # | Action | Why it matters | Files affected | Refactor risk | Risk of not doing | Effort | Suggested first step |
|---|--------|----------------|----------------|---------------|-------------------|--------|----------------------|
| 1 | Create `lib/format.ts` (date/currency/bytes/relative) | Consistency + reused everywhere | new file; opt-in callers | Low | Inconsistent UX, ongoing copy-paste | S | Write fns + migrate `stores/.../shared.ts` + customers page |
| 2 | Create `lib/badges.ts` + migrate 9 files | Status colors diverge today | 9 page/component files | Low–Med | Visual inconsistency, status bugs | S | Define canonical maps, swap one file |
| 3 | `components/ui/` Loading/Empty/Error/Modal | Kills 45-file boilerplate | new files; opt-in | Low | Slower pages, inconsistent states | M | Build primitives, adopt in 1 page |
| 4 | Unify API auth (`requireUser`/`requireAdmin`/`requireRole` + `withAuth`) | Security review surface | `lib/auth`, `lib/api`, routes | Med | Auth drift = vulnerability | M | Add helpers, migrate admin routes first |
| 5 | `lib/api/respond.ts` + `sanitize.ts` | ~520 error sites + 50 strips | route files | Low–Med | Verbose, inconsistent API | S→M | Add helpers, migrate marketing routes |
| 6 | Decompose `customers/[id]/page.tsx` | Largest fragile file | 1 page → ~12 files | Med–High | Regressions, slow onboarding | L | Write smoke test, extract pure helpers |
| 7 | `lib/storage/upload.ts` unify 9 upload routes | Duplicated storage logic | 9 routes | Med | Upload bugs multiply | M | Extract, migrate one upload route |
| 8 | Extract data hooks to `src/hooks/` | Testable, reusable fetches | new dir; pages | Med | No reuse, fragile pages | M | Start with `useCrmUsers`/`useCrmTags` |
| 9 | Split `types/index.ts` into per-feature files | Merge conflicts | 1 file → many; re-export | Med | Conflicts, unclear ownership | M | Split + barrel re-export (no import churn) |
| 10 | Decompose other mega-files (`tasks/[id]`, `documents/[section]`, `expense-reports/[id]/edit`) | Same problem as #6 | per file | Med–High | Fragility | L–XL | Apply #6 pattern after it proves out |

---

## Quick Wins (low-risk, high-impact, do first)
1. `lib/format.ts` — date/currency/bytes/relative-time. (Action #1)
2. `lib/badges.ts` — canonical status→class maps. (Action #2)
3. Promote `app/stores/[id]/tabs/shared.ts` helpers into the new `lib/format.ts`/`lib/badges.ts`, then re-export for back-compat.
4. `lib/api/respond.ts` — `ok()/fail()/unauthorized()/forbidden()/notFound()`.
5. `components/ui/{LoadingState,EmptyState,ErrorState}.tsx`.
6. Extract pure helpers out of `customers/[id]/page.tsx` (`formatBytes`, `Field`, `FieldInput`, `SocialIcon`) — pure moves, no behavior change.
7. Make CRM PATCH routes call existing `lib/crm/tags.ts` instead of re-inlining tag fan-out.
8. Split `types/index.ts` with a re-export barrel (no consumer import changes).

## High-Risk Refactors (caution / staged rollout / tests first)
- **API auth unification (#4)** — security boundary. Migrate route-by-route, diff each, keep `createAdminClient` only after the unified check. Never let an impersonated session reach an admin gate (`realUserIsAdmin`).
- **`customers/[id]/page.tsx` edit state (`useCustomerEdit`)** — 46 interdependent states; extract last, behind a smoke test.
- **`documents/manage/*` route merges** — permission-sensitive; verify all callers first.
- **Storage upload unification (#7)** — bucket/path/permission differences per bucket; preserve each bucket's access rules.
- **`types/index.ts` split** — risk of import breakage; mitigate with a re-export barrel.
- **Notifications & promobuillit** — business-critical, externally-coupled (email, Uducat API); leave structure alone, only reuse.

---

## Recommended Target Architecture (incremental, not a rewrite)

```
src/
  app/                      # pages = orchestration only; api routes = thin handlers
  components/
    ui/                     # NEW: Modal, Field, LoadingState, EmptyState, ErrorState, Badge, SocialIcon
    crm/customer/           # NEW: feature-specific section components
    <feature>/              # existing domain component groups
  hooks/                    # NEW: useCustomer, useArtwork, useCrmUsers, useApiResource ...
  lib/
    format.ts               # NEW: date/currency/bytes/relative
    badges.ts               # NEW: status -> class maps
    api/
      respond.ts            # NEW: ok/fail/unauthorized/...
      sanitize.ts           # NEW: stripReadOnly
      with-auth.ts          # NEW: handler wrapper
    auth/                    # unified requireUser/requireAdmin/requireRole
    storage/upload.ts       # NEW: unified bucket upload
    <domain services>       # notifications/, promobuillit/, crm/ (keep)
  types/
    index.ts                # re-export barrel
    crm.ts / expense.ts / store.ts / ...   # NEW: per-feature
```

**Placement rules:**
- Reusable, domain-agnostic UI → `components/ui/`.
- Feature-specific UI → `components/<feature>/`.
- Anything with `fetch` + state → a hook in `src/hooks/`.
- Server-only data access / business logic → `lib/<domain>/` services (route handlers stay thin).
- Pure transforms/formatting → `lib/format.ts` / `lib/badges.ts`.
- Validation schemas → co-locate per feature; introduce at public boundaries first.

Keep it gradual: every new helper is **opt-in**. Old code keeps working until migrated.

---

## Testing & Safety Checklist

**Before any refactor:**
- [ ] Confirm `npm run build` + `npm run lint` are green on a clean `main`.
- [ ] Add Playwright smoke tests for the top fragile flows: customer detail (view/edit/save, add contact, artwork upload), task detail, expense-report edit, document section.
- [ ] Type-check passes (`tsc --noEmit`).

**During (per PR):**
- [ ] One concern per PR; pure moves separated from behavior changes.
- [ ] Re-run build + lint + type-check + smoke tests each PR.
- [ ] For auth PRs: manually verify a non-admin is blocked, an admin passes, and impersonation cannot reach admin gates.

**After:**
- [ ] Unit tests on extracted pure helpers (`format.ts`, `badges.ts`, `sanitize.ts`).
- [ ] Manual QA checklist run on each migrated page.
- [ ] Visual diff on badge/format changes (colors/date formats must match prior output unless intentionally normalized).

**Git strategy:** small, reviewable, single-purpose PRs off `main`; never `--no-verify`; each PR independently revertible. _User runs all builds/tests per project policy._

---

## Final Recommendations — First 3 Refactors

1. **`lib/format.ts` + `lib/badges.ts`** (Quick Wins #1–2). Tiny, low-risk, touches the most files, and creates the foundation every later extraction reuses.
2. **`components/ui/` state primitives + `lib/api/respond.ts`** (Quick Wins #4–5). Removes the heaviest boilerplate tax from pages and routes.
3. **Decompose `customers/[id]/page.tsx`** (Action #6) — *after* 1 & 2 exist, so extracted components reuse the new utilities. Gate it behind a smoke test; extract pure helpers → read hooks → section components → edit state, in that order.

Then prove the pattern, and apply the same decomposition recipe to the other mega-files (`tasks/[id]`, `documents/[section]`, `expense-reports/[id]/edit`).
