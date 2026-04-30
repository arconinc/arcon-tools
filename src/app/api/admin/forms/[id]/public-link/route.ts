import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generatePublicToken } from '@/lib/forms-utils'

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: form, error } = await adminClient
    .from('forms')
    .select('public_token, public_token_active')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!form?.public_token) return NextResponse.json({ public_token: null, public_token_active: false })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return NextResponse.json({
    public_token: form.public_token,
    public_token_active: form.public_token_active,
    public_url: `${siteUrl}/api/public/forms/${form.public_token}`,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { action } = await req.json()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const adminClient = createAdminClient()

  if (action === 'generate') {
    const token = generatePublicToken()
    const { data: form, error } = await adminClient
      .from('forms')
      .update({ public_token: token, public_token_active: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({
      public_token: form.public_token,
      public_token_active: form.public_token_active,
      public_url: `${siteUrl}/api/public/forms/${form.public_token}`,
    })
  }

  if (action === 'activate' || action === 'deactivate') {
    const { error } = await adminClient
      .from('forms')
      .update({ public_token_active: action === 'activate', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
