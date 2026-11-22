import { useEffect, useState } from 'react'
import { createResource } from '../api/api'

const ordersApi = createResource('orders')
const productsApi = createResource('products')

// Ids de estado (deben coincidir con backend/src/statusConfig.js)
const ORDER_PAGADO = 3
const ORDER_ENVIADO = 5
const ORDER_ENTREGADO = 6
const ORDER_CANCELADO = 8
const ESTADOS_VENDIDA = [ORDER_PAGADO, ORDER_ENVIADO, ORDER_ENTREGADO]
const PRODUCT_DISPONIBLE = 9

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const formatPrecio = (n) =>
  `Q${Number(n || 0).toLocaleString('es-GT', { maximumFractionDigits: 0 })}`

// Agrupa una lista por el valor que devuelve `clave` y cuenta cada grupo.
function contarPor(lista, clave) {
  const mapa = new Map()
  for (const item of lista) {
    const k = clave(item) || 'Sin estado'
    mapa.set(k, (mapa.get(k) || 0) + 1)
  }
  return [...mapa.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

// Últimos 6 meses (incluye el actual) con la suma de ventas de cada uno.
function ventasPorMes(ordenes) {
  const hoy = new Date()
  const meses = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    meses.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      value: 0,
    })
  }
  for (const o of ordenes) {
    if (!ESTADOS_VENDIDA.includes(Number(o.status_id)) || !o.created_date) continue
    const f = new Date(o.created_date)
    const mes = meses.find((m) => m.key === `${f.getFullYear()}-${f.getMonth()}`)
    if (mes) mes.value += Number(o.total) || 0
  }
  return meses
}

function Kpi({ titulo, valor, detalle }) {
  return (
    <div className="stat-card">
      <span className="stat-card-title">{titulo}</span>
      <span className="stat-card-value">{valor}</span>
      {detalle && <span className="stat-card-detail">{detalle}</span>}
    </div>
  )
}

// Barras horizontales: una fila por categoría.
function BarrasHorizontales({ datos, formato = (v) => v }) {
  if (datos.length === 0) return <p className="table-empty">Sin datos.</p>
  const max = Math.max(...datos.map((d) => d.value), 1)
  return (
    <div className="hbars">
      {datos.map((d) => (
        <div className="hbar-row" key={d.label}>
          <span className="hbar-label" title={d.label}>
            {d.label}
          </span>
          <div className="hbar-track">
            <div
              className="hbar-fill"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span className="hbar-value">{formato(d.value)}</span>
        </div>
      ))}
    </div>
  )
}

// Barras verticales: una columna por categoría.
function BarrasVerticales({ datos, formato = (v) => v }) {
  const max = Math.max(...datos.map((d) => d.value), 1)
  return (
    <div className="vbars">
      {datos.map((d) => (
        <div className="vbar-col" key={d.key ?? d.label}>
          <span className="vbar-value">{formato(d.value)}</span>
          <div className="vbar-track">
            <div
              className="vbar-fill"
              style={{ height: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span className="vbar-label">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function Inicio() {
  const [ordenes, setOrdenes] = useState([])
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([ordersApi.list(), productsApi.list()])
      .then(([o, p]) => {
        setOrdenes(o)
        setProductos(p)
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [])

  const ordenesValidas = ordenes.filter(
    (o) => Number(o.status_id) !== ORDER_CANCELADO
  )
  const vendidas = ordenes.filter((o) =>
    ESTADOS_VENDIDA.includes(Number(o.status_id))
  )
  const totalVendido = vendidas.reduce((s, o) => s + (Number(o.total) || 0), 0)
  const porCobrar = ordenes
    .filter((o) => !ESTADOS_VENDIDA.includes(Number(o.status_id)) &&
      Number(o.status_id) !== ORDER_CANCELADO)
    .reduce((s, o) => s + (Number(o.total) || 0), 0)
  const enviosPendientes = ordenesValidas.filter(
    (o) => o.shipment_id && !o.shipment_pay
  ).length
  const disponibles = productos.filter(
    (p) => Number(p.status_id) === PRODUCT_DISPONIBLE
  ).length

  return (
    <div className="page">
      <h1>Bienvenidos</h1>
      <p className="page-subtitle">
        Panel de control de ventas de tu emprendimiento.
      </p>

      {error && <div className="alert-error">{error}</div>}

      {cargando ? (
        <p className="table-empty">Cargando estadísticas...</p>
      ) : (
        <>
          <div className="stat-grid">
            <Kpi titulo="Órdenes activas" valor={ordenesValidas.length} />
            <Kpi
              titulo="Total vendido"
              valor={formatPrecio(totalVendido)}
              detalle={`${vendidas.length} órdenes pagadas, enviadas o entregadas`}
            />
            <Kpi titulo="Por cobrar" valor={formatPrecio(porCobrar)} />
            <Kpi
              titulo="Envíos sin pagar"
              valor={enviosPendientes}
              detalle="Órdenes con envío asignado y sin pagar"
            />
            <Kpi
              titulo="Productos disponibles"
              valor={disponibles}
              detalle={`de ${productos.length} productos`}
            />
          </div>

          <div className="chart-grid">
            <section className="chart-card">
              <h2>Ventas por mes</h2>
              <BarrasVerticales
                datos={ventasPorMes(ordenes)}
                formato={formatPrecio}
              />
            </section>

            <section className="chart-card">
              <h2>Órdenes por estado</h2>
              <BarrasHorizontales
                datos={contarPor(ordenes, (o) => o.status_name)}
              />
            </section>

            <section className="chart-card">
              <h2>Productos por estado</h2>
              <BarrasHorizontales
                datos={contarPor(productos, (p) => p.status_name)}
              />
            </section>

            <section className="chart-card">
              <h2>Productos por marca (top 6)</h2>
              <BarrasHorizontales
                datos={contarPor(productos, (p) => p.brand_name).slice(0, 6)}
              />
            </section>
          </div>
        </>
      )}
    </div>
  )
}

export default Inicio
