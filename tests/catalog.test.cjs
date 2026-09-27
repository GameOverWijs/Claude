const test = require('node:test');
const assert = require('node:assert/strict');
const Blok = require('./load.cjs');

const rot = (b, N) => { const r = []; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) r[i * N + j] = b[(N - j - 1) * N + i]; return r; };
const ham = (a, b) => a.reduce((s, v, i) => s + (v !== b[i]), 0);

test('elk blok en elke tegel heeft een uniek codenummer binnen het woordenboek', () => {
  const codes = Blok.catalog.all.map((d) => d.code);
  assert.equal(new Set(codes).size, codes.length);
  codes.forEach((c) => assert.ok(c >= 0 && c < Blok.markers.count, 'code ' + c));
});

test('codenummers liggen vast (geprinte blokken blijven werken)', () => {
  const fixed = { when_flag: 0, move: 10, turn_right: 11, repeat: 51, forever: 52, if: 53, else: 62, end: 63, pen_down: 70, touching_edge: 80, n_10: 100, n_90: 112, t_hallo: 130, c_rood: 140 };
  for (const [id, code] of Object.entries(fixed)) assert.equal(Blok.catalog.byId(id).code, code, id);
});

test('codevierkantjes verschillen onderling in minstens 7 vakjes, ook gedraaid', () => {
  const N = Blok.markers.BITS;
  const all = Blok.markers.CODES.map((_, i) => Blok.markers.bits(i).flat());
  const rots = (b) => { const out = [b]; for (let k = 0; k < 3; k++) out.push(rot(out[out.length - 1], N)); return out; };
  let min = 99, self = 99;
  all.forEach((a, i) => {
    const ra = rots(a);
    self = Math.min(self, ham(a, ra[1]), ham(a, ra[2]), ham(a, ra[3]));
    for (let j = i + 1; j < all.length; j++) min = Math.min(min, ...rots(all[j]).map((r) => ham(a, r)));
  });
  assert.ok(min >= 7, 'kleinste afstand ' + min);
  assert.ok(self >= 7, 'kleinste afstand met zichzelf gedraaid ' + self);
});

test('blokteksten volgen de Nederlandse Scratch-vertaling', () => {
  assert.equal(Blok.catalog.byId('move').label, 'neem (10) stappen');
  assert.equal(Blok.catalog.byId('when_key_space').label, 'wanneer [spatiebalk ▾] is ingedrukt');
  assert.equal(Blok.catalog.byId('touching_edge').label, 'raak ik [rand ▾]?');
  assert.equal(Blok.catalog.byId('pen_down').label, 'pen neer');
});

test('elk blok heeft een Scratch-opcode (voor de .sb3-export), behalve anders en einde', () => {
  Blok.catalog.all.filter((d) => d.kind !== 'value' && d.id !== 'else' && d.id !== 'end').forEach((d) => assert.ok(d.op, d.id));
});
