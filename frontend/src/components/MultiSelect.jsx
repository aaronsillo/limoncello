import { useEffect, useRef, useState } from 'react'

/**
 * Desplegable con buscador y selección múltiple.
 *
 * @param {Array}    options      [{ value, label }]
 * @param {Array}    value        valores seleccionados
 * @param {function} onChange     recibe el nuevo arreglo de valores
 * @param {string}   placeholder  texto cuando no hay selección
 * @param {string}   id           id para el label asociado
 */
function MultiSelect({
  options,
  value = [],
  onChange,
  placeholder = 'Seleccione...',
  id,
}) {
  const [open, setOpen] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const contenedorRef = useRef(null)

  const seleccionados = options.filter((o) =>
    value.some((v) => String(v) === String(o.value))
  )

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return
    const onClickFuera = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setOpen(false)
        setBusqueda('')
      }
    }
    document.addEventListener('mousedown', onClickFuera)
    return () => document.removeEventListener('mousedown', onClickFuera)
  }, [open])

  const filtradas = options.filter((o) =>
    o.label.toLowerCase().includes(busqueda.toLowerCase())
  )

  const estaSeleccionada = (opcion) =>
    value.some((v) => String(v) === String(opcion.value))

  const alternar = (opcion) => {
    if (estaSeleccionada(opcion)) {
      onChange(value.filter((v) => String(v) !== String(opcion.value)))
    } else {
      onChange([...value, opcion.value])
    }
  }

  const quitar = (opcion) => {
    onChange(value.filter((v) => String(v) !== String(opcion.value)))
  }

  return (
    <div className="ss" ref={contenedorRef}>
      <button
        type="button"
        id={id}
        className="ss-control"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ms-chips">
          {seleccionados.length === 0 ? (
            <span className="ss-placeholder">{placeholder}</span>
          ) : (
            seleccionados.map((o) => (
              <span className="ms-chip" key={o.value}>
                {o.label}
                <span
                  role="button"
                  aria-label={`Quitar ${o.label}`}
                  className="ms-chip-x"
                  onClick={(e) => {
                    e.stopPropagation()
                    quitar(o)
                  }}
                >
                  ×
                </span>
              </span>
            ))
          )}
        </span>
        <span className="ss-arrow">▾</span>
      </button>

      {open && (
        <div className="ss-dropdown">
          <input
            type="text"
            className="ss-search"
            placeholder="Buscar..."
            value={busqueda}
            autoFocus
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <div className="ss-options">
            {filtradas.length === 0 ? (
              <div className="ss-empty">Sin resultados</div>
            ) : (
              filtradas.map((o) => (
                <label key={o.value} className="ms-option">
                  <input
                    type="checkbox"
                    checked={estaSeleccionada(o)}
                    onChange={() => alternar(o)}
                  />
                  <span>{o.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MultiSelect
