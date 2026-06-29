# Feature: User Groups And Opportunity Owners
**Created:** 2026-06-29
**Status:** In Progress

## Executive Summary
Add Groups as unified people collections while keeping legacy roles/departments intact. First slice: admin-managed groups plus `Opportunity Owners` assignment pool for opportunity owner dropdowns and API validation. Out of scope: full notification, task routing, document permission, and legacy table removal.

## Architecture Notes
Follow admin auth pattern from `src/app/api/admin/users/route.ts`: `createClient()`, `auth.getUser()`, then `createAdminClient()` after auth. Admin pages live under `src/app/(app)/admin/` and are gated by `src/app/(app)/admin/layout.tsx`.

Marketing endpoints use `requireUser()` from `src/lib/crm/require-user.ts` and admin client for DB reads/writes. Keep `/api/marketing/users` broad because tasks, contacts, specs, and opportunities share it. Add separate group-member endpoint for assignment pools instead.

Existing data involved:
`users`, `roles`, `user_roles`, `departments`, `user_departments`, `department_roles`, `crm_opportunities`.

New data:
`groups`, `group_memberships`, `group_capabilities`.

## Tasks

### Task 1: Add Group Schema And Seed Data
**Status:** [x] Complete
**Completed:** 2026-06-29
**Review Issues:** none
**Wave:** 1
**Prerequisites:** None
**Parallel with:** Task 2
**Files:** `supabase/migrations/groups.sql`

**What to build:**
Create `groups`, `group_memberships`, `group_capabilities`. Add indexes. Seed system groups from departments/roles. Seed `Opportunity Owners` with `assignment_pool` config `{ "pool_key": "opportunity_owners" }`. Backfill group memberships from `users.department`, `user_roles`, and existing non-null `crm_opportunities.assigned_to`.

**Manual validation:**
- [ ] Run migration in Supabase SQL editor.
- [ ] Confirm groups exist.
- [ ] Confirm current opportunity owners are members of `Opportunity Owners`.
- [ ] Confirm legacy role/department tables unchanged.

---

### Task 2: Add Group Shared Types And Constants
**Status:** [x] Complete
**Completed:** 2026-06-29
**Review Issues:** none
**Wave:** 1
**Prerequisites:** None
**Parallel with:** Task 1
**Files:** `src/types/index.ts`, `src/lib/groups/constants.ts`

**What to build:**
Add group, group membership, group capability TypeScript types. Add capability constants and `OPPORTUNITY_OWNERS_GROUP_KEY`.

**Manual validation:**
- [ ] Import constants from one route without type errors.
- [ ] Verify no existing types renamed or removed.

---

### Task 3: Add Admin Groups API
**Status:** [x] Complete
**Completed:** 2026-06-29
**Review Issues:** none
**Wave:** 2
**Prerequisites:** Task 1, Task 2
**Parallel with:** Task 4
**Files:** `src/app/api/admin/groups/route.ts`, `src/app/api/admin/groups/[id]/route.ts`

**What to build:**
Admin-only CRUD for groups. Support list, create, update, deactivate. Include capabilities and member count in list/detail responses. Never delete system groups.

**Manual validation:**
- [ ] Non-admin gets `403`.
- [ ] Admin can list groups.
- [ ] Admin can create non-system group.
- [ ] Admin can deactivate non-system group.
- [ ] System group delete/deactivate rules behave as intended.

---

### Task 4: Add Group Membership API
**Status:** [x] Complete
**Completed:** 2026-06-29
**Review Issues:** none
**Wave:** 2
**Prerequisites:** Task 1, Task 2
**Parallel with:** Task 3
**Files:** `src/app/api/admin/groups/[id]/members/route.ts`

**What to build:**
Admin-only membership read/replace endpoint. Store `assigned_by` as real admin user id. Return active users and selected members for group edit UI.

**Manual validation:**
- [ ] Admin can load members.
- [ ] Admin can add/remove users.
- [ ] `assigned_by` and `assigned_at` populate.
- [ ] Deactivated users do not appear as addable choices.

---

### Task 5: Add Assignment Pool Users API
**Status:** [x] Complete
**Completed:** 2026-06-29
**Review Issues:** none
**Wave:** 2
**Prerequisites:** Task 1, Task 2
**Parallel with:** Task 3, Task 4
**Files:** `src/app/api/marketing/assignment-pools/[poolKey]/users/route.ts`

**What to build:**
Authenticated endpoint returning active users in group with `assignment_pool` capability matching `poolKey`. Do not change `/api/marketing/users`.

**Manual validation:**
- [ ] Unauthenticated request gets `401`.
- [ ] `/api/marketing/assignment-pools/opportunity_owners/users` returns only active Opportunity Owners.
- [ ] Other marketing user dropdowns still use `/api/marketing/users`.

---

### Task 6: Validate Opportunity Assignment Server-Side
**Status:** [x] Complete
**Completed:** 2026-06-29
**Review Issues:** none
**Wave:** 2
**Prerequisites:** Task 1, Task 2
**Parallel with:** Task 3, Task 4, Task 5
**Files:** `src/app/api/marketing/opportunities/route.ts`, `src/app/api/marketing/opportunities/[id]/route.ts`

**What to build:**
On opportunity create/update, validate non-null `assigned_to` is active member of `Opportunity Owners`. Allow null. Return `400` for invalid owner. Do not affect reads or existing records unless assigned_to changes.

**Manual validation:**
- [ ] Create opportunity with null owner succeeds.
- [ ] Create opportunity with Opportunity Owner succeeds.
- [ ] Create opportunity with non-member fails.
- [ ] Update owner to non-member fails.
- [ ] Updating unrelated opportunity fields still succeeds.

---

### Task 7: Build Admin Groups Page
**Status:** [x] Complete
**Completed:** 2026-06-29
**Review Issues:** none
**Wave:** 3
**Prerequisites:** Task 3, Task 4
**Parallel with:** Task 8
**Files:** `src/app/(app)/admin/groups/page.tsx`

**What to build:**
Admin UI for group list, create/edit modal, active toggle, capability badges, member management. Use existing UI patterns from `src/app/(app)/admin/users/page.tsx`.

**Manual validation:**
- [ ] Admin sees `/admin/groups`.
- [ ] Group list loads.
- [ ] Create/edit group works.
- [ ] Member add/remove works.
- [ ] Capability labels clear: Access, Assignment Pool, Directory, Notification, Task Routing.

---

### Task 8: Wire Opportunity Owner Dropdowns To Assignment Pool
**Status:** [x] Complete
**Completed:** 2026-06-29
**Review Issues:** none
**Wave:** 3
**Prerequisites:** Task 5, Task 6
**Parallel with:** Task 7
**Files:** `src/app/(app)/sales/opportunities/[id]/page.tsx`

**What to build:**
Change new/edit opportunity owner dropdowns to fetch `/api/marketing/assignment-pools/opportunity_owners/users`. Keep unassigned option. Show API validation errors in existing create/edit error paths.

**Manual validation:**
- [ ] New opportunity form owner dropdown shows only Opportunity Owners.
- [ ] Edit opportunity form owner dropdown shows only Opportunity Owners.
- [ ] Unassigned still available.
- [ ] Invalid assignment error displays if API rejects.

---

### Task 9: Add Groups Link And User Admin Read Model
**Status:** [ ] Not Started
**Wave:** 4
**Prerequisites:** Task 7
**Parallel with:** Task 10
**Files:** `src/components/layout/AppShell.tsx`, `src/app/api/admin/users/route.ts`, `src/app/(app)/admin/users/page.tsx`

**What to build:**
Add admin nav link to `/admin/groups`. Add user group summary to admin users API/table. Keep existing role and department controls during migration; label groups as new source of truth.

**Manual validation:**
- [ ] Admin nav includes Groups.
- [ ] Users table shows group badges.
- [ ] Existing role and department editing still works.
- [ ] No non-admin access to admin groups UI.

---

### Task 10: Add Migration Notes And Manual Test Script
**Status:** [ ] Not Started
**Wave:** 4
**Prerequisites:** Task 1, Task 6, Task 8
**Parallel with:** Task 9
**Files:** `docs/plans/user-groups-opportunity-owners-test-notes.md`

**What to build:**
Document manual verification checklist, backfill expectations, rollback notes, and legacy boundaries. Include note that task routing, notifications, and document access remain legacy for now.

**Manual validation:**
- [ ] Checklist covers migration, admin groups, assignment API, create/update opportunity flows.
- [ ] Rollback notes identify new tables/routes only.
- [ ] Out-of-scope legacy areas listed.

---
