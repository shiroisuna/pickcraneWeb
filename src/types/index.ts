export type Coordenadas = [number, number]; // [lat, lng]

export interface RutaCalculada {
  routeCoords: Coordenadas[];
  distanciaKm: number;
  duracionMin: number;
}

export interface SugerenciaLugar {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export type Rol = 'CLIENTE' | 'GRUERO' | 'ADMIN';
export type EstadoCertificacion = 'PENDIENTE' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO';
export type TipoDocumento = 'FOTO_GRUA' | 'LICENCIA' | 'CERTIFICADO_MEDICO' | 'RCV';

export interface Documento {
  id: string;
  tipo: TipoDocumento;
  archivoUrl: string;
  createdAt: string;
}

export interface GrueroPerfil {
  id: string;
  estadoCertificacion: EstadoCertificacion;
  tipoGrua: string;
  placa: string;
  direccion: string;
  latitud: number;
  longitud: number;
  activo: boolean;
  saldoPendientePago?: number;
  documentos?: Documento[];
  usuario?: { nombre: string; email: string; telefono?: string | null };
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  telefono?: string | null;
  saldoAFavor: number;
  fotoPerfilUrl?: string | null;
  cedula?: string | null;
  direccion?: string | null;
  emailVerificado?: boolean;
  grueroPerfil: GrueroPerfil | null;
}

export type MetodoPago = 'EFECTIVO' | 'PAGO_MOVIL' | 'SALDO';
export type EstadoPago = 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO';

export interface Pago {
  id: string;
  metodo: MetodoPago;
  estado: EstadoPago;
  monto: number;
  referencia?: string | null;
  montoEntregado?: number | null;
  vuelto?: number | null;
  comisionPlataforma?: number | null;
}

export type EstadoServicio =
  | 'PENDIENTE_PAGO'
  | 'SOLICITADO'
  | 'ASIGNADO'
  | 'EN_CAMINO'
  | 'LLEGADA'
  | 'EN_TRASLADO'
  | 'COMPLETADO'
  | 'CANCELADO';

export interface Calificacion {
  id: string;
  estrellas: number;
  comentario?: string | null;
  createdAt: string;
}

export interface Mensaje {
  id: string;
  servicioId: string;
  autorId: string;
  texto: string;
  createdAt: string;
}

export interface RendimientoGruero {
  grueroPerfilId: string;
  nombre: string;
  placa: string;
  serviciosCompletados: number;
  tiempoPromedioLlegadaMin: number | null;
  tiempoPromedioRemolqueMin: number | null;
  tiempoPromedioTrasladoMin: number | null;
  calificacionPromedio: number | null;
}

export interface Membresia {
  id: string;
  monto: number;
  referencia?: string | null;
  estado: EstadoPago;
  createdAt: string;
  gruero: {
    usuario: { nombre: string; email: string };
  };
}

export interface MovimientoAdmin {
  id: string;
  tipo: 'PAGO_SERVICIO' | 'MEMBRESIA_GRUERO' | 'PAGO_A_GRUERO';
  descripcion: string;
  usuario: string;
  monto: number;
  fecha: string;
}

/** Solicitud de pago/retiro pendiente (de un gruero o de un cliente) que el admin debe procesar. */
export interface SaldoPendienteGruero {
  id: string;
  monto: number;
  banco: string;
  telefono: string;
  cedulaORif: string;
  createdAt: string;
  gruero?: {
    tipoGrua: string;
    placa: string;
    usuario: { nombre: string; email: string };
  } | null;
  cliente?: { nombre: string; email: string } | null;
}

/** Lo que ve el admin en la pestaña de Servicios: el Servicio con el cliente incluido. */
export interface ServicioAdmin extends Servicio {
  cliente: { nombre: string; email: string };
}

export interface Servicio {
  id: string;
  clienteId: string;
  origenLat: number;
  origenLng: number;
  origenDireccion: string;
  destinoLat: number;
  destinoLng: number;
  destinoDireccion: string;
  distanciaKm?: number | null;
  duracionMin?: number | null;
  tarifaEstimada?: number | null;
  estado: EstadoServicio;
  createdAt: string;
  horaAsignado?: string | null;
  horaEnCamino?: string | null;
  horaLlegada?: string | null;
  horaEnTraslado?: string | null;
  horaCompletado?: string | null;
  fotoEnganche?: string | null;
  pago?: Pago | null;
  calificacion?: Calificacion | null;
  gruero?: {
    id: string;
    tipoGrua: string;
    placa: string;
    usuario: { nombre: string; telefono?: string | null };
    ultimaLat?: number | null;
    ultimaLng?: number | null;
    ultimaActualizacion?: string | null;
  } | null;
}

/** Gruero activo y aprobado que el cliente puede elegir directamente (con su foto de grúa si la subió). */
export interface GrueroActivo {
  id: string;
  tipoGrua: string;
  placa: string;
  latitud: number;
  longitud: number;
  ultimaLat?: number | null;
  ultimaLng?: number | null;
  usuario: { nombre: string; telefono?: string | null };
  documentos: Documento[];
}

export interface DatosPagoMovil {
  banco: string;
  telefono: string;
  cedulaORif: string;
}

/** Lo que ve el admin al listar pagos móviles pendientes: el Pago con su Servicio anidado. */
export interface PagoConServicio extends Pago {
  servicioId: string;
  createdAt: string;
  servicio: Servicio & {
    cliente: { nombre: string; email: string; telefono?: string | null };
  };
}
