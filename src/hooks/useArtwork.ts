'use client'

import { useState } from 'react'

export type ArtworkItem = {
  id: string
  customer_id: string
  name: string
  description: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  width: number | null
  height: number | null
  url: string
  cloudinary_public_id: string | null
  cloudinary_resource_type: string | null
  thumbnail_url: string | null
  is_drive_link: boolean
  dropbox_url: string | null
  is_dropbox_file: boolean
  added_by: string
  created_at: string
  updated_at: string
}

export function useArtwork(customerId: string | null) {
  const [artwork, setArtwork] = useState<ArtworkItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [vectorizingIds, setVectorizingIds] = useState<Set<string>>(new Set())

  async function load() {
    if (!customerId || loaded) return
    setLoading(true)
    try {
      const res = await fetch(`/api/marketing/artwork?customer_id=${customerId}`)
      if (res.ok) setArtwork(await res.json())
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }

  async function add(item: ArtworkItem) {
    setArtwork((prev) => [item, ...prev])
  }

  async function remove(id: string) {
    if (!confirm('Delete this artwork?')) return
    const res = await fetch(`/api/marketing/artwork/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setArtwork((prev) => prev.filter((a) => a.id !== id))
    }
  }

  async function vectorize(item: ArtworkItem) {
    setVectorizingIds((prev) => new Set(prev).add(item.id))
    try {
      const res = await fetch(`/api/marketing/artwork/${item.id}/vectorize`)
      if (!res.ok) {
        alert('Vectorize failed. Check that this is a supported image type.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${item.name}.eps`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setVectorizingIds((prev) => {
        const s = new Set(prev)
        s.delete(item.id)
        return s
      })
    }
  }

  return { artwork, loaded, loading, load, add, remove, vectorize, vectorizingIds }
}
