import { api } from './api';
import type { Servicio } from '../types';

export interface CrearServicioInput {
  grueroPerfilId: string;
  origenLat: number;
  origenLng: number;
  origenDireccion: string;
  destinoLat: number;
  destinoLng: number;
  destinoDireccion: string;
  distanciaKm?: number;
  duracionMin?: number;
  metodoPago: 'EFECTIVO' | 'PAGO_MOVIL' | 'SALDO';
  /** Requerido si metodoPago es EFECTIVO (para calcular el vuelto). */
  montoEntregado?: number;
  /** Requerido si metodoPago es PAGO_MOVIL (número de referencia de la transferencia ya hecha). */
  referenciaPago?: string;
}

/** El cliente crea la solicitud dirigida a un gruero específico que eligió. */
export async function crearServicio(datos: CrearServicioInput): Promise<Servicio> {
  const { data } = await api.post('/servicio', datos);
  return data;
}

/** Lo que ve el gruero: solicitudes dirigidas a él, pendientes de aceptar. */
export async function listarDisponibles(): Promise<Servicio[]> {
  const { data } = await api.get('/servicio/disponibles');
  return data;
}

export async function aceptarServicio(id: string): Promise<Servicio> {
  const { data } = await api.post(`/servicio/${id}/aceptar`);
  return data;
}

export async function cambiarEstadoServicio(
  id: string,
  estado: 'EN_CAMINO' | 'LLEGADA' | 'COMPLETADO' | 'CANCELADO'
): Promise<Servicio> {
  const { data } = await api.patch(`/servicio/${id}/estado`, { estado });
  return data;
}

/** Paso a EN_TRASLADO, con foto opcional del vehículo ya enganchado/montado. */
export async function iniciarTraslado(id: string, archivo?: File): Promise<Servicio> {
  const formData = new FormData();
  if (archivo) formData.append('archivo', archivo);
  const { data } = await api.post(`/servicio/${id}/traslado`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function calificarServicio(id: string, estrellas: number, comentario?: string) {
  const { data } = await api.post(`/servicio/${id}/calificar`, { estrellas, comentario });
  return data;
}

export async function obtenerMensajes(id: string): Promise<import('../types').Mensaje[]> {
  const { data } = await api.get(`/servicio/${id}/mensajes`);
  return data;
}

/** Historial del usuario actual (cliente ve los suyos, gruero los que le asignaron). */
export async function obtenerMisServicios(): Promise<Servicio[]> {
  const { data } = await api.get('/servicio/mis-servicios');
  return data;
}

/** Refresco puntual de un servicio por id — usado como respaldo del socket (polling). */
export async function obtenerServicioPorId(id: string): Promise<Servicio> {
  const { data } = await api.get(`/servicio/${id}`);
  return data;
}
