import { useEffect, useState } from 'react'
import { createResource } from '../api/api'
import { useAuth } from '../auth/AuthContext'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { usePagination } from '../components/usePagination'
import { useSortable } from '../components/useSortable'
import SortableTh from '../components/SortableTh'

const usersApi = createResource('users')

const MIN_PASSWORD = 8

const formVacio = { name: '', email: '', password: '' }

function Usuarios() {
  const { user: yo } = useAuth()
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  // Filtros
  const [filtroNombre, setFiltroNombre] = useState('')
  const [filtroCorreo, setFiltroCorreo] = useState('')

  const registrosFiltrados = registros.filter((u) => {
    const incluye = (valor, filtro) =>
      (valor || '').toLowerCase().includes(filtro.trim().toLowerCase())
    if (filtroNombre && !incluye(u.name, filtroNombre)) return false
    if (filtroCorreo && !incluye(u.email, filtroCorreo)) return false
    return true
  })

  const hayFiltros = filtroNombre || filtroCorreo

  const limpiarFiltros = () => {
    setFiltroNombre('')
    setFiltroCorreo('')
  }

  const { ordenados, orden, ordenarPor } = useSortable(registrosFiltrados)
  const paginacion = usePagination(ordenados)

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
      setRegistros(await usersApi.list())
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
    // La contraseña queda vacía: solo se cambia si se escribe una nueva
    setForm({
      name: registro.name ?? '',
      email: registro.email ?? '',
      password: '',
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
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      }
      if (editId != null) {
        await usersApi.update(editId, payload)
      } else {
        await usersApi.create(payload)
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
      await usersApi.remove(porEliminar.id)
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
        <h1>Usuarios</h1>
        <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
          + Nuevo usuario
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
          <label htmlFor="f-correo">Correo</label>
          <input
            id="f-correo"
            type="text"
            value={filtroCorreo}
            placeholder="Buscar por correo"
            onChange={(e) => setFiltroCorreo(e.target.value)}
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
              ? 'No hay usuarios que coincidan con los filtros.'
              : 'No hay usuarios todavía.'}
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="ID" campo="id" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Nombre" campo="name" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Correo" campo="email" orden={orden} onSort={ordenarPor} />
                <SortableTh label="Creado" campo="created_date" orden={orden} onSort={ordenarPor} />
                <th className="col-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginacion.pageItems.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>
                    {u.name}
                    {String(u.id) === String(yo?.id) ? ' (tú)' : ''}
                  </td>
                  <td>{u.email}</td>
                  <td>{formatFecha(u.created_date)}</td>
                  <td className="col-acciones">
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => abrirEditar(u)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => setPorEliminar(u)}
                      disabled={String(u.id) === String(yo?.id)}
                      title={
                        String(u.id) === String(yo?.id)
                          ? 'No puedes eliminar tu propio usuario'
                          : undefined
                      }
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
        title={editId != null ? 'Editar usuario' : 'Nuevo usuario'}
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
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              value={form.email}
              required
              maxLength={150}
              autoComplete="off"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">
              {editId != null ? 'Nueva contraseña (opcional)' : 'Contraseña'}
            </label>
            <input
              id="password"
              type="password"
              value={form.password}
              required={editId == null}
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              placeholder={
                editId != null
                  ? 'Déjala vacía para no cambiarla'
                  : `Mínimo ${MIN_PASSWORD} caracteres`
              }
              onChange={(e) => setForm({ ...form, password: e.target.value })}
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
        title="Eliminar usuario"
        onClose={() => !eliminando && setPorEliminar(null)}
      >
        {error && <div className="alert-error">{error}</div>}
        <p>
          ¿Seguro que deseas eliminar al usuario{' '}
          <strong>{porEliminar?.email}</strong>? Ya no podrá iniciar sesión.
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

export default Usuarios
