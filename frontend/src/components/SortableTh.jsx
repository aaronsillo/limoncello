/**
 * Encabezado de columna que ordena al hacer clic. Se usa con useSortable.
 *
 * <SortableTh label="Nombre" campo="name" orden={orden} onSort={ordenarPor} />
 */
function SortableTh({ label, campo, orden, onSort }) {
  const activo = orden.campo === campo
  return (
    <th
      className="th-sort"
      onClick={() => onSort(campo)}
      title="Ordenar"
      aria-sort={
        activo ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      {label}
      <span className="th-sort-arrow">
        {activo ? (orden.dir === 'asc' ? ' ▲' : ' ▼') : ''}
      </span>
    </th>
  )
}

export default SortableTh
