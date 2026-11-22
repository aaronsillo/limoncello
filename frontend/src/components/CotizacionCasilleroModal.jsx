import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import Modal from './Modal'
import logo from '../assets/images/limon.png'

/**
 * Cotización de un casillero: incluye los productos de TODAS sus órdenes.
 *
 * @param {object|null} casillero  El casillero abierto o null
 * @param {function}    onClose    cerrar el modal
 */
function CotizacionCasilleroModal({ casillero, onClose }) {
  const ref = useRef(null)
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!casillero) return
    setCargando(true)
    setError(null)
    fetch(`/api/lockers/${casillero.id}/quote`)
      .then((r) => r.json())
      .then((data) => setItems(data))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [casillero])

  const nombreProducto = (p) =>
    [p.clothe_name, p.brand_name, p.size, p.color].filter(Boolean).join(' · ') ||
    `Producto #${p.product_id}`

  const subtotal = (p) => (Number(p.amount) || 0) - (Number(p.discount) || 0)

  const ORDER_STATUS_PAGADO = 3
  const estaPagado = (p) => Number(p.order_status_id) === ORDER_STATUS_PAGADO

  const total = items.reduce((s, p) => s + subtotal(p), 0)
  const totalPagado = items
    .filter(estaPagado)
    .reduce((s, p) => s + subtotal(p), 0)
  const totalPendiente = total - totalPagado

  const money = (n) => `Q.${(Number(n) || 0).toFixed(2)}`

  const fechaHoy = new Date().toLocaleDateString()

  const descargar = async () => {
    if (!ref.current) return
    setDescargando(true)
    setError(null)
    try {
      const dataUrl = await toPng(ref.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      const a = document.createElement('a')
      a.download = `cotizacion-casillero-${casillero.id}.png`
      a.href = dataUrl
      a.click()
    } catch (err) {
      setError('No se pudo generar la imagen: ' + err.message)
    } finally {
      setDescargando(false)
    }
  }

  return (
    <Modal
      open={!!casillero}
      title={`Cotización del casillero #${casillero?.id ?? ''}`}
      onClose={onClose}
      size="wide"
    >
      {error && <div className="alert-error">{error}</div>}

      {cargando ? (
        <p className="table-empty">Cargando...</p>
      ) : (
        <>
          <div className="cotizacion" ref={ref}>
            <div className="cotizacion-header">
              <div className="cotizacion-brand">
                <img src={logo} alt="Limoncello" className="cotizacion-img" />
                <span className="cotizacion-logo">LIMONCELLO</span>
              </div>
              <div className="cotizacion-meta">
                <div>Casillero #{casillero?.id}</div>
                <div>{fechaHoy}</div>
              </div>
            </div>

            <div className="cotizacion-cliente">
              <strong>Cliente:</strong> {casillero?.customer_name || 'Sin cliente'}
            </div>

            <table className="cotizacion-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Producto</th>
                  <th className="num">Precio</th>
                  <th className="num">Desc.</th>
                  <th className="num">Subtotal</th>
                  <th className="num">Pagado</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="cotizacion-empty">
                      Sin productos
                    </td>
                  </tr>
                ) : (
                  items.map((p) => (
                    <tr key={p.detail_id}>
                      <td>#{p.order_id}</td>
                      <td>{nombreProducto(p)}</td>
                      <td className="num">{money(p.amount)}</td>
                      <td className="num">{money(p.discount)}</td>
                      <td className="num">{money(subtotal(p))}</td>
                      <td className="num">{estaPagado(p) ? '✓' : '✗'}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="cotizacion-total">
                  <td colSpan={4}>Total</td>
                  <td className="num">{money(total)}</td>
                  <td className="num"></td>
                </tr>
                <tr className="cotizacion-subtotal-foot">
                  <td colSpan={4}>Pagado</td>
                  <td className="num">{money(totalPagado)}</td>
                  <td className="num"></td>
                </tr>
                <tr className="cotizacion-subtotal-foot">
                  <td colSpan={4}>Pendiente</td>
                  <td className="num">{money(totalPendiente)}</td>
                  <td className="num"></td>
                </tr>
              </tfoot>
            </table>

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
              className="btn btn-primary"
              onClick={descargar}
              disabled={descargando}
            >
              {descargando ? 'Generando...' : 'Descargar imagen'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

export default CotizacionCasilleroModal
