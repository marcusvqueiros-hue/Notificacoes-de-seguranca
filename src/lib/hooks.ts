import { useCallback, useMemo } from 'react'
import { useStore } from './store'
import { applyFilters, kpis } from './aggregate'
import { palette } from '../components/Chart'
import type { Pal } from './charts'
import type { FilterKey } from './types'

export function useData() {
  const rows = useStore((s) => s.rows)
  const filters = useStore((s) => s.filters)
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters])
  const k = useMemo(() => kpis(filtered), [filtered])
  /** linhas com todos os filtros, exceto o da própria dimensão (gráfico mantém as demais barras, esmaecidas) */
  const except = useCallback((key: FilterKey) => applyFilters(rows, filters, key), [rows, filters])
  return { rows, filtered, k, filters, except }
}

export function usePal(): Pal {
  const theme = useStore((s) => s.theme)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => palette(), [theme])
}
