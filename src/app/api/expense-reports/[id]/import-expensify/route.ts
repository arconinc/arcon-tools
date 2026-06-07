import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { appendExpenseRows } from '@/lib/google-drive'

// Column order matches "Detailed Log" sheet: Date | Transaction ID | Description | Category | Vendor | Amount | Reimbursable? | Notes
// Empty string '' means insert a blank cell for that column (Transaction ID has no Expensify equivalent).
const DEFAULT_COLUMNS = [
  'Date',
  '',           // Transaction ID — not in Expensify CSV
  'Description',
  'Category',
  'Merchant',   // → Vendor column
  'Amount',
  'Reimbursable',
  'Receipt URL', // → Notes column
]

// POST /api/expense-reports/[id]/import-expensify
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()

  const [{ data: report }, { data: config }] = await Promise.all([
    adminClient
      .from('expense_reports')
      .select('id, created_by, status, drive_file_id')
      .eq('id', id)
      .single(),
    adminClient
      .from('expense_report_config')
      .select('sheet_column_mapping')
      .single(),
  ])

  if (!report || report.created_by !== appUser.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (report.status !== 'draft') {
    return NextResponse.json({ error: 'Import is only allowed on draft reports.' }, { status: 409 })
  }

  if (!report.drive_file_id) {
    return NextResponse.json({ error: 'No Google Sheet linked to this report.' }, { status: 400 })
  }

  // Parse multipart/form-data
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

  // Parse CSV (handles both comma- and tab-separated)
  let csvRows: Record<string, string>[]
  try {
    const arrayBuffer = await file.arrayBuffer()
    const wb = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' })
    csvRows = XLSX.utils.sheet_to_json<Record<string, string>>(
      wb.Sheets[wb.SheetNames[0]],
      { defval: '', raw: false }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to parse CSV'
    return NextResponse.json({ error: `CSV parse error: ${msg}` }, { status: 400 })
  }

  if (csvRows.length === 0) {
    return NextResponse.json({ imported: 0 })
  }

  const columns: string[] =
    Array.isArray(config?.sheet_column_mapping) && config.sheet_column_mapping.length > 0
      ? config.sheet_column_mapping
      : DEFAULT_COLUMNS

  const mappedRows: string[][] = csvRows.map((row) =>
    columns.map((col) => String(row[col] ?? ''))
  )

  try {
    await appendExpenseRows(report.drive_file_id, mappedRows)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Google Sheets write failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ imported: mappedRows.length })
}
