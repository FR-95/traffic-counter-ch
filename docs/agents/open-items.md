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

Entscheid vom 2026-10-27, siehe unten. Das Wörterbuch `web/src/i18n/de.ts` besteht. Alle Komponenten sowie `traffic.ts` sind umgestellt. Noch offen:

- Web: Texte in `status.ts` (Statusmeldungen ausser denen der Karte) und `useTrafficData.ts` nach `web/src/i18n/de.ts` verschieben.
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
  - Statusanzeige mit Formmerkmal (Punkt, Ring, hohler Ring) und Text, z. B. für Ampeln.
  - Aufklappbarer Kartenkopf (`.disclosure`) mit Zusammenfassung des eingeklappten Inhalts.
  - App-Layout mit Kopfleiste, Seitenleiste und vollflächiger Karte für Kartenanwendungen.
  - Kartenstil als Teil des Design Systems: `tintStyle` (swisstopo) und `tintFlavor` (Protomaps, Website) folgen derselben Regel und könnten gemeinsam gepflegt werden. Dazu Roboto-Glyphen im Export, auch Bold und weitere Zeichenbereiche (heute nur 0–511 und 8192–8447).

### Karte

- **Selbst gehostete Kacheln prüfen**, sobald das Hosting entschieden ist: PMTiles-Ausschnitt der Schweiz (Grösse messen, z. B. bis Zoom 14) statt swisstopo-Kacheln. Entfernt die Drittanfrage und die CSP-Ausnahme.
- **Auf echtem Touch-Gerät testen:** Zwei-Finger-Geste und Hinweis auf Deep Teal (bisher nur im Desktop-Browser geprüft).

### Verkehrslage-Logik

Abgleich mit der Vorgänger-App (Angular, Handover «Verkehrslage-Logik» vom 27.10.2026). Dort löste ein einzelner km/h-Wert irgendeiner Spur und Fahrzeugklasse den Status aus, «Stockend» wurde vor «Stau» geprüft, eine defekte Spur machte die ganze Stelle «fehlerhaft», und Fehler und Normal waren beide blau. Diese Punkte sind bei uns bereits gelöst:

- Flussgewichtetes Mittel pro Fahrtrichtung, die langsamere Richtung entscheidet.
- Priorität Stau > Stockend > Flüssig.
- Ausgefallene Spuren fallen weg, der Teilausfall ist sichtbar (gestrichelter Ring).
- «Keine Daten» nur, wenn keine gültige Spur übrig ist.
- Eigene Form für «Keine Daten».

Massgebende Definition (Recherche 27.10.2026): ASTRA und BFS definieren Stau und stockenden Verkehr gleich. Auf diese Definition stützt sich auch die ASTRA-Staustatistik. Sie beruht auf den Verkehrsmeldungen von Viasuisse.

- **Ausserorts (Hochleistungs- und Hauptstrassen):**
  - Stau: Fahrzeuggeschwindigkeit mindestens 1 Minute unter 10 km/h, häufig Stillstand.
  - Stockend: mindestens 1 Minute unter 30 km/h und/oder teilweise kurzer Stillstand.
- **Innerorts (Hauptstrassen):** Stau, wenn die Warte- bzw. Verlustzeit an Knoten oder Engpässen mindestens 5 Minuten beträgt. Eine Zählstelle misst das nicht.

Quellen:

- [BFS, Definition Stau](https://www.bfs.admin.ch/asset/de/8288664)
- [ASTRA, Definitionen](https://www.astra.admin.ch/de/definitionen)
- [BFS MONET 2030, Staubelastung](https://www.bfs.admin.ch/bfs/de/home/statistiken/nachhaltige-entwicklung/monet-2030/indikatoren/staubelastung-nationalstrassennetz.html)

Zum Vergleich, nicht übernehmen:

- ADAC (Deutschland, Sekundärquelle): Stau unter 20 km/h während 5 Minuten auf mindestens 1 km, stockend 20–40 km/h.
- DATEX II `TrafficStatusEnum` (`freeFlow`, `heavy`, `congested`, `impossible`) hat keine Zahlenwerte.
- ASTRA-Monitoring «Zielgeschwindigkeit» (signalisiert −10/−20 km/h) und ARE-Staukosten (< 65 % der Referenzgeschwindigkeit) dienen Jahresstatistiken, nicht der Lage in Echtzeit.

Unsere Schwellen von 10 und 30 km/h entsprechen der ASTRA-Definition für ausserorts. Eine eigene Interpretation ist nur für die Fragen nötig, die die Definition offenlässt.

Umgesetzt am 27.10.2026, siehe «Entscheide»: Mindestverkehr (Variante A, 180 Fz/h) und Innerorts-Regel (Variante A). Die Lage berechnet der Server (`server/src/congestion.ts`). Die Strassenklasse stammt aus der TMC-Ortstabelle; ausgewertet wurde TMC 7.5:

- Die Zählstellen-ID nennt nur den Betreiber (`CH:` ASTRA, `ZH.CH:` Kanton Zürich usw.), nicht den Strassentyp.
- Das TMC-Feld `URBAN` ist überall 0 und taugt darum nicht.
- Zählstellen ohne TMC-Bezug haben `area: null` und werden wie ausserorts beurteilt.

Offen, jeweils mit Empfehlung (★):

- **Quelle nennen:** Erledigt mit der Seite «So funktioniert die Karte» (`/info`).
- **Zeitliche Glättung** (Entscheid offen): ASTRA verlangt «mindestens 1 Minute», unsere Minutenwerte erfüllen das schon. Ein Mittel über mehrere Minuten würde kurze Staus unterschlagen, die ASTRA mitzählt.
  - ★ A: Eintritt wie ASTRA nach der letzten Minute, Austritt erst nach z. B. 2 Minuten über der Schwelle (Hysterese), damit die Karte nicht flackert. Den Verlauf hält der Server schon für die Innerorts-Regel.
  - B: Flussgewichtetes Mittel über 3–5 Minuten (weicht von ASTRA ab).
  - C: Keine Glättung.
- **Innerorts genauer bestimmen** (später): Heute gilt eine Zählstelle als innerorts, wenn sie an einer Stadtstrasse (TMC L5.0) oder an einem Knoten abseits der Autobahn liegt. Genauer ginge es über die signalisierte Höchstgeschwindigkeit (OpenStreetMap `maxspeed`, ODbL, mit Quellenangabe) oder über Verkehrsnetz CH (VnCH); ob VnCH ein solches Attribut hat, ist noch zu prüfen.
- **Verlauf nach Neustart:** Den Verlauf hält der Server nur im Speicher. Nach einem Neustart meldet er innerorts darum erst nach 5 Minuten wieder Stau. Den Verlauf persistent zu halten lohnt sich erst mit dem Rückblick.
- **Plausibilität:** Unplausible Werte serverseitig verwerfen und in den Details als Messfehler zeigen, z. B. > 200 km/h, Fluss pro Spur > 3000 Fz/h oder km/h > 0 bei 0 Fz/h. Das ist Voraussetzung für Top-Listen und Statistiken. Grenzwerte zum Entscheid.
- **Texte aus den Konstanten erzeugen:** 10/30 km/h, 5 Minuten und 3 Fahrzeuge pro Minute stehen als fester Text in `web/src/i18n/de.ts`, getrennt von den Konstanten in `server/src/congestion.ts`. Der Server könnte die Schwellen in der API mitliefern. Ohne Entscheid umsetzbar.

### Funktionen aus der Vorgänger-App

Die Reihenfolge entspricht der Empfehlung. Jeder Punkt braucht einen Entscheid.

1. **Stand-Badge auf der Karte** (S): Zeit des Datenstands unten rechts, mit eigener Farbe, wenn die Daten veraltet sind. Auf Mobil ist der Stand heute neben der Karte nicht sichtbar.
2. **Info-Panel:** Umgesetzt als Seite «So funktioniert die Karte» (`/info`). Es fehlen noch Betreiber, Kontakt und Impressum; den Inhalt liefert der Projektinhaber.
3. **Überblick mit Kennzahlen und Top-Listen** (M, nach der Plausibilitätsprüfung): Anzahl Zählstellen, Fahrzeuge/h gesamt (Summe der Querschnitte), langsamste Zählstellen, höchster Verkehrsfluss. Der Server rechnet die Kennzahlen. Top-Listen werden einmal pro Zählstelle gebildet und sortiert; in der Vorgänger-App waren Werte und Orte getrennt sortiert und falsch gepaart. Ob eine Liste der höchsten Geschwindigkeiten («Raser») öffentlich gezeigt wird, ist eine Produktfrage.
4. **Fahrtrichtungen auf der Karte** (M): Ab Zoom 13 je ein Halbkreis oder Punkt pro Richtung, mit Zielort im Tooltip. Ein Stau in nur einer Richtung wird dadurch direkt sichtbar.
5. **Fahrstreifen-Grafik in den Details** (M): Balken pro Spur, Personenwagen und Lastwagen gestapelt, ohne Animation, mit Text als Alternative.
6. **Rückblick** (L, nach dem Hosting-Entscheid): opentransportdata.swiss liefert nur aktuelle Werte, wir müssten also selbst speichern. Offen sind Speicherort, Aufbewahrungsdauer und eine Zeitachse im UI. Davon würden auch die Glättung und die Schwellen relativ zur üblichen Geschwindigkeit profitieren.

Nicht übernehmen:

- Cluster mit Anzahl, weil sie die Lage verdecken.
- Popup plus Detail-Modal (zwei Klicks).
- «Alle Marker löschen».
- Einheitliches Blau für alle Marker.
- Symbolleiste nur mit Icons.

## Entscheide

| Datum | Entscheid | Grund |
| --- | --- | --- |
| 2026-10-27 | Innerorts-Regel (Variante A von drei): Autobahnen (TMC L1.1) nach ASTRA ausserorts. Stadtstrassen (L5.0) und Zählstellen an Knoten abseits der Autobahn erst dann Stau oder Stockend, wenn die Schwelle 5 Minuten am Stück unterschritten ist. Übrige Strassen und Zählstellen ohne TMC-Bezug wie ausserorts. Verworfen: alle Nicht-Autobahnen nach der Innerorts-Regel (B), Innerorts über OSM/VnCH bestimmen (C, später). | ASTRA definiert Stau innerorts über 5 Minuten Verlustzeit an Knoten, die eine Zählstelle nicht misst. An Lichtsignalen zeigte eine einzelne Minute oft nur die Rotphase. |
| 2026-10-27 | Mindestverkehr (Variante A von drei): Stau und Stockend erst ab 180 Fz/h (3 Fahrzeuge pro Minute) in der langsameren Richtung, darunter «Flüssig» mit Hinweis. Verworfen: eigene Stufe «Wenig Verkehr» (B), kein Mindestfluss (C). | 4 von 51 Störungen beruhten auf einem einzigen Fahrzeug. ASTRA verlangt «häufig Stillstand» des Verkehrs. |
| 2026-10-27 | Für Stau und stockenden Verkehr gilt die Definition von ASTRA/BFS. Ausserorts: Stau unter 10 km/h, stockend unter 30 km/h, jeweils mindestens 1 Minute. Innerorts: Stau bei mindestens 5 Minuten Verlustzeit an Knoten. Eigene Regeln nur, wo die Definition Lücken lässt (Mindestverkehr, Innerorts-Näherung). | Offizielle und einheitliche Linie für die Schweiz; auch die ASTRA-Staustatistik und Viasuisse folgen ihr. Entscheid des Projektinhabers im Chat. |
| 2026-10-27 | Teilausfälle (Variante A von drei): Lage aus den übrigen Fahrstreifen, dazu gestrichelter Ring auf der Karte und «x von y Fahrstreifen ohne Daten» in Tooltip und Details. Verworfen: «Keine Daten» bei Ausfall einer ganzen Fahrtrichtung (B), Hinweis nur in den Details (C). | Teilausfälle waren auf der Karte unsichtbar; ein Stau in der ausgefallenen Richtung blieb verborgen (27.10.2026: 38 Zählstellen, 19 mit ganzer Richtung). |
| 2026-10-27 | Verkehrslage nach der langsameren Fahrtrichtung (`worstSpeed`), nicht nach dem Durchschnitt beider Richtungen. | Der Durchschnitt verdeckte Staus in nur einer Richtung (z. B. 8 km/h und 60 km/h → Ø 19 km/h, «Stockend»). Aus der UI/UX-Review; Umsetzung freigegeben. |
| 2026-10-27 | UI/UX-Review umgesetzt: Ampel mit Helligkeits- und Formunterschieden, Details oben mit Fokusführung, Liste «Aktuelle Störungen», «Quelle und Betreiber» zugeklappt, Auswahl in der URL. | Stau und Flüssig waren bei Rot-Grün-Schwäche ununterscheidbar (Kontrast 1,11:1), Störungen gingen zwischen flüssigen Zählstellen unter, Details erschienen ausserhalb des Sichtbereichs. |
| 2026-10-27 | Strassennetz der Karte (Variante B von drei): Autobahnen in dunklem Teal in jeder Zoomstufe, Kantonsstrassen hell, Kantonsgrenzen gestrichelt; eigene Übersichts-Layer bis Zoom 11. Verworfen: weisse Strassen wie die Website (A), durchgezogene Kantonsgrenzen (C). | In der Übersicht fehlten Autobahnen und Kantonsstrassen. A unterschied die Strassenklassen kaum, bei C sahen Grenzen und Strassen ähnlich aus. |
| 2026-10-27 | Karte mit MapLibre GL und swisstopo-Vektorkacheln, zur Laufzeit in Markenfarben umgerechnet (Variante B). Zwei-Finger-Geste nur auf Touch-Geräten, nur die Landesgrenze. Verworfen: Leaflet mit eingefärbten Rasterkacheln (A), selbst gehostete Protomaps-Kacheln (C). | Look und Bedienung der Intersys-Standortkarte ohne Kachel-Hosting. A bot nur eine Tönung ohne Roboto, C braucht eine Datei von mehreren hundert MB und Hosting. |
| 2026-10-27 | Gestaltung nach dem Intersys-Designbriefing für interne Tools. Aus `intersys.css` werden per `ds:sync` nur Tokens, Basis und die verwendeten Komponenten übernommen. Die Abweichungen stehen in `design.md`. | Als Intersys erkennbar bei kleinem Aufwand. Kein Fork des Design Systems. |
| 2026-10-27 | Ampel der Karte aus Tokens: Stau = `--error`, Flüssig = `--success`, Keine Daten = `--control-border`, Stockend = eigenes Token `--traffic-slow`. | Möglichst nah am Design System. Für Orange gibt es kein Token. |
| 2026-10-27 | Keine sichtbaren Texte im Code. UI-Texte stehen in `web/src/i18n/de.ts`, der Server liefert Codes statt Texte. | Texte zentral pflegen und ändern, ohne Logik anzufassen. Server und Web bleiben sprachunabhängig. |
| 2026-10-27 | `CHANGELOG.md` und `docs/agents/open-items.md` führen. | Änderungen und Entscheide nachvollziehbar halten, auch über mehrere Agent-Sitzungen hinweg. |
| 2026-10-27 | CI-Logik in Scripts, Konfiguration zur Laufzeit, ein Artefakt für alle Umgebungen. | Wechsel des CI-Anbieters ohne Umbau. Kein Build pro Umgebung. Secrets nie im Build. |
| 2026-10-27 | Die API wird nur über den eigenen Server abgefragt, der Key bleibt auf dem Server. | Schutz des Keys. Ein zentraler Abruf schont das Rate-Limit von 5 Abrufen pro Minute. |
| 2026-10-27 | Sensor- und TMC-Daten liegen als Snapshot in `server/data/`. | Keine Laufzeitabhängigkeit von ArcGIS und der TMC-Quelle. |
