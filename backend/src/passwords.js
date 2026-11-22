import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
const KEY_LEN = 64

export const MIN_PASSWORD_LENGTH = 8

/** Devuelve "scrypt$<salt>$<hash>" (ambos en hex). */
export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, KEY_LEN)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

/** Compara una contraseña con un hash guardado, en tiempo constante. */
export async function verifyPassword(password, stored) {
  const [algo, saltHex, hashHex] = String(stored || '').split('$')
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(actual, expected)
}

// Hash de relleno: se usa cuando el correo no existe, para que el login
// tarde igual y no revele qué correos están registrados.
export const DUMMY_HASH = await hashPassword('relleno-no-es-una-contraseña')
