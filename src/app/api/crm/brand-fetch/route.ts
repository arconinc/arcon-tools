import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

function extractDomain(website: string | null): string | null {
  if (!website) return null
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// POST /api/crm/brand-fetch
// Body: { entity_type: 'vendor' | 'customer', entity_id: string }
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { entity_type, entity_id } = await req.json()
  if (!entity_type || !entity_id) {
    return NextResponse.json({ error: 'entity_type and entity_id are required' }, { status: 400 })
  }
  if (entity_type !== 'vendor' && entity_type !== 'customer') {
    return NextResponse.json({ error: 'entity_type must be vendor or customer' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const table = entity_type === 'vendor' ? 'crm_vendors' : 'crm_customers'

  // Fetch the entity to get website
  const { data: entity, error: entityError } = await adminClient
    .from(table)
    .select('id, website, brand_data_id')
    .eq('id', entity_id)
    .single()

  if (entityError || !entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
  }

  const domain = extractDomain(entity.website)
  if (!domain) {
    return NextResponse.json({ error: 'no_website', message: 'This record has no website URL. Add a website to fetch brand data.' }, { status: 422 })
  }

  // Check for cached brand data (< 30 days old)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: existing } = await adminClient
    .from('crm_brand_data')
    .select('*')
    .eq('domain', domain)
    .gt('fetched_at', thirtyDaysAgo)
    .single()

  if (existing) {
    // Link FK if not already linked, and sync linkedin if found
    const linkedinFromCache = (existing.links as { name: string; url: string }[] | null)
      ?.find((l) => l.name.toLowerCase() === 'linkedin')?.url ?? null
    const cacheUpdate: Record<string, unknown> = {}
    if (entity.brand_data_id !== existing.id) {
      cacheUpdate.brand_data_id = existing.id
      cacheUpdate.logo_url = existing.logo_url
    }
    if (linkedinFromCache) cacheUpdate.linkedin = linkedinFromCache
    if (Object.keys(cacheUpdate).length > 0) {
      await adminClient.from(table).update(cacheUpdate).eq('id', entity_id)
    }
    return NextResponse.json({ brand_data: existing, cached: true, linkedin: linkedinFromCache })
  }

  // Fetch from Brandfetch
  const apiKey = process.env.BRANDFETCH_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'server_error', message: 'Brandfetch API key is not configured.' }, { status: 500 })
  }

  const bfRes = await fetch(`https://api.brandfetch.io/v2/brands/${domain}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (bfRes.status === 429) {
    return NextResponse.json({
      error: 'rate_limit',
      message: 'Brandfetch API limit reached (100 calls/month on free tier). Try again next month or upgrade your Brandfetch plan.',
    }, { status: 429 })
  }

  if (bfRes.status === 404) {
    return NextResponse.json({
      error: 'not_found',
      message: `No brand data found for "${domain}" on Brandfetch.`,
    }, { status: 404 })
  }

  if (!bfRes.ok) {
    return NextResponse.json({
      error: 'brandfetch_error',
      message: `Brandfetch returned an error (${bfRes.status}). Please try again.`,
    }, { status: 502 })
  }

  const bf = await bfRes.json()

  // Extract logo and icon URLs
  const logoEntry = (bf.logos ?? []).find((l: any) => l.type === 'logo')
  const logo_url: string | null = logoEntry?.formats?.[0]?.src ?? null

  const iconEntry = (bf.logos ?? []).find((l: any) => l.type === 'icon')
  const icon_url: string | null = iconEntry?.formats?.[0]?.src ?? null

  const brandRecord = {
    domain,
    brandfetch_id: bf.id ?? null,
    name: bf.name ?? null,
    description: bf.description ?? null,
    long_description: bf.longDescription ?? null,
    logo_url,
    icon_url,
    colors: bf.colors ?? null,
    links: bf.links ?? null,
    company: bf.company ?? null,
    raw_data: bf,
    fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Upsert brand data (conflict on domain)
  const { data: brandData, error: upsertError } = await adminClient
    .from('crm_brand_data')
    .upsert(brandRecord, { onConflict: 'domain' })
    .select()
    .single()

  if (upsertError || !brandData) {
    return NextResponse.json({ error: 'server_error', message: 'Failed to save brand data.' }, { status: 500 })
  }

  // Extract LinkedIn URL from brand links
  const linkedinUrl = (bf.links as { name: string; url: string }[] | null)
    ?.find((l) => l.name.toLowerCase() === 'linkedin')?.url ?? null

  // Update entity with brand_data_id, denormalized logo_url, and linkedin if found
  const entityUpdate: Record<string, unknown> = { brand_data_id: brandData.id, logo_url: brandData.logo_url }
  if (linkedinUrl) entityUpdate.linkedin = linkedinUrl
  await adminClient.from(table).update(entityUpdate).eq('id', entity_id)

  return NextResponse.json({ brand_data: brandData, cached: false, linkedin: linkedinUrl })
}
