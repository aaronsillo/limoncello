// Guarda el token de sesión en el navegador (localStorage).
const KEY = 'limoncello_token'

export const getToken = () => localStorage.getItem(KEY)
export const setToken = (token) => localStorage.setItem(KEY, token)
export const clearToken = () => localStorage.removeItem(KEY)

// Evento que se dispara cuando el servidor responde 401 (sesión vencida)
export const SESSION_EXPIRED_EVENT = 'auth:session-expired'
