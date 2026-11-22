import { Router } from 'express'
import { query } from './db.js'

// Columnas editables de lives (las que el cliente puede enviar)
const COLUMNS = [
  'name',
  'live_date',
  'social_network',
  'start_time',
  'end_time',
  'status_id',
  'active',
]

// SELECT con JOIN para traer el nombre del estado
const SELECT_WITH_NAMES = `
  SELECT
    l.id,
    l.created_date,
    l.name,
    l.live_date,
    l.social_network,
    l.start_time,
    l.end_time,
    l.status_id,
    l.active,
    s.name AS status_name,
    COALESCE((
      SELECT SUM(o.total)
      FROM orders o
      WHERE o.active = true AND o.live_id = l.id
    ), 0) AS total
  FROM lives l
  LEFT JOIN status s ON s.id = l.status_id
`

export function livesRouter() {
  const router = Router()

  // GET / -> listar solo los activos
  router.get('/', async (req, res, next) => {
    try {
      const result = await query(
        `${SELECT_WITH_NAMES} WHERE l.active = true ORDER BY l.live_date DESC, l.id DESC`
      )
      res.json(result.rows)
    } catch (err) {
      next(err)
    }
  })

  // GET /:id/orders -> órdenes asignadas a este live
  router.get('/:id/orders', async (req, res, next) => {
    try {
      const result = await query(
        `SELECT o.id, o.total, o.customer_id, o.status_id,
                c.name AS customer_name, s.name AS status_name
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
         LEFT JOIN status s    ON s.id = o.status_id
         WHERE o.active = true AND o.live_id = $1
         ORDER BY o.id ASC`,
        [req.params.id]
      )
      res.json(result.rows)
    } catch (err) {
      next(err)
    }
  })

  // GET /:id -> obtener uno (solo si está activo)
  router.get('/:id', async (req, res, next) => {
    try {
      const result = await query(
        `${SELECT_WITH_NAMES} WHERE l.id = $1 AND l.active = true`,
        [req.params.id]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No encontrado' })
      }
      res.json(result.rows[0])
    } catch (err) {
      next(err)
    }
  })

  // POST / -> crear
  router.post('/', async (req, res, next) => {
    try {
      const values = COLUMNS.map((col) => req.body[col] ?? null)
      const placeholders = COLUMNS.map((_, i) => `$${i + 1}`).join(', ')
      const result = await query(
        `INSERT INTO lives (${COLUMNS.join(', ')})
         VALUES (${placeholders})
         RETURNING id`,
        values
      )
      res.status(201).json({ id: result.rows[0].id })
    } catch (err) {
      next(err)
    }
  })

  // PUT /:id -> actualizar
  router.put('/:id', async (req, res, next) => {
    try {
      const sets = COLUMNS.map((col, i) => `${col} = $${i + 1}`).join(', ')
      const values = COLUMNS.map((col) => req.body[col] ?? null)
      values.push(req.params.id)
      const result = await query(
        `UPDATE lives SET ${sets}
         WHERE id = $${COLUMNS.length + 1}
         RETURNING id`,
        values
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No encontrado' })
      }
      res.json({ id: result.rows[0].id })
    } catch (err) {
      next(err)
    }
  })

  // DELETE /:id -> soft delete: marca active = false (no borra el registro)
  router.delete('/:id', async (req, res, next) => {
    try {
      const result = await query(
        `UPDATE lives SET active = false WHERE id = $1 RETURNING id`,
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
