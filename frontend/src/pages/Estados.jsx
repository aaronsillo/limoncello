import { useEffect, useState } from 'react'
import { createResource } from '../api/api'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { usePagination } from '../components/usePagination'
import { useSortable } from '../components/useSortable'
import SortableTh from '../components/SortableTh'

const statusApi = createResource('status')

// Mapeo del campo numérico "type" a etiquetas legibles.
// Ajusta estos valores si en tu BD los números significan otra cosa.
const TIPOS = [
  { value: 1, label: 'Producto' },
  { value: 2, label: 'Orden' },
  { value: 3, label: 'Detalle de orden' },
  { value: 4, label: 'Live' },
  { value: 5, label: 'Casillero' },
]

const etiquetaTipo = (valor) => {
  const found = TIPOS.find((t) => t.value === Number(valor))
  return found ? found.label : valor
}

const formVacio = { name: '', type: '', active: true }

function Estados() {
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

  const registrosFiltrados = registros.filter((s) => {
    if (
      filtroNombre &&
      !(s.name || '').toLowerCase().includes(filtroNombre.trim().toLowerCase())
    )
      return false
    if (filtroTipo && Number(s.type) !== Number(filtroTipo)) return false
    return true
  })

  const hayFiltros = filtroNombre || filtroTipo

  const limpiarFiltros = () => {
    setFiltroNombre('')
    setFiltroTipo('')
  }

  // Paginación
  const { ordenados, orden, ordenarPor } = useSortable(registrosFiltrados, { valores: { type: (r) => etiquetaTipo(r.type) } })
  const paginacion = usePagination(ordenados)

  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      setRegistros(await statusApi.list())
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
    setForm(formVacio)
    setEditId(null)
    setError(null)
    setFormOpen(true)
  }

  const abrirEditar = (registro) => {
    setForm({
      name: registro.name ?? '',
      type: registro.type ?? '',
      active: true,
    })
    setEditId(registro.id)
    setError(null)
    setFormOpen(true)
  }

  const cerrarForm = () => {
    if (guardando) return
    setFormOpen(false)
  }

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      // type debe viajar como número
      const payload = { ...form, type: Number(form.type) }
      if (editId != null) {
        await statusApi.update(editId, payload)
      } else {
        await statusApi.create(payload)
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
      await statusApi.remove(porEliminar.id)
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

  return (
    <div className="page">
      <div className="page-header">
        <h1>Estados</h1>
        <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
          + Nuevo estado
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
          <label htmlFor="f-tipo">Aplica a</label>
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
              ? 'No hay estados que coincidan con los filtros.'
              : 'No hay estados todavía.'}
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="ID" campo="id" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Nombre" campo="name" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Aplica a" campo="type" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Creado" campo="created_date" orden={orden} onSort={ordenarPor} />
                <th className="col-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginacion.pageItems.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.name}</td>
                  <td>{etiquetaTipo(s.type)}</td>
                  <td>{formatFecha(s.created_date)}</td>
                  <td className="col-acciones">
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => abrirEditar(s)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => setPorEliminar(s)}
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
        title={editId != null ? 'Editar estado' : 'Nuevo estado'}
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
              maxLength={100}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="type">Aplica a</label>
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
        title="Eliminar estado"
        onClose={() => !eliminando && setPorEliminar(null)}
      >
        {error && <div className="alert-error">{error}</div>}
        <p>
          ¿Seguro que deseas eliminar el estado{' '}
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

export default Estados
