import { useState, useEffect, useRef } from 'react';
import { Map } from './components/Maps';
import { LocationSearchInput } from './components/LocationSearchInput';
import { Truck, Navigation, Route, Clock, DollarSign, ShieldCheck, PhoneCall, RotateCcw } from 'lucide-react';
import axios from 'axios';

// Calcular el ángulo (bearing) entre dos coordenadas
function calculateBearing(start: [number, number], end: [number, number]): number {
  const startLat = (start[0] * Math.PI) / 180;
  const startLng = (start[1] * Math.PI) / 180;
  const endLat = (end[0] * Math.PI) / 180;
  const endLng = (end[1] * Math.PI) / 180;

  const dLng = endLng - startLng;
  const y = Math.sin(dLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export default function App() {
  const [origin, setOrigin] = useState<[number, number]>([10.2541, -67.9831]);
  const [originName, setOriginName] = useState<string>('San Diego, Carabobo');

  const [destination, setDestination] = useState<[number, number] | null>([10.2281, -67.8778]);
  const [destinationName, setDestinationName] = useState<string>('Guacara, Carabobo');

  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [durationMin, setDurationMin] = useState<number>(0);
  const [loadingRoute, setLoadingRoute] = useState<boolean>(false);

  // Estados del Modo Seguimiento en Vivo
  const [isLiveTracking, setIsLiveTracking] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [cranePos, setCranePos] = useState<[number, number] | null>(null);
  const [craneBearing, setCraneBearing] = useState<number>(0);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const intervalRef = useRef<number | null>(null);

  // Geocodificación inversa para arrastre
  const fetchAddressFromCoords = async (coords: [number, number]): Promise<string> => {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: { lat: coords[0], lon: coords[1], format: 'json' },
      });
      return response.data?.display_name || `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
    } catch {
      return `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
    }
  };

  const handleOriginDrag = async (newCoords: [number, number]) => {
    setOrigin(newCoords);
    const address = await fetchAddressFromCoords(newCoords);
    setOriginName(address);
  };

  const handleDestinationDrag = async (newCoords: [number, number]) => {
    setDestination(newCoords);
    const address = await fetchAddressFromCoords(newCoords);
    setDestinationName(address);
  };

  // Traer trazado de OSRM
  useEffect(() => {
    if (!origin || !destination) return;

    const fetchRoute = async () => {
      setLoadingRoute(true);
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`;
        const response = await axios.get(url);
        const data = response.data;

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coordinates = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);

          setRouteCoords(coordinates);
          setDistanceKm(Number((route.distance / 1000).toFixed(1)));
          setDurationMin(Math.round(route.duration / 60));
        }
      } catch (err) {
        console.error('Error calculando ruta:', err);
      } finally {
        setLoadingRoute(false);
      }
    };

    fetchRoute();
  }, [origin, destination]);

  // Iniciar la Simulación de Seguimiento en Vivo
  const startLiveTracking = () => {
    if (routeCoords.length === 0) return;
    setIsLiveTracking(true);
    setCurrentStepIndex(0);
    setCranePos(routeCoords[0]);
    setRemainingTime(durationMin);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = window.setInterval(() => {
      setCurrentStepIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;
        
        if (nextIndex >= routeCoords.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return prevIndex;
        }

        const currentCoord = routeCoords[prevIndex];
        const nextCoord = routeCoords[nextIndex];

        setCranePos(nextCoord);
        setCraneBearing(calculateBearing(currentCoord, nextCoord));

        // Actualizar ETA proporcionalmente
        const progress = nextIndex / routeCoords.length;
        setRemainingTime(Math.max(1, Math.round(durationMin * (1 - progress))));

        return nextIndex;
      });
    }, 400); // Avanza cada 400ms a lo largo de la ruta
  };

  const stopLiveTracking = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsLiveTracking(false);
    setCranePos(null);
  };

  const estimatedCost = (20 + distanceKm * 1.5).toFixed(2);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-brand-dark font-sans">
      {/* Header */}
      <header className="bg-brand-gray border-b border-gray-800 p-4 flex items-center justify-between text-white shadow-md z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-brand-yellow p-2 rounded-lg text-black font-bold">
            <Truck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-wider text-brand-yellow">PickCrane</h1>
        </div>
        {isLiveTracking && (
          <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/40 px-3 py-1.5 rounded-full text-green-400 text-xs font-semibold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            En Ruta Activa (Live Tracking)
          </div>
        )}
      </header>

      {/* Contenedor Principal */}
      <main className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
        {/* Panel Lateral */}
        <aside className="w-full md:w-96 bg-brand-gray border-r border-gray-800 p-6 z-10 shadow-2xl flex flex-col justify-between overflow-y-auto">
          {!isLiveTracking ? (
            /* Modo Configuración de Solicitud */
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
                  key={`orig-${origin[0]}-${origin[1]}`}
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

              {loadingRoute ? (
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
                  <div className="flex items-center justify-between text-base">
                    <span className="text-gray-300 font-medium flex items-center gap-1">
                      <DollarSign className="w-5 h-5 text-brand-yellow" /> Tarifa estimada:
                    </span>
                    <span className="font-bold text-brand-yellow text-lg">${estimatedCost}</span>
                  </div>
                </div>
              )}

              <button 
                onClick={startLiveTracking}
                disabled={loadingRoute || routeCoords.length === 0}
                className="w-full py-3.5 px-4 bg-brand-yellow hover:bg-yellow-500 disabled:opacity-50 text-black font-bold rounded-xl shadow-lg transition duration-200"
              >
                Confirmar Servicio de Grúa
              </button>
            </div>
          ) : (
            /* Modo Navegación Estilo Google Maps */
            <div className="space-y-6">
              <div className="bg-green-950/40 border border-green-800/50 p-4 rounded-2xl text-center space-y-1">
                <ShieldCheck className="w-8 h-8 text-green-400 mx-auto mb-1" />
                <h3 className="text-base font-bold text-green-400">¡Grúa Asignada y en Camino!</h3>
                <p className="text-xs text-gray-300">Unidad Platillo #104 (Carlos Mendoza)</p>
              </div>

              {/* Tarjeta ETA */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-semibold">Tiempo Estimado de Llegada</p>
                    <p className="text-3xl font-extrabold text-brand-yellow">{remainingTime} min</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 uppercase font-semibold">Velocidad Promedio</p>
                    <p className="text-lg font-bold text-white">45 km/h</p>
                  </div>
                </div>

                <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-brand-yellow h-full transition-all duration-300"
                    style={{ width: `${(currentStepIndex / routeCoords.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Botón de Contacto */}
              <button className="w-full py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition">
                <PhoneCall className="w-4 h-4 text-green-400" />
                Llamar al Conductor
              </button>

              {/* Cancelar / Volver */}
              <button 
                onClick={stopLiveTracking}
                className="w-full py-2.5 text-xs text-gray-400 hover:text-white flex items-center justify-center gap-1 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Finalizar o Cancelar Seguimiento
              </button>
            </div>
          )}
        </aside>

        {/* Componente del Mapa */}
        <div className="flex-1 h-full w-full">
          <Map 
            origin={origin} 
            destination={destination} 
            routeCoords={routeCoords}
            cranePos={cranePos}
            craneBearing={craneBearing}
            isLiveTracking={isLiveTracking}
            onOriginDragEnd={handleOriginDrag}
            onDestinationDragEnd={handleDestinationDrag}
          />
        </div>
      </main>
    </div>
  );
}