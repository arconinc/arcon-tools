import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/marketing/spec-ideas/suggest?customerId=<uuid>&limit=8
// Returns spec ideas scored by tag/category overlap with this customer's prior spec history.
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customerId')
  const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') ?? '8', 10)))

  if (!customerId) return NextResponse.json({ error: 'customerId is required' }, { status: 400 })

  const adminClient = createAdminClient()

  // Get all ideas that have been previously sent to this customer (by spec_idea_id)
  const { data: priorSpecs } = await adminClient
    .from('spec_samples')
    .select('spec_idea_id, item_name, vendor')
    .eq('customer_id', customerId)
    .not('spec_idea_id', 'is', null)

  const sentIdeaIds = new Set((priorSpecs ?? []).map((s: any) => s.spec_idea_id).filter(Boolean))

  // Gather tags/categories from prior specs to score against
  let knownTags: string[] = []
  let knownCategories: string[] = []
  let knownVendors: string[] = []

  if (sentIdeaIds.size > 0) {
    const { data: priorIdeas } = await adminClient
      .from('spec_ideas')
      .select('tags, category, vendor')
      .in('id', [...sentIdeaIds])

    for (const idea of priorIdeas ?? []) {
      if (Array.isArray(idea.tags)) knownTags.push(...idea.tags)
      if (idea.category) knownCategories.push(idea.category)
      if (idea.vendor) knownVendors.push(idea.vendor)
    }
  }

  // Also get categories/vendors from free-form specs (no spec_idea_id)
  const { data: freeSpecs } = await adminClient
    .from('spec_samples')
    .select('vendor')
    .eq('customer_id', customerId)
    .is('spec_idea_id', null)

  for (const s of freeSpecs ?? []) {
    if (s.vendor) knownVendors.push(s.vendor)
  }

  knownTags = [...new Set(knownTags)]
  knownCategories = [...new Set(knownCategories)]
  knownVendors = [...new Set(knownVendors)]

  // Fetch all active ideas not already sent to this customer
  const { data: allIdeas } = await adminClient
    .from('spec_ideas')
    .select('*')
    .eq('is_active', true)

  const ideas = (allIdeas ?? []).filter((i: any) => !sentIdeaIds.has(i.id))

  // Score each idea
  const scored = ideas.map((idea: any) => {
    let score = 0
    const ideaTags: string[] = Array.isArray(idea.tags) ? idea.tags : []
    // Tag overlap
    for (const t of ideaTags) {
      if (knownTags.includes(t)) score += 3
    }
    // Category match
    if (idea.category && knownCategories.includes(idea.category)) score += 2
    // Vendor match
    if (idea.vendor && knownVendors.map((v: string) => v.toLowerCase()).includes(idea.vendor.toLowerCase())) score += 1
    return { ...idea, _score: score }
  })

  // Sort: scored items first (desc score), then remaining alphabetically
  scored.sort((a: any, b: any) => {
    if (b._score !== a._score) return b._score - a._score
    return a.item_name.localeCompare(b.item_name)
  })

  const results = scored.slice(0, limit).map(({ _score: _, ...idea }: any) => idea)
  return NextResponse.json(results)
}
