'use client'

import { Fragment, type KeyboardEvent, type ReactNode, useMemo, useState } from 'react'

type SortDirection = 'asc' | 'desc'
type SortValue = string | number | boolean | Date | null | undefined

export type DataTableColumn<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  sortValue?: (row: T) => SortValue
  className?: string
  headerClassName?: string
  skeletonWidth?: string
}

type Pagination = {
  page: number
  total: number
  pageSize: number
  itemName: string
  onPageChange: (page: number) => void
}

type DataTableProps<T> = {
  rows: T[]
  columns: DataTableColumn<T>[]
  loading: boolean
  emptyMessage: string
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  renderExpandedRow?: (row: T) => ReactNode
  pagination?: Pagination
  minWidth?: string
}

function normalizeSortValue(value: SortValue): string | number {
  if (value == null) return ''
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') return value
  return value.toLowerCase()
}

function compareSortValues(a: SortValue, b: SortValue, direction: SortDirection) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1

  const normalizedA = normalizeSortValue(a)
  const normalizedB = normalizeSortValue(b)
  const modifier = direction === 'asc' ? 1 : -1

  if (typeof normalizedA === 'number' && typeof normalizedB === 'number') {
    return (normalizedA - normalizedB) * modifier
  }

  return String(normalizedA).localeCompare(String(normalizedB), undefined, { numeric: true }) * modifier
}

function SortIcon({ sorted, direction }: { sorted: boolean; direction: SortDirection | null }) {
  if (!sorted) {
    return (
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className="shrink-0 text-purple-950/25 transition-colors group-hover:text-purple-700"
      >
        <path d="M6 2L9 5H3L6 2Z" fill="currentColor" />
        <path d="M6 10L3 7H9L6 10Z" fill="currentColor" />
      </svg>
    )
  }
  if (direction === 'asc') {
    return (
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className="shrink-0 text-purple-700"
      >
        <path d="M6 2L10 7H2L6 2Z" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className="shrink-0 text-purple-700"
    >
      <path d="M6 10L2 5H10L6 10Z" fill="currentColor" />
    </svg>
  )
}

export function DataTable<T>({
  rows,
  columns,
  loading,
  emptyMessage,
  getRowKey,
  onRowClick,
  renderExpandedRow,
  pagination,
  minWidth = '760px',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const sortedRows = useMemo(() => {
    const sortColumn = columns.find((column) => column.key === sortKey)
    if (!sortColumn?.sortValue) return rows

    const getSortValue = sortColumn.sortValue
    return [...rows].sort((a, b) => compareSortValues(getSortValue(a), getSortValue(b), sortDirection))
  }, [columns, rows, sortDirection, sortKey])

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1
  const rangeFrom = pagination && pagination.total === 0 ? 0 : pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 0
  const rangeTo = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.total) : 0

  function updateSort(column: DataTableColumn<T>) {
    if (!column.sortValue) return
    if (sortKey === column.key) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortKey(column.key)
    setSortDirection('asc')
  }

  function handleRowKeyDown(e: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (!onRowClick || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    onRowClick(row)
  }

  return (
    <div className="overflow-hidden rounded-[10px] border border-purple-100 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead className="border-b border-purple-100 bg-purple-50/70">
            <tr>
              {columns.map((column) => {
                const isSorted = sortKey === column.key
                return (
                  <th
                    key={column.key}
                    className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-purple-950/70 ${column.className ?? ''} ${column.headerClassName ?? ''}`}
                    aria-sort={isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => updateSort(column)}
                        className="group inline-flex items-center gap-1.5 rounded-md text-left transition-colors hover:text-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
                      >
                        <span>{column.header}</span>
                        <SortIcon
                          sorted={isSorted}
                          direction={isSorted ? sortDirection : null}
                        />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-50">
            {loading && Array.from({ length: 5 }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column, columnIndex) => (
                  <td key={column.key} className={`px-5 py-3.5 ${column.className ?? ''}`}>
                    <div
                      className="h-4 animate-pulse rounded bg-purple-50"
                      style={{ width: column.skeletonWidth ?? (columnIndex === 0 ? '60%' : '40%') }}
                    />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && sortedRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!loading && sortedRows.map((row) => {
              const expandedRow = renderExpandedRow?.(row)
              return (
                <Fragment key={getRowKey(row)}>
                  <tr
                    onClick={() => onRowClick?.(row)}
                    onKeyDown={(e) => handleRowKeyDown(e, row)}
                    className={onRowClick ? 'cursor-pointer transition-colors hover:bg-purple-50/40 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-inset' : 'transition-colors hover:bg-purple-50/30'}
                    role={onRowClick ? 'button' : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className={`px-5 py-3.5 align-middle ${column.className ?? ''}`}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                  {expandedRow && (
                    <tr>
                      <td colSpan={columns.length} className="border-t border-purple-50 bg-purple-50/40 px-5 py-4">
                        {expandedRow}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {!loading && pagination && pagination.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-purple-50 px-5 py-3">
          <span className="text-xs text-slate-500">
            Showing {rangeFrom}-{rangeTo} of {pagination.total} {pagination.itemName}{pagination.total !== 1 ? 's' : ''}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))}
                disabled={pagination.page === 1}
                className="rounded-lg border border-purple-100 bg-white px-3 py-1.5 text-xs font-semibold text-purple-900 transition-colors hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-1 text-xs text-slate-500">Page {pagination.page} of {totalPages}</span>
              <button
                onClick={() => pagination.onPageChange(Math.min(totalPages, pagination.page + 1))}
                disabled={pagination.page === totalPages}
                className="rounded-lg border border-purple-100 bg-white px-3 py-1.5 text-xs font-semibold text-purple-900 transition-colors hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
