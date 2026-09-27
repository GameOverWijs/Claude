# Blokkenscanner

Scratch zonder scherm, voor TechniScience en ander STEAM-onderwijs. Leerlingen bouwen een Scratch-script met papieren, kartonnen of 3D-geprinte blokken, maken er een foto van, en de Blokkenscanner vertelt of de code werkt. Daarna voert Robo de code uit op een speelveld, en bij een opdracht ("teken een vierkant") controleert de scanner of het resultaat klopt.

Alle blokken zijn te downloaden als SVG op ware grootte: in kleur, als kleurplaat, of in lagen voor de 3D-printer.

## Snel starten

De app is een gewone webpagina zonder installatie of server.

1. Download deze map (of clone de repository) en open `index.html` in Chrome, Edge, Safari of Firefox.
2. Kies bij **Scannen** een voorbeeld uit de lijst "Voorbeeld proberen" om te zien hoe het werkt, zonder iets te printen.
3. Print bij **Blokken & downloads** de klassenset (A4-printvellen) en ga aan de slag.

Voor gebruik op tablets en telefoons in de klas is een https-adres handig, want de live camera werkt alleen via https. Met GitHub Pages kan dat gratis: Settings, Pages, "Deploy from a branch", kies de hoofdtak en map `/ (root)`. De knop "Foto maken" werkt overal, ook zonder https: die opent de camera-app van het apparaat.

## Hoe het werkt

### Codevierkantjes (standaard, werkt offline)

Op elk blok staat links een zwart-wit codevierkantje van 2,2 bij 2,2 cm (een ArUco-marker). De scanner zoekt die vierkantjes op de foto en weet daarmee welk blok waar ligt en hoe het gedraaid is. Daaruit volgt:

- **De volgorde**: blokken die recht onder elkaar liggen (ongeveer 3 cm per blok) vormen één script. Een gat van meer dan ongeveer 2 cm betekent een nieuw script.
- **De waarden**: elk blok heeft een standaardwaarde, zoals *neem (10) stappen*. Een getal-, tekst- of kleurtegel precies op het vakje vervangt die waarde. Voorwaarden (zeshoekige tegels) gaan in het zeshoekige vakje van *als*, *herhaal tot* en *wacht tot*.
- **C-blokken**: op papier kan een C-blok niet uitrekken. Daarom bestaat het uit een bovenstuk (*herhaal (4)*, *als <> dan*), de blokken erin (een stukje ingesprongen) en een los *einde*-stuk, eventueel met een *anders*-stuk ertussen. Vergeet een leerling het einde, dan meldt de scanner dat als fout en raadt aan de hand van het inspringen waar het einde had moeten liggen.

De foto verlaat het apparaat niet. De 200 gebruikte codes zijn gekozen uit het OpenCV-woordenboek ARUCO_5X5_1000 zodat elke twee codes in minstens 7 van de 25 vakjes verschillen, ook als een blok gedraaid ligt. Tot 2 verkeerd gelezen vakjes worden automatisch verbeterd (instelbaar).

### Vrij getekende blokken

- **Met stickers**: print het stickervel met codevierkantjes en plak het juiste vierkantje op een zelf getekend blok. Dan werkt alles offline.
- **Met AI**: zet de scanner op "Vrij getekend (AI)". De foto gaat naar Claude (Anthropic), dat alleen overschrijft wat er getekend is, fouten inbegrepen. Het controleren doet de scanner daarna zelf met dezelfde regels. Hiervoor is een API-sleutel nodig (Instellingen). De sleutel blijft in de browser en wordt alleen naar `api.anthropic.com` gestuurd.

Kosten van de AI-modus (schatting, prijzen van Anthropic per juni 2026): Claude Opus 5 (standaard) ongeveer $0,05 tot $0,11 per foto, Claude Sonnet 5 $0,02 tot $0,05, Claude Haiku 4.5 ongeveer $0,01. Een klas van 30 leerlingen met elk 5 foto's: $7 tot $17 met Opus 5. Na elke foto toont de app het echte tokengebruik.

**Privacy**: in de AI-modus gaat de foto naar Anthropic in de Verenigde Staten. Overleg dit met de privacyfunctionaris van de school, zet geen gezichten of namen in beeld, en gebruik bij twijfel de codevierkantjes. De AI-modus staat pas aan als de leerkracht bij Instellingen toestemming aanvinkt.

### Wat de controle zegt

| Niveau | Voorbeelden |
|---|---|
| Fout | geen startblok, einde-stuk vergeten of te veel, *anders* zonder *als*, tekst waar een getal hoort, `0,5` in plaats van `0.5`, blokken onder *herhaal* zonder getal of onder *stop alle* |
| Let op | lege lus, *als* zonder voorwaarde, getal groter dan het speelveld, Robo loopt tegen de rand, er gebeurt niets zichtbaars |
| Tip | drie keer dezelfde blokken achter elkaar (gebruik *herhaal*), meerdere groene vlaggen, niet netjes ingesprongen, blok ligt scheef |
| Opdracht | de code wordt in een flits uitgevoerd en het resultaat gecontroleerd: is de vorm dicht, zijn alle zijden even lang, draait Robo de goede hoek, zegt hij echt "Hallo!" |

Opdrachten: vierkant, driehoek, zeshoek, ster, trap, hallo zeggen, heen en weer lopen, dansje, en vrij bouwen.

Met **Openen in Scratch (.sb3)** bewaart een leerling de herkende code als echt Scratch-project, met Robo als sprite, om op het scherm verder te werken.

## Printen en 3D-printen

- Alle SVG's zijn in millimeters. Print op 100 %, niet "aanpassen aan pagina". Op elk A4-vel staat een lijn van 50 mm om dat te controleren.
- **Kleur**: zoals Scratch. Print op karton of stickerpapier. Mat lamineren kan; glanzend laminaat weerkaatst licht en maakt codevierkantjes onleesbaar.
- **Kleurplaat**: zwart-wit, leerlingen kleuren zelf in (de codevierkantjes blijven zwart-wit).
- **3D**: tekst is omgezet naar paden, dus de bestanden werken in Tinkercad, lasersnijders en snijplotters.
  - Een kleur printer: print `3D-vorm` (3 à 4 mm dik) en plak de kleurversie er als sticker op. Dit is het betrouwbaarst.
  - Meerdere kleuren: importeer `3D-vorm`, `3D-opdruk` en `3D-codevierkant` in Tinkercad. De drie lagen zijn precies even groot (twee piepkleine hoekpuntjes zorgen daarvoor) en passen op elkaar. Opdruk 0,6 mm wit, codevierkant 0,6 mm zwart.
  - Het codevierkantje moet zwart op wit zijn. Geel of oranje zonder witte opdruk leest de scanner niet.

## Voor ontwikkelaars

Geen buildstap: alle bestanden in `js/` zijn gewone scripts die aan `globalThis.Blok` hangen, zodat `index.html` ook via `file://` werkt en dezelfde code in Node getest kan worden.

| Bestand | Wat |
|---|---|
| `js/markers.js` | de 200 vaste codes, codevierkantjes tekenen, koppeling met js-aruco2 |
| `js/catalog.js` | alle blokken en tegels met vaste codenummers, maten |
| `js/render.js` | SVG van losse stukken (5 stijlen), tegels, complete scripts, opstellingen |
| `js/sheets.js`, `js/zip.js` | A4-vellen, stickervel, klassenset, ZIP |
| `js/recognize.js` | vierkantjes zoeken (meerdere schalen) en ligging vertalen naar blokken, tegels en inspringen |
| `js/structure.js` | losse stukken naar geneste scripts, einde/anders, inspringen als reserve |
| `js/validate.js` | controle en meldingen |
| `js/interpreter.js`, `js/stage.js` | Scratch-achtige uitvoerder met virtuele klok, speelveld met Robo |
| `js/assignments.js` | opdrachten en hun controle |
| `js/ai.js` | AI-modus (Anthropic SDK, gestructureerde uitvoer) |
| `js/sb3.js` | export naar Scratch 3 |
| `js/app.js` | de pagina |

Tests:

```bash
npm install          # alleen voor de tests en de lettertype-tool
npm test             # unit-tests in Node
npm run test:browser # echte beeldtest in Chromium: opstelling -> nep-foto -> herkenning; plus AI-modus tegen een nagebootste server
```

De beeldtest maakt nep-foto's (gedraaid, schuin, klein, onscherp met ruis, met schaduw) en eist dat elk codevierkantje gevonden wordt en de scripts exact terugkomen.

Een blok toevoegen: voeg het toe in `js/catalog.js` met een vrij codenummer (`Blok.freeCodes()` geeft de vrije nummers) en een uitvoering in `js/interpreter.js`. **Verander nooit bestaande codenummers**: geprinte blokken gebruiken ze al.

Lettertype opnieuw omzetten: `npm run build:font` (maakt `js/font-data.js` uit `fonts/Nunito-ExtraBold-subset.ttf`).

## Beperkingen

- De scanner leest codevierkantjes, geen tekst. Een blok zonder vierkantje ziet hij alleen in de AI-modus.
- Getallen die niet als tegel bestaan (bijvoorbeeld 37) kunnen alleen in de AI-modus. De tegelset bevat de getallen die in de opdrachten nodig zijn; extra tegels zijn eenvoudig toe te voegen.
- Variabelen, klonen, berichten en operatoren zitten er (nog) niet in. De set is gericht op beweging, pen, uiterlijken en lussen.
- Robo begint bij elke klik op de groene vlag opnieuw in het midden (in Scratch blijft hij staan waar hij was); zo komt het speelveld altijd overeen met de controle.
- De AI-modus is getest tegen een nagebootste Anthropic-server, niet tegen de echte API.

## Licenties van gebruikte onderdelen

Zie [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Scratch is een project van de Scratch Foundation in samenwerking met de MIT Media Lab Lifelong Kindergarten Group. De Blokkenscanner is daar niet aan verbonden; de bloknamen volgen de Nederlandse Scratch-vertaling zodat leerlingen dezelfde woorden zien.
