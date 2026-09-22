import { api } from './api';
import type { EstadoCertificacion, GrueroPerfil } from '../types';

export async function listarGruerosPendientes(estado: EstadoCertificacion = 'EN_REVISION'): Promise<GrueroPerfil[]> {
  const { data } = await api.get('/admin/grueros', { params: { estado } });
  return data;
}

export async function obtenerDetalleGruero(id: string): Promise<GrueroPerfil> {
  const { data } = await api.get(`/admin/grueros/${id}`);
  return data;
}

export async function cambiarCertificacion(id: string, estado: 'APROBADO' | 'RECHAZADO'): Promise<GrueroPerfil> {
  const { data } = await api.patch(`/admin/grueros/${id}/certificacion`, { estado });
  return data;
}

/** Pagos móviles con referencia declarada, pendientes de verificar contra el banco. */
export async function listarPagosPendientes(): Promise<import('../types').PagoConServicio[]> {
  const { data } = await api.get('/admin/pagos');
  return data;
}

/** pagoId, no servicioId — el backend identifica el Pago por su propio id. */
export async function confirmarPago(pagoId: string, aprobar: boolean): Promise<import('../types').Servicio> {
  const { data } = await api.patch(`/admin/pagos/${pagoId}/confirmar`, { aprobar });
  return data;
}

/** Rendimiento por gruero: tiempos promedio por etapa y calificación promedio (sobre servicios completados). */
export async function obtenerRendimiento(): Promise<import('../types').RendimientoGruero[]> {
  const { data } = await api.get('/admin/rendimiento');
  return data;
}

/** Datos de pago móvil de la app (editables por el admin). */
export async function obtenerConfigPagoMovil(): Promise<import('../types').DatosPagoMovil> {
  const { data } = await api.get('/admin/pago-movil');
  return data;
}

export async function actualizarConfigPagoMovil(
  datos: import('../types').DatosPagoMovil
): Promise<import('../types').DatosPagoMovil> {
  const { data } = await api.patch('/admin/pago-movil', datos);
  return data;
}

/** Membresías mensuales de gruero con referencia declarada, pendientes de confirmar. */
export async function listarMembresiasPendientes(): Promise<import('../types').Membresia[]> {
  const { data } = await api.get('/admin/membresias');
  return data;
}

export async function confirmarMembresia(membresiaId: string, aprobar: boolean): Promise<import('../types').Membresia> {
  const { data } = await api.patch(`/admin/membresias/${membresiaId}/confirmar`, { aprobar });
  return data;
}

/** Movimientos confirmados (pagos de servicios + membresías de gruero) para el módulo de movimientos. */
export async function listarMovimientos(): Promise<import('../types').MovimientoAdmin[]> {
  const { data } = await api.get('/admin/movimientos');
  return data;
}

/** Grueros con saldo pendiente de que la plataforma les pague (Pago Móvil/Saldo ya completados). */
export async function listarSaldosPendientes(): Promise<import('../types').SaldoPendienteGruero[]> {
  const { data } = await api.get('/admin/saldos-pendientes');
  return data;
}

export async function liquidarGruero(grueroPerfilId: string) {
  const { data } = await api.post(`/admin/saldos-pendientes/${grueroPerfilId}/liquidar`);
  return data;
}

/** Recalcula desde cero el saldo pendiente de todos los grueros (corrige datos históricos si hizo falta). */
export async function recalcularSaldosPendientes() {
  const { data } = await api.post('/admin/saldos-pendientes/recalcular');
  return data;
}

/** Resumen de todos los servicios: quién lo pidió, quién lo hizo, ruta y tiempos. */
export async function listarServiciosAdmin(): Promise<import('../types').ServicioAdmin[]> {
  const { data } = await api.get('/admin/servicios');
  return data;
}

/** Grueros activos y aprobados, para el mapa del admin. */
export async function listarGruerosActivosMapa(): Promise<import('../types').GrueroActivo[]> {
  const { data } = await api.get('/admin/grueros-activos');
  return data;
}
