import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { contactFormSubmitted } from '@/lib/notifications/registry'

const RESERVED_KEYS = new Set(['title', 'source'])

function toLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

function formatDescriptionText(fields: Array<{ label: string; value: string }>): string {
  return fields.map(f => `${f.label}: ${f.value}`).join('\n')
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.CONTACT_FORM_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token || token !== apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const source = typeof body.source === 'string' ? body.source.trim() : 'arconinc.com'

  const fields: Array<{ label: string; value: string }> = Object.entries(body)
    .filter(([key]) => !RESERVED_KEYS.has(key))
    .map(([key, val]) => ({
      label: toLabel(key),
      value: val == null ? '' : String(val),
    }))
    .filter(f => f.value !== '')

  const description = formatDescriptionText(fields)

  const adminClient = createAdminClient()

  // crm_tasks.created_by is NOT NULL — use a system actor (first active admin)
  const { data: systemUser } = await adminClient
    .from('users')
    .select('id')
    .eq('is_admin', true)
    .is('deactivated_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!systemUser) {
    console.error('[public/contact] no admin user found for system actor')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const { data: task, error } = await adminClient
    .from('crm_tasks')
    .insert({
      title,
      department: 'CRM',
      description: description || null,
      status: 'not_started',
      priority: 'medium',
      progress: 0,
      created_by: systemUser.id,
      task_owner: systemUser.id,
    })
    .select()
    .single()

  if (error) {
    console.error('[public/contact] task insert failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  try {
    await dispatchNotification({
      definition: contactFormSubmitted,
      payload: {
        task_id: task.id,
        task_title: title,
        source,
        fields,
      },
      recipientSpec: { department: 'CRM' },
    })
  } catch (err) {
    console.error('[public/contact] notification dispatch failed:', err)
  }

  return NextResponse.json({ ok: true, task_id: task.id }, { status: 201 })
}
