'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Preview {
  total: number
  tagsFound: string[]
  ownerEmails: string[]
}

interface ImportResult {
  customers: { inserted: number; updated: number }
  vendors: { inserted: number; updated: number }
  opportunities: { inserted: number; updated: number }
  tags_created: number
  unmatched_owners: string[]
  unmatched_orgs: string[]
  errors: string[]
}

// ─── Client-side XLSX preview parser ─────────────────────────────────────────

async function parseXlsxPreview(file: File, importType: 'vendors' | 'customers' | 'opportunities' | null): Promise<Preview> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })

  const tagSet = new Set<string>()
  const ownerEmailSet = new Set<string>()

  function extractEmail(raw: unknown): string | null {
    const s = String(raw ?? '').trim()
    if (!s) return null
    return s.split(';')[1]?.trim() || null
  }

  for (const row of rows) {
    for (const col of ['Tag1', 'Tag2', 'Tag3', 'Tag4', 'Tag5', 'Tag6', 'Tag7', 'Tag8', 'Tag9']) {
      const t = String(row[col] ?? '').trim()
      if (t) tagSet.add(t)
    }

    if (importType === 'opportunities') {
      for (const col of ['UserResponsibleEmailAddress', 'CSR', 'Designer']) {
        const email = extractEmail(row[col])
        if (email) ownerEmailSet.add(email)
      }
    } else {
      const ct = String(row['Company Type'] ?? '').trim().toLowerCase()
      if (ct && ct !== 'vendor' && ct !== 'customer') {
        tagSet.add(String(row['Company Type']).trim())
      }
      const email = extractEmail(row['OrganisationOwner'])
      if (email) ownerEmailSet.add(email)
    }
  }

  return {
    total: rows.length,
    tagsFound: [...tagSet].sort(),
    ownerEmails: [...ownerEmailSet].sort(),
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface NormalizeResult {
  customers: number
  vendors: number
  contacts: number
  skipped: number
}

export default function CrmImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importType, setImportType] = useState<'vendors' | 'customers' | 'opportunities' | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [normalizing, setNormalizing] = useState(false)
  const [normalizeResult, setNormalizeResult] = useState<NormalizeResult | null>(null)
  const [normalizeError, setNormalizeError] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setPreview(null)
    setResult(null)
    setError(null)
    if (!f) return

    setPreviewing(true)
    try {
      setPreview(await parseXlsxPreview(f, importType))
    } catch {
      setError('Failed to read file. Make sure it is a valid .xlsx file.')
    } finally {
      setPreviewing(false)
    }
  }

  async function handleImport() {
    if (!file || !importType) return
    setImporting(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('importType', importType)

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

  async function handleNormalize() {
    setNormalizing(true)
    setNormalizeResult(null)
    setNormalizeError(null)
    try {
      const res = await fetch('/api/admin/crm/normalize-phones', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setNormalizeError(data.error ?? 'Normalization failed'); return }
      setNormalizeResult(data as NormalizeResult)
    } catch {
      setNormalizeError('Network error during normalization')
    } finally {
      setNormalizing(false)
    }
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
    setImportType(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">CRM Import</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Import organizations from an Insightly Excel export (.xlsx) into Customers and Vendors.
          Re-importing is safe — existing records update in place, nothing is deleted.
        </p>
      </div>

      {/* Upload card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Import Type</h2>

        <div className="flex gap-2 mb-5">
          {(['vendors', 'customers', 'opportunities'] as const).map(type => (
            <button
              key={type}
              onClick={() => setImportType(type)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold border transition-colors capitalize ${
                importType === type
                  ? 'bg-purple-700 text-white border-purple-700'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {type === 'vendors' ? 'Vendors' : type === 'customers' ? 'Customers' : 'Opportunities'}
            </button>
          ))}
        </div>

        <h2 className="text-sm font-semibold text-slate-700 mb-4">Select Excel File</h2>

        <div className="flex items-center gap-3 flex-wrap">
          <label className="cursor-pointer px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            {file ? 'Change file' : 'Choose .xlsx file…'}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
          {file && (
            <span className="text-sm text-slate-600 font-medium">
              {file.name}{' '}
              <span className="text-slate-400 font-normal">({(file.size / 1024).toFixed(0)} KB)</span>
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

          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatBox label="Total Records" value={preview.total} />
            <StatBox
              label={`→ ${importType === 'vendors' ? 'Vendors' : importType === 'customers' ? 'Customers' : 'Opportunities'}`}
              value={preview.total}
              color={importType === 'vendors' ? 'green' : importType === 'customers' ? 'blue' : 'purple'}
            />
          </div>

          {preview.tagsFound.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tags found in file</p>
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
            {!importType && (
              <p className="text-xs text-amber-600 font-medium">Select an import type above before importing.</p>
            )}
            <button
              onClick={handleImport}
              disabled={importing || !importType}
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors"
            >
              {importing
                ? 'Importing…'
                : `Import ${preview.total.toLocaleString()} as ${importType === 'vendors' ? 'Vendors' : importType === 'customers' ? 'Customers' : 'Opportunities'}`}
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

          <div className="grid grid-cols-1 gap-3 mb-5">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {importType === 'vendors' ? 'Vendors' : importType === 'customers' ? 'Customers' : 'Opportunities'}
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-green-700">
                  {importType === 'vendors' ? result.vendors.inserted : importType === 'customers' ? result.customers.inserted : result.opportunities?.inserted ?? 0}
                </span> inserted &nbsp;·&nbsp;
                <span className="font-semibold text-blue-700">
                  {importType === 'vendors' ? result.vendors.updated : importType === 'customers' ? result.customers.updated : result.opportunities?.updated ?? 0}
                </span> updated
              </p>
            </div>
          </div>

          {result.tags_created > 0 && (
            <p className="text-sm text-slate-600 mb-3">
              <span className="font-semibold">{result.tags_created}</span> new tag{result.tags_created !== 1 ? 's' : ''} created
            </p>
          )}

          {result.unmatched_orgs?.length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-800 mb-1.5">
                {result.unmatched_orgs.length} org{result.unmatched_orgs.length !== 1 ? 's' : ''} not matched to a customer — opportunities skipped:
              </p>
              <div className="flex flex-wrap gap-1">
                {result.unmatched_orgs.map(e => (
                  <span key={e} className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700 font-medium">{e}</span>
                ))}
              </div>
            </div>
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
              href={importType === 'vendors' ? '/crm/vendors' : importType === 'customers' ? '/crm/customers' : '/crm/opportunities'}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg transition-colors"
            >
              {importType === 'vendors' ? 'View Vendors' : importType === 'customers' ? 'View Customers' : 'View Opportunities'}
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

      {/* Normalize phone numbers */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mt-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Normalize Phone Numbers</h2>
        <p className="text-xs text-slate-500 mb-4">
          Retroactively format all phone numbers in the database to (NNN) NNN-NNNN. Safe to run multiple times — only updates numbers that are not yet in the correct format.
        </p>
        <button
          onClick={handleNormalize}
          disabled={normalizing}
          className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors"
        >
          {normalizing ? 'Normalizing…' : 'Normalize All Phone Numbers'}
        </button>
        {normalizeError && (
          <p className="mt-3 text-sm text-red-600">{normalizeError}</p>
        )}
        {normalizeResult && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Customers" value={normalizeResult.customers} color="blue" />
            <StatBox label="Vendors" value={normalizeResult.vendors} color="green" />
            <StatBox label="Contacts" value={normalizeResult.contacts} color="purple" />
            <StatBox label="Already formatted / skipped" value={normalizeResult.skipped} />
          </div>
        )}
      </div>

      {/* Field mapping reference */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mt-6">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">Field Mapping Reference — Customers &amp; Vendors</h2>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
          {[
            ['RecordId', 'insightly_id (deduplication key)'],
            ['OrganizationName', 'name'],
            ['Company Type', 'tag (if not "Vendor" or "Customer")'],
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
            ['Tag1–Tag9 + Company Type', 'crm_entity_tags (created if new)'],
            ['Premier Group Member', 'premier_group_member (Vendors)'],
            ['Product Line', 'product_line (Vendors)'],
            ['Speciality', 'specialty (Vendors)'],
            ['Arcon Account Number', 'arcon_account_number (Vendors)'],
            ['Arcon Username/Password', 'arcon_username / arcon_password (Vendors)'],
            ['*Email fields', 'vendor email columns (Vendors)'],
          ].map(([xlsx, db]) => (
            <div key={xlsx} className="flex gap-2 py-1 text-xs border-b border-slate-50 last:border-0">
              <span className="font-mono text-slate-500 shrink-0 w-40 truncate">{xlsx}</span>
              <span className="text-slate-700">{db}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Opportunities field mapping reference */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mt-4">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">Field Mapping Reference — Opportunities</h2>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
          {[
            ['RecordId', 'insightly_id (deduplication key)'],
            ['OpportunityName', 'name'],
            ['Details', 'description'],
            ['OrganizationId', 'customer_id (matched via crm_customers.insightly_id)'],
            ['OrganizationName', 'customer_id (fallback name match)'],
            ['BidAmount', 'value'],
            ['Probability', 'probability'],
            ['ForecastCloseDate', 'forecast_close_date'],
            ['ActualCloseDate', 'closed_at'],
            ['PipelineCurrentStage', 'pipeline_stage (enum matched)'],
            ['OpportunityCategory', 'category (enum matched)'],
            ['CurrentState', 'status (WON/LOST/else → open)'],
            ['LastStateChangeReason', 'status_reason'],
            ['UserResponsibleEmailAddress', 'assigned_to (matched by email)'],
            ['CSR', 'csr_user_id (matched by email)'],
            ['Designer', 'designer_user_id (matched by email)'],
            ['Tag1–Tag9', 'crm_entity_tags (created if new)'],
          ].map(([xlsx, db]) => (
            <div key={xlsx} className="flex gap-2 py-1 text-xs border-b border-slate-50 last:border-0">
              <span className="font-mono text-slate-500 shrink-0 w-40 truncate">{xlsx}</span>
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
