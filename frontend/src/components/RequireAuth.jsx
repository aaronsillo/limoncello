import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

// Protege las rutas hijas: sin sesión redirige a /login
function RequireAuth() {
  const { user, cargando } = useAuth()
  const location = useLocation()

  if (cargando) return <p className="table-empty">Cargando...</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

export default RequireAuth
