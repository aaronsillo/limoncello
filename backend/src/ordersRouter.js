import { Router } from 'express'
import { query, withTransaction } from './db.js'
import {
  PRODUCT_STATUS,
  ORDER_STATUS,
  BALANCE_TYPE_INGRESO,
  productStatusForOrder,
} from './statusConfig.js'

// Columnas editables de orders (las que el cliente puede enviar)
// 'locker' (int4) quedó obsoleto pero sigue siendo NOT NULL en la BD, por eso se mantiene.
const COLUMNS = [
  'customer_id',
  'locker',
  'total',
  'status_id',
  'live_id',
  'locker_id',
  'shipment_id',
  'shipment_pay',
  'active',
]

// Valor de cada columna; shipment_pay es false cuando no se envía.
const valueOf = (body, col) =>
  col === 'shipment_pay' ? Boolean(body.shipment_pay) : body[col] ?? null

// SELECT con JOINs para traer nombres de cliente, estado, live y casillero
const SELECT_WITH_NAMES = `
  SELECT
    o.id,
    o.created_date,
    o.customer_id,
    o.locker,
    o.total,
    o.status_id,
    o.live_id,
    o.locker_id,
    o.shipment_id,
    o.shipment_pay,
    o.active,
    c.name  AS customer_name,
    c.address AS customer_address,
    c.phone AS customer_phone,
    s.name  AS status_name,
    lv.name AS live_name,
    sh.name AS shipment_name,
    sh.amount AS shipment_amount
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN status s    ON s.id = o.status_id
  LEFT JOIN lives lv    ON lv.id = o.live_id
  LEFT JOIN shipments sh ON sh.id = o.shipment_id
`

export function ordersRouter() {
  const router = Router()

  // GET / -> listar solo las activas
  router.get('/', async (req, res, next) => {
    try {
      const result = await query(
        `${SELECT_WITH_NAMES} WHERE o.active = true ORDER BY o.id ASC`
      )
      res.json(result.rows)
    } catch (err) {
      next(err)
    }
  })

  // GET /:id/products -> productos (order_details) de una orden
  router.get('/:id/products', async (req, res, next) => {
    try {
      const result = await query(
        `SELECT
            od.id            AS detail_id,
            od.product_id,
            od.amount,
            od.discount,
            od.status_id     AS detail_status_id,
            p.price,
            cl.name          AS clothe_name,
            b.name           AS brand_name,
            p.size,
            p.color
         FROM order_details od
         JOIN products p   ON p.id = od.product_id
         LEFT JOIN clothes cl ON cl.id = p.clothe_id
         LEFT JOIN brands  b  ON b.id = p.brand_id
         WHERE od.active = true AND od.order_id = $1
         ORDER BY od.id DESC`,
        [req.params.id]
      )
      res.json(result.rows)
    } catch (err) {
      next(err)
    }
  })

  // GET /:id/available-products -> productos en estado Disponible (para agregar)
  router.get('/:id/available-products', async (req, res, next) => {
    try {
      const result = await query(
        `SELECT
            p.id,
            p.price,
            p.discount,
            p.size,
            p.color,
            cl.name AS clothe_name,
            b.name  AS brand_name
         FROM products p
         LEFT JOIN clothes cl ON cl.id = p.clothe_id
         LEFT JOIN brands  b  ON b.id = p.brand_id
         WHERE p.active = true AND p.status_id = $1
         ORDER BY p.id DESC`,
        [PRODUCT_STATUS.DISPONIBLE]
      )
      res.json(result.rows)
    } catch (err) {
      next(err)
    }
  })

  // POST /:id/products -> agregar un producto a la orden
  //  - crea order_details (amount = price, discount = discount del producto)
  //  - producto pasa a Reservado (o Vendido si la orden ya está vendida)
  //  - total += (price - discount)
  router.post('/:id/products', async (req, res, next) => {
    const orderId = req.params.id
    const { product_id } = req.body
    try {
      const result = await withTransaction(async (client) => {
        // Traer la orden (para su estado) y el producto
        const orderRes = await client.query(
          `SELECT id, status_id FROM orders WHERE id = $1 AND active = true`,
          [orderId]
        )
        if (orderRes.rows.length === 0) {
          throw Object.assign(new Error('Orden no encontrada'), { status: 404 })
        }
        const order = orderRes.rows[0]

        const prodRes = await client.query(
          `SELECT id, price, discount, status_id FROM products WHERE id = $1 AND active = true`,
          [product_id]
        )
        if (prodRes.rows.length === 0) {
          throw Object.assign(new Error('Producto no encontrado'), {
            status: 404,
          })
        }
        const product = prodRes.rows[0]

        // Solo se puede agregar un producto Disponible
        if (Number(product.status_id) !== PRODUCT_STATUS.DISPONIBLE) {
          throw Object.assign(
            new Error('El producto no está disponible'),
            { status: 409 }
          )
        }

        const price = Number(product.price) || 0
        const discount = Number(product.discount) || 0
        const subtotal = price - discount

        // El estado del detalle/producto depende del estado de la orden
        const nuevoEstadoProducto = productStatusForOrder(order.status_id)

        // Crear el detalle
        await client.query(
          `INSERT INTO order_details (order_id, product_id, amount, discount, status_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [orderId, product_id, price, discount, nuevoEstadoProducto]
        )

        // Cambiar estado del producto
        await client.query(`UPDATE products SET status_id = $1 WHERE id = $2`, [
          nuevoEstadoProducto,
          product_id,
        ])

        // Sumar al total de la orden
        await client.query(
          `UPDATE orders SET total = total + $1 WHERE id = $2`,
          [subtotal, orderId]
        )

        return { subtotal }
      })
      res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  })

  // DELETE /:id/products/:detailId -> quitar un producto de la orden
  //  - producto vuelve a Disponible
  //  - total -= (amount - discount)
  //  - el detalle se marca inactivo
  router.delete('/:id/products/:detailId', async (req, res, next) => {
    const { id: orderId, detailId } = req.params
    try {
      await withTransaction(async (client) => {
        const detRes = await client.query(
          `SELECT id, product_id, amount, discount
           FROM order_details
           WHERE id = $1 AND order_id = $2 AND active = true`,
          [detailId, orderId]
        )
        if (detRes.rows.length === 0) {
          throw Object.assign(new Error('Detalle no encontrado'), {
            status: 404,
          })
        }
        const detalle = detRes.rows[0]
        const subtotal = (Number(detalle.amount) || 0) - (Number(detalle.discount) || 0)

        // Marcar el detalle como inactivo
        await client.query(
          `UPDATE order_details SET active = false WHERE id = $1`,
          [detailId]
        )

        // El producto vuelve a Disponible
        await client.query(`UPDATE products SET status_id = $1 WHERE id = $2`, [
          PRODUCT_STATUS.DISPONIBLE,
          detalle.product_id,
        ])

        // Restar del total de la orden
        await client.query(
          `UPDATE orders SET total = GREATEST(total - $1, 0) WHERE id = $2`,
          [subtotal, orderId]
        )
      })
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  // PATCH /:id/shipment -> asignar un envío a la orden
  router.patch('/:id/shipment', async (req, res, next) => {
    try {
      const { shipment_id } = req.body
      const result = await query(
        `UPDATE orders SET shipment_id = $1 WHERE id = $2 RETURNING id`,
        [shipment_id ?? null, req.params.id]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No encontrado' })
      }
      res.json({ id: result.rows[0].id })
    } catch (err) {
      next(err)
    }
  })

  // GET /:id -> obtener una (solo si está activa)
  router.get('/:id', async (req, res, next) => {
    try {
      const result = await query(
        `${SELECT_WITH_NAMES} WHERE o.id = $1 AND o.active = true`,
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
      const values = COLUMNS.map((col) => valueOf(req.body, col))
      const placeholders = COLUMNS.map((_, i) => `$${i + 1}`).join(', ')
      const result = await query(
        `INSERT INTO orders (${COLUMNS.join(', ')})
         VALUES (${placeholders})
         RETURNING id`,
        values
      )
      res.status(201).json({ id: result.rows[0].id })
    } catch (err) {
      next(err)
    }
  })

  // PUT /:id -> actualizar completa
  router.put('/:id', async (req, res, next) => {
    try {
      const sets = COLUMNS.map((col, i) => `${col} = $${i + 1}`).join(', ')
      const values = COLUMNS.map((col) => valueOf(req.body, col))
      values.push(req.params.id)
      const result = await query(
        `UPDATE orders SET ${sets}
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

  // PATCH /:id/status -> actualizar el estado de la orden
  //  - también actualiza el estado de los productos de la orden:
  //    Vendido si el nuevo estado de orden es Pagado/Enviado/Entregado, si no Reservado
  router.patch('/:id/status', async (req, res, next) => {
    const orderId = req.params.id
    const { status_id } = req.body
    try {
      const result = await withTransaction(async (client) => {
        const upd = await client.query(
          `UPDATE orders SET status_id = $1 WHERE id = $2 RETURNING id, total`,
          [status_id ?? null, orderId]
        )
        if (upd.rows.length === 0) {
          throw Object.assign(new Error('No encontrado'), { status: 404 })
        }
        const orderTotal = Number(upd.rows[0].total) || 0

        // Estado que deben tener los productos según el nuevo estado de la orden
        const nuevoEstadoProducto = productStatusForOrder(status_id)

        // Actualiza el estado de los productos ligados a los detalles activos de la orden
        await client.query(
          `UPDATE products
             SET status_id = $1
           WHERE id IN (
             SELECT product_id FROM order_details
             WHERE order_id = $2 AND active = true
           )`,
          [nuevoEstadoProducto, orderId]
        )

        // Mantener el status de los detalles alineado también
        await client.query(
          `UPDATE order_details SET status_id = $1
           WHERE order_id = $2 AND active = true`,
          [nuevoEstadoProducto, orderId]
        )

        // Si la orden pasa a "Pagado", crear automáticamente un ingreso en balances.
        // Usamos el nombre "Orden #<id>" como marca para no duplicar el ingreso
        // si la orden vuelve a Pagado más de una vez.
        if (Number(status_id) === ORDER_STATUS.PAGADO) {
          const nombreIngreso = `Orden #${orderId}`
          const existe = await client.query(
            `SELECT 1 FROM balances WHERE active = true AND name = $1 LIMIT 1`,
            [nombreIngreso]
          )
          if (existe.rows.length === 0) {
            await client.query(
              `INSERT INTO balances (name, description, type, amount, balance_date)
               VALUES ($1, $2, $3, $4, CURRENT_DATE)`,
              [
                nombreIngreso,
                `Ingreso automático por pago de la orden #${orderId}`,
                BALANCE_TYPE_INGRESO,
                orderTotal,
              ]
            )
          }
        }

        return { id: upd.rows[0].id }
      })
      res.json(result)
    } catch (err) {
      next(err)
    }
  })

  // DELETE /:id -> soft delete de la orden
  //  - sus productos vuelven a Disponible
  //  - sus detalles se marcan inactivos
  router.delete('/:id', async (req, res, next) => {
    const orderId = req.params.id
    try {
      await withTransaction(async (client) => {
        const upd = await client.query(
          `UPDATE orders SET active = false WHERE id = $1 RETURNING id`,
          [orderId]
        )
        if (upd.rows.length === 0) {
          throw Object.assign(new Error('No encontrado'), { status: 404 })
        }

        // Los productos de la orden vuelven a Disponible
        await client.query(
          `UPDATE products
             SET status_id = $1
           WHERE id IN (
             SELECT product_id FROM order_details
             WHERE order_id = $2 AND active = true
           )`,
          [PRODUCT_STATUS.DISPONIBLE, orderId]
        )

        // Desactivar los detalles de la orden
        await client.query(
          `UPDATE order_details SET active = false WHERE order_id = $1`,
          [orderId]
        )
      })
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  return router
}
