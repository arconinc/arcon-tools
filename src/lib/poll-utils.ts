import { createAdminClient } from '@/lib/supabase/admin'
import type { PollData, PollOption, PollOptionResult } from '@/types'

export async function getPollData(articleId: string, userId: string, includeVoters: boolean): Promise<PollData> {
  const adminClient = createAdminClient()

  const [{ data: article }, { data: options }, { data: votes }] = await Promise.all([
    adminClient
      .from('news_articles')
      .select('poll_question, poll_is_anonymous')
      .eq('id', articleId)
      .single(),
    adminClient
      .from('poll_options')
      .select('*')
      .eq('article_id', articleId)
      .order('sort_order', { ascending: true }),
    adminClient
      .from('poll_votes')
      .select('option_id, user_id, voter:users!user_id(id, display_name, email)')
      .eq('article_id', articleId),
  ])

  const allVotes = votes ?? []
  const userVote = allVotes.find((v) => v.user_id === userId)?.option_id ?? null
  const counts = allVotes.reduce<Record<string, number>>((acc, vote) => {
    acc[vote.option_id] = (acc[vote.option_id] ?? 0) + 1
    return acc
  }, {})

  const results: PollOptionResult[] = ((options ?? []) as PollOption[]).map((option) => ({
    ...option,
    vote_count: counts[option.id] ?? 0,
    voters: includeVoters
      ? allVotes
          .filter((vote) => vote.option_id === option.id)
          .map((vote) => vote.voter as unknown as { id: string; display_name: string; email: string })
          .filter(Boolean)
      : undefined,
  }))

  return {
    question: article?.poll_question ?? '',
    is_anonymous: article?.poll_is_anonymous ?? true,
    options: results,
    total_votes: allVotes.length,
    user_vote_option_id: userVote,
    can_view_voters: includeVoters,
  }
}

export function validatePollOptions(options: { option_text: string; sort_order: number }[] | undefined) {
  const cleaned = (options ?? [])
    .map((option, index) => ({
      option_text: option.option_text.trim(),
      sort_order: option.sort_order ?? index,
    }))
    .filter((option) => option.option_text.length > 0)

  if (cleaned.length < 1 || cleaned.length > 10) {
    return { error: 'Polls require 1-10 options', options: cleaned }
  }

  return { error: null, options: cleaned }
}
