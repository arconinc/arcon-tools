const CRM_ATTACHMENTS_BUCKET = 'crm-attachments'

export function isUserCrmAttachmentUrl(url: string, userId: string) {
  try {
    const parsedUrl = new URL(url)
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)
    const expectedPrefix = `/storage/v1/object/public/${CRM_ATTACHMENTS_BUCKET}/${userId}/`

    return parsedUrl.origin === supabaseUrl.origin && parsedUrl.pathname.startsWith(expectedPrefix)
  } catch {
    return false
  }
}
