import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// POST /api/expense-reports/[id]/line-items/import
// Accepts multipart/form-data with a CSV file from Expensify
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const [{ data: report }, { data: config }] = await Promise.all([
    adminClient.from('expense_reports').select('id, created_by, status').eq('id', id).single(),
    adminClient.from('expense_report_config').select('reviewer_user_id').single(),
  ])

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = report.created_by === appUser.id
  if (!isOwner && config?.reviewer_user_id !== appUser.id && !appUser.is_admin) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const canEdit = (isOwner && (report.status === 'draft' || report.status === 'needs_changes')) || appUser.is_admin
  if (!canEdit) {
    return NextResponse.json({ error: 'Import is only allowed on in-progress or needs-changes reports.' }, { status: 409 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Request must be multipart/form-data.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Missing "file" field.' }, { status: 400 })
  }

  let csvRows: Record<string, string>[]
  try {
    const arrayBuffer = await file.arrayBuffer()
    const wb = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' })
    csvRows = XLSX.utils.sheet_to_json<Record<string, string>>(
      wb.Sheets[wb.SheetNames[0]],
      { defval: '', raw: true }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to parse CSV'
    return NextResponse.json({ error: `CSV parse error: ${msg}` }, { status: 400 })
  }

  if (csvRows.length === 0) {
    return NextResponse.json({ imported: 0 })
  }

  // Get current max sort_order
  const { data: lastItem } = await adminClient
    .from('expense_report_line_items')
    .select('sort_order')
    .eq('report_id', id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  let nextOrder = (lastItem?.sort_order ?? -1) + 1

  const items = csvRows.map(row => {
    // Parse amount — Expensify uses negative amounts for reimbursable expenses
    const rawAmount = String(row['Amount'] ?? '').replace(/[^0-9.\-]/g, '')
    const amount = rawAmount ? Math.abs(parseFloat(rawAmount)) : null

    const reimbursableRaw = String(row['Reimbursable'] ?? '').toLowerCase()
    const reimbursable = reimbursableRaw !== 'false' && reimbursableRaw !== 'no' && reimbursableRaw !== '0'

    // Parse date — handle Excel serial, ISO datetime, MM/DD/YYYY, YY-MM-DD, YYYY-MM-DD
    let expense_date: string | null = null
    const rawDate = String(row['Date'] ?? '').trim()
    if (rawDate) {
      const dateNum = parseFloat(rawDate)
      if (!isNaN(dateNum) && rawDate.includes('.')) {
        // Excel serial date (e.g., "46098.70905092593")
        // Excel epoch: 1900-01-01, but with a leap year bug. Serial 1 = 1900-01-01, serial 60 = 1900-02-29 (fake)
        // To convert: days since 1900-01-01 = serial number (adjusted for leap year bug)
        const excelEpoch = new Date(1900, 0, 1)
        const date = new Date(excelEpoch.getTime() + (dateNum - 1) * 86400000)
        const yyyy = date.getFullYear()
        const mm = String(date.getMonth() + 1).padStart(2, '0')
        const dd = String(date.getDate()).padStart(2, '0')
        expense_date = `${yyyy}-${mm}-${dd}`
      } else if (rawDate.includes(' ')) {
        // ISO datetime format: YYYY-MM-DD HH:MM:SS — extract date part
        expense_date = rawDate.substring(0, 10)
      } else if (rawDate.includes('/')) {
        // MM/DD/YYYY format
        const parts = rawDate.split('/')
        if (parts.length === 3) {
          expense_date = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
        }
      } else if (rawDate.includes('-')) {
        // YY-MM-DD or YYYY-MM-DD format
        const parts = rawDate.split('-')
        if (parts.length === 3) {
          let year = parts[0]
          if (year.length === 2) {
            // Convert YY to YYYY (00-30 → 2000-2030, 31-99 → 1931-1999)
            const yy = parseInt(year, 10)
            year = (yy <= 30 ? 2000 + yy : 1900 + yy).toString()
          }
          expense_date = `${year}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
        }
      } else {
        // Fallback
        expense_date = rawDate
      }
    }

    const item = {
      report_id: id,
      expense_date,
      vendor: row['Merchant'] || row['Vendor'] || null,
      category: row['Category'] || null,
      description: row['Description'] || null,
      original_amount: isNaN(amount as number) ? null : amount,
      adjusted_amount: null,
      payment_type: null,
      receipt_url: row['Receipt URL'] || null,
      reimbursable,
      sort_order: nextOrder++,
    }
    return item
  })

  const { data: inserted, error } = await adminClient
    .from('expense_report_line_items')
    .insert(items)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await adminClient
    .from('expense_reports')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ imported: inserted?.length ?? 0 })
}
