# Verkehrszähler Schweiz

Live-Karte des Verkehrsflusses an den ASTRA-Zählstellen. Daten: [opentransportdata.swiss – Verkehrszähler](https://opentransportdata.swiss/de/dataset/trafficcounters) (DATEX II, minütlich).

Inspiriert von [m-cirkovic/Open-Data_ASTRA](https://github.com/m-cirkovic/Open-Data_ASTRA), neu umgesetzt.

## Aufbau

- `server/` – Node + Hono. Fragt die SOAP-API zentral ab (Messwerte jede Minute, Messstellen alle 6 h, bei neuer Version der Messstellentabelle in den Messwerten sofort), wandelt das XML in kompaktes JSON und liefert im Produktivbetrieb auch das Frontend aus. Der API-Key bleibt auf dem Server.
- `web/` – React + Vite + MapLibre GL. Holt `/api/counters` einmal und `/api/measurements` alle 30 s. Eine ausgewählte Zählstelle steht in der URL (`?z=CH:0182`), Links lassen sich teilen. Unter `/info` erklärt eine Seite die Karte, die Beurteilung der Lage und die Datenquellen. Die Gestaltung folgt dem Intersys Design System: `web/src/design/intersys.css` wird mit `npm run ds:sync -w web -- <pfad/zu/intersys.css>` erzeugt, Details in [docs/agents/design.md](docs/agents/design.md).
- Hintergrundkarte: Vektorkacheln der «Basiskarte leicht» von [swisstopo](https://www.swisstopo.admin.ch/de/web-maps-base-map), in Markenfarben umgerechnet. Der reduzierte Stil liegt als Snapshot in `web/src/map/base-style.json`. Aktualisieren: `npm run build:map-style -w web`. Die Roboto-Glyphen für die Beschriftung liegen selbst gehostet unter `web/public/map/fonts/`.
- `server/data/astra-sensors.json` – exakte Sensorstandorte, Namen und Zielorte der ASTRA-Zählstellen aus dem öffentlichen Feature-Service hinter dem [SVZ-Dashboard](https://www.arcgis.com/apps/dashboards/1673b262537546098589ad3820e5ece2) (Verknüpfung über `SiteReferenceID` = Fahrstreifen-ID). Aktualisieren: `npm run build:sensors -w server`.
- `server/data/tmc-locations.json` – Fallback für Zählstellen ohne Sensordaten (Kantone): Ortsnamen, Referenzpunkte, Strassenklasse und Punkttyp aus der offiziellen [TMC-Ortstabelle](https://data.opentransportdata.swiss/dataset/rds-tmc) (derzeit Version 7.5); Position = TMC-Punkt plus Offset. Neue Version: ZIP herunterladen, entpacken, `npm run build:tmc -w server -- <ordner>`.
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
| `GET /api/counters` | Zählstellen mit Name, Strasse, Koordinaten, Fahrstreifen, Quelle, Betreiber und Bereich (`area`: ausserorts/innerorts) |
| `GET /api/measurements` | Version der Messstellentabelle (`siteTableVersion`), Fahrzeuge/h und Ø km/h pro Zählstelle und Fahrstreifen, km/h und Fz/h der langsameren Fahrtrichtung (`worstSpeed`, `worstFlow`), Verkehrslage (`status`, `statusHint`), gezählte und ausgefallene Fahrstreifen (`countedLanes`, `failedLanes`), Fehlercodes |
| `GET /api/health` | Status pro Quelle (Messstellen, Messwerte): letzter Abruf, Fehler, Daten aus Cache |

## Verkehrslage

Massgebend ist die Definition von [ASTRA](https://www.astra.admin.ch/de/definitionen) und [BFS](https://www.bfs.admin.ch/asset/de/8288664). Der Server berechnet die Lage (`server/src/congestion.ts`), beurteilt wird die langsamere Fahrtrichtung der Hauptfahrbahn.

| Lage | Regel |
|---|---|
| Stau | unter 10 km/h |
| Stockend | unter 30 km/h |
| Flüssig | ab 30 km/h, oder unter 3 Fahrzeugen pro Minute (180 Fz/h) in der langsameren Richtung (`statusHint: lowTraffic`) |
| Keine Daten | kein Fahrstreifen der Hauptfahrbahn liefert Werte |

- **Ausserorts** genügt eine Minute, wie bei ASTRA.
- **Innerorts** definiert ASTRA Stau über 5 Minuten Verlustzeit an Knoten. Das misst eine Zählstelle nicht. Darum gelten Stau und Stockend innerorts erst, wenn die Schwelle 5 Minuten am Stück unterschritten ist; vorher steht «Flüssig» mit `statusHint: urbanPending`.
- **Als innerorts gilt** eine Zählstelle an einer Stadtstrasse oder an einem Knoten (Kreuzung, Kreisel) abseits der Autobahn, laut TMC-Ortstabelle.

## Ausfallverhalten

| Ausfall | Verhalten |
|---|---|
| opentransportdata.swiss nicht erreichbar, Key abgelehnt, Rate-Limit | Server behält die letzten Daten (Speicher und `server/.cache/`), versucht es alle 30 s erneut; UI zeigt Grund und Stand der angezeigten Daten |
| Server-Neustart ohne API | Daten aus `server/.cache/`; ist der Cache noch frisch, wird die API erst bei Ablauf abgefragt (schont das Rate-Limit von 5 Abrufen/Minute). Der Verlauf für die Innerorts-Regel liegt nur im Speicher: innerorts erst nach 5 Minuten wieder Stau. |
| Eigener Server nicht erreichbar | Browser behält die zuletzt geladenen Daten und meldet den Verbindungsverlust |
| Vektorkacheln von swisstopo | Hinweis im UI. Die Zählstellen bleiben auf hellem Grund sichtbar. Beim Verschieben oder Zoomen lädt die Karte neu. |
| Browser ohne WebGL | Fehlermeldung im UI. Suche, Liste und Details funktionieren weiterhin. |
| Einzelne Fahrstreifen einer Zählstelle ohne Daten | Lage und Summen aus den übrigen Fahrstreifen; die Karte zeigt einen gestrichelten Ring, Tooltip und Details nennen die Anzahl. Liefert kein Fahrstreifen der Hauptfahrbahn Daten: «Keine Daten», Ein- und Ausfahrten springen nicht ein. |
| Sensor-/TMC-Daten | Keine Laufzeitabhängigkeit, Snapshots liegen in `server/data/` |
