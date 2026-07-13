'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';

function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [map, center, zoom]);
  return null;
}

function DrawingLayer({
  points,
  onAddPoint,
  onMovePoint,
  draggingIndex,
  setDraggingIndex,
}: {
  points: [number, number][];
  onAddPoint: (latlng: LatLng) => void;
  onMovePoint: (index: number, latlng: LatLng) => void;
  draggingIndex: number | null;
  setDraggingIndex: (index: number | null) => void;
}) {
  const map = useMap();

  useMapEvents({
    click: (e) => {
      if (draggingIndex !== null) return;
      onAddPoint(e.latlng);
    },
    mousemove: (e) => {
      if (draggingIndex !== null) {
        onMovePoint(draggingIndex, e.latlng);
      }
    },
    mouseup: () => {
      if (draggingIndex !== null) {
        setDraggingIndex(null);
        map.dragging.enable();
      }
    },
  });

  function handleVertexMouseDown(index: number) {
    setDraggingIndex(index);
    map.dragging.disable();
  }

  return (
    <>
      {points.length >= 3 && (
        <Polygon
          positions={points}
          pathOptions={{ color: '#15803d', fillOpacity: 0.15, weight: 2 }}
        />
      )}
      {points.length >= 2 && points.length < 3 && (
        <Polyline
          positions={points}
          pathOptions={{ color: '#15803d', weight: 2, dashArray: '6 4' }}
        />
      )}
      {points.map((p, i) => (
        <CircleMarker
          key={i}
          center={p}
          radius={6}
          pathOptions={{
            color: '#15803d',
            fillColor: draggingIndex === i ? '#facc15' : i === 0 ? '#22c55e' : '#fff',
            fillOpacity: 1,
            weight: 2,
            className: 'cursor-grab',
          }}
          eventHandlers={{
            mousedown: (e) => {
              e.originalEvent.stopPropagation();
              e.originalEvent.preventDefault();
              handleVertexMouseDown(i);
            },
          }}
        />
      ))}
    </>
  );
}

export default function BoundaryDrawer({
  initial,
  center,
  onSave,
  onCancel,
}: {
  initial?: [number, number][] | null;
  center: [number, number];
  onSave: (boundaries: [number, number][] | null) => void;
  onCancel: () => void;
}) {
  const [points, setPoints] = useState<[number, number][]>(initial ?? []);
  const [zoom] = useState(initial && initial.length > 0 ? 15 : 14);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const [flyTarget, setFlyTarget] = useState<{ center: [number, number]; zoom: number } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAddPoint = useCallback((latlng: LatLng) => {
    setPoints((prev) => [...prev, [latlng.lat, latlng.lng]]);
  }, []);

  const handleMovePoint = useCallback((index: number, latlng: LatLng) => {
    setPoints((prev) => prev.map((p, i) => (i === index ? [latlng.lat, latlng.lng] : p)));
  }, []);

  function handleUndo() {
    setPoints((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    setPoints([]);
  }

  function handleSave() {
    onSave(points.length >= 3 ? points : null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) handleUndo();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=br&q=${encodeURIComponent(trimmed)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
        setSearchResults(
          data.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) })),
        );
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  function selectResult(r: { lat: number; lng: number }) {
    setSearchResults([]);
    setSearchQuery('');
    setFlyTarget({ center: [r.lat, r.lng], zoom: 14 });
  }

  const mapCenter = initial && initial.length > 0
    ? ([
        initial.reduce((s, p) => s + p[0], 0) / initial.length,
        initial.reduce((s, p) => s + p[1], 0) / initial.length,
      ] as [number, number])
    : center;

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar cidade ou região..."
          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
        />
        {searching && <p className="mt-1 text-xs text-gray-400">Buscando...</p>}
        {searchResults.length > 0 && (
          <ul className="absolute z-[1000] mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-gray-200/80 bg-white shadow-sm p-1 shadow-md">
            {searchResults.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => selectResult(r)}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-emerald-50"
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <MapContainer
          center={mapCenter}
          zoom={zoom}
          style={{ height: '380px', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <DrawingLayer
            points={points}
            onAddPoint={handleAddPoint}
            onMovePoint={handleMovePoint}
            draggingIndex={draggingIndex}
            setDraggingIndex={setDraggingIndex}
          />
          {flyTarget && <FlyTo center={flyTarget.center} zoom={flyTarget.zoom} />}
        </MapContainer>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {points.length === 0
            ? 'Clique no mapa para adicionar pontos — arraste os vértices para ajustar'
            : points.length < 3
              ? `${points.length} ponto(s) — mínimo 3 para formar o polígono`
              : `${points.length} pontos — arraste os vértices para ajustar`}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={points.length === 0}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Desfazer ponto
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={points.length === 0}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-emerald-800"
          >
            Salvar croqui
          </button>
        </div>
      </div>
    </div>
  );
}
