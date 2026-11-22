import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import logo from '../assets/images/limon.png'

function Login() {
  const { user, cargando, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const destino = location.state?.from?.pathname || '/'

  if (cargando) return <p className="table-empty">Cargando...</p>
  if (user) return <Navigate to={destino} replace />

  const enviar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      await login(email.trim(), password)
      navigate(destino, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={enviar}>
        <div className="login-brand">
          <img src={logo} alt="" className="login-logo" />
          <h1>Limoncello</h1>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <div className="form-field">
          <label htmlFor="email">Correo</label>
          <input
            id="email"
            type="email"
            value={email}
            required
            autoFocus
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            required
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={enviando}>
          {enviando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}

export default Login
