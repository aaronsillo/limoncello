// Orden en que se muestran los estados de Orden (por id).
// Los estados que no estén en esta lista se muestran al final, por id.
export const ORDEN_ESTADOS_ORDEN = [1, 2, 3, 18, 5, 6, 8]

export function ordenarEstadosOrden(estados) {
  const posicion = (s) => {
    const i = ORDEN_ESTADOS_ORDEN.indexOf(Number(s.id))
    return i === -1 ? ORDEN_ESTADOS_ORDEN.length : i
  }
  return [...estados].sort(
    (a, b) => posicion(a) - posicion(b) || Number(a.id) - Number(b.id)
  )
}
