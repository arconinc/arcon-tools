import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export { cloudinary }

export function artworkThumbnailUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    transformation: [{ page: 1, width: 400, height: 400, crop: 'fit', fetch_format: 'jpg', quality: 'auto' }],
  })
}
