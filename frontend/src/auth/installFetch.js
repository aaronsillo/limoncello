import { SESSION_EXPIRED_EVENT, clearToken, getToken } from './token'

// Envuelve window.fetch para que TODAS las llamadas a /api (las de api.js y las
// que usan fetch directo) lleven el token, y para detectar sesiones vencidas.
const originalFetch = window.fetch.bind(window)

function esLlamadaApi(input) {
  const url = typeof input === 'string' ? input : input?.url
  return typeof url === 'string' && url.startsWith('/api/')
}

window.fetch = async (input, init = {}) => {
  if (!esLlamadaApi(input)) return originalFetch(input, init)

  const token = getToken()
  const headers = new Headers(init.headers || {})
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await originalFetch(input, { ...init, headers })

  // 401 en cualquier ruta que no sea el login = sesión vencida o inválida
  const url = typeof input === 'string' ? input : input.url
  if (res.status === 401 && !url.startsWith('/api/auth/login')) {
    clearToken()
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
  return res
}
