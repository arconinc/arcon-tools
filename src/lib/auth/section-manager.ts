import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Maps URL slugs to doc_sections.name values
const SECTION_SLUG_MAP: Record<string, string> = {
  hr: 'HR',
  marketing: 'Marketing',
  accounting: 'Accounting',
  ecommerce: 'E-Commerce',
  technology: 'Technology',
  sales: 'Sales',
  warehouse: 'Warehouse',
}

export interface SectionManagerContext {
  user: { id: string; is_admin: boolean; department: string[] | null }
  section: { id: string; name: string; department: string | null }
  canManage: boolean
}

export async function getSectionContext(sectionId: string): Promise<SectionManagerContext | null> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const adminClient = createAdminClient()
  const [userResult, sectionResult] = await Promise.all([
    adminClient.from('users').select('id, is_admin, department').eq('google_id', authUser.id).single(),
    adminClient.from('doc_sections').select('id, name, department').eq('id', sectionId).single(),
  ])

  if (!userResult.data || !sectionResult.data) return null

  const appUser = userResult.data
  const section = sectionResult.data
  const canManage =
    appUser.is_admin ||
    (section.department != null && (appUser.department ?? []).includes(section.department))

  return { user: appUser, section, canManage }
}

export async function getSectionContextBySlug(slug: string): Promise<SectionManagerContext | null> {
  const sectionName = SECTION_SLUG_MAP[slug]
  if (!sectionName) return null

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const adminClient = createAdminClient()
  const [userResult, sectionResult] = await Promise.all([
    adminClient.from('users').select('id, is_admin, department').eq('google_id', authUser.id).single(),
    adminClient.from('doc_sections').select('id, name, department').eq('name', sectionName).single(),
  ])

  if (!userResult.data || !sectionResult.data) return null

  const appUser = userResult.data
  const section = sectionResult.data
  const canManage =
    appUser.is_admin ||
    (section.department != null && (appUser.department ?? []).includes(section.department))

  return { user: appUser, section, canManage }
}

// Gets section context by resolving an item's section (item → folder → section)
export async function getSectionContextForItem(itemId: string): Promise<SectionManagerContext | null> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const adminClient = createAdminClient()
  const itemResult = await adminClient
    .from('documents')
    .select('id, folder_id, doc_folders(id, section_id, doc_sections(id, name, department))')
    .eq('id', itemId)
    .single()

  if (!itemResult.data) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const folder = (itemResult.data as any).doc_folders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const section = folder?.doc_sections as any

  if (!section) return null

  const userResult = await adminClient
    .from('users')
    .select('id, is_admin, department')
    .eq('google_id', authUser.id)
    .single()

  if (!userResult.data) return null

  const appUser = userResult.data
  const canManage =
    appUser.is_admin ||
    (section.department != null && (appUser.department ?? []).includes(section.department))

  return { user: appUser, section, canManage }
}

// Gets section context by resolving a folder's section
export async function getSectionContextForFolder(folderId: string): Promise<SectionManagerContext | null> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const adminClient = createAdminClient()
  const [userResult, folderResult] = await Promise.all([
    adminClient.from('users').select('id, is_admin, department').eq('google_id', authUser.id).single(),
    adminClient.from('doc_folders').select('id, section_id, doc_sections(id, name, department)').eq('id', folderId).single(),
  ])

  if (!userResult.data || !folderResult.data) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const section = (folderResult.data as any).doc_sections as any
  if (!section) return null

  const appUser = userResult.data
  const canManage =
    appUser.is_admin ||
    (section.department != null && (appUser.department ?? []).includes(section.department))

  return { user: appUser, section, canManage }
}
