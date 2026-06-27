import { createAdminClient } from '@/lib/supabase/admin'
import { getDocAccessContext, filterAccessibleDocuments } from '@/lib/documents/access'

type Admin = ReturnType<typeof createAdminClient>

export type SearchResultType = 'customer' | 'contact' | 'vendor' | 'document'

export interface SearchResult {
  type: SearchResultType
  id: string
  title: string
  subtitle: string | null
  url: string
  score: number
}

export interface SearchSource {
  type: SearchResultType
  typeWeight: number // tiebreaker when scores are equal (higher wins)
  run(admin: Admin, term: string): Promise<SearchResult[]>
}

const LIMIT = 8

// Relevance score for a term within a piece of text.
// exact 100 / starts-with 75 / word-boundary 50 / contains 25 / no match 0.
export function scoreMatch(text: string | null | undefined, q: string): number {
  if (!text) return 0
  const t = text.toLowerCase()
  const needle = q.toLowerCase()
  if (t === needle) return 100
  if (t.startsWith(needle)) return 75
  const idx = t.indexOf(needle)
  if (idx === -1) return 0
  // word boundary: preceded by a non-alphanumeric char
  if (idx > 0 && /[^a-z0-9]/.test(t[idx - 1])) return 50
  return 25
}

// Escape % and _ so they are treated literally inside an ILIKE pattern.
function ilikePattern(term: string): string {
  return `%${term.replace(/[%_]/g, m => `\\${m}`)}%`
}

export const SEARCH_SOURCES: SearchSource[] = [
  {
    type: 'customer',
    typeWeight: 3,
    async run(admin, term) {
      const { data } = await admin
        .from('crm_customers')
        .select('id, name, industry, billing_city')
        .ilike('name', ilikePattern(term))
        .limit(LIMIT)
      return (data ?? []).map(c => ({
        type: 'customer' as const,
        id: c.id,
        title: c.name,
        subtitle: c.industry || c.billing_city || null,
        url: `/marketing/customers/${c.id}`,
        score: scoreMatch(c.name, term),
      }))
    },
  },
  {
    type: 'contact',
    typeWeight: 2,
    async run(admin, term) {
      const p = ilikePattern(term)
      const parts = term.split(/\s+/).filter(Boolean)
      const nameFilter = parts.length > 1
        ? `and(first_name.ilike.${ilikePattern(parts[0])},last_name.ilike.${ilikePattern(parts.slice(1).join(' '))}),and(first_name.ilike.${ilikePattern(parts.slice(1).join(' '))},last_name.ilike.${ilikePattern(parts[0])}),email.ilike.${p}`
        : `first_name.ilike.${p},last_name.ilike.${p},email.ilike.${p}`
      const { data } = await admin
        .from('crm_contacts')
        .select('id, first_name, last_name, email, title')
        .or(nameFilter)
        .limit(LIMIT)
      return (data ?? []).map(c => {
        const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
        // best score across the searchable fields
        const score = Math.max(
          scoreMatch(name, term),
          scoreMatch(c.first_name, term),
          scoreMatch(c.last_name, term),
          scoreMatch(c.email, term),
        )
        return {
          type: 'contact' as const,
          id: c.id,
          title: name || c.email || 'Contact',
          subtitle: c.title || c.email || null,
          url: `/marketing/contacts/${c.id}`,
          score,
        }
      })
    },
  },
  {
    type: 'vendor',
    typeWeight: 1,
    async run(admin, term) {
      const { data } = await admin
        .from('crm_vendors')
        .select('id, name, product_line, specialty')
        .ilike('name', ilikePattern(term))
        .limit(LIMIT)
      return (data ?? []).map(v => ({
        type: 'vendor' as const,
        id: v.id,
        title: v.name,
        subtitle: v.product_line || v.specialty || null,
        url: `/marketing/vendors/${v.id}`,
        score: scoreMatch(v.name, term),
      }))
    },
  },
  {
    type: 'document',
    typeWeight: 0,
    async run(admin, term) {
      const ctx = await getDocAccessContext(admin)
      if (!ctx) return []
      const p = ilikePattern(term)
      const { data } = await admin
        .from('documents')
        .select('id, title, description, owner_id, required_role, doc_folders(name)')
        .or(`title.ilike.${p},description.ilike.${p}`)
        .limit(20) // over-fetch; access filter trims below
      const visible = await filterAccessibleDocuments(admin, data ?? [], ctx)
      return visible.map(d => ({
        type: 'document' as const,
        id: d.id,
        title: d.title,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        subtitle: (d as any).doc_folders?.name ?? null,
        url: '/documents',
        score: Math.max(scoreMatch(d.title, term), scoreMatch(d.description, term) ? 25 : 0),
      }))
    },
  },
]

// Runs all sources in parallel, merges, ranks (score desc, then typeWeight desc),
// and returns the top `max` results.
export async function runUniversalSearch(term: string, max = 20): Promise<SearchResult[]> {
  const admin = createAdminClient()
  const weightOf = new Map(SEARCH_SOURCES.map(s => [s.type, s.typeWeight]))
  const batches = await Promise.all(SEARCH_SOURCES.map(s => s.run(admin, term)))
  return batches
    .flat()
    .sort((a, b) => b.score - a.score || (weightOf.get(b.type)! - weightOf.get(a.type)!))
    .slice(0, max)
}
