import type { LatLngBoundsExpression } from 'leaflet';
import { CircleMarker, LayersControl, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import type { Counter, CounterValues } from '../../server/src/types.ts';
import { markerRadius, STATUSES, type Status } from './traffic.ts';

export interface MapCounter {
  counter: Counter;
  values: CounterValues | undefined;
  status: Status;
}

interface Props {
  counters: MapCounter[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const SWITZERLAND: LatLngBoundsExpression = [
  [45.8, 5.9],
  [47.85, 10.5],
];
const swisstopo = (layer: string) => `https://wmts.geo.admin.ch/1.0.0/${layer}/default/current/3857/{z}/{x}/{y}.jpeg`;
const SWISSTOPO_ATTRIBUTION = '&copy; <a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noreferrer">swisstopo</a>';

export function TrafficMap({ counters, selectedId, onSelect }: Props) {
  return (
    <MapContainer bounds={SWITZERLAND} minZoom={7} preferCanvas className="leaflet-map">
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="swisstopo grau">
          <TileLayer url={swisstopo('ch.swisstopo.pixelkarte-grau')} maxZoom={18} attribution={SWISSTOPO_ATTRIBUTION} />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="swisstopo farbig">
          <TileLayer url={swisstopo('ch.swisstopo.pixelkarte-farbe')} maxZoom={18} attribution={SWISSTOPO_ATTRIBUTION} />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="OpenStreetMap">
          <TileLayer
            url="https://tile.osm.ch/switzerland/{z}/{x}/{y}.png"
            maxZoom={18}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>-Mitwirkende'
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      {counters.map(({ counter, values, status }) => {
        const selected = counter.id === selectedId;
        return (
          <CircleMarker
            key={counter.id}
            center={[counter.lat, counter.lng]}
            radius={markerRadius(values?.flow)}
            pathOptions={{
              color: selected ? '#000' : '#fff',
              weight: selected ? 3 : 1,
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
    </MapContainer>
  );
}
