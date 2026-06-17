import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PtoRequestForm } from '@/components/hr/PtoRequestForm'
import { PtoRequest } from '@/types'

export default async function EditPtoRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: dbUser } = await adminClient
    .from('users')
    .select('id')
    .eq('google_id', user.id)
    .single()
  if (!dbUser) redirect('/login')

  const { data: request } = await adminClient
    .from('pto_requests')
    .select('*')
    .eq('id', id)
    .eq('user_id', dbUser.id)
    .single()

  if (!request || request.status === 'approved') redirect('/hr/pto')

  return <PtoRequestForm existing={request as PtoRequest} />
}
