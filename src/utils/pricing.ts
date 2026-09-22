// Espejo de backend/src/shared/lib/pricing.ts — solo para mostrar una
// estimación mientras el cliente configura la solicitud. La tarifa real y
// definitiva siempre la calcula el backend al crear el servicio.
const PRECIO_POR_KM_USD = 1.25;
const DISTANCIA_MINIMA_COBRABLE_KM = 20;
const COMISION_PLATAFORMA = 0.015; // 1.5%, se SUMA a la base (no se resta)

/** Monto mínimo de saldo a favor que un cliente debe tener acumulado para poder pedir que se lo devuelvan. */
export const RETIRO_CLIENTE_MINIMO = 50;

export interface DesgloseTarifa {
  base: number;
  comision: number;
  total: number;
}

/** Base (para el gruero) + comisión de la plataforma (1.5%) = total (lo que paga el cliente). */
export function calcularDesgloseTarifa(distanciaKm: number): DesgloseTarifa {
  const distanciaCobrable = Math.max(distanciaKm, DISTANCIA_MINIMA_COBRABLE_KM);
  const base = Number((distanciaCobrable * PRECIO_POR_KM_USD).toFixed(2));
  const comision = Number((base * COMISION_PLATAFORMA).toFixed(2));
  const total = Number((base + comision).toFixed(2));
  return { base, comision, total };
}

/** Compatibilidad: solo el total (lo que ve/paga el cliente). */
export function calcularTarifaEstimada(distanciaKm: number): number {
  return calcularDesgloseTarifa(distanciaKm).total;
}
