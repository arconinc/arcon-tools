# User Groups And Opportunity Owners Test Notes

## Scope

These notes cover manual verification for the first user-groups slice: group schema, admin group management, assignment-pool API, and opportunity owner validation/UI wiring.

Legacy roles and departments remain in place during migration. Groups are new source of truth for the Opportunity Owners assignment pool only.

## Manual Verification Checklist

### Migration

- [ ] Run `supabase/migrations/groups.sql` in Supabase SQL editor against target environment.
- [ ] Confirm new tables exist: `groups`, `group_memberships`, `group_capabilities`.
- [ ] Confirm indexes exist for group activity, memberships, and capability lookups.
- [ ] Confirm system groups were seeded from existing departments and roles.
- [ ] Confirm `Opportunity Owners` group exists and is active.
- [ ] Confirm `Opportunity Owners` has `assignment_pool` capability with config `{ "pool_key": "opportunity_owners" }`.
- [ ] Confirm legacy tables remain unchanged: `roles`, `user_roles`, `departments`, `user_departments`, `department_roles`.

### Backfill Expectations

- [ ] Users with legacy department/role memberships are represented in matching system groups where source data exists.
- [ ] Users currently referenced by non-null `crm_opportunities.assigned_to` are members of `Opportunity Owners`.
- [ ] Backfilled memberships have `assigned_at` populated.
- [ ] Backfill does not deactivate users or alter legacy role/department records.
- [ ] Existing opportunity rows are not rewritten except through normal future opportunity updates.
- [ ] Existing opportunities with non-member owners can still be read; validation applies when creating or changing `assigned_to`.

### Admin Groups

- [ ] Non-admin access to admin group routes returns `403`.
- [ ] Admin can open `/admin/groups`.
- [ ] Group list loads with capabilities and member counts.
- [ ] Admin can create and edit non-system groups.
- [ ] Admin can activate/deactivate non-system groups.
- [ ] System groups cannot be deleted and follow system-group protection rules.
- [ ] Admin can load members for a group.
- [ ] Admin can add/remove active users from a group.
- [ ] Deactivated users do not appear as addable members.
- [ ] `assigned_by` and `assigned_at` populate for membership changes.

### Assignment Pool API

- [ ] Unauthenticated request to `/api/marketing/assignment-pools/opportunity_owners/users` returns `401`.
- [ ] Authenticated request returns only active users in active `Opportunity Owners` memberships.
- [ ] Inactive users are excluded.
- [ ] Users outside `Opportunity Owners` are excluded.
- [ ] Other marketing user dropdowns still call `/api/marketing/users` and keep previous behavior.

### Opportunity Create/Update Flows

- [ ] New opportunity form owner dropdown shows only Opportunity Owners.
- [ ] New opportunity form still allows unassigned owner.
- [ ] Creating opportunity with unassigned owner succeeds.
- [ ] Creating opportunity with active Opportunity Owner succeeds.
- [ ] Creating opportunity with non-member owner fails with `400`.
- [ ] Edit opportunity form owner dropdown shows only Opportunity Owners.
- [ ] Updating owner to active Opportunity Owner succeeds.
- [ ] Updating owner to non-member fails with `400`.
- [ ] Updating unrelated opportunity fields succeeds when owner is unchanged.
- [ ] Existing create/edit error UI displays assignment validation failures.

## Rollback Notes

Rollback should target only new group artifacts and routes added by this feature slice.

- Remove or disable new routes:
  - `/api/admin/groups`
  - `/api/admin/groups/[id]`
  - `/api/admin/groups/[id]/members`
  - `/api/marketing/assignment-pools/[poolKey]/users`
- Revert opportunity owner dropdowns to prior `/api/marketing/users` source if needed.
- Revert opportunity create/update assignment validation if feature must be fully disabled.
- Drop new tables only after confirming no dependent code remains deployed:
  - `group_capabilities`
  - `group_memberships`
  - `groups`
- Do not roll back or modify legacy role/department tables as part of this rollback.
- Do not mutate existing `crm_opportunities.assigned_to` values during rollback unless separate data-correction plan exists.

## Legacy Boundaries

These areas remain legacy for now and should not be treated as group-driven yet:

- Task routing remains legacy.
- Notifications remain legacy.
- Document access remains legacy.
- Existing role and department controls remain available during migration.
- `/api/marketing/users` remains broad because tasks, contacts, specs, and other flows still depend on it.
- Private file access rules continue through existing permission and signed-url paths.
