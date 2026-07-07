import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ vendorId: string }> }

// GET /api/public/vendor-relations/[vendorId] — public, no auth.
// Returns the vendor's public details plus currently-open demo slots.
export async function GET(_req: Request, { params }: Params) {
  const { vendorId } = await params
  const adminClient = createAdminClient()

  const { data: vendor, error: vendorError } = await adminClient
    .from('crm_vendors')
    .select('id, name, phone, website')
    .eq('id', vendorId)
    .single()

  if (vendorError || !vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
  }

  const { data: slots, error: slotsError } = await adminClient
    .from('vendor_demo_slots')
    .select('id, start_time, end_time')
    .eq('status', 'open')
    .order('start_time', { ascending: true })

  if (slotsError) {
    return NextResponse.json({ error: 'Unable to load open time slots' }, { status: 500 })
  }

  return NextResponse.json({ vendor, slots: slots ?? [] })
}
