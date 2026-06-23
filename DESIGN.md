---
name: Arcon Tools App
description: Internal operations dashboard for Arcon employees, built around clarity, warmth, and efficient task flow.
colors:
  arcon-purple: "#6b1e98"
  arcon-purple-hover: "#5b21b6"
  arcon-purple-bright: "#7c3aed"
  arcon-purple-soft: "#f3e8ff"
  arcon-purple-tint: "#faf5ff"
  workspace-bg: "#f5f5f5"
  surface: "#ffffff"
  surface-subtle: "#f8fafc"
  surface-muted: "#f3f4f6"
  sidebar-bg: "#111111"
  ink: "#111111"
  ink-soft: "#374151"
  text-muted: "#6b7280"
  text-subtle: "#9ca3af"
  border: "#e5e7eb"
  border-soft: "#f3f4f6"
  success-bg: "#dcfce7"
  success-text: "#15803d"
  warning-bg: "#fef3c7"
  warning-text: "#92400e"
  danger-bg: "#fee2e2"
  danger-text: "#dc2626"
  info-bg: "#dbeafe"
  info-text: "#1d4ed8"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.05em"
rounded:
  xs: "2px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
  "2xl": "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "28px"
components:
  button-primary:
    backgroundColor: "{colors.arcon-purple}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    typography: "{typography.body}"
  button-secondary:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    typography: "{typography.body}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.arcon-purple}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
    typography: "{typography.label}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "6px 10px"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "16px"
  chip-selected:
    backgroundColor: "{colors.arcon-purple-soft}"
    textColor: "{colors.arcon-purple-hover}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
    typography: "{typography.label}"
---

# Design System: Arcon Tools App

## 1. Overview

**Creative North Star: "The Helpful Operations Desk"**

The Arcon Tools App is a light, task-first internal workspace for busy employees moving between CRM work, documents, HR flows, announcements, dashboards, expense reports, and admin tools. The interface should feel like a competent colleague: organized, direct, and human without becoming playful at the expense of work.

The system is intentionally familiar product UI: system sans typography, compact controls, white content surfaces, a black navigation rail, and Arcon purple used as the signature action and selection color. It rejects generic SaaS polish, beige landing-page warmth, decorative dark mode, enterprise blue-gray stiffness, and rows of same-weight cards. Clarity comes first; delight appears in small brand moments like the Arc wordmark, the purple top stripe, company news, and the dashboard carousel.

**Key Characteristics:**
- Light workspace with dark persistent navigation.
- Purple as identity, action, focus, and selected-state color.
- Dense but readable pages with small type, clear labels, and strong dividers.
- Flat surfaces by default, with shadows reserved for overlays and hover response.
- Human internal language over marketing copy.

## 2. Colors

The palette is restrained product color: neutral surfaces carry the workload, while Arcon purple marks identity, current location, primary action, and selected state.

### Primary
- **Arcon Purple**: The brand anchor. Use for primary buttons, active filters, selected calendar controls, notification badges, links, progress fills, and the top app stripe.
- **Bright Purple**: The energetic companion for gradients and progress accents. Use sparingly in dashboard hero gradients, banner strips, and active calendar states.
- **Soft Purple**: The selected-state background. Use behind selected chips, department tags, highlighted table cells, and purple-tinted panels.

### Secondary
- **Status Blue**: Use for informational states and low-priority markers.
- **Status Green**: Use for success, completed work, approvals, and positive progress.
- **Status Amber**: Use for waiting, attention, due-soon, and needs-review states.
- **Status Red**: Use for errors, destructive actions, overdue tasks, failed states, and validation messages.

### Neutral
- **Workspace Gray**: The app background. It should stay neutral and quiet, never cream, sand, or decorative.
- **Surface White**: Primary content surfaces, cards, modals, tables, and inputs.
- **Sidebar Black**: The persistent navigation shell. It gives the app a recognizable internal-tool posture and lets purple read as brand rather than decoration.
- **Ink Black**: Primary text and card titles.
- **Slate Text**: Secondary text, labels, timestamps, hints, and metadata.
- **Hairline Border**: Standard separators and card borders.

### Named Rules

**The Purple Earns Its Place Rule.** Purple is for action, selection, focus, and identity. Do not use it as random decoration on inactive content.

**The Neutral Workspace Rule.** The app background is neutral gray, not beige, cream, paper, or blue-gray corporate wash.

**The Status Pair Rule.** Status color must pair a tinted background with readable text and a label. Never communicate status by color alone.

## 3. Typography

**Display Font:** system sans stack with Apple, Segoe UI, Roboto, and sans-serif fallback.
**Body Font:** system sans stack with Apple, Segoe UI, Roboto, and sans-serif fallback.
**Label/Mono Font:** same system sans stack; no separate display or mono family is established.

**Character:** The type system is practical, compact, and familiar. It should read like a high-quality internal product, not a marketing page or editorial surface.

### Hierarchy
- **Display** (800, 24px, 1.2): Page titles, major admin headers, dashboard hero captions, and high-level record titles.
- **Headline** (700, 18px, 1.3): Modal headings, login card headings, detail-section headings, and important panel titles.
- **Title** (700, 13-14px, 1.35): Card titles, widget headers, table item titles, and compact page subtitles.
- **Body** (400-500, 13-14px, 1.5): Forms, table rows, descriptions, feed content, metadata blocks, and operational copy. Keep prose blocks to 65-75ch when a screen has paragraphs.
- **Label** (700-800, 10-12px, 0.05em-0.1em, uppercase only for section/table labels): Form labels, table headers, nav section labels, status tags, and dashboard section labels.

### Named Rules

**The Product Sans Rule.** Use one system sans family across UI labels, buttons, data, and body text. Do not introduce display fonts into product surfaces.

**The Compact Hierarchy Rule.** Most UI text lives between 11px and 14px. Use weight, color, spacing, and borders before making text larger.

**The Uppercase Is Functional Rule.** Uppercase labels are allowed for table headers, nav sections, and compact labels. Do not add all-caps eyebrows to every content section.

## 4. Elevation

The app is flat by default. Depth comes from tonal layers, hairline borders, sticky headers, and small hover responses. Shadows are used for overlays, dropdowns, hover cards, and modals, not as decoration on every card.

### Shadow Vocabulary
- **Hover Lift** (`box-shadow: 0 4px 6px rgba(15, 23, 42, 0.10)`): Lightweight response for clickable cards such as article cards.
- **Popover Shadow** (`box-shadow: 0 4px 16px rgba(0,0,0,0.10)`): Notification panels, dropdowns, and compact floating surfaces.
- **Modal Shadow** (`box-shadow: 0 20px 60px rgba(0,0,0,0.18)`): Dialogs and high-priority overlays.

### Named Rules

**The Flat-By-Default Rule.** Cards at rest use a white surface plus a 1px border. If every card casts a shadow, the page loses hierarchy.

**The Overlay Owns The Shadow Rule.** Strong shadows belong to modals, popovers, and dropdowns. Standard dashboard widgets should stay quiet.

## 5. Components

Components should feel consistent, compact, and direct. The same action should look the same across dashboard, admin, CRM, HR, and documents surfaces.

### Buttons
- **Shape:** Moderately rounded rectangles (6-8px), with pills reserved for chips and small status filters.
- **Primary:** Arcon purple background with white text, 13-14px semibold text, and compact padding around 8px 16px or 10px 22px.
- **Hover / Focus:** Hover darkens purple or shifts a neutral background one step darker. Focus uses a visible purple ring or border, never a hidden outline.
- **Secondary / Ghost / Tertiary:** Secondary buttons use gray fills or white with a border. Ghost links use purple text and underline on hover.

### Chips
- **Style:** Small, dense badges with rounded or pill shape, 10-12px semibold text, and paired background/text color.
- **State:** Selected filters use purple tint plus purple text. Status chips use semantic pairs: green/completed, amber/waiting, red/error, blue/info, slate/default.

### Cards / Containers
- **Corner Style:** Standard dashboard cards use 10px radius; feature/news cards may use 16px. Avoid larger card radii.
- **Background:** White surfaces on the neutral gray workspace. Purple-tinted panels are reserved for selected or highlighted states.
- **Shadow Strategy:** Flat at rest with a 1px border. Hover may add a small shadow; overlays may use stronger shadows.
- **Border:** Standard border is the hairline neutral. Dividers are lighter and should not compete with content.
- **Internal Padding:** Compact widgets use 12-16px. Page-level cards and forms use 20-24px when more breathing room is needed.

### Inputs / Fields
- **Style:** White background, 1px or 1.5px neutral border, 6-8px radius, 13-14px text, and compact vertical padding.
- **Focus:** Purple ring or purple border shift. Never remove focus treatment.
- **Error / Disabled:** Errors use red text plus a red-tinted background or border. Disabled states use muted gray backgrounds and reduced contrast only when still readable.

### Navigation
- **Style:** A black left sidebar with purple uppercase section labels, white or gray nav text, and a white topbar for local tools. The top purple stripe is part of the app identity.
- **Default / Hover / Active:** Default nav items stay quiet. Active routes should be obvious with contrast and purple identity cues. Hover states use tonal shifts, not decoration.
- **Mobile Treatment:** Sidebar becomes an overlay below large screens; topbar controls remain compact and reachable.

### Data Tables
- **Style:** Dense rows, sticky headers where helpful, uppercase 11px headers, 13px body cells, hairline dividers, and horizontal overflow when needed.
- **State:** Skeleton rows are preferred for loading. Empty table rows should explain the absence in one direct sentence.

### Dashboard Hero And Banner Strip
- **Style:** Dashboard hero slides may use image or saturated gradient backgrounds with dark overlays for readable white text. Banner strip uses purple gradient motion for company updates.
- **State:** Motion must be respectful. Carousel and marquee motion should pause or become static under reduced-motion preferences when implemented.

## 6. Do's and Don'ts

### Do:
- **Do** use Arcon Purple for primary action, active selection, focus, progress, links, and identity accents.
- **Do** keep the app background neutral gray and content surfaces white.
- **Do** use system sans typography across product UI.
- **Do** keep controls compact: 6-10px radius, 8-16px button padding, 13-14px body/control text.
- **Do** use skeleton states inside content regions instead of centered spinners when rows or cards are loading.
- **Do** make status chips self-describing with text plus color.
- **Do** preserve the black sidebar and purple top stripe as core identity elements.
- **Do** use inline page styles for dashboard/admin page-specific patterns when that matches the existing codebase.

### Don't:
- **Don't** create "SaaS generic" beige-cream warm-neutral backgrounds or all-caps eyebrow headers on every section.
- **Don't** use "dark mode for its own sake"; the product is a light workspace with a dark navigation shell.
- **Don't** drift into "Enterprise blue-gray corporate" styling. The app should stay professional, warm, and efficient.
- **Don't** let "Flat / gray monoculture" flatten hierarchy. Purple and semantic status color should carry meaning.
- **Don't** build "Cluttered card grids" where every tile has the same weight. Vary hierarchy and density by task.
- **Don't** use gradient text, decorative glassmorphism, or oversized card radii.
- **Don't** pair a 1px bordered card with a broad decorative shadow. Pick a flat card or a purposeful overlay shadow.
- **Don't** use colored side-stripe borders greater than 1px as a default card/list accent. Status should use labels, icons, text, or full-row tint instead.
- **Don't** skip keyboard focus states or rely on color alone for status.
