# Verkehrszähler Schweiz

Live-Karte des Verkehrsflusses an den Zählstellen von ASTRA und Kantonen, für die Öffentlichkeit. Daten von opentransportdata.swiss (SOAP/DATEX II, minütlich).
Stack: npm-Workspaces, `server/` (Node 22, Hono, TypeScript), `web/` (React 19, Vite, Leaflet).
Fachlogik, API und Ausfallverhalten sind in [README.md](README.md) massgebend beschrieben.

## Befehle

| Zweck | Befehl |
| --- | --- |
| Entwicklung (Server :3000, Web :5173) | `npm run dev` |
| **Alles vor einem Commit** | `npm run typecheck && npm run lint && npm test` |
| Tests (Vitest, nur `server/`) | `npm test` |
| Produktions-Build und Start | `npm run build && npm start` |
| Sensorstandorte neu laden | `npm run build:sensors -w server` |
| TMC-Ortstabelle neu erzeugen | `npm run build:tmc -w server -- <ordner>` |
| Design System synchronisieren | `npm run ds:sync -w web -- <pfad/zu/intersys.css>` |
| Kartenstil von swisstopo neu erzeugen | `npm run build:map-style -w web` |

Bevor du `npm run dev` startest, prüfe, ob die Ports 3000 und 5173 schon belegt sind. Meist läuft der Server bereits.

## Weiterlesen bei Bedarf

Diese Dokumente werden nicht automatisch geladen. Lies sie, bevor du am jeweiligen Thema arbeitest, und führe sie nach Änderungen nach.

| Thema | Dokument |
| --- | --- |
| Fachlogik, Datenquellen, API, Ausfallverhalten | [README.md](README.md) |
| Gestaltung, Design System, Abnahme von UI-Änderungen | [docs/agents/design.md](docs/agents/design.md) |
| Änderungen für Nutzer und Betrieb | [CHANGELOG.md](CHANGELOG.md) |
| Stand, offene und getroffene Entscheide | [docs/agents/open-items.md](docs/agents/open-items.md) |
| Betrieb, Deployment (sobald vorhanden) | `DEPLOY.md` |

## Sprachregel

- **Englisch:** Bezeichner, Dateinamen, API-Felder, Enum-Werte (`'main'`, `'entry'`, `'jam'` …).
- **Deutsch (Schweiz, Sie-Form, «ss» statt «ß»):** alles, was Nutzer sehen (Wörterbuch `web/src/i18n/de.ts`), dazu Logs, Code-Kommentare, README und Commit-Messages. Datum und Zahlen mit `de-CH`.
- **Glossar** (Fachbegriff → Code):
  Zählstelle → `Counter` · Fahrstreifen → `Lane` · Messstelle/Messstellentabelle → `SiteRecord`/`SiteTable` (`sites`) · Messwerte → `measurements` · Fahrzeuge/h → `flow` · Ø km/h → `speed` · Fahrzeugklasse → `VehicleClass` (`car`, `lorry`, `any`) · Fahrtrichtung → `direction` (`positive`/`negative`) · Fahrbahn → `carriageway` · Zielort → `towards` · Quelle → `source` · Betreiber → `operator` · Herkunft → `origin` · exakter Sensorstandort → `exact`.

## Regeln für den Code

- **Ein API-Vertrag:** [server/src/types.ts](server/src/types.ts). Das Web importiert daraus nur mit `import type`. Was das Web zur Laufzeit aus `server/src` importiert (heute nur `origin.ts`), darf keine Node-APIs verwenden.
- **Der Server bereitet auf, der Client stellt dar.** Parsen, Aggregieren, Positionieren und Herkunft gehören in `server/`. Das Web formatiert und beschriftet nur.
- **Keine sichtbaren Texte im Code.** Alle UI-Texte stehen im Wörterbuch `web/src/i18n/de.ts`. Das gilt auch für Labels zu Enum-Werten, Fehlercodes und Statusmeldungen. Platzhalter laufen über Funktionen oder Parameter, nicht über zusammengesetzte Strings in Komponenten. Für Datum und Zahlen `Intl` mit `de-CH` verwenden. Eine i18n-Bibliothek nur nach Entscheid.
- **Der Server liefert für Nutzer bestimmte Meldungen als Code plus Parameter**, nicht als fertigen Text. Den Text erzeugt das Web aus dem Wörterbuch. Ausnahme sind Logs und Startfehler für Betreiber. Der Bestand ist noch nicht umgestellt, siehe [open-items](docs/agents/open-items.md).
- **Konfiguration zur Laufzeit** über Umgebungsvariablen in [server/src/config.ts](server/src/config.ts), nicht beim Build. Ein Build-Artefakt gilt für jede Umgebung. Fehlende Pflichtwerte (`OTD_API_KEY`) und ungültige Werte führen zu einem Fehler, nicht zu einem stillen Fallback. Neue Variablen auch in `.env.example` und README eintragen.
- **TypeScript strikt** (siehe `tsconfig.base.json`): `noUncheckedIndexedAccess`, `erasableSyntaxOnly` (keine `enum`, keine `namespace`, keine Parameter-Properties), `verbatimModuleSyntax`. Relative Importe mit Endung `.ts`.
- **Sicherheit:** Der API-Key bleibt auf dem Server, also keine `VITE_*`-Variablen mit Secrets. Die CSP steht in [server/src/app.ts](server/src/app.ts): Inline-Scripts sind nicht erlaubt, neue Kachel- oder Datenhosts müssen dort ausdrücklich ergänzt werden. Kein `dangerouslySetInnerHTML`, Texte aus Fremddaten nur als Text rendern.
- **Ausfälle gehören zum Normalbetrieb.** Jede externe Quelle braucht definiertes Verhalten: letzte Daten behalten, Grund und Datenstand im UI zeigen. Bei Änderungen die Tabelle «Ausfallverhalten» im README nachführen.
- **Gestaltung nach dem Intersys Design System** ([docs/agents/design.md](docs/agents/design.md)): nur Tokens, keine freien Farben, Schriftgrössen oder Abstände. Komponenten aus dem Design System verwenden. Eigene Ergänzungen kommen begründet in `web/src/design/additions.css`.
- **Generierte Dateien** `server/data/astra-sensors.json`, `server/data/tmc-locations.json`, `web/src/design/intersys.css` und `web/src/map/base-style.json` nie von Hand ändern, sondern mit den Scripts in `server/scripts/` bzw. `web/scripts/` neu erzeugen.
- **Tests ohne Netzwerk.** Parser- und Logiktests arbeiten mit Fixtures ([server/src/test-fixtures.ts](server/src/test-fixtures.ts)). Neue Fachlogik bekommt Tests.
- **Kommentare** nur, wo der Code das *Warum* nicht selbst zeigt, etwa bei Eigenheiten von DATEX II, TMC oder ASTRA.
- **Neue Abhängigkeiten** nur mit Begründung. Bestehende Lösungen vorziehen.

## Externe Dienste (wichtig)

- **opentransportdata.swiss erlaubt 5 Abrufe pro Minute und Key.** Starte darum keinen zweiten Server mit demselben Key (zum Beispiel einen weiteren `npm run dev` oder einen Server in einem Worktree) und rufe die SOAP-API nicht in Schleifen oder Skripten auf. Um Daten anzuschauen, `/api/*` des laufenden Servers oder `server/.cache/` verwenden.
- `server/.cache/` enthält die letzten echten API-Antworten. Löschen bewirkt beim nächsten Start sofortige API-Abrufe.
- Die Scripts `build:sensors` (ArcGIS) und `build:tmc` nur bei einer bewussten Datenaktualisierung ausführen und den Diff von `server/data/` vor dem Commit prüfen.
- **Hintergrundkarte:** Die Vektorkacheln kommen zur Laufzeit von swisstopo (`vectortiles*.geo.admin.ch`, in der CSP von [server/src/app.ts](server/src/app.ts) freigegeben). Stil und Schrift liegen im Projekt. `build:map-style` lädt den aktuellen swisstopo-Stil; den Diff von `web/src/map/base-style.json` vor dem Commit prüfen und die Karte im Browser ansehen.

## Arbeitsweise

- **UI-Änderungen:** im Browser unter http://localhost:5173 prüfen, auf Desktop und Mobil (Karte, Seitenleiste, Detailansicht, Lade-, Leer- und Fehlerzustand). Danach die Checkliste in [design.md](docs/agents/design.md) abhaken. Grössere Gestaltungsänderungen zuerst als 2–3 Varianten mit Empfehlung vorschlagen.
- **Fachliche und Produktentscheide** trifft der Projektinhaber, zum Beispiel was als «Stau» gilt, welche Daten gezeigt werden oder welche Quellen dazukommen. Varianten vorbereiten statt selbst wählen.
- **Im selben Commit nachführen:**
  - [CHANGELOG.md](CHANGELOG.md) bei jeder Änderung, die Nutzer oder Betrieb bemerken: Funktionen, API, Konfiguration, Datenaktualisierungen, Fehlerbehebungen. Reine Refactorings gehören nicht hinein.
  - README, wenn sich API, Datenquellen, Befehle, Konfiguration oder Ausfallverhalten ändern.
  - `docs/agents/open-items.md`, wenn ein Punkt erledigt ist oder neu dazukommt.
- **Entscheide** mit Datum, Variante und Grund in [docs/agents/open-items.md](docs/agents/open-items.md) festhalten. Das gilt auch für Entscheide aus dem Chat.
- **Kleine, vollständige Änderungen:** keine Nebenbaustellen, aber selbst verursachte Fehler beheben.
- **Commits vorschlagen:** Nach jeder abgeschlossenen Aufgabe, nach bestandenen Prüfbefehlen, fragen oder vorschlagen, ob committet werden soll. Dazu die Änderungen kurz zusammenfassen und die geplante Aufteilung samt Commit-Messages nennen. Nie ungefragt committen, und nie pushen. Offene, unzusammenhängende Änderungen (z. B. `package-lock.json`) getrennt ansprechen.

## Repository, CI/CD und Deployment

CI/CD und Deployment sind geplant, aber noch nicht eingerichtet. Den Stand findest du in [open-items](docs/agents/open-items.md). Schon jetzt gilt:

- **Nie einchecken:** `.env`, `server/.cache/`, `dist/`, API-Keys und andere Secrets. Den API-Key setzen CI und Zielumgebung als Secret zur Laufzeit, nie beim Build.
- **CI-Logik in Scripts** (`deploy/ci-*.sh`). Die CI-Dateien des Anbieters rufen nur diese Scripts auf, so lässt sich der Anbieter ohne Umbau wechseln. Die Scripts müssen auch lokal laufen.
- **Ein Artefakt:** `npm run build` erzeugt Server und Frontend, der Server liefert `web/dist` aus. Keine umgebungsspezifischen Builds.
- **Healthcheck** für Deployment und Monitoring ist `GET /api/health`.
- **`main` muss immer deploybar sein.** Voraussichtlich löst ein Push auf `main` das Deployment aus (Entscheid offen). Darum vor jedem Push die Prüfbefehle aus der Tabelle oben ausführen und `git diff --stat origin/main` ansehen.
- Betrieb und Deployment werden in `DEPLOY.md` beschrieben, sobald sie bestehen.
- Commit-Messages auf Deutsch: eine kurze Betreffzeile ohne Punkt, die beschreibt, was sich fachlich ändert, und bei Bedarf ein Text zum Warum. Bei Agent-Beteiligung NIE einen Trailer `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` oder ähnliches anfügen.
