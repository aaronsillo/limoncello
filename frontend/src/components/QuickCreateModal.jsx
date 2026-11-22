import { useState, useEffect } from 'react'
import Modal from './Modal'

/**
 * Modal para crear rápidamente un registro de catálogo (name + description).
 * Pensado para Marcas, Prendas y Tipos desde el formulario de Productos.
 *
 * @param {boolean}  open      Si el modal está abierto
 * @param {string}   titulo    Título del modal (ej. "Nueva marca")
 * @param {object}   api       Recurso creado con createResource (usa .create)
 * @param {function} onClose   Se llama al cerrar sin guardar
 * @param {function} onCreated Se llama con el id creado tras guardar
 */
function QuickCreateModal({ open, titulo, api, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  // Limpiar los campos cada vez que se abre
  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setError(null)
    }
  }, [open])

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const creado = await api.create({ name, description, active: true })
      onCreated(creado)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open={open}
      title={titulo}
      onClose={() => !guardando && onClose()}
    >
      <form onSubmit={guardar}>
        {error && <div className="alert-error">{error}</div>}

        <div className="form-field">
          <label htmlFor="quick-name">Nombre</label>
          <input
            id="quick-name"
            type="text"
            value={name}
            required
            maxLength={100}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="quick-description">Descripción (opcional)</label>
          <textarea
            id="quick-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Crear'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default QuickCreateModal
