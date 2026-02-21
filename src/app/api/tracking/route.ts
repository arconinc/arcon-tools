import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthHeader } from '@/lib/credentials'
import { addShipment, sendNotificationEmail } from '@/lib/promobuillit/api'
import { logAudit } from '@/lib/audit'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { storeId, orderId, carrierId, trackingNumber, trackingUrl, shipmentDate, sendEmail, customerName, customerEmail } = body

  if (!storeId || !orderId || !carrierId || !trackingNumber) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient.from('users').select('id').eq('google_id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const authHeader = await getAuthHeader(appUser.id)
  if (!authHeader) return NextResponse.json({ error: 'PromoBullit credentials not configured' }, { status: 400 })

  // ── Step A: Create shipment ──────────────────────────────────────────────
  let shipmentId: string
  try {
    const shipmentResult = await addShipment(
      storeId,
      orderId,
      { carrierId, trackingNumber, trackingUrl: trackingUrl ?? '', shipmentDate },
      authHeader
    )
    shipmentId = shipmentResult.id

    await logAudit({
      userId: appUser.id,
      action: 'add_shipment',
      storeId,
      orderId,
      details: { carrierId, trackingNumber, shipmentId },
      status: 'success',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await logAudit({
      userId: appUser.id,
      action: 'add_shipment',
      storeId,
      orderId,
      details: { carrierId, trackingNumber, error: message },
      status: 'error',
    })
    return NextResponse.json(
      { error: `Failed to add shipment: ${message}`, step: 'shipment' },
      { status: 502 }
    )
  }

  // ── Step B: Send notification email (only if requested) ──────────────────
  if (!sendEmail) {
    // Email skipped by user choice — shipment-only success
    return NextResponse.json({ success: true, shipmentId, customerEmail, emailSent: false })
  }

  try {
    await sendNotificationEmail(
      storeId,
      orderId,
      {
        id: orderId,
        status: 'new',
        notificationEmail: {
          subject: `Order update (order #${orderId}).`,
          body: `<p>Dear ${customerName ?? 'Customer'},</p><p>Your order has been shipped!</p><p>Your tracking number is: <strong>${trackingNumber}</strong> (${carrierId})</p>${trackingUrl ? `<p>Track your shipment: <a href="${trackingUrl}">${trackingUrl}</a></p>` : ''}<p>Thank you for your order!</p>`,
          sendDate: 'now',
        },
      },
      authHeader
    )

    await logAudit({
      userId: appUser.id,
      action: 'send_notification_email',
      storeId,
      orderId,
      details: { customerEmail, shipmentId },
      status: 'success',
    })

    return NextResponse.json({ success: true, shipmentId, customerEmail, emailSent: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await logAudit({
      userId: appUser.id,
      action: 'send_notification_email',
      storeId,
      orderId,
      details: { customerEmail, shipmentId, error: message },
      status: 'partial',
    })

    // Shipment was added but email failed
    return NextResponse.json(
      {
        partial: true,
        shipmentId,
        emailError: message,
        customerEmail,
      },
      { status: 207 }
    )
  }
}
