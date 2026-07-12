'use client';

import { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polygon,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { CircleMarker as LeafletCircleMarker, LatLng, Polygon as LeafletPolygon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapFeature, MapFeatureType } from '@/lib/types';

const FEATURE_COLORS: Record<MapFeature['type'], string> = {
  CERCA: '#92400e',
  PASTAGEM: '#15803d',
  NASCENTE: '#1d4ed8',
  RESERVA: '#6b21a8',
  OUTRO: '#6b7280',
};

const QUICK_TYPE_OPTIONS: { value: MapFeatureType; label: string }[] = [
  { value: 'CERCA', label: 'Cerca' },
  { value: 'PASTAGEM', label: 'Pastagem' },
  { value: 'NASCENTE', label: 'Nascente' },
  { value: 'RESERVA', label: 'Reserva' },
  { value: 'OUTRO', label: 'Outro' },
];

function QuickCreatePopup({
  point,
  onClose,
  onQuickCreate,
}: {
  point: LatLng;
  onClose: () => void;
  onQuickCreate: (lat: number, lng: number, name: string, type: MapFeatureType) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<MapFeatureType>('PASTAGEM');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Informe um nome.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onQuickCreate(point.lat, point.lng, name, type);
      onClose();
    } catch {
      setError('Erro ao criar elemento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popup position={point} eventHandlers={{ remove: onClose }} closeButton>
      <div className="w-48 space-y-2">
        <p className="text-xs font-medium text-gray-600">Novo elemento neste ponto</p>
        <input
          type="text"
          autoFocus
          placeholder="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as MapFeatureType)}
          className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
        >
          {QUICK_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="button"
          disabled={saving}
          onClick={handleSubmit}
          className="w-full rounded-lg bg-emerald-700 px-2 py-1 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Criar'}
        </button>
      </div>
    </Popup>
  );
}

function MapEvents({ onContextMenu }: { onContextMenu: (latlng: LatLng) => void }) {
  useMapEvents({
    contextmenu: (e) => onContextMenu(e.latlng),
  });
  return null;
}

function FocusHandler({
  focusFeature,
  layerRefs,
}: {
  focusFeature: MapFeature | null;
  layerRefs: Map<string, LeafletCircleMarker | LeafletPolygon>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusFeature) return;
    if (focusFeature.geometryType === 'PONTO') {
      map.flyTo(focusFeature.coordinates[0], Math.max(map.getZoom(), 16));
    } else {
      map.flyToBounds(focusFeature.coordinates as [number, number][]);
    }
    const layer = layerRefs.get(focusFeature.id);
    if (layer) {
      window.setTimeout(() => layer.openTooltip(), 300);
    }
  }, [focusFeature, map, layerRefs]);

  return null;
}

export default function FarmMap({
  center,
  features,
  onQuickCreate,
  focusFeature,
}: {
  center: [number, number];
  features: MapFeature[];
  onQuickCreate?: (lat: number, lng: number, name: string, type: MapFeatureType) => Promise<void>;
  focusFeature?: MapFeature | null;
}) {
  const [pendingPoint, setPendingPoint] = useState<LatLng | null>(null);
  const [layerRefs] = useState(() => new Map<string, LeafletCircleMarker | LeafletPolygon>());

  return (
    <MapContainer center={center} zoom={14} style={{ height: '420px', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onQuickCreate && <MapEvents onContextMenu={setPendingPoint} />}
      {focusFeature !== undefined && <FocusHandler focusFeature={focusFeature ?? null} layerRefs={layerRefs} />}
      {pendingPoint && onQuickCreate && (
        <QuickCreatePopup
          point={pendingPoint}
          onClose={() => setPendingPoint(null)}
          onQuickCreate={onQuickCreate}
        />
      )}
      {features.map((f) =>
        f.geometryType === 'PONTO' ? (
          <CircleMarker
            key={f.id}
            ref={(instance) => {
              if (instance) layerRefs.set(f.id, instance);
              else layerRefs.delete(f.id);
            }}
            center={f.coordinates[0]}
            radius={8}
            pathOptions={{ color: FEATURE_COLORS[f.type] }}
          >
            <Tooltip>{f.name}</Tooltip>
          </CircleMarker>
        ) : (
          <Polygon
            key={f.id}
            ref={(instance) => {
              if (instance) layerRefs.set(f.id, instance);
              else layerRefs.delete(f.id);
            }}
            positions={f.coordinates}
            pathOptions={{ color: FEATURE_COLORS[f.type] }}
          >
            <Tooltip>{f.name}</Tooltip>
          </Polygon>
        ),
      )}
    </MapContainer>
  );
}
