type FileItem = { id: string; label: string; url: string; created_at: string }

export function CustomerFilesList({ files }: { files: FileItem[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-700">Files ({files.length})</h2>
      </div>
      {files.length === 0 ? (
        <div className="px-5 py-5 text-sm text-slate-400 text-center">No files attached.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {files.map((f) => (
            <a
              key={f.id}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
            >
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
              <span className="text-sm text-purple-700 hover:underline">{f.label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
