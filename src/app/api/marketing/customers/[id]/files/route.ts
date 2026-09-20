import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, notFound, badRequest, serverError, created, ok } from '@/lib/api/respond'

// POST /api/marketing/customers/[id]/files
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { id } = await params
  const body = await req.json()
  const { label, url } = body

  if (!label?.trim()) return badRequest('label is required')
  if (!url?.trim()) return badRequest('url is required')

  const adminClient = createAdminClient()

  const { data: customer } = await adminClient.from('crm_customers').select('id').eq('id', id).single()
  if (!customer) return notFound('Customer not found')

  const { data, error } = await adminClient
    .from('crm_files')
    .insert({ customer_id: id, label: label.trim(), url, added_by: appUser.id })
    .select('id, label, url, created_at')
    .single()

  if (error) return serverError(error.message)
  return created(data)
}

// DELETE /api/marketing/customers/[id]/files — bulk delete (unused, kept for parity)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { id } = await params
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('crm_files')
    .select('id, label, url, created_at')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  if (error) return serverError(error.message)
  return ok(data ?? [])
}
