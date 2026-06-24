---
target: homepage (/dashboard)
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-06-23T17-37-26Z
slug: src-app-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading skeletons exist for tasks/calendar, but carousel and marquee motion have no pause/status affordance. |
| 2 | Match System / Real World | 3 | Internal dashboard language is mostly clear; fallback hero slides feel more promotional than operational. |
| 3 | User Control and Freedom | 2 | Carousel dots/arrows and task rows are clickable but not semantic controls; marquee cannot be paused. |
| 4 | Consistency and Standards | 2 | Dashboard cards, news cards, colors, radii, and inline styles drift from DESIGN.md vocabulary. |
| 5 | Error Prevention | 2 | Auth boundary is strong, but dashboard interactions rely on full-row clicks and hidden horizontal scrolling. |
| 6 | Recognition Rather Than Recall | 3 | Sidebar grouping is visible, but the collapsed/accordion nav creates scanning overhead on a dense homepage. |
| 7 | Flexibility and Efficiency | 3 | Topbar search, tasks, news, and calendar are efficient for repeat users; first-screen prioritization is weaker. |
| 8 | Aesthetic and Minimalist Design | 2 | 480px hero plus animated strip consumes prime viewport before work modules; visual weight is inverted. |
| 9 | Error Recovery | 2 | Calendar has an error state; banner/news/tasks failures mostly disappear or fall back silently. |
| 10 | Help and Documentation | 3 | Empty states are understandable but not instructive; no dashboard-level orientation or next best action. |
| **Total** | | **25/40** | **Usable but top-heavy** |

## Anti-Patterns Verdict

**Does this look AI-generated?** Not in the generic marketing-page sense. It reads as a real internal product with working modules, a consistent black sidebar, and a recognizable purple brand. The risk is a different product-UI smell: the homepage behaves like a company billboard first and an operations hub second.

**LLM assessment**: The strongest slop tell is not beige SaaS or gradient text; it is the enormous animated hero carousel plus animated banner strip above the actual work. For an internal dashboard, that creates a tonal mismatch: the page says “announcement wall” before it says “what do I need to do today?” The widgets below are useful, but the first viewport gives too much real estate to passive content.

**Deterministic scan**: The detector found 2 warnings and many advisory design-system drift findings:
- `layout-transition`: `src/app/dashboard/page.tsx:102` animates dot width; `src/components/layout/AppShell.tsx:424` animates sidebar width/min-width.
- `design-system-color`: many literal colors in `src/app/dashboard/page.tsx`, `src/components/layout/AppShell.tsx`, and `src/components/dashboard/DashboardTasksWidget.tsx` are outside DESIGN.md.
- `design-system-radius`: several 3px/5px radii in `src/app/dashboard/page.tsx` sit outside the documented radius scale.

**Visual overlays**: No reliable user-visible overlay is available. Browser inspection was attempted, but Playwright’s bundled Chromium was missing and system Chrome aborted under the sandbox runtime. HTTP probing confirmed `/dashboard` redirects to `/login` when unauthenticated and local dev login can issue a Supabase magic-link redirect.

## Overall Impression

The homepage has the bones of a good internal command center: tasks, news, calendar, global navigation, search, notifications, and role-aware links. The single biggest opportunity is to flip the hierarchy: lead with “what needs my attention” and make company storytelling secondary, not dominant.

## What's Working

1. **The app shell has a durable identity.** The black sidebar, purple stripe, compact topbar, and Arc wordmark give the product a recognizable internal-tool posture.
2. **The homepage includes genuinely useful modules.** My Tasks, News, and Company Calendar are the right primitives for an employee dashboard.
3. **Loading states exist where they matter.** Tasks and calendar skeletons prevent a blank initial dashboard, which is better than spinners in the middle of content.

## Priority Issues

**[P1] First viewport is dominated by passive content**
Why it matters: Busy employees land here to decide what to do next. A 480px carousel plus an optional animated strip pushes tasks, news, and calendar below the main decision zone on desktop and nearly consumes the first mobile viewport.
Fix: Reduce the hero to a compact announcement module or split the first screen into a work-first dashboard: tasks/alerts on the left, one featured announcement on the right, news/calendar below. Keep the carousel only if content freshness justifies it.
Suggested command: `$impeccable layout dashboard homepage`

**[P1] Motion lacks user control and reduced-motion handling**
Why it matters: Auto-advancing carousel, animated gradient strip, marquee, countdown fading, and layout width transitions can distract users in a work context and can violate reduced-motion expectations.
Fix: Add `prefers-reduced-motion` handling, pause marquee/carousel on hover/focus, avoid auto-advance for critical content, and replace width/min-width animations where practical.
Suggested command: `$impeccable audit dashboard homepage`

**[P2] Several homepage interactions are not semantic controls**
Why it matters: Hero arrows and dots are `div`s with click handlers, task rows navigate via `onClick`, and hover styles are manually applied. Keyboard and assistive tech users lose clear affordances.
Fix: Use `button` for carousel controls with labels, `Link` or nested action affordances for task navigation, visible focus states, and proper `aria-current`/pressed states for dots and filters.
Suggested command: `$impeccable harden dashboard homepage`

**[P2] Design-system drift weakens polish**
Why it matters: The documented system says compact 10px dashboard cards, flat borders, restrained purple, and a known radius/color scale. The homepage mixes inline CSS, Tailwind cards with `rounded-2xl`, undocumented gradients, ad hoc grays, and scattered radii.
Fix: Normalize card shells, section headers, action links, neutral text colors, and status/radius tokens across DashboardPage, NewsFeed, DashboardTasksWidget, Calendar, and AppShell.
Suggested command: `$impeccable polish dashboard homepage`

**[P2] Navigation density competes with homepage clarity**
Why it matters: The sidebar is comprehensive, but the homepage already asks users to parse tasks, announcements, filters, calendar, countdown, search, notifications, and role/admin affordances. The total number of visible choices is high.
Fix: Make homepage modules more selective: show only urgent/open work, recent/high-priority announcements, and next few calendar items before the full calendar. Keep the full month view one click deeper or below the fold.
Suggested command: `$impeccable distill dashboard homepage`

## Persona Red Flags

**Alex (Power User)**: Alex wants to triage work fast. The first action area is not tasks but carousel controls and announcements. Task rows all route to the same table view rather than deep-linking to the specific task, adding a second search step.

**Jordan (First-Timer)**: Jordan sees a large hero, moving strip, dense sidebar, topbar search, and multiple content modules with little prioritization. The page does not clearly answer “what should I do first?”

**Sam (Keyboard / Assistive Tech User)**: Sam may miss carousel controls because arrows/dots are clickable `div`s, not buttons. Full-row task clicks are not standard keyboard targets, and hover-only visual changes do not translate to keyboard focus.

## Minor Observations

- `src/app/page.tsx` is only a redirect to `/dashboard`, so “homepage” really means the authenticated dashboard.
- The fallback slides use dates and people-specific content that can become stale; fallback content should be evergreen or operational.
- News uses horizontal scroll with three-card sizing; this can hide content discovery on small screens without a visible scroll cue.
- Some low-contrast muted grays like `#999`, `#aaa`, and `#888` appear in small text contexts and should be checked against WCAG AA.
- Calendar as a full month view is powerful, but it may be too heavy for the homepage compared with “upcoming events” plus a link to the full calendar.

## Questions to Consider

- What if the first visible module were “Today at Arcon”: overdue tasks, due-today tasks, next event, and one announcement?
- Does the hero carousel need to rotate, or would a single editorial announcement with clear expiry be more trustworthy?
- Should homepage task rows open the exact task, not the general task table?
- Which content deserves motion in a workday tool: urgent status changes, or company atmosphere?
