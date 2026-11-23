import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function Sidebar() {
  const { user, logout } = useAuth()
  const [mantenimientosOpen, setMantenimientosOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-top">
        {!collapsed && <div className="sidebar-brand">Limoncello</div>}
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expandir menú' : 'Minimizar menú'}
          title={collapsed ? 'Expandir menú' : 'Minimizar menú'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {!collapsed && (
        <nav className="sidebar-nav">
          <NavLink to="/" className="nav-item" end>
            Inicio
          </NavLink>

          <NavLink to="/lives" className="nav-item">
            Lives
          </NavLink>
          <NavLink to="/ordenes" className="nav-item">
            Órdenes (Tablero)
          </NavLink>
          <NavLink to="/mantenimientos/ordenes" className="nav-subitem">
            Órdenes (Listado)
          </NavLink>
          <NavLink to="/casilleros" className="nav-item">
            Casilleros
          </NavLink>
          <NavLink to="/mantenimientos/clientes" className="nav-subitem">
            Clientes
          </NavLink>
          <NavLink to="/balances" className="nav-item">
            Balances
          </NavLink>
          <NavLink to="/pendientes" className="nav-item">
            Pendientes
          </NavLink>

          <div className="nav-group">
            <button
              type="button"
              className="nav-group-toggle"
              onClick={() => setMantenimientosOpen((open) => !open)}
              aria-expanded={mantenimientosOpen}
            >
              <span>Mantenimientos</span>
              <span className={`chevron ${mantenimientosOpen ? 'open' : ''}`}>
                ›
              </span>
            </button>

            {mantenimientosOpen && (
              <div className="nav-submenu">
                <NavLink to="/mantenimientos/productos" className="nav-subitem">
                  Productos
                </NavLink>
                <NavLink to="/mantenimientos/prendas" className="nav-subitem">
                  Prendas
                </NavLink>
                <NavLink to="/mantenimientos/estados" className="nav-subitem">
                  Estados
                </NavLink>
                <NavLink to="/mantenimientos/tipos" className="nav-subitem">
                  Tipos
                </NavLink>
                <NavLink to="/mantenimientos/marcas" className="nav-subitem">
                  Marcas
                </NavLink>
                <NavLink to="/mantenimientos/secciones" className="nav-subitem">
                  Secciones
                </NavLink>
                <NavLink to="/mantenimientos/envios" className="nav-subitem">
                  Envíos
                </NavLink>
                <NavLink to="/mantenimientos/usuarios" className="nav-subitem">
                  Usuarios
                </NavLink>
              </div>
            )}
          </div>

          <div className="sidebar-user">
            <span className="sidebar-user-name" title={user?.email}>
              {user?.name}
            </span>
            <button type="button" className="btn btn-small" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        </nav>
      )}
    </aside>
  )
}

export default Sidebar
