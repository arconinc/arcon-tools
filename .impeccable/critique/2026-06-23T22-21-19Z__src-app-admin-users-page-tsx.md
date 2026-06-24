---
target: src/app/admin/users/page.tsx
total_score: 30
p0_count: 0
p1_count: 2
timestamp: 2026-06-23T22-21-19Z
slug: src-app-admin-users-page-tsx
---
# Admin Users Design Critique

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading now uses the shared table skeletons; per-action saving states are visible. Sync success/error feedback remains global and easy to miss after scrolling. |
| 2 | Match System / Real World | 4 | Employee, role, department, and admin language is direct and internal-tool appropriate. |
| 3 | User Control and Freedom | 3 | Inline edit and role management preserve quick recovery with Cancel. Destructive deactivation still lacks a confirmation step. |
| 4 | Consistency and Standards | 4 | The page now uses the canonical DataTable and FilterPillGroup patterns instead of a custom raw table. |
| 5 | Error Prevention | 2 | High-impact actions such as Deactivate, Make Admin, and Impersonate are one-click operations with no secondary confirmation or risk framing. |
| 6 | Recognition Rather Than Recall | 3 | Inline action buttons improve discoverability over the old hidden menu. The difference between departments and roles is still explained above the table. |
| 7 | Flexibility and Efficiency | 3 | Sorting is now available on all data columns. A search field is still missing for large employee lists. |
| 8 | Aesthetic and Minimalist Design | 3 | The table now matches the app system. The top explainer cards are useful but visually louder than the employee workflow needs. |
| 9 | Error Recovery | 2 | API failures on patch/save actions still do not surface inline; most mutation paths reload or alert without row-level recovery. |
| 10 | Help and Documentation | 3 | Departments and roles have concise guidance. Riskier admin actions could use clearer microcopy. |
| **Total** | | **30/40** | **Healthy, with admin-risk hardening needed** |

## Anti-Patterns Verdict

**LLM assessment**: The migrated page no longer reads as an off-system admin table. It aligns with the product register: compact, familiar, purple-tinted table header, clear status chips, and restrained action styling. It avoids the major shared bans: no gradient text, no oversized card radii, no decorative glass, no raw gray table header, and no hidden dropdown inside an overflow container.

**Deterministic scan**: Initial scan on the original file returned no hard findings. After migration, the scan found two gray-on-purple hover warnings in the shared DataTable pagination controls; those were fixed. Final scan on `src/app/admin/users/page.tsx` and `src/components/ui/DataTable.tsx` returned `[]`.

**Visual overlays**: Browser overlay inspection was not available in this session because no browser automation tool was exposed and I did not start a local authenticated session.

## Overall Impression

The biggest improvement is consistency. The page now belongs to the same product system as customers, PTO, and specs instead of carrying its own bespoke table vocabulary. The remaining opportunity is safety: this surface controls identity, permissions, impersonation, and account state, so its interaction design should be more deliberate around irreversible or sensitive actions.

## What's Working

- The canonical DataTable brings sortable columns, purple table chrome, shared skeleton loading, and responsive horizontal overflow.
- FilterPillGroup makes deactivated users a first-class status filter instead of a secondary hidden table below the primary list.
- Inline actions are easier to scan than the previous Actions dropdown, and they avoid the dropdown clipping risk inside an overflow table container.

## Priority Issues

**[P1] Sensitive admin actions are too easy to trigger**

Why it matters: Deactivation, admin grants/removal, and impersonation affect account access and trust. One-click controls raise the risk of accidental permission changes.

Fix: Add confirmation treatment for Deactivate, Make/Remove Admin, and Impersonate. Use direct copy that names the employee and consequence.

Suggested command: `$impeccable harden src/app/admin/users`

**[P1] Mutation failures are not recoverable in context**

Why it matters: If a role save, admin toggle, or deactivation fails, admins need to know exactly which employee failed and what to retry.

Fix: Track row-level mutation errors and display them in the expanded row or beneath the action group instead of relying on alerts or silent reloads.

Suggested command: `$impeccable harden src/app/admin/users`

**[P2] Large directories need search**

Why it matters: Sorting and active/deactivated filters help, but an admin looking for one person still has to scan or browser-find.

Fix: Add a right-aligned search input in the table toolbar following the Customers pattern. Search name, email, department, and role labels.

Suggested command: `$impeccable polish src/app/admin/users`

**[P2] Explainer cards compete with the table**

Why it matters: Departments and roles are helpful concepts, but the two tinted cards take visual weight away from the actual employee management task.

Fix: Compress them into a single slim guidance row or contextual helper text near the relevant action labels.

Suggested command: `$impeccable distill src/app/admin/users`

## Persona Red Flags

**Alex (Power User)**: Sorting is now covered, but search is missing. For a large employee list, Alex still has to scan names manually before editing roles.

**Jordan (First-Time Admin)**: The page explains departments versus roles, but high-risk actions do not explain consequence at the moment of click. Jordan could deactivate someone before fully understanding the operational impact.

**Riley (Security-Minded Admin)**: Impersonation is visually just another inline button. Riley expects stronger warning, reason capture, or at least a confirmation step for audit-sensitive actions.

## Minor Observations

- The active/deactivated filter is cleaner than the previous collapsible deactivated section.
- The inline expanded rows preserve fast editing without introducing modal friction.
- Role color badges still depend on backend-provided colors; future hardening should verify contrast if arbitrary role colors are allowed.

## Questions to Consider

- Should impersonation require a reason or confirmation before redirecting to the dashboard?
- Would a single “More” control be preferable once confirmation flows exist, or is visible action density acceptable for admins?
- Should deactivated employees remain visually muted, or should the filter state alone carry that distinction?
