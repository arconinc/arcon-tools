import sharp from 'sharp'

export type Profile = 'low' | 'mid' | 'high'

/**
 * Front crown height (button to bill seam, as seen head-on) by profile.
 * ponytail: industry-typical values, not per-style specs. Tune here if
 * mockup sizes look consistently off; per-style overrides live in the admin page.
 */
export const CROWN_HEIGHT_IN: Record<Profile, number> = { low: 3.0, mid: 3.5, high: 4.0 }

/** Where the logo center sits between crown top (0) and bill seam (1). Tuned on Richardson 112 blanks. */
export const CENTER_FACTOR = 0.55

export type Geometry = {
  crown_top_y: number
  bill_seam_y: number
  crown_left_x: number
  crown_right_x: number
  center_x: number
  center_y: number
  px_per_inch: number // at 1000px image width
  confidence: number
}

// Vendor blanks sit on pure white (255). Light hats (white, cream, soft blue)
// are only a few levels off white, so the cutoff has to be low.
const BG_THRESHOLD = 4
const MIN_RUN = 3 // consecutive hat pixels needed to count as an edge, not a JPEG speck

/** Row-by-row left/right edges of everything that isn't the white background. */
export async function silhouette(image: Buffer): Promise<{ width: number; height: number; left: number[]; right: number[] }> {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const left = new Array<number>(height).fill(-1)
  const right = new Array<number>(height).fill(-1)
  const isHat = (row: number, x: number) => {
    const i = row + x * channels
    return 255 - Math.min(data[i], data[i + 1], data[i + 2]) > BG_THRESHOLD
  }
  for (let y = 0; y < height; y++) {
    const row = y * width * channels
    let run = 0
    for (let x = 0; x < width; x++) {
      run = isHat(row, x) ? run + 1 : 0
      if (run === MIN_RUN) {
        left[y] = x - MIN_RUN + 1
        break
      }
    }
    if (left[y] < 0) continue
    run = 0
    for (let x = width - 1; x >= 0; x--) {
      run = isHat(row, x) ? run + 1 : 0
      if (run === MIN_RUN) {
        right[y] = x + MIN_RUN - 1
        break
      }
    }
  }
  return { width, height, left, right }
}

/** Typical front-on cap framing, used when measuring fails. Flagged for review. */
export const FALLBACK_GEOMETRY: Omit<Geometry, 'px_per_inch'> = {
  crown_top_y: 0.14,
  bill_seam_y: 0.67,
  crown_left_x: 0.12,
  crown_right_x: 0.88,
  center_x: 0.5,
  center_y: 0.43,
  confidence: 0,
}

/** A geometry the compositor can safely use: crown wide enough and in a sane place. */
export function isPlausible(g: Pick<Geometry, 'crown_left_x' | 'crown_right_x' | 'crown_top_y' | 'bill_seam_y' | 'center_x' | 'px_per_inch'>): boolean {
  const crownW = g.crown_right_x - g.crown_left_x
  const crownH = g.bill_seam_y - g.crown_top_y
  return crownW >= 0.45 && crownH >= 0.4 && g.center_x > 0.35 && g.center_x < 0.65 && g.px_per_inch > 60
}

function fallback(profile: Profile | null): Geometry {
  const crownIn = CROWN_HEIGHT_IN[profile ?? 'mid']
  return { ...FALLBACK_GEOMETRY, px_per_inch: ((FALLBACK_GEOMETRY.bill_seam_y - FALLBACK_GEOMETRY.crown_top_y) * 1000) / crownIn }
}

/** Rolling median of an edge (rows with no hat stay -1). */
export function smoothEdge(edge: number[], radius: number): number[] {
  return edge.map((v, y) => {
    if (v < 0) return -1
    const win: number[] = []
    for (let j = Math.max(0, y - radius); j <= Math.min(edge.length - 1, y + radius); j++) if (edge[j] >= 0) win.push(edge[j])
    win.sort((a, b) => a - b)
    return win[Math.floor(win.length / 2)]
  })
}

/**
 * Finds the crown and the bill seam from the hat outline, then the logo
 * center and pixel scale. All coordinates are normalized 0..1.
 */
export async function computeGeometry(image: Buffer, profile: Profile | null): Promise<Geometry> {
  const { width, height, left, right } = await silhouette(image)
  const minRow = width * 0.03
  const w = left.map((l, y) => (l < 0 ? 0 : right[y] - l))

  const top = w.findIndex((v) => v > minRow)
  let bottom = height - 1
  while (bottom > 0 && w[bottom] <= minRow) bottom--

  // Bill seam: the first sharp change in the outline's direction below mid-crown.
  // On most caps the bill steps out past the crown; on rope caps the crown flares
  // and pinches in at the rope. Either way the outline's slope breaks at the seam.
  // The bill's own bottom curve is a later break, so take the first strong one.
  // Edges are smoothed first so a one-row speck (mesh, JPEG noise) can't win.
  const k = Math.max(6, Math.round(height * 0.02))
  const span = bottom - top
  const sl = smoothEdge(left, Math.max(2, Math.round(height * 0.006)))
  const sr = smoothEdge(right, Math.max(2, Math.round(height * 0.006)))
  const bend = (y: number) => {
    if ([y, y - k, y - 2 * k].some((r) => r < 0 || sl[r] < 0)) return 0
    const l = Math.abs(sl[y - k] - sl[y] - (sl[y - 2 * k] - sl[y - k]))
    const r = Math.abs(sr[y] - sr[y - k] - (sr[y - k] - sr[y - 2 * k]))
    return l + r
  }
  const from = Math.round(top + span * 0.6)
  const to = Math.round(top + span * 0.92)
  let best = 0
  for (let y = from; y <= to; y++) best = Math.max(best, bend(y))
  let seam = -1
  for (let y = from; y <= to && best > 0; y++) {
    if (bend(y) < best * 0.6) continue
    let peak = y // refine to the strongest row of this break
    for (let j = y; j <= Math.min(to, y + 2 * k); j++) if (bend(j) > bend(peak)) peak = j
    seam = peak - k
    break
  }

  let confidence = 1
  if (top < 0 || seam < 0) {
    confidence = 0
    seam = Math.round(top + span * 0.72)
  }
  const crownH = seam - top
  const crownL = left[seam - k] >= 0 ? left[seam - k] : left[seam]
  const crownR = right[seam - k] >= 0 ? right[seam - k] : right[seam]
  const crownW = crownR - crownL

  // Sanity checks lower confidence rather than fail outright.
  const ratio = crownW / Math.max(1, crownH)
  if (ratio < 1.1 || ratio > 2.4) confidence -= 0.4
  if (top / height < 0.03 || top / height > 0.35) confidence -= 0.2
  if (seam / height < 0.45 || seam / height > 0.85) confidence -= 0.3
  if (left.some((l, y) => y > top && y < bottom && (l === 0 || right[y] === width - 1))) confidence -= 0.3
  if (best < width * 0.01) confidence -= 0.3

  const crownIn = CROWN_HEIGHT_IN[profile ?? 'mid']
  const measured: Geometry = {
    crown_top_y: top / height,
    bill_seam_y: seam / height,
    crown_left_x: crownL / width,
    crown_right_x: crownR / width,
    center_x: (crownL + crownR) / 2 / width,
    center_y: (top + CENTER_FACTOR * crownH) / height,
    px_per_inch: ((crownH / height) * 1000) / crownIn,
    confidence: Math.max(0, Math.min(1, confidence)),
  }
  // Never hand the compositor a crown it would shrink the logo into.
  return top >= 0 && isPlausible(measured) ? measured : fallback(profile)
}

/** Two colors of one style should give the same geometry; disagreement means review. */
export function geometriesAgree(a: Geometry, b: Geometry, tol = 0.02): boolean {
  return (
    Math.abs(a.crown_top_y - b.crown_top_y) <= tol &&
    Math.abs(a.bill_seam_y - b.bill_seam_y) <= tol &&
    Math.abs(a.center_x - b.center_x) <= tol &&
    Math.abs(a.crown_left_x - b.crown_left_x) <= tol &&
    Math.abs(a.crown_right_x - b.crown_right_x) <= tol
  )
}

export const REVIEW_BELOW = 0.6

/** Average two agreeing results; flag for review when they disagree or either is weak. */
export function mergeGeometry(a: Geometry, b: Geometry | null): Geometry & { needs_review: boolean } {
  if (!b) return { ...a, needs_review: a.confidence < REVIEW_BELOW }
  const agree = geometriesAgree(a, b)
  const avg = (x: number, y: number) => (x + y) / 2
  const merged: Geometry = {
    crown_top_y: avg(a.crown_top_y, b.crown_top_y),
    bill_seam_y: avg(a.bill_seam_y, b.bill_seam_y),
    crown_left_x: avg(a.crown_left_x, b.crown_left_x),
    crown_right_x: avg(a.crown_right_x, b.crown_right_x),
    center_x: avg(a.center_x, b.center_x),
    center_y: avg(a.center_y, b.center_y),
    px_per_inch: avg(a.px_per_inch, b.px_per_inch),
    confidence: agree ? Math.min(a.confidence, b.confidence) : Math.min(a.confidence, b.confidence) * 0.5,
  }
  return { ...merged, needs_review: !agree || merged.confidence < REVIEW_BELOW }
}

/** Relative luminance 0..1 of a #rrggbb hex. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0.5
  const n = parseInt(m[1], 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

/** WCAG contrast ratio between two hex colors (1..21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
