import { Router } from 'express'
import { query, withTransaction } from './db.js'
import { ORDER_STATUS } from './statusConfig.js'

// Columnas editables de products (las que el cliente puede enviar).
// Las secciones ya no van aquí: viven en la tabla product_sections.
const COLUMNS = [
  'clothe_id',
  'color',
  'size',
  'price',
  'cost',
  'discount',
  'brand_id',
  'status_id',
  'type_id',
  'gender',
  'description',
  'image_url',
  'active',
  'new',
]

// "new" es palabra reservada en SQL, por eso se cita al usarla en consultas.
const quoteCol = (col) => (col === 'new' ? '"new"' : col)

// Valor de cada columna; "new" es false cuando no se envía.
const valueOf = (body, col) =>
  col === 'new' ? Boolean(body.new) : body[col] ?? null

// SELECT con JOINs para traer los nombres de las tablas relacionadas.
// section_ids: arreglo de ids de sección; section_name: nombres separados por coma.
const SELECT_WITH_NAMES = `
  SELECT
    p.id,
    p.created_date,
    p.clothe_id,
    p.color,
    p.size,
    p.price,
    p.cost,
    p.discount,
    p.brand_id,
    p.status_id,
    p.type_id,
    p.gender,
    p.description,
    p.image_url,
    p.active,
    p."new",
    c.name  AS clothe_name,
    b.name  AS brand_name,
    s.name  AS status_name,
    t.name  AS type_name,
    COALESCE((
      SELECT array_agg(ps.section_id ORDER BY ps.section_id)::int[]
      FROM product_sections ps
      JOIN sections sec ON sec.id = ps.section_id AND sec.active = true
      WHERE ps.product_id = p.id AND ps.active = true
    ), '{}') AS section_ids,
    (
      SELECT string_agg(sec.name, ', ' ORDER BY sec.name)
      FROM product_sections ps
      JOIN sections sec ON sec.id = ps.section_id AND sec.active = true
      WHERE ps.product_id = p.id AND ps.active = true
    ) AS section_name,
    (
      SELECT od.order_id
      FROM order_details od
      JOIN orders o ON o.id = od.order_id
      WHERE od.product_id = p.id
        AND od.active = true
        AND o.active = true
        AND o.status_id IS DISTINCT FROM ${ORDER_STATUS.CANCELADO}
      ORDER BY od.id DESC
      LIMIT 1
    ) AS order_id
  FROM products p
  LEFT JOIN clothes  c ON c.id = p.clothe_id
  LEFT JOIN brands   b ON b.id = p.brand_id
  LEFT JOIN status   s ON s.id = p.status_id
  LEFT JOIN types    t ON t.id = p.type_id
`

/**
 * Convierte un enlace de "compartir" de Google Drive en un enlace directo a la
 * imagen. Cualquier otra URL se devuelve igual.
 * Funciona solo si el archivo está compartido como "Cualquier persona con el enlace".
 */
function urlDirectaImagen(url) {
  const m =
    url.match(/drive\.google\.com\/file\/d\/([\w-]+)/) ||
    url.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]+)/)
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000` : url
}

/**
 * Deja las secciones activas del producto exactamente igual a `sectionIds`:
 * desactiva las que ya no están y agrega o reactiva las nuevas.
 */
async function syncSections(client, productId, sectionIds) {
  const ids = [
    ...new Set((sectionIds || []).map(Number).filter(Number.isFinite)),
  ]

  await client.query(
    `UPDATE product_sections
        SET active = false
      WHERE product_id = $1
        AND active = true
        AND NOT (section_id = ANY($2::bigint[]))`,
    [productId, ids]
  )

  if (ids.length > 0) {
    await client.query(
      `INSERT INTO product_sections (product_id, section_id)
       SELECT $1, UNNEST($2::bigint[])
       ON CONFLICT (product_id, section_id) DO UPDATE SET active = true`,
      [productId, ids]
    )
  }
}

export function productsRouter() {
  const router = Router()

  // GET / -> listar solo los activos
  router.get('/', async (req, res, next) => {
    try {
      const result = await query(
        `${SELECT_WITH_NAMES} WHERE p.active = true ORDER BY p.id DESC`
      )
      res.json(result.rows)
    } catch (err) {
      next(err)
    }
  })

  // GET /:id/image -> descarga la imagen guardada en image_url y la devuelve.
  // Se hace desde el servidor para que el navegador pueda usarla en el PDF sin
  // problemas de CORS. Solo se descargan URLs guardadas en la BD, nunca una que
  // envíe el cliente en la petición.
  router.get('/:id/image', async (req, res, next) => {
    const LIMITE_BYTES = 8 * 1024 * 1024
    try {
      const found = await query(
        `SELECT image_url FROM products WHERE id = $1 AND active = true`,
        [req.params.id]
      )
      const imageUrl = found.rows[0]?.image_url
      if (!imageUrl) {
        return res.status(404).json({ error: 'El producto no tiene imagen' })
      }

      let parsed
      try {
        parsed = new URL(urlDirectaImagen(imageUrl.trim()))
      } catch {
        return res.status(400).json({ error: 'La URL de la imagen no es válida' })
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).json({ error: 'La URL debe ser http o https' })
      }

      const esDrive = parsed.hostname === 'drive.google.com'
      if (esDrive && !parsed.pathname.startsWith('/thumbnail')) {
        return res.status(400).json({
          error:
            'Enlace de Drive no reconocido. Usa el enlace de compartir de un archivo (no de una carpeta).',
        })
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10000)
      try {
        const resp = await fetch(parsed, {
          signal: controller.signal,
          redirect: 'follow',
        })
        if (!resp.ok) {
          return res
            .status(502)
            .json({ error: `La imagen respondió con estado ${resp.status}` })
        }
        const tipo = resp.headers.get('content-type') || ''
        if (!tipo.startsWith('image/')) {
          return res.status(502).json({
            error: esDrive
              ? 'Drive no devolvió una imagen. Comparte el archivo como "Cualquier persona con el enlace".'
              : 'El enlace no apunta directamente a una imagen',
          })
        }
        const declarado = Number(resp.headers.get('content-length'))
        if (declarado > LIMITE_BYTES) {
          return res.status(413).json({ error: 'La imagen es demasiado grande' })
        }
        const buffer = Buffer.from(await resp.arrayBuffer())
        if (buffer.length > LIMITE_BYTES) {
          return res.status(413).json({ error: 'La imagen es demasiado grande' })
        }
        res.set('Content-Type', tipo)
        res.set('Cache-Control', 'private, max-age=3600')
        return res.send(buffer)
      } finally {
        clearTimeout(timer)
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return res
          .status(504)
          .json({ error: 'La imagen tardó demasiado en responder' })
      }
      next(err)
    }
  })

  // GET /:id -> obtener uno (solo si está activo)
  router.get('/:id', async (req, res, next) => {
    try {
      const result = await query(
        `${SELECT_WITH_NAMES} WHERE p.id = $1 AND p.active = true`,
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

  // POST / -> crear (con sus secciones)
  router.post('/', async (req, res, next) => {
    try {
      const id = await withTransaction(async (client) => {
        const values = COLUMNS.map((col) => valueOf(req.body, col))
        const placeholders = COLUMNS.map((_, i) => `$${i + 1}`).join(', ')
        const result = await client.query(
          `INSERT INTO products (${COLUMNS.map(quoteCol).join(', ')})
           VALUES (${placeholders})
           RETURNING id`,
          values
        )
        const productId = result.rows[0].id
        await syncSections(client, productId, req.body.section_ids)
        return productId
      })
      res.status(201).json({ id })
    } catch (err) {
      next(err)
    }
  })

  // PUT /:id -> actualizar (con sus secciones)
  router.put('/:id', async (req, res, next) => {
    try {
      const id = await withTransaction(async (client) => {
        const sets = COLUMNS.map((col, i) => `${quoteCol(col)} = $${i + 1}`).join(', ')
        const values = COLUMNS.map((col) => valueOf(req.body, col))
        values.push(req.params.id)
        const result = await client.query(
          `UPDATE products SET ${sets}
           WHERE id = $${COLUMNS.length + 1}
           RETURNING id`,
          values
        )
        if (result.rows.length === 0) {
          throw Object.assign(new Error('No encontrado'), { status: 404 })
        }
        await syncSections(client, result.rows[0].id, req.body.section_ids)
        return result.rows[0].id
      })
      res.json({ id })
    } catch (err) {
      next(err)
    }
  })

  // DELETE /:id -> soft delete: marca active = false (no borra el registro)
  router.delete('/:id', async (req, res, next) => {
    try {
      const result = await query(
        `UPDATE products SET active = false WHERE id = $1 RETURNING id`,
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
