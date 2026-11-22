import { Router } from 'express'
import { query, withTransaction } from './db.js'
import {
  LOCKER_STATUS_CERRADO,
  ORDER_STATUS,
  productStatusForOrder,
} from './statusConfig.js'

// Estados de orden con los que se permite cerrar un casillero
const ESTADOS_PARA_CERRAR = [
  ORDER_STATUS.ENTREGADO,
  ORDER_STATUS.ENVIADO,
  ORDER_STATUS.PAGADO,
]

// Columnas editables de locker
const COLUMNS = ['id_status', 'id_customer', 'shipment', 'active']

// SELECT con JOINs para traer nombres de cliente y estado
const SELECT_WITH_NAMES = `
  SELECT
    l.id,
    l.created_date,
    l.id_status,
    l.id_customer,
    l.shipment,
    l.active,
    c.name  AS customer_name,
    s.name  AS status_name
  FROM locker l
  LEFT JOIN customers c ON c.id = l.id_customer
  LEFT JOIN status s    ON s.id = l.id_status
`

export function lockersRouter() {
  const router = Router()

  // GET / -> listar solo activos
  router.get('/', async (req, res, next) => {
    try {
      const result = await query(
        `${SELECT_WITH_NAMES} WHERE l.active = true ORDER BY l.id DESC`
      )
      res.json(result.rows)
    } catch (err) {
      next(err)
    }
  })

  // GET /customer/:customerId -> casilleros activos de un cliente específico
  router.get('/customer/:customerId', async (req, res, next) => {
    try {
      const result = await query(
        `${SELECT_WITH_NAMES} WHERE l.active = true AND l.id_customer = $1 ORDER BY l.id DESC`,
        [req.params.customerId]
      )
      res.json(result.rows)
    } catch (err) {
      next(err)
    }
  })

  // GET /:id/orders -> órdenes asignadas a este casillero
  router.get('/:id/orders', async (req, res, next) => {
    try {
      const result = await query(
        `SELECT o.id, o.total, o.customer_id, o.status_id,
                c.name AS customer_name, s.name AS status_name
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
         LEFT JOIN status s    ON s.id = o.status_id
         WHERE o.active = true AND o.locker_id = $1
         ORDER BY o.id DESC`,
        [req.params.id]
      )
      res.json(result.rows)
    } catch (err) {
      next(err)
    }
  })

  // GET /:id/available-orders -> órdenes del mismo cliente y sin casillero asignado
  router.get('/:id/available-orders', async (req, res, next) => {
    try {
      const result = await query(
        `SELECT o.id, o.total, o.customer_id, o.status_id,
                c.name AS customer_name, s.name AS status_name
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
         LEFT JOIN status s    ON s.id = o.status_id
         WHERE o.active = true
           AND o.locker_id IS NULL
           AND o.customer_id = (SELECT id_customer FROM locker WHERE id = $1)
         ORDER BY o.id DESC`,
        [req.params.id]
      )
      res.json(result.rows)
    } catch (err) {
      next(err)
    }
  })

  // GET /:id/quote -> todos los productos de todas las órdenes del casillero (para cotización)
  router.get('/:id/quote', async (req, res, next) => {
    try {
      const result = await query(
        `SELECT
            od.id            AS detail_id,
            od.order_id,
            od.product_id,
            od.amount,
            od.discount,
            o.status_id      AS order_status_id,
            p.size,
            p.color,
            cl.name AS clothe_name,
            b.name  AS brand_name
         FROM order_details od
         JOIN orders o     ON o.id = od.order_id
         JOIN products p   ON p.id = od.product_id
         LEFT JOIN clothes cl ON cl.id = p.clothe_id
         LEFT JOIN brands  b  ON b.id = p.brand_id
         WHERE od.active = true
           AND o.active = true
           AND o.locker_id = $1
         ORDER BY od.order_id ASC, od.id ASC`,
        [req.params.id]
      )
      res.json(result.rows)
    } catch (err) {
      next(err)
    }
  })

  // POST /:id/orders -> asignar una orden a este casillero
  router.post('/:id/orders', async (req, res, next) => {
    try {
      const { order_id } = req.body
      const result = await query(
        `UPDATE orders SET locker_id = $1 WHERE id = $2 AND active = true RETURNING id`,
        [req.params.id, order_id]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Orden no encontrada' })
      }
      res.json({ id: result.rows[0].id })
    } catch (err) {
      next(err)
    }
  })

  // DELETE /:id/orders/:orderId -> quitar una orden de este casillero
  router.delete('/:id/orders/:orderId', async (req, res, next) => {
    try {
      const result = await query(
        `UPDATE orders SET locker_id = NULL
         WHERE id = $1 AND locker_id = $2 RETURNING id`,
        [req.params.orderId, req.params.id]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Orden no encontrada en este casillero' })
      }
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  // GET /:id -> obtener uno (solo activo)
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
        `INSERT INTO locker (${COLUMNS.join(', ')})
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
    const lockerId = req.params.id
    const cerrando = Number(req.body.id_status) === LOCKER_STATUS_CERRADO
    try {
      // Validación: para cerrar el casillero, todas sus órdenes deben estar
      // Entregadas, Enviadas o Pagadas
      if (cerrando) {
        const pendientes = await query(
          `SELECT COUNT(*)::int AS n
           FROM orders
           WHERE active = true
             AND locker_id = $1
             AND (status_id IS NULL OR NOT (status_id = ANY($2::int[])))`,
          [lockerId, ESTADOS_PARA_CERRAR]
        )
        if (pendientes.rows[0].n > 0) {
          return res.status(409).json({
            error:
              'No se puede cerrar el casillero: todas sus órdenes deben estar en estado Entregado, Enviado o Pagado.',
          })
        }
      }

      const result = await withTransaction(async (client) => {
        const sets = COLUMNS.map((col, i) => `${col} = $${i + 1}`).join(', ')
        const values = COLUMNS.map((col) => req.body[col] ?? null)
        values.push(lockerId)

        // Valor previo de shipment, para detectar el cambio a true
        const previo = await client.query(
          `SELECT shipment FROM locker WHERE id = $1`,
          [lockerId]
        )
        const upd = await client.query(
          `UPDATE locker SET ${sets}
           WHERE id = $${COLUMNS.length + 1}
           RETURNING id`,
          values
        )
        if (upd.rows.length === 0) {
          throw Object.assign(new Error('No encontrado'), { status: 404 })
        }

        // Si shipment cambia a true: el envío de sus órdenes queda pagado
        if (req.body.shipment === true && !previo.rows[0]?.shipment) {
          await client.query(
            `UPDATE orders SET shipment_pay = true
             WHERE active = true AND locker_id = $1`,
            [lockerId]
          )
        }

        // Al cerrar el casillero: las órdenes Enviadas o Pagadas pasan a Entregado
        // y sus productos al estado que corresponda (Entregado -> Vendido)
        if (cerrando) {
          await client.query(
            `UPDATE orders SET status_id = $1
             WHERE active = true AND locker_id = $2
               AND status_id IS DISTINCT FROM $1`,
            [ORDER_STATUS.ENTREGADO, lockerId]
          )

          const estadoProducto = productStatusForOrder(ORDER_STATUS.ENTREGADO)
          await client.query(
            `UPDATE products SET status_id = $1
             WHERE id IN (
               SELECT od.product_id
               FROM order_details od
               JOIN orders o ON o.id = od.order_id
               WHERE od.active = true
                 AND o.active = true
                 AND o.locker_id = $2
             )`,
            [estadoProducto, lockerId]
          )

          await client.query(
            `UPDATE order_details SET status_id = $1
             WHERE active = true AND order_id IN (
               SELECT id FROM orders WHERE active = true AND locker_id = $2
             )`,
            [estadoProducto, lockerId]
          )
        }

        return { id: upd.rows[0].id }
      })

      res.json(result)
    } catch (err) {
      next(err)
    }
  })

  // DELETE /:id -> soft delete
  router.delete('/:id', async (req, res, next) => {
    try {
      const result = await query(
        `UPDATE locker SET active = false WHERE id = $1 RETURNING id`,
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
