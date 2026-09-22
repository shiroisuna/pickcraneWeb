import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import iconoGrueGancho from '../assets/icons/grua-gancho.png';
import iconoGrueaPlataforma from '../assets/icons/grua-plataforma.png';
import { urlArchivo } from '../utils/archivos';
import type { GrueroActivo } from '../types';

function obtenerImagenGrua(tipoGrua: string): string {
  return /plataforma/i.test(tipoGrua) ? iconoGrueaPlataforma : iconoGrueGancho;
}

/** Encuadra el mapa para que se vean todos los grueros activos a la vez. */
function AjustarVista({ posiciones }: { posiciones: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (posiciones.length === 0) return;
    if (posiciones.length === 1) {
      map.setView(posiciones[0], 12);
    } else {
      map.fitBounds(L.latLngBounds(posiciones), { padding: [50, 50] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posiciones.length]);
  return null;
}

interface MapaGruerosActivosProps {
  grueros: GrueroActivo[];
}

export function MapaGruerosActivos({ grueros }: MapaGruerosActivosProps) {
  const centroPorDefecto: [number, number] = [8.0, -66.5]; // Venezuela

  const posiciones = grueros.map(
    (g) => [g.ultimaLat ?? g.latitud, g.ultimaLng ?? g.longitud] as [number, number]
  );

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-gray-800" style={{ height: 480 }}>
      <MapContainer center={centroPorDefecto} zoom={6} scrollWheelZoom className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <AjustarVista posiciones={posiciones} />

        {grueros.map((g) => {
          const pos: [number, number] = [g.ultimaLat ?? g.latitud, g.ultimaLng ?? g.longitud];
          const foto = g.documentos?.[0]?.archivoUrl;
          return (
            <Marker
              key={g.id}
              position={pos}
              icon={L.divIcon({
                className: 'admin-gruero-marker',
                html: `<div style="
                  width: 42px; height: 42px; border-radius: 12px;
                  background: white; overflow: hidden; display:flex; align-items:center; justify-content:center;
                  border: 3px solid #FFC107; box-shadow: 0 0 10px rgba(0,0,0,0.6);
                "><img src="${foto ? urlArchivo(foto) : obtenerImagenGrua(g.tipoGrua)}" style="width:100%;height:100%;object-fit:cover;" /></div>`,
                iconSize: [42, 42],
                iconAnchor: [21, 21],
              })}
            >
              <Popup>
                <div style={{ minWidth: 160 }}>
                  {foto && (
                    <img
                      src={urlArchivo(foto)}
                      alt={g.tipoGrua}
                      style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }}
                    />
                  )}
                  <div style={{ fontWeight: 700 }}>{g.usuario.nombre}</div>
                  <div style={{ fontSize: 12, color: '#555' }}>{g.tipoGrua} · Placa {g.placa}</div>
                  {g.usuario.telefono && <div style={{ fontSize: 12, color: '#555' }}>{g.usuario.telefono}</div>}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
