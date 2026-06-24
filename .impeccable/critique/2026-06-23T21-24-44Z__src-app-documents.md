---
target: documents/accounting
total_score: 25
p0_count: 0
p1_count: 1
timestamp: 2026-06-23T21-24-44Z
slug: src-app-documents
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading dots present; no inline skeleton; no active-state confirmation on click before nav |
| 2 | Match System / Real World | 4 | Language is plain, folder metaphors are natural |
| 3 | User Control and Freedom | 3 | Modal cancel/overlay-click works; no undo on delete; native `confirm()` dialogs |
| 4 | Consistency and Standards | 2 | Table on section page uses bespoke `.table` CSS, not shared `DataTable`; sidebar uses non-standard custom scrollbar styles; radii/colors inconsistent with design system throughout |
| 5 | Error Prevention | 2 | Delete uses native `confirm()` — blunt, not designed; no confirmation UI for destructive folder deletes |
| 6 | Recognition Rather Than Recall | 3 | Folder tree is visible; but breadcrumb absent — user must remember how they got to the current section |
| 7 | Flexibility and Efficiency | 2 | Right-click context menu (good), resizable sidebar (good), but no keyboard shortcuts, no search within section |
| 8 | Aesthetic and Minimalist Design | 2 | Section page has significant visual debt: bespoke `.table` CSS vs DESIGN.md spec, bounce animation, color drift, sidebar lacks purple identity, table header is gray not purple-washed |
| 9 | Error Recovery | 2 | Move/replace failure uses native `alert()` with a generic message; add-document errors shown inline (good); delete errors silently fail |
| 10 | Help and Documentation | 2 | Empty states exist but are short single-line sentences; no guidance on what file types are supported for uploads |
| **Total** | | **25/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment**: Not egregiously AI-sloppy — there's no gradient text, no identical card grids with eyebrows, no hero-metric template. The overview page (`/documents`) is clean and purposeful. The section page (`/documents/accounting`) is functional but shows the seams of incremental development: it predates the DESIGN.md polish direction established in June 2026 and hasn't been migrated. The sidebar uses a gray `#fafafa` background where the rest of the app uses a purple-tinted identity. The table uses gray `#6b7280` headers where the DESIGN.md calls for purple-washed headers with `text-purple-950/70`. The loading state uses a bouncing animation — correct to flag. Most critically: the section page renders a raw `<table>` with bespoke CSS instead of the shared `<DataTable>` component, putting it out of alignment with the rest of the app.

**Deterministic scan**: 2 warnings + 18 advisories across both files.
- `bounce-easing` (warning, both files): The `@keyframes bounce` loading animation uses `translateY(-8px)` with 0/80/100% keyframe structure — bounce easing. Should be replaced with a fade or a linear pulse.
- `#666` (advisory, both files): An undocumented muted gray used for subtitle text in headers. The closest in DESIGN.md is `text-muted: #6b7280`. This is minor drift.
- `#6d28d9` (advisory, section page, 5 hits): The DESIGN.md has `arcon-purple-hover: #5b21b6` and `arcon-purple-bright: #7c3aed` — `#6d28d9` is used inline as an intermediate purple that isn't documented. Not a blocker, but contributes to design system fragmentation.
- `12px`, `5px`, `7px`, `14px` radii (advisory, section page): Off-scale radii throughout the section page's bespoke CSS. Design system defines `xs:2, sm:4, md:6, lg:8, xl:10, 2xl:16`. `12px` is between `xl` and `2xl`, `7px` between `md` and `lg`.
- `#10b981` (advisory, section page): Toast uses `#10b981` (success green) but DESIGN.md defines `success-text: #15803d` / `success-bg: #dcfce7`. Minor variant.
- `#c4b5fd`, `#ddd6fe`, `#d1fae5`, `#065f46` (advisory, section page): Off-palette purple and green variants used in version badge, selected folder count chip, and permission "open" badge. These don't map to DESIGN.md tokens.

No browser automation available for overlay visualization.

## Overall Impression

Two-page surface with a significant split: the overview is clean and close to production-quality; the section detail page is a working prototype that never got migrated. The biggest opportunity is bringing the section page's sidebar and table up to the polished operations console direction (purple-tinted table headers, DataTable component, purple-tinted sidebar selected states already there, but the table itself is bespoke). Secondary: the loading animation and error handling patterns both need one pass.

## What's Working

**1. Overview page card grid.** The `sections-grid` with `auto-fill` is genuinely good — cards respond fluidly, the hover state (purple border + lift shadow) gives the right affordance, and the folder/doc count metadata gives users enough context to navigate without opening every section.

**2. Resizable sidebar.** The drag-to-resize sidebar with visual feedback on the handle is a real power-user feature. It's correctly implemented with min/max constraints and `col-resize` cursor.

**3. Context menu.** Right-clicking folders to get rename/move/reorder/delete is discoverable and efficient. The viewport-edge clamping prevents the menu from escaping the screen.

## Priority Issues

**[P1] Table not using the shared DataTable component**
- **Why it matters**: The section page renders a raw `<table class="table">` with hand-coded CSS. The DESIGN.md explicitly states "All tables across the app must use this component. Raw `<table>` markup in pages is non-conforming." The table headers are gray (`#6b7280`, `bg: #fafafa`) instead of the canonical purple wash (`bg-purple-50/70`, `text-purple-950/70`). There's no sort capability, no skeleton loading (just the bounce dots), no consistent row hover tint. The table feels like a different product compared to the PTO and Customers pages.
- **Fix**: Migrate the document list table to `<DataTable>` with a `Name` column (rendering the doc title/link) and an `Actions` column. Pass `loading={loading}` for skeleton states.
- **Suggested command**: `/impeccable polish documents`

**[P2] Bounce loading animation**
- **Why it matters**: The `@keyframes bounce` with `translateY(-8px)` at 40% is exactly the pattern the design rules call out as "dated and tacky." It's also present in two files. The DESIGN.md motion spec says 150–250ms transitions conveying state, not decoration.
- **Fix**: Replace with a skeleton state inside the table (5 pulse rows) when data is loading, matching the DataTable's built-in skeleton. On the overview page, replace dots with 3–4 skeleton cards: `animate-pulse bg-purple-50 rounded-xl h-24`.
- **Suggested command**: `/impeccable polish documents`

**[P2] No breadcrumb on section page**
- **Why it matters**: The section page shows "Accounting Documents / 4 folders" but there's no link back to the `/documents` overview. Users who deep-link into `/documents/accounting?folder=xyz` have no escape to the overview except the browser back button or sidebar nav — a "hidden navigation" cognitive load violation.
- **Fix**: Add a two-item breadcrumb above the page title: `Documents / Accounting`. The design system's existing pill/label styles can carry this at low visual weight.
- **Suggested command**: `/impeccable layout documents`

**[P2] Error handling uses native dialogs**
- **Why it matters**: `confirm()` for delete and `alert()` for move failures are browser-native, unstyled, and block the JS thread. They can't be themed, can't be keyboard-dismissed with Esc (reliably), and feel out of place in a product with designed modals. Delete is especially risky — "Delete folder X and all its documents?" in an OS-chrome dialog is easy to misclick on.
- **Fix**: Replace `confirm()` with a designed confirmation modal (reuse `.modal` class already in the file). Replace `alert()` in move-error with an inline `.error-msg` paragraph inside the modal footer.
- **Suggested command**: `/impeccable harden documents`

**[P3] Color and radius drift vs. DESIGN.md**
- **Why it matters**: 16 color/radius advisories across the section page. Not individually breaking, but they accumulate: `#6d28d9` used 5 times where `arcon-purple-bright` or `arcon-purple-hover` exist, `12px` and `7px` radii where the design system defines `xl:10` and `lg:8`. This makes future theming harder and breaks the design system contract.
- **Fix**: Audit inline CSS in `[section]/page.tsx` and replace with DESIGN.md token values. `12px` → `10px` (xl), `7px` → `8px` (lg), `5px` → `4px` (sm), `#6d28d9` → `#7c3aed` (arcon-purple-bright), `#666` → `#6b7280` (text-muted).
- **Suggested command**: `/impeccable polish documents`

## Persona Red Flags

**Alex (Power User)**: Resizable sidebar and right-click context menu satisfy Alex for folder management. But opening a document requires clicking, loading the Drive viewer (external tab), and coming back. No keyboard shortcut to jump between folders (arrow keys would be natural). No search within the section — with many documents across many folders, Alex must scan manually.

**Sam (Accessibility-Dependent)**: The right-click context menu (`handleFolderRightClick`) is mouse-only — no keyboard equivalent exists. Folder rows have `cursor: pointer` but no `role`, `tabIndex`, or `onKeyDown` for keyboard activation. The `+ Add Document` button is labeled, but the `✕` modal close button has no `aria-label`. The selected folder state (`background: #ede9fe; color: #6d28d9`) provides visual contrast but there's no `aria-selected` attribute on folder rows. The document table has no column headers read by screen readers for the `Name` column (just `<th>Name</th>` — which is fine) but the action column header is blank with no `aria-label`.

**Riley (Stress Tester)**: Deleting a folder with many nested subfolders shows the same confirm dialog as deleting an empty folder — the warning mentions "sub-folders and documents" but gives no count. Riley would want to know "this will delete 12 documents across 4 subfolders" before clicking OK. Also: what happens if two users have the section open simultaneously and one deletes a folder the other is viewing? The content panel would show an empty state with no indication that the folder was removed.

## Minor Observations

- The sidebar header says "FOLDERS" in the `.sidebar-label` style (0.7rem uppercase tracking). This is the correct DESIGN.md pattern for section labels. Good — but the font-size `0.7rem` is smaller than the `label` type spec (`0.75rem`). Minor.
- The `+ Add Document` button in the content header is purple-filled — correct. But the word `+` prepended as a character rather than an SVG icon is inconsistent with the rest of the icon system.
- The `version_badge` uses `#c4b5fd` (a light purple) for version text — visually very low contrast against white. Consider using `text-purple-400` from the design system if this needs to be soft, or remove it.
- The `perm-badge.open` badge uses `#065f46 / #d1fae5` (a dark green / mint combo not in the design system). The DESIGN.md success pair is `#15803d / #dcfce7`. Close but not aligned.
- The loading state on the overview page has no `aria-live` region — screen readers won't announce when content loads.

## Questions to Consider

- "What should happen when a user navigates directly to `/documents/accounting` with no folders — should they see guidance to request folder creation, or is the empty state sufficient?"
- "Is the resizable sidebar complexity worth it for a document library where most users will have 3–8 folders? A fixed 240px sidebar may simplify the code and mobile story without real cost."
- "The section page fetches the entire document tree on load but only shows one folder at a time. Should documents be fetched on-demand per folder to improve initial load on sections with many documents?"
