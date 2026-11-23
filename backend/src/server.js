import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { pool } from './db.js'
import { authRouter, requireAuth } from './auth.js'
import { usersRouter } from './usersRouter.js'
import { crudRouter } from './crudRouter.js'
import { productsRouter } from './productsRouter.js'
import { livesRouter } from './livesRouter.js'
import { ordersRouter } from './ordersRouter.js'
import { lockersRouter } from './lockersRouter.js'

const app = express()
const isProd = process.env.NODE_ENV === 'production'

app.disable('x-powered-by')
// Detrás del proxy del hosting (Render, etc.): necesario para ver la IP real
app.set('trust proxy', 1)

// CORS: en producción el frontend lo sirve este mismo servidor (mismo origen),
// así que no se abre CORS salvo que definas CORS_ORIGIN (varios, separados por coma).
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) }))
} else if (!isProd) {
  app.use(cors())
}
app.use(express.json())

// ===== Rutas públicas =====
// Salud: sirve para el health check del hosting (no expone datos)
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok' })
  } catch {
    res.status(500).json({ status: 'error' })
  }
})

// Login (POST /api/auth/login) y sesión actual (GET /api/auth/me)
app.use('/api/auth', authRouter())

// ===== Todo lo demás de /api exige un token válido =====
app.use('/api', requireAuth)

// ===== Usuarios (mantenimiento interno; no hay registro público) =====
app.use('/api/users', usersRouter())

// created_date lo devolvemos al leer; modified_date lo maneja un trigger en la BD
const auditoria = ['created_date']

// ===== Clientes (customers) =====
app.use('/api/customers', crudRouter({
  table: 'customers',
  columns: ['name', 'phone', 'phone_secondary', 'username', 'address', 'active', 'vip'],
  readOnly: auditoria,
}))

// ===== Marcas (brands) =====
app.use('/api/brands', crudRouter({
  table: 'brands',
  columns: ['name', 'description', 'active'],
  readOnly: auditoria,
}))

// ===== Prendas (clothes) =====
app.use('/api/clothes', crudRouter({
  table: 'clothes',
  columns: ['name', 'description', 'active'],
  readOnly: auditoria,
}))

// ===== Tipos (types) =====
app.use('/api/types', crudRouter({
  table: 'types',
  columns: ['name', 'description', 'active'],
  readOnly: auditoria,
}))

// ===== Secciones (sections) =====
app.use('/api/sections', crudRouter({
  table: 'sections',
  columns: ['name', 'description', 'active'],
  readOnly: auditoria,
}))

// ===== Estados (status) =====
app.use('/api/status', crudRouter({
  table: 'status',
  columns: ['name', 'type', 'active'],
  readOnly: auditoria,
}))

// ===== Productos (products) con JOINs a sus catálogos =====
app.use('/api/products', productsRouter())

// ===== Lives con JOIN al estado =====
app.use('/api/lives', livesRouter())

// ===== Órdenes con JOINs a cliente y estado =====
app.use('/api/orders', ordersRouter())

// ===== Casilleros con JOINs a cliente y estado =====
app.use('/api/lockers', lockersRouter())

// ===== Balances =====
app.use('/api/balances', crudRouter({
  table: 'balances',
  columns: ['name', 'description', 'type', 'amount', 'balance_date', 'active'],
  readOnly: auditoria,
}))

// ===== Pendientes (pending_tasks): tablero tipo post-it =====
app.use('/api/pending-tasks', crudRouter({
  table: 'pending_tasks',
  columns: ['title', 'description', 'status_id', 'color', 'active'],
  readOnly: auditoria,
}))

// ===== Envíos (shipments) =====
app.use('/api/shipments', crudRouter({
  table: 'shipments',
  columns: ['name', 'description', 'amount', 'active'],
  readOnly: auditoria,
}))

// ===== Cuentas bancarias (bank_accounts): solo lectura, para la cotización =====
app.get('/api/bank-accounts', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, bank, number, type, name_account
       FROM bank_accounts
       WHERE active = true
       ORDER BY id ASC`
    )
    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

// Rutas /api que no existen: 404 en JSON (no caer al frontend)
app.use('/api', (req, res) => res.status(404).json({ error: 'No encontrado' }))

// ===== Frontend compilado (frontend/dist) =====
// Express lo sirve para tener una sola URL. Primero se debe compilar el frontend.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : path.resolve(__dirname, '../../frontend/dist')

if (fs.existsSync(path.join(distDir, 'index.html'))) {
  // Los archivos con hash (assets/) se pueden cachear mucho tiempo
  app.use(
    '/assets',
    express.static(path.join(distDir, 'assets'), { maxAge: '1y', immutable: true })
  )
  app.use(express.static(distDir))
  // Cualquier otra ruta del navegador (React Router) devuelve index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
} else {
  console.warn(`No se encontró el frontend compilado en ${distDir}. Ejecuta "npm run build" en frontend.`)
}

// Manejador de errores centralizado
app.use((err, req, res, next) => {
  console.error(err)
  const status = err.status || 500
  // En producción no se muestran detalles internos (SQL, rutas, etc.) de errores 500
  const message = isProd && status >= 500 ? 'Error interno del servidor' : err.message
  res.status(status).json({ error: message })
})

const port = Number(process.env.PORT) || 3000
app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`)
})
