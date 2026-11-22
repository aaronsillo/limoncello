import { useEffect, useState } from 'react'
import { createResource } from '../api/api'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { usePagination } from '../components/usePagination'
import { useSortable } from '../components/useSortable'
import SortableTh from '../components/SortableTh'
import LineaBalance from '../components/LineaBalance'

const balancesApi = createResource('balances')

// Mapeo del campo numérico "type". Ajusta si en tu BD significan otra cosa.
const TIPOS = [
  { value: 1, label: 'Ingreso' },
  { value: 2, label: 'Egreso' },
]

const etiquetaTipo = (valor) => {
  const t = TIPOS.find((x) => x.value === Number(valor))
  return t ? t.label : valor
}

const hoy = () => new Date().toISOString().slice(0, 10)

const formVacio = {
  name: '',
  description: '',
  type: '',
  amount: '',
  balance_date: hoy(),
}

function Balance() {
  const [registros, setRegistros] = useState([])
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

  // Filtros
  const [filtroNombre, setFiltroNombre] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')

  const registrosFiltrados = registros.filter((b) => {
    if (
      filtroNombre &&
      !(b.name || '').toLowerCase().includes(filtroNombre.trim().toLowerCase())
    )
      return false
    if (filtroTipo && Number(b.type) !== Number(filtroTipo)) return false
    if (filtroFechaDesde || filtroFechaHasta) {
      const fecha = b.balance_date ? String(b.balance_date).slice(0, 10) : ''
      if (!fecha) return false
      if (filtroFechaDesde && fecha < filtroFechaDesde) return false
      if (filtroFechaHasta && fecha > filtroFechaHasta) return false
    }
    return true
  })

  const hayFiltros =
    filtroNombre || filtroTipo || filtroFechaDesde || filtroFechaHasta

  const limpiarFiltros = () => {
    setFiltroNombre('')
    setFiltroTipo('')
    setFiltroFechaDesde('')
    setFiltroFechaHasta('')
  }

  // Paginación
  const { ordenados, orden, ordenarPor } = useSortable(registrosFiltrados, { valores: { type: (r) => etiquetaTipo(r.type) } })
  const paginacion = usePagination(ordenados)

  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      setRegistros(await balancesApi.list())
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const abrirNuevo = () => {
    setForm({ ...formVacio, balance_date: hoy() })
    setEditId(null)
    setError(null)
    setFormOpen(true)
  }

  const abrirEditar = (registro) => {
    setForm({
      name: registro.name ?? '',
      description: registro.description ?? '',
      type: registro.type ?? '',
      amount: registro.amount ?? '',
      balance_date: registro.balance_date
        ? registro.balance_date.slice(0, 10)
        : hoy(),
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
    name: form.name,
    description: form.description,
    type: form.type === '' ? null : Number(form.type),
    amount: form.amount === '' ? null : Number(form.amount),
    balance_date: form.balance_date,
    active: true,
  })

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const payload = prepararPayload()
      if (editId != null) {
        await balancesApi.update(editId, payload)
      } else {
        await balancesApi.create(payload)
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
      await balancesApi.remove(porEliminar.id)
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

  const formatMonto = (valor) => {
    const n = Number(valor)
    return Number.isNaN(n) ? valor : n.toFixed(2)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Balances</h1>
        <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
          + Nuevo balance
        </button>
      </div>

      <div className="filters-bar">
        <div className="filter-field">
          <label htmlFor="f-nombre">Nombre</label>
          <input
            id="f-nombre"
            type="text"
            value={filtroNombre}
            placeholder="Buscar por nombre"
            onChange={(e) => setFiltroNombre(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="f-tipo">Tipo</label>
          <select
            id="f-tipo"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          >
            <option value="">Todos</option>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
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

      {/* La gráfica usa todos los balances: respeta solo el rango de fechas */}
      {!cargando && (
        <LineaBalance
          balances={registros}
          desde={filtroFechaDesde}
          hasta={filtroFechaHasta}
        />
      )}

      <div className="table-card">
        {cargando ? (
          <p className="table-empty">Cargando...</p>
        ) : registrosFiltrados.length === 0 ? (
          <p className="table-empty">
            {hayFiltros
              ? 'No hay balances que coincidan con los filtros.'
              : 'No hay balances todavía.'}
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="ID" campo="id" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Nombre" campo="name" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Tipo" campo="type" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Monto" campo="amount" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Fecha" campo="balance_date" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Descripción" campo="description" orden={orden} onSort={ordenarPor} />
                <th className="col-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginacion.pageItems.map((b) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>{b.name}</td>
                  <td>{etiquetaTipo(b.type)}</td>
                  <td>{formatMonto(b.amount)}</td>
                  <td>{formatFecha(b.balance_date)}</td>
                  <td>{b.description}</td>
                  <td className="col-acciones">
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => abrirEditar(b)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => setPorEliminar(b)}
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
        title={editId != null ? 'Editar balance' : 'Nuevo balance'}
        onClose={cerrarForm}
      >
        <form onSubmit={guardar}>
          {error && <div className="alert-error">{error}</div>}

          <div className="form-field">
            <label htmlFor="name">Nombre</label>
            <input
              id="name"
              type="text"
              value={form.name}
              required
              maxLength={150}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="type">Tipo</label>
            <select
              id="type"
              value={form.type}
              required
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="">Seleccione...</option>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="amount">Monto</label>
            <input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              required
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="balance_date">Fecha</label>
            <input
              id="balance_date"
              type="date"
              value={form.balance_date}
              required
              onChange={(e) =>
                setForm({ ...form, balance_date: e.target.value })
              }
            />
          </div>

          <div className="form-field">
            <label htmlFor="description">Descripción</label>
            <textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
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
        title="Eliminar balance"
        onClose={() => !eliminando && setPorEliminar(null)}
      >
        {error && <div className="alert-error">{error}</div>}
        <p>
          ¿Seguro que deseas eliminar el balance{' '}
          <strong>{porEliminar?.name}</strong>? Esta acción no se puede
          deshacer.
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

export default Balance
