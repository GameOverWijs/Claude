const test = require('node:test');
const assert = require('node:assert/strict');
const Blok = require('./load.cjs');

// Beschrijving van een script om te vergelijken.
function dump(scripts) {
  const out = [];
  const walk = (list, d) => (list || []).forEach((n) => {
    const args = n.args.map((a) => (a == null ? '' : a));
    while (args.length && args[args.length - 1] === '') args.pop();
    out.push('  '.repeat(d) + n.def.id + (args.length ? '(' + args.join(',') + ')' : '') + (n.cond ? '<' + n.cond.def.id + '>' : ''));
    walk(n.body, d + 1);
    if (n.elseBody) { out.push('  '.repeat(d) + 'anders'); walk(n.elseBody, d + 1); }
  });
  scripts.forEach((s, i) => { if (i) out.push('---'); if (s.hat) out.push(s.hat.def.id); walk(s.body, 0); });
  return out.join('\n');
}
// Wat er op tafel ligt: waarden zonder tegel zijn de standaardwaarde en tellen niet mee.
function onTable(scripts) {
  const strip = (list) => (list || []).forEach((n) => { n.args = n.args.map((a, i) => (n.argTiles[i] ? a : undefined)); strip(n.body); strip(n.elseBody); });
  scripts.forEach((s) => strip(s.body));
  return dump(scripts);
}
// Foto nabootsen: draaien, schalen, verschuiven en een beetje perspectief.
function photo(markers, { angle = 0, scale = 4, persp = 0 } = {}) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return markers.map((m) => ({ id: m.id, corners: m.corners.map((p) => {
    const k = 1 + persp * p.y; // verder weg = kleiner
    const x = p.x * k, y = p.y * k;
    return { x: (x * c - y * s) * scale + 500, y: (x * s + y * c) * scale + 300 };
  }) }));
}
function scan(scripts, view, opts) {
  const arr = Blok.render.arrangement(scripts, opts);
  const rec = Blok.recognize.interpret(photo(arr.markers, view));
  return { rec, built: Blok.structure.build(rec.scripts) };
}

const VIEWS = [{}, { angle: 0.4 }, { angle: Math.PI / 2 }, { angle: Math.PI, scale: 2.5 }, { angle: -0.2, persp: 0.0012 }];

test('alle voorbeeldoplossingen komen goed terug, ook gedraaid en schuin', () => {
  const lists = Blok.assignments.LIST.filter((a) => a.solution).map((a) => a.solution).concat(Blok.samples ? [] : []);
  for (const sol of lists) {
    for (const v of VIEWS) {
      const want = onTable(sol.map((l) => Blok.program.script(l)));
      const { built } = scan(sol.map((l) => Blok.program.script(l)), v);
      assert.equal(dump(built.scripts), want, JSON.stringify(v));
      assert.deepEqual(built.issues.filter((i) => i.level !== 'tip').map((i) => i.code), []);
    }
  }
});

test('twee scripts naast elkaar, met tegels, voorwaarden en anders', () => {
  const make = () => [
    Blok.program.script(['when_flag', ['point_dir', '90'], { id: 'if', cond: 'touching_edge', body: [['say', 'Au!']], else: [['move', '50'], ['pen_color', '#FF0000']] }]),
    Blok.program.script(['when_key_space', { id: 'repeat_until', cond: 'key_space', body: [['change_y', '-10']] }]),
  ];
  for (const v of VIEWS) {
    const { built } = scan(make(), v);
    assert.equal(dump(built.scripts), onTable(make()), JSON.stringify(v));
  }
});

test('vergeten einde-stuk: fout gemeld en plek geraden via inspringen', () => {
  const make = () => [Blok.program.script(['when_flag', 'pen_down', { id: 'repeat', args: ['4'], body: [['move', '100'], ['turn_right', '90']] }, 'pen_up', ['say', 'Klaar!']])];
  const { built } = scan(make(), { angle: 0.3 }, { dropLastEnd: true });
  assert.equal(dump(built.scripts), onTable(make()));
  const e = built.issues.find((i) => i.code === 'geen-einde');
  assert.ok(e && e.level === 'fout');
  assert.match(e.msg, /draai ↻ \(90\) graden/);
});

test('losse tegel, onbekend vierkantje en los einde worden gemeld', () => {
  const scripts = [Blok.program.script(['when_flag', ['move', '100']])];
  const arr = Blok.render.arrangement(scripts);
  const extra = JSON.parse(JSON.stringify(arr.markers));
  const shift = (m, dx, dy, id) => ({ id: id == null ? m.id : id, corners: m.corners.map((p) => ({ x: p.x + dx, y: p.y + dy })) });
  extra.push(shift(arr.markers[0], 300, 0, Blok.catalog.byId('n_45').code)); // losse tegel ver weg
  extra.push(shift(arr.markers[0], 0, 400, 190)); // code zonder blok
  extra.push(shift(arr.markers[1], 0, 30, Blok.catalog.byId('end').code)); // einde zonder C-blok
  const rec = Blok.recognize.interpret(photo(extra));
  const built = Blok.structure.build(rec.scripts);
  const codes = rec.notes.map((n) => n.code).concat(built.issues.map((i) => i.code));
  assert.ok(codes.includes('losse-tegel'));
  assert.ok(codes.includes('onbekend-vierkantje'));
  assert.ok(codes.includes('los-einde'));
});

test('startblok midden in een rij begint een nieuw script', () => {
  const tokens = ['when_flag', 'move', 'when_key_space', 'bounce'].map((id) => ({ def: Blok.catalog.byId(id), args: [] }));
  const built = Blok.structure.build([{ tokens }]);
  assert.equal(built.scripts.length, 2);
  assert.ok(built.issues.some((i) => i.code === 'startblok-midden'));
});

test('anders zonder als is een fout', () => {
  const tokens = ['when_flag', 'repeat', 'move', 'else', 'bounce', 'end'].map((id) => ({ def: Blok.catalog.byId(id), args: [] }));
  const built = Blok.structure.build([{ tokens }]);
  assert.ok(built.issues.some((i) => i.code === 'los-anders' && i.level === 'fout'));
});

test('een blok dat op z\'n kop ligt wordt toch herkend, met een tip', () => {
  const scripts = [Blok.program.script(['when_flag', ['move', '100'], 'bounce'])];
  const arr = Blok.render.arrangement(scripts);
  const m = arr.markers.find((x) => x.id === Blok.catalog.byId('bounce').code);
  const c = m.corners.reduce((a, p) => ({ x: a.x + p.x / 4, y: a.y + p.y / 4 }), { x: 0, y: 0 });
  // 180 graden draaien rond het midden: hoekpunten wisselen van plek
  m.corners = m.corners.map((p) => ({ x: 2 * c.x - p.x, y: 2 * c.y - p.y }));
  const rec = Blok.recognize.interpret(photo(arr.markers, { angle: 0.2 }));
  const built = Blok.structure.build(rec.scripts);
  assert.equal(dump(built.scripts), 'when_flag\nmove(100)\nbounce');
  assert.ok(built.issues.some((i) => i.code === 'gedraaid'));
});
