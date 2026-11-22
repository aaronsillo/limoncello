/**
 * Controles de paginación: selector de tamaño (10/20/30) y navegación de páginas.
 * Pensado para usarse con el hook usePagination.
 */
function Pagination({ page, setPage, pageSize, setPageSize, totalPages, total, from, to }) {
  if (total === 0) return null

  return (
    <div className="pagination">
      <div className="pagination-size">
        <span>Mostrar</span>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value))
            setPage(1)
          }}
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={30}>30</option>
        </select>
      </div>

      <div className="pagination-info">
        {from}–{to} de {total}
      </div>

      <div className="pagination-nav">
        <button
          type="button"
          className="btn btn-small"
          onClick={() => setPage(1)}
          disabled={page <= 1}
        >
          «
        </button>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
        >
          ‹
        </button>
        <span className="pagination-page">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => setPage(page + 1)}
          disabled={page >= totalPages}
        >
          ›
        </button>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => setPage(totalPages)}
          disabled={page >= totalPages}
        >
          »
        </button>
      </div>
    </div>
  )
}

export default Pagination
