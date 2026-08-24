export interface UploadedAttachment {
  url: string
  file_name: string
  file_size: number
  mime_type: string | null
}

export async function uploadAttachment(file: File): Promise<UploadedAttachment> {
  const metaRes = await fetch('/api/marketing/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type }),
  })
  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}))
    throw new Error(err.error ?? 'Upload failed')
  }
  const { signedUrl, url, file_name, file_size, mime_type } = await metaRes.json()

  const putRes = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!putRes.ok) throw new Error('File could not be saved to storage')

  return { url, file_name, file_size, mime_type }
}

export async function uploadAttachmentWithToast(file: File): Promise<UploadedAttachment | null> {
  try {
    return await uploadAttachment(file)
  } catch (e) {
    const { toast } = await import('@/components/ui/Toast')
    toast((e instanceof Error ? e.message : null) ?? 'Upload failed', 'error')
    return null
  }
}
