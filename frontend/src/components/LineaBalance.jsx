import { useMemo } from 'react'
import {
  TIPO_INGRESO,
  calcularSaldo,
  marcasEje,
} from '../utils/saldoBalance'

const ALTO = 300
const MARGEN = { arriba: 16, abajo: 30, izq: 64, der: 20 }
const PASO = 36 // separación horizontal entre registros
const ANCHO_MIN = 520

const dinero = (n) =>
  `${n < 0 ? '-' : ''}Q${Math.abs(Number(n) || 0).toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

// Abreviado para el eje vertical (sin decimales)
const dineroCorto = (n) =>
  `${n < 0 ? '-' : ''}Q${Math.abs(n).toLocaleString('es-GT', {
    maximumFractionDigits: 0,
  })}`

// 'YYYY-MM-DD' -> 'DD/MM'
const diaMes = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/**
 * Gráfica de líneas del saldo acumulado de Balances, un punto por registro.
 * Punto verde = ingreso, rojo = egreso.
 *
 * @param {Array}  balances Registros de balances
 * @param {string} [desde]  Fecha mínima a mostrar (YYYY-MM-DD)
 * @param {string} [hasta]  Fecha máxima a mostrar (YYYY-MM-DD)
 */
function LineaBalance({ balances, desde, hasta }) {
  const puntos = useMemo(
    () => calcularSaldo(balances, { desde, hasta }),
    [balances, desde, hasta]
  )

  const g = useMemo(() => {
    if (puntos.length === 0) return null
    const valores = puntos.map((p) => p.saldo)
    const marcas = marcasEje(Math.min(...valores), Math.max(...valores))
    const yMin = marcas[0]
    const yMax = marcas[marcas.length - 1]
    const alto = ALTO - MARGEN.arriba - MARGEN.abajo
    const y = (valor) =>
      MARGEN.arriba + (1 - (valor - yMin) / (yMax - yMin || 1)) * alto
    const x = (i) => MARGEN.izq + PASO / 2 + i * PASO
    const ancho = Math.max(
      ANCHO_MIN,
      MARGEN.izq + MARGEN.der + puntos.length * PASO
    )
    const coords = puntos.map((p, i) => `${x(i)},${y(p.saldo)}`)
    // Área bajo la línea, hasta el cero (o el borde inferior si no hay negativos)
    const base = y(Math.max(yMin, Math.min(0, yMax)))
    const area = `${x(0)},${base} ${coords.join(' ')} ${x(puntos.length - 1)},${base}`
    return { marcas, y, x, ancho, linea: coords.join(' '), area }
  }, [puntos])

  // Cada cuántos puntos se escribe la etiqueta del eje X, para que no se encimen
  const cadaN = Math.ceil(44 / PASO)

  return (
    <section className="chart-card linea-card">
      <h2>Saldo acumulado (ingresos y egresos)</h2>

      {!g ? (
        <p className="table-empty">No hay movimientos para graficar.</p>
      ) : (
        <>
          <div className="linea-scroll">
            <svg
              width={g.ancho}
              height={ALTO}
              viewBox={`0 0 ${g.ancho} ${ALTO}`}
              role="img"
              aria-label="Gráfica de líneas del saldo de balances"
            >
              {/* Líneas guía y valores del eje vertical */}
              {g.marcas.map((m) => (
                <g key={m}>
                  <line
                    x1={MARGEN.izq}
                    x2={g.ancho - MARGEN.der}
                    y1={g.y(m)}
                    y2={g.y(m)}
                    className={m === 0 ? 'linea-cero' : 'linea-guia'}
                  />
                  <text
                    x={MARGEN.izq - 8}
                    y={g.y(m)}
                    className="linea-texto"
                    textAnchor="end"
                    dominantBaseline="middle"
                  >
                    {dineroCorto(m)}
                  </text>
                </g>
              ))}

              {puntos.length > 1 && (
                <polygon points={g.area} className="linea-area" />
              )}
              <polyline points={g.linea} className="linea-trazo" />

              {puntos.map((p, i) => {
                const esIngreso = p.tipo === TIPO_INGRESO
                return (
                  <g key={p.id}>
                    <circle
                      cx={g.x(i)}
                      cy={g.y(p.saldo)}
                      r="5"
                      className={
                        esIngreso ? 'linea-punto-ingreso' : 'linea-punto-egreso'
                      }
                    >
                      <title>
                        {`${p.nombre || `Registro #${p.id}`}\n${p.fecha}\n${
                          esIngreso ? 'Ingreso' : 'Egreso'
                        }: ${dinero(p.monto)}\nSaldo antes: ${dinero(
                          p.antes
                        )}\nSaldo después: ${dinero(p.saldo)}`}
                      </title>
                    </circle>
                    {i % cadaN === 0 && (
                      <text
                        x={g.x(i)}
                        y={ALTO - 10}
                        className="linea-texto"
                        textAnchor="middle"
                      >
                        {diaMes(p.fecha)}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          <p className="linea-leyenda">
            <span className="linea-chip linea-chip-ingreso" /> Ingreso
            <span className="linea-chip linea-chip-egreso" /> Egreso. Cada punto
            es un registro y la línea muestra el saldo acumulado. Pasa el cursor
            sobre un punto para ver el detalle.
          </p>
        </>
      )}
    </section>
  )
}

export default LineaBalance
