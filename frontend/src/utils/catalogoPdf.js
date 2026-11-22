import { jsPDF } from 'jspdf'
import logo from '../assets/images/limon.png'

// Color de marca del catálogo (RGB). Cámbialo aquí para todo el PDF.
const COLOR_MARCA = [170, 59, 255]

// true = el catálogo incluye solo productos Disponibles (estado 9)
const SOLO_DISPONIBLES = false
const STATUS_DISPONIBLE = 9

// Las imágenes se reducen a este tamaño máximo (px) para que el PDF no pese de más
const MAX_PX = 600
const DESCARGAS_SIMULTANEAS = 6

// ===== Medidas de página y tarjetas (mm) =====
const ANCHO_PAGINA = 210
const ALTO_PAGINA = 297
const MARGEN = 12
const COLUMNAS = 3
const SEPARACION = 6
const CARD_W = (ANCHO_PAGINA - 2 * MARGEN - SEPARACION * (COLUMNAS - 1)) / COLUMNAS
const IMG_H = 46
const CARD_H = IMG_H + 29
const LIMITE_INFERIOR = ALTO_PAGINA - 16
const Y_PRIMERA_PAGINA = 34
const Y_OTRAS_PAGINAS = 14

const money = (n) => `Q.${(Number(n) || 0).toFixed(2)}`

const cargarImagen = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

/**
 * Pide la imagen del producto al backend y la convierte a JPEG (reducida).
 * Pasar por un canvas permite usar cualquier formato que el navegador soporte.
 */
async function descargarImagenProducto(id) {
  const res = await fetch(`/api/products/${id}/image`)
  if (!res.ok) {
    // El backend explica la causa en { error }
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  try {
    const img = await cargarImagen(url)
    const escala = Math.min(
      1,
      MAX_PX / Math.max(img.naturalWidth, img.naturalHeight)
    )
    const w = Math.max(1, Math.round(img.naturalWidth * escala))
    const h = Math.max(1, Math.round(img.naturalHeight * escala))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    return { data: canvas.toDataURL('image/jpeg', 0.85), w, h }
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Ejecuta fn sobre cada elemento con un máximo de tareas en paralelo
async function mapConLimite(items, limite, fn) {
  const resultados = new Array(items.length)
  let siguiente = 0
  const worker = async () => {
    while (true) {
      const i = siguiente++
      if (i >= items.length) return
      resultados[i] = await fn(items[i])
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limite, items.length) }, worker)
  )
  return resultados
}

// Recorta el texto con "..." para que quepa en el ancho dado (usa la fuente actual)
function ajustar(doc, texto, ancho) {
  let t = String(texto ?? '')
  if (doc.getTextWidth(t) <= ancho) return t
  while (t.length > 1 && doc.getTextWidth(t + '...') > ancho) {
    t = t.slice(0, -1)
  }
  return t + '...'
}

function dibujarPrecio(doc, x, y, producto) {
  const precio = Number(producto.price) || 0
  const descuento = Number(producto.discount) || 0
  const final = precio - descuento

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...COLOR_MARCA)
  const textoFinal = money(final)
  doc.text(textoFinal, x, y)

  // Con descuento: precio original tachado junto al precio final
  if (descuento > 0) {
    const xOriginal = x + doc.getTextWidth(textoFinal) + 3
    const textoOriginal = money(precio)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(150)
    doc.text(textoOriginal, xOriginal, y)
    const ancho = doc.getTextWidth(textoOriginal)
    doc.setDrawColor(150)
    doc.setLineWidth(0.2)
    doc.line(xOriginal, y - 1, xOriginal + ancho, y - 1)
  }
}

function dibujarTarjeta(doc, x, y, producto, imagen, etiquetaGenero) {
  // Zona de la imagen
  doc.setFillColor(248, 247, 250)
  doc.rect(x + 0.5, y + 0.5, CARD_W - 1, IMG_H - 1, 'F')

  if (imagen) {
    const cajaW = CARD_W - 4
    const cajaH = IMG_H - 4
    const escala = Math.min(cajaW / imagen.w, cajaH / imagen.h)
    const dw = imagen.w * escala
    const dh = imagen.h * escala
    doc.addImage(
      imagen.data,
      'JPEG',
      x + (CARD_W - dw) / 2,
      y + (IMG_H - dh) / 2,
      dw,
      dh
    )
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(170)
    doc.text('Sin imagen', x + CARD_W / 2, y + IMG_H / 2, { align: 'center' })
  }

  // Borde de la tarjeta
  doc.setDrawColor(225)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, CARD_W, CARD_H, 2, 2, 'S')

  // Textos
  const px = x + 3
  const maxW = CARD_W - 6
  let ty = y + IMG_H + 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30)
  doc.text(ajustar(doc, producto.clothe_name || 'Producto', maxW), px, ty)

  ty += 4.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(90)
  const marcaGenero = [producto.brand_name, etiquetaGenero(producto.gender)]
    .filter(Boolean)
    .join(' · ')
  doc.text(ajustar(doc, marcaGenero, maxW), px, ty)

  ty += 4
  const tallaColor = [
    producto.size && `Talla ${producto.size}`,
    producto.color && `Color ${producto.color}`,
  ]
    .filter(Boolean)
    .join(' · ')
  doc.text(ajustar(doc, tallaColor, maxW), px, ty)

  ty += 4
  doc.setFontSize(7.5)
  doc.setTextColor(150)
  doc.text(`Ref. ${producto.id}`, px, ty)

  dibujarPrecio(doc, px, y + CARD_H - 4, producto)
}

/**
 * Genera y descarga un catálogo en PDF para clientes: tarjetas con imagen.
 * Las imágenes salen de la URL guardada en cada producto (image_url).
 *
 * @param {Array}    productos       Productos tal como los devuelve /api/products
 * @param {function} etiquetaGenero  Convierte el número de género en texto
 * @returns {{ total: number, sinUrl: number, fallidas: number }}
 */
export async function generarCatalogoPdf(productos, etiquetaGenero) {
  const lista = productos
    .filter(
      (p) => !SOLO_DISPONIBLES || Number(p.status_id) === STATUS_DISPONIBLE
    )
    .sort(
      (a, b) =>
        (a.clothe_name || '').localeCompare(b.clothe_name || '') ||
        (a.brand_name || '').localeCompare(b.brand_name || '')
    )

  if (lista.length === 0) {
    throw new Error('No hay productos para el catálogo')
  }

  // Descarga de imágenes (en paralelo, con límite)
  let fallidas = 0
  let primerError = null
  const imagenes = await mapConLimite(
    lista,
    DESCARGAS_SIMULTANEAS,
    async (p) => {
      if (!p.image_url) return null
      try {
        return await descargarImagenProducto(p.id)
      } catch (err) {
        fallidas++
        primerError = primerError ?? err.message
        return null
      }
    }
  )
  const sinUrl = lista.filter((p) => !p.image_url).length

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // ===== Encabezado (primera página) =====
  let xTitulo = MARGEN
  try {
    const img = await cargarImagen(logo)
    doc.addImage(img, 'PNG', MARGEN, 10, 14, 14)
    xTitulo = MARGEN + 18
  } catch {
    // Si el logo no carga, el catálogo se genera igual sin él
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...COLOR_MARCA)
  doc.text('LIMONCELLO', xTitulo, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(90)
  doc.text('Catálogo de productos', xTitulo, 24)

  doc.setFontSize(10)
  doc.text(new Date().toLocaleDateString(), ANCHO_PAGINA - MARGEN, 16, {
    align: 'right',
  })
  doc.text(`${lista.length} productos`, ANCHO_PAGINA - MARGEN, 22, {
    align: 'right',
  })

  doc.setDrawColor(...COLOR_MARCA)
  doc.setLineWidth(0.6)
  doc.line(MARGEN, 28, ANCHO_PAGINA - MARGEN, 28)

  // ===== Tarjetas =====
  let y = Y_PRIMERA_PAGINA
  lista.forEach((producto, i) => {
    const columna = i % COLUMNAS
    if (columna === 0 && i > 0) {
      y += CARD_H + SEPARACION
      if (y + CARD_H > LIMITE_INFERIOR) {
        doc.addPage()
        y = Y_OTRAS_PAGINAS
      }
    }
    const x = MARGEN + columna * (CARD_W + SEPARACION)
    dibujarTarjeta(doc, x, y, producto, imagenes[i], etiquetaGenero)
  })

  // ===== Pie con número de página =====
  const totalPaginas = doc.internal.getNumberOfPages()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(130)
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.text(`Página ${i} de ${totalPaginas}`, ANCHO_PAGINA / 2, ALTO_PAGINA - 8, {
      align: 'center',
    })
  }

  const fecha = new Date().toLocaleDateString('en-CA')
  doc.save(`catalogo-limoncello-${fecha}.pdf`)

  return { total: lista.length, sinUrl, fallidas, primerError }
}
