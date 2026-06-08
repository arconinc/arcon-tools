import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendLureOrderConfirmation } from '@/lib/email'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { taskAssigned } from '@/lib/notifications/registry'

export const runtime = 'nodejs'

const BUCKET = 'lure-artwork'
const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf', 'application/postscript', 'application/octet-stream']
const ALLOWED_EXTS = ['.pdf', '.eps', '.ai', '.svg', '.png', '.jpg', '.jpeg']

// The user ID to assign lure order tasks to.
// Override with LURE_ORDER_ASSIGNEE_ID env var (e.g. your own ID during testing).
// Defaults to Aaron Wheatcraft's user ID for production.
const ASSIGNEE_ID = process.env.LURE_ORDER_ASSIGNEE_ID ?? 'f0c80eb0-7480-438a-8bb1-d0bc4ffb0c62'

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return d
}

function getUnitPrice(qty: number): number {
  if (qty >= 2500) return 5.25
  if (qty >= 1000) return 5.5
  if (qty >= 500) return 5.65
  if (qty >= 300) return 5.75
  return 6.0
}

function isAllowedFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  return ALLOWED_EXTS.includes(ext) || ALLOWED_TYPES.includes(file.type)
}

async function uploadArtwork(adminClient: ReturnType<typeof createAdminClient>, file: File, label: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin'
  const filename = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const contentType = file.type || 'application/octet-stream'

  const { error } = await adminClient.storage.from(BUCKET).upload(filename, buffer, { contentType, upsert: false })
  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data: { publicUrl } } = adminClient.storage.from(BUCKET).getPublicUrl(filename)
  return publicUrl
}

async function ensureBucket(adminClient: ReturnType<typeof createAdminClient>) {
  const { data: buckets } = await adminClient.storage.listBuckets()
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await adminClient.storage.createBucket(BUCKET, { public: true })
  }
}

async function ensureTag(adminClient: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data: existing } = await adminClient.from('crm_tags').select('id').eq('name', 'Rapala Lure').single()
  if (existing?.id) return existing.id

  const { data: created, error } = await adminClient
    .from('crm_tags')
    .insert({ name: 'Rapala Lure', color: '#8b5cf6' })
    .select('id')
    .single()
  if (error) throw new Error(`Tag creation failed: ${error.message}`)
  return created.id
}

async function applyTag(adminClient: ReturnType<typeof createAdminClient>, tagId: string, customerId: string) {
  const { data: existing } = await adminClient
    .from('crm_entity_tags')
    .select('id')
    .eq('tag_id', tagId)
    .eq('entity_type', 'customer')
    .eq('entity_id', customerId)
    .single()
  if (!existing) {
    await adminClient.from('crm_entity_tags').insert({ tag_id: tagId, entity_type: 'customer', entity_id: customerId })
  }
}

// Find or create a CRM customer + contact for the submitter.
// Matches on contact email to avoid duplicates.
async function upsertCustomerAndContact(
  adminClient: ReturnType<typeof createAdminClient>,
  { firstName, lastName, company, email, phone }: { firstName: string; lastName: string; company: string; email: string; phone?: string }
): Promise<string> {
  // Check for existing contact with this email
  const { data: existingContact } = await adminClient
    .from('crm_contacts')
    .select('id, customer_id')
    .eq('email', email.toLowerCase())
    .single()

  if (existingContact?.customer_id) {
    // Known contact linked to a customer — reuse the customer
    return existingContact.customer_id as string
  }

  // Create a new customer record for this company
  const { data: customer, error: custErr } = await adminClient
    .from('crm_customers')
    .insert({
      name: company.trim(),
      client_status: 'Prospective',
      phone: phone ?? null,
      created_by: ASSIGNEE_ID,
      assigned_to: ASSIGNEE_ID,
    })
    .select('id')
    .single()
  if (custErr) throw new Error(`Customer creation failed: ${custErr.message}`)

  if (existingContact) {
    // Contact exists but wasn't linked to a customer yet — link it
    await adminClient.from('crm_contacts').update({ customer_id: customer.id }).eq('id', existingContact.id)
  } else {
    // Create a new contact linked to the new customer
    await adminClient.from('crm_contacts').insert({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone ?? null,
      type: 'Prospect',
      customer_id: customer.id,
    })
  }

  return customer.id as string
}

export async function POST(request: Request) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  // --- Parse fields ---
  const lureType = (formData.get('lureType') as string | null)?.trim() ?? ''
  const firstName = (formData.get('firstName') as string | null)?.trim() ?? ''
  const lastName = (formData.get('lastName') as string | null)?.trim() ?? ''
  const company = (formData.get('company') as string | null)?.trim() ?? ''
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const phone = (formData.get('phone') as string | null)?.trim() || undefined
  const quantity = parseInt(formData.get('quantity') as string ?? '', 10)
  const artColors = Math.max(1, parseInt(formData.get('artColors') as string ?? '1', 10))
  const backImprint = formData.get('backImprint') === 'true'
  const backColors = Math.max(0, parseInt(formData.get('backColors') as string ?? '0', 10))
  const pantoneColor = (formData.get('pantoneColor') as string | null)?.trim() || undefined
  const notes = (formData.get('notes') as string | null)?.trim() || undefined
  const frontFile = formData.get('frontArtwork') as File | null
  const backFile = formData.get('backArtwork') as File | null

  // Shipping
  const shipToAttention = (formData.get('shipToAttention') as string | null)?.trim() || undefined
  const shipToAddress1  = (formData.get('shipToAddress1') as string | null)?.trim() || undefined
  const shipToAddress2  = (formData.get('shipToAddress2') as string | null)?.trim() || undefined
  const shipToCity      = (formData.get('shipToCity') as string | null)?.trim() || undefined
  const shipToState     = (formData.get('shipToState') as string | null)?.trim() || undefined
  const shipToZip       = (formData.get('shipToZip') as string | null)?.trim() || undefined

  // Billing
  const billSameAsShip      = formData.get('billSameAsShip') !== 'false'
  const billToAddress1      = (formData.get('billToAddress1') as string | null)?.trim() || undefined
  const billToAddress2      = (formData.get('billToAddress2') as string | null)?.trim() || undefined
  const billToCity          = (formData.get('billToCity') as string | null)?.trim() || undefined
  const billToState         = (formData.get('billToState') as string | null)?.trim() || undefined
  const billToZip           = (formData.get('billToZip') as string | null)?.trim() || undefined
  const billingContactFirst = (formData.get('billingContactFirst') as string | null)?.trim() || undefined
  const billingContactLast  = (formData.get('billingContactLast') as string | null)?.trim() || undefined
  const billingEmail        = (formData.get('billingEmail') as string | null)?.trim() || undefined

  // Tax exempt
  const taxExempt     = formData.get('taxExempt') === 'true'
  const taxExemptFile = formData.get('taxExemptCert') as File | null

  // --- Validate ---
  const LURE_NAMES: Record<string, string> = { bp: 'Blue Pearl', rh: 'Red Head' }
  if (!lureType || !LURE_NAMES[lureType]) {
    return NextResponse.json({ error: 'Please select a valid lure style' }, { status: 400 })
  }
  const lureName = LURE_NAMES[lureType]

  if (!firstName) return NextResponse.json({ error: 'First name is required' }, { status: 400 })
  if (!lastName) return NextResponse.json({ error: 'Last name is required' }, { status: 400 })
  if (!company) return NextResponse.json({ error: 'Company is required' }, { status: 400 })
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
  }
  if (isNaN(quantity) || quantity < 150) {
    return NextResponse.json({ error: 'Minimum order quantity is 150 units' }, { status: 400 })
  }
  if (!frontFile || frontFile.size === 0) {
    return NextResponse.json({ error: 'Front artwork file is required' }, { status: 400 })
  }
  if (frontFile.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Front artwork file must be 25 MB or smaller' }, { status: 400 })
  }
  if (!isAllowedFile(frontFile)) {
    return NextResponse.json({ error: 'Artwork must be a PDF, EPS, AI, SVG, PNG, or JPG file' }, { status: 400 })
  }
  if (backFile && backFile.size > 0) {
    if (backFile.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Back artwork file must be 25 MB or smaller' }, { status: 400 })
    }
    if (!isAllowedFile(backFile)) {
      return NextResponse.json({ error: 'Back artwork must be a PDF, EPS, AI, SVG, PNG, or JPG file' }, { status: 400 })
    }
  }
  const TAX_EXEMPT_ALLOWED_EXTS = ['.pdf', '.jpg', '.jpeg', '.png']
  if (taxExempt && taxExemptFile && taxExemptFile.size > 0) {
    if (taxExemptFile.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Tax exempt certificate must be 25 MB or smaller' }, { status: 400 })
    }
    const taxExt = '.' + taxExemptFile.name.split('.').pop()?.toLowerCase()
    if (!TAX_EXEMPT_ALLOWED_EXTS.includes(taxExt)) {
      return NextResponse.json({ error: 'Tax exempt certificate must be a PDF, JPG, or PNG file' }, { status: 400 })
    }
  }

  const unitPrice = getUnitPrice(quantity)
  const estimatedTotal =
    quantity * unitPrice +
    artColors * 50 +
    (backImprint ? 1 : 0) +
    backColors * 0.5

  const adminClient = createAdminClient()

  try {
    // 1. Ensure storage bucket exists
    await ensureBucket(adminClient)

    // 2. Upload artwork files
    const frontArtworkUrl = await uploadArtwork(adminClient, frontFile, 'front')
    const backArtworkUrl =
      backFile && backFile.size > 0 ? await uploadArtwork(adminClient, backFile, 'back') : undefined
    const taxExemptUrl =
      taxExempt && taxExemptFile && taxExemptFile.size > 0
        ? await uploadArtwork(adminClient, taxExemptFile, 'tax-exempt')
        : undefined

    // 3. Find or create CRM customer + contact
    const customerId = await upsertCustomerAndContact(adminClient, { firstName, lastName, company, email, phone })

    // 3b. Update customer with shipping/billing addresses and tax exempt status
    await adminClient.from('crm_customers').update({
      shipping_address1: shipToAddress1 ?? null,
      shipping_address2: shipToAddress2 ?? null,
      shipping_city:     shipToCity     ?? null,
      shipping_state:    shipToState    ?? null,
      shipping_zip:      shipToZip      ?? null,
      billing_address1:  billSameAsShip ? (shipToAddress1 ?? null) : (billToAddress1 ?? null),
      billing_address2:  billSameAsShip ? (shipToAddress2 ?? null) : (billToAddress2 ?? null),
      billing_city:      billSameAsShip ? (shipToCity     ?? null) : (billToCity     ?? null),
      billing_state:     billSameAsShip ? (shipToState    ?? null) : (billToState    ?? null),
      billing_zip:       billSameAsShip ? (shipToZip      ?? null) : (billToZip      ?? null),
      tax_exempt:        taxExempt,
    }).eq('id', customerId)

    // 4. Ensure "Rapala Lure" tag exists and apply it
    const tagId = await ensureTag(adminClient)
    await applyTag(adminClient, tagId, customerId)

    // 5. Build task description (HTML for Tiptap rendering)
    const submittedAt = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'full', timeStyle: 'short' })
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const row = (label: string, value: string) => `<p><strong>${label}:</strong> ${value}</p>`
    const description = [
      `<h2>Rapala Lure Order — ${esc(lureName)} (${lureType.toUpperCase()})</h2>`,
      '<h3>Contact</h3>',
      row('Name', esc(`${firstName} ${lastName}`)),
      row('Company', esc(company)),
      row('Email', `<a href="mailto:${esc(email)}">${esc(email)}</a>`),
      phone ? row('Phone', esc(phone)) : null,
      '<h3>Order Details</h3>',
      row('Quantity', `${quantity.toLocaleString()} units`),
      row('Unit Price', `$${unitPrice.toFixed(2)}`),
      row('Base', `$${(quantity * unitPrice).toFixed(2)}`),
      row('Art Setup', `${artColors} color${artColors !== 1 ? 's' : ''} × $50.00 = $${(artColors * 50).toFixed(2)}`),
      pantoneColor ? row('Pantone Color(s)', esc(pantoneColor)) : null,
      backImprint ? row('Back Location', '$1.00') : null,
      backColors > 0 ? row('Back Colors', `${backColors} × $0.50 = $${(backColors * 0.5).toFixed(2)}`) : null,
      `<p><strong>Estimated Total:</strong> <strong>$${estimatedTotal.toFixed(2)}</strong></p>`,
      '<h3>Artwork</h3>',
      row('Front', `<a href="${esc(frontArtworkUrl)}" target="_blank" rel="noopener noreferrer">View front artwork</a>`),
      backArtworkUrl
        ? row('Back', `<a href="${esc(backArtworkUrl)}" target="_blank" rel="noopener noreferrer">View back artwork</a>`)
        : row('Back', 'Not provided'),
      '<h3>Ship To</h3>',
      shipToAttention ? row('Attention', esc(shipToAttention)) : null,
      shipToAddress1 ? `<p>${esc(shipToAddress1)}${shipToAddress2 ? `, ${esc(shipToAddress2)}` : ''}</p>` : null,
      (shipToCity || shipToState || shipToZip)
        ? `<p>${[shipToCity, shipToState, shipToZip].filter((s): s is string => Boolean(s)).map(esc).join(', ')}</p>`
        : null,
      '<h3>Bill To</h3>',
      billSameAsShip
        ? '<p>Same as Ship To</p>'
        : [
            billToAddress1 ? `<p>${esc(billToAddress1)}${billToAddress2 ? `, ${esc(billToAddress2)}` : ''}</p>` : null,
            (billToCity || billToState || billToZip)
              ? `<p>${[billToCity, billToState, billToZip].filter((s): s is string => Boolean(s)).map(esc).join(', ')}</p>`
              : null,
          ].filter(Boolean).join(''),
      (billingContactFirst || billingContactLast || billingEmail) ? '<h3>Billing Contact</h3>' : null,
      (billingContactFirst || billingContactLast)
        ? row('Name', esc([billingContactFirst, billingContactLast].filter((s): s is string => Boolean(s)).join(' ')))
        : null,
      billingEmail ? row('Email', `<a href="mailto:${esc(billingEmail)}">${esc(billingEmail)}</a>`) : null,
      '<h3>Tax Exempt</h3>',
      taxExempt
        ? (taxExemptUrl
            ? `<p>Yes — <a href="${esc(taxExemptUrl)}" target="_blank" rel="noopener noreferrer">View certificate</a></p>`
            : '<p>Yes (no certificate uploaded)</p>')
        : '<p>No</p>',
      notes ? '<h3>Notes</h3>' : null,
      notes ? `<p>${esc(notes)}</p>` : null,
      '<hr>',
      `<p><em>Submitted ${esc(submittedAt)} CT · <a href="https://thearc.arconinc.com/order/rapala-lure" target="_blank" rel="noopener noreferrer">Online Order Form</a></em></p>`,
    ]
      .filter((l) => l !== null)
      .join('')

    // 6. Create CRM task assigned to the configured assignee
    const dueDate = addBusinessDays(new Date(), 3).toISOString().split('T')[0]
    const taskTitle = `Lure Order — ${company} · ${lureName} (${quantity.toLocaleString()} units)`
    const { data: task, error: taskErr } = await adminClient
      .from('crm_tasks')
      .insert({
        title: taskTitle,
        description,
        customer_id: customerId,
        assigned_to: ASSIGNEE_ID,
        task_owner: ASSIGNEE_ID,
        created_by: ASSIGNEE_ID,
        priority: 'high',
        status: 'not_started',
        progress: 0,
        due_date: dueDate,
        category: 'Sales',
      })
      .select('id')
      .single()
    if (taskErr) throw new Error(`Task creation failed: ${taskErr.message}`)

    // 7. Send confirmation email
    let emailSent = false
    try {
      await sendLureOrderConfirmation({
        firstName, lastName, company, email, phone,
        lureType, lureName,
        quantity, unitPrice, artColors, pantoneColor,
        backImprint, backColors,
        estimatedTotal,
        frontArtworkUrl,
        backArtworkUrl,
        notes,
      })
      emailSent = true
    } catch (emailErr) {
      // Non-fatal — log but don't fail the submission
      console.error('Confirmation email failed:', emailErr)
    }

    // 8. Add task comment recording the email send
    await adminClient.from('crm_task_comments').insert({
      task_id: task.id,
      user_id: ASSIGNEE_ID,
      comment: emailSent
        ? `Confirmation email sent to ${email} at ${new Date().toISOString()}.`
        : `Confirmation email FAILED to send to ${email}. Please send manually.`,
    })

    // 9. Notify the assignee that a new task was created for them
    try {
      await dispatchNotification({
        definition: taskAssigned,
        payload: {
          task_id: task.id,
          task_title: taskTitle,
          actor_id: ASSIGNEE_ID,
          actor_name: 'Arcon Lure Order Form',
          department: null,
          due_date: dueDate,
          priority: 'high',
          status: 'not_started',
          description,
          fanout_kind: 'user',
        },
        recipientSpec: { userId: ASSIGNEE_ID },
      })
    } catch (notifyErr) {
      console.error('Task assignment notification failed:', notifyErr)
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('Lure order submission error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
