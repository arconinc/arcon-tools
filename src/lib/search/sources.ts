import { createAdminClient } from '@/lib/supabase/admin'
import { getDocAccessContext, filterAccessibleDocuments } from '@/lib/documents/access'
import { sectionSlug } from '@/lib/documents/section-slugs'
import { stripHtml } from '@/lib/news-utils'
import { DEPARTMENT_DISPLAY_NAMES } from '@/lib/task-constants'
import type { CrmTaskDepartment } from '@/types'

type Admin = ReturnType<typeof createAdminClient>

export type SearchResultType = 'customer' | 'contact' | 'vendor' | 'document' | 'task'

export interface SearchResult {
  type: SearchResultType
  id: string
  title: string
  subtitle: string | null
  url: string
  score: number
  contactTitle?: string | null
  organizations?: { name: string; url: string }[]
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
        url: `/sales/customers/${c.id}`,
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
        .select('id, first_name, last_name, email, title, customer_id, vendor_id')
        .or(nameFilter)
        .limit(LIMIT)

      const contacts = data ?? []
      const customerIds = [...new Set(contacts.map(c => c.customer_id).filter((id): id is string => Boolean(id)))]
      const vendorIds = [...new Set(contacts.map(c => c.vendor_id).filter((id): id is string => Boolean(id)))]
      const [customersRes, vendorsRes] = await Promise.all([
        customerIds.length > 0
          ? admin.from('crm_customers').select('id, name').in('id', customerIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        vendorIds.length > 0
          ? admin.from('crm_vendors').select('id, name').in('id', vendorIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ])
      const customerNames = new Map((customersRes.data ?? []).map(c => [c.id, c.name]))
      const vendorNames = new Map((vendorsRes.data ?? []).map(v => [v.id, v.name]))

      return contacts.map(c => {
        const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
        const organizations = [
          c.customer_id && customerNames.get(c.customer_id)
            ? { name: customerNames.get(c.customer_id)!, url: `/sales/customers/${c.customer_id}` }
            : null,
          c.vendor_id && vendorNames.get(c.vendor_id)
            ? { name: vendorNames.get(c.vendor_id)!, url: `/sales/suppliers/${c.vendor_id}` }
            : null,
        ].filter((organization): organization is { name: string; url: string } => Boolean(organization))
        const subtitleParts = [c.title, ...organizations.map(organization => organization.name)].filter((part): part is string => Boolean(part))
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
          subtitle: subtitleParts.length > 0 ? subtitleParts.join(', ') : c.email || null,
          url: `/sales/contacts/${c.id}`,
          score,
          contactTitle: c.title,
          organizations,
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
        url: `/sales/suppliers/${v.id}`,
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
        .select('id, title, description, owner_id, required_role, folder_id, doc_folders(name, doc_sections(name))')
        .or(`title.ilike.${p},description.ilike.${p}`)
        .limit(20) // over-fetch; access filter trims below
      const visible = await filterAccessibleDocuments(admin, data ?? [], ctx)
      return visible.map(d => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const folder = (d as any).doc_folders
        const sectionName = folder?.doc_sections?.name as string | undefined
        return {
          type: 'document' as const,
          id: d.id,
          title: d.title,
          subtitle: folder?.name ?? null,
          url: sectionName ? `/documents/${sectionSlug(sectionName)}?folder=${d.folder_id}&doc=${d.id}` : '/documents',
          score: Math.max(scoreMatch(d.title, term), scoreMatch(d.description, term) ? 25 : 0),
        }
      })
    },
  },
  {
    type: 'task',
    typeWeight: 1,
    async run(admin, term) {
      const p = ilikePattern(term)
      const [tasksRes, commentsRes] = await Promise.all([
        admin
          .from('crm_tasks')
          .select('id, title, description, department')
          .or(`title.ilike.${p},description.ilike.${p}`)
          .neq('status', 'completed')
          .limit(LIMIT),
        admin
          .from('crm_task_comments')
          .select('task_id, comment')
          .ilike('comment', p)
          .limit(LIMIT),
      ])

      const results = new Map<string, { title: string; subtitle: string | null; score: number }>()
      for (const t of tasksRes.data ?? []) {
        const department = t.department as CrmTaskDepartment | null
        results.set(t.id, {
          title: t.title,
          subtitle: department ? DEPARTMENT_DISPLAY_NAMES[department] : null,
          score: Math.max(scoreMatch(t.title, term), scoreMatch(t.description, term) ? 25 : 0),
        })
      }

      const comments = commentsRes.data ?? []
      const missingTaskIds = [...new Set(comments.map(c => c.task_id).filter((id): id is string => Boolean(id) && !results.has(id)))]
      if (missingTaskIds.length > 0) {
        const { data: extraTasks } = await admin.from('crm_tasks').select('id, title, department').in('id', missingTaskIds).neq('status', 'completed')
        for (const t of extraTasks ?? []) {
          const department = t.department as CrmTaskDepartment | null
          results.set(t.id, { title: t.title, subtitle: department ? DEPARTMENT_DISPLAY_NAMES[department] : null, score: 0 })
        }
      }
      for (const c of comments) {
        const existing = c.task_id ? results.get(c.task_id) : undefined
        if (!existing) continue
        const snippet = stripHtml(c.comment).trim()
        if (snippet && existing.score < 25) results.set(c.task_id!, { ...existing, subtitle: snippet.slice(0, 80), score: 25 })
      }

      return [...results.entries()].map(([id, r]) => ({
        type: 'task' as const,
        id,
        title: r.title,
        subtitle: r.subtitle,
        url: `/tasks/${id}`,
        score: r.score,
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
