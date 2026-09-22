import { useState, useEffect, useRef } from 'react';
import { Map } from '../components/Maps';
import type { GrueroMarcador } from '../components/Maps';
import { LocationSearchInput } from '../components/LocationSearchInput';
import { GrueroCercanoCard } from '../components/GrueroCercanoCard';
import { ChatPanel } from '../components/ChatPanel';
import { EstrellasInput } from '../components/EstrellasInput';
import MisServiciosView from './MisServiciosView';
import PerfilView from './PerfilView';
import {
  Navigation,
  Route,
  Clock,
  ShieldCheck,
  PhoneCall,
  XCircle,
  LogOut,
  Loader2,
  History,
  Wallet,
  Landmark,
  Banknote,
  ArrowLeft,
  Copy,
  UserCircle,
  MessageCircle,
} from 'lucide-react';
import logo from '../assets/logo.png';
import type { Coordenadas, Servicio, EstadoServicio, GrueroActivo, DatosPagoMovil, Usuario } from '../types';
import { direccionDesdeCoordenadas } from '../services/geocoding.service';
import { calcularRuta } from '../services/routing.service';
import { crearServicio, cambiarEstadoServicio, obtenerMisServicios, obtenerServicioPorId, calificarServicio, obtenerMensajes } from '../services/servicio.service';
import { listarGruerosActivos } from '../services/gruero.service';
import { obtenerDatosPagoMovil } from '../services/pago.service';
import { calcularDesgloseTarifa, RETIRO_CLIENTE_MINIMO } from '../utils/pricing';
import { DesgloseTarifaCard } from '../components/DesgloseTarifaCard';
import { reproducirNotificacion } from '../utils/sonido';
import { distanciaKmEntre } from '../utils/geo';
import { urlArchivo } from '../utils/archivos';
import {
  seguirServicio,
  dejarDeSeguirServicio,
  alRecibirUbicacion,
  alRecibirServicioActualizado,
  alRecibirMensajeChat,
  alReconectar,
} from '../services/socket.service';
import { cerrarSesion, actualizarUsuarioGuardado } from '../services/auth.service';
import { obtenerPerfil, solicitarRetiro } from '../services/perfil.service';

interface SolicitarGruaViewProps {
  usuario: Usuario;
  onCerrarSesion: () => void;
  onUsuarioActualizado: (usuario: Usuario) => void;
}

type Paso = 'configurando' | 'pago';

const ESTADOS_EN_PROCESO: EstadoServicio[] = [
  'PENDIENTE_PAGO',
  'SOLICITADO',
  'ASIGNADO',
  'EN_CAMINO',
  'LLEGADA',
  'EN_TRASLADO',
];

export default function SolicitarGruaView({ usuario, onCerrarSesion, onUsuarioActualizado }: SolicitarGruaViewProps) {
  const [origin, setOrigin] = useState<Coordenadas | null>(null);
  const [originName, setOriginName] = useState<string>('');

  const [destination, setDestination] = useState<Coordenadas | null>(null);
  const [destinationName, setDestinationName] = useState<string>('');

  const [routeCoords, setRouteCoords] = useState<Coordenadas[]>([]);
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [durationMin, setDurationMin] = useState<number>(0);
  const [loadingRoute, setLoadingRoute] = useState<boolean>(false);

  // Elegir gruero cercano (obligatorio: el backend ya no tiene pool abierto)
  const [gruerosCercanos, setGruerosCercanos] = useState<GrueroActivo[]>([]);
  const [cargandoGrueros, setCargandoGrueros] = useState(false);
  const [grueroElegido, setGrueroElegido] = useState<GrueroActivo | null>(null);

  // Paso de pago
  const [paso, setPaso] = useState<Paso>('configurando');
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'PAGO_MOVIL' | 'SALDO' | null>(null);
  const [montoEntregado, setMontoEntregado] = useState<string>('');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [datosPagoMovil, setDatosPagoMovil] = useState<DatosPagoMovil | null>(null);

  // El servicio real ya creado
  const [servicioActual, setServicioActual] = useState<Servicio | null>(null);
  const [creandoServicio, setCreandoServicio] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Posición real de la grúa, recibida por Socket.IO
  const [grueroPos, setGrueroPos] = useState<Coordenadas | null>(null);
  const [grueroBearing, setGrueroBearing] = useState<number>(0);
  const [recorridoReal, setRecorridoReal] = useState<Coordenadas[]>([]);

  // Vista de historial y detección de una solicitud ya en curso (recarga de página)
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [mostrarChat, setMostrarChat] = useState(false);
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0);

  const [mostrarSolicitarRetiro, setMostrarSolicitarRetiro] = useState(false);
  const [montoRetiro, setMontoRetiro] = useState('');
  const [bancoRetiro, setBancoRetiro] = useState('');
  const [telefonoRetiro, setTelefonoRetiro] = useState(usuario.telefono ?? '');
  const [cedulaRetiro, setCedulaRetiro] = useState('');
  const [enviandoRetiro, setEnviandoRetiro] = useState(false);
  const [retiroEnviado, setRetiroEnviado] = useState(false);
  const [errorRetiro, setErrorRetiro] = useState<string | null>(null);

  const handleEnviarSolicitudRetiro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorRetiro(null);

    const monto = Number(montoRetiro);
    if (!monto || monto < RETIRO_CLIENTE_MINIMO) {
      setErrorRetiro(`El monto mínimo a solicitar es $${RETIRO_CLIENTE_MINIMO}.`);
      return;
    }
    if (monto > usuario.saldoAFavor) {
      setErrorRetiro(`No puedes pedir más de $${usuario.saldoAFavor.toFixed(2)}, que es lo que tienes a favor.`);
      return;
    }

    setEnviandoRetiro(true);
    try {
      await solicitarRetiro(monto, bancoRetiro, telefonoRetiro, cedulaRetiro);
      setRetiroEnviado(true);
    } catch (err) {
      const mensaje = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErrorRetiro(typeof mensaje === 'string' ? mensaje : 'No se pudo enviar la solicitud. Intenta de nuevo.');
    } finally {
      setEnviandoRetiro(false);
    }
  };
  const estadoAnteriorRef = useRef<string | null>(null);
  const ultimaPosicionUsadaRef = useRef<string | null>(null);
  const mensajesVistosRef = useRef<Set<string>>(new Set());
  const primerChequeoMensajesRef = useRef(false);
  const ultimoServicioIdMensajesRef = useRef<string | null>(null);
  const mostrarChatRef = useRef(mostrarChat);
  mostrarChatRef.current = mostrarChat;
  const [hayServicioPrevioEnProceso, setHayServicioPrevioEnProceso] = useState(false);

  // Calificación del servicio completado
  const [estrellas, setEstrellas] = useState(0);
  const [comentarioCalificacion, setComentarioCalificacion] = useState('');
  const [enviandoCalificacion, setEnviandoCalificacion] = useState(false);

  useEffect(() => {
    if (servicioActual) return;
    obtenerMisServicios()
      .then((lista) => setHayServicioPrevioEnProceso(lista.some((s) => ESTADOS_EN_PROCESO.includes(s.estado))))
      .catch(() => {});
  }, [servicioActual]);

  const handleOriginDrag = async (newCoords: Coordenadas) => {
    setOrigin(newCoords);
    const address = await direccionDesdeCoordenadas(newCoords);
    setOriginName(address);
  };

  const handleDestinationDrag = async (newCoords: Coordenadas) => {
    setDestination(newCoords);
    const address = await direccionDesdeCoordenadas(newCoords);
    setDestinationName(address);
  };

  // Traza la ruta mientras el usuario todavía está configurando la solicitud
  useEffect(() => {
    if (servicioActual || !origin || !destination) return;

    const fetchRoute = async () => {
      setLoadingRoute(true);
      try {
        const ruta = await calcularRuta(origin, destination);
        if (ruta) {
          setRouteCoords(ruta.routeCoords);
          setDistanceKm(ruta.distanciaKm);
          setDurationMin(ruta.duracionMin);
        }
      } catch (err) {
        console.error('Error calculando ruta:', err);
      } finally {
        setLoadingRoute(false);
      }
    };

    fetchRoute();
  }, [origin, destination, servicioActual]);

  // Carga los grueros activos para elegir, y los refresca cada 10s mientras
  // el cliente sigue configurando (para reflejar quién se conecta/desconecta)
  useEffect(() => {
    if (servicioActual) return;

    const cargar = () => {
      listarGruerosActivos()
        .then(setGruerosCercanos)
        .catch(() => setGruerosCercanos([]));
    };

    setCargandoGrueros(true);
    listarGruerosActivos()
      .then(setGruerosCercanos)
      .catch(() => setGruerosCercanos([]))
      .finally(() => setCargandoGrueros(false));

    const intervalo = window.setInterval(cargar, 10000);
    return () => clearInterval(intervalo);
  }, [servicioActual]);

  // Trae los datos de pago móvil cuando el cliente elige ese método
  useEffect(() => {
    if (metodoPago !== 'PAGO_MOVIL' || datosPagoMovil) return;
    obtenerDatosPagoMovil().then(setDatosPagoMovil).catch(() => {});
  }, [metodoPago, datosPagoMovil]);

  // Mientras haya un servicio activo, escucha su ubicación y sus cambios de estado en vivo
  useEffect(() => {
    if (!servicioActual) return;

    seguirServicio(servicioActual.id);
    setRecorridoReal([]); // nuevo servicio: empieza un recorrido nuevo

    // Si el socket se reconecta (red inestable, pestaña dormida, etc.), la
    // sala se pierde — hay que volver a unirse o se dejan de recibir eventos.
    const dejarReconexion = alReconectar(() => seguirServicio(servicioActual.id));

    const dejarUbicacion = alRecibirUbicacion((data) => {
      setGrueroPos([data.lat, data.lng]);
      setGrueroBearing(data.bearing);
      setRecorridoReal((prev) => [...prev, [data.lat, data.lng]]);
    });

    const dejarServicio = alRecibirServicioActualizado((actualizado) => {
      setServicioActual((prev) => (prev ? { ...prev, ...actualizado } : prev));
    });

    // Notificación de chat: activa aunque el panel esté cerrado (para el
    // contador de no leídos), y siempre suena un beep al recibir un mensaje
    // que no sea propio.
    const dejarChat = alRecibirMensajeChat((mensaje) => {
      if (mensaje.autorId === usuario.id) return;
      if (mensajesVistosRef.current.has(mensaje.id)) return; // ya lo contó el respaldo por HTTP
      mensajesVistosRef.current.add(mensaje.id);
      reproducirNotificacion();
      if (!mostrarChatRef.current) setMensajesNoLeidos((n) => n + 1);
    });

    return () => {
      dejarUbicacion();
      dejarServicio();
      dejarChat();
      dejarReconexion();
      dejarDeSeguirServicio(servicioActual.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicioActual?.id]);

  // Beep cuando el estado del servicio avanza (gruero aceptó, llegó, inició
  // el traslado, completó, etc.) — no suena en el primer render, solo en
  // cambios reales. Al completar, además refresca el saldo real del
  // cliente: si hubo vuelto en efectivo, el backend ya lo acreditó, pero
  // el header seguía mostrando el valor viejo hasta ahora.
  useEffect(() => {
    if (!servicioActual) {
      estadoAnteriorRef.current = null;
      return;
    }
    if (estadoAnteriorRef.current && estadoAnteriorRef.current !== servicioActual.estado) {
      reproducirNotificacion();

      if (servicioActual.estado === 'COMPLETADO') {
        obtenerPerfil()
          .then((fresco) => {
            actualizarUsuarioGuardado(fresco);
            onUsuarioActualizado(fresco);
          })
          .catch(() => {});
      }
    }
    estadoAnteriorRef.current = servicioActual.estado;
  }, [servicioActual?.estado]);

  // Respaldo del socket: si por lo que sea no llega el evento en vivo (red
  // inestable, reconexión, etc.), esto igual detecta el cambio de estado
  // sin que el usuario tenga que recargar la página. También sirve de
  // respaldo para la ubicación en sí: el backend ya guarda la última
  // posición del gruero en cada ping, así que si el socket no la trae,
  // la tomamos de aquí (con hasta 5s de rezago en vez de en vivo).
  useEffect(() => {
    if (!servicioActual || !ESTADOS_EN_PROCESO.includes(servicioActual.estado)) return;
    if (ultimoServicioIdMensajesRef.current !== servicioActual.id) {
      ultimoServicioIdMensajesRef.current = servicioActual.id;
      primerChequeoMensajesRef.current = false;
    }

    const intervalo = window.setInterval(() => {
      obtenerServicioPorId(servicioActual.id)
        .then((actualizado) => {
          setServicioActual((prev) => (prev ? { ...prev, ...actualizado } : prev));

          const ultimaActualizacion = actualizado.gruero?.ultimaActualizacion;
          const lat = actualizado.gruero?.ultimaLat;
          const lng = actualizado.gruero?.ultimaLng;
          if (lat != null && lng != null && ultimaActualizacion && ultimaActualizacion !== ultimaPosicionUsadaRef.current) {
            ultimaPosicionUsadaRef.current = ultimaActualizacion;
            setGrueroPos([lat, lng]);
            setRecorridoReal((prev) => (prev.length && prev[prev.length - 1][0] === lat && prev[prev.length - 1][1] === lng ? prev : [...prev, [lat, lng]]));
          }
        })
        .catch(() => {});

      // Respaldo del chat: si el socket no entrega 'chat:nuevo' (mismo caso
      // que la ubicación), esto igual detecta mensajes nuevos del gruero.
      // La primera vez solo "sella" los mensajes que ya existían, sin avisar.
      obtenerMensajes(servicioActual.id)
        .then((mensajes) => {
          if (!primerChequeoMensajesRef.current) {
            primerChequeoMensajesRef.current = true;
            mensajes.forEach((m) => mensajesVistosRef.current.add(m.id));
            return;
          }
          const nuevos = mensajes.filter((m) => m.autorId !== usuario.id && !mensajesVistosRef.current.has(m.id));
          if (nuevos.length === 0) return;
          nuevos.forEach((m) => mensajesVistosRef.current.add(m.id));
          reproducirNotificacion();
          if (!mostrarChatRef.current) setMensajesNoLeidos((n) => n + nuevos.length);
        })
        .catch(() => {});
    }, 5000);

    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicioActual?.id, servicioActual?.estado]);

  const { base: tarifaBase, comision: tarifaComision, total: tarifaEstimada } = calcularDesgloseTarifa(distanceKm);
  const vueltoPreview = Math.max(0, Number(montoEntregado || 0) - tarifaEstimada);

  const gruerosOrdenados = origin
    ? gruerosCercanos
        .map((g) => ({ gruero: g, distancia: distanciaKmEntre(origin, [g.ultimaLat ?? g.latitud, g.ultimaLng ?? g.longitud]) }))
        .sort((a, b) => a.distancia - b.distancia)
    : gruerosCercanos.map((g) => ({ gruero: g, distancia: null as number | null }));

  const marcadoresGruero: GrueroMarcador[] =
    !servicioActual && paso === 'configurando'
      ? gruerosOrdenados.map(({ gruero: g }) => ({
          id: g.id,
          lat: g.ultimaLat ?? g.latitud,
          lng: g.ultimaLng ?? g.longitud,
          nombre: g.usuario.nombre,
          tipoGrua: g.tipoGrua,
          placa: g.placa,
          fotoUrl: g.documentos?.[0] ? urlArchivo(g.documentos[0].archivoUrl) : null,
        }))
      : [];

  const handleCrearServicio = async () => {
    if (!origin || !destination || !grueroElegido || !metodoPago) return;
    setError(null);
    setCreandoServicio(true);
    try {
      const servicio = await crearServicio({
        grueroPerfilId: grueroElegido.id,
        origenLat: origin[0],
        origenLng: origin[1],
        origenDireccion: originName,
        destinoLat: destination[0],
        destinoLng: destination[1],
        destinoDireccion: destinationName,
        distanciaKm: distanceKm,
        duracionMin: durationMin,
        metodoPago,
        ...(metodoPago === 'EFECTIVO' ? { montoEntregado: Number(montoEntregado || tarifaEstimada) } : {}),
        ...(metodoPago === 'PAGO_MOVIL' ? { referenciaPago } : {}),
      });
      setServicioActual(servicio);
    } catch (err) {
      const mensaje = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(typeof mensaje === 'string' ? mensaje : 'No se pudo crear la solicitud. Intenta de nuevo.');
    } finally {
      setCreandoServicio(false);
    }
  };

  const handleCancelar = async () => {
    if (!servicioActual) return;
    try {
      await cambiarEstadoServicio(servicioActual.id, 'CANCELADO');
    } catch {
      // aunque falle en el backend, igual liberamos la pantalla localmente
    } finally {
      setServicioActual(null);
      setGrueroPos(null);
    }
  };

  const handleCalificar = async () => {
    if (!servicioActual || estrellas === 0) return;
    setEnviandoCalificacion(true);
    try {
      await calificarServicio(servicioActual.id, estrellas, comentarioCalificacion || undefined);
      setServicioActual((prev) =>
        prev ? { ...prev, calificacion: { id: 'temp', estrellas, comentario: comentarioCalificacion, createdAt: new Date().toISOString() } } : prev
      );
    } catch {
      setError('No se pudo enviar tu calificación. Intenta de nuevo.');
    } finally {
      setEnviandoCalificacion(false);
    }
  };

  const nuevaSolicitud = () => {
    setServicioActual(null);
    setGrueroPos(null);
    setRecorridoReal([]);
    setError(null);
    setPaso('configurando');
    setMetodoPago(null);
    setMontoEntregado('');
    setReferenciaPago('');
    setGrueroElegido(null);
  };

  const estado = servicioActual?.estado;
  const bloqueadoParaEditar = Boolean(servicioActual);
  const hayServicioEnProceso =
    (Boolean(estado) && ESTADOS_EN_PROCESO.includes(estado as EstadoServicio)) || hayServicioPrevioEnProceso;

  if (mostrarHistorial) {
    return (
      <MisServiciosView
        onVolver={() => setMostrarHistorial(false)}
        onVerServicio={(servicio) => {
          setServicioActual(servicio);
          setMostrarHistorial(false);
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
        </div>
        <div className="flex items-center gap-3">
          {usuario.saldoAFavor > 0 && (
            <button
              onClick={() => setMostrarSolicitarRetiro(true)}
              className="flex items-center gap-1.5 bg-gray-800/60 border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-full text-green-400 text-xs font-semibold transition"
              title={
                usuario.saldoAFavor >= RETIRO_CLIENTE_MINIMO
                  ? 'Clic para solicitar que te devuelvan tu saldo'
                  : `Necesitas al menos $${RETIRO_CLIENTE_MINIMO} acumulados para poder retirarlo`
              }
            >
              <Wallet className="w-3.5 h-3.5" /> ${usuario.saldoAFavor.toFixed(2)} a favor
            </button>
          )}          {(estado === 'ASIGNADO' || estado === 'EN_CAMINO' || estado === 'LLEGADA' || estado === 'EN_TRASLADO') && (
            <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/40 px-3 py-1.5 rounded-full text-green-400 text-xs font-semibold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {estado === 'EN_TRASLADO' ? 'Traslado en curso' : 'En Ruta Activa'}
            </div>
          )}
          {hayServicioEnProceso && (
            <button
              onClick={() => setMostrarHistorial(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-black bg-brand-yellow hover:bg-yellow-500 px-3 py-1.5 rounded-full transition"
            >
              <History className="w-3.5 h-3.5" />
              Servicios Solicitados
            </button>
          )}
          <button
            onClick={() => setMostrarPerfil(true)}
            className="text-gray-400 hover:text-white"
            title="Mi perfil"
          >
            <UserCircle className="w-5 h-5" />
          </button>
          <button
            onClick={() => { cerrarSesion(); onCerrarSesion(); }}
            className="text-gray-400 hover:text-white"
            title="Cerrar sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
        <aside className="w-full md:w-96 bg-brand-gray border-r border-gray-800 p-6 z-10 shadow-2xl flex flex-col justify-between overflow-y-auto">
          {!servicioActual && paso === 'configurando' ? (
            /* Paso 1: configurar origen/destino + elegir gruero */
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-brand-yellow" />
                  Solicitar Grúa
                </h2>
                <p className="text-xs text-gray-400">Selecciona o arrastra los puntos de la avería</p>
              </div>

              <div className="space-y-4">
                <LocationSearchInput
                  key={`orig-${origin?.[0]}-${origin?.[1]}`}
                  label="Punto de Origen (Avería)"
                  placeholder="Buscar o arrastrar..."
                  iconColor="text-green-400"
                  initialValue={originName}
                  onSelectLocation={(c, n) => { setOrigin(c); setOriginName(n); }}
                />

                <LocationSearchInput
                  key={`dest-${destination?.[0]}-${destination?.[1]}`}
                  label="Punto de Destino (Taller)"
                  placeholder="Buscar o arrastrar..."
                  iconColor="text-red-400"
                  initialValue={destinationName}
                  onSelectLocation={(c, n) => { setDestination(c); setDestinationName(n); }}
                />
              </div>

              {!origin || !destination ? (
                <div className="text-center py-6 text-gray-500 text-xs">
                  Selecciona el origen y el destino para ver la ruta y la tarifa
                </div>
              ) : loadingRoute ? (
                <div className="text-center py-6 text-brand-yellow text-sm animate-pulse">
                  Trazando ruta...
                </div>
              ) : (
                <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Route className="w-4 h-4 text-blue-400" /> Distancia:
                    </span>
                    <span className="font-bold text-white">{distanceKm} km</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-400" /> Tiempo:
                    </span>
                    <span className="font-bold text-white">{durationMin} min</span>
                  </div>
                  <hr className="border-gray-700" />
                  <DesgloseTarifaCard base={tarifaBase} comision={tarifaComision} total={tarifaEstimada} />
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Elige tu gruero</h3>
                {!origin ? (
                  <p className="text-xs text-gray-500">Selecciona primero el punto de origen para ver las grúas más cercanas.</p>
                ) : cargandoGrueros ? (
                  <p className="text-xs text-gray-400 animate-pulse">Buscando grúas cercanas activas...</p>
                ) : gruerosOrdenados.length === 0 ? (
                  <p className="text-xs text-gray-500">No hay grúas activas en este momento. Intenta más tarde.</p>
                ) : grueroElegido ? (
                  <div className="p-3 rounded-xl border border-brand-yellow bg-yellow-950/20 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{grueroElegido.usuario.nombre}</p>
                      <p className="text-xs text-gray-400 truncate">{grueroElegido.tipoGrua} · Placa {grueroElegido.placa}</p>
                    </div>
                    <button
                      onClick={() => setGrueroElegido(null)}
                      className="text-xs text-gray-400 hover:text-white shrink-0"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {gruerosOrdenados.map(({ gruero, distancia }) => (
                      <GrueroCercanoCard
                        key={gruero.id}
                        gruero={gruero}
                        distanciaKm={distancia}
                        seleccionado={false}
                        onSeleccionar={() => setGrueroElegido(gruero)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                onClick={() => setPaso('pago')}
                disabled={!origin || !destination || loadingRoute || routeCoords.length === 0 || !grueroElegido}
                className="w-full py-3.5 px-4 bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none text-black font-bold rounded-xl shadow-lg transition duration-200"
              >
                Continuar al Pago
              </button>
            </div>
          ) : !servicioActual && paso === 'pago' ? (
            /* Paso 2: elegir método de pago */
            <div className="space-y-5">
              <button
                onClick={() => setPaso('configurando')}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Volver
              </button>

              <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 space-y-1">
                <p className="text-xs text-gray-400">Gruero elegido</p>
                <p className="text-sm font-semibold text-white">
                  {grueroElegido?.usuario.nombre} · {grueroElegido?.tipoGrua} (Placa {grueroElegido?.placa})
                </p>
                <hr className="border-gray-700 my-2" />
                <DesgloseTarifaCard base={tarifaBase} comision={tarifaComision} total={tarifaEstimada} />
              </div>

              {!metodoPago ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white">¿Cómo vas a pagar?</h3>
                  <button
                    onClick={() => setMetodoPago('SALDO')}
                    disabled={usuario.saldoAFavor < tarifaEstimada}
                    className="group w-full flex items-center gap-3 p-4 rounded-xl border border-brand-yellow/40 hover:border-brand-yellow hover:bg-brand-yellow bg-gray-800/40 transition text-left disabled:hover:border-brand-yellow/40 disabled:hover:bg-gray-800/40 disabled:cursor-not-allowed disabled:text-gray-500"
                  >
                    <Wallet className="w-6 h-6 text-green-400 group-hover:text-black" />
                    <div>
                      <p className="font-semibold text-brand-yellow group-hover:text-black">Saldo a favor</p>
                      <p className="text-xs text-gray-400 group-hover:text-black/70">
                        {usuario.saldoAFavor >= tarifaEstimada
                          ? `Tienes $${usuario.saldoAFavor.toFixed(2)} disponibles`
                          : `Tu saldo ($${usuario.saldoAFavor.toFixed(2)}) no alcanza para este servicio`}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => setMetodoPago('EFECTIVO')}
                    className="group w-full flex items-center gap-3 p-4 rounded-xl border border-brand-yellow/40 hover:border-brand-yellow hover:bg-brand-yellow bg-gray-800/40 transition text-left"
                  >
                    <Banknote className="w-6 h-6 text-green-400 group-hover:text-black" />
                    <div>
                      <p className="font-semibold text-brand-yellow group-hover:text-black">Efectivo</p>
                      <p className="text-xs text-gray-400 group-hover:text-black/70">Le pagas al gruero directamente</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setMetodoPago('PAGO_MOVIL')}
                    className="group w-full flex items-center gap-3 p-4 rounded-xl border border-brand-yellow/40 hover:border-brand-yellow hover:bg-brand-yellow bg-gray-800/40 transition text-left"
                  >
                    <Landmark className="w-6 h-6 text-blue-400 group-hover:text-black" />
                    <div>
                      <p className="font-semibold text-brand-yellow group-hover:text-black">Pago Móvil</p>
                      <p className="text-xs text-gray-400 group-hover:text-black/70">Transfieres a la cuenta de la app; un admin lo verifica</p>
                    </div>
                  </button>
                </div>
              ) : metodoPago === 'SALDO' ? (
                <div className="space-y-4">
                  <button onClick={() => setMetodoPago(null)} className="text-xs text-gray-400 hover:text-white">
                    ← Cambiar método de pago
                  </button>
                  <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Se descontará de tu saldo:</span>
                      <span className="text-white font-semibold">${tarifaEstimada}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Saldo restante:</span>
                      <span className="text-brand-yellow font-semibold">${(usuario.saldoAFavor - tarifaEstimada).toFixed(2)}</span>
                    </div>
                  </div>
                  {error && <p className="text-sm text-red-400">{error}</p>}
                  <button
                    onClick={handleCrearServicio}
                    disabled={creandoServicio}
                    className="w-full py-3.5 px-4 bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none text-black font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                  >
                    {creandoServicio && <Loader2 className="w-4 h-4 animate-spin" />}
                    Pagar con saldo y notificar al gruero
                  </button>
                </div>
              ) : metodoPago === 'EFECTIVO' ? (
                <div className="space-y-4">
                  <button onClick={() => setMetodoPago(null)} className="text-xs text-gray-400 hover:text-white">
                    ← Cambiar método de pago
                  </button>
                  <div>
                    <label className="text-xs font-semibold text-gray-300 mb-1.5 block">¿Con cuánto vas a pagar?</label>
                    <input
                      type="number"
                      min={tarifaEstimada}
                      step="0.01"
                      value={montoEntregado}
                      onChange={(e) => setMontoEntregado(e.target.value)}
                      placeholder={`Mínimo $${tarifaEstimada}`}
                      className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-brand-yellow"
                    />
                  </div>
                  {vueltoPreview > 0 && (
                    <p className="text-xs text-gray-400">
                      Vuelto estimado: <span className="text-brand-yellow font-semibold">${vueltoPreview.toFixed(2)}</span> — si no
                      lo recibes en efectivo, quedará como saldo a favor en tu cuenta.
                    </p>
                  )}
                  {error && <p className="text-sm text-red-400">{error}</p>}
                  <button
                    onClick={handleCrearServicio}
                    disabled={creandoServicio || Number(montoEntregado || 0) < tarifaEstimada}
                    className="w-full py-3.5 px-4 bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none text-black font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                  >
                    {creandoServicio && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirmar y Notificar al Gruero
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <button onClick={() => setMetodoPago(null)} className="text-xs text-gray-400 hover:text-white">
                    ← Cambiar método de pago
                  </button>
                  {!datosPagoMovil ? (
                    <p className="text-xs text-gray-400 animate-pulse">Cargando datos de pago móvil...</p>
                  ) : (
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 space-y-2 text-sm">
                      <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Transfiere a esta cuenta</p>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Banco:</span>
                        <span className="text-white font-medium">{datosPagoMovil.banco}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Teléfono:</span>
                        <span className="text-white font-medium flex items-center gap-1.5">
                          {datosPagoMovil.telefono}
                          <Copy
                            className="w-3.5 h-3.5 cursor-pointer text-gray-500 hover:text-white"
                            onClick={() => navigator.clipboard.writeText(datosPagoMovil.telefono)}
                          />
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Cédula/RIF:</span>
                        <span className="text-white font-medium">{datosPagoMovil.cedulaORif}</span>
                      </div>
                      <hr className="border-gray-700" />
                      <div className="flex items-center justify-between text-base">
                        <span className="text-gray-300">Monto a pagar:</span>
                        <span className="font-bold text-brand-yellow">${tarifaEstimada}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-gray-300 mb-1.5 block">
                      Número de referencia de tu transferencia
                    </label>
                    <input
                      value={referenciaPago}
                      onChange={(e) => setReferenciaPago(e.target.value)}
                      placeholder="Ej: 003456789"
                      className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-brand-yellow"
                    />
                  </div>

                  {error && <p className="text-sm text-red-400">{error}</p>}

                  <button
                    onClick={handleCrearServicio}
                    disabled={creandoServicio || referenciaPago.trim().length < 4}
                    className="w-full py-3.5 px-4 bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none text-black font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                  >
                    {creandoServicio && <Loader2 className="w-4 h-4 animate-spin" />}
                    Ya pagué, enviar referencia
                  </button>
                </div>
              )}
            </div>
          ) : estado === 'PENDIENTE_PAGO' ? (
            /* Esperando que el admin verifique el pago móvil */
            <div className="space-y-6 flex-1 flex flex-col justify-center items-center text-center">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
              <div>
                <h3 className="text-base font-bold text-white">Verificando tu pago móvil...</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Referencia: {servicioActual?.pago?.referencia} — un administrador la está confirmando
                </p>
              </div>
              <button onClick={handleCancelar} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> Cancelar solicitud
              </button>
            </div>
          ) : estado === 'SOLICITADO' ? (
            /* Esperando que el gruero elegido acepte */
            <div className="space-y-6 flex-1 flex flex-col justify-center items-center text-center">
              <Loader2 className="w-10 h-10 text-brand-yellow animate-spin" />
              <div>
                <h3 className="text-base font-bold text-white">Esperando que {servicioActual?.gruero?.usuario.nombre} acepte...</h3>
                <p className="text-xs text-gray-400 mt-1">Ya le llegó tu solicitud</p>
              </div>
              <button onClick={handleCancelar} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> Cancelar solicitud
              </button>
            </div>
          ) : estado === 'ASIGNADO' || estado === 'EN_CAMINO' || estado === 'LLEGADA' || estado === 'EN_TRASLADO' ? (
            /* Gruero real asignado, con su ubicación en vivo */
            <div className="space-y-6">
              <div className="bg-green-950/40 border border-green-800/50 p-4 rounded-2xl text-center space-y-1">
                <ShieldCheck className="w-8 h-8 text-green-400 mx-auto mb-1" />
                <h3 className="text-base font-bold text-green-400">
                  {estado === 'EN_TRASLADO' ? '¡Traslado Iniciado!' : '¡Grúa Asignada!'}
                </h3>
                <p className="text-xs text-gray-300">
                  {servicioActual?.gruero?.usuario.nombre} · {servicioActual?.gruero?.tipoGrua} (Placa {servicioActual?.gruero?.placa})
                </p>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 space-y-2">
                <p className="text-xs text-gray-400 uppercase font-semibold">Estado</p>
                <p className="text-lg font-bold text-brand-yellow">
                  {estado === 'EN_CAMINO'
                    ? 'El gruero va en camino'
                    : estado === 'LLEGADA'
                    ? 'El gruero llegó a tu ubicación'
                    : estado === 'EN_TRASLADO'
                    ? 'Traslado iniciado: tu vehículo va camino a su destino'
                    : 'Asignado, esperando que inicie el viaje'}
                </p>
                {!grueroPos && (
                  <p className="text-xs text-gray-500">Aún no recibimos su ubicación en vivo, espera un momento...</p>
                )}
              </div>

              <button
                onClick={() => { setMostrarChat(true); setMensajesNoLeidos(0); }}
                className="group w-full py-3 border border-brand-yellow/40 hover:border-brand-yellow hover:bg-brand-yellow bg-gray-800 text-brand-yellow hover:text-black font-medium rounded-xl flex items-center justify-center gap-2 transition relative"
              >
                <MessageCircle className="w-4 h-4 text-brand-yellow group-hover:text-black" />
                Chatear con el gruero
                {mensajesNoLeidos > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {mensajesNoLeidos}
                  </span>
                )}
              </button>

              {servicioActual?.gruero?.usuario.telefono && (
                <a
                  href={`tel:${servicioActual.gruero.usuario.telefono}`}
                  className="group w-full py-3 border border-brand-yellow/40 hover:border-brand-yellow hover:bg-brand-yellow bg-gray-800 text-brand-yellow hover:text-black font-medium rounded-xl flex items-center justify-center gap-2 transition"
                >
                  <PhoneCall className="w-4 h-4 text-green-400 group-hover:text-black" />
                  Llamar al Conductor
                </a>
              )}

              <button
                onClick={handleCancelar}
                className="w-full py-2.5 text-xs text-gray-400 hover:text-white flex items-center justify-center gap-1 transition"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancelar Servicio
              </button>
            </div>
          ) : (
            /* COMPLETADO o CANCELADO */
            <div className="space-y-6 flex-1 flex flex-col justify-center items-center text-center">
              {estado === 'COMPLETADO' ? (
                <>
                  <ShieldCheck className="w-10 h-10 text-green-400" />
                  <h3 className="text-base font-bold text-white">Servicio completado</h3>
                  {servicioActual?.pago?.metodo === 'EFECTIVO' && servicioActual.pago.vuelto ? (
                    <p className="text-xs text-gray-400">
                      Tu vuelto de ${servicioActual.pago.vuelto.toFixed(2)} quedó como saldo a favor en tu cuenta.
                    </p>
                  ) : null}

                  {servicioActual?.calificacion ? (
                    <p className="text-xs text-green-400">¡Gracias por calificar el servicio!</p>
                  ) : (
                    <div className="w-full bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 space-y-3">
                      <p className="text-sm text-white font-semibold">¿Cómo estuvo el servicio?</p>
                      <EstrellasInput valor={estrellas} onChange={setEstrellas} />
                      <textarea
                        value={comentarioCalificacion}
                        onChange={(e) => setComentarioCalificacion(e.target.value)}
                        placeholder="Cuéntanos cómo te fue (opcional)"
                        rows={2}
                        className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl py-2 px-3 focus:outline-none focus:border-brand-yellow resize-none"
                      />
                      <button
                        onClick={handleCalificar}
                        disabled={estrellas === 0 || enviandoCalificacion}
                        className="w-full py-2.5 bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none text-black font-bold rounded-xl transition"
                      >
                        {enviandoCalificacion ? 'Enviando...' : 'Enviar calificación'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <XCircle className="w-10 h-10 text-gray-500" />
                  <h3 className="text-base font-bold text-white">
                    {servicioActual?.pago?.estado === 'RECHAZADO' ? 'Tu pago no pudo ser verificado' : 'Servicio cancelado'}
                  </h3>
                </>
              )}
              <button
                onClick={nuevaSolicitud}
                className="py-2.5 px-5 bg-brand-yellow hover:bg-yellow-500 text-black font-bold rounded-xl transition"
              >
                Ir al inicio
              </button>
            </div>
          )}
        </aside>

        <div className="flex-1 h-full w-full">
          <Map
            origin={origin}
            destination={destination}
            routeCoords={routeCoords}
            cranePos={grueroPos}
            craneBearing={grueroBearing}
            craneTipoGrua={servicioActual?.gruero?.tipoGrua}
            recorridoReal={recorridoReal}
            isLiveTracking={bloqueadoParaEditar}
            onOriginDragEnd={handleOriginDrag}
            onDestinationDragEnd={handleDestinationDrag}
            grueros={marcadoresGruero}
            grueroSeleccionadoId={grueroElegido?.id ?? null}
            onSeleccionarGruero={(id) => {
              const encontrado = gruerosCercanos.find((g) => g.id === id);
              if (encontrado) setGrueroElegido(encontrado);
            }}
          />
        </div>
      </main>

      {mostrarChat && servicioActual && (
        <ChatPanel servicioId={servicioActual.id} usuarioId={usuario.id} onCerrar={() => setMostrarChat(false)} />
      )}

      {mostrarSolicitarRetiro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <div
            className="w-full max-w-sm rounded-2xl border border-gray-800 shadow-2xl p-6 space-y-4"
            style={{ backgroundColor: 'rgba(17,17,17,0.96)' }}
          >
            {retiroEnviado ? (
              <div className="text-center space-y-3 py-4">
                <ShieldCheck className="w-10 h-10 text-green-400 mx-auto" />
                <h3 className="text-base font-bold text-white">Solicitud enviada</h3>
                <p className="text-xs text-gray-400">
                  Un administrador va a transferirte y marcar tu pago como hecho. Se descontará de tu saldo a favor.
                </p>
                <button
                  onClick={() => {
                    setMostrarSolicitarRetiro(false);
                    setRetiroEnviado(false);
                    setMontoRetiro('');
                    setBancoRetiro('');
                    setCedulaRetiro('');
                  }}
                  className="py-2.5 px-5 bg-brand-yellow hover:bg-yellow-500 text-black font-bold rounded-xl transition"
                >
                  Listo
                </button>
              </div>
            ) : usuario.saldoAFavor < RETIRO_CLIENTE_MINIMO ? (
              <div className="text-center space-y-3 py-4">
                <Wallet className="w-10 h-10 text-gray-500 mx-auto" />
                <h3 className="text-base font-bold text-white">Saldo insuficiente para retirar</h3>
                <p className="text-xs text-gray-400">
                  Tienes ${usuario.saldoAFavor.toFixed(2)} a favor. Necesitas al menos ${RETIRO_CLIENTE_MINIMO} acumulados
                  para poder solicitar que te lo devuelvan.
                </p>
                <button
                  onClick={() => setMostrarSolicitarRetiro(false)}
                  className="py-2.5 px-5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-semibold rounded-xl transition"
                >
                  Entendido
                </button>
              </div>
            ) : (
              <form onSubmit={handleEnviarSolicitudRetiro} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-brand-yellow">Solicitar mi saldo</h3>
                  <button type="button" onClick={() => setMostrarSolicitarRetiro(false)} className="text-gray-400 hover:text-white">
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Tienes <span className="text-green-400 font-semibold">${usuario.saldoAFavor.toFixed(2)}</span> a favor.
                  Indica cuánto quieres que te transfieran (mínimo ${RETIRO_CLIENTE_MINIMO}) y a qué cuenta.
                </p>

                <div>
                  <label className="text-xs font-semibold text-gray-300 mb-1.5 block">Monto a solicitar</label>
                  <input
                    type="number"
                    step="0.01"
                    min={RETIRO_CLIENTE_MINIMO}
                    max={usuario.saldoAFavor}
                    value={montoRetiro}
                    onChange={(e) => setMontoRetiro(e.target.value)}
                    placeholder={`Entre $${RETIRO_CLIENTE_MINIMO} y $${usuario.saldoAFavor.toFixed(2)}`}
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-brand-yellow"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 mb-1.5 block">Banco</label>
                  <input
                    value={bancoRetiro}
                    onChange={(e) => setBancoRetiro(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-brand-yellow"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 mb-1.5 block">Teléfono (Pago Móvil)</label>
                  <input
                    value={telefonoRetiro}
                    onChange={(e) => setTelefonoRetiro(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-brand-yellow"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 mb-1.5 block">Cédula/RIF</label>
                  <input
                    value={cedulaRetiro}
                    onChange={(e) => setCedulaRetiro(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-brand-yellow"
                    required
                  />
                </div>

                {errorRetiro && <p className="text-sm text-red-400">{errorRetiro}</p>}

                <button
                  type="submit"
                  disabled={enviandoRetiro}
                  className="w-full py-3 px-4 bg-brand-yellow hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-black font-bold rounded-xl shadow-lg transition"
                >
                  {enviandoRetiro ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
