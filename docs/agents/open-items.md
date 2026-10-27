# Stand und offene Entscheide

Erledigte Punkte werden entfernt oder unter «Entscheide» festgehalten. Jeder Entscheid bekommt Datum, Variante und Grund.

## Offen

### Deployment

- Zielumgebung und Hosting (Container, VM, PaaS), dazu Domain und TLS.
- Wie der API-Key `OTD_API_KEY` als Secret in die Zielumgebung kommt.
- `server/.cache/` persistent halten (Volume), damit ein Neustart das Rate-Limit schont.
- Umgebungen: nur Produktion oder zusätzlich Staging? Jede Umgebung braucht einen eigenen API-Key, weil das Rate-Limit pro Key gilt.
- `DEPLOY.md` anlegen, sobald das Deployment steht.

### CI/CD

- Anbieter wählen (z. B. GitHub Actions). Die Logik liegt in `deploy/ci-*.sh`.
- Ablauf: Prüfen (Typen, Lint, Tests) → Build → Deployment. Soll ein Push auf `main` automatisch deployen?
- Script `npm run check` anlegen, das Typen, Lint und Tests bündelt. Lokal und in der CI derselbe Befehl.
- Remote-Repository einrichten.

### UI-Texte ins Wörterbuch auslagern

Entscheid vom 2026-10-27, siehe unten. Das Wörterbuch `web/src/i18n/de.ts` besteht. `App.tsx`, `CounterSearch.tsx`, `CounterGroups.tsx` und `CounterDetails.tsx` sind umgestellt. Noch offen:

- Web: Texte in `traffic.ts` (Lage, Fehlercodes, Fahrstreifen, Richtungen), `status.ts` (Statusmeldungen ausser denen der Karte) und `useTrafficData.ts` nach `web/src/i18n/de.ts` verschieben. `TrafficMap.tsx` ist umgestellt.
- Server: Meldungen für Nutzer als Code plus Parameter liefern statt als Text. Betroffen sind:
  - `describeStatus` in `server/src/otd-client.ts`
  - `unavailableReason` in `server/src/store.ts`
  - die Fehlertexte in `/api/*`
  - die Labels `source`/`operator` in `server/src/origin.ts` («Bund», «Kanton Zürich»). Das Web würde sie dann aus Kantonskürzel und Betreiber-Kürzel zusammensetzen.

  Diese Umstellung ändert den API-Vertrag in `server/src/types.ts`.

### Design System

- **Export anbinden:** Den Design-System-Export (`tokens.css`, `components/`, `assets/Logo`, `assets/Icons`, Roboto) ins Projekt holen oder als Quelle für `ds:sync` festlegen. `ds:sync` soll dann auch Logo und Schrift übernehmen. Heute stammen beide von intersys.ch, und als Quelle dient eine Kopie von `intersys.css` von der Website.
- **Icons fehlen:** Zum Auf- und Zuklappen wird vorläufig «+»/«−» verwendet (Muster der FAQ-Komponente). Notices haben noch kein Icon. Mit dem Export die Icons übernehmen.
- **Rückmeldungen ans Design System** (noch nicht gemeldet):
  - Skala für Datenvisualisierung bzw. Ampel. Hier gilt vorläufig `--traffic-slow: #c76a12`, weil das Design System kein Orange hat und Peach reserviert ist.
  - Mindestgrösse für Klickflächen als Token (`--target-min`): Das Briefing nennt 40 px, die Komponenten haben 44–52 px.
  - Kompakter Button (`.button--compact`, 40 px) für Kartenköpfe und dichte Bereiche.
  - Auswahlliste (`.pick-list`) für Suchtreffer und aufklappbare Listen.
  - App-Layout mit Kopfleiste, Seitenleiste und vollflächiger Karte für Kartenanwendungen.
  - Kartenstil als Teil des Design Systems: `tintStyle` (swisstopo) und `tintFlavor` (Protomaps, Website) folgen derselben Regel und könnten gemeinsam gepflegt werden. Dazu Roboto-Glyphen im Export, auch Bold und weitere Zeichenbereiche (heute nur 0–511 und 8192–8447).

### Karte

- **Selbst gehostete Kacheln prüfen**, sobald das Hosting entschieden ist: PMTiles-Ausschnitt der Schweiz (Grösse messen, z. B. bis Zoom 14) statt swisstopo-Kacheln. Entfernt die Drittanfrage und die CSP-Ausnahme.
- **Auf echtem Touch-Gerät testen:** Zwei-Finger-Geste und Hinweis auf Deep Teal (bisher nur im Desktop-Browser geprüft).

## Entscheide

| Datum | Entscheid | Grund |
| --- | --- | --- |
| 2026-10-27 | Strassennetz der Karte (Variante B von drei): Autobahnen in dunklem Teal in jeder Zoomstufe, Kantonsstrassen hell, Kantonsgrenzen gestrichelt; eigene Übersichts-Layer bis Zoom 11. Verworfen: weisse Strassen wie die Website (A), durchgezogene Kantonsgrenzen (C). | In der Übersicht fehlten Autobahnen und Kantonsstrassen. A unterschied die Strassenklassen kaum, bei C sahen Grenzen und Strassen ähnlich aus. |
| 2026-10-27 | Karte mit MapLibre GL und swisstopo-Vektorkacheln, zur Laufzeit in Markenfarben umgerechnet (Variante B). Zwei-Finger-Geste nur auf Touch-Geräten, nur die Landesgrenze. Verworfen: Leaflet mit eingefärbten Rasterkacheln (A), selbst gehostete Protomaps-Kacheln (C). | Look und Bedienung der Intersys-Standortkarte ohne Kachel-Hosting. A bot nur eine Tönung ohne Roboto, C braucht eine Datei von mehreren hundert MB und Hosting. |
| 2026-10-27 | Gestaltung nach dem Intersys-Designbriefing für interne Tools. Aus `intersys.css` werden per `ds:sync` nur Tokens, Basis und die verwendeten Komponenten übernommen. Die Abweichungen stehen in `design.md`. | Als Intersys erkennbar bei kleinem Aufwand. Kein Fork des Design Systems. |
| 2026-10-27 | Ampel der Karte aus Tokens: Stau = `--error`, Flüssig = `--success`, Keine Daten = `--control-border`, Stockend = eigenes Token `--traffic-slow`. | Möglichst nah am Design System. Für Orange gibt es kein Token. |
| 2026-10-27 | Keine sichtbaren Texte im Code. UI-Texte stehen in `web/src/i18n/de.ts`, der Server liefert Codes statt Texte. | Texte zentral pflegen und ändern, ohne Logik anzufassen. Server und Web bleiben sprachunabhängig. |
| 2026-10-27 | `CHANGELOG.md` und `docs/agents/open-items.md` führen. | Änderungen und Entscheide nachvollziehbar halten, auch über mehrere Agent-Sitzungen hinweg. |
| 2026-10-27 | CI-Logik in Scripts, Konfiguration zur Laufzeit, ein Artefakt für alle Umgebungen. | Wechsel des CI-Anbieters ohne Umbau. Kein Build pro Umgebung. Secrets nie im Build. |
| 2026-10-27 | Die API wird nur über den eigenen Server abgefragt, der Key bleibt auf dem Server. | Schutz des Keys. Ein zentraler Abruf schont das Rate-Limit von 5 Abrufen pro Minute. |
| 2026-10-27 | Sensor- und TMC-Daten liegen als Snapshot in `server/data/`. | Keine Laufzeitabhängigkeit von ArcGIS und der TMC-Quelle. |
