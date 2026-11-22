import { useEffect, useState } from 'react'
import { createResource } from '../api/api'
import Modal from './Modal'
import SearchableSelect from './SearchableSelect'

const ordersApi = createResource('orders')
const lockersApi = createResource('lockers')

// Estado por defecto al crear una orden: "Creado" (id 1)
const ORDER_STATUS_CREADO = 1

const formVacio = {
  customer_id: '',
  locker: 1, // columna obsoleta pero NOT NULL en la BD; se envía un valor fijo
  total: '',
  status_id: ORDER_STATUS_CREADO,
  live_id: '',
  locker_id: '',
  shipment_pay: false,
  active: true,
}

const formDesdeOrden = (orden) =>
  orden
    ? {
        customer_id: orden.customer_id ?? '',
        locker: orden.locker ?? 1,
        total: orden.total ?? '',
        status_id: orden.status_id ?? '',
        live_id: orden.live_id ?? '',
        locker_id: orden.locker_id ?? '',
        shipment_pay: orden.shipment_pay ?? false,
        active: true,
      }
    : formVacio

// Contenido del formulario. Se monta al abrir el modal, así su estado
// siempre arranca desde la orden recibida (o vacío si es nueva).
function OrdenForm({ orden, customers, lives, statuses, onClose, onSaved }) {
  const [form, setForm] = useState(() => formDesdeOrden(orden))
  const [lockersCliente, setLockersCliente] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  // Carga los casilleros activos de un cliente específico
  const cargarCasillerosDe = async (customerId) => {
    if (!customerId) {
      setLockersCliente([])
      return
    }
    try {
      setLockersCliente(await lockersApi.get(`customer/${customerId}`))
    } catch (err) {
      setLockersCliente([])
      setError(err.message)
    }
  }

  // Al editar, trae los casilleros del cliente de la orden
  useEffect(() => {
    if (!orden?.customer_id) return
    lockersApi
      .get(`customer/${orden.customer_id}`)
      .then(setLockersCliente)
      .catch((err) => setError(err.message))
  }, [orden])

  const handleClienteChange = (customerId) => {
    // Al cambiar de cliente, el casillero elegido deja de ser válido
    setForm((prev) => ({ ...prev, customer_id: customerId, locker_id: '' }))
    cargarCasillerosDe(customerId)
  }

  const prepararPayload = () => ({
    customer_id: form.customer_id ? Number(form.customer_id) : null,
    locker: 1, // columna obsoleta pero NOT NULL; valor fijo
    total: form.total === '' ? 0 : Number(form.total),
    status_id: form.status_id ? Number(form.status_id) : null,
    live_id: form.live_id ? Number(form.live_id) : null,
    locker_id: form.locker_id ? Number(form.locker_id) : null,
    shipment_pay: form.shipment_pay,
    active: form.active,
  })

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const payload = prepararPayload()
      if (orden) {
        await ordersApi.update(orden.id, payload)
      } else {
        await ordersApi.create(payload)
      }
      await onSaved()
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar}>
      {error && <div className="alert-error">{error}</div>}

      <div className="form-field">
        <label htmlFor="customer_id">Cliente</label>
        <SearchableSelect
          id="customer_id"
          value={form.customer_id}
          onChange={(v) => handleClienteChange(v)}
          options={customers.map((c) => ({
            value: c.id,
            label: `#${c.id} - ${c.name}`,
          }))}
        />
      </div>

      <div className="form-field">
        <label htmlFor="live_id">Live</label>
        <SearchableSelect
          id="live_id"
          value={form.live_id}
          onChange={(v) => setForm({ ...form, live_id: v })}
          placeholder="Sin live"
          options={[
            { value: '', label: 'Sin live' },
            ...lives.map((lv) => ({ value: lv.id, label: lv.name })),
          ]}
        />
      </div>

      <div className="form-field">
        <label htmlFor="locker_id">Casillero</label>
        <SearchableSelect
          id="locker_id"
          value={form.locker_id}
          onChange={(v) => setForm({ ...form, locker_id: v })}
          placeholder={
            !form.customer_id
              ? 'Seleccione un cliente primero'
              : lockersCliente.length === 0
                ? 'Sin casilleros para este cliente'
                : 'Sin casillero'
          }
          options={[
            { value: '', label: 'Sin casillero' },
            ...lockersCliente.map((l) => ({
              value: l.id,
              label: `#${l.id}${l.status_name ? ` - ${l.status_name}` : ''}`,
            })),
          ]}
        />
      </div>

      <div className="form-field">
        <label htmlFor="total">Total</label>
        <input
          id="total"
          type="number"
          min="0"
          step="0.01"
          value={form.total}
          onChange={(e) => setForm({ ...form, total: e.target.value })}
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

      <div className="form-field form-field-inline">
        <input
          id="shipment_pay"
          type="checkbox"
          checked={!!form.shipment_pay}
          onChange={(e) => setForm({ ...form, shipment_pay: e.target.checked })}
        />
        <label htmlFor="shipment_pay">Envío pagado</label>
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
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

/**
 * Modal para crear (orden = null) o editar una orden.
 * onSaved se llama después de guardar; el padre decide cerrar y recargar.
 */
function OrdenFormModal({
  open,
  orden,
  customers,
  lives,
  statuses,
  onClose,
  onSaved,
}) {
  return (
    <Modal
      open={open}
      title={orden ? 'Editar orden' : 'Nueva orden'}
      onClose={onClose}
    >
      <OrdenForm
        orden={orden}
        customers={customers}
        lives={lives}
        statuses={statuses}
        onClose={onClose}
        onSaved={onSaved}
      />
    </Modal>
  )
}

export default OrdenFormModal
