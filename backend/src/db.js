import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

// Esquema donde viven las tablas (ej. 'main'). Por defecto 'public'.
const schema = process.env.PGSCHEMA || 'public'

// SSL: los servicios en la nube (Neon, Supabase, etc.) lo exigen.
//  - PGSSL=true activa SSL y valida el certificado del servidor.
//  - PGSSL_REJECT_UNAUTHORIZED=false lo activa sin validar el certificado
//    (solo si tu proveedor lo requiere).
const ssl =
  process.env.PGSSL === 'true'
    ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined

// Fija el search_path para que las consultas encuentren las tablas del esquema indicado
const options = `-c search_path=${schema}`

// Configuración desde variables de entorno. Si existe DATABASE_URL (cadena de
// conexión que dan Neon, Supabase, Render...) se usa; si no, las variables PG*.
export const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl, options }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT) || 5432,
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        ssl,
        options,
      }
)

// Pequeño helper para ejecutar consultas
export function query(text, params) {
  return pool.query(text, params)
}

/**
 * Ejecuta una función dentro de una transacción.
 * Recibe un `client` con el que hacer las queries; hace COMMIT si todo va bien
 * o ROLLBACK si algo lanza un error.
 */
export async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
