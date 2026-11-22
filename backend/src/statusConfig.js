// IDs de estados (tabla status). Centralizados para la lógica de negocio.
// Si cambian en la BD, actualízalos aquí.

// Estados de PRODUCTO (type = 1)
export const PRODUCT_STATUS = {
  DISPONIBLE: 9,
  RESERVADO: 10,
  VENDIDO: 11,
  DESCONTINUADO: 13,
}

// Estados de ORDEN (type = 2)
export const ORDER_STATUS = {
  CREADO: 1,
  COTIZADO: 2,
  PAGADO: 3,
  PENDIENTE_DE_PAGO: 4,
  ENVIADO: 5,
  ENTREGADO: 6,
  PENDIENTE: 7,
  CANCELADO: 8,
}

// Estados de orden que implican que sus productos están VENDIDOS
export const ORDER_STATUSES_SOLD = [
  ORDER_STATUS.PAGADO,
  ORDER_STATUS.ENVIADO,
  ORDER_STATUS.ENTREGADO,
]

// Tipo de balance que representa un INGRESO (ver página Balances)
export const BALANCE_TYPE_INGRESO = 1

// Estado de CASILLERO "Cerrado" (type = 5)
export const LOCKER_STATUS_CERRADO = 16

/**
 * Dado el estado de una orden, devuelve el estado que deben tener sus productos.
 * - Si la orden está Cancelada -> DISPONIBLE (el producto se libera)
 * - Si la orden está en un estado "vendido" -> VENDIDO
 * - En cualquier otro caso (asignados a una orden) -> RESERVADO
 */
export function productStatusForOrder(orderStatusId) {
  if (Number(orderStatusId) === ORDER_STATUS.CANCELADO) {
    return PRODUCT_STATUS.DISPONIBLE
  }
  return ORDER_STATUSES_SOLD.includes(Number(orderStatusId))
    ? PRODUCT_STATUS.VENDIDO
    : PRODUCT_STATUS.RESERVADO
}
