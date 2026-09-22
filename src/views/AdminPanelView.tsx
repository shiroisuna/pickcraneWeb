import { useEffect, useState, useRef } from 'react';
import { ShieldCheck, XCircle, LogOut, FileText, RefreshCcw, Landmark, BarChart3, Star, Settings, Receipt, Save, Route, MapPin, Wallet } from 'lucide-react';
import logo from '../assets/logo.png';
import { MapaGruerosActivos } from '../components/MapaGruerosActivos';
import {
  listarGruerosPendientes,
  cambiarCertificacion,
  listarPagosPendientes,
  confirmarPago,
  obtenerRendimiento,
  obtenerConfigPagoMovil,
  actualizarConfigPagoMovil,
  listarMembresiasPendientes,
  confirmarMembresia,
  listarMovimientos,
  listarServiciosAdmin,
  listarGruerosActivosMapa,
  listarSaldosPendientes,
  liquidarGruero,
  recalcularSaldosPendientes,
} from '../services/admin.service';
import { cerrarSesion } from '../services/auth.service';
import { urlArchivo } from '../utils/archivos';
import { reproducirNotificacion } from '../utils/sonido';
import type {
  EstadoCertificacion,
  GrueroPerfil,
  TipoDocumento,
  PagoConServicio,
  RendimientoGruero,
  DatosPagoMovil,
  Membresia,
  MovimientoAdmin,
  ServicioAdmin,
  EstadoServicio,
  GrueroActivo,
  SaldoPendienteGruero,
} from '../types';

interface AdminPanelViewProps {
  onCerrarSesion: () => void;
}

const ETIQUETAS_DOCUMENTO: Record<TipoDocumento, string> = {
  FOTO_GRUA: 'Foto de la grúa',
  LICENCIA: 'Licencia',
  CERTIFICADO_MEDICO: 'Cert. médico',
  RCV: 'RCV',
};

const FILTROS: { valor: EstadoCertificacion; etiqueta: string }[] = [
  { valor: 'EN_REVISION', etiqueta: 'En revisión' },
  { valor: 'APROBADO', etiqueta: 'Aprobados' },
  { valor: 'RECHAZADO', etiqueta: 'Rechazados' },
  { valor: 'PENDIENTE', etiqueta: 'Pendientes (sin documentos)' },
];

type Seccion = 'certificaciones' | 'pagos' | 'rendimiento' | 'membresias' | 'pago-movil' | 'movimientos' | 'servicios' | 'mapa-gruas' | 'saldos-pendientes';

const ETIQUETA_ESTADO_SERVICIO: Record<EstadoServicio, string> = {
  PENDIENTE_PAGO: 'Verificando pago',
  SOLICITADO: 'Solicitado',
  ASIGNADO: 'Asignado',
  EN_CAMINO: 'En camino',
  LLEGADA: 'Llegó',
  EN_TRASLADO: 'En traslado',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
};

const COLOR_ESTADO_SERVICIO: Record<EstadoServicio, string> = {
  PENDIENTE_PAGO: 'text-purple-400 bg-purple-950/30 border-purple-800/50',
  SOLICITADO: 'text-yellow-400 bg-yellow-950/30 border-yellow-800/50',
  ASIGNADO: 'text-blue-400 bg-blue-950/30 border-blue-800/50',
  EN_CAMINO: 'text-blue-400 bg-blue-950/30 border-blue-800/50',
  LLEGADA: 'text-green-400 bg-green-950/30 border-green-800/50',
  EN_TRASLADO: 'text-green-400 bg-green-950/30 border-green-800/50',
  COMPLETADO: 'text-gray-400 bg-gray-800/40 border-gray-700',
  CANCELADO: 'text-red-400 bg-red-950/30 border-red-800/50',
};

const inputClass =
  'w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-brand-yellow transition';
const labelClass = 'text-xs font-semibold text-gray-300 mb-1.5 block';

export default function AdminPanelView({ onCerrarSesion }: AdminPanelViewProps) {
  const [seccion, setSeccion] = useState<Seccion>('certificaciones');

  const [filtro, setFiltro] = useState<EstadoCertificacion>('EN_REVISION');
  const [grueros, setGrueros] = useState<GrueroPerfil[]>([]);
  const [cargandoGrueros, setCargandoGrueros] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const [pagos, setPagos] = useState<PagoConServicio[]>([]);
  const [cargandoPagos, setCargandoPagos] = useState(true);
  const [procesandoPagoId, setProcesandoPagoId] = useState<string | null>(null);

  const [rendimiento, setRendimiento] = useState<RendimientoGruero[]>([]);
  const [cargandoRendimiento, setCargandoRendimiento] = useState(true);

  const [membresias, setMembresias] = useState<Membresia[]>([]);
  const [cargandoMembresias, setCargandoMembresias] = useState(true);
  const [procesandoMembresiaId, setProcesandoMembresiaId] = useState<string | null>(null);

  const [datosPagoMovil, setDatosPagoMovil] = useState<DatosPagoMovil>({ banco: '', telefono: '', cedulaORif: '' });
  const [cargandoConfigPago, setCargandoConfigPago] = useState(true);
  const [guardandoConfigPago, setGuardandoConfigPago] = useState(false);
  const [configPagoGuardada, setConfigPagoGuardada] = useState(false);

  const [movimientos, setMovimientos] = useState<MovimientoAdmin[]>([]);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(true);

  const [servicios, setServiciosAdmin] = useState<ServicioAdmin[]>([]);
  const [cargandoServicios, setCargandoServicios] = useState(true);

  const [gruerosActivosMapa, setGruerosActivosMapa] = useState<GrueroActivo[]>([]);
  const [cargandoMapaGruas, setCargandoMapaGruas] = useState(true);

  const [saldosPendientes, setSaldosPendientes] = useState<SaldoPendienteGruero[]>([]);
  const [cargandoSaldos, setCargandoSaldos] = useState(true);
  const [liquidandoId, setLiquidandoId] = useState<string | null>(null);

  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const cargarGrueros = async (estado: EstadoCertificacion) => {
    setCargandoGrueros(true);
    try {
      setGrueros(await listarGruerosPendientes(estado));
      setErrorCarga(null);
    } catch {
      setErrorCarga('No se pudo cargar certificaciones. Revisa que el backend esté corriendo y migrado.');
    } finally {
      setCargandoGrueros(false);
    }
  };

  const cargarPagos = async () => {
    setCargandoPagos(true);
    try {
      setPagos(await listarPagosPendientes());
      setErrorCarga(null);
    } catch {
      setErrorCarga('No se pudo cargar pagos móviles. Revisa que el backend esté corriendo y migrado.');
    } finally {
      setCargandoPagos(false);
    }
  };

  const cargarRendimiento = async () => {
    setCargandoRendimiento(true);
    try {
      setRendimiento(await obtenerRendimiento());
      setErrorCarga(null);
    } catch {
      setErrorCarga('No se pudo cargar rendimiento. Revisa que el backend esté corriendo y migrado.');
    } finally {
      setCargandoRendimiento(false);
    }
  };

  const cargarMembresias = async () => {
    setCargandoMembresias(true);
    try {
      setMembresias(await listarMembresiasPendientes());
      setErrorCarga(null);
    } catch {
      setErrorCarga('No se pudo cargar membresías. Revisa que el backend esté corriendo y migrado.');
    } finally {
      setCargandoMembresias(false);
    }
  };

  const cargarConfigPago = async () => {
    setCargandoConfigPago(true);
    try {
      setDatosPagoMovil(await obtenerConfigPagoMovil());
      setErrorCarga(null);
    } catch {
      setErrorCarga('No se pudo cargar la configuración de pago móvil.');
    } finally {
      setCargandoConfigPago(false);
    }
  };

  const cargarMovimientos = async () => {
    setCargandoMovimientos(true);
    try {
      setMovimientos(await listarMovimientos());
      setErrorCarga(null);
    } catch {
      setErrorCarga('No se pudieron cargar los movimientos. Revisa que el backend esté corriendo y migrado con los últimos cambios (npx prisma migrate dev).');
    } finally {
      setCargandoMovimientos(false);
    }
  };

  const cargarServiciosAdmin = async () => {
    setCargandoServicios(true);
    try {
      setServiciosAdmin(await listarServiciosAdmin());
      setErrorCarga(null);
    } catch {
      setErrorCarga('No se pudo cargar el resumen de servicios.');
    } finally {
      setCargandoServicios(false);
    }
  };

  const cargarMapaGruas = async () => {
    setCargandoMapaGruas(true);
    try {
      setGruerosActivosMapa(await listarGruerosActivosMapa());
      setErrorCarga(null);
    } catch {
      setErrorCarga('No se pudo cargar el mapa de grúas.');
    } finally {
      setCargandoMapaGruas(false);
    }
  };

  const cargarSaldosPendientes = async () => {
    setCargandoSaldos(true);
    try {
      setSaldosPendientes(await listarSaldosPendientes());
      setErrorCarga(null);
    } catch {
      setErrorCarga('No se pudieron cargar las solicitudes de pago. Revisa que el backend esté migrado con los últimos cambios (npx prisma migrate dev).');
    } finally {
      setCargandoSaldos(false);
    }
  };

  const resolverLiquidar = async (grueroPerfilId: string) => {
    setLiquidandoId(grueroPerfilId);
    try {
      await liquidarGruero(grueroPerfilId);
      setSaldosPendientes((prev) => prev.filter((g) => g.id !== grueroPerfilId));
    } finally {
      setLiquidandoId(null);
    }
  };

  const [recalculando, setRecalculando] = useState(false);
  const handleRecalcularSaldos = async () => {
    setRecalculando(true);
    try {
      await recalcularSaldosPendientes();
      await cargarSaldosPendientes();
    } catch {
      setErrorCarga('No se pudo recalcular los saldos.');
    } finally {
      setRecalculando(false);
    }
  };

  useEffect(() => {
    if (seccion === 'certificaciones') cargarGrueros(filtro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, seccion]);

  useEffect(() => {
    if (seccion === 'pagos') cargarPagos();
    else if (seccion === 'rendimiento') cargarRendimiento();
    else if (seccion === 'membresias') cargarMembresias();
    else if (seccion === 'pago-movil') cargarConfigPago();
    else if (seccion === 'movimientos') cargarMovimientos();
    else if (seccion === 'servicios') cargarServiciosAdmin();
    else if (seccion === 'mapa-gruas') cargarMapaGruas();
    else if (seccion === 'saldos-pendientes') cargarSaldosPendientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seccion]);

  // Auto-refresco cada 10s de la sección activa (menos la de configuración,
  // que no tiene sentido refrescar mientras se está editando un formulario).
  useEffect(() => {
    const intervalo = window.setInterval(() => {
      if (seccion === 'certificaciones') cargarGrueros(filtro);
      else if (seccion === 'pagos') cargarPagos();
      else if (seccion === 'rendimiento') cargarRendimiento();
      else if (seccion === 'membresias') cargarMembresias();
      else if (seccion === 'movimientos') cargarMovimientos();
      else if (seccion === 'servicios') cargarServiciosAdmin();
      else if (seccion === 'mapa-gruas') cargarMapaGruas();
      else if (seccion === 'saldos-pendientes') cargarSaldosPendientes();
    }, 10000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seccion, filtro]);

  // Conteo de pendientes en segundo plano (independiente de qué pestaña esté
  // activa), para que los badges de "Pagos" y "Membresías" se mantengan al
  // día y suene un beep apenas aparece algo nuevo por confirmar.
  const prevPendientesRef = useRef<number | null>(null);
  useEffect(() => {
    const revisar = async () => {
      const [p, m] = await Promise.all([listarPagosPendientes(), listarMembresiasPendientes()]);
      setPagos(p);
      setMembresias(m);
      const total = p.length + m.length;
      if (prevPendientesRef.current !== null && total > prevPendientesRef.current) {
        reproducirNotificacion();
      }
      prevPendientesRef.current = total;
    };
    revisar();
    const intervalo = window.setInterval(revisar, 10000);
    return () => clearInterval(intervalo);
  }, []);

  const resolverCertificacion = async (id: string, estado: 'APROBADO' | 'RECHAZADO') => {
    setProcesandoId(id);
    try {
      await cambiarCertificacion(id, estado);
      setGrueros((prev) => prev.filter((g) => g.id !== id));
    } finally {
      setProcesandoId(null);
    }
  };

  const resolverPago = async (pagoId: string, aprobar: boolean) => {
    setProcesandoPagoId(pagoId);
    try {
      await confirmarPago(pagoId, aprobar);
      setPagos((prev) => prev.filter((p) => p.id !== pagoId));
    } finally {
      setProcesandoPagoId(null);
    }
  };

  const resolverMembresia = async (membresiaId: string, aprobar: boolean) => {
    setProcesandoMembresiaId(membresiaId);
    try {
      await confirmarMembresia(membresiaId, aprobar);
      setMembresias((prev) => prev.filter((m) => m.id !== membresiaId));
    } finally {
      setProcesandoMembresiaId(null);
    }
  };

  const handleGuardarConfigPago = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoConfigPago(true);
    setConfigPagoGuardada(false);
    try {
      const actualizado = await actualizarConfigPagoMovil(datosPagoMovil);
      setDatosPagoMovil(actualizado);
      setConfigPagoGuardada(true);
    } finally {
      setGuardandoConfigPago(false);
    }
  };

  const TABS: { valor: Seccion; etiqueta: string; icono: React.ReactNode; contador?: number }[] = [
    { valor: 'certificaciones', etiqueta: 'Certificaciones', icono: null },
    { valor: 'mapa-gruas', etiqueta: 'Mapa de Grúas', icono: <MapPin className="w-4 h-4" /> },
    { valor: 'servicios', etiqueta: 'Servicios', icono: <Route className="w-4 h-4" /> },
    { valor: 'pagos', etiqueta: 'Pagos Móviles', icono: <Landmark className="w-4 h-4" />, contador: pagos.length },
    { valor: 'membresias', etiqueta: 'Membresías', icono: <Receipt className="w-4 h-4" />, contador: membresias.length },
    { valor: 'saldos-pendientes', etiqueta: 'Saldos Pendientes', icono: <Wallet className="w-4 h-4" />, contador: saldosPendientes.length },
    { valor: 'rendimiento', etiqueta: 'Rendimiento', icono: <BarChart3 className="w-4 h-4" /> },
    { valor: 'movimientos', etiqueta: 'Movimientos', icono: <Receipt className="w-4 h-4" /> },
    { valor: 'pago-movil', etiqueta: 'Config. Pago Móvil', icono: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen w-full bg-brand-dark font-sans">
      <header className="bg-brand-gray border-b border-gray-800 p-4 flex items-center justify-between text-white shadow-md">
        <div className="flex items-center gap-3">
          <img src={logo} alt="PickCrane" className="h-14" />
          <h1 className="text-lg font-bold text-brand-yellow">Panel de Administración</h1>
        </div>
        <button
          onClick={() => { cerrarSesion(); onCerrarSesion(); }}
          className="text-gray-400 hover:text-white"
          title="Cerrar sesión"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-6 pt-4 flex items-center gap-1 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.valor}
            onClick={() => setSeccion(t.valor)}
            className={`text-sm font-semibold px-3.5 py-2 rounded-t-lg border-b-2 transition flex items-center gap-1.5 ${
              seccion === t.valor ? 'border-brand-yellow text-brand-yellow' : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {t.icono} {t.etiqueta}
            {!!t.contador && (
              <span className="bg-red-600 text-white text-[10px] rounded-full px-1.5 py-0.5 ml-0.5">{t.contador}</span>
            )}
          </button>
        ))}
      </div>

      <main className="max-w-4xl mx-auto p-6 space-y-4">
        {errorCarga && (
          <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-3 text-red-300 text-sm">
            {errorCarga}
          </div>
        )}
        {seccion === 'certificaciones' && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              {FILTROS.map((f) => (
                <button
                  key={f.valor}
                  onClick={() => setFiltro(f.valor)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                    filtro === f.valor
                      ? 'bg-brand-yellow text-black border-brand-yellow'
                      : 'border-brand-yellow/40 text-brand-yellow hover:bg-brand-yellow hover:text-black hover:border-brand-yellow'
                  }`}
                >
                  {f.etiqueta}
                </button>
              ))}
              <button
                onClick={() => cargarGrueros(filtro)}
                className="ml-auto text-gray-400 hover:text-white flex items-center gap-1 text-xs"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> Refrescar
              </button>
            </div>

            {cargandoGrueros ? (
              <p className="text-brand-yellow text-sm text-center py-10 animate-pulse">Cargando...</p>
            ) : grueros.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No hay grueros en este estado.</p>
            ) : (
              <div className="space-y-4">
                {grueros.map((g) => (
                  <div key={g.id} className="bg-brand-gray border border-gray-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-white">{g.usuario?.nombre}</p>
                        <p className="text-xs text-gray-400">{g.usuario?.email} {g.usuario?.telefono ? `· ${g.usuario.telefono}` : ''}</p>
                        <p className="text-xs text-gray-400 mt-1">{g.tipoGrua} · Placa {g.placa}</p>
                        <p className="text-xs text-gray-500">{g.direccion}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {(g.documentos || []).map((doc) => (
                        <a
                          key={doc.id}
                          href={urlArchivo(doc.archivoUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 bg-gray-800/50 rounded-lg p-2"
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          {ETIQUETAS_DOCUMENTO[doc.tipo]}
                        </a>
                      ))}
                    </div>

                    {filtro === 'EN_REVISION' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => resolverCertificacion(g.id, 'APROBADO')}
                          disabled={procesandoId === g.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
                        >
                          <ShieldCheck className="w-4 h-4" /> Aprobar
                        </button>
                        <button
                          onClick={() => resolverCertificacion(g.id, 'RECHAZADO')}
                          disabled={procesandoId === g.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
                        >
                          <XCircle className="w-4 h-4" /> Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {seccion === 'pagos' && (
          <>
            <div className="flex items-center justify-end">
              <button onClick={cargarPagos} className="text-gray-400 hover:text-white flex items-center gap-1 text-xs">
                <RefreshCcw className="w-3.5 h-3.5" /> Refrescar
              </button>
            </div>

            {cargandoPagos ? (
              <p className="text-brand-yellow text-sm text-center py-10 animate-pulse">Cargando...</p>
            ) : pagos.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No hay pagos móviles pendientes de verificar.</p>
            ) : (
              <div className="space-y-4">
                {pagos.map((p) => (
                  <div key={p.id} className="bg-brand-gray border border-gray-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-white">{p.servicio.cliente.nombre}</p>
                        <p className="text-xs text-gray-400">
                          {p.servicio.cliente.email} {p.servicio.cliente.telefono ? `· ${p.servicio.cliente.telefono}` : ''}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {p.servicio.origenDireccion} → {p.servicio.destinoDireccion}
                        </p>
                        {p.servicio.gruero && (
                          <p className="text-xs text-gray-500">Gruero elegido: {p.servicio.gruero.usuario.nombre}</p>
                        )}
                      </div>
                      <p className="text-brand-yellow font-bold text-lg shrink-0">${p.monto}</p>
                    </div>

                    <div className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between text-sm">
                      <span className="text-gray-400">Referencia declarada:</span>
                      <span className="text-white font-mono font-semibold">{p.referencia}</span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => resolverPago(p.id, true)}
                        disabled={procesandoPagoId === p.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
                      >
                        <ShieldCheck className="w-4 h-4" /> Aprobar pago
                      </button>
                      <button
                        onClick={() => resolverPago(p.id, false)}
                        disabled={procesandoPagoId === p.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
                      >
                        <XCircle className="w-4 h-4" /> Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {seccion === 'membresias' && (
          <>
            <div className="flex items-center justify-end">
              <button onClick={cargarMembresias} className="text-gray-400 hover:text-white flex items-center gap-1 text-xs">
                <RefreshCcw className="w-3.5 h-3.5" /> Refrescar
              </button>
            </div>

            {cargandoMembresias ? (
              <p className="text-brand-yellow text-sm text-center py-10 animate-pulse">Cargando...</p>
            ) : membresias.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No hay membresías pendientes de verificar.</p>
            ) : (
              <div className="space-y-4">
                {membresias.map((m) => (
                  <div key={m.id} className="bg-brand-gray border border-gray-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-white">{m.gruero.usuario.nombre}</p>
                        <p className="text-xs text-gray-400">{m.gruero.usuario.email}</p>
                        <p className="text-xs text-gray-500 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
                      </div>
                      <p className="text-brand-yellow font-bold text-lg shrink-0">${m.monto.toFixed(2)}</p>
                    </div>

                    <div className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between text-sm">
                      <span className="text-gray-400">Referencia declarada:</span>
                      <span className="text-white font-mono font-semibold">{m.referencia}</span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => resolverMembresia(m.id, true)}
                        disabled={procesandoMembresiaId === m.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
                      >
                        <ShieldCheck className="w-4 h-4" /> Confirmar
                      </button>
                      <button
                        onClick={() => resolverMembresia(m.id, false)}
                        disabled={procesandoMembresiaId === m.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
                      >
                        <XCircle className="w-4 h-4" /> Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {seccion === 'rendimiento' && (
          <>
            <div className="flex items-center justify-end">
              <button onClick={cargarRendimiento} className="text-gray-400 hover:text-white flex items-center gap-1 text-xs">
                <RefreshCcw className="w-3.5 h-3.5" /> Refrescar
              </button>
            </div>

            {cargandoRendimiento ? (
              <p className="text-brand-yellow text-sm text-center py-10 animate-pulse">Cargando...</p>
            ) : rendimiento.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">
                Todavía no hay servicios completados para calcular rendimiento.
              </p>
            ) : (
              <div className="bg-brand-gray border border-gray-800 rounded-2xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-800">
                      <th className="p-3 font-semibold">Gruero</th>
                      <th className="p-3 font-semibold text-center">Servicios</th>
                      <th className="p-3 font-semibold text-center">Tiempo en llegar</th>
                      <th className="p-3 font-semibold text-center">Tiempo en enganchar</th>
                      <th className="p-3 font-semibold text-center">Tiempo en trasladar</th>
                      <th className="p-3 font-semibold text-center">Calificación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rendimiento.map((r) => (
                      <tr key={r.grueroPerfilId} className="border-b border-gray-800/60 last:border-0">
                        <td className="p-3">
                          <p className="text-white font-medium">{r.nombre}</p>
                          <p className="text-xs text-gray-500">Placa {r.placa}</p>
                        </td>
                        <td className="p-3 text-center text-white">{r.serviciosCompletados}</td>
                        <td className="p-3 text-center text-gray-300">
                          {r.tiempoPromedioLlegadaMin != null ? `${r.tiempoPromedioLlegadaMin} min` : '—'}
                        </td>
                        <td className="p-3 text-center text-gray-300">
                          {r.tiempoPromedioRemolqueMin != null ? `${r.tiempoPromedioRemolqueMin} min` : '—'}
                        </td>
                        <td className="p-3 text-center text-gray-300">
                          {r.tiempoPromedioTrasladoMin != null ? `${r.tiempoPromedioTrasladoMin} min` : '—'}
                        </td>
                        <td className="p-3 text-center">
                          {r.calificacionPromedio != null ? (
                            <span className="flex items-center justify-center gap-1 text-brand-yellow font-semibold">
                              <Star className="w-3.5 h-3.5 fill-brand-yellow" /> {r.calificacionPromedio}
                            </span>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {seccion === 'movimientos' && (
          <>
            <div className="flex items-center justify-end">
              <button onClick={cargarMovimientos} className="text-gray-400 hover:text-white flex items-center gap-1 text-xs">
                <RefreshCcw className="w-3.5 h-3.5" /> Refrescar
              </button>
            </div>

            {cargandoMovimientos ? (
              <p className="text-brand-yellow text-sm text-center py-10 animate-pulse">Cargando...</p>
            ) : movimientos.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">Todavía no hay movimientos confirmados.</p>
            ) : (
              <div className="bg-brand-gray border border-gray-800 rounded-2xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-800">
                      <th className="p-3 font-semibold">Tipo</th>
                      <th className="p-3 font-semibold">Usuario</th>
                      <th className="p-3 font-semibold text-right">Monto</th>
                      <th className="p-3 font-semibold text-right">Fecha y hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((m) => (
                      <tr key={`${m.tipo}-${m.id}`} className="border-b border-gray-800/60 last:border-0">
                        <td className="p-3">
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                              m.tipo === 'MEMBRESIA_GRUERO'
                                ? 'text-purple-400 bg-purple-950/30 border-purple-800/50'
                                : 'text-green-400 bg-green-950/30 border-green-800/50'
                            }`}
                          >
                            {m.descripcion}
                          </span>
                        </td>
                        <td className="p-3 text-white">{m.usuario}</td>
                        <td className="p-3 text-right text-brand-yellow font-semibold">${m.monto.toFixed(2)}</td>
                        <td className="p-3 text-right text-gray-400 text-xs">{new Date(m.fecha).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {seccion === 'mapa-gruas' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">{gruerosActivosMapa.length} grúa(s) activa(s) ahora mismo</p>
              <button onClick={cargarMapaGruas} className="text-gray-400 hover:text-white flex items-center gap-1 text-xs">
                <RefreshCcw className="w-3.5 h-3.5" /> Refrescar
              </button>
            </div>

            {cargandoMapaGruas ? (
              <p className="text-brand-yellow text-sm text-center py-10 animate-pulse">Cargando...</p>
            ) : gruerosActivosMapa.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No hay grúas activas en este momento.</p>
            ) : (
              <MapaGruerosActivos grueros={gruerosActivosMapa} />
            )}
          </>
        )}

        {seccion === 'saldos-pendientes' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Solicitudes de pago de grueros, pendientes de que se les transfiera</p>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={handleRecalcularSaldos}
                  disabled={recalculando}
                  className="text-gray-400 hover:text-white flex items-center gap-1 text-xs disabled:opacity-50"
                  title="Recalcula el saldo pendiente de todos los grueros desde cero (por si hubo algún desajuste)"
                >
                  <RefreshCcw className={`w-3.5 h-3.5 ${recalculando ? 'animate-spin' : ''}`} /> Recalcular saldos
                </button>
                <button onClick={cargarSaldosPendientes} className="text-gray-400 hover:text-white flex items-center gap-1 text-xs">
                  <RefreshCcw className="w-3.5 h-3.5" /> Refrescar
                </button>
              </div>
            </div>

            {cargandoSaldos ? (
              <p className="text-brand-yellow text-sm text-center py-10 animate-pulse">Cargando...</p>
            ) : saldosPendientes.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No hay solicitudes de pago pendientes.</p>
            ) : (
              <div className="space-y-4">
                {saldosPendientes.map((s) => (
                  <div key={s.id} className="bg-brand-gray border border-gray-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">{s.gruero ? s.gruero.usuario.nombre : s.cliente?.nombre}</p>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              s.gruero ? 'bg-blue-950/50 text-blue-300' : 'bg-purple-950/50 text-purple-300'
                            }`}
                          >
                            {s.gruero ? 'Gruero' : 'Cliente'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">{s.gruero ? s.gruero.usuario.email : s.cliente?.email}</p>
                        {s.gruero && <p className="text-xs text-gray-500 mt-1">{s.gruero.tipoGrua} · Placa {s.gruero.placa}</p>}
                        <p className="text-[11px] text-gray-500">{new Date(s.createdAt).toLocaleString()}</p>
                      </div>
                      <p className="text-brand-yellow font-bold text-xl shrink-0">${s.monto.toFixed(2)}</p>
                    </div>

                    <div className="bg-gray-800/50 rounded-lg p-3 text-sm space-y-1">
                      <p className="text-xs text-gray-400 uppercase font-semibold mb-1">
                        Transferir a la cuenta {s.gruero ? 'del gruero' : 'del cliente'}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Banco:</span>
                        <span className="text-white font-medium">{s.banco}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Teléfono:</span>
                        <span className="text-white font-medium">{s.telefono}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Cédula/RIF:</span>
                        <span className="text-white font-medium">{s.cedulaORif}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => resolverLiquidar(s.id)}
                      disabled={liquidandoId === s.id}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
                    >
                      <ShieldCheck className="w-4 h-4" /> Marcar como pagado
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {seccion === 'servicios' && (
          <>
            <div className="flex items-center justify-end">
              <button onClick={cargarServiciosAdmin} className="text-gray-400 hover:text-white flex items-center gap-1 text-xs">
                <RefreshCcw className="w-3.5 h-3.5" /> Refrescar
              </button>
            </div>

            {cargandoServicios ? (
              <p className="text-brand-yellow text-sm text-center py-10 animate-pulse">Cargando...</p>
            ) : servicios.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">Todavía no hay servicios solicitados.</p>
            ) : (
              <div className="bg-brand-gray border border-gray-800 rounded-2xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-800">
                      <th className="p-3 font-semibold">Cliente</th>
                      <th className="p-3 font-semibold">Gruero</th>
                      <th className="p-3 font-semibold">Origen → Destino</th>
                      <th className="p-3 font-semibold text-center">Estado</th>
                      <th className="p-3 font-semibold text-right">Tarifa</th>
                      <th className="p-3 font-semibold">Fecha</th>
                      <th className="p-3 font-semibold">Inicio</th>
                      <th className="p-3 font-semibold">Fin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicios.map((s) => (
                      <tr key={s.id} className="border-b border-gray-800/60 last:border-0 align-top">
                        <td className="p-3 text-white whitespace-nowrap">{s.cliente.nombre}</td>
                        <td className="p-3 text-gray-300 whitespace-nowrap">
                          {s.gruero ? `${s.gruero.usuario.nombre} (${s.gruero.tipoGrua})` : '—'}
                        </td>
                        <td className="p-3 text-gray-400 max-w-[220px]">
                          <p className="truncate" title={s.origenDireccion}>{s.origenDireccion}</p>
                          <p className="truncate text-gray-500" title={s.destinoDireccion}>→ {s.destinoDireccion}</p>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${COLOR_ESTADO_SERVICIO[s.estado]}`}>
                            {ETIQUETA_ESTADO_SERVICIO[s.estado]}
                          </span>
                        </td>
                        <td className="p-3 text-right text-brand-yellow font-semibold whitespace-nowrap">
                          {s.tarifaEstimada != null ? `$${s.tarifaEstimada}` : '—'}
                        </td>
                        <td className="p-3 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-gray-400 text-xs whitespace-nowrap">
                          {s.horaAsignado ? new Date(s.horaAsignado).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="p-3 text-gray-400 text-xs whitespace-nowrap">
                          {s.horaCompletado ? new Date(s.horaCompletado).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {seccion === 'pago-movil' && (
          <form
            onSubmit={handleGuardarConfigPago}
            className="bg-brand-gray border border-gray-800 rounded-2xl p-6 space-y-4 max-w-md"
          >
            <h2 className="text-sm font-semibold text-white">Datos de Pago Móvil que ve el cliente</h2>
            {cargandoConfigPago ? (
              <p className="text-brand-yellow text-sm animate-pulse">Cargando...</p>
            ) : (
              <>
                <div>
                  <label className={labelClass}>Banco</label>
                  <input
                    className={inputClass}
                    value={datosPagoMovil.banco}
                    onChange={(e) => setDatosPagoMovil((d) => ({ ...d, banco: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Teléfono</label>
                  <input
                    className={inputClass}
                    value={datosPagoMovil.telefono}
                    onChange={(e) => setDatosPagoMovil((d) => ({ ...d, telefono: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Cédula/RIF</label>
                  <input
                    className={inputClass}
                    value={datosPagoMovil.cedulaORif}
                    onChange={(e) => setDatosPagoMovil((d) => ({ ...d, cedulaORif: e.target.value }))}
                    required
                  />
                </div>

                {configPagoGuardada && <p className="text-sm text-green-400">Datos actualizados.</p>}

                <button
                  type="submit"
                  disabled={guardandoConfigPago}
                  className="w-full py-3 px-4 bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none text-black font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  {guardandoConfigPago ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar cambios
                </button>
              </>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
