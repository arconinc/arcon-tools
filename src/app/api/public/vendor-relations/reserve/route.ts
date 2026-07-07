import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { taskAssigned } from '@/lib/notifications/registry'
import { resolveRecipients } from '@/lib/notifications/recipients'

// POST /api/public/vendor-relations/reserve — public, no auth.
// Vendor books an open slot. Reservation is a single conditional update so two
// simultaneous submissions for the same slot can't both succeed (race guard).
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const vendorId = typeof body.vendor_id === 'string' ? body.vendor_id.trim() : ''
  const slotId = typeof body.slot_id === 'string' ? body.slot_id.trim() : ''
  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

  if (!vendorId) return NextResponse.json({ error: 'vendor_id is required' }, { status: 400 })
  if (!slotId) return NextResponse.json({ error: 'slot_id is required' }, { status: 400 })

  const adminClient = createAdminClient()

  const { data: vendor, error: vendorError } = await adminClient
    .from('crm_vendors')
    .select('id, name')
    .eq('id', vendorId)
    .single()

  if (vendorError || !vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
  }

  const { data: slot, error: reserveError } = await adminClient
    .from('vendor_demo_slots')
    .update({
      status: 'reserved',
      vendor_id: vendorId,
      vendor_notes: notes || null,
      reserved_at: new Date().toISOString(),
    })
    .eq('id', slotId)
    .eq('status', 'open')
    .select()
    .single()

  if (reserveError || !slot) {
    return NextResponse.json(
      { error: 'That time slot was just booked by someone else. Please choose another.' },
      { status: 409 }
    )
  }

  // crm_tasks.created_by is NOT NULL — use a system actor (first active admin)
  const { data: systemUser } = await adminClient
    .from('users')
    .select('id')
    .eq('is_admin', true)
    .is('deactivated_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const marketingPool = await resolveRecipients({ department: 'Marketing' })
  const assigneeId = marketingPool[0]?.id ?? systemUser?.id ?? null

  if (systemUser && assigneeId) {
    const submittedAt = new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'full',
      timeStyle: 'short',
    })
    const startLabel = new Date(slot.start_time).toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'full',
      timeStyle: 'short',
    })
    const endLabel = new Date(slot.end_time).toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      timeStyle: 'short',
    })

    const description = [
      `VENDOR: ${vendor.name}`,
      `TIME: ${startLabel} – ${endLabel}`,
      '',
      'NOTES FROM VENDOR',
      notes || '(none)',
      '',
      `Submitted: ${submittedAt} CT`,
    ].join('\n')

    const { data: task, error: taskError } = await adminClient
      .from('crm_tasks')
      .insert({
        title: `Vendor Demo Scheduled — ${vendor.name}`,
        description,
        vendor_id: vendorId,
        status: 'not_started',
        priority: 'medium',
        progress: 0,
        assigned_to: assigneeId,
        task_owner: assigneeId,
        created_by: systemUser.id,
        due_date: slot.start_time.slice(0, 10),
      })
      .select('id')
      .single()

    if (taskError) {
      console.error('[public/vendor-relations/reserve] task insert failed:', taskError)
    } else {
      await adminClient.from('vendor_demo_slots').update({ task_id: task.id }).eq('id', slot.id)

      try {
        await dispatchNotification({
          definition: taskAssigned,
          payload: {
            task_id: task.id,
            task_title: `Vendor Demo Scheduled — ${vendor.name}`,
            actor_id: systemUser.id,
            actor_name: 'Vendor Relations',
            department: null,
            due_date: slot.start_time.slice(0, 10),
            priority: 'medium',
            status: 'not_started',
            description,
            fanout_kind: 'user',
          },
          recipientSpec: { userId: assigneeId },
        })
      } catch (err) {
        console.error('[public/vendor-relations/reserve] notification dispatch failed:', err)
      }
    }
  } else {
    console.error('[public/vendor-relations/reserve] no system user or assignee found for task creation')
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
