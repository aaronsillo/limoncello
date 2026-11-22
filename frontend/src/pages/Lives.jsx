import { useEffect, useState } from 'react'
import { createResource } from '../api/api'
import Modal from '../components/Modal'
import SearchableSelect from '../components/SearchableSelect'

const livesApi = createResource('lives')
const statusApi = createResource('status')

// En la tabla status, type === 4 corresponde a los estados de Live
const STATUS_TYPE_LIVE = 4

// Redes sociales disponibles
const REDES = ['Instagram', 'Facebook', 'TikTok']

const formVacio = {
  name: '',
  live_date: '',
  social_network: '',
  start_time: '',
  end_time: '',
  status_id: '',
  active: true,
}

function Lives() {
  const [registros, setRegistros] = useState([])
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

  // Modal de órdenes del live
  const [liveOrdenes, setLiveOrdenes] = useState(null) // el live abierto
  const [ordenes, setOrdenes] = useState([])
  const [cargandoOrdenes, setCargandoOrdenes] = useState(false)

  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      setRegistros(await livesApi.list())
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  const cargarCatalogos = async () => {
    try {
      const st = await statusApi.list()
      setStatuses(st.filter((s) => Number(s.type) === STATUS_TYPE_LIVE))
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
      name: registro.name ?? '',
      live_date: registro.live_date ? registro.live_date.slice(0, 10) : '',
      social_network: registro.social_network ?? '',
      start_time: registro.start_time ? registro.start_time.slice(0, 5) : '',
      end_time: registro.end_time ? registro.end_time.slice(0, 5) : '',
      status_id: registro.status_id ?? '',
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

  const prepararPayload = () => ({
    name: form.name,
    live_date: form.live_date,
    social_network: form.social_network,
    start_time: form.start_time === '' ? null : form.start_time,
    end_time: form.end_time === '' ? null : form.end_time,
    status_id: form.status_id ? Number(form.status_id) : null,
    active: form.active,
  })

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const payload = prepararPayload()
      if (editId != null) {
        await livesApi.update(editId, payload)
      } else {
        await livesApi.create(payload)
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
      await livesApi.remove(porEliminar.id)
      setPorEliminar(null)
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEliminando(false)
    }
  }

  // ===== Órdenes del live =====
  const abrirOrdenes = async (live) => {
    setLiveOrdenes(live)
    setError(null)
    setCargandoOrdenes(true)
    try {
      const data = await fetch(`/api/lives/${live.id}/orders`).then((r) =>
        r.json()
      )
      setOrdenes(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargandoOrdenes(false)
    }
  }

  const cerrarOrdenes = () => {
    setLiveOrdenes(null)
    setOrdenes([])
  }

  const formatTotal = (valor) => {
    const n = Number(valor)
    return Number.isNaN(n) ? valor : n.toFixed(2)
  }

  const formatFecha = (valor) => {
    if (!valor) return ''
    const d = new Date(valor)
    return Number.isNaN(d.getTime()) ? valor : d.toLocaleDateString()
  }

  const formatHora = (valor) => (valor ? valor.slice(0, 5) : '')

  const rangoHoras = (live) => {
    const inicio = formatHora(live.start_time)
    const fin = formatHora(live.end_time)
    if (inicio && fin) return `${inicio} - ${fin}`
    if (inicio) return `Desde ${inicio}`
    if (fin) return `Hasta ${fin}`
    return 'Sin horario'
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Lives</h1>
        <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
          + Nuevo live
        </button>
      </div>

      {error && !formOpen && !porEliminar && (
        <div className="alert-error">{error}</div>
      )}

      {cargando ? (
        <p className="table-empty">Cargando...</p>
      ) : registros.length === 0 ? (
        <p className="table-empty">No hay lives todavía.</p>
      ) : (
        <div className="cards-grid">
          {registros.map((live) => (
            <div className="card" key={live.id}>
              <div className="card-head">
                <h3 className="card-title">{live.name}</h3>
                {!live.active && <span className="card-badge">Inactivo</span>}
              </div>

              <div className="card-body">
                <p className="card-line">
                  <span className="card-label">Red:</span>{' '}
                  {live.social_network}
                </p>
                <p className="card-line">
                  <span className="card-label">Fecha:</span>{' '}
                  {formatFecha(live.live_date)}
                </p>
                <p className="card-line">
                  <span className="card-label">Horario:</span>{' '}
                  {rangoHoras(live)}
                </p>
                {live.status_name && (
                  <p className="card-line">
                    <span className="card-label">Estado:</span>{' '}
                    {live.status_name}
                  </p>
                )}
                <p className="card-line">
                  <span className="card-label">Total:</span>{' '}
                  {formatTotal(live.total)}
                </p>
              </div>

              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => abrirOrdenes(live)}
                >
                  Órdenes
                </button>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => abrirEditar(live)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={() => setPorEliminar(live)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear / editar */}
      <Modal
        open={formOpen}
        title={editId != null ? 'Editar live' : 'Nuevo live'}
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
            <label htmlFor="social_network">Red social</label>
            <select
              id="social_network"
              value={form.social_network}
              required
              onChange={(e) =>
                setForm({ ...form, social_network: e.target.value })
              }
            >
              <option value="">Seleccione...</option>
              {REDES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="live_date">Fecha</label>
            <input
              id="live_date"
              type="date"
              value={form.live_date}
              required
              onChange={(e) => setForm({ ...form, live_date: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="start_time">Hora de inicio</label>
            <input
              id="start_time"
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="end_time">Hora de fin</label>
            <input
              id="end_time"
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="status_id">Estado</label>
            <SearchableSelect
              id="status_id"
              value={form.status_id}
              onChange={(v) => setForm({ ...form, status_id: v })}
              options={statuses.map((s) => ({ value: s.id, label: s.name }))}
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
        title="Eliminar live"
        onClose={() => !eliminando && setPorEliminar(null)}
      >
        {error && <div className="alert-error">{error}</div>}
        <p>
          ¿Seguro que deseas eliminar el live{' '}
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

      {/* Modal de órdenes del live */}
      <Modal
        open={!!liveOrdenes}
        title={`Órdenes del live "${liveOrdenes?.name ?? ''}"`}
        onClose={cerrarOrdenes}
        size="wide"
      >
        {error && <div className="alert-error">{error}</div>}

        <div className="table-card table-scroll">
          {cargandoOrdenes ? (
            <p className="table-empty">Cargando...</p>
          ) : ordenes.length === 0 ? (
            <p className="table-empty">Este live no tiene órdenes asignadas.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o) => (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td>{o.customer_name}</td>
                    <td>{formatTotal(o.total)}</td>
                    <td>{o.status_name}</td>
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
    </div>
  )
}

export default Lives
