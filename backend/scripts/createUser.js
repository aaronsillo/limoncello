// Crea un usuario desde la terminal (sirve para el primer acceso).
// Uso:  node scripts/createUser.js correo@ejemplo.com "Nombre" "contraseña"
// Lee la conexión a la BD del archivo .env, igual que el servidor.
import { pool, query } from '../src/db.js'
import { MIN_PASSWORD_LENGTH, hashPassword } from '../src/passwords.js'

const [email, name, password] = process.argv.slice(2)

async function main() {
  if (!email || !name || !password) {
    console.error('Uso: node scripts/createUser.js correo "Nombre" "contraseña"')
    process.exitCode = 1
    return
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
    process.exitCode = 1
    return
  }
  try {
    const result = await query(
      `INSERT INTO users (email, name, password_hash)
       VALUES ($1, $2, $3) RETURNING id, email`,
      [email.trim().toLowerCase(), name.trim(), await hashPassword(password)]
    )
    console.log(`Usuario creado: #${result.rows[0].id} ${result.rows[0].email}`)
  } catch (err) {
    console.error(
      err.code === '23505' ? 'Ya existe un usuario con ese correo' : err.message
    )
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
