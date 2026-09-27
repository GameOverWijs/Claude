// Catalogus van alle blokken, tegels en maten.
//
// Elk blok en elke tegel heeft een vast codenummer (het codevierkantje dat erop staat).
// Verander bestaande nummers nooit: geprinte blokken in de klas gebruiken ze al.
// Nieuwe blokken krijgen een vrij nummer (zie Blok.freeCodes()).
//
// Teksten volgen de Nederlandse Scratch 3-vertaling, zodat leerlingen dezelfde woorden
// zien als op het scherm.
(function (Blok) {
  'use strict';

  // Maten in millimeter. Alle stukken worden op ware grootte getekend (1 SVG-eenheid = 1 mm).
  Blok.GEOM = {
    CELL: 2.4,        // één vakje van het codevierkantje
    MARK: 16.8,       // zwart vierkant (7 vakjes)
    MBOX: 21.6,       // wit kader rond het codevierkantje (9 vakjes)
    PAD: 3.2,         // ruimte links van het codevierkantje
    H: 30,            // hoogte van een gewoon blok (fysiek)
    FS: 7,            // lettergrootte
    GAP: 2.4,         // ruimte tussen woorden, vakjes en pictogrammen
    NOTCH_X: 9,       // begin van de inkeping bovenaan
    NOTCH_SLOPE: 3,
    NOTCH_FLAT: 11,
    NOTCH_D: 2.5,     // diepte van inkeping en nokje
    ARM: 12,          // breedte van de arm van een C-blok (inspringen)
    STUB: 8,          // lengte van het armstompje op losse C-stukken
    CAP_H: 11,        // hoogte van de bolle kap van een startblok
    CAP_W: 58,
    RADIUS: 2.5,
    TILE_PAD: 1.2,    // wit rondom het codevierkantje op een tegel
    TILE_H: 24,       // hoogte van een tegel (en van een vakje op een fysiek blok)
    TILE_FS: 8.5,     // lettergrootte op tegels
    // Kleinere maten voor het tekenen van een heel script op het scherm (zonder codevierkantjes).
    S_H: 22,
    S_SLOT_H: 16,
    S_ARM: 9,
    S_BOTTOM: 10,
    S_CAP_H: 9,
  };

  Blok.CATEGORIES = {
    events: { name: 'Gebeurtenissen', fill: '#FFBF00', dark: '#CC9900', menu: '#E6AC00' },
    motion: { name: 'Beweging', fill: '#4C97FF', dark: '#3373CC', menu: '#4280D7' },
    looks: { name: 'Uiterlijken', fill: '#9966FF', dark: '#774DCB', menu: '#855CD6' },
    sound: { name: 'Geluid', fill: '#CF63CF', dark: '#BD42BD', menu: '#C94FC9' },
    control: { name: 'Besturen', fill: '#FFAB19', dark: '#CF8B17', menu: '#EC9C13' },
    sensing: { name: 'Waarnemen', fill: '#5CB1D6', dark: '#2E8EB8', menu: '#47A8D1' },
    pen: { name: 'Pen', fill: '#0FBD8C', dark: '#0B8E69', menu: '#0DA57A' },
    values: { name: 'Getallen, tekst en kleuren', fill: '#FFFFFF', dark: '#8A93A6', menu: '#E9EEF2' },
  };

  var DEFS = [];
  var BY_ID = {};
  var BY_CODE = {};

  // Mini-notatie voor de onderdelen van een blok:
  //   {num:10}  getalvakje met standaardwaarde 10
  //   {text:Hallo!}  tekstvakje
  //   {bool}  zeshoekig vakje voor een voorwaarde
  //   {color:#0000FF}  kleurvakje
  //   {menu:spatiebalk}  vaste keuze (uitklapmenu in Scratch)
  //   {icon:flag}  pictogram (flag, right, left, pen, loop)
  function parseParts(spec) {
    var parts = [];
    var re = /\{(\w+)(?::([^}]*))?\}|([^{}]+)/g, m;
    while ((m = re.exec(spec))) {
      if (m[3]) {
        var t = m[3].trim();
        if (t) parts.push({ t: 'text', text: t });
      } else if (m[1] === 'num' || m[1] === 'text' || m[1] === 'color') {
        parts.push({ t: 'slot', type: m[1], def: m[2] });
      } else if (m[1] === 'bool') {
        parts.push({ t: 'slot', type: 'bool' });
      } else if (m[1] === 'menu') {
        parts.push({ t: 'menu', text: m[2] });
      } else if (m[1] === 'icon') {
        parts.push({ t: 'icon', icon: m[2] });
      }
    }
    return parts;
  }

  function add(def) {
    if (BY_ID[def.id]) throw new Error('Dubbel id ' + def.id);
    if (BY_CODE[def.code]) throw new Error('Dubbele code ' + def.code + ' (' + def.id + ' en ' + BY_CODE[def.code].id + ')');
    def.parts = def.spec ? parseParts(def.spec) : [];
    def.slots = def.parts.filter(function (p) { return p.t === 'slot'; });
    def.label = labelOf(def);
    DEFS.push(def);
    BY_ID[def.id] = def;
    BY_CODE[def.code] = def;
    return def;
  }

  // Leesbare tekst van een blok, bijv. "neem (10) stappen".
  function labelOf(def) {
    if (def.kind === 'value') return def.label || def.value;
    return def.parts.map(function (p) {
      if (p.t === 'text') return p.text;
      if (p.t === 'menu') return '[' + p.text + ' ▾]';
      if (p.t === 'icon') return { flag: 'groene vlag', right: '↻', left: '↺', pen: '', loop: '' }[p.icon];
      if (p.type === 'bool') return '< >';
      if (p.type === 'color') return '(kleur)';
      return '(' + p.def + ')';
    }).filter(Boolean).join(' ').replace(/\s+\?/g, '?');
  }

  function block(id, code, cat, kind, spec, extra) {
    var def = { id: id, code: code, cat: cat, kind: kind, spec: spec };
    for (var k in extra) def[k] = extra[k];
    return add(def);
  }

  // ---- Gebeurtenissen (startblokken) ----
  block('when_flag', 0, 'events', 'hat', 'wanneer op {icon:flag} wordt geklikt',
    { op: 'event_whenflagclicked', event: 'flag', help: 'Start het script als je op de groene vlag klikt.' });
  block('when_key_space', 1, 'events', 'hat', 'wanneer {menu:spatiebalk} is ingedrukt',
    { op: 'event_whenkeypressed', event: 'key', key: 'space', fields: { KEY_OPTION: 'space' }, help: 'Start het script als je op de spatiebalk drukt.' });
  block('when_key_left', 2, 'events', 'hat', 'wanneer {menu:pijltje links} is ingedrukt',
    { op: 'event_whenkeypressed', event: 'key', key: 'left arrow', fields: { KEY_OPTION: 'left arrow' }, help: 'Start het script als je op pijltje links drukt.' });
  block('when_key_right', 3, 'events', 'hat', 'wanneer {menu:pijltje rechts} is ingedrukt',
    { op: 'event_whenkeypressed', event: 'key', key: 'right arrow', fields: { KEY_OPTION: 'right arrow' }, help: 'Start het script als je op pijltje rechts drukt.' });
  block('when_key_up', 4, 'events', 'hat', 'wanneer {menu:pijltje omhoog} is ingedrukt',
    { op: 'event_whenkeypressed', event: 'key', key: 'up arrow', fields: { KEY_OPTION: 'up arrow' }, help: 'Start het script als je op pijltje omhoog drukt.' });
  block('when_key_down', 5, 'events', 'hat', 'wanneer {menu:pijltje omlaag} is ingedrukt',
    { op: 'event_whenkeypressed', event: 'key', key: 'down arrow', fields: { KEY_OPTION: 'down arrow' }, help: 'Start het script als je op pijltje omlaag drukt.' });
  block('when_clicked', 6, 'events', 'hat', 'wanneer op deze sprite wordt geklikt',
    { op: 'event_whenthisspriteclicked', event: 'click', help: 'Start het script als je op Robo klikt.' });

  // ---- Beweging ----
  block('move', 10, 'motion', 'stack', 'neem {num:10} stappen',
    { op: 'motion_movesteps', inputs: ['STEPS'], help: 'Robo loopt vooruit in de richting waarin hij kijkt.' });
  block('turn_right', 11, 'motion', 'stack', 'draai {icon:right} {num:15} graden',
    { op: 'motion_turnright', inputs: ['DEGREES'], help: 'Robo draait met de klok mee.' });
  block('turn_left', 12, 'motion', 'stack', 'draai {icon:left} {num:15} graden',
    { op: 'motion_turnleft', inputs: ['DEGREES'], help: 'Robo draait tegen de klok in.' });
  block('goto_xy', 13, 'motion', 'stack', 'ga naar x: {num:0} y: {num:0}',
    { op: 'motion_gotoxy', inputs: ['X', 'Y'], help: 'Robo springt naar een plek. Het midden van het speelveld is x: 0 y: 0.' });
  block('glide_xy', 14, 'motion', 'stack', 'schuif in {num:1} sec. naar x: {num:0} y: {num:0}',
    { op: 'motion_glidesecstoxy', inputs: ['SECS', 'X', 'Y'], help: 'Robo glijdt rustig naar een plek.' });
  block('point_dir', 15, 'motion', 'stack', 'richt naar {num:90} graden',
    { op: 'motion_pointindirection', inputs: ['DIRECTION'], help: '0 = omhoog, 90 = rechts, 180 = omlaag, -90 = links.' });
  block('change_x', 16, 'motion', 'stack', 'verander x met {num:10}',
    { op: 'motion_changexby', inputs: ['DX'], help: 'Schuif Robo naar rechts (of naar links met een min-getal).' });
  block('set_x', 17, 'motion', 'stack', 'maak x {num:0}',
    { op: 'motion_setx', inputs: ['X'], help: 'Zet Robo op een plek van links naar rechts.' });
  block('change_y', 18, 'motion', 'stack', 'verander y met {num:10}',
    { op: 'motion_changeyby', inputs: ['DY'], help: 'Schuif Robo omhoog (of omlaag met een min-getal).' });
  block('set_y', 19, 'motion', 'stack', 'maak y {num:0}',
    { op: 'motion_sety', inputs: ['Y'], help: 'Zet Robo op een hoogte.' });
  block('bounce', 20, 'motion', 'stack', 'keer om aan de rand',
    { op: 'motion_ifonedgebounce', help: 'Als Robo de rand raakt, draait hij om.' });

  // ---- Uiterlijken ----
  block('say_secs', 30, 'looks', 'stack', 'zeg {text:Hallo!} {num:2} sec.',
    { op: 'looks_sayforsecs', inputs: ['MESSAGE', 'SECS'], help: 'Robo zegt iets in een tekstballon en wacht zo lang.' });
  block('say', 31, 'looks', 'stack', 'zeg {text:Hallo!}',
    { op: 'looks_say', inputs: ['MESSAGE'], help: 'Robo zegt iets en gaat meteen verder.' });
  block('think_secs', 32, 'looks', 'stack', 'denk {text:Hmm...} {num:2} sec.',
    { op: 'looks_thinkforsecs', inputs: ['MESSAGE', 'SECS'], help: 'Robo denkt iets in een wolkje.' });
  block('next_costume', 33, 'looks', 'stack', 'volgend uiterlijk',
    { op: 'looks_nextcostume', help: 'Robo wisselt van houding.' });
  block('change_size', 34, 'looks', 'stack', 'verander grootte met {num:10}',
    { op: 'looks_changesizeby', inputs: ['CHANGE'], help: 'Robo wordt groter (of kleiner met een min-getal).' });
  block('set_size', 35, 'looks', 'stack', 'maak grootte {num:100} %',
    { op: 'looks_setsizeto', inputs: ['SIZE'], help: '100% is de gewone grootte.' });
  block('change_color_effect', 36, 'looks', 'stack', 'verander {menu:kleur} effect met {num:25}',
    { op: 'looks_changeeffectby', inputs: ['CHANGE'], fields: { EFFECT: 'COLOR' }, help: 'Robo krijgt een andere kleur.' });
  block('clear_effects', 37, 'looks', 'stack', 'zet alle effecten uit',
    { op: 'looks_cleargraphiceffects', help: 'Robo krijgt zijn gewone kleur terug.' });
  block('show', 38, 'looks', 'stack', 'verschijn', { op: 'looks_show', help: 'Robo wordt zichtbaar.' });
  block('hide', 39, 'looks', 'stack', 'verdwijn', { op: 'looks_hide', help: 'Robo wordt onzichtbaar.' });

  // ---- Geluid ----
  block('play_sound', 45, 'sound', 'stack', 'start geluid {menu:Piep}',
    { op: 'sound_play', sound: 'Piep', help: 'Speelt een piepje en gaat meteen verder.' });
  block('play_sound_wait', 46, 'sound', 'stack', 'start geluid {menu:Piep} en wacht',
    { op: 'sound_playuntildone', sound: 'Piep', help: 'Speelt een piepje en wacht tot het klaar is.' });

  // ---- Besturen ----
  block('wait', 50, 'control', 'stack', 'wacht {num:1} sec.',
    { op: 'control_wait', inputs: ['DURATION'], help: 'Wacht een aantal seconden.' });
  block('repeat', 51, 'control', 'c', 'herhaal {num:10}',
    { op: 'control_repeat', inputs: ['TIMES'], loop: true, help: 'Doet de blokken binnenin een aantal keer.' });
  block('forever', 52, 'control', 'c', 'herhaal',
    { op: 'control_forever', loop: true, forever: true, help: 'Doet de blokken binnenin steeds opnieuw, tot je op stop drukt. Er kan niets onder.' });
  block('if', 53, 'control', 'c', 'als {bool} dan',
    { op: 'control_if', opElse: 'control_if_else', inputs: ['CONDITION'], help: 'Doet de blokken binnenin alleen als de voorwaarde klopt. Met een anders-stuk kies je tussen twee dingen.' });
  block('repeat_until', 54, 'control', 'c', 'herhaal tot {bool}',
    { op: 'control_repeat_until', inputs: ['CONDITION'], loop: true, help: 'Herhaalt tot de voorwaarde klopt.' });
  block('wait_until', 55, 'control', 'stack', 'wacht tot {bool}',
    { op: 'control_wait_until', inputs: ['CONDITION'], help: 'Wacht tot de voorwaarde klopt.' });
  block('stop_all', 56, 'control', 'cap', 'stop {menu:alle}',
    { op: 'control_stop', fields: { STOP_OPTION: 'all' }, help: 'Stopt alle scripts. Er kan niets onder.' });
  block('else', 62, 'control', 'else', 'anders',
    { help: 'Middenstuk van "als ... dan ... anders". Leg het tussen de blokken voor "wel" en "niet".' });
  block('end', 63, 'control', 'end', 'einde',
    { help: 'Onderkant van een C-blok (herhaal, als). Alles tussen het C-blok en dit einde hoort erbinnen.' });

  // ---- Pen ----
  block('pen_down', 70, 'pen', 'stack', '{icon:pen} pen neer',
    { op: 'pen_penDown', help: 'Vanaf nu tekent Robo een lijn als hij beweegt.' });
  block('pen_up', 71, 'pen', 'stack', '{icon:pen} pen op',
    { op: 'pen_penUp', help: 'Robo stopt met tekenen.' });
  block('pen_clear', 72, 'pen', 'stack', '{icon:pen} wis alles',
    { op: 'pen_clear', help: 'Maakt het speelveld schoon.' });
  block('pen_size', 73, 'pen', 'stack', '{icon:pen} maak pendikte {num:1}',
    { op: 'pen_setPenSizeTo', inputs: ['SIZE'], help: 'Hoe dik de lijn is.' });
  block('pen_color', 74, 'pen', 'stack', '{icon:pen} maak penkleur {color:#0000FF}',
    { op: 'pen_setPenColorToColor', inputs: ['COLOR'], help: 'Kies de kleur van de lijn met een kleurtegel.' });
  block('pen_hue', 75, 'pen', 'stack', '{icon:pen} verander penkleur met {num:10}',
    { op: 'pen_changePenColorParamBy', inputs: ['VALUE'], help: 'Schuift de penkleur op door de regenboog.' });

  // ---- Voorwaarden (zeshoekige tegels) ----
  function cond(id, code, spec, extra) {
    return block(id, code, 'sensing', 'bool', spec, extra);
  }
  cond('touching_edge', 80, 'raak ik {menu:rand}?', { op: 'sensing_touchingobject', menuValue: '_edge_', help: 'Klopt als Robo de rand van het speelveld raakt.' });
  cond('touching_mouse', 81, 'raak ik {menu:muisaanwijzer}?', { op: 'sensing_touchingobject', menuValue: '_mouse_', help: 'Klopt als de muis (of je vinger) Robo raakt.' });
  cond('key_space', 82, 'toets {menu:spatiebalk} ingedrukt?', { op: 'sensing_keypressed', key: 'space', help: 'Klopt zolang je de spatiebalk indrukt.' });
  cond('key_left', 83, 'toets {menu:pijltje links} ingedrukt?', { op: 'sensing_keypressed', key: 'left arrow' });
  cond('key_right', 84, 'toets {menu:pijltje rechts} ingedrukt?', { op: 'sensing_keypressed', key: 'right arrow' });
  cond('key_up', 85, 'toets {menu:pijltje omhoog} ingedrukt?', { op: 'sensing_keypressed', key: 'up arrow' });
  cond('key_down', 86, 'toets {menu:pijltje omlaag} ingedrukt?', { op: 'sensing_keypressed', key: 'down arrow' });
  cond('mouse_down', 87, 'muis ingedrukt?', { op: 'sensing_mousedown', help: 'Klopt zolang je de muisknop indrukt of het scherm aanraakt.' });

  // ---- Waardetegels ----
  function value(id, code, type, val, label) {
    return add({ id: id, code: code, cat: 'values', kind: 'value', type: type, value: val, label: label });
  }
  var NUMBERS = [
    [90, '0'], [91, '1'], [92, '2'], [93, '3'], [94, '4'], [95, '5'], [96, '6'], [97, '7'], [98, '8'], [99, '9'],
    [100, '10'], [101, '12'], [102, '15'], [103, '20'], [104, '25'], [105, '30'], [106, '36'], [107, '40'],
    [108, '45'], [109, '50'], [110, '60'], [111, '72'], [112, '90'], [113, '100'], [114, '120'], [115, '144'],
    [116, '150'], [117, '180'], [118, '200'], [119, '360'], [120, '-10'], [121, '-50'], [122, '-90'],
    [123, '-100'], [124, '0.5'],
  ];
  NUMBERS.forEach(function (n) { value('n_' + n[1].replace('-', 'min').replace('.', '_'), n[0], 'num', n[1]); });
  [[130, 'hallo', 'Hallo!'], [131, 'hmm', 'Hmm...'], [132, 'ja', 'Ja!'], [133, 'nee', 'Nee!'], [134, 'au', 'Au!'], [135, 'klaar', 'Klaar!']]
    .forEach(function (t) { value('t_' + t[1], t[0], 'text', t[2]); });
  [[140, 'rood', '#FF0000'], [141, 'oranje', '#FF8C00'], [142, 'geel', '#FFD700'], [143, 'groen', '#00A650'],
    [144, 'blauw', '#0066FF'], [145, 'paars', '#8A2BE2'], [146, 'roze', '#FF4FA3'], [147, 'zwart', '#000000']]
    .forEach(function (c) { value('c_' + c[1], c[0], 'color', c[2], c[1]); });

  function freeCodes() {
    var out = [];
    for (var i = 0; i < Blok.markers.count; i++) if (!BY_CODE[i]) out.push(i);
    return out;
  }

  Blok.catalog = {
    all: DEFS,
    byId: function (id) { return BY_ID[id] || null; },
    byCode: function (code) { return BY_CODE[code] || null; },
    blocks: function () { return DEFS.filter(function (d) { return d.kind !== 'value' && d.kind !== 'bool'; }); },
    conditions: function () { return DEFS.filter(function (d) { return d.kind === 'bool'; }); },
    values: function (type) { return DEFS.filter(function (d) { return d.kind === 'value' && (!type || d.type === type); }); },
    isTile: function (def) { return def.kind === 'value' || def.kind === 'bool'; },
    labelOf: labelOf,
  };
  Blok.freeCodes = freeCodes;
})(globalThis.Blok = globalThis.Blok || {});
