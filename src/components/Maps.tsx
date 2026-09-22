import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import iconoGrueGancho from '../assets/icons/grua-gancho.png';
import iconoGrueaPlataforma from '../assets/icons/grua-plataforma.png';
import { distanciaKmEntre } from '../utils/geo';

// Icono estático de origen y destino
const createPinIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `<div style="
      background-color: ${color};
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 10px rgba(0,0,0,0.6);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
};

// Elige la imagen real de grúa según lo que el gruero escribió como tipo
// (formulario libre: "Plataforma", "Grúa de arrastre", "Canastilla"...).
function obtenerImagenGrua(tipoGrua: string): string {
  return /plataforma/i.test(tipoGrua) ? iconoGrueaPlataforma : iconoGrueGancho;
}

// Icono animado de la grúa en movimiento (usa la imagen real según su tipo)
const createCraneIcon = (rotation: number, tipoGrua = '') => {
  return L.divIcon({
    className: 'crane-live-marker',
    html: `<div style="
      width: 42px;
      height: 42px;
      transform: rotate(${rotation}deg);
      transition: all 0.3s linear;
      filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.5));
    "><img src="${obtenerImagenGrua(tipoGrua)}" style="width:100%;height:100%;object-fit:contain;" /></div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });
};

const originIcon = createPinIcon('#22c55e');
const destinationIcon = createPinIcon('#ef4444');

// Icono de un gruero cercano seleccionable en el mapa, con su imagen real de grúa
const crearIconoGruero = (tipoGrua: string, seleccionado: boolean) =>
  L.divIcon({
    className: 'gruero-map-marker',
    html: `<div style="
      background-color: white;
      width: 46px;
      height: 46px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 3px solid ${seleccionado ? '#FFC107' : '#1f2937'};
      box-shadow: 0 0 10px rgba(0,0,0,0.6);
    "><img src="${obtenerImagenGrua(tipoGrua)}" style="width:100%;height:100%;object-fit:cover;" /></div>`,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });

export interface GrueroMarcador {
  id: string;
  lat: number;
  lng: number;
  nombre: string;
  tipoGrua: string;
  placa: string;
  fotoUrl?: string | null;
}

const CENTRO_POR_DEFECTO: [number, number] = [8.0, -66.5]; // Venezuela, cuando aún no hay origen elegido

// Controlador de cámara para seguir a la grúa en modo Live
function MapController({ 
  cranePos, 
  isLiveTracking, 
  origin, 
  destination 
}: { 
  cranePos: [number, number] | null; 
  isLiveTracking: boolean;
  origin: [number, number] | null; 
  destination: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    // Si la posición real reportada está absurdamente lejos del trayecto
    // (típico al probar con el GPS real del navegador en vez de una
    // ubicación dentro del área de servicio), no dejamos que arrastre el
    // encuadre — así la ruta nunca se "pierde" por un zoom exagerado.
    const cranePosEsRazonable =
      cranePos && origin && destination
        ? Math.min(distanciaKmEntre(origin, cranePos), distanciaKmEntre(destination, cranePos)) < 300
        : false;

    if (isLiveTracking && cranePos && origin && destination && cranePosEsRazonable) {
      // Encuadra origen + destino + la posición actual de la grúa juntos,
      // para que la ruta trazada nunca se salga de la vista mientras se sigue
      // el movimiento en vivo.
      const bounds = L.latLngBounds([origin, destination, cranePos]);
      map.fitBounds(bounds, { padding: [70, 70] });
    } else if (isLiveTracking && origin && destination) {
      const bounds = L.latLngBounds([origin, destination]);
      map.fitBounds(bounds, { padding: [60, 60] });
    } else if (isLiveTracking && cranePos) {
      map.panTo(cranePos, { animate: true, duration: 0.5 });
    } else if (origin && destination) {
      const bounds = L.latLngBounds([origin, destination]);
      map.fitBounds(bounds, { padding: [60, 60] });
    } else if (origin) {
      map.setView(origin, 13);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cranePos?.[0], cranePos?.[1], isLiveTracking, origin, destination, map]);

  return null;
}

interface MapProps {
  origin: [number, number] | null;
  destination: [number, number] | null;
  routeCoords: [number, number][];
  cranePos: [number, number] | null;
  craneBearing: number;
  isLiveTracking: boolean;
  onOriginDragEnd: (coords: [number, number]) => void;
  onDestinationDragEnd: (coords: [number, number]) => void;
  /** Tipo de grúa asignada, para mostrar la imagen correcta en el marcador en vivo. */
  craneTipoGrua?: string;
  /** Camino realmente recorrido por la grúa (posiciones reales recibidas por socket), se va dibujando en vivo. */
  recorridoReal?: [number, number][];
  /** Grueros cercanos que el cliente puede elegir, mostrados como marcadores clicables. */
  grueros?: GrueroMarcador[];
  grueroSeleccionadoId?: string | null;
  onSeleccionarGruero?: (id: string) => void;
}

export const Map: React.FC<MapProps> = ({ 
  origin, 
  destination, 
  routeCoords, 
  cranePos,
  craneBearing,
  isLiveTracking,
  onOriginDragEnd, 
  onDestinationDragEnd,
  craneTipoGrua,
  recorridoReal,
  grueros,
  grueroSeleccionadoId,
  onSeleccionarGruero,
}) => {
  const originMarkerRef = useRef<L.Marker>(null);
  const destinationMarkerRef = useRef<L.Marker>(null);

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={origin ?? CENTRO_POR_DEFECTO} 
        zoom={origin ? 14 : 6} 
        scrollWheelZoom={true} 
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController 
          cranePos={cranePos} 
          isLiveTracking={isLiveTracking} 
          origin={origin} 
          destination={destination} 
        />

        {/* Punto de origen / avería */}
        {origin && (
          <Marker 
            position={origin} 
            icon={originIcon} 
            draggable={!isLiveTracking}
            eventHandlers={{
              dragend() {
                const marker = originMarkerRef.current;
                if (marker) {
                  const latLng = marker.getLatLng();
                  onOriginDragEnd([latLng.lat, latLng.lng]);
                }
              }
            }}
            ref={originMarkerRef}
          >
            <Popup><span className="font-bold">Ubicación de la Avería</span></Popup>
          </Marker>
        )}

        {/* Punto de destino / taller */}
        {destination && (
          <Marker 
            position={destination} 
            icon={destinationIcon} 
            draggable={!isLiveTracking}
            eventHandlers={{
              dragend() {
                const marker = destinationMarkerRef.current;
                if (marker) {
                  const latLng = marker.getLatLng();
                  onDestinationDragEnd([latLng.lat, latLng.lng]);
                }
              }
            }}
            ref={destinationMarkerRef}
          >
            <Popup><span className="font-bold">Destino / Taller</span></Popup>
          </Marker>
        )}

        {/* Grúa en movimiento en Modo Live */}
        {isLiveTracking && cranePos && (
          <Marker position={cranePos} icon={createCraneIcon(craneBearing, craneTipoGrua)}>
            <Popup><span className="font-bold text-blue-600">Grúa PickCrane en camino</span></Popup>
          </Marker>
        )}

        {/* Grueros cercanos que el cliente puede elegir */}
        {grueros?.map((g) => (
          <Marker
            key={g.id}
            position={[g.lat, g.lng]}
            icon={crearIconoGruero(g.tipoGrua, g.id === grueroSeleccionadoId)}
            eventHandlers={{ click: () => onSeleccionarGruero?.(g.id) }}
          >
            <Popup>
              <div style={{ minWidth: 150 }}>
                {g.fotoUrl && (
                  <img
                    src={g.fotoUrl}
                    alt={g.tipoGrua}
                    style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }}
                  />
                )}
                <div style={{ fontWeight: 700 }}>{g.nombre}</div>
                <div style={{ fontSize: 12, color: '#555' }}>{g.tipoGrua} · Placa {g.placa}</div>
                {g.id === grueroSeleccionadoId && (
                  <div style={{ fontSize: 11, color: '#b45309', fontWeight: 700, marginTop: 4 }}>✓ Elegido para este servicio</div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Línea de ruta planeada (origen -> destino) */}
        {routeCoords.length > 0 && (
          <Polyline 
            positions={routeCoords} 
            pathOptions={{ color: isLiveTracking ? '#22c55e' : '#3b82f6', weight: 6, opacity: 0.8 }} 
          />
        )}

        {/* Recorrido REAL de la grúa (posiciones reales recibidas en vivo), se va dibujando a medida que se mueve */}
        {recorridoReal && recorridoReal.length > 1 && (
          <Polyline
            positions={recorridoReal}
            pathOptions={{ color: '#a855f7', weight: 5, opacity: 0.95, dashArray: undefined }}
          />
        )}
      </MapContainer>
    </div>
  );
};