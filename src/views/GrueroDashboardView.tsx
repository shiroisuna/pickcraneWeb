import { useEffect, useRef, useState } from 'react';
import { Truck, LogOut, Route, DollarSign, Clock, MapPin, ShieldCheck, XCircle, Navigation, History, UserCircle, MessageCircle, Wallet } from 'lucide-react';
import logo from '../assets/logo.png';
import { Switch } from '../components/Switch';
import { MapaGruero } from '../components/MapaGruero';
import MisServiciosView from './MisServiciosView';
import PerfilView from './PerfilView';
import { actualizarDisponibilidad, obtenerPerfilGruero, solicitarPago } from '../services/gruero.service';
import { listarDisponibles, aceptarServicio, cambiarEstadoServicio, iniciarTraslado, obtenerServicioPorId, obtenerMisServicios } from '../services/servicio.service';
import { cerrarSesion, actualizarUsuarioGuardado } from '../services/auth.service';
import { seguirServicio, dejarDeSeguirServicio, enviarUbicacion, alRecibirServicioActualizado, alRecibirServicioNuevo, alRecibirMensajeChat, alReconectar } from '../services/socket.service';
import { ChatPanel } from '../components/ChatPanel';
import { calcularBearing } from '../utils/geo';
import { calcularRuta } from '../services/routing.service';
import { reproducirNotificacion } from '../utils/sonido';
import type { Coordenadas, Pago, Servicio, Usuario } from '../types';

interface GrueroDashboardViewProps {
  usuario: Usuario;
  onCerrarSesion: () => void;
  onUsuarioActualizado: (usuario: Usuario) => void;
}

export default function GrueroDashboardView({ usuario, onCerrarSesion, onUsuarioActualizado }: GrueroDashboardViewProps) {
  const perfil = usuario.grueroPerfil!;

  const [activo, setActivo] = useState(perfil.activo);
  const [posicion, setPosicion] = useState<Coordenadas | null>([perfil.latitud, perfil.longitud]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [seleccionado, setSeleccionado] = useState<Servicio | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [aceptando, setAceptando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El servicio que este gruero ya tomó y está atendiendo:
  // ASIGNADO -> EN_CAMINO -> LLEGADA -> EN_TRASLADO -> COMPLETADO
  const [servicioEnCurso, setServicioEnCurso] = useState<Servicio | null>(null);
  const [actualizandoEstadoServicio, setActualizandoEstadoServicio] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [mostrarChat, setMostrarChat] = useState(false);
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0);
  const [resumenPago, setResumenPago] = useState<Pago | null>(null);
  const [fotoEnganche, setFotoEnganche] = useState<File | null>(null);
  const [statsServicios, setStatsServicios] = useState({ hoy: 0, total: 0 });
  const [rutaEnCurso, setRutaEnCurso] = useState<{ origen: Coordenadas; destino: Coordenadas; routeCoords: Coordenadas[] } | null>(null);

  const mostrarChatRef = useRef(mostrarChat);
  mostrarChatRef.current = mostrarChat;

  const intervalDisponiblesRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const posicionAnteriorRef = useRef<Coordenadas | null>(null);

  const cargarDisponibles = async () => {
    try {
      setServicios(await listarDisponibles());
    } catch {
      // silencioso: si falla un refresco puntual no interrumpimos al gruero
    }
  };

  // Mientras está activo y sin servicio en curso, refresca la lista cada 8s
  useEffect(() => {
    if (!activo || servicioEnCurso) {
      if (intervalDisponiblesRef.current) clearInterval(intervalDisponiblesRef.current);
      if (!servicioEnCurso) setServicios([]);
      setSeleccionado(null);
      return;
    }
    cargarDisponibles();
    intervalDisponiblesRef.current = window.setInterval(cargarDisponibles, 8000);
    return () => {
      if (intervalDisponiblesRef.current) clearInterval(intervalDisponiblesRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, servicioEnCurso]);

  // Mientras hay un servicio en curso, escucha si el cliente lo cancela
  useEffect(() => {
    if (!servicioEnCurso) return;

    seguirServicio(servicioEnCurso.id);
    const dejarReconexion = alReconectar(() => seguirServicio(servicioEnCurso.id));
    const dejarDeEscuchar = alRecibirServicioActualizado((actualizado) => {
      if (actualizado.estado === 'CANCELADO') {
        detenerEnvioUbicacion();
        setServicioEnCurso(null);
        setError('El cliente canceló el servicio.');
      } else {
        setServicioEnCurso((prev) => (prev ? { ...prev, ...actualizado } : prev));
      }
    });

    return () => {
      dejarDeEscuchar();
      dejarReconexion();
      dejarDeSeguirServicio(servicioEnCurso.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicioEnCurso?.id]);

  // Respaldo del socket: si el cliente cancela y el evento no llega por red,
  // esto igual lo detecta sin que el gruero tenga que recargar la página.
  useEffect(() => {
    if (!servicioEnCurso) return;

    const intervalo = window.setInterval(() => {
      obtenerServicioPorId(servicioEnCurso.id)
        .then((actualizado) => {
          if (actualizado.estado === 'CANCELADO') {
            detenerEnvioUbicacion();
            setServicioEnCurso(null);
            setError('El cliente canceló el servicio.');
          } else {
            setServicioEnCurso((prev) => (prev ? { ...prev, ...actualizado } : prev));
          }
        })
        .catch(() => {});
    }, 5000);

    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicioEnCurso?.id]);

  // Calcula la ruta planeada (origen -> destino) para dibujarla en el mapa
  // mientras se atiende el servicio, igual que ve el cliente.
  useEffect(() => {
    if (!servicioEnCurso) {
      setRutaEnCurso(null);
      return;
    }
    const origen: Coordenadas = [servicioEnCurso.origenLat, servicioEnCurso.origenLng];
    const destino: Coordenadas = [servicioEnCurso.destinoLat, servicioEnCurso.destinoLng];
    setRutaEnCurso({ origen, destino, routeCoords: [] });

    calcularRuta(origen, destino)
      .then((ruta) => {
        if (ruta) setRutaEnCurso({ origen, destino, routeCoords: ruta.routeCoords });
      })
      .catch(() => {});
  }, [servicioEnCurso?.id]);

  const obtenerUbicacionActual = (): Promise<Coordenadas> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocalización no disponible en este navegador'));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
        () => reject(new Error('No se pudo obtener tu ubicación')),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });

  const handleToggleActivo = async (nuevoValor: boolean) => {
    setError(null);
    setCambiandoEstado(true);
    try {
      let coords: Coordenadas = posicion || [perfil.latitud, perfil.longitud];

      if (nuevoValor) {
        try {
          coords = await obtenerUbicacionActual();
          setPosicion(coords);
        } catch {
          // sin permiso de ubicación: seguimos con la dirección registrada
        }
      }

      await actualizarDisponibilidad(nuevoValor, coords[0], coords[1]);
      setActivo(nuevoValor);
      actualizarUsuarioGuardado({
        ...usuario,
        grueroPerfil: { ...perfil, activo: nuevoValor, latitud: coords[0], longitud: coords[1] },
      });

      // Al desactivarse, si tiene saldo pendiente de cobrar, le ofrecemos pedirlo.
      if (!nuevoValor && saldo.pendientePago > 0) {
        setMostrarSolicitarPago(true);
      }
    } catch {
      setError('No se pudo actualizar tu disponibilidad. Intenta de nuevo.');
    } finally {
      setCambiandoEstado(false);
    }
  };

  const handleAceptar = async () => {
    if (!seleccionado) return;
    setAceptando(true);
    setError(null);
    try {
      const servicio = await aceptarServicio(seleccionado.id);
      setServicioEnCurso(servicio);
      setServicios((prev) => prev.filter((s) => s.id !== seleccionado.id));
      setSeleccionado(null);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 409
          ? 'Ese servicio ya fue tomado por otro gruero.'
          : 'No se pudo aceptar el servicio. Intenta de nuevo.'
      );
      cargarDisponibles();
    } finally {
      setAceptando(false);
    }
  };

  /** Empieza a mandar la ubicación real por Socket.IO cada vez que el navegador reporta movimiento. */
  const iniciarEnvioUbicacion = (servicioId: string) => {
    if (!navigator.geolocation) return;
    posicionAnteriorRef.current = posicion;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const nueva: Coordenadas = [pos.coords.latitude, pos.coords.longitude];
        const anterior = posicionAnteriorRef.current;
        const bearing = anterior ? calcularBearing(anterior, nueva) : 0;

        posicionAnteriorRef.current = nueva;
        setPosicion(nueva);
        enviarUbicacion(servicioId, nueva[0], nueva[1], bearing);
      },
      () => setError('No se pudo activar el GPS en vivo. El cliente no verá tu ubicación moverse.'),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  };

  const detenerEnvioUbicacion = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  useEffect(() => () => detenerEnvioUbicacion(), []); // limpieza al desmontar

  const handleIniciarViaje = async () => {
    if (!servicioEnCurso) return;
    setActualizandoEstadoServicio(true);
    try {
      const actualizado = await cambiarEstadoServicio(servicioEnCurso.id, 'EN_CAMINO');
      setServicioEnCurso(actualizado);
      iniciarEnvioUbicacion(servicioEnCurso.id);
    } catch {
      setError('No se pudo marcar el viaje como iniciado.');
    } finally {
      setActualizandoEstadoServicio(false);
    }
  };

  /** El gruero notifica que llegó al punto del cliente (todavía no ha enganchado el vehículo). */
  const handleNotificarLlegada = async () => {
    if (!servicioEnCurso) return;
    setActualizandoEstadoServicio(true);
    try {
      const actualizado = await cambiarEstadoServicio(servicioEnCurso.id, 'LLEGADA');
      setServicioEnCurso(actualizado);
    } catch {
      setError('No se pudo notificar la llegada.');
    } finally {
      setActualizandoEstadoServicio(false);
    }
  };

  /** Inicia el traslado real del vehículo: del origen (cliente) al destino (taller). */
  const handleIniciarServicio = async () => {
    if (!servicioEnCurso) return;
    setActualizandoEstadoServicio(true);
    try {
      const actualizado = await iniciarTraslado(servicioEnCurso.id, fotoEnganche ?? undefined);
      setServicioEnCurso(actualizado);
      setFotoEnganche(null);
      // El GPS ya venía enviándose desde "Iniciar viaje"; sigue activo durante el traslado.
    } catch {
      setError('No se pudo iniciar el traslado.');
    } finally {
      setActualizandoEstadoServicio(false);
    }
  };

  // Notificación en vivo: apenas un cliente elige a este gruero (efectivo, o
  // pago móvil ya aprobado por el admin), la solicitud aparece al instante
  // sin esperar el refresco de 8s, con un beep.
  useEffect(() => {
    const dejarDeEscuchar = alRecibirServicioNuevo((servicio) => {
      setServicios((prev) => (prev.some((s) => s.id === servicio.id) ? prev : [servicio, ...prev]));
      reproducirNotificacion();
    });
    return dejarDeEscuchar;
  }, []);

  // Chat: activo mientras haya un servicio en curso, aunque el panel esté
  // cerrado (para el contador de no leídos); siempre suena un beep.
  useEffect(() => {
    if (!servicioEnCurso) return;
    const dejarDeEscuchar = alRecibirMensajeChat((mensaje) => {
      if (mensaje.autorId === usuario.id) return;
      reproducirNotificacion();
      if (!mostrarChatRef.current) setMensajesNoLeidos((n) => n + 1);
    });
    return dejarDeEscuchar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicioEnCurso?.id]);

  const [saldo, setSaldo] = useState({ ganadoTotal: 0, pendientePago: 0 });

  const [mostrarSolicitarPago, setMostrarSolicitarPago] = useState(false);
  const [montoSolicitud, setMontoSolicitud] = useState('');
  const [bancoSolicitud, setBancoSolicitud] = useState('');
  const [telefonoSolicitud, setTelefonoSolicitud] = useState(usuario.telefono ?? '');
  const [cedulaSolicitud, setCedulaSolicitud] = useState('');
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);
  const [errorSolicitud, setErrorSolicitud] = useState<string | null>(null);

  const handleEnviarSolicitudPago = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorSolicitud(null);

    const monto = Number(montoSolicitud);
    if (!monto || monto <= 0) {
      setErrorSolicitud('Indica un monto válido.');
      return;
    }
    if (monto > saldo.pendientePago) {
      setErrorSolicitud(`No puedes pedir más de $${saldo.pendientePago.toFixed(2)}, que es lo que tienes pendiente.`);
      return;
    }

    setEnviandoSolicitud(true);
    try {
      await solicitarPago(monto, bancoSolicitud, telefonoSolicitud, cedulaSolicitud);
      setSolicitudEnviada(true);
    } catch (err) {
      const mensaje = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErrorSolicitud(typeof mensaje === 'string' ? mensaje : 'No se pudo enviar la solicitud. Intenta de nuevo.');
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  const cargarStatsServicios = async () => {
    try {
      const lista = await obtenerMisServicios();
      const completados = lista.filter((s) => s.estado === 'COMPLETADO');
      const hoyStr = new Date().toDateString();
      const hoy = completados.filter((s) => new Date(s.createdAt).toDateString() === hoyStr).length;
      setStatsServicios({ hoy, total: completados.length });

      const ganadoTotal = completados.reduce((acc, s) => acc + (s.pago?.monto ?? 0), 0);
      setSaldo((prev) => ({ ...prev, ganadoTotal: Number(ganadoTotal.toFixed(2)) }));
    } catch {
      // no bloquea la vista si falla un refresco puntual
    }

    try {
      const perfilFresco = await obtenerPerfilGruero();
      setSaldo((prev) => ({ ...prev, pendientePago: perfilFresco.saldoPendientePago ?? 0 }));
    } catch {
      // idem
    }
  };

  useEffect(() => {
    cargarStatsServicios();
    const intervalo = window.setInterval(cargarStatsServicios, 60000);
    return () => clearInterval(intervalo);
  }, []);

  const handleFinalizarServicio = async () => {
    if (!servicioEnCurso) return;
    setActualizandoEstadoServicio(true);
    try {
      const actualizado = await cambiarEstadoServicio(servicioEnCurso.id, 'COMPLETADO');
      detenerEnvioUbicacion();
      if (actualizado.pago?.metodo === 'EFECTIVO') {
        setResumenPago(actualizado.pago);
      }
      setServicioEnCurso(null);
      cargarStatsServicios();
    } catch {
      setError('No se pudo marcar el servicio como completado.');
    } finally {
      setActualizandoEstadoServicio(false);
    }
  };

  if (mostrarHistorial) {
    return (
      <MisServiciosView
        titulo="Servicios Atendidos"
        onVolver={() => setMostrarHistorial(false)}
        onVerServicio={(servicio) => {
          setServicioEnCurso(servicio);
          setMostrarHistorial(false);
          if (servicio.estado === 'EN_CAMINO' || servicio.estado === 'LLEGADA' || servicio.estado === 'EN_TRASLADO') {
            iniciarEnvioUbicacion(servicio.id);
          }
        }}
      />
    );
  }

  if (mostrarPerfil) {
    return (
      <PerfilView
        usuario={usuario}
        onVolver={() => setMostrarPerfil(false)}
        onUsuarioActualizado={onUsuarioActualizado}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-brand-dark font-sans">
      <header className="bg-brand-gray border-b border-gray-800 p-4 flex items-center justify-between text-white shadow-md z-10">
        <div className="flex items-center space-x-3">
          <img src={logo} alt="PickCrane" className="h-14" />
          <div>
            <p className="text-xs text-gray-400">{perfil.tipoGrua} · Placa {perfil.placa}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => saldo.pendientePago > 0 && setMostrarSolicitarPago(true)}
            className="flex items-center gap-2 bg-gray-800/60 border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-full text-xs font-semibold transition"
            title={saldo.pendientePago > 0 ? 'Clic para solicitar el pago de tu saldo pendiente' : 'Ganado en total'}
          >
            <Wallet className="w-3.5 h-3.5 text-green-400" />
            <span className="text-green-400">${saldo.ganadoTotal.toFixed(2)} ganado</span>
            {saldo.pendientePago > 0 && (
              <>
                <span className="text-gray-600">·</span>
                <span className="text-brand-yellow">${saldo.pendientePago.toFixed(2)} por cobrar</span>
              </>
            )}
          </button>
          <button
            onClick={() => setMostrarHistorial(true)}
            className="group flex items-center gap-2 text-xs font-semibold border border-brand-yellow/40 hover:border-brand-yellow hover:bg-brand-yellow px-3 py-1.5 rounded-full transition"
            title="Ver historial completo"
          >
            <span className="text-green-400 group-hover:text-black">Hoy: {statsServicios.hoy}</span>
            <span className="text-gray-600 group-hover:text-black/50">·</span>
            <span className="text-brand-yellow group-hover:text-black">Total: {statsServicios.total}</span>
          </button>
          <button
            onClick={() => setMostrarHistorial(true)}
            className="group flex items-center gap-1.5 text-xs font-semibold text-brand-yellow hover:text-black border border-brand-yellow/40 hover:border-brand-yellow hover:bg-brand-yellow px-3 py-1.5 rounded-full transition"
          >
            <History className="w-3.5 h-3.5 group-hover:text-black" />
            Historial
          </button>
          <button
            onClick={() => setMostrarPerfil(true)}
            className="text-gray-400 hover:text-white"
            title="Mi perfil"
          >
            <UserCircle className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Switch activo={activo} onChange={handleToggleActivo} disabled={cambiandoEstado || Boolean(servicioEnCurso)} />
            <span className={`text-xs font-semibold ${activo ? 'text-green-400' : 'text-gray-400'}`}>
              {activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <button onClick={() => { cerrarSesion(); onCerrarSesion(); }} className="text-gray-400 hover:text-white" title="Cerrar sesión">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
        <aside className="w-full md:w-96 bg-brand-gray border-r border-gray-800 p-6 z-10 shadow-2xl flex flex-col overflow-y-auto">
          {resumenPago ? (
            <div className="space-y-4 flex-1 flex flex-col justify-center items-center text-center">
              <ShieldCheck className="w-10 h-10 text-green-400" />
              <div>
                <h3 className="text-base font-bold text-white">Servicio completado y cobro registrado</h3>
                <p className="text-xs text-gray-400 mt-1">Cobraste ${resumenPago.monto} en efectivo</p>
              </div>
              <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 space-y-2 text-sm w-full">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Comisión de la plataforma (1.5%):</span>
                  <span className="text-white font-semibold">${resumenPago.comisionPlataforma?.toFixed(2)}</span>
                </div>
                {resumenPago.vuelto ? (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Vuelto entregado al cliente:</span>
                    <span className="text-white font-semibold">${resumenPago.vuelto.toFixed(2)}</span>
                  </div>
                ) : null}
              </div>
              <button
                onClick={() => setResumenPago(null)}
                className="py-2.5 px-5 bg-brand-yellow hover:bg-yellow-500 text-black font-bold rounded-xl transition"
              >
                Entendido
              </button>
            </div>
          ) : servicioEnCurso ? (
            /* Servicio tomado: ASIGNADO -> EN_CAMINO -> LLEGADA -> EN_TRASLADO -> COMPLETADO */
            <div className="space-y-4">
              <div className="bg-green-950/40 border border-green-800/50 p-4 rounded-2xl text-center space-y-1">
                <ShieldCheck className="w-8 h-8 text-green-400 mx-auto mb-1" />
                <h3 className="text-base font-bold text-green-400">
                  {servicioEnCurso.estado === 'EN_CAMINO'
                    ? 'Vas en camino'
                    : servicioEnCurso.estado === 'LLEGADA'
                    ? 'Llegaste al punto del cliente'
                    : servicioEnCurso.estado === 'EN_TRASLADO'
                    ? 'Traslado en curso'
                    : 'Servicio asignado'}
                </h3>
              </div>
              <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 space-y-2 text-sm">
                <p className="text-gray-300"><span className="text-gray-500">Origen:</span> {servicioEnCurso.origenDireccion}</p>
                <p className="text-gray-300"><span className="text-gray-500">Destino:</span> {servicioEnCurso.destinoDireccion}</p>
                {servicioEnCurso.tarifaEstimada != null && (
                  <p className="text-brand-yellow font-semibold flex items-center gap-1">
                    <DollarSign className="w-4 h-4" /> {servicioEnCurso.tarifaEstimada}
                  </p>
                )}
              </div>

              <button
                onClick={() => { setMostrarChat(true); setMensajesNoLeidos(0); }}
                className="group w-full py-2.5 border border-brand-yellow/40 hover:border-brand-yellow hover:bg-brand-yellow bg-gray-800 text-brand-yellow hover:text-black text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition relative"
              >
                <MessageCircle className="w-4 h-4 text-brand-yellow group-hover:text-black" />
                Chatear con el cliente
                {mensajesNoLeidos > 0 && (
                  <span className="absolute -top-1.5 right-3 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {mensajesNoLeidos}
                  </span>
                )}
              </button>

              {error && <p className="text-sm text-red-400">{error}</p>}

              {servicioEnCurso.estado === 'ASIGNADO' && (
                <button
                  onClick={handleIniciarViaje}
                  disabled={actualizandoEstadoServicio}
                  className="w-full py-3.5 px-4 bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none text-black font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  <Navigation className="w-4 h-4" />
                  Iniciar viaje (activa tu GPS en vivo)
                </button>
              )}

              {servicioEnCurso.estado === 'EN_CAMINO' && (
                <button
                  onClick={handleNotificarLlegada}
                  disabled={actualizandoEstadoServicio}
                  className="w-full py-3.5 px-4 bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none text-black font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  Notificar llegada al cliente
                </button>
              )}

              {servicioEnCurso.estado === 'LLEGADA' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-300 block">
                    Foto del vehículo enganchado/montado (opcional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFotoEnganche(e.target.files?.[0] ?? null)}
                    className="w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700"
                  />
                  <button
                    onClick={handleIniciarServicio}
                    disabled={actualizandoEstadoServicio}
                    className="w-full py-3.5 px-4 bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none text-black font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                  >
                    <Truck className="w-4 h-4" />
                    Iniciar Servicio (comenzar traslado)
                  </button>
                </div>
              )}

              {servicioEnCurso.estado === 'EN_TRASLADO' && (
                <button
                  onClick={handleFinalizarServicio}
                  disabled={actualizandoEstadoServicio}
                  className="w-full py-3.5 px-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Marcar como completado
                </button>
              )}
            </div>
          ) : !activo ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-gray-400">
              <MapPin className="w-10 h-10 text-gray-600" />
              <p className="text-sm">Actívate con el switch de arriba para ver y aceptar solicitudes de servicio.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Solicitudes disponibles</h2>
                <p className="text-xs text-gray-400">
                  {servicios.length === 0 ? 'No hay solicitudes por ahora.' : 'Selecciona una en el mapa o en la lista.'}
                </p>
              </div>

              {error && <p className="text-sm text-red-400 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {error}</p>}

              <div className="space-y-2">
                {servicios.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSeleccionado(s)}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      seleccionado?.id === s.id
                        ? 'border-brand-yellow bg-yellow-950/20'
                        : 'border-gray-700 bg-gray-800/40 hover:border-gray-500'
                    }`}
                  >
                    <p className="text-sm text-white font-medium flex items-center gap-1.5">
                      <Route className="w-3.5 h-3.5 text-blue-400 shrink-0" /> {s.origenDireccion}
                    </p>
                    <p className="text-xs text-gray-500 truncate">→ {s.destinoDireccion}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      {s.distanciaKm != null && (
                        <span className="flex items-center gap-1"><Route className="w-3 h-3" /> {s.distanciaKm} km</span>
                      )}
                      {s.duracionMin != null && (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {s.duracionMin} min</span>
                      )}
                      {s.tarifaEstimada != null && (
                        <span className="flex items-center gap-1 text-brand-yellow font-semibold">
                          <DollarSign className="w-3 h-3" /> {s.tarifaEstimada}
                        </span>
                      )}
                      {s.pago?.metodo && (
                        <span className="text-gray-500">· {s.pago.metodo === 'EFECTIVO' ? 'Efectivo' : 'Pago Móvil ✓'}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {seleccionado && (
                <button
                  onClick={handleAceptar}
                  disabled={aceptando}
                  className="w-full py-3.5 px-4 bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none text-black font-bold rounded-xl shadow-lg transition"
                >
                  {aceptando ? 'Aceptando...' : 'Aceptar Servicio'}
                </button>
              )}
            </div>
          )}
        </aside>

        <div className="flex-1 h-full w-full">
          <MapaGruero
            posicionGruero={posicion}
            tipoGrua={perfil.tipoGrua}
            servicios={servicioEnCurso ? [] : servicios}
            servicioSeleccionadoId={seleccionado?.id ?? null}
            onSeleccionarServicio={setSeleccionado}
            rutaEnCurso={rutaEnCurso}
          />
        </div>
      </main>

      {mostrarChat && servicioEnCurso && (
        <ChatPanel servicioId={servicioEnCurso.id} usuarioId={usuario.id} onCerrar={() => setMostrarChat(false)} />
      )}

      {mostrarSolicitarPago && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <div
            className="w-full max-w-sm rounded-2xl border border-gray-800 shadow-2xl p-6 space-y-4"
            style={{ backgroundColor: 'rgba(17,17,17,0.96)' }}
          >
            {solicitudEnviada ? (
              <div className="text-center space-y-3 py-4">
                <ShieldCheck className="w-10 h-10 text-green-400 mx-auto" />
                <h3 className="text-base font-bold text-white">Solicitud enviada</h3>
                <p className="text-xs text-gray-400">
                  El admin va a transferirte y marcar tu pago como hecho. Se descontará de tu saldo pendiente.
                </p>
                <button
                  onClick={() => {
                    setMostrarSolicitarPago(false);
                    setSolicitudEnviada(false);
                    setMontoSolicitud('');
                    setBancoSolicitud('');
                    setCedulaSolicitud('');
                  }}
                  className="py-2.5 px-5 bg-brand-yellow hover:bg-yellow-500 text-black font-bold rounded-xl transition"
                >
                  Listo
                </button>
              </div>
            ) : (
              <form onSubmit={handleEnviarSolicitudPago} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-brand-yellow">Solicitar pago</h3>
                  <button type="button" onClick={() => setMostrarSolicitarPago(false)} className="text-gray-400 hover:text-white">
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Tienes <span className="text-brand-yellow font-semibold">${saldo.pendientePago.toFixed(2)}</span> pendiente
                  por cobrar. Indica cuánto quieres que te transfieran y a qué cuenta.
                </p>

                <div>
                  <label className="text-xs font-semibold text-gray-300 mb-1.5 block">Monto a solicitar</label>
                  <input
                    type="number"
                    step="0.01"
                    max={saldo.pendientePago}
                    value={montoSolicitud}
                    onChange={(e) => setMontoSolicitud(e.target.value)}
                    placeholder={`Máximo $${saldo.pendientePago.toFixed(2)}`}
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-brand-yellow"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 mb-1.5 block">Banco</label>
                  <input
                    value={bancoSolicitud}
                    onChange={(e) => setBancoSolicitud(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-brand-yellow"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 mb-1.5 block">Teléfono (Pago Móvil)</label>
                  <input
                    value={telefonoSolicitud}
                    onChange={(e) => setTelefonoSolicitud(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-brand-yellow"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 mb-1.5 block">Cédula/RIF</label>
                  <input
                    value={cedulaSolicitud}
                    onChange={(e) => setCedulaSolicitud(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-brand-yellow"
                    required
                  />
                </div>

                {errorSolicitud && <p className="text-sm text-red-400">{errorSolicitud}</p>}

                <button
                  type="submit"
                  disabled={enviandoSolicitud}
                  className="w-full py-3 px-4 bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-black font-bold rounded-xl shadow-lg transition"
                >
                  {enviandoSolicitud ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
