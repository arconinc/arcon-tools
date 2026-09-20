type FileItem = { id: string; label: string; url: string; created_at: string }

export function CustomerFilesList({
  files,
  onAddClick,
  onDelete,
  deletingFileId,
}: {
  files: FileItem[]
  onAddClick: () => void
  onDelete: (fileId: string) => void
  deletingFileId: string | null
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Files ({files.length})</h2>
        <button
          onClick={onAddClick}
          className="flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900 font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Attach file
        </button>
      </div>
      {files.length === 0 ? (
        <div className="px-5 py-5 text-sm text-slate-400 text-center">No files attached.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group">
              <svg
                className="w-4 h-4 text-slate-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-sm text-purple-700 hover:underline truncate"
              >
                {f.label}
              </a>
              <button
                onClick={() => onDelete(f.id)}
                disabled={deletingFileId === f.id}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all disabled:opacity-50 flex-shrink-0"
                title="Remove file"
              >
                {deletingFileId === f.id
                  ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                }
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
