// Cliente genérico para hablar con la API del backend.
// Gracias al proxy de Vite, las rutas /api/... llegan al backend en :3000.

const BASE = '/api'

async function handle(res) {
  if (!res.ok) {
    let message = `Error ${res.status}`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      // respuesta sin cuerpo JSON
    }
    throw new Error(message)
  }
  if (res.status === 204) return null
  return res.json()
}

/**
 * Crea un conjunto de funciones CRUD para un recurso.
 * Ejemplo: const clientesApi = createResource('clientes')
 */
export function createResource(resource) {
  const url = `${BASE}/${resource}`
  return {
    list: () => fetch(url).then(handle),
    get: (id) => fetch(`${url}/${id}`).then(handle),
    create: (data) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(handle),
    update: (id, data) =>
      fetch(`${url}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(handle),
    // PATCH a una sub-ruta, ej: patch(5, 'status', { status_id: 2 })
    patch: (id, path, data) =>
      fetch(`${url}/${id}/${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(handle),
    remove: (id) => fetch(`${url}/${id}`, { method: 'DELETE' }).then(handle),
  }
}
