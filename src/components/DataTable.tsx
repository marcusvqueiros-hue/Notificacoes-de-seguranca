import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'

export interface Col<T> {
  key: string
  label: string
  render: (r: T) => ReactNode
  sort?: (r: T) => string | number
  align?: 'right' | 'center'
  total?: ReactNode
  width?: string
}

export function DataTable<T>({
  rows, cols, defaultSort, onRow, rowKey, maxH = 460, activeRow,
}: {
  rows: T[]
  cols: Col<T>[]
  pageSize?: number
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
  onRow?: (r: T) => void
  rowKey: (r: T) => string
  maxH?: number | string
  activeRow?: (r: T) => boolean
}) {
  const [sort, setSort] = useState(defaultSort)
  const sorted = useMemo(() => {
    const c = cols.find((x) => x.key === sort?.key)
    if (!c?.sort) return rows
    const f = c.sort
    const d = sort!.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = f(a), y = f(b)
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')) * d
    })
  }, [rows, sort, cols])
  const hasTotal = cols.some((c) => c.total !== undefined)

  return (
    <div>
      <div className="overflow-auto" style={{ maxHeight: maxH }}>
        <table className="dt">
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  style={{ textAlign: c.align, width: c.width }}
                  onClick={() => c.sort && setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))}
                  aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={rowKey(r)} onClick={() => onRow?.(r)} className={onRow ? 'cursor-pointer' : ''} style={activeRow?.(r) ? { background: 'color-mix(in srgb, var(--brand) 10%, transparent)' } : undefined}>
                {cols.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align }}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
            {!sorted.length && (
              <tr><td colSpan={cols.length} className="py-10 text-center text-muted">Nenhum registro para os filtros atuais.</td></tr>
            )}
          </tbody>
          {hasTotal && (
            <tfoot>
              <tr>
                {cols.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align, fontWeight: 700, background: 'var(--surface-2)', borderTop: '1px solid var(--border)', position: 'sticky', bottom: 0, zIndex: 1 }}>{c.total}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="px-3 py-2 text-xs text-muted">{sorted.length} registros · role para ver todos</div>
    </div>
  )
}
