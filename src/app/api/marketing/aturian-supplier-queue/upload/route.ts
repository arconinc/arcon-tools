import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, badRequest, serverError, created } from '@/lib/api/respond'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const BUCKET = 'aturian-supplier-files'

// POST /api/marketing/aturian-supplier-queue/upload — paperwork attachment (private bucket)
export async function POST(req: Request) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return badRequest('No file provided')

  if (file.size > MAX_SIZE_BYTES) return badRequest('File must be 10MB or smaller')

  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${appUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const adminClient = createAdminClient()
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await adminClient.storage
    .from(BUCKET)
    .upload(path, Buffer.from(arrayBuffer), { contentType: file.type || 'application/octet-stream', upsert: false })

  if (uploadErr) return serverError(uploadErr.message)

  return created({ path, name: file.name })
}
