import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Inicio from './pages/Inicio'
import Clientes from './pages/Clientes'
import Productos from './pages/Productos'
import Estados from './pages/Estados'
import Tipos from './pages/Tipos'
import Marcas from './pages/Marcas'
import Prendas from './pages/Prendas'
import Secciones from './pages/Secciones'
import Envios from './pages/Envios'
import Lives from './pages/Lives'
import Ordenes from './pages/Ordenes'
import OrdenesMantenimiento from './pages/OrdenesMantenimiento'
import Usuarios from './pages/Usuarios'
import Login from './pages/Login'
import RequireAuth from './components/RequireAuth'
import Casilleros from './pages/Casilleros'
import Balance from './pages/Balance'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
      <Route path="/" element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="lives" element={<Lives />} />
        <Route path="ordenes" element={<Ordenes />} />
        <Route path="casilleros" element={<Casilleros />} />
        <Route path="balances" element={<Balance />} />
        <Route path="mantenimientos/clientes" element={<Clientes />} />
        <Route path="mantenimientos/productos" element={<Productos />} />
        <Route path="mantenimientos/estados" element={<Estados />} />
        <Route path="mantenimientos/tipos" element={<Tipos />} />
        <Route path="mantenimientos/marcas" element={<Marcas />} />
        <Route path="mantenimientos/prendas" element={<Prendas />} />
        <Route path="mantenimientos/secciones" element={<Secciones />} />
        <Route path="mantenimientos/envios" element={<Envios />} />
        <Route
          path="mantenimientos/ordenes"
          element={<OrdenesMantenimiento />}
        />
        <Route path="mantenimientos/usuarios" element={<Usuarios />} />
      </Route>
      </Route>
    </Routes>
  )
}

export default App
