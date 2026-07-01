import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { isMarketingCalendarEditor } from '@/lib/marketing/calendar-access'

// POST /api/marketing/calendar-events/upload
// Accepts multipart/form-data with `file` field, uploads to marketing-calendar-art bucket.
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  if (!(await isMarketingCalendarEditor(adminClient, appUser.id, appUser.is_admin))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'File must be 5MB or smaller' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'jpg'
  const filename = `event-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await adminClient.storage
    .from('marketing-calendar-art')
    .upload(filename, buffer, { contentType: file.type, upsert: false })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: { publicUrl } } = adminClient.storage.from('marketing-calendar-art').getPublicUrl(filename)
  return NextResponse.json({ url: publicUrl }, { status: 201 })
}
