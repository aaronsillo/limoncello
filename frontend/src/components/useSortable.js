import { useMemo, useState } from 'react'

const esVacio = (v) => v === null || v === undefined || v === ''

// Convierte a número solo si el valor es numérico de verdad ("12", 12, "3.5")
const comoNumero = (v) => {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return Number(v)
  }
  return null
}

function comparar(a, b) {
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return Number(Boolean(a)) - Number(Boolean(b))
  }
  const na = comoNumero(a)
  const nb = comoNumero(b)
  if (na !== null && nb !== null) return na - nb
  // Texto y fechas ISO (YYYY-MM-DD...) se comparan como texto, sin distinguir
  // mayúsculas ni acentos
  return String(a).localeCompare(String(b), 'es', {
    sensitivity: 'base',
    numeric: true,
  })
}

/**
 * Ordenamiento por columna para una lista (se usa antes de paginar).
 *
 * @param {Array}  items       Lista ya filtrada
 * @param {object} [opciones]
 * @param {{campo: string|null, dir: 'asc'|'desc'}} [opciones.inicial]
 *        Orden inicial. Por defecto no ordena (queda el orden que trae la API).
 * @param {Object<string, function>} [opciones.valores]
 *        Para un campo, función que devuelve el valor por el que se ordena
 *        (útil cuando la columna muestra una etiqueta y no el dato crudo).
 * @returns {{ ordenados: Array, orden: object, ordenarPor: function }}
 */
export function useSortable(items, { inicial, valores } = {}) {
  const [orden, setOrden] = useState(inicial ?? { campo: null, dir: 'asc' })

  // Clic en un encabezado: primero ascendente, al repetir cambia la dirección
  const ordenarPor = (campo) => {
    setOrden((prev) =>
      prev.campo === campo
        ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { campo, dir: 'asc' }
    )
  }

  const ordenados = useMemo(() => {
    if (!orden.campo) return items
    const leer = valores?.[orden.campo] ?? ((r) => r[orden.campo])
    const signo = orden.dir === 'asc' ? 1 : -1
    return [...items].sort((x, y) => {
      const a = leer(x)
      const b = leer(y)
      // Los vacíos van siempre al final, sin importar la dirección
      if (esVacio(a) && esVacio(b)) return 0
      if (esVacio(a)) return 1
      if (esVacio(b)) return -1
      return comparar(a, b) * signo
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, orden])

  return { ordenados, orden, ordenarPor }
}
