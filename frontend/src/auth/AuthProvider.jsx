import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './AuthContext'
import { SESSION_EXPIRED_EVENT, clearToken, getToken, setToken } from './token'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Si hay token guardado, se valida con el servidor antes de mostrar nada
  const [cargando, setCargando] = useState(() => !!getToken())

  useEffect(() => {
    if (!getToken()) return
    let activo = true
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (activo) setUser(data?.user ?? null)
      })
      .catch(() => {
        if (activo) setUser(null)
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [])

  // Si el servidor responde 401 en cualquier llamada, se cierra la sesión
  useEffect(() => {
    const alExpirar = () => setUser(null)
    window.addEventListener(SESSION_EXPIRED_EVENT, alExpirar)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, alExpirar)
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'No se pudo iniciar sesión')
    setToken(data.token)
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, cargando, login, logout }),
    [user, cargando, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
