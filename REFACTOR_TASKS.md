# Refactor Tasks

Checklist grouped by priority. See `REFACTOR_AUDIT.md` for rationale. Each item is scoped to be an independent, reviewable PR. _User runs all builds/tests._

## P0 — Quick Wins (low risk, do first)
- [ ] Create `lib/format.ts`: `formatDate`, `formatDateTime`, `formatRelative`, `formatCurrency`, `formatBytes`
- [ ] Migrate `app/stores/[id]/tabs/shared.ts` `formatDate`/`todayISO` to re-export from `lib/format.ts`
- [ ] Move `formatBytes` out of `customers/[id]/page.tsx` into `lib/format.ts`
- [ ] Create `lib/badges.ts` with canonical status→class maps (customer, opportunity, task, store, spec)
- [ ] Migrate badge maps in: `customers/[id]`, `opportunities/[id]`, `opportunities/page`, `marketing/page`, `tasks/[id]`, `TaskTableView`, `DashboardTasksWidget`, `stores/[id]/tabs/shared.ts`, `AddTrackingTab`
- [ ] Create `components/ui/LoadingState.tsx`, `EmptyState.tsx`, `ErrorState.tsx`
- [ ] Create `lib/api/respond.ts`: `ok`, `created`, `fail`, `unauthorized`, `forbidden`, `notFound`
- [ ] Make CRM PATCH routes call `lib/crm/tags.ts` instead of inlining `crm_entity_tags` delete+insert
- [ ] Extract pure helpers from `customers/[id]/page.tsx`: `Field`, `FieldInput`, `SocialIcon`, `buildCompanySummary` → `components/ui/` / `lib/`

## P1 — Structural (medium risk, tests recommended)
- [ ] Add Playwright smoke tests: customer detail, task detail, expense-report edit, document section
- [ ] Create `lib/api/sanitize.ts` `stripReadOnly(body, extraKeys)`; migrate 50+ PATCH/PUT routes
- [ ] Migrate marketing API routes to `respond.ts` helpers
- [ ] Create `components/ui/Modal.tsx` shell; adopt in one page
- [ ] Create `src/hooks/`: start with `useCrmUsers`, `useCrmTags`, `useApiResource`
- [ ] Create `lib/storage/upload.ts`; migrate the 9 `*/upload` routes one at a time
- [ ] Split `src/types/index.ts` into per-feature files with re-export barrel

## P2 — Auth Unification (high risk, security boundary, staged)
- [ ] Add unified `requireUser` / `requireAdmin` / `requireRole` in `lib/auth/`
- [ ] Add `lib/api/with-auth.ts` handler wrapper
- [ ] Migrate admin routes off per-file `requireAdmin()` (diff each; verify non-admin blocked, admin passes, impersonation cannot reach admin gate)
- [ ] Migrate raw `auth.getUser()` routes (60) to unified helpers
- [ ] Confirm `createAdminClient` only runs after unified auth check

## P3 — Mega-file Decomposition (high risk, behind smoke tests)
- [ ] `customers/[id]/page.tsx`: extract `useCustomer(id)` read hook
- [ ] `customers/[id]/page.tsx`: extract read-only section components (files, opportunities, contacts)
- [ ] `customers/[id]/page.tsx`: extract `AddContactModal`, `ArtworkUploadModal` + `useArtwork`
- [ ] `customers/[id]/page.tsx`: extract `useCustomerEdit` (do last — 46 states)
- [ ] Apply same recipe to `tasks/[id]/page.tsx` (1,395 LOC)
- [ ] Apply to `documents/[section]/page.tsx` (1,395 LOC)
- [ ] Apply to `expense-reports/[id]/edit/page.tsx` (1,195 LOC)
- [ ] Apply to `marketing/specs/new/page.tsx` (1,145 LOC) and `opportunities/[id]/page.tsx` (1,033 LOC)

## P4 — API Consolidation (verify callers first)
- [ ] Audit `documents/manage/*` (15 routes) for merge candidates (permissions/access-summary/permissions-summary)
- [ ] Extract shared comment+attachment service for `marketing/tasks/*/comments` and `expense-reports/*/comments`
- [ ] Extract `lib/public/` validation+insert helper for `public/*` routes
