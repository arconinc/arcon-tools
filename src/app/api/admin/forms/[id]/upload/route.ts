import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()
  return appUser?.is_admin ? appUser : null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 })
  if (!file.type.includes('pdf') && !file.type.includes('document')) {
    return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const fileName = `${Date.now()}-${file.name}`
  const bucketPath = `forms/${id}/${fileName}`
  const buffer = await file.arrayBuffer()

  const { error: uploadError } = await adminClient.storage
    .from('forms')
    .upload(bucketPath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = adminClient.storage.from('forms').getPublicUrl(bucketPath)

  const { data: form, error: updateError } = await adminClient
    .from('forms')
    .update({
      file_url: publicUrl,
      file_size_bytes: file.size,
      mime_type: file.type,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ form, file_url: publicUrl })
}
