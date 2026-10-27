import type { LatLngBoundsExpression } from 'leaflet';
import { useEffect, useRef } from 'react';
import { CircleMarker, LayersControl, MapContainer, TileLayer, Tooltip, useMap, type TileLayerProps } from 'react-leaflet';
import type { Counter, CounterValues } from '../../server/src/types.ts';
import { laneLabel, markerRadius, STATUSES, type Status } from './traffic.ts';

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
  onTileHealth: (layer: string, ok: boolean) => void;
}

const SWITZERLAND: LatLngBoundsExpression = [
  [45.8, 5.9],
  [47.85, 10.5],
];
const swisstopo = (layer: string) => `https://wmts.geo.admin.ch/1.0.0/${layer}/default/current/3857/{z}/{x}/{y}.jpeg`;
const SWISSTOPO_ATTRIBUTION = '&copy; <a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noreferrer">swisstopo</a>';

function FlyTo({ focus }: { focus: MapFocus | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], 16);
  }, [map, focus]);
  return null;
}

// Einzelne fehlende Kacheln am Kartenrand sind normal; erst eine Serie gilt als Ausfall.
const TILE_FAILURE_THRESHOLD = 6;

function MonitoredTileLayer({ name, onHealth, ...props }: TileLayerProps & { name: string; onHealth: Props['onTileHealth'] }) {
  const failures = useRef(0);
  return (
    <TileLayer
      {...props}
      eventHandlers={{
        tileerror: () => {
          failures.current += 1;
          if (failures.current === TILE_FAILURE_THRESHOLD) onHealth(name, false);
        },
        tileload: () => {
          if (failures.current >= TILE_FAILURE_THRESHOLD) onHealth(name, true);
          failures.current = 0;
        },
      }}
    />
  );
}

export function TrafficMap({ counters, selected, focus, onSelect, onTileHealth }: Props) {
  return (
    <MapContainer bounds={SWITZERLAND} minZoom={7} preferCanvas className="leaflet-map">
      <FlyTo focus={focus} />
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="swisstopo grau">
          <MonitoredTileLayer
            name="swisstopo grau"
            onHealth={onTileHealth}
            url={swisstopo('ch.swisstopo.pixelkarte-grau')}
            maxZoom={18}
            attribution={SWISSTOPO_ATTRIBUTION}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="swisstopo farbig">
          <MonitoredTileLayer
            name="swisstopo farbig"
            onHealth={onTileHealth}
            url={swisstopo('ch.swisstopo.pixelkarte-farbe')}
            maxZoom={18}
            attribution={SWISSTOPO_ATTRIBUTION}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="OpenStreetMap">
          <MonitoredTileLayer
            name="OpenStreetMap"
            onHealth={onTileHealth}
            url="https://tile.osm.ch/switzerland/{z}/{x}/{y}.png"
            maxZoom={18}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>-Mitwirkende'
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      {counters.map(({ counter, values, status }) => {
        const isSelected = counter.id === selected?.id;
        return (
          <CircleMarker
            key={counter.id}
            center={[counter.lat, counter.lng]}
            radius={markerRadius(values?.flow)}
            pathOptions={{
              color: isSelected ? '#000' : '#fff',
              weight: isSelected ? 3 : 1,
              fillColor: STATUSES[status].color,
              fillOpacity: 0.85,
            }}
            eventHandlers={{ click: () => onSelect(counter.id) }}
          >
            <Tooltip>
              {counter.name}
              {values?.speed != null && ` · ${values.speed} km/h`}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {selected?.lanes
        .filter((lane) => lane.exact && lane.lat !== null && lane.lng !== null)
        .map((lane) => (
          <CircleMarker
            key={lane.id}
            center={[lane.lat!, lane.lng!]}
            radius={4}
            pathOptions={{ color: '#fff', weight: 1, fillColor: '#1f4bd8', fillOpacity: 1 }}
          >
            <Tooltip>
              {laneLabel(lane)}
              {lane.towards && ` → ${lane.towards}`}
            </Tooltip>
          </CircleMarker>
        ))}
    </MapContainer>
  );
}
