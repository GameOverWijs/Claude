// Programma-objecten: knopen (blokken met waarden) en een korte schrijfwijze voor voorbeelden,
// opdrachten en tests.
//
// Knoop: { uid, def, args: [tekst per vakje], argTiles: [tegel-def per vakje], cond: knoop | null,
//          body: [knopen] (C-blok), elseBody: [knopen] | null }
// Script: { hat: knoop | null, body: [knopen] }
(function (Blok) {
  'use strict';

  var counter = 0;
  function uid(prefix) {
    counter += 1;
    return (prefix || 'b') + counter;
  }

  function node(def, extra) {
    var nd = { uid: uid(), def: def, args: [], argTiles: [], cond: null };
    if (def.kind === 'c') nd.body = [];
    if (extra) for (var k in extra) nd[k] = extra[k];
    return nd;
  }

  // Zoek de tegel die bij een waarde hoort (voor proef-foto's).
  function tileFor(slotType, value) {
    var v = String(value);
    var list = Blok.catalog.values();
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      if (slotType === 'color' && d.type === 'color' && d.value.toLowerCase() === v.toLowerCase()) return d;
      if (slotType !== 'color' && d.type !== 'color' && d.value === v) return d;
    }
    return null;
  }

  // Schrijfwijze: 'move' | ['move', '100'] | {id: 'if', cond: 'touching_edge', body: [...], else: [...]}
  function fromSpec(item) {
    var spec = typeof item === 'string' ? { id: item } : Array.isArray(item) ? { id: item[0], args: item.slice(1) } : item;
    var def = Blok.catalog.byId(spec.id);
    if (!def) throw new Error('Onbekend blok: ' + spec.id);
    var nd = node(def);
    (spec.args || []).forEach(function (a, i) {
      nd.args[i] = String(a);
      var slot = def.slots[i];
      if (slot && slot.type !== 'bool') {
        var t = tileFor(slot.type, a);
        if (t && String(a) !== slot.def) nd.argTiles[i] = t;
      }
    });
    if (spec.cond) nd.cond = node(Blok.catalog.byId(spec.cond));
    if (def.kind === 'c') nd.body = (spec.body || []).map(fromSpec);
    if (spec.else) nd.elseBody = spec.else.map(fromSpec);
    return nd;
  }

  // Een script uit een lijst; het eerste item mag een startblok zijn.
  function script(list) {
    var nodes = list.map(fromSpec);
    var s = { hat: null, body: nodes };
    if (nodes.length && nodes[0].def.kind === 'hat') s.hat = nodes.shift();
    return s;
  }

  // Waarde van vakje i, of de standaardwaarde als er niets ligt.
  function argValue(nd, i) {
    var a = nd.args && nd.args[i];
    var slot = nd.def.slots[i];
    return a == null || a === '' ? (slot && slot.def != null ? slot.def : '') : a;
  }

  // Alle knopen in een lijst (diep), in volgorde.
  function walk(list, fn, depth, parent) {
    (list || []).forEach(function (nd) {
      fn(nd, depth || 0, parent || null);
      if (nd.body) walk(nd.body, fn, (depth || 0) + 1, nd);
      if (nd.elseBody) walk(nd.elseBody, fn, (depth || 0) + 1, nd);
    });
  }

  function walkScript(s, fn) {
    if (s.hat) fn(s.hat, 0, null);
    walk(s.body, fn, 0, null);
  }

  var COLOR_NAMES = { '#FF0000': 'rood', '#FF8C00': 'oranje', '#FFD700': 'geel', '#00A650': 'groen', '#0066FF': 'blauw', '#8A2BE2': 'paars', '#FF4FA3': 'roze', '#000000': 'zwart', '#0000FF': 'blauw' };

  // Tekst van een blok met de waarden die er echt in liggen, bijv. "neem (100) stappen".
  function label(nd) {
    var i = 0;
    return nd.def.parts.map(function (p) {
      if (p.t === 'text') return p.text;
      if (p.t === 'menu') return '[' + p.text + ']';
      if (p.t === 'icon') return { flag: 'groene vlag', right: '↻', left: '↺' }[p.icon] || '';
      var k = i++;
      if (p.type === 'bool') return nd.cond ? '<' + Blok.catalog.labelOf(nd.cond.def).replace(/ ▾\]/g, ']') + '>' : '< >';
      var v = argValue(nd, k);
      if (p.type === 'color') return '(' + (COLOR_NAMES[String(v).toUpperCase()] || v) + ')';
      return '(' + v + ')';
    }).filter(Boolean).join(' ').replace(/\s+\?/g, '?');
  }

  Blok.program = { uid: uid, label: label, node: node, fromSpec: fromSpec, script: script, argValue: argValue, walk: walk, walkScript: walkScript, tileFor: tileFor };
})(globalThis.Blok = globalThis.Blok || {});
