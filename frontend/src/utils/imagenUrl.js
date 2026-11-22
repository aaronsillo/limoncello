/**
 * Convierte un enlace de "compartir" de Google Drive en un enlace directo a la
 * imagen (para la vista previa). Cualquier otra URL se devuelve igual.
 * Funciona solo si el archivo está compartido como "Cualquier persona con el enlace".
 */
export function urlDirectaImagen(url) {
  const m =
    url.match(/drive\.google\.com\/file\/d\/([\w-]+)/) ||
    url.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]+)/)
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000` : url
}
