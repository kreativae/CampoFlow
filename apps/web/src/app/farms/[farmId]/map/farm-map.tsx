'use client';

import { MapContainer, TileLayer, CircleMarker, Polygon, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapFeature } from '@/lib/types';

const FEATURE_COLORS: Record<MapFeature['type'], string> = {
  CERCA: '#92400e',
  PASTAGEM: '#15803d',
  NASCENTE: '#1d4ed8',
  RESERVA: '#6b21a8',
  OUTRO: '#6b7280',
};

export default function FarmMap({
  center,
  features,
}: {
  center: [number, number];
  features: MapFeature[];
}) {
  return (
    <MapContainer center={center} zoom={14} style={{ height: '420px', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {features.map((f) =>
        f.geometryType === 'PONTO' ? (
          <CircleMarker
            key={f.id}
            center={f.coordinates[0]}
            radius={8}
            pathOptions={{ color: FEATURE_COLORS[f.type] }}
          >
            <Tooltip>{f.name}</Tooltip>
          </CircleMarker>
        ) : (
          <Polygon key={f.id} positions={f.coordinates} pathOptions={{ color: FEATURE_COLORS[f.type] }}>
            <Tooltip>{f.name}</Tooltip>
          </Polygon>
        ),
      )}
    </MapContainer>
  );
}
