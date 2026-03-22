'use client'

import { useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Preview {
  total: number
  customers: number
  vendors: number
  dual: number
  tagsFound: string[]
  ownerEmails: string[]
}

interface ImportResult {
  customers: { inserted: number; updated: number }
  vendors: { inserted: number; updated: number }
  tags_created: number
  unmatched_owners: string[]
  errors: string[]
}

// ─── Client-side CSV preview parser ──────────────────────────────────────────

function parseCsvPreview(text: string): Preview {
  const lines = text.split(/\r?\n/)
  if (lines.length < 2) return { total: 0, customers: 0, vendors: 0, dual: 0, tagsFound: [], ownerEmails: [] }

  // Simple header split (no quoted-field handling needed — header row is clean)
  const headers = lines[0].split(',').map(h => h.trim())
  const idx = (name: string) => headers.indexOf(name)

  const companyTypeIdx = idx('Company Type')
  const tag1Idx = idx('Tag1')
  const tag2Idx = idx('Tag2')
  const tag3Idx = idx('Tag3')
  const ownerIdx = idx('OrganisationOwner')

  let customers = 0, vendors = 0, dual = 0
  const tagSet = new Set<string>()
  const ownerEmailSet = new Set<string>()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Very lightweight field split for preview only (sufficient for non-quoted columns)
    const cols = line.split(',')

    const ct = (cols[companyTypeIdx] ?? '').trim().toLowerCase()
    const isVendor = ct === 'vendor'
    const isBoth = ct === 'customer and vendor'
    const isCustomer = !isVendor

    if (isBoth) dual++
    else if (isVendor) vendors++
    else customers++

    for (const tagIdx of [tag1Idx, tag2Idx, tag3Idx]) {
      const t = (cols[tagIdx] ?? '').trim()
      if (t) tagSet.add(t)
    }
    if (ct === 'competitor') tagSet.add('Competitor')
    if (ct === 'association') tagSet.add('Association')

    if (ownerIdx >= 0) {
      const ownerRaw = (cols[ownerIdx] ?? '').trim()
      const parts = ownerRaw.split(';')
      const email = parts[1]?.trim()
      if (email) ownerEmailSet.add(email)
    }
  }

  return {
    total: customers + vendors + dual,
    customers: customers + dual,
    vendors: vendors + dual,
    dual,
    tagsFound: [...tagSet].sort(),
    ownerEmails: [...ownerEmailSet].sort(),
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CrmImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setPreview(null)
    setResult(null)
    setError(null)
    if (!f) return

    setPreviewing(true)
    try {
      const text = await f.text()
      setPreview(parseCsvPreview(text))
    } catch {
      setError('Failed to read file. Make sure it is a valid CSV.')
    } finally {
      setPreviewing(false)
    }
  }

  async function handleImport() {
    if (!file) return
    setImporting(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/admin/crm/import', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Import failed')
        return
      }
      setResult(data as ImportResult)
    } catch {
      setError('Network error — import may have partially completed. Check the CRM.')
    } finally {
      setImporting(false)
    }
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const totalImported = result
    ? result.customers.inserted + result.customers.updated + result.vendors.inserted + result.vendors.updated
    : 0

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">CRM Import</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Import organizations from an Insightly CSV export into Customers and Vendors.
          Re-importing is safe — existing records update in place, nothing is deleted.
        </p>
      </div>

      {/* Upload card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Select CSV File</h2>

        <div className="flex items-center gap-3 flex-wrap">
          <label className="cursor-pointer px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            {file ? 'Change file' : 'Choose file…'}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
          {file && (
            <span className="text-sm text-slate-600 font-medium">
              {file.name} <span className="text-slate-400 font-normal">({(file.size / 1024).toFixed(0)} KB)</span>
            </span>
          )}
        </div>

        {previewing && (
          <p className="mt-3 text-sm text-slate-400 animate-pulse">Analyzing file…</p>
        )}
      </div>

      {/* Preview card */}
      {preview && !result && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Import Preview</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatBox label="Total Records" value={preview.total} />
            <StatBox label="→ Customers" value={preview.customers} color="blue" />
            <StatBox label="→ Vendors" value={preview.vendors} color="green" />
            <StatBox label="Dual (both)" value={preview.dual} color="purple" />
          </div>

          {preview.tagsFound.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tags found in CSV</p>
              <div className="flex flex-wrap gap-1.5">
                {preview.tagsFound.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">{t}</span>
                ))}
              </div>
            </div>
          )}

          {preview.ownerEmails.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Organisation owners ({preview.ownerEmails.length}) — will match to users by email
              </p>
              <div className="flex flex-wrap gap-1">
                {preview.ownerEmails.map(e => (
                  <span key={e} className="px-2 py-0.5 rounded text-xs bg-slate-50 border border-slate-200 text-slate-600">{e}</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 mt-4">
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors"
            >
              {importing ? 'Importing…' : `Import ${preview.total.toLocaleString()} Records`}
            </button>
            <button
              onClick={reset}
              disabled={importing}
              className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
          </div>

          {importing && (
            <div className="mt-3">
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full animate-pulse w-full" />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Processing {preview.total.toLocaleString()} records — this may take a minute…
              </p>
            </div>
          )}
        </div>
      )}

      {/* Result card */}
      {result && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-green-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <h2 className="text-sm font-semibold text-slate-700">Import Complete</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Customers</p>
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-green-700">{result.customers.inserted}</span> inserted &nbsp;·&nbsp;
                <span className="font-semibold text-blue-700">{result.customers.updated}</span> updated
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Vendors</p>
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-green-700">{result.vendors.inserted}</span> inserted &nbsp;·&nbsp;
                <span className="font-semibold text-blue-700">{result.vendors.updated}</span> updated
              </p>
            </div>
          </div>

          {result.tags_created > 0 && (
            <p className="text-sm text-slate-600 mb-3">
              <span className="font-semibold">{result.tags_created}</span> new tag{result.tags_created !== 1 ? 's' : ''} created
            </p>
          )}

          {result.unmatched_owners.length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-800 mb-1.5">
                {result.unmatched_owners.length} owner email{result.unmatched_owners.length !== 1 ? 's' : ''} not matched to a user — records left unassigned:
              </p>
              <div className="flex flex-wrap gap-1">
                {result.unmatched_owners.map(e => (
                  <span key={e} className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700 font-medium">{e}</span>
                ))}
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-semibold text-red-700 mb-1.5">Errors ({result.errors.length}):</p>
              <ul className="text-xs text-red-600 space-y-0.5">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex gap-3">
            <a
              href="/crm/customers"
              className="px-4 py-2 text-sm font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg transition-colors"
            >
              View Customers
            </a>
            <a
              href="/crm/vendors"
              className="px-4 py-2 text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
              View Vendors
            </a>
            <button
              onClick={reset}
              className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors ml-auto"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Field mapping reference */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mt-6">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">Field Mapping Reference</h2>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
          {[
            ['RecordId', 'insightly_id (deduplication key)'],
            ['OrganizationName', 'name'],
            ['Company Type', 'table: Customer / Vendor / Both'],
            ['Client Status', 'client_status'],
            ['OrganisationOwner', 'assigned_to (matched by email)'],
            ['Background', 'description'],
            ['Phone', 'phone'],
            ['Fax', 'fax'],
            ['Website', 'website'],
            ['EmailDomain', 'email_domains'],
            ['BillingAddress*', 'billing_address1, city, state, zip, country'],
            ['ShippingAddress*', 'shipping_address1, city, state, zip, country'],
            ['Artwork Notes', 'artwork_notes'],
            ['General Logo Color', 'general_logo_color'],
            ['Formal PMS Colors', 'formal_pms_colors'],
            ['Industry', 'industry'],
            ['Additional Information', 'notes'],
            ['Power Units / Trucks & Trailers', 'power_units'],
            ['MTA?', 'mta'],
            ['MTA/Trucking', 'mta_trucking'],
            ['Tag1/Tag2/Tag3', 'crm_entity_tags (created if new)'],
            ['Premier Group Member', 'premier_group_member (Vendors)'],
            ['Product Line', 'product_line (Vendors)'],
            ['Speciality', 'specialty (Vendors)'],
            ['Arcon Account Number', 'arcon_account_number (Vendors)'],
            ['Arcon Username/Password', 'arcon_username / arcon_password (Vendors)'],
            ['*Email fields', 'vendor email columns (Vendors)'],
          ].map(([csv, db]) => (
            <div key={csv} className="flex gap-2 py-1 text-xs border-b border-slate-50 last:border-0">
              <span className="font-mono text-slate-500 shrink-0 w-40 truncate">{csv}</span>
              <span className="text-slate-700">{db}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color?: 'blue' | 'green' | 'purple' }) {
  const valueClass = color === 'blue' ? 'text-blue-700' : color === 'green' ? 'text-green-700' : color === 'purple' ? 'text-purple-700' : 'text-slate-900'
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueClass}`}>{value.toLocaleString()}</p>
    </div>
  )
}
