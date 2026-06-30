import { NextRequest, NextResponse } from 'next/server'
import { getSectionContextBySlug } from '@/lib/auth/section-manager'

// GET /api/documents/manage/check?slug=ecommerce
// Returns whether the current user can manage the given section.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 })

  const ctx = await getSectionContextBySlug(slug)
  if (!ctx) return NextResponse.json({ canManage: false, canCreate: false, sectionId: null, isAdmin: false })

  return NextResponse.json({
    canManage: ctx.canManage,
    canCreate: ctx.canCreate,
    sectionId: ctx.section.id,
    isAdmin: ctx.user.is_admin,
  })
}
