import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/crm/require-user'
import { cloudinary, artworkThumbnailUrl } from '@/lib/cloudinary'
import type { UploadApiResponse } from 'cloudinary'

export async function POST(request: Request) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const customerId = formData.get('customer_id') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!customerId) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        folder: `crm-artwork/${customerId}`,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload failed'))
        else resolve(result)
      }
    ).end(buffer)
  })

  const mimeType = file.type || `${result.resource_type}/${result.format}` || null
  const thumbnailUrl = result.resource_type !== 'raw' ? artworkThumbnailUrl(result.public_id) : null

  return NextResponse.json(
    {
      url: result.secure_url,
      cloudinary_public_id: result.public_id,
      cloudinary_resource_type: result.resource_type,
      thumbnail_url: thumbnailUrl,
      file_name: file.name,
      file_size: result.bytes,
      mime_type: mimeType,
      width: result.width ?? null,
      height: result.height ?? null,
    },
    { status: 201 }
  )
}
