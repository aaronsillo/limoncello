// Utilidades para enviar cotizaciones por WhatsApp con un enlace wa.me.

const CODIGO_PAIS = '502' // Guatemala

/**
 * Deja solo dígitos y antepone el 502 si el número tiene 8 dígitos.
 * Devuelve '' si no hay teléfono. Otros largos se respetan tal cual
 * (por ejemplo un número que ya trae código de país).
 */
export function normalizarTelefono(telefono) {
  const digitos = String(telefono ?? '').replace(/\D/g, '')
  if (!digitos) return ''
  return digitos.length === 8 ? CODIGO_PAIS + digitos : digitos
}

// Mensaje fijo que se envía junto con la imagen de la cotización.
const MENSAJE = `Hola! 👋🏻✨

Te envio tu total, me confirmas que todo este correcto, de ser así puedes hacer la transferencia a la cuenta que te compartimos, no olvides enviarnos tu comprobante 😊

¿Me podrías confirmar si deseas abrir tu casillero o prefieres que programemos tu envío? ✨😁🍋`

/**
 * Arma el enlace de WhatsApp con el mensaje ya escrito.
 * @param {object} orden  Orden con customer_phone
 * @returns {string|null} URL, o null si el cliente no tiene teléfono
 */
export function enlaceWhatsapp(orden) {
  const telefono = normalizarTelefono(orden?.customer_phone)
  if (!telefono) return null
  // Se apunta directo a WhatsApp Web (sin pasar por la redirección de wa.me),
  // que es donde se pierden los emojis.
  return `https://web.whatsapp.com/send?phone=${telefono}&text=${encodeURIComponent(MENSAJE)}`
}

/** Abre WhatsApp en una pestaña nueva. Devuelve false si no hay teléfono. */
export function abrirWhatsapp(orden) {
  const url = enlaceWhatsapp(orden)
  if (!url) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}
