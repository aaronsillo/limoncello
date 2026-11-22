import { Router } from 'express'
import { query } from './db.js'
import { MIN_PASSWORD_LENGTH, hashPassword } from './passwords.js'

// Columnas que se devuelven (nunca el hash de la contraseña)
const SELECT = `id, created_date, email, name, active`

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validar({ email, name, password }, { passwordObligatoria }) {
  if (!EMAIL_RE.test(email)) return 'El correo no es válido'
  if (!name) return 'El nombre es obligatorio'
  if (passwordObligatoria && !password) return 'La contraseña es obligatoria'
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`
  }
  return null
}

// Convierte el error de índice único (correo repetido) en un 409
function manejarDuplicado(err, res, next) {
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Ya existe un usuario con ese correo' })
  }
  next(err)
}

/** Mantenimiento interno de usuarios (requiere sesión; no hay registro público). */
export function usersRouter() {
  const router = Router()

  // GET / -> listar usuarios activos
  router.get('/', async (req, res, next) => {
    try {
      const result = await query(
        `SELECT ${SELECT} FROM users WHERE active = true ORDER BY id DESC`
      )
      res.json(result.rows)
    } catch (err) {
      next(err)
    }
  })

  // POST / -> crear usuario
  router.post('/', async (req, res, next) => {
    try {
      const email = String(req.body?.email ?? '').trim().toLowerCase()
      const name = String(req.body?.name ?? '').trim()
      const password = String(req.body?.password ?? '')
      const error = validar({ email, name, password }, { passwordObligatoria: true })
      if (error) return res.status(400).json({ error })

      const result = await query(
        `INSERT INTO users (email, name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING ${SELECT}`,
        [email, name, await hashPassword(password)]
      )
      res.status(201).json(result.rows[0])
    } catch (err) {
      manejarDuplicado(err, res, next)
    }
  })

  // PUT /:id -> actualizar nombre/correo; la contraseña solo si se envía una nueva
  router.put('/:id', async (req, res, next) => {
    try {
      const email = String(req.body?.email ?? '').trim().toLowerCase()
      const name = String(req.body?.name ?? '').trim()
      const password = String(req.body?.password ?? '')
      const error = validar({ email, name, password }, { passwordObligatoria: false })
      if (error) return res.status(400).json({ error })

      const sets = ['email = $1', 'name = $2', 'modified_date = NOW()']
      const values = [email, name]
      if (password) {
        values.push(await hashPassword(password))
        sets.push(`password_hash = $${values.length}`)
      }
      values.push(req.params.id)

      const result = await query(
        `UPDATE users SET ${sets.join(', ')}
         WHERE id = $${values.length} AND active = true
         RETURNING ${SELECT}`,
        values
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No encontrado' })
      }
      res.json(result.rows[0])
    } catch (err) {
      manejarDuplicado(err, res, next)
    }
  })

  // DELETE /:id -> soft delete (no puedes eliminar tu propio usuario)
  router.delete('/:id', async (req, res, next) => {
    try {
      if (String(req.user.id) === String(req.params.id)) {
        return res.status(409).json({
          error: 'No puedes eliminar tu propio usuario',
        })
      }
      const result = await query(
        `UPDATE users SET active = false, modified_date = NOW()
         WHERE id = $1 AND active = true RETURNING id`,
        [req.params.id]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No encontrado' })
      }
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  return router
}
