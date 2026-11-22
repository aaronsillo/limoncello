import { useEffect, useState } from 'react'
import { createResource } from '../api/api'
import Modal from '../components/Modal'
import QuickCreateModal from '../components/QuickCreateModal'
import SearchableSelect from '../components/SearchableSelect'
import MultiSelect from '../components/MultiSelect'
import { urlDirectaImagen } from '../utils/imagenUrl'
import Pagination from '../components/Pagination'
import { usePagination } from '../components/usePagination'

const productsApi = createResource('products')
const clothesApi = createResource('clothes')
const brandsApi = createResource('brands')
const statusApi = createResource('status')
const typesApi = createResource('types')
const sectionsApi = createResource('sections')

// Mapeo del campo numérico "gender". Ajusta si en tu BD significan otra cosa.
const GENEROS = [
  { value: 1, label: 'Masculino' },
  { value: 2, label: 'Femenino' },
  { value: 3, label: 'Unisex' },
]

const etiquetaGenero = (valor) => {
  const g = GENEROS.find((x) => x.value === Number(valor))
  return g ? g.label : valor
}

// En la tabla status, type === 1 corresponde a los estados de Producto
const STATUS_TYPE_PRODUCTO = 1

// Estado por defecto al crear un producto: "Disponible" (id 9)
const PRODUCT_STATUS_DISPONIBLE = 9

const formVacio = {
  clothe_id: '',
  brand_id: 3, // Marca por defecto
  color: '',
  type_id: 2, // Tipo por defecto
  section_ids: [7], // Secciones por defecto
  status_id: PRODUCT_STATUS_DISPONIBLE,
  size: '',
  price: '',
  cost: 5, // Costo por defecto
  discount: 0, // Descuento por defecto en 0
  gender: 2, // Género por defecto: Femenino
  description: '',
  image_url: '',
  active: true,
  new: false,
}

function Productos() {
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  // Catálogos para los desplegables
  const [clothes, setClothes] = useState([])
  const [brands, setBrands] = useState([])
  const [types, setTypes] = useState([])
  const [sections, setSections] = useState([])
  const [statuses, setStatuses] = useState([])

  // Modal de crear/editar
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(formVacio)
  const [editId, setEditId] = useState(null)
  const [guardando, setGuardando] = useState(false)

  // Modal de eliminar
  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  // Creación rápida de catálogo: 'brand' | 'clothe' | 'type' | null
  const [quickCreate, setQuickCreate] = useState(null)

  // Filtros
  const [filtros, setFiltros] = useState({
    id: '',
    clothe_id: '',
    brand_id: '',
    color: '',
    type_id: '',
    section_id: '',
    size: '',
    status_id: '',
  })

  const setFiltro = (campo, valor) =>
    setFiltros((prev) => ({ ...prev, [campo]: valor }))

  const hayFiltros = Object.values(filtros).some((v) => v !== '')

  const limpiarFiltros = () =>
    setFiltros({
      id: '',
      clothe_id: '',
      brand_id: '',
      color: '',
      type_id: '',
      section_id: '',
      size: '',
      status_id: '',
    })

  // Ordenamiento: campo y dirección ('asc' | 'desc')
  const [orden, setOrden] = useState({ campo: null, dir: 'asc' })

  const ordenarPor = (campo) => {
    setOrden((prev) =>
      prev.campo === campo
        ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { campo, dir: 'asc' }
    )
  }

  // Encabezado de columna ordenable
  const thOrden = (label, campo) => {
    const activo = orden.campo === campo
    return (
      <th
        key={campo}
        className="th-sort"
        onClick={() => ordenarPor(campo)}
        title="Ordenar"
      >
        {label}
        <span className="th-sort-arrow">
          {activo ? (orden.dir === 'asc' ? ' ▲' : ' ▼') : ''}
        </span>
      </th>
    )
  }

  // Aplica filtros
  const registrosFiltrados = registros.filter((p) => {
    if (filtros.id && String(p.id) !== filtros.id.trim()) return false
    if (filtros.clothe_id && Number(p.clothe_id) !== Number(filtros.clothe_id))
      return false
    if (filtros.brand_id && Number(p.brand_id) !== Number(filtros.brand_id))
      return false
    if (filtros.type_id && Number(p.type_id) !== Number(filtros.type_id))
      return false
    if (
      filtros.section_id &&
      !(p.section_ids || []).includes(Number(filtros.section_id))
    )
      return false
    if (filtros.status_id && Number(p.status_id) !== Number(filtros.status_id))
      return false
    if (
      filtros.color &&
      !(p.color || '').toLowerCase().includes(filtros.color.trim().toLowerCase())
    )
      return false
    if (
      filtros.size &&
      !(p.size || '').toLowerCase().includes(filtros.size.trim().toLowerCase())
    )
      return false
    return true
  })

  // Aplica ordenamiento
  const registrosOrdenados = [...registrosFiltrados]
  if (orden.campo) {
    registrosOrdenados.sort((a, b) => {
      let va = a[orden.campo]
      let vb = b[orden.campo]
      // Campos numéricos
      if (
        ['id', 'price', 'cost', 'discount', 'gender', 'order_id'].includes(
          orden.campo
        )
      ) {
        va = Number(va) || 0
        vb = Number(vb) || 0
      } else {
        va = (va ?? '').toString().toLowerCase()
        vb = (vb ?? '').toString().toLowerCase()
      }
      if (va < vb) return orden.dir === 'asc' ? -1 : 1
      if (va > vb) return orden.dir === 'asc' ? 1 : -1
      return 0
    })
  }

  // Catálogo PDF con todos los productos activos
  const [generandoPdf, setGenerandoPdf] = useState(false)

  const descargarCatalogo = async () => {
    setGenerandoPdf(true)
    setError(null)
    try {
      // Import dinámico: la librería de PDF solo se carga al usar el botón
      const { generarCatalogoPdf } = await import('../utils/catalogoPdf')
      const resultado = await generarCatalogoPdf(registros, etiquetaGenero)
      if (resultado.fallidas > 0) {
        setError(
          `Catálogo generado, pero ${resultado.fallidas} imagen(es) no se pudieron cargar. ` +
            `Motivo: ${resultado.primerError}`
        )
      }
    } catch (err) {
      setError('No se pudo generar el catálogo: ' + err.message)
    } finally {
      setGenerandoPdf(false)
    }
  }

  // Paginación (sobre la lista filtrada y ordenada)
  const paginacion = usePagination(registrosOrdenados)

  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      setRegistros(await productsApi.list())
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  const cargarCatalogos = async () => {
    try {
      const [cl, br, ty, se, st] = await Promise.all([
        clothesApi.list(),
        brandsApi.list(),
        typesApi.list(),
        sectionsApi.list(),
        statusApi.list(),
      ])
      setClothes(cl)
      setBrands(br)
      setTypes(ty)
      setSections(se)
      // Solo los estados que aplican a Producto (type === 1)
      setStatuses(st.filter((s) => Number(s.type) === STATUS_TYPE_PRODUCTO))
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    cargar()
    cargarCatalogos()
  }, [])

  // Configuración de la creación rápida para marca, prenda y tipo
  const quickConfig = {
    brand: {
      titulo: 'Nueva marca',
      api: brandsApi,
      reload: async () => setBrands(await brandsApi.list()),
      campo: 'brand_id',
    },
    clothe: {
      titulo: 'Nueva prenda',
      api: clothesApi,
      reload: async () => setClothes(await clothesApi.list()),
      campo: 'clothe_id',
    },
    type: {
      titulo: 'Nuevo tipo',
      api: typesApi,
      reload: async () => setTypes(await typesApi.list()),
      campo: 'type_id',
    },
  }

  // Tras crear un registro rápido: recarga el catálogo y lo deja seleccionado
  const handleQuickCreated = async (creado) => {
    const cfg = quickConfig[quickCreate]
    if (!cfg) return
    await cfg.reload()
    setForm((prev) => ({ ...prev, [cfg.campo]: creado.id }))
    setQuickCreate(null)
  }

  const abrirNuevo = () => {
    setForm(formVacio)
    setEditId(null)
    setError(null)
    setFormOpen(true)
  }

  const abrirEditar = (registro) => {
    setForm({
      clothe_id: registro.clothe_id ?? '',
      brand_id: registro.brand_id ?? '',
      color: registro.color ?? '',
      type_id: registro.type_id ?? '',
      section_ids: registro.section_ids ?? [],
      status_id: registro.status_id ?? '',
      size: registro.size ?? '',
      price: registro.price ?? '',
      cost: registro.cost ?? '',
      discount: registro.discount ?? '',
      gender: registro.gender ?? '',
      description: registro.description ?? '',
      image_url: registro.image_url ?? '',
      active: true,
      new: registro.new ?? false,
    })
    setEditId(registro.id)
    setError(null)
    setFormOpen(true)
  }

  const cerrarForm = () => {
    if (guardando) return
    setFormOpen(false)
  }

  // Convierte '' a null y castea números antes de enviar
  const prepararPayload = () => ({
    clothe_id: form.clothe_id ? Number(form.clothe_id) : null,
    brand_id: form.brand_id ? Number(form.brand_id) : null,
    type_id: form.type_id ? Number(form.type_id) : null,
    section_ids: (form.section_ids || []).map(Number),
    status_id: form.status_id ? Number(form.status_id) : null,
    color: form.color,
    size: form.size,
    price: form.price === '' ? null : Number(form.price),
    cost: form.cost === '' ? null : Number(form.cost),
    discount: form.discount === '' ? null : Number(form.discount),
    gender: form.gender === '' ? null : Number(form.gender),
    description: form.description,
    image_url: form.image_url.trim() || null,
    active: form.active,
    new: form.new,
  })

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const payload = prepararPayload()
      if (editId != null) {
        await productsApi.update(editId, payload)
      } else {
        await productsApi.create(payload)
      }
      setFormOpen(false)
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const confirmarEliminar = async () => {
    if (!porEliminar) return
    setEliminando(true)
    setError(null)
    try {
      await productsApi.remove(porEliminar.id)
      setPorEliminar(null)
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEliminando(false)
    }
  }

  const formatPrecio = (valor) => {
    if (valor == null || valor === '') return ''
    const n = Number(valor)
    return Number.isNaN(n) ? valor : n.toFixed(2)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Productos</h1>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={descargarCatalogo}
            disabled={generandoPdf || registros.length === 0}
          >
            {generandoPdf ? 'Generando...' : 'Catálogo PDF'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={abrirNuevo}
          >
            + Nuevo producto
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="filter-field">
          <label htmlFor="f-id">ID</label>
          <input
            id="f-id"
            type="number"
            value={filtros.id}
            placeholder="ID"
            onChange={(e) => setFiltro('id', e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="f-clothe">Prenda</label>
          <SearchableSelect
            id="f-clothe"
            value={filtros.clothe_id}
            onChange={(v) => setFiltro('clothe_id', v)}
            placeholder="Todas"
            options={[
              { value: '', label: 'Todas' },
              ...clothes.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="f-brand">Marca</label>
          <SearchableSelect
            id="f-brand"
            value={filtros.brand_id}
            onChange={(v) => setFiltro('brand_id', v)}
            placeholder="Todas"
            options={[
              { value: '', label: 'Todas' },
              ...brands.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="f-color">Color</label>
          <input
            id="f-color"
            type="text"
            value={filtros.color}
            placeholder="Color"
            onChange={(e) => setFiltro('color', e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="f-type">Tipo</label>
          <SearchableSelect
            id="f-type"
            value={filtros.type_id}
            onChange={(v) => setFiltro('type_id', v)}
            placeholder="Todos"
            options={[
              { value: '', label: 'Todos' },
              ...types.map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="f-section">Sección</label>
          <SearchableSelect
            id="f-section"
            value={filtros.section_id}
            onChange={(v) => setFiltro('section_id', v)}
            placeholder="Todas"
            options={[
              { value: '', label: 'Todas' },
              ...sections.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="f-size">Talla</label>
          <input
            id="f-size"
            type="text"
            value={filtros.size}
            placeholder="Talla"
            onChange={(e) => setFiltro('size', e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="f-status">Estado</label>
          <SearchableSelect
            id="f-status"
            value={filtros.status_id}
            onChange={(v) => setFiltro('status_id', v)}
            placeholder="Todos"
            options={[
              { value: '', label: 'Todos' },
              ...statuses.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>

        {hayFiltros && (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={limpiarFiltros}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {error && !formOpen && !porEliminar && (
        <div className="alert-error">{error}</div>
      )}

      <div className="table-card">
        {cargando ? (
          <p className="table-empty">Cargando...</p>
        ) : registrosOrdenados.length === 0 ? (
          <p className="table-empty">
            {hayFiltros
              ? 'No hay productos que coincidan con los filtros.'
              : 'No hay productos todavía.'}
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {thOrden('ID', 'id')}
                {thOrden('Prenda', 'clothe_name')}
                {thOrden('Marca', 'brand_name')}
                {thOrden('Color', 'color')}
                {thOrden('Tipo', 'type_name')}
                {thOrden('Secciones', 'section_name')}
                {thOrden('Talla', 'size')}
                {thOrden('Género', 'gender')}
                {thOrden('Precio', 'price')}
                {thOrden('Costo', 'cost')}
                {thOrden('Descuento', 'discount')}
                {thOrden('Nuevo', 'new')}
                {thOrden('Estado', 'status_name')}
                {thOrden('Orden', 'order_id')}
                <th className="col-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginacion.pageItems.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.clothe_name}</td>
                  <td>{p.brand_name}</td>
                  <td>{p.color}</td>
                  <td>{p.type_name}</td>
                  <td>{p.section_name}</td>
                  <td>{p.size}</td>
                  <td>{etiquetaGenero(p.gender)}</td>
                  <td>{formatPrecio(p.price)}</td>
                  <td>{formatPrecio(p.cost)}</td>
                  <td>{formatPrecio(p.discount)}</td>
                  <td
                    aria-label={p.new ? 'Nuevo' : 'No es nuevo'}
                    title={p.new ? 'Nuevo' : 'No es nuevo'}
                  >
                    {p.new ? '✅' : '❌'}
                  </td>
                  <td>{p.status_name}</td>
                  <td>{p.order_id ? `#${p.order_id}` : 'Sin Orden'}</td>
                  <td className="col-acciones">
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => abrirEditar(p)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => setPorEliminar(p)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination {...paginacion} />

      {/* Modal crear / editar */}
      <Modal
        open={formOpen}
        title={editId != null ? 'Editar producto' : 'Nuevo producto'}
        onClose={cerrarForm}
        size="wide"
      >
        <form onSubmit={guardar}>
          {error && <div className="alert-error">{error}</div>}

          <div className="form-grid-2">
          <div className="form-field">
            <label htmlFor="clothe_id">Prenda</label>
            <div className="field-with-add">
              <SearchableSelect
                id="clothe_id"
                value={form.clothe_id}
                onChange={(v) => setForm({ ...form, clothe_id: v })}
                options={clothes.map((c) => ({ value: c.id, label: c.name }))}
              />
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => setQuickCreate('clothe')}
                title="Crear nueva prenda"
              >
                + Nueva
              </button>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="brand_id">Marca</label>
            <div className="field-with-add">
              <SearchableSelect
                id="brand_id"
                value={form.brand_id}
                onChange={(v) => setForm({ ...form, brand_id: v })}
                options={brands.map((b) => ({ value: b.id, label: b.name }))}
              />
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => setQuickCreate('brand')}
                title="Crear nueva marca"
              >
                + Nueva
              </button>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="color">Color</label>
            <input
              id="color"
              type="text"
              value={form.color}
              maxLength={50}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="size">Talla</label>
            <input
              id="size"
              type="text"
              value={form.size}
              required
              maxLength={20}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="type_id">Tipo</label>
            <div className="field-with-add">
              <SearchableSelect
                id="type_id"
                value={form.type_id}
                onChange={(v) => setForm({ ...form, type_id: v })}
                options={types.map((t) => ({ value: t.id, label: t.name }))}
              />
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => setQuickCreate('type')}
                title="Crear nuevo tipo"
              >
                + Nuevo
              </button>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="section_ids">Secciones</label>
            <MultiSelect
              id="section_ids"
              value={form.section_ids}
              onChange={(v) => setForm({ ...form, section_ids: v })}
              placeholder="Seleccione secciones..."
              options={sections.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>

          <div className="form-field">
            <label htmlFor="gender">Género</label>
            <select
              id="gender"
              value={form.gender}
              required
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="">Seleccione...</option>
              {GENEROS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="price">Precio</label>
            <input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              required
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="cost">Costo</label>
            <input
              id="cost"
              type="number"
              min="0"
              step="0.01"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="discount">Descuento</label>
            <input
              id="discount"
              type="number"
              min="0"
              step="0.01"
              value={form.discount}
              onChange={(e) => setForm({ ...form, discount: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label htmlFor="status_id">Estado</label>
            <SearchableSelect
              id="status_id"
              value={form.status_id}
              onChange={(v) => setForm({ ...form, status_id: v })}
              options={statuses.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>

          <div className="form-field">
            <label htmlFor="new">
              <input
                id="new"
                type="checkbox"
                checked={!!form.new}
                onChange={(e) => setForm({ ...form, new: e.target.checked })}
              />{' '}
              Producto nuevo
            </label>
          </div>
          </div>

          <div className="form-field">
            <label htmlFor="image_url">URL de la imagen</label>
            <input
              id="image_url"
              type="url"
              value={form.image_url}
              placeholder="https://..."
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            />
            {form.image_url.trim() && (
              <img
                key={form.image_url}
                src={urlDirectaImagen(form.image_url.trim())}
                alt="Vista previa"
                referrerPolicy="no-referrer"
                className="img-preview"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            )}
          </div>

          <div className="form-field">
            <label htmlFor="description">Descripción</label>
            <textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={cerrarForm}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal eliminar */}
      <Modal
        open={!!porEliminar}
        title="Eliminar producto"
        onClose={() => !eliminando && setPorEliminar(null)}
      >
        {error && <div className="alert-error">{error}</div>}
        <p>
          ¿Seguro que deseas eliminar el producto{' '}
          <strong>{porEliminar?.clothe_name}</strong>? Esta acción no se puede
          deshacer.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setPorEliminar(null)}
            disabled={eliminando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={confirmarEliminar}
            disabled={eliminando}
          >
            {eliminando ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </Modal>

      {/* Creación rápida de marca / prenda / tipo */}
      <QuickCreateModal
        open={!!quickCreate}
        titulo={quickCreate ? quickConfig[quickCreate].titulo : ''}
        api={quickCreate ? quickConfig[quickCreate].api : null}
        onClose={() => setQuickCreate(null)}
        onCreated={handleQuickCreated}
      />
    </div>
  )
}

export default Productos
