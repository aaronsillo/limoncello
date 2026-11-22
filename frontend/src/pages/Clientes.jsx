import { useEffect, useState } from 'react'
import { createResource } from '../api/api'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { usePagination } from '../components/usePagination'
import { useSortable } from '../components/useSortable'
import SortableTh from '../components/SortableTh'

const customersApi = createResource('customers')

const formVacio = {
  name: '',
  phone: '',
  phone_secondary: '',
  username: '',
  address: '',
  active: true,
  vip: false,
}

function Clientes() {
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

  // Filtros de búsqueda
  const [filtroId, setFiltroId] = useState('')
  const [filtroNombre, setFiltroNombre] = useState('')
  const [filtroTelefono, setFiltroTelefono] = useState('')

  const registrosFiltrados = registros.filter((c) => {
    if (filtroId && String(c.id) !== filtroId.trim()) return false
    if (
      filtroNombre &&
      !(c.name || '').toLowerCase().includes(filtroNombre.trim().toLowerCase())
    )
      return false
    if (
      filtroTelefono &&
      !(c.phone || '').toLowerCase().includes(filtroTelefono.trim().toLowerCase())
    )
      return false
    return true
  })

  const hayFiltros = filtroId || filtroNombre || filtroTelefono

  const limpiarFiltros = () => {
    setFiltroId('')
    setFiltroNombre('')
    setFiltroTelefono('')
  }

  // Paginación (sobre la lista ya filtrada)
  const { ordenados, orden, ordenarPor } = useSortable(registrosFiltrados)
  const paginacion = usePagination(ordenados)

  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      setRegistros(await customersApi.list())
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
      phone: registro.phone ?? '',
      phone_secondary: registro.phone_secondary ?? '',
      username: registro.username ?? '',
      address: registro.address ?? '',
      active: true,
      vip: registro.vip ?? false,
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
      if (editId != null) {
        await customersApi.update(editId, form)
      } else {
        await customersApi.create(form)
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
      await customersApi.remove(porEliminar.id)
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
        <h1>Clientes</h1>
        <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
          + Nuevo cliente
        </button>
      </div>

      <div className="filters-bar">
        <div className="filter-field">
          <label htmlFor="f-id">ID</label>
          <input
            id="f-id"
            type="number"
            value={filtroId}
            placeholder="ID"
            onChange={(e) => setFiltroId(e.target.value)}
          />
        </div>

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
          <label htmlFor="f-telefono">Teléfono</label>
          <input
            id="f-telefono"
            type="text"
            value={filtroTelefono}
            placeholder="Buscar por teléfono"
            onChange={(e) => setFiltroTelefono(e.target.value)}
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
              ? 'No hay clientes que coincidan con la búsqueda.'
              : 'No hay clientes todavía.'}
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="ID" campo="id" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Nombre" campo="name" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Teléfono" campo="phone" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Teléfono secundario" campo="phone_secondary" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Usuario" campo="username" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Dirección" campo="address" orden={orden} onSort={ordenarPor} />
                <SortableTh label="VIP" campo="vip" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Creado" campo="created_date" orden={orden} onSort={ordenarPor} />
                <th className="col-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginacion.pageItems.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.name}</td>
                  <td>{c.phone}</td>
                  <td>{c.phone_secondary}</td>
                  <td>{c.username}</td>
                  <td>{c.address}</td>
                  <td>{c.vip ? 'Sí' : 'No'}</td>
                  <td>{formatFecha(c.created_date)}</td>
                  <td className="col-acciones">
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => abrirEditar(c)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => setPorEliminar(c)}
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
        title={editId != null ? 'Editar cliente' : 'Nuevo cliente'}
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
            <label htmlFor="phone">Teléfono</label>
            <input
              id="phone"
              type="text"
              value={form.phone}
              maxLength={30}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="phone_secondary">Teléfono secundario</label>
            <input
              id="phone_secondary"
              type="text"
              value={form.phone_secondary}
              maxLength={30}
              onChange={(e) =>
                setForm({ ...form, phone_secondary: e.target.value })
              }
            />
          </div>

          <div className="form-field">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              value={form.username}
              maxLength={100}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="address">Dirección</label>
            <textarea
              id="address"
              rows={2}
              value={form.address}
              required
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div className="form-field form-field-inline">
            <input
              id="vip"
              type="checkbox"
              checked={form.vip}
              onChange={(e) => setForm({ ...form, vip: e.target.checked })}
            />
            <label htmlFor="vip">Cliente VIP</label>
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
        title="Eliminar cliente"
        onClose={() => !eliminando && setPorEliminar(null)}
      >
        {error && <div className="alert-error">{error}</div>}
        <p>
          ¿Seguro que deseas eliminar al cliente{' '}
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

export default Clientes
