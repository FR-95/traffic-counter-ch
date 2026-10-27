# Gestaltung und Design System

Das Tool folgt dem Intersys-Designbriefing für interne Tools: ruhig, klar, funktional, als Intersys erkennbar, aber kein Marketing-Look. Diese Datei fasst das Briefing für dieses Projekt zusammen und hält die Abweichungen fest.

## Dateien

| Datei | Inhalt | Ändern |
| --- | --- | --- |
| `web/src/design/intersys.css` | Tokens, Basis-Styles und die verwendeten Komponenten aus dem Design System | **Nie von Hand.** Neu erzeugen mit `npm run ds:sync -w web -- <pfad/zu/intersys.css>` |
| `web/scripts/ds-sync.ts` | Auswahl der übernommenen Komponenten (`ALLOWED_CLASSES`) | Neue Komponente hier eintragen, dann neu synchronisieren |
| `web/src/design/additions.css` | Eigene Ergänzungen: Roboto, Ampel-Tokens, Seitenleistenbreite, Klickflächengrösse | Nur mit Tokens, jeder Eintrag mit Begründung |
| `web/src/design/assets/` | Roboto (variabel, 100–900, lateinischer Zeichensatz) und das weisse Intersys-Logo, beide von intersys.ch übernommen | Durch Dateien aus dem Design-System-Export ersetzen, sobald verfügbar |
| `web/src/design/tokens.ts` | Liest Tokens zur Laufzeit für Karte und Marker, die keine CSS-Klassen kennen | – |
| `web/src/index.css` | Layout und Bausteine des Tools, Anpassungen der MapLibre-Bedienelemente | Nur Tokens verwenden |
| `web/src/map/base-style.json` | Reduzierter Kartenstil von swisstopo (Snapshot) | **Nie von Hand.** Neu erzeugen mit `npm run build:map-style -w web`; Layer-Auswahl in `web/scripts/build-map-style.ts` |
| `web/src/map/tint.ts` | Rechnet den Kartenstil zur Laufzeit in Markenfarben um | – |
| `web/public/map/fonts/` | Roboto-Glyphen (Regular, Medium; Zeichenbereiche 0–511 und 8192–8447) von intersys.ch | Mit dem Design-System-Export ersetzen |

## Regeln

- **Nur Tokens.** Keine freien Farben, Schriftgrössen oder Abstände. Erlaubt sind 1-px-Rahmen wie im Design System. Transparenzen nur mit `color-mix()` aus Tokens.
- **Farben:** Deep Teal (`--deep-teal`) für Kopfleiste, primäre Aktionen und Überschriften. Flächen bleiben hell und neutral: `--white`, Karten in `--soft-surface` mit Rahmen `--line-gray`. Text in `--body-ink`, Meta-Angaben in `--ink-muted`. Peach (`--growth-peach`) nur für Hinweis-Notices. `--legacy-blue` wird nicht verwendet. Flächenanteil etwa 80 % hell, 15 % Deep Teal, höchstens 5 % Akzent.
- **Typografie:** Roboto, selbst gehostet. Tool-Titel (H1) mit `--text-h2` (36 px, 900), Abschnitte mit 24 px (700), Kartentitel mit `--text-h4` (18 px, 700). Fliesstext 16 px, Meta-Angaben 13 px (`.meta`), dichte Tabellen 14 px. `--text-hero-h1` nicht verwenden.
- **Form:** Karten flach mit Rahmen und `--radius-card`, Buttons mit `--radius-button`. Schatten (`--shadow-float`) nur für Überlagerungen. Innenabstand standardmässig `--space-4`, zwischen Blöcken `--space-5` bis `--space-6`.
- **Komponenten** aus dem Design System, nicht neu erfinden: `.button` (höchstens ein primärer pro Ansicht, sonst `.button--outline`, Beschriftung als Verb), `.form-field` (Label über dem Feld, Hinweis und Fehler darunter), `.check-field`, `.card`, `.notice` / `.notice--error` / `.notice--success`, `.empty-state`, `.tag`, Tabellen mit Kopf in `--teal-surface`.
- **Icons** nur aus dem Design System. Bis die Icons verfügbar sind, gilt das Muster «+»/«−» der FAQ-Komponente zum Auf- und Zuklappen. Notices tragen ein fettes Wort («Fehler:», «Hinweis:»), damit sie nicht nur durch Farbe unterscheidbar sind.
- **Zustände:** Für jede Ansicht sind Laden, Leer und Fehler gestaltet. Ein Leerzustand sagt, was als Nächstes zu tun ist. Solange Messwerte laden, stehen Anzahlen als «–», nicht als «Keine Daten».
- **Seitenleiste, von oben nach unten:** Titel und Stand, Meldungen, Details der Auswahl, Aktuelle Störungen, Suche, Filter Lage, Quelle und Betreiber (zugeklappt). Was Nutzende zuerst brauchen, steht oben.
- **Auswahl:** Nach jeder Auswahl (Karte, Störungsliste, Suche, Liste) rücken die Details in Sicht und der Titel erhält den Fokus. Escape oder «Schliessen» gibt den Fokus an das auslösende Element zurück. Die Auswahl steht in der URL (`?z=`).
- **Barrierefreiheit:** Kontrast mindestens WCAG AA. Dafür nur die Token-Paare des Design Systems verwenden, keine eigenen Kombinationen. Sichtbarer Fokusrahmen, volle Bedienung per Tastatur, Klickflächen mindestens `--target-min` (40 px).
- **Sprache:** Deutsch (Schweiz), Sie-Form, kein ß. Texte stehen im Wörterbuch `web/src/i18n/de.ts`.
- **Kein Dark Mode**, solange das Design System keinen definiert.
- **Neue Muster** oder Abweichungen als Rückmeldung ans Design System in [open-items.md](open-items.md) eintragen und nicht dauerhaft im Tool erfinden.

## Karte

Angelehnt an die Standortkarte auf intersys.ch, aber für die ganze Schweiz und mit 757 Zählstellen.

- **Bibliothek:** MapLibre GL, nachgeladen per `React.lazy`, damit die Seitenleiste sofort erscheint. Der Worker ist eine eigene Datei (`setWorkerUrl`), weil die CSP `script-src 'self'` gilt.
- **Kacheln:** Vektorkacheln der «Basiskarte leicht» von swisstopo, zur Laufzeit von `vectortiles*.geo.admin.ch` (in der CSP freigegeben). Selbst gehostete PMTiles wie auf der Website wären für die ganze Schweiz zu gross.
- **Stil:** Ein eigener Layer-Aufbau entfällt. `build:map-style` übernimmt aus dem swisstopo-Stil nur Flächen, Wasser, Strassen, Gebäude, Landesgrenze und Beschriftungen. Icons fallen weg; bei Layern mit Text bleibt nur die Beschriftung. Weggelassen sind Relief, Höhenlinien, POIs, Gipfel, Wege, Bahnen und Gemeindegrenzen, weil sie die Karte unruhig machen.
- **Übersicht:** Die swisstopo-Strassen erscheinen erst ab Zoom 8. Drei eigene Layer aus denselben Kacheln zeigen darum in der Übersicht Autobahnen und Autostrassen (`overview_motorway`), Haupt- und Kantonsstrassen (`overview_main`) und gestrichelte Kantonsgrenzen (`overview_canton`). Die Strassen-Layer blenden zwischen Zoom 9 und 11 aus, danach übernehmen die Detailstrassen von swisstopo.
- **Farben:** `tintStyle` in `map/tint.ts` rechnet die Farben zur Laufzeit aus den Tokens um: Land `--teal-surface`, Grautöne von `--deep-teal` bis `--white`, Wasser und Landesgrenze als Mischung aus Deep Teal und Weiss, Beschriftung in Deep Teal bzw. `--ink-muted` mit weissem Halo. Autobahnen sind in jeder Zoomstufe dunkles Teal (30 % Weiss, Kontur 15 %), Kantonsstrassen in der Übersicht hell (62 %), Kantonsgrenzen 50 %.
- **Schrift:** Roboto Regular und Medium als Glyphen-PBF unter `/map/fonts`; Frutiger-Schnitte von swisstopo werden darauf abgebildet. Ortsnamen in normaler Schreibung, nur Quartiere und Länder in Grossbuchstaben.
- **Zählstellen:** GeoJSON-Quelle mit Kreis-Layern unter der Beschriftung; Ampelfarben aus `--traffic-*` (über `colorToken`, das auch `color-mix()` auflöst), Auswahl als Ring in `--dark-teal`, exakte Fahrstreifen als Punkte in `--deep-teal`. Tooltips als Text (kein HTML), mit Lage in Worten.
- **Ampel:** Die Stufen unterscheiden sich in Helligkeit, Grösse und Form, nicht nur im Farbton (Rot-Grün-Schwäche, WCAG 1.4.1): Flüssig mittelhell und klein (80 % der Flussgrösse, leicht transparent), Stockend mit Mindestradius 6, Stau mit Mindestradius 7 und Ring, Keine Daten als hohler Ring. Störungen liegen oben. Radien skalieren mit dem Zoom (70 % in der Übersicht, 140 % ab Zoom 14). Die Punkte in Legende und Listen zeigen dieselben Formen.
- **Bedienung:** Zoom-Buttons mit `--radius-button` und `--target-min`, kein Drehen und Neigen, sichtbarer Fokusrahmen. Auf Touch-Geräten (Karte in scrollender Seite) verschiebt erst eine Zwei-Finger-Geste die Karte; der Hinweis erscheint auf Deep Teal. Auf dem Desktop zoomt das Mausrad frei, weil die Karte dort die Hauptansicht ist.
- **Zoom und Grenzen:** Start auf der ganzen Schweiz, Min 5, Max 18, `maxBounds` grosszügig, damit auch schmale Bildschirme die ganze Schweiz zeigen. Auswahl über Liste oder Suche fliegt auf Zoom 15. Ein Klick in der Karte zoomt nur in der Übersicht (unter Zoom 10) auf 12 und zentriert sonst bloss, damit der Überblick erhalten bleibt.
- **Fehler:** Fallen mehrere Kacheln aus, erscheint ein Hinweis; ohne WebGL eine Fehlermeldung. Seitenleiste, Suche und Details funktionieren in beiden Fällen weiter.

## Projektspezifische Abweichungen vom Briefing

| Briefing | Hier | Grund |
| --- | --- | --- |
| Kopfleiste mit Benutzer und Abmelden | Nur Logo und Toolname | Öffentliches Tool ohne Anmeldung |
| Inhalt im Container 1200 px oder 720 px | Seitenleiste mit `--sidebar-width` (400 px), die Karte füllt den Rest | Kartenanwendung, keine Lesespalte |
| Kernfunktionen ohne JavaScript | Karte und Filter brauchen JavaScript | WebGL-Karte (MapLibre). Die Server-API funktioniert ohne Client. |
| Ein primärer Button pro Ansicht | Kein primärer Button | Die Ansicht hat keine Hauptaktion. «Schliessen» ist sekundär. |
| Klickflächen | `--target-min` = 40 px, die Komponenten des Design Systems haben meist 44–52 px | Dichte Listen in der Seitenleiste. Kompakte Buttons mit `.button--compact`. |
| Nur Farb-Tokens | Ampel der Karte: `--traffic-jam` = `--error`, `--traffic-free` = 75 % `--success` mit `--white`, `--traffic-nodata` = `--control-border`, `--traffic-slow` = eigenes Orange | Das Design System hat keine Skala für Datenvisualisierung. Als Rückmeldung gemeldet. |
| Logo und Roboto aus dem Design-System-Export | Von intersys.ch übernommen, ebenso die Karten-Glyphen | Der Export liegt dem Projekt nicht vor |
| Standortkarte: Kacheln selbst gehostet, keine Drittanfragen | Vektorkacheln von swisstopo | Ein PMTiles-Ausschnitt der ganzen Schweiz wäre mehrere hundert MB gross; Hosting ist noch offen |
| Standortkarte: Mausrad nur mit Ctrl/⌘ | Nur auf Touch-Geräten eingeschränkt | Auf dem Desktop ist die Karte die Hauptansicht, nicht in eine Seite eingebettet |
| Standortkarte: keine Grenzen | Landesgrenze dezent, Kantonsgrenzen gestrichelt | Orientierung auf der Schweizer Karte |
| Standortkarte: Strassen weiss | Autobahnen dunkles Teal | Die Zählstellen liegen grösstenteils an Autobahnen; das Netz muss auch in der Übersicht lesbar sein |

## Abnahme (Checkliste)

- [ ] Nur Tokens, keine freien Farben, Schriftgrössen oder Abstände
- [ ] Logo, Kopfleiste in Deep Teal und Roboto stimmen
- [ ] Höchstens ein primärer Button pro Ansicht
- [ ] Fehler-, Leer- und Ladezustand gestaltet
- [ ] Tastaturbedienung, Fokusrahmen, Klickflächen und Kontrast geprüft
- [ ] Desktop (ab 768 px) und Mobil (darunter: Karte oben, Seitenleiste unten) im Browser geprüft
- [ ] Texte auf Deutsch (Schweiz), Sie-Form, ohne ß, im Wörterbuch
