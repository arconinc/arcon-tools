import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Comment counts keyed by article id, for the listing cards.
 * ponytail: counts in JS over one `in` query — listings cap at 50 articles,
 * so a grouped view/RPC only earns its keep if that cap grows a lot.
 */
export async function getCommentCounts(articleIds: string[]): Promise<Record<string, number>> {
  if (articleIds.length === 0) return {}

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('news_comments')
    .select('article_id')
    .in('article_id', articleIds)

  return (data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.article_id] = (acc[row.article_id] ?? 0) + 1
    return acc
  }, {})
}
