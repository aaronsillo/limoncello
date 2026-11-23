import { useEffect, useState } from 'react'
import { createResource } from '../api/api'
import Modal from '../components/Modal'

const tasksApi = createResource('pending-tasks')
const statusApi = createResource('status')

// En la tabla status, type === 6 corresponde a los estados de Pendientes
const STATUS_TYPE_PENDIENTES = 6

// Colores de post-it disponibles (el valor se guarda en la BD)
const COLORES = [
  { value: 'yellow', label: 'Amarillo' },
  { value: 'pink', label: 'Rosa' },
  { value: 'blue', label: 'Azul' },
  { value: 'green', label: 'Verde' },
  { value: 'orange', label: 'Naranja' },
]
const COLOR_DEFECTO = 'yellow'
const claseColor = (c) =>
  COLORES.some((x) => x.value === c) ? c : COLOR_DEFECTO

const formVacio = {
  title: '',
  description: '',
  color: COLOR_DEFECTO,
  status_id: '',
}

function Pendientes() {
  const [registros, setRegistros] = useState([])
  const [statuses, setStatuses] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  // Drag & drop
  const [dragId, setDragId] = useState(null)
  const [overStatus, setOverStatus] = useState(null)

  // Modal de crear/editar
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(formVacio)
  const [editId, setEditId] = useState(null)
  const [guardando, setGuardando] = useState(false)

  // Modal de eliminar
  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      const [tareas, estados] = await Promise.all([
        tasksApi.list(),
        statusApi.list(),
      ])
      setRegistros(tareas)
      setStatuses(
        estados
          .filter((s) => Number(s.type) === STATUS_TYPE_PENDIENTES)
          .sort((a, b) => Number(a.id) - Number(b.id))
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const abrirNuevo = (statusId) => {
    setForm({
      ...formVacio,
      status_id: statusId ?? statuses[0]?.id ?? '',
    })
    setEditId(null)
    setError(null)
    setFormOpen(true)
  }

  const abrirEditar = (registro) => {
    setForm({
      title: registro.title ?? '',
      description: registro.description ?? '',
      color: claseColor(registro.color),
      status_id: registro.status_id ?? '',
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
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        status_id: Number(form.status_id),
        color: form.color,
        active: true,
      }
      if (editId != null) {
        await tasksApi.update(editId, payload)
      } else {
        await tasksApi.create(payload)
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
      await tasksApi.remove(porEliminar.id)
      setPorEliminar(null)
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEliminando(false)
    }
  }

  // Cambia el estado de un pendiente (arrastrando o con el menú "Mover a...")
  const moverA = async (tarea, statusId) => {
    if (!tarea || Number(tarea.status_id) === Number(statusId)) return
    const previos = registros
    // Actualización optimista en la UI; si falla se revierte
    setRegistros((prev) =>
      prev.map((t) =>
        t.id === tarea.id ? { ...t, status_id: Number(statusId) } : t
      )
    )
    try {
      await tasksApi.update(tarea.id, {
        title: tarea.title,
        description: tarea.description,
        status_id: Number(statusId),
        color: claseColor(tarea.color),
        active: true,
      })
    } catch (err) {
      setRegistros(previos)
      setError(err.message)
    }
  }

  const onDrop = (statusId) => {
    const tarea = registros.find((t) => t.id === dragId)
    setOverStatus(null)
    setDragId(null)
    moverA(tarea, statusId)
  }

  const formatFecha = (valor) => {
    if (!valor) return ''
    const d = new Date(valor)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString()
  }

  const tareasDe = (statusId) =>
    registros.filter((t) => Number(t.status_id) === Number(statusId))

  // Pendientes cuyo estado no es de tipo Pendientes (no caen en ninguna columna)
  const idsValidos = statuses.map((s) => Number(s.id))
  const sinColumna = registros.filter(
    (t) => !idsValidos.includes(Number(t.status_id))
  )

  const postIt = (tarea) => (
    <div
      key={tarea.id}
      className={`postit postit-${claseColor(tarea.color)}`}
      style={{ '--giro': `${((Number(tarea.id) % 5) - 2) * 0.8}deg` }}
      draggable
      onDragStart={() => setDragId(tarea.id)}
      onDragEnd={() => {
        setDragId(null)
        setOverStatus(null)
      }}
    >
      <div className="postit-title">{tarea.title}</div>
      {tarea.description && (
        <div className="postit-text">{tarea.description}</div>
      )}
      <div className="postit-foot">
        <span>{formatFecha(tarea.created_date)}</span>
        <select
          className="postit-move"
          value=""
          onChange={(e) => moverA(tarea, e.target.value)}
          title="Mover a otro estado"
          aria-label="Mover a otro estado"
        >
          <option value="">Mover a...</option>
          {statuses
            .filter((s) => Number(s.id) !== Number(tarea.status_id))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
      </div>
      <div className="postit-actions">
        <button
          type="button"
          className="postit-btn"
          onClick={() => abrirEditar(tarea)}
        >
          Editar
        </button>
        <button
          type="button"
          className="postit-btn"
          onClick={() => setPorEliminar(tarea)}
        >
          Eliminar
        </button>
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <h1>Pendientes</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => abrirNuevo()}
          disabled={statuses.length === 0}
        >
          + Nuevo pendiente
        </button>
      </div>

      {error && !formOpen && !porEliminar && (
        <div className="alert-error">{error}</div>
      )}

      {cargando ? (
        <p className="table-empty">Cargando...</p>
      ) : statuses.length === 0 ? (
        <p className="table-empty">
          No hay estados de tipo Pendientes. Crea algunos en Mantenimientos →
          Estados (Aplica a: Pendientes) para ver las columnas del tablero.
        </p>
      ) : (
        <div className="board postit-board">
          {statuses.map((estado) => {
            const items = tareasDe(estado.id)
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
                  <div className="postit-grid">{items.map(postIt)}</div>
                  {items.length === 0 && (
                    <p className="board-empty">Sin pendientes</p>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => abrirNuevo(estado.id)}
                  >
                    + Agregar aquí
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {sinColumna.length > 0 && (
        <div className="board-unassigned">
          <h3>Sin estado de pendientes asignado</h3>
          <div className="postit-grid">{sinColumna.map(postIt)}</div>
        </div>
      )}

      {/* Modal crear / editar */}
      <Modal
        open={formOpen}
        title={editId != null ? 'Editar pendiente' : 'Nuevo pendiente'}
        onClose={cerrarForm}
      >
        <form onSubmit={guardar}>
          {error && <div className="alert-error">{error}</div>}

          <div className="form-field">
            <label htmlFor="title">Título</label>
            <input
              id="title"
              type="text"
              value={form.title}
              required
              autoFocus
              maxLength={150}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="description">Descripción</label>
            <textarea
              id="description"
              rows={4}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>

          <div className="form-field">
            <label htmlFor="status_id">Estado</label>
            <select
              id="status_id"
              value={form.status_id}
              required
              onChange={(e) => setForm({ ...form, status_id: e.target.value })}
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <span id="color-label">Color</span>
            <div
              className="postit-colors"
              role="radiogroup"
              aria-labelledby="color-label"
            >
              {COLORES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={form.color === c.value}
                  aria-label={c.label}
                  title={c.label}
                  className={`postit-swatch postit-${c.value} ${
                    form.color === c.value ? 'selected' : ''
                  }`}
                  onClick={() => setForm({ ...form, color: c.value })}
                />
              ))}
            </div>
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
        title="Eliminar pendiente"
        onClose={() => !eliminando && setPorEliminar(null)}
      >
        {error && <div className="alert-error">{error}</div>}
        <p>
          ¿Seguro que deseas eliminar el pendiente{' '}
          <strong>{porEliminar?.title}</strong>?
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

export default Pendientes
