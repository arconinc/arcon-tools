import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Fetches og:image from a vendor page URL, uploads to spec-idea-images bucket,
 * and updates spec_samples.item_image_url for the given spec ID.
 * Returns the public URL on success, null on any failure (non-throwing).
 */
export async function fetchAndStoreOgImage(vendorLink: string, specId: string): Promise<string | null> {
  try {
    const pageRes = await fetch(vendorLink, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
    })
    if (!pageRes.ok) return null

    const html = await pageRes.text()

    const match = html.match(/<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:image["']/i)
      ?? html.match(/<meta[^>]+name\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+name\s*=\s*["']og:image["']/i)
      ?? html.match(/<meta[^>]+name\s*=\s*["']twitter:image["'][^>]+content\s*=\s*["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+name\s*=\s*["']twitter:image["']/i)

    if (!match?.[1]) return null

    let imageUrl = match[1]
    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl
    else if (imageUrl.startsWith('/')) {
      const base = new URL(vendorLink)
      imageUrl = base.origin + imageUrl
    }

    const imageRes = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!imageRes.ok) return null

    const contentType = imageRes.headers.get('content-type') ?? 'image/jpeg'
    if (!contentType.startsWith('image/')) return null

    const buffer = Buffer.from(await imageRes.arrayBuffer())
    if (buffer.length > 5 * 1024 * 1024) return null

    const ext = contentType.split('/')[1]?.split(';')[0] ?? 'jpg'
    const filename = `sample-${specId}-fetch-${Date.now()}.${ext}`

    const adminClient = createAdminClient()

    const { error: uploadErr } = await adminClient.storage
      .from('spec-idea-images')
      .upload(filename, buffer, { contentType, upsert: false })

    if (uploadErr) return null

    const { data: { publicUrl } } = adminClient.storage.from('spec-idea-images').getPublicUrl(filename)

    await adminClient
      .from('spec_samples')
      .update({ item_image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', specId)

    return publicUrl
  } catch {
    return null
  }
}
