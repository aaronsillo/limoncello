import { useEffect, useState } from 'react'
import { createResource } from '../api/api'
import Modal from '../components/Modal'
import SearchableSelect from '../components/SearchableSelect'
import CotizacionModal from '../components/CotizacionModal'
import OrdenFormModal from '../components/OrdenFormModal'
import { ordenarEstadosOrden } from '../utils/ordenEstados'

const ordersApi = createResource('orders')
const customersApi = createResource('customers')
const statusApi = createResource('status')
const livesApi = createResource('lives')
const lockersApi = createResource('lockers')

// En la tabla status, type === 2 corresponde a los estados de Orden
const STATUS_TYPE_ORDEN = 2

// Solo se pueden asignar a órdenes los lives con este estado (status_id)
const LIVE_STATUS_SELECCIONABLE = 14

// Primer y último día del mes actual, en formato YYYY-MM-DD
const primerDiaDelMes = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA')
}
const ultimoDiaDelMes = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString(
    'en-CA'
  )
}

function Ordenes() {
  const [registros, setRegistros] = useState([])
  const [customers, setCustomers] = useState([])
  const [statuses, setStatuses] = useState([])
  const [lives, setLives] = useState([])
  const [allLives, setAllLives] = useState([])
  const [allLockers, setAllLockers] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  // Filtros
  const [filtroId, setFiltroId] = useState('')
  const [filtroLive, setFiltroLive] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroCasillero, setFiltroCasillero] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState(primerDiaDelMes())
  const [filtroFechaHasta, setFiltroFechaHasta] = useState(ultimoDiaDelMes())

  // Drag & drop
  const [dragId, setDragId] = useState(null)
  const [overStatus, setOverStatus] = useState(null)

  // Modal de crear/editar
  const [formOpen, setFormOpen] = useState(false)
  const [ordenEditar, setOrdenEditar] = useState(null) // null = nueva orden

  // Modal de eliminar
  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  // Modal de productos de la orden
  const [ordenProductos, setOrdenProductos] = useState(null) // orden abierta
  const [productos, setProductos] = useState([])
  const [disponibles, setDisponibles] = useState([])
  const [prodParaAgregar, setProdParaAgregar] = useState('')
  const [cargandoProductos, setCargandoProductos] = useState(false)

  // Modal de cotización
  const [ordenCotizar, setOrdenCotizar] = useState(null)

  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      setRegistros(await ordersApi.list())
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  const cargarCatalogos = async () => {
    try {
      const [cu, st, lv, lk] = await Promise.all([
        customersApi.list(),
        statusApi.list(),
        livesApi.list(),
        lockersApi.list(),
      ])
      setCustomers(cu)
      setAllLockers(lk)
      setStatuses(
        ordenarEstadosOrden(
          st.filter((s) => Number(s.type) === STATUS_TYPE_ORDEN)
        )
      )
      // Todos los lives (para el filtro del board)
      setAllLives(lv)
      // Solo los lives cuyo estado (status_id) sea el seleccionable (para el formulario)
      setLives(
        lv.filter((l) => Number(l.status_id) === LIVE_STATUS_SELECCIONABLE)
      )
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    cargar()
    cargarCatalogos()
  }, [])

  const abrirNuevo = () => {
    setOrdenEditar(null)
    setError(null)
    setFormOpen(true)
  }

  const abrirEditar = (registro) => {
    setOrdenEditar(registro)
    setError(null)
    setFormOpen(true)
  }

  const cerrarForm = () => setFormOpen(false)

  const alGuardar = async () => {
    setFormOpen(false)
    await cargar()
  }

  const confirmarEliminar = async () => {
    if (!porEliminar) return
    setEliminando(true)
    setError(null)
    try {
      await ordersApi.remove(porEliminar.id)
      setPorEliminar(null)
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEliminando(false)
    }
  }

  // ===== Productos de la orden =====
  const cargarProductosOrden = async (orderId) => {
    setCargandoProductos(true)
    setError(null)
    try {
      const [enOrden, libres] = await Promise.all([
        fetch(`/api/orders/${orderId}/products`).then((r) => r.json()),
        fetch(`/api/orders/${orderId}/available-products`).then((r) => r.json()),
      ])
      setProductos(enOrden)
      setDisponibles(libres)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargandoProductos(false)
    }
  }

  const abrirProductos = (orden) => {
    setOrdenProductos(orden)
    setProdParaAgregar('')
    setError(null)
    cargarProductosOrden(orden.id)
  }

  const cerrarProductos = () => {
    setOrdenProductos(null)
    setProductos([])
    setDisponibles([])
    // Refrescar el board para ver el total actualizado
    cargar()
  }

  const agregarProducto = async () => {
    if (!prodParaAgregar) return
    setError(null)
    try {
      const res = await fetch(`/api/orders/${ordenProductos.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: Number(prodParaAgregar) }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo agregar el producto')
      }
      setProdParaAgregar('')
      await cargarProductosOrden(ordenProductos.id)
    } catch (err) {
      setError(err.message)
    }
  }

  const quitarProducto = async (detailId) => {
    setError(null)
    try {
      const res = await fetch(
        `/api/orders/${ordenProductos.id}/products/${detailId}`,
        { method: 'DELETE' }
      )
      if (!res.ok && res.status !== 204) {
        throw new Error('No se pudo quitar el producto')
      }
      await cargarProductosOrden(ordenProductos.id)
    } catch (err) {
      setError(err.message)
    }
  }

  const nombreProducto = (p) =>
    [p.clothe_name, p.brand_name, p.size, p.color].filter(Boolean).join(' · ')

  // ===== Drag & drop =====
  const onDragStart = (id) => setDragId(id)

  const onDragEnd = () => {
    setDragId(null)
    setOverStatus(null)
  }

  const onDrop = async (statusId) => {
    const orden = registros.find((o) => o.id === dragId)
    setOverStatus(null)
    setDragId(null)
    if (!orden || Number(orden.status_id) === Number(statusId)) return

    // Actualización optimista en la UI
    const previos = registros
    setRegistros((prev) =>
      prev.map((o) =>
        o.id === orden.id
          ? {
              ...o,
              status_id: statusId,
              status_name:
                statuses.find((s) => s.id === statusId)?.name ?? o.status_name,
            }
          : o
      )
    )

    try {
      await ordersApi.patch(orden.id, 'status', { status_id: statusId })
    } catch (err) {
      // Si falla, revertimos
      setRegistros(previos)
      setError(err.message)
    }
  }

  // Cambiar estado desde el menú "Mover a..." (sin arrastrar)
  const moverA = async (orden, statusId) => {
    if (!statusId || Number(orden.status_id) === Number(statusId)) return

    const previos = registros
    setRegistros((prev) =>
      prev.map((o) =>
        o.id === orden.id
          ? {
              ...o,
              status_id: Number(statusId),
              status_name:
                statuses.find((s) => Number(s.id) === Number(statusId))?.name ??
                o.status_name,
            }
          : o
      )
    )
    try {
      await ordersApi.patch(orden.id, 'status', { status_id: Number(statusId) })
    } catch (err) {
      setRegistros(previos)
      setError(err.message)
    }
  }

  const formatTotal = (valor) => {
    const n = Number(valor)
    return Number.isNaN(n) ? valor : n.toFixed(2)
  }

  // Aplica los filtros de live, cliente y fecha sobre las órdenes
  const registrosFiltrados = registros.filter((o) => {
    if (filtroId && Number(o.id) !== Number(filtroId)) return false
    if (filtroLive && Number(o.live_id) !== Number(filtroLive)) return false
    if (filtroCliente && Number(o.customer_id) !== Number(filtroCliente))
      return false
    if (filtroCasillero && Number(o.locker_id) !== Number(filtroCasillero))
      return false
    if (filtroFechaDesde || filtroFechaHasta) {
      const fechaOrden = o.created_date
        ? new Date(o.created_date).toISOString().slice(0, 10)
        : ''
      if (!fechaOrden) return false
      if (filtroFechaDesde && fechaOrden < filtroFechaDesde) return false
      if (filtroFechaHasta && fechaOrden > filtroFechaHasta) return false
    }
    return true
  })

  const hayFiltros =
    filtroId ||
    filtroLive ||
    filtroCliente ||
    filtroCasillero ||
    filtroFechaDesde ||
    filtroFechaHasta

  const limpiarFiltros = () => {
    setFiltroId('')
    setFiltroLive('')
    setFiltroCliente('')
    setFiltroCasillero('')
    setFiltroFechaDesde('')
    setFiltroFechaHasta('')
  }

  const ordenesDeEstado = (statusId) =>
    registrosFiltrados.filter((o) => Number(o.status_id) === Number(statusId))

  // Órdenes sin estado o con estado que no es de tipo Orden
  const idsValidos = statuses.map((s) => Number(s.id))
  const sinColumna = registrosFiltrados.filter(
    (o) => !idsValidos.includes(Number(o.status_id))
  )

  return (
    <div className="page">
      <div className="page-header">
        <h1>Órdenes</h1>
        <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
          + Nueva orden
        </button>
      </div>

      <div className="filters-bar">
        <div className="filter-field">
          <label htmlFor="f-id">ID de orden</label>
          <input
            id="f-id"
            type="number"
            min="1"
            value={filtroId}
            placeholder="Ej. 25"
            onChange={(e) => setFiltroId(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="f-live">Live</label>
          <SearchableSelect
            id="f-live"
            value={filtroLive}
            onChange={(v) => setFiltroLive(v)}
            placeholder="Todos"
            options={[
              { value: '', label: 'Todos' },
              ...allLives.map((lv) => ({ value: lv.id, label: lv.name })),
            ]}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="f-cliente">Cliente</label>
          <SearchableSelect
            id="f-cliente"
            value={filtroCliente}
            onChange={(v) => setFiltroCliente(v)}
            placeholder="Todos"
            options={[
              { value: '', label: 'Todos' },
              ...customers.map((c) => ({
                value: c.id,
                label: `#${c.id} - ${c.name}`,
              })),
            ]}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="f-casillero">Casillero</label>
          <SearchableSelect
            id="f-casillero"
            value={filtroCasillero}
            onChange={(v) => setFiltroCasillero(v)}
            placeholder="Todos"
            options={[
              { value: '', label: 'Todos' },
              ...allLockers.map((l) => ({
                value: l.id,
                label: `#${l.id}${l.customer_name ? ` - ${l.customer_name}` : ''}`,
              })),
            ]}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="f-fecha-desde">Fecha desde</label>
          <input
            id="f-fecha-desde"
            type="date"
            value={filtroFechaDesde}
            max={filtroFechaHasta || undefined}
            onChange={(e) => setFiltroFechaDesde(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="f-fecha-hasta">Fecha hasta</label>
          <input
            id="f-fecha-hasta"
            type="date"
            value={filtroFechaHasta}
            min={filtroFechaDesde || undefined}
            onChange={(e) => setFiltroFechaHasta(e.target.value)}
          />
        </div>

        {hayFiltros && (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={limpiarFiltros}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {error && !formOpen && !porEliminar && (
        <div className="alert-error">{error}</div>
      )}

      {cargando ? (
        <p className="table-empty">Cargando...</p>
      ) : statuses.length === 0 ? (
        <p className="table-empty">
          No hay estados de tipo Orden. Crea algunos en Mantenimientos →
          Estados (Aplica a: Orden) para ver las columnas del tablero.
        </p>
      ) : (
        <div className="board">
          {statuses.map((estado) => {
            const items = ordenesDeEstado(estado.id)
            return (
              <div
                key={estado.id}
                className={`board-column ${
                  overStatus === estado.id ? 'drag-over' : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOverStatus(estado.id)
                }}
                onDragLeave={() => setOverStatus(null)}
                onDrop={() => onDrop(estado.id)}
              >
                <div className="board-column-head">
                  <span>{estado.name}</span>
                  <span className="board-count">{items.length}</span>
                </div>

                <div className="board-column-body">
                  {items.map((orden) => (
                    <div
                      key={orden.id}
                      className="board-card"
                      draggable
                      onDragStart={() => onDragStart(orden.id)}
                      onDragEnd={onDragEnd}
                    >
                      <div className="board-card-title">
                        {orden.customer_name
                          ? `#${orden.customer_id} - ${orden.customer_name}`
                          : 'Sin cliente'}
                      </div>
                      <div className="board-card-meta">
                        <span>#{orden.id}</span>
                        <span>{formatTotal(orden.total)}</span>
                      </div>
                      {orden.live_name && (
                        <div className="board-card-meta">
                          <span>Live: {orden.live_name}</span>
                        </div>
                      )}
                      {orden.locker_id && (
                        <div className="board-card-meta">
                          <span>Casillero: #{orden.locker_id}</span>
                        </div>
                      )}
                      <select
                        className="board-move-select"
                        value=""
                        onChange={(e) => moverA(orden, e.target.value)}
                        title="Mover a otro estado"
                      >
                        <option value="">Mover a...</option>
                        {statuses
                          .filter(
                            (s) => Number(s.id) !== Number(orden.status_id)
                          )
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                      <div className="board-card-actions">
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => abrirProductos(orden)}
                        >
                          Productos
                        </button>
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => abrirEditar(orden)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => setOrdenCotizar(orden)}
                        >
                          Cotizar
                        </button>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="board-empty">Sin órdenes</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {sinColumna.length > 0 && (
        <div className="board-unassigned">
          <h3>Sin estado de orden asignado</h3>
          <div className="board-unassigned-list">
            {sinColumna.map((orden) => (
              <div
                key={orden.id}
                className="board-card"
                draggable
                onDragStart={() => onDragStart(orden.id)}
                onDragEnd={onDragEnd}
              >
                <div className="board-card-title">
                  {orden.customer_name
                    ? `#${orden.customer_id} - ${orden.customer_name}`
                    : 'Sin cliente'}
                </div>
                <div className="board-card-meta">
                  <span>#{orden.id}</span>
                  <span>{formatTotal(orden.total)}</span>
                </div>
                <div className="board-card-actions">
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => abrirEditar(orden)}
                  >
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal crear / editar */}
      <OrdenFormModal
        open={formOpen}
        orden={ordenEditar}
        customers={customers}
        lives={lives}
        statuses={statuses}
        onClose={cerrarForm}
        onSaved={alGuardar}
      />

      {/* Modal eliminar */}
      <Modal
        open={!!porEliminar}
        title="Eliminar orden"
        onClose={() => !eliminando && setPorEliminar(null)}
      >
        {error && <div className="alert-error">{error}</div>}
        <p>
          ¿Seguro que deseas eliminar la orden{' '}
          <strong>#{porEliminar?.id}</strong> de{' '}
          <strong>{porEliminar?.customer_name}</strong>? Esta acción no se
          puede deshacer.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setPorEliminar(null)}
            disabled={eliminando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={confirmarEliminar}
            disabled={eliminando}
          >
            {eliminando ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </Modal>

      {/* Modal de productos de la orden */}
      <Modal
        open={!!ordenProductos}
        title={`Productos de la orden #${ordenProductos?.id ?? ''}`}
        onClose={cerrarProductos}
        size="wide"
      >
        {error && <div className="alert-error">{error}</div>}

        {/* Agregar producto */}
        <div className="form-field">
          <label htmlFor="prod-agregar">Agregar producto (disponibles)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <SearchableSelect
                id="prod-agregar"
                value={prodParaAgregar}
                onChange={(v) => setProdParaAgregar(v)}
                placeholder={
                  disponibles.length === 0
                    ? 'No hay productos disponibles'
                    : 'Seleccione un producto...'
                }
                options={disponibles.map((p) => ({
                  value: p.id,
                  label: `#${p.id} - ${nombreProducto(p)} — ${formatTotal(
                    (Number(p.price) || 0) - (Number(p.discount) || 0)
                  )}`,
                }))}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={agregarProducto}
              disabled={!prodParaAgregar}
            >
              Agregar
            </button>
          </div>
        </div>

        {/* Lista de productos en la orden */}
        <div className="table-card table-scroll" style={{ marginTop: 8 }}>
          {cargandoProductos ? (
            <p className="table-empty">Cargando...</p>
          ) : productos.length === 0 ? (
            <p className="table-empty">Esta orden no tiene productos.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Producto</th>
                  <th>Precio</th>
                  <th>Desc.</th>
                  <th>Subtotal</th>
                  <th className="col-acciones">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr key={p.detail_id}>
                    <td>#{p.product_id}</td>
                    <td>{nombreProducto(p)}</td>
                    <td>{formatTotal(p.amount)}</td>
                    <td>{formatTotal(p.discount)}</td>
                    <td>
                      {formatTotal(
                        (Number(p.amount) || 0) - (Number(p.discount) || 0)
                      )}
                    </td>
                    <td className="col-acciones">
                      <button
                        type="button"
                        className="btn btn-small btn-danger"
                        onClick={() => quitarProducto(p.detail_id)}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={cerrarProductos}
          >
            Cerrar
          </button>
        </div>
      </Modal>

      {/* Modal de cotización */}
      <CotizacionModal
        orden={ordenCotizar}
        onClose={() => setOrdenCotizar(null)}
        onUpdated={cargar}
      />
    </div>
  )
}

export default Ordenes
