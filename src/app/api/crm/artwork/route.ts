import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/crm/artwork?customer_id=
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customerId = req.nextUrl.searchParams.get('customer_id')
  if (!customerId) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_artwork')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

// POST /api/crm/artwork
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    customer_id,
    name,
    description,
    url,
    cloudinary_public_id,
    cloudinary_resource_type,
    thumbnail_url,
    file_name,
    file_size,
    mime_type,
    width,
    height,
    is_drive_link,
  } = body

  if (!customer_id || !name || !url) {
    return NextResponse.json({ error: 'customer_id, name, and url are required' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_artwork')
    .insert({
      customer_id,
      name,
      description: description ?? null,
      url,
      cloudinary_public_id: cloudinary_public_id ?? null,
      cloudinary_resource_type: cloudinary_resource_type ?? null,
      thumbnail_url: thumbnail_url ?? null,
      file_name: file_name ?? null,
      file_size: file_size ?? null,
      mime_type: mime_type ?? null,
      width: width ?? null,
      height: height ?? null,
      is_drive_link: is_drive_link ?? false,
      added_by: appUser.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
