import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { cloudinary } from '@/lib/cloudinary'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/crm/artwork/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { name, description } = body

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_artwork')
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/crm/artwork/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const adminClient = createAdminClient()

  // Fetch the row first to get cloudinary fields
  const { data: artwork, error: fetchErr } = await adminClient
    .from('crm_artwork')
    .select('cloudinary_public_id, cloudinary_resource_type, is_drive_link')
    .eq('id', id)
    .single()

  if (fetchErr || !artwork) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete from Cloudinary if this is an uploaded file
  if (!artwork.is_drive_link && artwork.cloudinary_public_id) {
    const resourceType = (artwork.cloudinary_resource_type as string) || 'image'
    await cloudinary.uploader.destroy(artwork.cloudinary_public_id, { resource_type: resourceType })
  }

  const { error } = await adminClient.from('crm_artwork').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
