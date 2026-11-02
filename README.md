# Gute-Nacht-Würfel (Rabbit R1 Creation)

Slot-Maschine mit drei Rollen (Held, Ort, Überraschung). Danach erzählt das R1 eine ca. 3-minütige Gute-Nacht-Geschichte und liest sie vor.

## Bedienung
- Schütteln oder „Drehen": nicht festgehaltene Rollen drehen
- Scrollrad: Rolle auswählen
- Seitentaste kurz: ausgewählte Rolle festhalten / lösen (oder Rolle antippen)
- Seitentaste lang oder „Los!": Geschichte starten
- In der Geschichte: Scrollrad = lesen, Seitentaste = zurück
- Drei gleiche Rahmenfarben = Jackpot (Geschichte bekommt eine Extra-Überraschung)

## Installieren
1. Ordner auf GitHub Pages, Vercel oder Netlify hosten (reines HTML, kein Build).
2. `install.html` auf dem Rechner öffnen, QR-Code erscheint automatisch.
3. Am R1 Kamera öffnen, QR scannen, installieren.
4. Nach Änderungen in `install.html` `VERSION` hochzählen und neu scannen.

## Anpassen (oben im Script von index.html)
- `KIND_NAME`: Name deines Sohnes, dann fährt er als Beifahrer mit
- `STORY_WORDS`: Länge der Geschichte
- `REELS`: Zutatenlisten

## Technik
Geschichte und Stimme kommen von Gemini über die Supabase-Edge-Function `gutenacht` (Projekt „Stammbaum“, Code unter `supabase/functions/gutenacht`). Benötigt das Secret `GEMINI_API_KEY`. Optional `GEMINI_VOICE` (Standard: Sulafat). Audio wird in Stücken geladen und abgespielt. Im Desktop-Browser läuft ein Testmodus (Tasten: S = drehen, Enter = Geschichte, Esc = Seitentaste, Pfeile = Scrollrad).
