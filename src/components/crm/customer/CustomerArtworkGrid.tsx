'use client'

import { formatBytes } from '@/lib/format'
import type { ArtworkItem } from '@/hooks/useArtwork'

type Props = {
  artwork: ArtworkItem[]
  loaded: boolean
  loading: boolean
  vectorizingIds: Set<string>
  onAdd: () => void
  onVectorize: (item: ArtworkItem) => void
  onDelete: (id: string) => void
}

export function CustomerArtworkGrid({ artwork, loaded, loading, vectorizingIds, onAdd, onVectorize, onDelete }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Artwork{loaded ? ` (${artwork.length})` : ''}
        </h2>
        <button
          onClick={onAdd}
          className="px-3 py-1.5 bg-purple-700 text-white text-sm font-semibold rounded-lg hover:bg-purple-800 transition-colors"
        >
          + Add Artwork
        </button>
      </div>

      {loading && (
        <div className="text-center py-10 text-sm text-slate-400">Loading artwork…</div>
      )}

      {loaded && !loading && artwork.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-400">
          No artwork yet. Upload files or link Google Drive assets.
        </div>
      )}

      {artwork.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {artwork.map((item) => {
            const thumb = item.thumbnail_url ?? null
            const ext = item.file_name?.split('.').pop()?.toUpperCase() ?? '?'
            const date = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

            return (
              <div key={item.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                  {item.is_drive_link ? (
                    <div className="h-36 bg-slate-50 flex items-center justify-center">
                      <svg className="w-14 h-14" viewBox="0 0 87.3 78" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 50H0c0 1.55.4 3.1 1.2 4.5L6.6 66.85z" fill="#0066DA"/>
                        <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 45.5c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z" fill="#00AC47"/>
                        <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H60.1l5.9 11.5 7.55 12.3z" fill="#EA4335"/>
                        <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2L43.65 25z" fill="#00832D"/>
                        <path d="M60.1 50H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2L60.1 50z" fill="#2684FC"/>
                        <path d="M73.4 26.5l-12.85-22.3c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 60.1 50h27.45c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z" fill="#FFBA00"/>
                      </svg>
                    </div>
                  ) : item.dropbox_url && !item.is_dropbox_file ? (
                    <div className="h-36 bg-slate-50 flex items-center justify-center">
                      <svg className="w-14 h-14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 5.25a1.5 1.5 0 011.5-1.5h6l1.5 1.5H18a1.5 1.5 0 011.5 1.5v11a1.5 1.5 0 01-1.5 1.5H4.5a1.5 1.5 0 01-1.5-1.5V5.25z" fill="#0061FF"/>
                      </svg>
                    </div>
                  ) : thumb ? (
                    <div className="h-36 bg-slate-100 overflow-hidden relative">
                      <img
                        src={thumb}
                        alt={item.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement
                          img.style.display = 'none'
                          const fallback = img.nextElementSibling as HTMLElement | null
                          if (fallback) fallback.style.display = 'flex'
                        }}
                      />
                      <div className="absolute inset-0 hidden items-center justify-center bg-slate-50">
                        <span className="text-2xl font-black text-slate-300">{ext}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-36 bg-slate-50 flex items-center justify-center">
                      <span className="text-2xl font-black text-slate-300">{ext}</span>
                    </div>
                  )}
                </a>

                <div className="p-3 flex flex-col gap-1 flex-1">
                  <div className="text-sm font-semibold text-slate-800 truncate" title={item.name}>{item.name}</div>
                  {item.description && (
                    <div className="text-xs text-slate-500 line-clamp-2">{item.description}</div>
                  )}
                  <div className="text-xs text-slate-400 mt-auto pt-1 space-y-0.5">
                    {item.is_drive_link
                      ? <span>Google Drive</span>
                      : item.dropbox_url
                      ? <span>{item.is_dropbox_file ? 'Dropbox File' : 'Dropbox Folder'}</span>
                      : (
                        <span>
                          {item.mime_type?.split('/')[1]?.toUpperCase() ?? ext}
                          {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                          {item.file_size ? ` · ${formatBytes(item.file_size)}` : ''}
                        </span>
                      )
                    }
                    <div>{date}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    {!item.is_drive_link && !item.dropbox_url &&
                      item.cloudinary_resource_type === 'image' &&
                      (item.mime_type === 'image/png' || item.mime_type === 'image/jpeg') && (
                      <button
                        onClick={() => onVectorize(item)}
                        disabled={vectorizingIds.has(item.id)}
                        className="text-xs text-purple-600 hover:text-purple-800 transition-colors disabled:opacity-50"
                      >
                        {vectorizingIds.has(item.id) ? 'Vectorizing…' : 'Vectorize → EPS'}
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(item.id)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
