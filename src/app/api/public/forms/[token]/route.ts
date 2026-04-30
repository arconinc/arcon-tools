import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    const adminClient = await createAdminClient()

    // Get form by public token
    const { data: form, error } = await adminClient
      .from('forms')
      .select('*')
      .eq('public_token', token)
      .eq('public_token_active', true)
      .single()

    if (error || !form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    // Redirect to the actual file URL in Supabase Storage
    return NextResponse.redirect(form.file_url)
  } catch (error) {
    console.error('GET /api/public/forms/[token] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
