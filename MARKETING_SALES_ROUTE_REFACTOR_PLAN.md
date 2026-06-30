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

## Phase 5: Marketing Dashboard

Status: Pending

- Replace temporary `/marketing` landing page with real Marketing home.
- Add weekly plan calendar as primary module.
- Read calendar items from Content Calendar data once Phase 6 exists.
- Add summary cards for:
  - upcoming posts
  - pending spec sample follow-ups
  - upcoming vendor relation meetings
  - self promo inventory highlights
- Keep page useful before all later phases exist by showing empty states and links to available modules.

Deployability:

- Can deploy with static placeholders first.
- Should not require DB changes unless dashboard starts reading Phase 6+ tables.

## Phase 6: Content Calendar

Status: Pending

- Add route: `/marketing/content-calendar`.
- Add API under `/api/marketing/content-calendar`.
- Add DB table, proposed: `marketing_content_calendar_items`.
- Track:
  - title
  - platform
  - publish date/time
  - status
  - campaign
  - content type
  - caption/notes
  - asset URL or document link
  - owner user
- Build calendar and list views.
- Add create/edit/delete actions.
- Feed `/marketing` dashboard weekly calendar from same source.

Deployability:

- Can ship independently with new table/API/UI.
- Existing Sales and Spec Sample routes should remain untouched.

## Phase 7: Marketing Documents Setup

Status: Pending

- Use existing `/documents/marketing` document system.
- Create or seed requested folder structure:
  - Brand Assets
  - Arcon Logos
  - Arcon Brand Guidelines
  - Flyers + Sales Materials
  - Arcon Product Flyers
  - Graphics
  - Product Images
  - Canva Designs
  - Photos/Videos
  - Presentations/Virtuals
  - Customer Presentations
  - Virtual Decks
- Confirm external links are supported as document records.
- If external links are not supported cleanly, add minimal link-type support to documents.

Deployability:

- Can deploy as data/config-only if existing document system supports links.
- If link support is needed, ship as a small isolated documents enhancement.

## Phase 8: Spec Samples Polish

Status: Pending

- Keep route: `/marketing/specs`.
- Keep existing `spec_samples` foundation.
- Add or expose client-requested fields/views:
  - customer-grouped view
  - PO number
  - supplier
  - item link and item number
  - sent-to contact and email
  - date sent
  - proof/image storage
  - follow-up needed filters
- Prefer minimal table additions over any table rename.

Deployability:

- Can ship field/view improvements incrementally.
- Existing spec records should remain compatible.

## Phase 9: Vendor Relations

Status: Pending

- Add route: `/marketing/vendor-relations`.
- Add API under `/api/marketing/vendor-relations`.
- Add DB tables, proposed:
  - `marketing_vendor_meetings`
  - `marketing_vendor_meeting_signups`
- Build meeting schedule view.
- Build signup form attached to each meeting.
- On signup, create Arc/company calendar event and invite sales team.
- Google Calendar helper currently read-only; add write-capable scope/helper only in this phase.

Deployability:

- Ship meeting schedule without calendar write first if needed.
- Calendar invite work should be separately testable and guarded by env config.

## Phase 10: Social Media and Self Promo

Status: Pending

### Social Media

- Add route: `/marketing/social`.
- Build external link hub for company social platforms.
- Decide whether links are static config or admin-editable records.

### Self Promo

- Add route: `/marketing/self-promo`.
- Add API under `/api/marketing/self-promo`.
- Add DB table, proposed: `marketing_self_promo_items`.
- Track:
  - item name
  - item link
  - color
  - proof/image URL or file
  - pricing
  - warehouse quantity
  - current/past status
  - notes

Deployability:

- Social link hub can ship first with static links.
- Self Promo catalog can ship independently after DB/API/UI are ready.
