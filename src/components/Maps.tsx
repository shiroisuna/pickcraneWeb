import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

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

// Icono animado de la grúa en movimiento
const createCraneIcon = (rotation: number) => {
  return L.divIcon({
    className: 'crane-live-marker',
    html: `<div style="
      transform: rotate(${rotation}deg);
      transition: all 0.3s linear;
      font-size: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.5));
    ">🚚</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const originIcon = createPinIcon('#22c55e');
const destinationIcon = createPinIcon('#ef4444');

// Controlador de cámara para seguir a la grúa en modo Live
function MapController({ 
  cranePos, 
  isLiveTracking, 
  origin, 
  destination 
}: { 
  cranePos: [number, number] | null; 
  isLiveTracking: boolean;
  origin: [number, number]; 
  destination: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (isLiveTracking && cranePos) {
      map.panTo(cranePos, { animate: true, duration: 0.5 });
    } else if (destination) {
      const bounds = L.latLngBounds([origin, destination]);
      map.fitBounds(bounds, { padding: [60, 60] });
    } else {
      map.setView(origin, 13);
    }
  }, [cranePos, isLiveTracking, origin, destination, map]);

  return null;
}

interface MapProps {
  origin: [number, number];
  destination: [number, number] | null;
  routeCoords: [number, number][];
  cranePos: [number, number] | null;
  craneBearing: number;
  isLiveTracking: boolean;
  onOriginDragEnd: (coords: [number, number]) => void;
  onDestinationDragEnd: (coords: [number, number]) => void;
}

export const Map: React.FC<MapProps> = ({ 
  origin, 
  destination, 
  routeCoords, 
  cranePos,
  craneBearing,
  isLiveTracking,
  onOriginDragEnd, 
  onDestinationDragEnd 
}) => {
  const originMarkerRef = useRef<L.Marker>(null);
  const destinationMarkerRef = useRef<L.Marker>(null);

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={origin} 
        zoom={14} 
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
          <Marker position={cranePos} icon={createCraneIcon(craneBearing)}>
            <Popup><span className="font-bold text-blue-600">Grúa PickCrane en camino</span></Popup>
          </Marker>
        )}

        {/* Línea de ruta trazada */}
        {routeCoords.length > 0 && (
          <Polyline 
            positions={routeCoords} 
            pathOptions={{ color: isLiveTracking ? '#22c55e' : '#3b82f6', weight: 6, opacity: 0.8 }} 
          />
        )}
      </MapContainer>
    </div>
  );
};