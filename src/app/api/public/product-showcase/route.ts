import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendProductShowcaseConfirmation } from '@/lib/email-product-showcase'

export const runtime = 'nodejs'

const TAG_NAME = 'ProductShowcase2026'
const TAG_COLOR = '#8b5cf6'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureTag(adminClient: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data: existing } = await adminClient
    .from('crm_tags')
    .select('id')
    .eq('name', TAG_NAME)
    .maybeSingle()
  if (existing?.id) return existing.id as string

  const { data: created, error } = await adminClient
    .from('crm_tags')
    .insert({ name: TAG_NAME, color: TAG_COLOR })
    .select('id')
    .single()
  if (error) throw new Error(`Tag creation failed: ${error.message}`)
  return created.id as string
}

async function applyEntityTag(
  adminClient: ReturnType<typeof createAdminClient>,
  tagId: string,
  entityId: string,
  entityType: 'contact' | 'customer'
): Promise<void> {
  const { data: existing } = await adminClient
    .from('crm_entity_tags')
    .select('tag_id')
    .eq('tag_id', tagId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle()
  if (!existing) {
    await adminClient
      .from('crm_entity_tags')
      .insert({ tag_id: tagId, entity_type: entityType, entity_id: entityId })
  }
}

// Find or create a CRM customer by company name (case-insensitive).
async function upsertCustomer(
  adminClient: ReturnType<typeof createAdminClient>,
  company: string,
  salespersonId: string
): Promise<string> {
  const { data: existing } = await adminClient
    .from('crm_customers')
    .select('id')
    .ilike('name', company.trim())
    .limit(1)
    .maybeSingle()
  if (existing?.id) return existing.id as string

  const { data: created, error } = await adminClient
    .from('crm_customers')
    .insert({
      name: company.trim(),
      client_status: 'Prospective',
      assigned_to: salespersonId,
      created_by: salespersonId,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Customer creation failed: ${error.message}`)
  return created.id as string
}

// Find or create a CRM contact by email. Links to the given customer.
async function upsertContact(
  adminClient: ReturnType<typeof createAdminClient>,
  contact: {
    first_name: string
    last_name: string
    email: string
    phone?: string
    job_title?: string
    customer_id: string
    salesperson_id: string
  }
): Promise<string> {
  const normalizedEmail = contact.email.toLowerCase().trim()

  const { data: existing } = await adminClient
    .from('crm_contacts')
    .select('id, customer_id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existing) {
    const updates: Record<string, unknown> = {
      product_showcase_invite: '2026',
    }
    if (!existing.customer_id) updates.customer_id = contact.customer_id
    await adminClient.from('crm_contacts').update(updates).eq('id', existing.id)
    return existing.id as string
  }

  const { data: created, error } = await adminClient
    .from('crm_contacts')
    .insert({
      first_name: contact.first_name.trim(),
      last_name: contact.last_name.trim(),
      email: normalizedEmail,
      phone: contact.phone ?? null,
      title: contact.job_title ?? null,
      type_of_contact: 'Customer',
      customer_id: contact.customer_id,
      arcon_salesperson: contact.salesperson_id,
      product_showcase_invite: '2026',
      created_by: contact.salesperson_id,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Contact creation failed: ${error.message}`)
  return created.id as string
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // --- Parse fields ---
  const firstName = String(body.first_name ?? '').trim()
  const lastName = String(body.last_name ?? '').trim()
  const email = String(body.email ?? '').trim()
  const company = String(body.company ?? '').trim()
  const jobTitle = String(body.job_title ?? '').trim() || undefined
  const phone = String(body.phone ?? '').trim() || undefined
  const arconSalespersonId = String(body.arcon_salesperson_id ?? '').trim()
  const categories: string[] = Array.isArray(body.categories) ? body.categories.map(String) : []
  const additionalAttendees: { first_name: string; last_name: string; email: string }[] =
    Array.isArray(body.additional_attendees) ? body.additional_attendees : []

  // --- Validate ---
  if (!firstName) return NextResponse.json({ error: 'First name is required' }, { status: 400 })
  if (!lastName) return NextResponse.json({ error: 'Last name is required' }, { status: 400 })
  if (!email || !isValidEmail(email))
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
  if (!company) return NextResponse.json({ error: 'Company is required' }, { status: 400 })
  if (!arconSalespersonId)
    return NextResponse.json({ error: 'Please select an Arcon contact' }, { status: 400 })

  for (let i = 0; i < additionalAttendees.length; i++) {
    const a = additionalAttendees[i]
    if (!a.first_name?.trim() || !a.last_name?.trim())
      return NextResponse.json(
        { error: `Additional attendee ${i + 1} is missing a name` },
        { status: 400 }
      )
    if (!a.email?.trim() || !isValidEmail(a.email.trim()))
      return NextResponse.json(
        { error: `Additional attendee ${i + 1} has an invalid email address` },
        { status: 400 }
      )
  }

  const adminClient = createAdminClient()

  try {
    // 1. Look up salesperson display name
    const { data: salesperson, error: spErr } = await adminClient
      .from('users')
      .select('id, display_name')
      .eq('id', arconSalespersonId)
      .single()
    if (spErr || !salesperson)
      return NextResponse.json({ error: 'Selected Arcon contact not found' }, { status: 400 })
    const salesPersonName = salesperson.display_name as string

    // 2. Ensure tag exists
    const tagId = await ensureTag(adminClient)

    // 3. Find or create customer
    const customerId = await upsertCustomer(adminClient, company, arconSalespersonId)
    await applyEntityTag(adminClient, tagId, customerId, 'customer')

    // 4. Find or create primary contact
    const primaryContactId = await upsertContact(adminClient, {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      job_title: jobTitle,
      customer_id: customerId,
      salesperson_id: arconSalespersonId,
    })
    await applyEntityTag(adminClient, tagId, primaryContactId, 'contact')

    // 5. Find or create additional attendee contacts
    const additionalContactIds: string[] = []
    for (const attendee of additionalAttendees) {
      if (attendee.email.trim().toLowerCase() === email.toLowerCase()) continue // skip if same as primary
      const contactId = await upsertContact(adminClient, {
        first_name: attendee.first_name.trim(),
        last_name: attendee.last_name.trim(),
        email: attendee.email,
        customer_id: customerId,
        salesperson_id: arconSalespersonId,
      })
      await applyEntityTag(adminClient, tagId, contactId, 'contact')
      additionalContactIds.push(contactId)
    }

    // 6. Build task description
    const totalAttendees = 1 + additionalContactIds.length
    const submittedAt = new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'full',
      timeStyle: 'short',
    })

    const categoryLines =
      categories.length > 0
        ? categories.map((c) => `  - ${c}`).join('\n')
        : '  (none selected)'

    const attendeeLines =
      additionalAttendees.length > 0
        ? additionalAttendees
            .map((a, i) => `  ${i + 1}. ${a.first_name} ${a.last_name} <${a.email}>`)
            .join('\n')
        : '  (none)'

    const description = [
      'PRODUCT SHOWCASE 2026 REGISTRATION',
      '',
      'EVENT: Friday, September 18, 2026 · 11:00 AM – 2:00 PM CT',
      'VENUE: Union 32 Craft House, 2864 Highway 55, Eagan, MN 55121',
      '',
      'PRIMARY REGISTRANT',
      `  Name:    ${firstName} ${lastName}`,
      `  Company: ${company}`,
      `  Email:   ${email}`,
      phone ? `  Phone:   ${phone}` : null,
      jobTitle ? `  Title:   ${jobTitle}` : null,
      '',
      `ARCON CONTACT: ${salesPersonName}`,
      '',
      'CATEGORIES OF INTEREST',
      categoryLines,
      '',
      `ADDITIONAL ATTENDEES (${additionalAttendees.length})`,
      attendeeLines,
      '',
      `TOTAL: ${totalAttendees} attendee${totalAttendees !== 1 ? 's' : ''} from ${company}`,
      '',
      `Submitted: ${submittedAt} CT`,
      'Source: Online Registration Form (thearc.arconinc.com/order/product-showcase-2026)',
    ]
      .filter((l) => l !== null)
      .join('\n')

    // 7. Create CRM task assigned to the salesperson
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 7)
    const { data: task, error: taskErr } = await adminClient
      .from('crm_tasks')
      .insert({
        title: `Product Showcase Registration — ${company} (${totalAttendees} attendee${totalAttendees !== 1 ? 's' : ''})`,
        description,
        customer_id: customerId,
        department: 'Sales',
        category: 'Sales',
        assigned_to: arconSalespersonId,
        task_owner: arconSalespersonId,
        created_by: arconSalespersonId,
        priority: 'medium',
        status: 'not_started',
        progress: 0,
        due_date: dueDate.toISOString().split('T')[0],
      })
      .select('id')
      .single()
    if (taskErr) throw new Error(`Task creation failed: ${taskErr.message}`)

    // 8. Send confirmation emails — primary + all additional attendees
    const confirmationDetails = {
      company,
      salesPersonName,
      categories,
      totalAttendees,
    }

    const recipients = [
      { firstName, email },
      ...additionalAttendees.map((a) => ({
        firstName: a.first_name.trim(),
        email: a.email.trim().toLowerCase(),
      })),
    ]

    const emailResults: { email: string; ok: boolean }[] = []
    for (const recipient of recipients) {
      try {
        await sendProductShowcaseConfirmation(recipient, confirmationDetails)
        emailResults.push({ email: recipient.email, ok: true })
      } catch (emailErr) {
        console.error(`Confirmation email failed for ${recipient.email}:`, emailErr)
        emailResults.push({ email: recipient.email, ok: false })
      }
    }

    // 9. Log email results as task comment
    const emailLog = emailResults
      .map(
        (r) =>
          `${r.ok ? '✓' : '✗'} ${r.email} — ${r.ok ? 'sent' : 'FAILED (send manually)'}`
      )
      .join('\n')
    await adminClient.from('crm_task_comments').insert({
      task_id: task.id,
      user_id: arconSalespersonId,
      comment: `Confirmation emails (${new Date().toISOString()}):\n${emailLog}`,
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('Product Showcase registration error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
