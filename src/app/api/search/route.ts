import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/crm/require-user'
import { runUniversalSearch } from '@/lib/search/sources'

// GET /api/search?q=... — universal search across customers, contacts, vendors, documents.
// Document results are access-filtered (role/owner/individual grants) inside the source.
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })

  const results = await runUniversalSearch(q)
  return NextResponse.json({ results })
}
