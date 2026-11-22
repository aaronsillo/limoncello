import { useEffect, useMemo, useState } from 'react'

/**
 * Paginación en memoria para una lista.
 * Devuelve los elementos de la página actual y los controles necesarios.
 *
 * @param {Array} items  Lista completa de registros
 * @returns {{
 *   pageItems: Array, page: number, setPage: function,
 *   pageSize: number, setPageSize: function,
 *   totalPages: number, total: number,
 *   from: number, to: number
 * }}
 */
export function usePagination(items) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Si cambian los datos o el tamaño de página, corrige la página actual
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return {
    pageItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total,
    from,
    to,
  }
}
