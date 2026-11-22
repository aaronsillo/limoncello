import { useEffect, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import Modal from './Modal'
import SearchableSelect from './SearchableSelect'
import { createResource } from '../api/api'
import logo from '../assets/images/limon.png'
import { abrirWhatsapp, normalizarTelefono } from '../utils/whatsapp'

const ordersApi = createResource('orders')
const shipmentsApi = createResource('shipments')
const bankAccountsApi = createResource('bank-accounts')

/**
 * Modal que muestra la cotización de una orden y permite copiarla como imagen PNG
 * al portapapeles (o descargarla si el navegador no permite copiar).
 * Si la orden no tiene envío asignado, pide seleccionar uno antes de poder descargar.
 *
 * @param {object|null} orden   La orden abierta o null
 * @param {function}    onClose cerrar el modal
 * @param {function}    [onUpdated] se llama si se asigna un envío (para refrescar el board)
 */
function CotizacionModal({ orden, onClose, onUpdated }) {
  const ref = useRef(null)
  const [productos, setProductos] = useState([])
  const [envios, setEnvios] = useState([])
  const [cuentas, setCuentas] = useState([])
  // Envío elegido (id). Se inicializa con el de la orden si ya tiene.
  const [envioId, setEnvioId] = useState('')
  const [cargando, setCargando] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [copiada, setCopiada] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!orden) return
    setCargando(true)
    setError(null)
    setEnvioId(orden.shipment_id ? String(orden.shipment_id) : '')
    Promise.all([
      fetch(`/api/orders/${orden.id}/products`).then((r) => r.json()),
      shipmentsApi.list(),
      bankAccountsApi.list(),
    ])
      .then(([prods, envs, cuentasBanco]) => {
        setProductos(prods)
        setEnvios(envs)
        setCuentas(cuentasBanco)
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [orden])

  const nombreProducto = (p) =>
    [p.clothe_name, p.brand_name, p.size, p.color].filter(Boolean).join(' · ') ||
    `Producto #${p.product_id}`

  const subtotal = (p) => (Number(p.amount) || 0) - (Number(p.discount) || 0)

  const envioSel = envios.find((e) => String(e.id) === String(envioId))
  const montoEnvio = Number(envioSel?.amount) || 0

  const totalProductos = productos.reduce((s, p) => s + subtotal(p), 0)
  const total = totalProductos + montoEnvio

  const money = (n) => `Q.${(Number(n) || 0).toFixed(2)}`

  const fechaHoy = new Date().toLocaleDateString()

  // La orden ya tiene envío guardado
  const envioGuardado = !!orden?.shipment_id

  const descargar = async () => {
    if (!ref.current) return
    setDescargando(true)
    setError(null)
    try {
      // Si se eligió un envío y aún no está guardado en la orden, lo persistimos
      if (envioId && String(orden.shipment_id) !== String(envioId)) {
        await ordersApi.patch(orden.id, 'shipment', {
          shipment_id: Number(envioId),
        })
        if (onUpdated) onUpdated()
      }

      const blob = await toBlob(ref.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      if (!blob) throw new Error('la imagen salió vacía')

      // Copia al portapapeles. Solo funciona en HTTPS o localhost.
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ])
        setCopiada(true)
        setTimeout(() => setCopiada(false), 3000)
      } else {
        // Respaldo: si el navegador no permite copiar, se descarga el PNG
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.download = `cotizacion-orden-${orden.id}.png`
        a.href = url
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      setError('No se pudo copiar la imagen: ' + err.message)
    } finally {
      setDescargando(false)
    }
  }

  const tieneTelefono = !!normalizarTelefono(orden?.customer_phone)

  const enviarWhatsapp = () => {
    if (!abrirWhatsapp(orden)) {
      setError('El cliente no tiene teléfono registrado.')
    }
  }

  return (
    <Modal
      open={!!orden}
      title={`Cotización de la orden #${orden?.id ?? ''}`}
      onClose={onClose}
      size="wide"
    >
      {error && <div className="alert-error">{error}</div>}

      {cargando ? (
        <p className="table-empty">Cargando...</p>
      ) : (
        <>
          {/* Selector de envío: solo si la orden aún no tiene uno guardado */}
          {!envioGuardado && (
            <div className="form-field">
              <label htmlFor="cot-envio">Envío</label>
              <SearchableSelect
                id="cot-envio"
                value={envioId}
                onChange={(v) => setEnvioId(v)}
                placeholder="Seleccione un envío..."
                options={envios.map((e) => ({
                  value: e.id,
                  label: `${e.name} — ${money(e.amount)}`,
                }))}
              />
            </div>
          )}

          {/* Plantilla que se convierte en imagen */}
          <div className="cotizacion" ref={ref}>
            <div className="cotizacion-header">
              <div className="cotizacion-brand">
                <img src={logo} alt="Limoncello" className="cotizacion-img" />
                <span className="cotizacion-logo">LIMONCELLO</span>
              </div>
              <div className="cotizacion-meta">
                <div>Cotización #{orden?.id}</div>
                <div>{fechaHoy}</div>
              </div>
            </div>

            <div className="cotizacion-cliente">
              <div>
                <strong>Cliente:</strong>{' '}
                {orden?.customer_name || 'Sin cliente'}
              </div>
              {orden?.customer_address && (
                <div>
                  <strong>Dirección:</strong> {orden.customer_address}
                </div>
              )}
            </div>

            <table className="cotizacion-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Precio</th>
                  <th className="num">Desc.</th>
                  <th className="num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {productos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="cotizacion-empty">
                      Sin productos
                    </td>
                  </tr>
                ) : (
                  productos.map((p) => (
                    <tr key={p.detail_id}>
                      <td>{nombreProducto(p)}</td>
                      <td className="num">{money(p.amount)}</td>
                      <td className="num">{money(p.discount)}</td>
                      <td className="num">{money(subtotal(p))}</td>
                    </tr>
                  ))
                )}

                {/* Línea del envío al final */}
                {envioSel && (
                  <tr className="cotizacion-envio">
                    <td>Envío</td>
                    <td className="num"></td>
                    <td className="num"></td>
                    <td className="num">{money(montoEnvio)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="cotizacion-total">
                  <td colSpan={3}>Total</td>
                  <td className="num">{money(total)}</td>
                </tr>
              </tfoot>
            </table>

            {cuentas.length > 0 && (
              <>
                <div className="cotizacion-cuentas-titulo">
                  Cuentas para depósito o transferencia
                </div>
                <table className="cotizacion-table cotizacion-cuentas">
                  <thead>
                    <tr>
                      <th>Banco</th>
                      <th>Número</th>
                      <th>Tipo</th>
                      <th>A nombre de</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuentas.map((c) => (
                      <tr key={c.id}>
                        <td>{c.bank}</td>
                        <td>{c.number}</td>
                        <td>{c.type}</td>
                        <td>{c.name_account}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div className="cotizacion-footer">
              ¡Gracias por tu compra! · Limoncello
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cerrar
            </button>
            <button
              type="button"
              className="btn"
              onClick={enviarWhatsapp}
              disabled={!tieneTelefono}
              title={
                tieneTelefono
                  ? 'Abrir WhatsApp con el mensaje listo'
                  : 'El cliente no tiene teléfono registrado'
              }
            >
              Enviar por WhatsApp
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={descargar}
              disabled={descargando}
            >
              {descargando
                ? 'Generando...'
                : copiada
                  ? '¡Copiada!'
                  : 'Copiar imagen'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

export default CotizacionModal
