# Refactor Execution Plan

**Audience:** an implementation LLM (Haiku/Sonnet) executing the refactor in `REFACTOR_AUDIT.md` / `REFACTOR_TASKS.md`.
**Project:** Arcon Tools App — Next.js 16 App Router, React 19, TypeScript 5, Tailwind v4, Supabase.

---

## How to use this document

- Execute **one task at a time**, in the order given. Do not batch unrelated tasks.
- Each task lists: **Prereqs**, **Goal**, **Files**, **Steps**, **Code**, **Verify**, **Done when**, **Rollback**.
- **Pure moves vs. behavior changes:** never mix them in one commit. If a step says "no behavior change," the rendered output / API response must be byte-identical.
- After every task: stop and report. **Do NOT run `npm run build`, `npm run lint`, `npm run dev`, or any test command** — per project policy (`CLAUDE.md`), the user runs all builds and tests. Your job is the code change + a written "what to verify" note.
- **Read every file immediately before editing it.** No exceptions.
- Follow existing code style in each file (indentation, quotes, naming). Match surrounding code.
- Never use `--no-verify`, `--force`, or skip auth/permission checks. Auth is a security boundary.
- **When a task is complete, edit this file and change `- [ ]` to `- [x]` on that task's heading line.** Do this before moving to the next task.

### Hard rules (from CLAUDE.md — do not violate)
- Tailwind v4: use `@plugin` in `globals.css`, never `tailwind.config.js`.
- Supabase clients: `server.ts` (`createClient`) for auth in route handlers/server components; `admin.ts` (`createAdminClient`) for DB writes **only after auth verified**; `client.ts` for client components.
- Admin check uses `google_id`: `adminClient.from('users').select('is_admin').eq('google_id', user.id)`.
- Never call `createAdminClient()` before verifying the user is authenticated.
- `getEffectiveUser()` resolves impersonation but does NOT replace the `is_admin` gate.

---

## Dependency graph

```
PHASE A (foundations, parallel-safe)
  A1 lib/format.ts ─────────────┐
  A2 lib/badges.ts ─────────────┤
  A3 components/ui states ──────┤
  A4 lib/api/respond.ts ────────┤
                                 │
PHASE B (depends on A)           │
  B1 lib/api/sanitize.ts ........(independent, but land after A4 for consistency)
  B2 migrate marketing routes -> respond.ts + sanitize.ts   (needs A4, B1)
  B3 lib/crm tags reuse         (independent)
  B4 components/ui/Modal.tsx + Field/FieldInput/SocialIcon   (needs A3)
  B5 src/hooks/ (useCrmUsers, useCrmTags, useApiResource)    (independent)
  B6 lib/storage/upload.ts + migrate uploads                 (independent)
  B7 split types/index.ts                                    (independent)

PHASE C (safety net — MUST land before Phase D)
  C1 Playwright smoke tests for fragile flows

PHASE D (customers page decomposition — STRICT ORDER, needs A1,A2,B4,B5,C1)
  D1 extract pure helpers -> D2 useCustomer hook -> D3 read sections
   -> D4 modals + useArtwork -> D5 useCustomerEdit (last)

PHASE E (replicate D recipe to other mega-files — needs D complete)
  E1 tasks/[id]  E2 documents/[section]  E3 expense-reports/[id]/edit
  E4 specs/new   E5 opportunities/[id]

PHASE F (high-risk, staged — needs A4; do AFTER B/C stable)
  F1 unified auth helpers -> F2 migrate admin routes -> F3 migrate raw getUser routes

PHASE G (API consolidation — verify callers first; needs F stable)
  G1 documents/manage merges  G2 comment/attachment service  G3 public/* helper
```

**Critical ordering constraints:**
- Phase D cannot start until **C1** (smoke tests) exists.
- D-tasks are strictly sequential; D5 is last (highest coupling).
- Phase F (auth) is security-sensitive — migrate route-by-route, never in bulk.
- Phase G merges routes — verify all callers before touching.

---

# PHASE A — Foundations

## - [x] A1 — Create `lib/format.ts`

**Prereqs:** none.
**Goal:** single home for date/currency/bytes/relative formatting. No behavior change to callers yet (callers migrate later).

**Files:** create `src/lib/format.ts`. Edit `src/app/stores/[id]/tabs/shared.ts` (re-export). Edit `src/app/marketing/customers/[id]/page.tsx` (remove local `formatBytes`, import).

**Steps:**
1. Create `src/lib/format.ts` with the functions below. Match the existing behavior of `formatDate` in `app/stores/[id]/tabs/shared.ts` exactly (en-US, `month short / day numeric / year numeric`, `—` fallback).
2. In `shared.ts`, replace the local `formatDate` and `todayISO` bodies with re-exports from `lib/format.ts` (keep the same exported names so existing imports keep working).
3. In `customers/[id]/page.tsx`, delete the local `formatBytes` function (~line 366) and import from `lib/format.ts`. Verify the output format is identical before deleting.

**Code (`src/lib/format.ts`):**
```ts
export function formatDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function formatRelative(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  const diffMs = Date.now() - d.getTime()
  const sec = Math.round(diffMs / 1000)
  const min = Math.round(sec / 60)
  const hr = Math.round(min / 60)
  const day = Math.round(hr / 24)
  if (sec < 60) return 'just now'
  if (min < 60) return `${min}m ago`
  if (hr < 24) return `${hr}h ago`
  if (day < 30) return `${day}d ago`
  return formatDate(s)
}

// Pass a plain dollar amount (number). Adjust if any caller stores cents — verify per call site.
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '—'
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || isNaN(bytes)) return '—'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}
```
> Before deleting the existing `formatBytes` in the customers page, copy its exact logic. If it differs from above, keep the customers-page version's behavior in `lib/format.ts` instead. **Do not change output.**

**Verify (note for user):** Customer detail file sizes still render identically. Store tabs dates unchanged.
**Done when:** `lib/format.ts` exists; `shared.ts` re-exports; customers page imports `formatBytes`; no local duplicates remain.
**Rollback:** delete `lib/format.ts`, restore the two edited files.

---

## - [x] A2 — Create `lib/badges.ts` and migrate badge maps

**Prereqs:** none (independent of A1).
**Goal:** one canonical status→Tailwind-class mapping per domain. **Visual output must not change** unless a divergence is intentional (if two files disagree on a color, pick one, note it for the user).

**Files:** create `src/lib/badges.ts`. Migrate (one at a time, can be sub-commits): `customers/[id]/page.tsx`, `opportunities/[id]/page.tsx`, `marketing/opportunities/page.tsx`, `marketing/page.tsx`, `tasks/[id]/page.tsx`, `components/crm/TaskTableView.tsx`, `components/dashboard/DashboardTasksWidget.tsx`, `stores/[id]/tabs/shared.ts`, `stores/[id]/tabs/AddTrackingTab.tsx`.

**Steps:**
1. Open each listed file, find the local badge/status color map (`STATUS_BADGE`, `OPP_STATUS_BADGE`, `statusColor`, etc.). Record each map verbatim.
2. Build `src/lib/badges.ts` with one function/map per domain, reproducing existing classes exactly.
3. **If two files map the same status to different classes**, do NOT silently merge — list the conflict in your handoff note and pick the most common variant; flag for user confirmation.
4. Replace each local map with an import + call. Keep `stores/.../shared.ts`'s `statusColor` as a re-export for back-compat.

**Code skeleton (`src/lib/badges.ts`):**
```ts
// Each map returns Tailwind classes. Values copied verbatim from existing files — do not invent colors.
const FALLBACK = 'bg-slate-100 text-slate-600'

export function customerStatusBadge(status: string | null | undefined): string { /* from customers/[id] STATUS_BADGE */ return FALLBACK }
export function opportunityStatusBadge(status: string | null | undefined): string { /* from OPP_STATUS_BADGE */ return FALLBACK }
export function taskStatusBadge(status: string | null | undefined): string { /* from TaskTableView/DashboardTasksWidget */ return FALLBACK }
export function storeStatusBadge(status: string | null | undefined): string { /* from stores shared.ts statusColor */ return FALLBACK }
```
> Fill each body from the actual maps you recorded in step 1. Do not guess.

**Verify (note for user):** spot-check each migrated page — badge colors identical to before.
**Done when:** no local status-color maps remain in the listed files; all import from `lib/badges.ts`.
**Rollback:** restore files; delete `lib/badges.ts`.

---

## - [x] A3 — Create `components/ui/` async state primitives

**Prereqs:** none.
**Goal:** reusable Loading/Empty/Error components. Additive only — adopt in ONE page as proof; do not mass-migrate yet.

**Files:** create `src/components/ui/LoadingState.tsx`, `EmptyState.tsx`, `ErrorState.tsx`. Adopt in one simple page (suggest `src/app/marketing/specs/page.tsx`).

**Code (`LoadingState.tsx`):**
```tsx
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-purple-600" />
      <span>{label}</span>
    </div>
  )
}
```
```tsx
// EmptyState.tsx
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-16 text-center text-slate-500">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-400">{hint}</p>}
    </div>
  )
}
```
```tsx
// ErrorState.tsx
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="py-16 text-center text-red-600">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100">
          Retry
        </button>
      )}
    </div>
  )
}
```
> Match the project's existing spinner/empty markup if one is more common — grep `animate-spin` first and copy the prevailing style so adoption looks native.

**Verify (note for user):** the one adopted page shows the same loading/empty/error UX as before.
**Done when:** 3 components exist; 1 page uses them.
**Rollback:** revert the page; delete the 3 files.

---

## - [x] A4 — Create `lib/api/respond.ts`

**Prereqs:** none.
**Goal:** standard API response helpers. Additive — migrate callers in B2.

**Files:** create `src/lib/api/respond.ts`.

**Code:**
```ts
import { NextResponse } from 'next/server'

export const ok = <T>(data: T) => NextResponse.json(data)
export const created = <T>(data: T) => NextResponse.json(data, { status: 201 })
export const fail = (status: number, error: string) => NextResponse.json({ error }, { status })
export const unauthorized = () => fail(401, 'Unauthorized')
export const forbidden = () => fail(403, 'Forbidden')
export const notFound = (what = 'Not found') => fail(404, what)
export const badRequest = (msg = 'Bad request') => fail(400, msg)
export const serverError = (msg = 'Internal error') => fail(500, msg)
```
> Match the existing error JSON shape exactly: the app uses `{ error: string }`. Do not change the shape.

**Verify (note for user):** none yet (additive).
**Done when:** file exists.
**Rollback:** delete file.

---

# PHASE B — Structural (after A)

## - [x] B1 — Create `lib/api/sanitize.ts`

**Prereqs:** A4 (for consistency in same area).
**Goal:** one `stripReadOnly` helper to replace the per-route destructure-and-drop pattern (50+ routes).

**Files:** create `src/lib/api/sanitize.ts`.

**Code:**
```ts
const DEFAULT_READONLY = ['id', 'created_at', 'updated_at', 'created_by'] as const

/** Remove read-only + caller-specified keys from a request body before an update. */
export function stripReadOnly<T extends Record<string, unknown>>(
  body: T,
  extraKeys: string[] = [],
): Partial<T> {
  const drop = new Set<string>([...DEFAULT_READONLY, ...extraKeys])
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (!drop.has(k)) out[k] = v
  }
  return out as Partial<T>
}
```
**Done when:** file exists.
**Rollback:** delete file.

---

## - [x] B2 — Migrate marketing API routes to `respond.ts` + `sanitize.ts`

**Prereqs:** A4, B1.
**Goal:** replace inline error JSON and read-only strips in `src/app/api/marketing/**` route files. **No behavior change** — same status codes, same response shapes.

**Files:** all `route.ts` under `src/app/api/marketing/`. Do in small sub-batches (e.g. customers, then contacts, then opportunities, then tasks).

**Steps (per file):**
1. Read the file.
2. Replace `return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` → `return unauthorized()` (and the 403/404/400/500 equivalents).
3. Replace the read-only destructure (`const { id:_id, created_at:_ca, ... ...updates } = body`) with `const updates = stripReadOnly(body, ['tag_ids', 'tags', 'assigned_user', ...])` — **carefully preserve which keys each route extracts separately** (e.g. `tag_ids` is used, not dropped, in `customers/[id]/route.ts`). Extract those explicitly BEFORE calling `stripReadOnly`, then pass them in `extraKeys`.
4. Keep all status codes identical to the original.

> ⚠️ `customers/[id]/route.ts` uses `tag_ids` after stripping. Pattern: `const { tag_ids } = body; const updates = stripReadOnly(body, ['tag_ids','tags','assigned_user','created_by_user','contacts','opportunities','files','brand_data'])`. Verify the dropped-key list matches the original destructure for each route.

**Verify (note for user):** GET/POST/PATCH/DELETE each migrated entity; responses + status codes unchanged.
**Done when:** marketing routes use helpers; no inline `{error}` JSON or manual strips remain there.
**Rollback:** revert per sub-batch (each is its own commit).

---

## - [x] B3 — Reuse `lib/crm/tags.ts` in route handlers

**Prereqs:** none.
**Goal:** CRM PATCH routes that inline `crm_entity_tags` delete+insert should call existing helpers in `lib/crm/tags.ts`.

**Files:** `src/app/api/marketing/{customers,contacts,opportunities,vendors}/[id]/route.ts` (any that inline tag fan-out).
**Steps:** find the inline `delete().eq('entity_type',...)` + `insert(...)` block; replace with the appropriate exported helper from `lib/crm/tags.ts` (`applyEntityTag` / and add a `setEntityTags(adminClient, entityType, entityId, tagIds)` helper there if a bulk-replace helper doesn't exist — check first, add only if missing).
**Verify:** tag add/remove on each entity still persists.
**Done when:** no inline `crm_entity_tags` delete+insert in route handlers.
**Rollback:** revert files.

---

## - [x] B4 — `components/ui/Modal.tsx` + extract `Field`/`FieldInput`/`SocialIcon`

**Prereqs:** A3.
**Goal:** reusable modal shell + extract the pure presentational helpers currently inside `customers/[id]/page.tsx`.

**Files:** create `src/components/ui/Modal.tsx`, `src/components/ui/Field.tsx` (export `Field` + `FieldInput`), `src/components/ui/SocialIcon.tsx`. Edit `customers/[id]/page.tsx` to import them.
**Steps:**
1. Copy `Field`, `FieldInput` (lines ~130, ~146) and `SocialIcon` (~line 59) **verbatim** into `components/ui/`. No logic changes.
2. Create a `Modal` shell matching the existing inline modal markup in the customers page (overlay + centered card + close button).
3. Update customers page imports; delete the local definitions.
**Verify:** customer detail renders identically; fields edit identically.
**Done when:** helpers live in `components/ui/`; customers page imports them.
**Rollback:** restore page; delete new files.

---

## - [x] B5 — Create `src/hooks/` with shared data hooks

**Prereqs:** none.
**Goal:** reusable fetch hooks. Start with the lookups used by multiple CRM pages.

**Files:** create `src/hooks/useApiResource.ts`, `src/hooks/useCrmUsers.ts`, `src/hooks/useCrmTags.ts`.

**Code (`useApiResource.ts`):**
```ts
'use client'
import { useCallback, useEffect, useState } from 'react'

export function useApiResource<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(!!url)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!url) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => { void refetch() }, [refetch])
  return { data, loading, error, refetch, setData }
}
```
```ts
// useCrmUsers.ts  — replaces the inline fetch('/api/marketing/users') in customers page etc.
'use client'
import { useApiResource } from './useApiResource'
export interface CrmUserLite { id: string; display_name: string | null; email: string }
export function useCrmUsers() { return useApiResource<CrmUserLite[]>('/api/marketing/users') }
```
```ts
// useCrmTags.ts
'use client'
import { useApiResource } from './useApiResource'
export interface CrmTagLite { id: string; name: string; color: string }
export function useCrmTags() { return useApiResource<CrmTagLite[]>('/api/marketing/tags') }
```
> Confirm the actual response shapes of `/api/marketing/users` and `/api/marketing/tags` before finalizing the generic type (some endpoints wrap data in `{ data: [...] }`). Adjust types to match reality.
**Verify:** none yet (additive). Adoption happens in D2.
**Done when:** 3 hooks exist.
**Rollback:** delete `src/hooks/`.

---

## - [ ] B6 — `lib/storage/upload.ts` + migrate upload routes

**Prereqs:** none. **Risk: Medium** (per-bucket access rules differ).
**Goal:** unify the 9 near-identical Supabase Storage upload handlers.

**Files:** create `src/lib/storage/upload.ts`. Migrate one at a time: `admin/banner/upload`, `admin/news/upload`, `admin/employees/upload`, `marketing/upload`, `marketing/artwork/upload`, `forms/[id]/upload`, `profile/upload-photo`, `marketing/spec-ideas/[id]/upload`, `documents/manage/upload`.

**Steps:**
1. Read all 9 routes. Note differences: bucket name, path convention, content-type handling, public vs. signed-URL response, auth/role gating.
2. Build a helper that takes `{ bucket, path, file, contentType?, upsert? }` and returns the stored path / public URL. **Keep auth and role checks in the route handler** — do NOT move auth into the helper.
3. Migrate routes one per commit. Preserve each route's exact response shape and access rules. Private buckets (`financial-reports`, `hr-documents`) keep their role gate and signed-URL flow — never return a public URL for them.

> ⚠️ Do not change which buckets are public vs private. `banner-images`, `news-images`, `spec-idea-images` are public; `financial-reports`, `hr-documents` are private/role-gated. Verify each before migrating.

**Verify:** upload to each bucket; correct URL/path returned; private buckets still role-gated.
**Done when:** routes share the helper; behavior identical.
**Rollback:** revert per route.

---

## - [ ] B7 — Split `src/types/index.ts` with re-export barrel

**Prereqs:** none. **Risk: Medium** (import breakage).
**Goal:** split the 1,173-line type barrel into per-feature files; keep `index.ts` re-exporting everything so **no consumer imports change**.

**Files:** create `src/types/{crm,expense,store,notification,employee,spec,common}.ts` (group by domain). Edit `src/types/index.ts` to re-export.
**Steps:**
1. Read `index.ts`. Group types by feature.
2. Move each group to its file. Keep type names identical.
3. In `index.ts`: `export * from './crm'` etc. for every new file.
4. Resolve any cross-file type references with imports between the new files.
**Verify (note for user):** type-check passes (`tsc --noEmit`); no import path changed anywhere else.
**Done when:** `index.ts` is only re-exports; types live in per-feature files.
**Rollback:** restore `index.ts`; delete new files.

---

# PHASE C — Safety net (BEFORE Phase D)

## - [x] C1 — Playwright smoke tests for fragile flows

**Prereqs:** none, but MUST complete before Phase D/E.
**Goal:** regression net for the mega-files about to be decomposed.

**Files:** add Playwright config + tests under `tests/e2e/` (check if Playwright is already a dependency; if not, note for user to install — **do not install yourself**, user runs setup).

**Tests to write (happy-path, read + one mutation each):**
- `customer-detail.spec.ts`: load `/marketing/customers/[id]`, edit a field + save, add a contact, open artwork modal, navigate to a linked opportunity.
- `task-detail.spec.ts`: load `/tasks/[id]`, change status, add a comment.
- `expense-edit.spec.ts`: load `/expense-reports/[id]/edit`, add a line item, save.
- `document-section.spec.ts`: load `/documents/[section]`, expand a folder.

> Auth: these flows need a logged-in session. Check how the app handles auth in tests (Google OAuth). If no test-auth path exists, note this blocker for the user and propose using the `dev-login` route (`app/api/dev-login`) if it exists and is safe in the test env. **Do not weaken production auth to enable tests.**

**Verify (note for user):** user runs `npx playwright test`; all green on clean `main`.
**Done when:** smoke tests exist and pass on unmodified `main`.
**Rollback:** delete `tests/e2e/`.

---

# PHASE D — Decompose `customers/[id]/page.tsx` (STRICT ORDER)

**Global prereqs:** A1, A2, B4, B5, **C1 (smoke tests green)**.
**Rule:** after each sub-task, the smoke test `customer-detail.spec.ts` must still pass. One sub-task per PR.

Target end-state files:
```
app/marketing/customers/[id]/page.tsx        # orchestration only
hooks/useCustomer.ts, hooks/useCustomerEdit.ts, hooks/useArtwork.ts
components/crm/customer/{CustomerHeader,CustomerDetailsCard,CustomerAddressCard,
  CustomerTaxSection,CustomerContactsList,CustomerOpportunitiesList,
  CustomerFilesList,CustomerArtworkGrid,AddContactModal,ArtworkUploadModal}.tsx
```

## - [ ] D1 — Extract remaining pure helpers
**Goal:** move `buildCompanySummary`, `SOCIAL_COLORS`, badge maps (if not already in A2), out of the page. (`Field`/`FieldInput`/`SocialIcon` already moved in B4.)
**Steps:** copy verbatim to `lib/`/`components/ui/`; import; delete locals.
**Done when:** page has no standalone pure helper definitions.

## - [ ] D2 — Extract `useCustomer(id)` read hook
**Goal:** move all read `fetch` calls (customer + contacts/opps/files/stores/brand_data/tags + users + tags lookups) into a hook.
**Steps:**
1. Create `hooks/useCustomer.ts` returning `{ customer, loading, error, refetch }` where `customer` includes related arrays (the API already returns them joined — see `GET /api/marketing/customers/[id]`).
2. Use `useCrmUsers()` / `useCrmTags()` (B5) for the lookups.
3. Page consumes the hook; delete the inline fetch `useEffect`s.
**Done when:** page has no direct read `fetch`; smoke test passes.

## - [ ] D3 — Extract read-only section components
**Goal:** `CustomerFilesList`, `CustomerOpportunitiesList`, `CustomerContactsList`, `CustomerHeader` (presentational; receive props, no fetch).
**Steps:** lift JSX into components taking typed props; page passes data from `useCustomer`. Start with files (simplest).
**Done when:** those sections are components; smoke test passes.

## - [ ] D4 — Extract modals + `useArtwork`
**Goal:** move artwork-upload modal (~line 1688) and add-contact modal (~line 1786) into components using `components/ui/Modal.tsx`; move artwork list/upload/vectorize/delete state into `hooks/useArtwork.ts`.
**Steps:** create `AddContactModal.tsx`, `ArtworkUploadModal.tsx`, `CustomerArtworkGrid.tsx`, `hooks/useArtwork.ts`; wire callbacks; remove inline modal JSX + related `useState`.
**Done when:** no inline modals in page; smoke test passes (add-contact + artwork-upload steps).

## - [ ] D5 — Extract `useCustomerEdit` (LAST — highest coupling)
**Goal:** move the edit state machine (`editing`, `editForm`, `startEdit`, `cancelEdit`, `handleEditChange`, `handleEditBoolChange`, save/PATCH, `aturianError`) into `hooks/useCustomerEdit.ts`.
**Steps:** carefully move the ~10 interdependent states + handlers; the page wires the hook into `CustomerDetailsCard`/`CustomerAddressCard`/`CustomerTaxSection`.
**Verify (note for user):** full edit/save round-trip + validation errors behave identically; smoke test passes.
**Done when:** page is orchestration-only (~150 LOC target).
**Rollback (any D sub-task):** revert that PR; smoke test confirms restoration.

---

# PHASE E — Replicate recipe to other mega-files

**Prereqs:** Phase D complete (recipe proven), C1 smoke tests cover each target.
Apply the **D1→D5 recipe** (pure helpers → read hook → read sections → modals → edit/mutation state) to each file below in order. Each file is its own multi-step sequence — follow D1→D5 for each. Add a smoke test first if C1 didn't cover it.

## - [ ] E1 — Decompose `app/tasks/[id]/page.tsx` (1,395 LOC)
## - [ ] E2 — Decompose `app/documents/[section]/page.tsx` (1,395 LOC)
## - [ ] E3 — Decompose `app/expense-reports/[id]/edit/page.tsx` (1,195 LOC)
## - [ ] E4 — Decompose `app/marketing/specs/new/page.tsx` (1,145 LOC)
## - [ ] E5 — Decompose `app/marketing/opportunities/[id]/page.tsx` (1,033 LOC)

---

# PHASE F — API auth unification (HIGH RISK, staged)

**Prereqs:** A4. Do after B/C stable. **Security boundary — migrate route-by-route, never bulk. Diff every route.**

## - [ ] F1 — Unified auth helpers
**Goal:** single source for auth in `lib/auth/`.
**Files:** extend/create `src/lib/auth/` with `requireUser()` (already in `lib/crm/require-user.ts` — promote/move it), `requireAdmin()`, `requireRole(role)`, and `lib/api/with-auth.ts` wrapper.
**Code (`requireAdmin`):**
```ts
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function requireAdmin(): Promise<{ id: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const adminClient = createAdminClient()
  const { data } = await adminClient.from('users').select('id, is_admin').eq('google_id', user.id).single()
  return data?.is_admin === true ? { id: data.id } : null
}
```
> Keep the exact `google_id` lookup. `requireAdmin` returns null for both unauth and non-admin — callers return `unauthorized()` if no session and `forbidden()` if session-but-not-admin. To distinguish, return a discriminated result or split into `getUser()` + `isAdmin()`. Preserve current 401-vs-403 behavior of each route.

## - [ ] F2 — Migrate admin routes
**Goal:** replace the per-file `requireAdmin(googleId)` (e.g. `app/api/admin/users/route.ts:5`) with the shared helper.
**Steps (per route):** read → swap auth preamble → confirm 401 vs 403 unchanged → manually reason: non-admin blocked, admin passes, impersonation cannot reach admin gate (`getEffectiveUser` is NOT a substitute for `is_admin`).
**Done when:** no admin route defines its own `requireAdmin`.

## - [ ] F3 — Migrate raw `auth.getUser()` routes (60)
**Goal:** non-admin authed routes use `requireUser()`/unified helper.
**Steps:** route-by-route; preserve status codes; preserve any role checks.
**Rollback (F):** revert per route. Never leave a route with `createAdminClient` reachable before an auth check.

---

# PHASE G — API consolidation (verify callers FIRST)

**Prereqs:** F stable.
For each: grep the route path across `src/app/**` to confirm all callers; verify contract; change implementation behind a stable interface. Do not delete an endpoint with >1 caller without updating all callers in the same PR.

## - [ ] G1 — Audit and merge `documents/manage/*` thin duplicates
Audit the 15 routes; merge `permissions` / `access-summary` / `permissions-summary` only after confirming all callers. Permission-sensitive — preserve role gates.

## - [ ] G2 — Shared comment+attachment service
Extract a shared service for `marketing/tasks/*/comments/*` and `expense-reports/*/comments/*`.

## - [ ] G3 — `lib/public/` validation+insert helper
Extract shared validation+insert helper for all `public/*` routes.

---

## Per-task report template (use after every task)

```
Task: <id e.g. A1>
Files changed: <list>
Behavior change: none | <describe>
What the user should verify: <concrete clicks / routes / commands to run>
Notes / blockers / conflicts found: <e.g. badge color mismatch between X and Y>
```

## Global done-criteria
- No mega-file > ~400 LOC.
- One auth pattern across all API routes.
- No duplicated formatters / badge maps / upload handlers.
- `src/hooks/` and `components/ui/` exist and are reused.
- Smoke tests green at every step.
