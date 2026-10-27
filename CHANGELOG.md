# Changelog

Änderungen, die Nutzer oder Betrieb bemerken. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionen nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unveröffentlicht]

### Hinzugefügt

- Live-Karte der Zählstellen mit Fahrzeugen/h und Ø km/h. Der Server fragt opentransportdata.swiss (DATEX II) zentral ab, der API-Key bleibt auf dem Server.
- Positionen aus der offiziellen TMC-Ortstabelle 7.5 (Punkt plus Offset). Ein- und Ausfahrten werden getrennt von der Hauptfahrbahn aggregiert.
- Exakte Sensorstandorte, Namen und Zielorte der ASTRA-Zählstellen. Dazu eine Suche nach Zählstellen.
- Disk-Cache für die letzten API-Antworten. Ein Neustart ohne API-Verbindung zeigt dadurch weiterhin Daten.
- `GET /api/health` mit Status pro Datenquelle. Das UI meldet Ausfälle verständlich und zeigt den Stand der angezeigten Daten.
- Seitenleiste mit Gruppen nach Quelle (Bund/Kanton) und Betreiber. Gruppen lassen sich ein- und ausblenden und aufklappen.
- Leerzustand, wenn die Suche keine Zählstelle findet.
- Liste «Aktuelle Störungen» oben in der Seitenleiste: Stau und stockender Verkehr, langsamste zuerst, anklickbar.
- Teilbarer Link auf eine Zählstelle (`?z=<Zählstellen-ID>`).
- Klick auf eine Zählstelle in der Karte zentriert sie; in der Übersicht zoomt die Karte dabei auf Zoom 12.
- `worstSpeed` in `/api/measurements`: Geschwindigkeit der langsameren Fahrtrichtung.

### Geändert

- Gestaltung nach dem Intersys Design System: Kopfleiste in Deep Teal mit Logo, Roboto (selbst gehostet), Karten, Notices und Tabellen aus dem Design System, Ampelfarben der Karte aus Tokens, Klickflächen von mindestens 40 px und Sie-Form.
- Die Suche hat ein sichtbares Label und einen Hinweis statt eines Platzhaltertexts.
- Karte mit MapLibre GL statt Leaflet, im Stil der Intersys-Standortkarte: swisstopo-Vektorkacheln in Markenfarben, Beschriftung in Roboto, ohne Relief und Icons. Autobahnen in dunklem Teal, Kantonsstrassen und gestrichelte Kantonsgrenzen auch in der Übersicht der ganzen Schweiz. Kein Drehen und Neigen; auf Touch-Geräten verschiebt erst eine Zwei-Finger-Geste die Karte. Die Karte lädt nach der Seitenleiste.
- Die Auswahl der Hintergrundkarte (swisstopo farbig/grau, OpenStreetMap) entfällt.
- Die Verkehrslage richtet sich nach der langsameren Fahrtrichtung statt nach dem Durchschnitt beider Richtungen. Ein Stau in nur einer Richtung wird so nicht mehr als «Stockend» oder «Flüssig» ausgewiesen.
- Ampel auch bei Rot-Grün-Schwäche lesbar: Flüssig klein und gedämpft, Stockend und Stau mit Mindestgrösse, Stau zusätzlich mit Ring, Keine Daten als hohler Ring. Kreise in der Übersicht kleiner.
- Details der ausgewählten Zählstelle oben in der Seitenleiste, rücken nach jeder Auswahl in Sicht und erhalten den Fokus; Escape schliesst, der Fokus kehrt zurück. Messwerte pro Fahrstreifen als Liste statt Tabelle, auch auf 320 px lesbar.
- «Quelle und Betreiber» standardmässig zugeklappt, mit Zusammenfassung; doppelte Zeilen wie «Kanton Bern › Kanton Bern» entfallen.
- Ladezustand: Anzahlen zeigen «–» statt «Keine Daten», solange Messwerte laden.
- Mobil: ganze Schweiz im Startausschnitt, Kopfleiste ohne verwaisten Trennstrich, keine Ländernamen auf der Karte.
