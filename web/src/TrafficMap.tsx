import { GeoJSONSource, Map as MapLibreMap, NavigationControl, Popup, setWorkerUrl, type ExpressionSpecification, type MapLayerMouseEvent, type StyleSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { FeatureCollection, Point } from 'geojson';
import { useEffect, useRef, useState } from 'react';
import type { Counter, CounterValues } from '../../server/src/types.ts';
import { colorToken } from './design/tokens.ts';
import { de } from './i18n/de.ts';
import baseStyle from './map/base-style.json';
import { tintStyle } from './map/tint.ts';
import type { MapProblem } from './status.ts';
import { ALL_STATUSES, decisiveSpeed, laneLabel, partialText, STATUS_TOKENS, statusName, type Status } from './traffic.ts';

// Der Standardpfad des Workers zeigt im Vite-Bundle ins Leere; CSP erlaubt nur Worker vom eigenen Ursprung.
setWorkerUrl(workerUrl);

export interface MapCounter {
  counter: Counter;
  values: CounterValues | undefined;
  status: Status;
}

export interface MapFocus {
  lat: number;
  lng: number;
  /** ändert sich bei jeder Suche, damit auch dieselbe Zählstelle erneut angeflogen wird */
  key: number;
}

interface Props {
  counters: MapCounter[];
  selected: Counter | undefined;
  focus: MapFocus | null;
  onSelect: (id: string) => void;
  onProblem: (problem: MapProblem | null) => void;
}

const SWITZERLAND: [[number, number], [number, number]] = [
  [5.9, 45.8],
  [10.5, 47.85],
];
// Grosszügig, damit auch schmale Bildschirme die ganze Schweiz zeigen: Ist der Ausschnitt breiter als maxBounds,
// zoomt MapLibre sonst hinein.
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [2.5, 44.0],
  [13.9, 49.6],
];
const FOCUS_ZOOM = 15;
const CLICK_ZOOM_BELOW = 10;
const CLICK_ZOOM = 12;
const BASE_SOURCE = Object.keys(baseStyle.sources)[0]!;
const GLYPHS = `${window.location.origin}/map/fonts/{fontstack}/{range}.pbf`;
// Einzelne fehlende Kacheln am Kartenrand sind normal; erst eine Serie gilt als Ausfall.
const TILE_FAILURE_THRESHOLD = 6;
// Auf Touch-Geräten liegt die Karte in einer scrollenden Seite; dort verschiebt erst eine Zwei-Finger-Geste die Karte.
const TOUCH_ONLY = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

// Kreisgrösse nach Verkehrsmenge; je nach Lage gedämpft (Flüssig) oder mit Mindestgrösse (Stau, Stockend),
// damit Störungen mit wenig Durchfluss nicht im Gewimmel verschwinden.
const flowRadius: ExpressionSpecification = ['+', 3, ['min', ['/', ['sqrt', ['coalesce', ['get', 'flow'], 0]], 8], 9]];
const statusRadius: ExpressionSpecification = [
  'match',
  ['get', 'status'],
  'jam',
  ['max', flowRadius, 7],
  'slow',
  ['max', flowRadius, 6],
  'free',
  ['*', flowRadius, 0.8],
  5,
];

/** Skaliert einen Radius mit dem Zoom: in der Übersicht kleiner, damit dichte Regionen lesbar bleiben. */
function byZoom(radius: ExpressionSpecification, extra: number | ExpressionSpecification = 0, unit = 1): ExpressionSpecification {
  const scaled = (factor: number): ExpressionSpecification => {
    const value: ExpressionSpecification = ['+', ['*', radius, factor], extra];
    return unit === 1 ? value : ['/', value, unit];
  };
  return ['interpolate', ['linear'], ['zoom'], 6, scaled(0.7), 9, scaled(1), 14, scaled(1.4)];
}

const JAM_RING_GAP = 4;
const SORT_BY_URGENCY: ExpressionSpecification = ['match', ['get', 'status'], 'jam', 3, 'slow', 2, 'nodata', 1, 0];

// Kreis-Layer kennen keine gestrichelten Ränder, darum ein Bild, das per icon-size auf den Kreis skaliert wird.
const PARTIAL_RING = 'partial-ring';
const PARTIAL_RING_RADIUS = 10;
const PARTIAL_RING_GAP: ExpressionSpecification = ['match', ['get', 'status'], 'jam', JAM_RING_GAP + 4, 3];

function dashedRing(color: string, halo: string): ImageData {
  const ratio = 2;
  const stroke = 1.5;
  const haloStroke = stroke + 2;
  const size = (PARTIAL_RING_RADIUS + haloStroke) * 2 * ratio;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  context.scale(ratio, ratio);
  const ring = (width: number, style: string, dash: number[]) => {
    context.lineWidth = width;
    context.strokeStyle = style;
    context.setLineDash(dash);
    context.beginPath();
    context.arc(size / ratio / 2, size / ratio / 2, PARTIAL_RING_RADIUS, 0, 2 * Math.PI);
    context.stroke();
  };
  // Weisser Grund, damit die Striche auch auf den dunklen Autobahnen sichtbar bleiben
  ring(haloStroke, halo, []);
  const dash = (2 * Math.PI * PARTIAL_RING_RADIUS) / 16;
  ring(stroke, color, [dash, dash]);
  return context.getImageData(0, 0, size, size);
}

function statusColor(): ExpressionSpecification {
  const [jam, slow, free, nodata] = ALL_STATUSES.map((status) => colorToken(STATUS_TOKENS[status]));
  return ['match', ['get', 'status'], 'jam', jam!, 'slow', slow!, 'free', free!, nodata!];
}

function counterFeatures(counters: MapCounter[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: counters.map(({ counter, values, status }) => {
      const speed = decisiveSpeed(values);
      const partial = partialText(values);
      const label = speed !== null ? `${counter.name} · ${statusName(status)} · ${speed} ${de.units.kmh}` : `${counter.name} · ${statusName(status)}`;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [counter.lng, counter.lat] },
        properties: {
          id: counter.id,
          status,
          flow: values?.flow ?? null,
          partial: partial !== null,
          label: partial ? `${label} · ${partial}` : label,
        },
      };
    }),
  };
}

function laneFeatures(selected: Counter | undefined): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: (selected?.lanes ?? [])
      .filter((lane) => lane.exact && lane.lat !== null && lane.lng !== null)
      .map((lane) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lane.lng!, lane.lat!] },
        properties: { label: lane.towards ? `${laneLabel(lane)} → ${lane.towards}` : laneLabel(lane) },
      })),
  };
}

function addTrafficLayers(map: MapLibreMap) {
  const white = colorToken('--white');
  const nodata = colorToken('--traffic-nodata');
  // Zählstellen unter die Beschriftung legen; der weisse Halo hält Ortsnamen über den Kreisen lesbar.
  const beforeLabels = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
  map.addSource('counters', { type: 'geojson', data: counterFeatures([]) });
  map.addSource('lanes', { type: 'geojson', data: laneFeatures(undefined) });
  map.addLayer(
    {
      id: 'counters',
      type: 'circle',
      source: 'counters',
      layout: { 'circle-sort-key': SORT_BY_URGENCY },
      paint: {
        'circle-radius': byZoom(statusRadius),
        // «Keine Daten» als hohler Ring, damit es nicht wie ein Messwert aussieht
        'circle-color': ['match', ['get', 'status'], 'nodata', white, statusColor()],
        'circle-opacity': ['match', ['get', 'status'], 'free', 0.8, 1],
        'circle-stroke-color': ['match', ['get', 'status'], 'nodata', nodata, white],
        'circle-stroke-width': ['match', ['get', 'status'], 'jam', 2, 'slow', 1.5, 'nodata', 2, 0.75],
      },
    },
    beforeLabels,
  );
  // Ring um Staus: Formmerkmal zusätzlich zur Farbe (Rot-Grün-Schwäche, WCAG 1.4.1)
  map.addLayer(
    {
      id: 'counter-jam-ring',
      type: 'circle',
      source: 'counters',
      filter: ['==', ['get', 'status'], 'jam'],
      paint: {
        'circle-radius': byZoom(statusRadius, JAM_RING_GAP),
        'circle-opacity': 0,
        'circle-stroke-color': colorToken('--traffic-jam'),
        'circle-stroke-width': 2,
      },
    },
    beforeLabels,
  );
  map.addImage(PARTIAL_RING, dashedRing(nodata, white), { pixelRatio: 2 });
  map.addLayer(
    {
      id: 'counter-partial-ring',
      type: 'symbol',
      source: 'counters',
      filter: ['==', ['get', 'partial'], true],
      layout: {
        'icon-image': PARTIAL_RING,
        'icon-size': byZoom(statusRadius, PARTIAL_RING_GAP, PARTIAL_RING_RADIUS),
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    },
    beforeLabels,
  );
  map.addLayer(
    {
      id: 'counter-selected',
      type: 'circle',
      source: 'counters',
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'circle-radius': byZoom(statusRadius, 3),
        'circle-opacity': 0,
        'circle-stroke-color': colorToken('--dark-teal'),
        'circle-stroke-width': 3,
      },
    },
    beforeLabels,
  );
  map.addLayer(
    {
      id: 'lanes',
      type: 'circle',
      source: 'lanes',
      paint: { 'circle-radius': 4, 'circle-color': colorToken('--deep-teal'), 'circle-stroke-color': white, 'circle-stroke-width': 1 },
    },
    beforeLabels,
  );
}

export default function TrafficMap({ counters, selected, focus, onSelect, onProblem }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const callbacks = useRef({ onSelect, onProblem });
  useEffect(() => {
    callbacks.current = { onSelect, onProblem };
  });

  useEffect(() => {
    if (!container.current) return;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: container.current,
        style: tintStyle(baseStyle as unknown as StyleSpecification, GLYPHS),
        bounds: SWITZERLAND,
        maxBounds: MAX_BOUNDS,
        minZoom: 5,
        fitBoundsOptions: { padding: 12 },
        maxZoom: 18,
        maxPitch: 0,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        renderWorldCopies: false,
        cooperativeGestures: TOUCH_ONLY,
        locale: de.map.locale,
        attributionControl: { compact: true },
      });
    } catch (error) {
      console.error('Karte konnte nicht erstellt werden:', error);
      callbacks.current.onProblem('webgl');
      return;
    }
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    const tooltip = new Popup({ closeButton: false, closeOnClick: false, className: 'map-tooltip', offset: 8 });
    const showTooltip = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return;
      map.getCanvas().style.cursor = 'pointer';
      tooltip
        .setLngLat(feature.geometry.coordinates as [number, number])
        .setText(String(feature.properties.label))
        .addTo(map);
    };
    const hideTooltip = () => {
      map.getCanvas().style.cursor = '';
      tooltip.remove();
    };

    let tileFailures = 0;
    map.on('error', (event) => {
      if ((event as { sourceId?: string }).sourceId !== BASE_SOURCE) return;
      tileFailures += 1;
      if (tileFailures === TILE_FAILURE_THRESHOLD) callbacks.current.onProblem('tiles');
    });
    map.on('sourcedata', (event) => {
      if (event.sourceId !== BASE_SOURCE || !event.tile) return;
      if (tileFailures >= TILE_FAILURE_THRESHOLD) callbacks.current.onProblem(null);
      tileFailures = 0;
    });

    map.on('load', () => {
      addTrafficLayers(map);
      for (const layer of ['counters', 'lanes']) {
        map.on('mousemove', layer, showTooltip);
        map.on('mouseleave', layer, hideTooltip);
      }
      map.on('click', 'counters', (event) => {
        const feature = event.features?.[0];
        const id = feature?.properties.id;
        if (typeof id !== 'string' || feature?.geometry.type !== 'Point') return;
        callbacks.current.onSelect(id);
        // Wer in der Karte klickt, sieht die Zählstelle schon: nur in der dichten Übersicht hineinzoomen, sonst zentrieren.
        const center = feature.geometry.coordinates as [number, number];
        if (map.getZoom() < CLICK_ZOOM_BELOW) map.flyTo({ center, zoom: CLICK_ZOOM });
        else map.easeTo({ center });
      });
      setReady(true);
    });

    return () => {
      mapRef.current = null;
      setReady(false);
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (ready) mapRef.current?.getSource<GeoJSONSource>('counters')?.setData(counterFeatures(counters));
  }, [ready, counters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter('counter-selected', ['==', ['get', 'id'], selected?.id ?? '']);
    map.getSource<GeoJSONSource>('lanes')?.setData(laneFeatures(selected));
  }, [ready, selected]);

  useEffect(() => {
    if (ready && focus) mapRef.current?.flyTo({ center: [focus.lng, focus.lat], zoom: FOCUS_ZOOM });
  }, [ready, focus]);

  return <div ref={container} className="traffic-map" />;
}
