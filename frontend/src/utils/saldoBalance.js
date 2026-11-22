// Calcula el saldo acumulado de Balances, registro por registro.
// Ingreso suma y egreso resta. Los registros se ordenan por fecha y, en la
// misma fecha, por id (orden de captura).

export const TIPO_INGRESO = 1
export const TIPO_EGRESO = 2

// 'YYYY-MM-DD' de un valor de fecha (la BD puede devolver un ISO completo)
const soloFecha = (v) => (v ? String(v).slice(0, 10) : '')

/**
 * @param {Array}  balances  Registros de balances (id, name, balance_date, type, amount)
 * @param {{desde?: string, hasta?: string}} [rango]  Solo limita qué puntos se
 *        muestran. Los registros anteriores igual cuentan en el saldo inicial.
 * @returns {Array<{id, nombre, fecha, tipo, monto, antes, saldo}>}
 *          `antes` es el saldo previo al registro y `saldo` el saldo después.
 */
export function calcularSaldo(balances, rango = {}) {
  const registros = balances
    .map((b) => ({
      id: Number(b.id) || 0,
      nombre: b.name || '',
      fecha: soloFecha(b.balance_date),
      tipo: Number(b.type),
      monto: Math.abs(Number(b.amount) || 0),
    }))
    .filter(
      (b) => b.fecha && (b.tipo === TIPO_INGRESO || b.tipo === TIPO_EGRESO)
    )
    .sort((a, b) =>
      a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id
    )

  let acumulado = 0
  const puntos = registros.map((r) => {
    const antes = acumulado
    acumulado += r.tipo === TIPO_INGRESO ? r.monto : -r.monto
    return { ...r, antes, saldo: acumulado }
  })

  const { desde, hasta } = rango
  return puntos.filter(
    (p) => (!desde || p.fecha >= desde) && (!hasta || p.fecha <= hasta)
  )
}

/** Marcas "redondas" para el eje vertical que cubren [min, max]. */
export function marcasEje(min, max, cantidad = 5) {
  if (min === max) {
    min -= 1
    max += 1
  }
  const bruto = (max - min) / (cantidad - 1)
  const magnitud = 10 ** Math.floor(Math.log10(bruto))
  const paso =
    [1, 2, 2.5, 5, 10].map((f) => f * magnitud).find((p) => p >= bruto) ||
    10 * magnitud
  const inicio = Math.floor(min / paso) * paso
  const fin = Math.ceil(max / paso) * paso
  const marcas = []
  for (let v = inicio; v <= fin + paso / 2; v += paso) {
    marcas.push(Math.round(v * 1e6) / 1e6)
  }
  return marcas
}
