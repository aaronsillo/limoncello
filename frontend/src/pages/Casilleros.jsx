import { useEffect, useState } from 'react'
import { createResource } from '../api/api'
import Modal from '../components/Modal'
import SearchableSelect from '../components/SearchableSelect'
import Pagination from '../components/Pagination'
import { usePagination } from '../components/usePagination'
import { useSortable } from '../components/useSortable'
import SortableTh from '../components/SortableTh'
import CotizacionCasilleroModal from '../components/CotizacionCasilleroModal'

const lockersApi = createResource('lockers')
const customersApi = createResource('customers')
const statusApi = createResource('status')

// Tipo de status que aplica a Casilleros en tu tabla status.
// Ajusta este número al valor que uses (1=Producto, 2=Orden, 3=Detalle, 4=Live, ...).
const STATUS_TYPE_CASILLERO = 5

const formVacio = { id_customer: '', id_status: '', shipment: false }

// Color de la etiqueta de estado: Creado = amarillo, Cerrado = verde
const claseEstado = (nombre) => {
  const n = (nombre || '').trim().toLowerCase()
  if (n === 'creado') return 'status-badge-yellow'
  if (n === 'cerrado') return 'status-badge-green'
  return ''
}

function Casilleros() {
  const [registros, setRegistros] = useState([])
  const [customers, setCustomers] = useState([])
  const [statuses, setStatuses] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  // Modal de crear/editar
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(formVacio)
  const [editId, setEditId] = useState(null)
  const [guardando, setGuardando] = useState(false)

  // Modal de eliminar
  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  // Modal de órdenes del casillero
  const [ordenesCasillero, setOrdenesCasillero] = useState(null) // el casillero abierto
  const [ordenes, setOrdenes] = useState([])
  const [disponibles, setDisponibles] = useState([])
  const [ordenParaAgregar, setOrdenParaAgregar] = useState('')
  const [cargandoOrdenes, setCargandoOrdenes] = useState(false)

  // Modal de productos de una orden (dentro del casillero)
  const [ordenProductos, setOrdenProductos] = useState(null) // orden abierta
  const [productos, setProductos] = useState([])
  const [cargandoProductos, setCargandoProductos] = useState(false)

  // Modal de cotización del casillero
  const [casilleroCotizar, setCasilleroCotizar] = useState(null)

  // Filtros
  const [filtroId, setFiltroId] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroEnvio, setFiltroEnvio] = useState('') // '', 'si' o 'no'

  const registrosFiltrados = registros.filter((l) => {
    if (filtroId && Number(l.id) !== Number(filtroId)) return false
    if (filtroCliente && Number(l.id_customer) !== Number(filtroCliente))
      return false
    if (filtroEstado && Number(l.id_status) !== Number(filtroEstado))
      return false
    if (filtroEnvio === 'si' && !l.shipment) return false
    if (filtroEnvio === 'no' && l.shipment) return false
    return true
  })

  const hayFiltros = filtroId || filtroCliente || filtroEstado || filtroEnvio

  const limpiarFiltros = () => {
    setFiltroId('')
    setFiltroCliente('')
    setFiltroEstado('')
    setFiltroEnvio('')
  }

  // Paginación
  const { ordenados, orden, ordenarPor } = useSortable(registrosFiltrados)
  const paginacion = usePagination(ordenados)

  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      setRegistros(await lockersApi.list())
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  const cargarCatalogos = async () => {
    try {
      const [cu, st] = await Promise.all([
        customersApi.list(),
        statusApi.list(),
      ])
      setCustomers(cu)
      // Solo los estados que aplican a Casillero (type === 5)
      setStatuses(st.filter((s) => Number(s.type) === STATUS_TYPE_CASILLERO))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    cargar()
    cargarCatalogos()
  }, [])

  const abrirNuevo = () => {
    setForm(formVacio)
    setEditId(null)
    setError(null)
    setFormOpen(true)
  }

  const abrirEditar = (registro) => {
    setForm({
      id_customer: registro.id_customer ?? '',
      id_status: registro.id_status ?? '',
      shipment: registro.shipment ?? false,
    })
    setEditId(registro.id)
    setError(null)
    setFormOpen(true)
  }

  const cerrarForm = () => {
    if (guardando) return
    setFormOpen(false)
  }

  const prepararPayload = () => ({
    id_customer: form.id_customer ? Number(form.id_customer) : null,
    id_status: form.id_status ? Number(form.id_status) : null,
    shipment: form.shipment,
    active: true,
  })

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const payload = prepararPayload()
      if (editId != null) {
        await lockersApi.update(editId, payload)
      } else {
        await lockersApi.create(payload)
      }
      setFormOpen(false)
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const confirmarEliminar = async () => {
    if (!porEliminar) return
    setEliminando(true)
    setError(null)
    try {
      await lockersApi.remove(porEliminar.id)
      setPorEliminar(null)
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEliminando(false)
    }
  }

  const formatFecha = (valor) => {
    if (!valor) return ''
    const d = new Date(valor)
    return Number.isNaN(d.getTime()) ? valor : d.toLocaleDateString()
  }

  const formatTotal = (valor) => {
    const n = Number(valor)
    return Number.isNaN(n) ? valor : n.toFixed(2)
  }

  // ===== Órdenes del casillero =====
  const cargarOrdenesCasillero = async (lockerId) => {
    setCargandoOrdenes(true)
    setError(null)
    try {
      const [asignadas, libres] = await Promise.all([
        fetch(`/api/lockers/${lockerId}/orders`).then((r) => r.json()),
        fetch(`/api/lockers/${lockerId}/available-orders`).then((r) =>
          r.json()
        ),
      ])
      setOrdenes(asignadas)
      setDisponibles(libres)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargandoOrdenes(false)
    }
  }

  const abrirOrdenes = (casillero) => {
    setOrdenesCasillero(casillero)
    setOrdenParaAgregar('')
    setError(null)
    cargarOrdenesCasillero(casillero.id)
  }

  const cerrarOrdenes = () => {
    setOrdenesCasillero(null)
    setOrdenes([])
    setDisponibles([])
  }

  const agregarOrden = async () => {
    if (!ordenParaAgregar) return
    setError(null)
    try {
      const res = await fetch(`/api/lockers/${ordenesCasillero.id}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: Number(ordenParaAgregar) }),
      })
      if (!res.ok) throw new Error('No se pudo agregar la orden')
      setOrdenParaAgregar('')
      await cargarOrdenesCasillero(ordenesCasillero.id)
    } catch (err) {
      setError(err.message)
    }
  }

  const quitarOrden = async (orderId) => {
    setError(null)
    try {
      const res = await fetch(
        `/api/lockers/${ordenesCasillero.id}/orders/${orderId}`,
        { method: 'DELETE' }
      )
      if (!res.ok && res.status !== 204) {
        throw new Error('No se pudo quitar la orden')
      }
      await cargarOrdenesCasillero(ordenesCasillero.id)
    } catch (err) {
      setError(err.message)
    }
  }

  // ===== Productos de una orden =====
  const nombreProducto = (p) =>
    [p.clothe_name, p.brand_name, p.size, p.color].filter(Boolean).join(' · ')

  const abrirProductosOrden = async (orden) => {
    setOrdenProductos(orden)
    setCargandoProductos(true)
    setError(null)
    try {
      const data = await fetch(`/api/orders/${orden.id}/products`).then((r) =>
        r.json()
      )
      setProductos(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargandoProductos(false)
    }
  }

  const cerrarProductosOrden = () => {
    setOrdenProductos(null)
    setProductos([])
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Casilleros</h1>
        <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
          + Nuevo casillero
        </button>
      </div>

      <div className="filters-bar">
        <div className="filter-field">
          <label htmlFor="f-id">ID</label>
          <input
            id="f-id"
            type="number"
            min="1"
            value={filtroId}
            placeholder="ID"
            onChange={(e) => setFiltroId(e.target.value)}
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
          <label htmlFor="f-estado">Estado</label>
          <select
            id="f-estado"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="f-envio">Envío</label>
          <select
            id="f-envio"
            value={filtroEnvio}
            onChange={(e) => setFiltroEnvio(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
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
              ? 'No hay casilleros que coincidan con los filtros.'
              : 'No hay casilleros todavía.'}
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="ID" campo="id" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Cliente" campo="customer_name" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Estado" campo="status_name" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Envío" campo="shipment" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Creado" campo="created_date" orden={orden} onSort={ordenarPor} />
                <th className="col-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginacion.pageItems.map((l) => (
                <tr key={l.id}>
                  <td>{l.id}</td>
                  <td>{l.customer_name}</td>
                  <td>
                    {l.status_name && (
                      <span
                        className={`status-badge ${claseEstado(l.status_name)}`}
                      >
                        {l.status_name}
                      </span>
                    )}
                  </td>
                  <td>{l.shipment ? 'Sí' : 'No'}</td>
                  <td>{formatFecha(l.created_date)}</td>
                  <td className="col-acciones">
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => abrirOrdenes(l)}
                    >
                      Órdenes
                    </button>
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => setCasilleroCotizar(l)}
                    >
                      Cotizar
                    </button>
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => abrirEditar(l)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => setPorEliminar(l)}
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

      {/* Modal crear / editar */}
      <Modal
        open={formOpen}
        title={editId != null ? 'Editar casillero' : 'Nuevo casillero'}
        onClose={cerrarForm}
      >
        <form onSubmit={guardar}>
          {error && <div className="alert-error">{error}</div>}

          <div className="form-field">
            <label htmlFor="id_customer">Cliente</label>
            <SearchableSelect
              id="id_customer"
              value={form.id_customer}
              onChange={(v) => setForm({ ...form, id_customer: v })}
              options={customers.map((c) => ({
                value: c.id,
                label: `#${c.id} - ${c.name}`,
              }))}
            />
          </div>

          <div className="form-field">
            <label htmlFor="id_status">Estado</label>
            <SearchableSelect
              id="id_status"
              value={form.id_status}
              onChange={(v) => setForm({ ...form, id_status: v })}
              options={statuses.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>

          <div className="form-field form-field-inline">
            <input
              id="shipment"
              type="checkbox"
              checked={form.shipment}
              onChange={(e) =>
                setForm({ ...form, shipment: e.target.checked })
              }
            />
            <label htmlFor="shipment">Envío</label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={cerrarForm}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal eliminar */}
      <Modal
        open={!!porEliminar}
        title="Eliminar casillero"
        onClose={() => !eliminando && setPorEliminar(null)}
      >
        {error && <div className="alert-error">{error}</div>}
        <p>
          ¿Seguro que deseas eliminar el casillero{' '}
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

      {/* Modal de órdenes del casillero */}
      <Modal
        open={!!ordenesCasillero}
        title={`Órdenes del casillero #${ordenesCasillero?.id ?? ''}`}
        onClose={cerrarOrdenes}
      >
        {error && <div className="alert-error">{error}</div>}

        <p className="page-subtitle" style={{ marginBottom: 16 }}>
          Cliente: <strong>{ordenesCasillero?.customer_name}</strong>
        </p>

        {/* Agregar orden */}
        <div className="form-field">
          <label htmlFor="orden-agregar">Agregar orden</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <SearchableSelect
                id="orden-agregar"
                value={ordenParaAgregar}
                onChange={(v) => setOrdenParaAgregar(v)}
                placeholder={
                  disponibles.length === 0
                    ? 'No hay órdenes disponibles de este cliente'
                    : 'Seleccione una orden...'
                }
                options={disponibles.map((o) => ({
                  value: o.id,
                  label: `#${o.id} - ${formatTotal(o.total)}${
                    o.status_name ? ` (${o.status_name})` : ''
                  }`,
                }))}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={agregarOrden}
              disabled={!ordenParaAgregar}
            >
              Agregar
            </button>
          </div>
        </div>

        {/* Lista de órdenes asignadas */}
        <div className="table-card" style={{ marginTop: 8 }}>
          {cargandoOrdenes ? (
            <p className="table-empty">Cargando...</p>
          ) : ordenes.length === 0 ? (
            <p className="table-empty">Este casillero no tiene órdenes.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th className="col-acciones">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o) => (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td>{formatTotal(o.total)}</td>
                    <td>{o.status_name}</td>
                    <td className="col-acciones">
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => abrirProductosOrden(o)}
                      >
                        Productos
                      </button>
                      <button
                        type="button"
                        className="btn btn-small btn-danger"
                        onClick={() => quitarOrden(o.id)}
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
            onClick={cerrarOrdenes}
          >
            Cerrar
          </button>
        </div>
      </Modal>

      {/* Modal de productos de una orden */}
      <Modal
        open={!!ordenProductos}
        title={`Productos de la orden #${ordenProductos?.id ?? ''}`}
        onClose={cerrarProductosOrden}
        size="wide"
      >
        {error && <div className="alert-error">{error}</div>}

        <div className="table-card table-scroll">
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
            onClick={cerrarProductosOrden}
          >
            Cerrar
          </button>
        </div>
      </Modal>

      {/* Modal de cotización del casillero */}
      <CotizacionCasilleroModal
        casillero={casilleroCotizar}
        onClose={() => setCasilleroCotizar(null)}
      />
    </div>
  )
}

export default Casilleros
