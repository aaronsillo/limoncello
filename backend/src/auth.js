import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { query } from './db.js'
import { DUMMY_HASH, verifyPassword } from './passwords.js'

const isProd = process.env.NODE_ENV === 'production'

// Secreto para firmar los tokens. Obligatorio en producción.
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET && isProd) {
  throw new Error('Falta JWT_SECRET en las variables de entorno')
}
// En desarrollo se usa un secreto fijo para no obligar a configurarlo.
const SECRET = JWT_SECRET || 'dev-secret-solo-para-desarrollo-local'
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h'

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name })

function firmarToken(user) {
  return jwt.sign({ sub: String(user.id) }, SECRET, {
    algorithm: 'HS256',
    expiresIn: EXPIRES_IN,
  })
}

/**
 * Middleware: exige "Authorization: Bearer <token>" válido y que el usuario
 * siga activo. Deja el usuario en req.user.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) return res.status(401).json({ error: 'No autenticado' })

    let payload
    try {
      payload = jwt.verify(token, SECRET, { algorithms: ['HS256'] })
    } catch {
      return res.status(401).json({ error: 'Sesión inválida o expirada' })
    }

    const result = await query(
      `SELECT id, email, name FROM users WHERE id = $1 AND active = true`,
      [payload.sub]
    )
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Sesión inválida o expirada' })
    }
    req.user = result.rows[0]
    next()
  } catch (err) {
    next(err)
  }
}

// Límite de intentos fallidos de login por IP + correo (en memoria).
const MAX_INTENTOS = 5
const VENTANA_MS = 15 * 60 * 1000
const intentos = new Map() // clave -> { n, desde }

function bloqueado(clave) {
  const e = intentos.get(clave)
  if (!e) return false
  if (Date.now() - e.desde > VENTANA_MS) {
    intentos.delete(clave)
    return false
  }
  return e.n >= MAX_INTENTOS
}

function registrarFallo(clave) {
  const e = intentos.get(clave)
  if (!e || Date.now() - e.desde > VENTANA_MS) {
    intentos.set(clave, { n: 1, desde: Date.now() })
  } else {
    e.n += 1
  }
}

/** Rutas públicas de autenticación: POST /login y GET /me (esta pide token). */
export function authRouter() {
  const router = Router()

  router.post('/login', async (req, res, next) => {
    try {
      const email = String(req.body?.email ?? '').trim().toLowerCase()
      const password = String(req.body?.password ?? '')
      if (!email || !password) {
        return res.status(400).json({ error: 'Correo y contraseña son obligatorios' })
      }

      const clave = `${req.ip}|${email}`
      if (bloqueado(clave)) {
        return res.status(429).json({
          error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.',
        })
      }

      const result = await query(
        `SELECT id, email, name, password_hash
         FROM users
         WHERE lower(email) = $1 AND active = true`,
        [email]
      )
      const user = result.rows[0]
      // Siempre se verifica un hash, exista o no el usuario
      const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH)

      if (!user || !ok) {
        registrarFallo(clave)
        return res.status(401).json({ error: 'Correo o contraseña incorrectos' })
      }

      intentos.delete(clave)
      res.json({ token: firmarToken(user), user: publicUser(user) })
    } catch (err) {
      next(err)
    }
  })

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) })
  })

  return router
}
