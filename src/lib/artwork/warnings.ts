// Client-safe (no sharp): shared by the artwork grid, the mockup page, and the analyzer.

export const EMBROIDERY_WARNINGS = ['tiny_text', 'fine_lines', 'gradient', 'too_many_colors', 'photo'] as const
export type EmbroideryWarning = (typeof EMBROIDERY_WARNINGS)[number]

export const WARNING_LABELS: Record<EmbroideryWarning, string> = {
  tiny_text: 'Tiny text',
  fine_lines: 'Fine lines',
  gradient: 'Gradient',
  too_many_colors: 'Many colors',
  photo: 'Photo, not a logo',
}

export type ArtworkAnalysis = {
  supported: boolean
  has_background?: boolean
  colors?: string[]
  warnings?: EmbroideryWarning[]
  notes?: string
  analyzed_at: string
}
