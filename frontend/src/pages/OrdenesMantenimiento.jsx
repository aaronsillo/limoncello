import { useEffect, useState } from 'react'
import { createResource } from '../api/api'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import SearchableSelect from '../components/SearchableSelect'
import OrdenFormModal from '../components/OrdenFormModal'
import CotizacionModal from '../components/CotizacionModal'
import { ordenarEstadosOrden } from '../utils/ordenEstados'
import { usePagination } from '../components/usePagination'
import { useSortable } from '../components/useSortable'
import SortableTh from '../components/SortableTh'

const ordersApi = createResource('orders')
const customersApi = createResource('customers')
const statusApi = createResource('status')
const livesApi = createResource('lives')
const lockersApi = createResource('lockers')

// En la tabla status, type === 2 corresponde a los estados de Orden
const STATUS_TYPE_ORDEN = 2

// Solo se pueden asignar a órdenes los lives con este estado (status_id)
const LIVE_STATUS_SELECCIONABLE = 14

function OrdenesMantenimiento() {
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

  // Modal crear / editar (ordenEditar null = nueva orden)
  const [formOpen, setFormOpen] = useState(false)
  const [ordenEditar, setOrdenEditar] = useState(null)

  // Modal de cotización (el mismo que usa el tablero de Órdenes)
  const [ordenCotizar, setOrdenCotizar] = useState(null)

  // Modal de detalles (productos de la orden, solo lectura)
  const [ordenDetalle, setOrdenDetalle] = useState(null)
  const [productosDetalle, setProductosDetalle] = useState([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState(null)

  // Modal eliminar
  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

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
      setAllLives(lv)
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

  const abrirDetalle = async (orden) => {
    setOrdenDetalle(orden)
    setProductosDetalle([])
    setErrorDetalle(null)
    setCargandoDetalle(true)
    try {
      const res = await fetch(`/api/orders/${orden.id}/products`)
      if (!res.ok) throw new Error('No se pudieron cargar los productos')
      setProductosDetalle(await res.json())
    } catch (err) {
      setErrorDetalle(err.message)
    } finally {
      setCargandoDetalle(false)
    }
  }

  const nombreProducto = (p) =>
    [p.clothe_name, p.brand_name, p.size, p.color].filter(Boolean).join(' · ') ||
    `Producto #${p.product_id}`

  const subtotalProducto = (p) =>
    (Number(p.amount) || 0) - (Number(p.discount) || 0)

  const totalDetalle = productosDetalle.reduce(
    (suma, p) => suma + subtotalProducto(p),
    0
  )

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

  // Filtra (el orden lo maneja useSortable; por defecto ID descendente)
  const registrosFiltrados = registros
    .filter((o) => {
      if (filtroId && Number(o.id) !== Number(filtroId)) return false
      if (filtroLive && Number(o.live_id) !== Number(filtroLive)) return false
      if (filtroCliente && Number(o.customer_id) !== Number(filtroCliente))
        return false
      if (filtroCasillero && Number(o.locker_id) !== Number(filtroCasillero))
        return false
      return true
    })

  const hayFiltros =
    filtroId || filtroLive || filtroCliente || filtroCasillero

  const limpiarFiltros = () => {
    setFiltroId('')
    setFiltroLive('')
    setFiltroCliente('')
    setFiltroCasillero('')
  }

  const { ordenados, orden, ordenarPor } = useSortable(registrosFiltrados, { inicial: { campo: 'id', dir: 'desc' } })
  const paginacion = usePagination(ordenados)

  const formatFecha = (valor) => {
    if (!valor) return ''
    const d = new Date(valor)
    return Number.isNaN(d.getTime()) ? valor : d.toLocaleDateString()
  }

  const formatMonto = (valor) => {
    const n = Number(valor)
    return Number.isNaN(n) ? valor : n.toFixed(2)
  }

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

      <div className="table-card">
        {cargando ? (
          <p className="table-empty">Cargando...</p>
        ) : registrosFiltrados.length === 0 ? (
          <p className="table-empty">
            {hayFiltros
              ? 'No hay órdenes que coincidan con los filtros.'
              : 'No hay órdenes todavía.'}
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="ID" campo="id" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Cliente" campo="customer_name" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Live" campo="live_name" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Casillero" campo="locker_id" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Total" campo="total" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Estado" campo="status_name" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Envío pagado" campo="shipment_pay" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Creado" campo="created_date" orden={orden} onSort={ordenarPor} />
                <th className="col-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginacion.pageItems.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>
                    {o.customer_name ? `#${o.customer_id} - ${o.customer_name}` : ''}
                  </td>
                  <td>{o.live_name}</td>
                  <td>{o.locker_id ? `#${o.locker_id}` : ''}</td>
                  <td>{formatMonto(o.total)}</td>
                  <td>{o.status_name}</td>
                  <td
                    aria-label={o.shipment_pay ? 'Pagado' : 'Pendiente'}
                    title={o.shipment_pay ? 'Pagado' : 'Pendiente'}
                  >
                    {o.shipment_pay ? '✅' : '❌'}
                  </td>
                  <td>{formatFecha(o.created_date)}</td>
                  <td className="col-acciones">
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => abrirDetalle(o)}
                    >
                      Detalles
                    </button>
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => setOrdenCotizar(o)}
                    >
                      Cotizar
                    </button>
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => abrirEditar(o)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => setPorEliminar(o)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination {...paginacion} />

      <OrdenFormModal
        open={formOpen}
        orden={ordenEditar}
        customers={customers}
        lives={lives}
        statuses={statuses}
        onClose={() => setFormOpen(false)}
        onSaved={alGuardar}
      />

      {/* Modal de cotización */}
      <CotizacionModal
        orden={ordenCotizar}
        onClose={() => setOrdenCotizar(null)}
        onUpdated={cargar}
      />

      {/* Modal de detalles: productos de la orden */}
      <Modal
        open={!!ordenDetalle}
        title={`Detalles de la orden #${ordenDetalle?.id ?? ''}`}
        onClose={() => setOrdenDetalle(null)}
        size="wide"
      >
        {errorDetalle && <div className="alert-error">{errorDetalle}</div>}

        <p>
          <strong>Cliente:</strong> {ordenDetalle?.customer_name || 'Sin cliente'}
          {ordenDetalle?.status_name ? ` · ${ordenDetalle.status_name}` : ''}
        </p>

        <div className="table-card table-scroll">
          {cargandoDetalle ? (
            <p className="table-empty">Cargando...</p>
          ) : productosDetalle.length === 0 ? (
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
                </tr>
              </thead>
              <tbody>
                {productosDetalle.map((p) => (
                  <tr key={p.detail_id}>
                    <td>#{p.product_id}</td>
                    <td>{nombreProducto(p)}</td>
                    <td>{formatMonto(p.amount)}</td>
                    <td>{formatMonto(p.discount)}</td>
                    <td>{formatMonto(subtotalProducto(p))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>
                    <strong>Total de productos</strong>
                  </td>
                  <td>
                    <strong>{formatMonto(totalDetalle)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setOrdenDetalle(null)}
          >
            Cerrar
          </button>
        </div>
      </Modal>

      <Modal
        open={!!porEliminar}
        title="Eliminar orden"
        onClose={() => !eliminando && setPorEliminar(null)}
      >
        {error && <div className="alert-error">{error}</div>}
        <p>
          ¿Seguro que deseas eliminar la orden{' '}
          <strong>#{porEliminar?.id}</strong> de{' '}
          <strong>{porEliminar?.customer_name}</strong>? Sus productos vuelven
          a quedar disponibles. Esta acción no se puede deshacer.
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
    </div>
  )
}

export default OrdenesMantenimiento
