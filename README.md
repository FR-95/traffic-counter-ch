# Verkehrszähler Schweiz

Live-Karte des Verkehrsflusses an den ASTRA-Zählstellen. Daten: [opentransportdata.swiss – Verkehrszähler](https://opentransportdata.swiss/de/dataset/trafficcounters) (DATEX II, minütlich).

Inspiriert von [m-cirkovic/Open-Data_ASTRA](https://github.com/m-cirkovic/Open-Data_ASTRA), neu umgesetzt.

## Aufbau

- `server/` – Node + Hono. Fragt die SOAP-API zentral ab (Messwerte jede Minute, Messstellen alle 6 h), wandelt das XML in kompaktes JSON und liefert im Produktivbetrieb auch das Frontend aus. Der API-Key bleibt auf dem Server.
- `web/` – React + Vite + Leaflet. Holt `/api/counters` einmal und `/api/measurements` alle 30 s.
- `server/data/tmc-locations.json` – Ortsnamen und genaue Koordinaten aus der offiziellen [TMC-Ortstabelle](https://data.opentransportdata.swiss/dataset/rds-tmc) (derzeit Version 7.5; die API liefert Koordinaten nur auf ~1 km genau). Neue Version: ZIP herunterladen, entpacken, `npm run build:tmc -w server -- <ordner>`.

## Entwicklung

Voraussetzung: Node gemäss `.nvmrc`, eigener API-Key von [api-manager.opentransportdata.swiss](https://api-manager.opentransportdata.swiss).

```sh
cp .env.example .env   # OTD_API_KEY eintragen
npm install
npm run dev            # Server :3000, Web :5173
```

Weitere Befehle: `npm test`, `npm run lint`, `npm run typecheck`.

## Produktion

```sh
npm run build
HOST=0.0.0.0 npm start
```

## API

| Endpoint | Inhalt |
|---|---|
| `GET /api/counters` | Zählstellen mit Name, Strasse, Koordinaten, Fahrstreifen |
| `GET /api/measurements` | Fahrzeuge/h und Ø km/h pro Zählstelle und Fahrstreifen, Fehlercodes |
| `GET /api/health` | Zeitstempel und letzter Fehler |
