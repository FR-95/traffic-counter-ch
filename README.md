# Verkehrszähler Schweiz

Live-Karte des Verkehrsflusses an den ASTRA-Zählstellen. Daten: [opentransportdata.swiss – Verkehrszähler](https://opentransportdata.swiss/de/dataset/trafficcounters) (DATEX II, minütlich).

Inspiriert von [m-cirkovic/Open-Data_ASTRA](https://github.com/m-cirkovic/Open-Data_ASTRA), neu umgesetzt.

## Aufbau

- `server/` – Node + Hono. Fragt die SOAP-API zentral ab (Messwerte jede Minute, Messstellen alle 6 h), wandelt das XML in kompaktes JSON und liefert im Produktivbetrieb auch das Frontend aus. Der API-Key bleibt auf dem Server.
- `web/` – React + Vite + MapLibre GL. Holt `/api/counters` einmal und `/api/measurements` alle 30 s. Die Gestaltung folgt dem Intersys Design System: `web/src/design/intersys.css` wird mit `npm run ds:sync -w web -- <pfad/zu/intersys.css>` erzeugt, Details in [docs/agents/design.md](docs/agents/design.md).
- Hintergrundkarte: Vektorkacheln der «Basiskarte leicht» von [swisstopo](https://www.swisstopo.admin.ch/de/web-maps-base-map), in Markenfarben umgerechnet. Der reduzierte Stil liegt als Snapshot in `web/src/map/base-style.json`. Aktualisieren: `npm run build:map-style -w web`. Die Roboto-Glyphen für die Beschriftung liegen selbst gehostet unter `web/public/map/fonts/`.
- `server/data/astra-sensors.json` – exakte Sensorstandorte, Namen und Zielorte der ASTRA-Zählstellen aus dem öffentlichen Feature-Service hinter dem [SVZ-Dashboard](https://www.arcgis.com/apps/dashboards/1673b262537546098589ad3820e5ece2) (Verknüpfung über `SiteReferenceID` = Fahrstreifen-ID). Aktualisieren: `npm run build:sensors -w server`.
- `server/data/tmc-locations.json` – Fallback für Zählstellen ohne Sensordaten (Kantone): Ortsnamen und Referenzpunkte aus der offiziellen [TMC-Ortstabelle](https://data.opentransportdata.swiss/dataset/rds-tmc) (derzeit Version 7.5); Position = TMC-Punkt plus Offset. Neue Version: ZIP herunterladen, entpacken, `npm run build:tmc -w server -- <ordner>`.
- Quelle und Betreiber werden aus dem Präfix der Zählstellen-ID abgeleitet (`[Betreiber.]Kanton.CH:Nummer`): `CH:0542` → Bund/ASTRA, `ZH.CH:0088` → Kanton Zürich, `FH.FR.CH:0001` → Kanton Freiburg/Betreiber „FH“. In der Seitenleiste lassen sich die Gruppen ein- und ausblenden und aufklappen.

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
| `GET /api/counters` | Zählstellen mit Name, Strasse, Koordinaten, Fahrstreifen, Quelle und Betreiber |
| `GET /api/measurements` | Fahrzeuge/h und Ø km/h pro Zählstelle und Fahrstreifen, Fehlercodes |
| `GET /api/health` | Status pro Quelle (Messstellen, Messwerte): letzter Abruf, Fehler, Daten aus Cache |

## Ausfallverhalten

| Ausfall | Verhalten |
|---|---|
| opentransportdata.swiss nicht erreichbar, Key abgelehnt, Rate-Limit | Server behält die letzten Daten (Speicher und `server/.cache/`), versucht es alle 30 s erneut; UI zeigt Grund und Stand der angezeigten Daten |
| Server-Neustart ohne API | Daten aus `server/.cache/`; ist der Cache noch frisch, wird die API erst bei Ablauf abgefragt (schont das Rate-Limit von 5 Abrufen/Minute) |
| Eigener Server nicht erreichbar | Browser behält die zuletzt geladenen Daten und meldet den Verbindungsverlust |
| Vektorkacheln von swisstopo | Hinweis im UI. Die Zählstellen bleiben auf hellem Grund sichtbar. Beim Verschieben oder Zoomen lädt die Karte neu. |
| Browser ohne WebGL | Fehlermeldung im UI. Suche, Liste und Details funktionieren weiterhin. |
| Sensor-/TMC-Daten | Keine Laufzeitabhängigkeit, Snapshots liegen in `server/data/` |
