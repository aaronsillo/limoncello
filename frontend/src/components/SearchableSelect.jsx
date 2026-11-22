import { useEffect, useRef, useState } from 'react'

/**
 * Desplegable con buscador. Sustituto de <select> cuando hay muchas opciones.
 *
 * @param {Array}    options      [{ value, label }]
 * @param {any}      value        valor seleccionado
 * @param {function} onChange     recibe el nuevo value
 * @param {string}   placeholder  texto cuando no hay selección
 * @param {boolean}  required     marca visual (no bloquea submit del form)
 * @param {string}   id           id para el label asociado
 */
function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccione...',
  id,
}) {
  const [open, setOpen] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const contenedorRef = useRef(null)

  const seleccionada = options.find(
    (o) => String(o.value) === String(value)
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

  const elegir = (opcion) => {
    onChange(opcion.value)
    setOpen(false)
    setBusqueda('')
  }

  return (
    <div className="ss" ref={contenedorRef}>
      <button
        type="button"
        id={id}
        className="ss-control"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={seleccionada ? '' : 'ss-placeholder'}>
          {seleccionada ? seleccionada.label : placeholder}
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
                <button
                  type="button"
                  key={o.value}
                  className={`ss-option ${
                    String(o.value) === String(value) ? 'selected' : ''
                  }`}
                  onClick={() => elegir(o)}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchableSelect
