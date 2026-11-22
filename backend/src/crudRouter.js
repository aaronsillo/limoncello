import { Router } from 'express'
import { query } from './db.js'

/**
 * Crea un router REST con operaciones CRUD para una tabla.
 *
 * @param {Object} config
 * @param {string} config.table    Nombre de la tabla (controlado por el servidor, no por el cliente)
 * @param {string[]} config.columns Columnas editables (las que el cliente puede enviar)
 * @param {string[]} [config.readOnly=[]] Columnas que se devuelven al leer pero no se insertan/actualizan
 * @param {string} [config.idColumn='id'] Columna de llave primaria
 */
export function crudRouter({ table, columns, readOnly = [], idColumn = 'id' }) {
  const router = Router()

  // Lista de columnas que se devuelven al leer
  const selectCols = [idColumn, ...readOnly, ...columns].join(', ')

  // GET /  -> listar solo los activos
  router.get('/', async (req, res, next) => {
    try {
      const result = await query(
        `SELECT ${selectCols} FROM ${table} WHERE active = true ORDER BY ${idColumn} DESC`
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
        `SELECT ${selectCols} FROM ${table} WHERE ${idColumn} = $1 AND active = true`,
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
      const values = columns.map((col) => req.body[col] ?? null)
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
      const result = await query(
        `INSERT INTO ${table} (${columns.join(', ')})
         VALUES (${placeholders})
         RETURNING ${selectCols}`,
        values
      )
      res.status(201).json(result.rows[0])
    } catch (err) {
      next(err)
    }
  })

  // PUT /:id -> actualizar
  router.put('/:id', async (req, res, next) => {
    try {
      const sets = columns.map((col, i) => `${col} = $${i + 1}`).join(', ')
      const values = columns.map((col) => req.body[col] ?? null)
      values.push(req.params.id)
      const result = await query(
        `UPDATE ${table} SET ${sets}
         WHERE ${idColumn} = $${columns.length + 1}
         RETURNING ${selectCols}`,
        values
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No encontrado' })
      }
      res.json(result.rows[0])
    } catch (err) {
      next(err)
    }
  })

  // DELETE /:id -> soft delete: marca active = false (no borra el registro)
  router.delete('/:id', async (req, res, next) => {
    try {
      const result = await query(
        `UPDATE ${table} SET active = false WHERE ${idColumn} = $1 RETURNING ${idColumn}`,
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
