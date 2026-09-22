import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import iconoGrueGancho from '../assets/icons/grua-gancho.png';
import iconoGrueaPlataforma from '../assets/icons/grua-plataforma.png';
import { distanciaKmEntre } from '../utils/geo';
import type { Coordenadas, Servicio } from '../types';

function obtenerImagenGrua(tipoGrua: string): string {
  return /plataforma/i.test(tipoGrua) ? iconoGrueaPlataforma : iconoGrueGancho;
}

function crearIconoGruero(tipoGrua: string) {
  return L.divIcon({
    className: 'crane-own-marker',
    html: `<div style="width:40px;height:40px;filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.5));">
      <img src="${obtenerImagenGrua(tipoGrua)}" style="width:100%;height:100%;object-fit:contain;" />
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function crearIconoSolicitud(seleccionado: boolean) {
  return L.divIcon({
    className: 'solicitud-marker',
    html: `<div style="
      background-color: ${seleccionado ? '#FFC107' : '#ef4444'};
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 10px rgba(0,0,0,0.6);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

const createPinIcon = (color: string) =>
  L.divIcon({
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

const origenIcon = createPinIcon('#22c55e');
const destinoIcon = createPinIcon('#ef4444');

/**
 * Centra/encuadra el mapa: si hay un servicio en curso (origen + destino
 * conocidos), encuadra origen + destino + la posición del gruero juntos —
 * igual que en el mapa del cliente — para que la ruta nunca se salga de
 * vista. Si la posición real está absurdamente lejos (GPS de prueba), se
 * ignora para el encuadre y solo se centra en origen/destino.
 */
function Centrador({
  posicionGruero,
  origen,
  destino,
}: {
  posicionGruero: Coordenadas | null;
  origen: Coordenadas | null;
  destino: Coordenadas | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (origen && destino) {
      const posEsRazonable =
        posicionGruero &&
        Math.min(distanciaKmEntre(origen, posicionGruero), distanciaKmEntre(destino, posicionGruero)) < 300;

      const puntos: Coordenadas[] = posEsRazonable ? [origen, destino, posicionGruero!] : [origen, destino];
      map.fitBounds(L.latLngBounds(puntos), { padding: [60, 60] });
    } else if (posicionGruero) {
      map.setView(posicionGruero, Math.max(map.getZoom(), 13));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posicionGruero?.[0], posicionGruero?.[1], origen?.[0], origen?.[1], destino?.[0], destino?.[1]]);

  return null;
}

interface MapaGrueroProps {
  posicionGruero: Coordenadas | null;
  tipoGrua: string;
  servicios: Servicio[];
  servicioSeleccionadoId: string | null;
  onSeleccionarServicio: (servicio: Servicio) => void;
  /** Cuando hay un servicio en curso: su ruta planeada y sus puntos, para dibujarlos en el mapa. */
  rutaEnCurso?: {
    origen: Coordenadas;
    destino: Coordenadas;
    routeCoords: Coordenadas[];
  } | null;
}

export function MapaGruero({
  posicionGruero,
  tipoGrua,
  servicios,
  servicioSeleccionadoId,
  onSeleccionarServicio,
  rutaEnCurso,
}: MapaGrueroProps) {
  const centro: Coordenadas = posicionGruero || rutaEnCurso?.origen || [10.4806, -66.9036]; // Caracas como fallback

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer center={centro} zoom={13} scrollWheelZoom className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Centrador
          posicionGruero={posicionGruero}
          origen={rutaEnCurso?.origen ?? null}
          destino={rutaEnCurso?.destino ?? null}
        />

        {posicionGruero && (
          <Marker position={posicionGruero} icon={crearIconoGruero(tipoGrua)}>
            <Popup>
              <span className="font-bold">Tu ubicación</span>
            </Popup>
          </Marker>
        )}

        {rutaEnCurso && (
          <>
            <Marker position={rutaEnCurso.origen} icon={origenIcon}>
              <Popup><span className="font-bold">Punto de la avería</span></Popup>
            </Marker>
            <Marker position={rutaEnCurso.destino} icon={destinoIcon}>
              <Popup><span className="font-bold">Destino (taller)</span></Popup>
            </Marker>
            {rutaEnCurso.routeCoords.length > 0 && (
              <Polyline positions={rutaEnCurso.routeCoords} pathOptions={{ color: '#22c55e', weight: 6, opacity: 0.85 }} />
            )}
          </>
        )}

        {servicios.map((s) => (
          <Marker
            key={s.id}
            position={[s.origenLat, s.origenLng]}
            icon={crearIconoSolicitud(s.id === servicioSeleccionadoId)}
            eventHandlers={{ click: () => onSeleccionarServicio(s) }}
          >
            <Popup>
              <span className="font-semibold">{s.origenDireccion}</span>
              <br />→ {s.destinoDireccion}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
