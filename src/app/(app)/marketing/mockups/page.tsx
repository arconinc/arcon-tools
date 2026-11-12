import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { HatMockupAssistant } from '@/components/mockups/HatMockupAssistant'
import { requireUser } from '@/lib/crm/require-user'
import { isRealismConfigured } from '@/lib/hat-mockup/realism'
import { createAdminClient } from '@/lib/supabase/admin'

type Props = { searchParams: Promise<{ customer_id?: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function HatMockupsPage({ searchParams }: Props) {
  const user = await requireUser()
  if (!user) notFound()

  const { customer_id } = await searchParams
  let customer: { id: string; name: string } | null = null
  if (customer_id && UUID.test(customer_id)) {
    const { data } = await createAdminClient().from('crm_customers').select('id, name').eq('id', customer_id).maybeSingle()
    customer = data ?? null
  }

  return (
    <>
      <PageHeader title="Hat Mockups" subtitle="Put a customer's logo on a hat in a few clicks" bg="/marketing_bg.png" />
      <HatMockupAssistant initialCustomer={customer} realismEnabled={isRealismConfigured()} />
    </>
  )
}
