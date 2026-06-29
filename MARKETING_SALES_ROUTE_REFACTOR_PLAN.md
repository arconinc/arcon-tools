# Marketing / Sales Route Refactor Plan

Status key: `Pending`, `In Progress`, `Completed`.

## Goal

Separate Sales pages from Marketing pages at URL and nav level without risky database renames.

Database tables and internal schema names such as `crm_*`, `crm_vendors`, and `vendor_id` remain unchanged for now.

## Phase 1: Sales URL Foundation

Status: Completed

- Keep `/marketing` available for real Marketing home. Do not redirect `/marketing` to `/sales`.
- Move Sales pages out of `/marketing/*`:
  - `/marketing/customers` -> `/sales/customers`
  - `/marketing/contacts` -> `/sales/contacts`
  - `/marketing/opportunities` -> `/sales/opportunities`
  - `/marketing/vendors` -> `/sales/suppliers`
- Keep true Marketing pages under `/marketing`:
  - `/marketing/specs`
  - future `/marketing/content-calendar`
  - future `/marketing/vendor-relations`
  - future `/marketing/social`
  - future `/marketing/self-promo`
- Keep existing `/sales/tasks` task board. Old `/marketing/tasks` becomes a legacy redirect target.

## Phase 2: Link Rewrite

Status: Completed

- Rewrite app links, router pushes, search results, and notification links from old Marketing Sales URLs to Sales URLs.
- Keep Spec Sample links at `/marketing/specs`.
- Keep `/api/marketing/*` API routes unchanged during this phase.

## Phase 3: Naming Cleanup

Status: Completed

- User-facing language should say `Sales`, not `CRM`, where it refers to Sales pages/features.
- User-facing language should say `Supplier`, not `Vendor`, where it refers to supplier records.
- Internal names/types/components may keep `Crm` and `vendor_id` until a separate low-risk rename phase.

## Phase 4: Sales Nav Finalization

Status: Completed

- Sales nav should point to:
  - `/sales`
  - `/sales/opportunities`
  - `/sales/customers`
  - `/sales/suppliers`
  - `/sales/contacts`
  - `/documents/sales`
  - `/sales/tasks`
- Marketing nav should point to:
  - `/marketing`
  - `/marketing/content-calendar` once built
  - `/documents/marketing`
  - `/marketing/specs`
  - `/marketing/vendor-relations` once built
  - `/marketing/social` once built
  - `/marketing/self-promo` once built

## Later Phases

Status: Pending

- Build real Marketing dashboard at `/marketing`.
- Build Content Calendar.
- Set up Marketing document folder structure.
- Polish Spec Samples.
- Build Vendor Relations.
- Build Social Media link hub.
- Build Self Promo catalog.
