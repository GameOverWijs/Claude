const test = require('node:test');
const assert = require('node:assert/strict');
const Blok = require('./load.cjs');

const STYLES = ['kleur', 'kleurplaat', '3d-vorm', '3d-tekst', '3d-marker'];

function wellFormed(svg) {
  // eenvoudige controle: elke geopende tag wordt gesloten
  const stack = [];
  const re = /<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g;
  let m;
  while ((m = re.exec(svg))) {
    if (m[3] === '/') continue;
    if (m[1] === '/') { const top = stack.pop(); if (top !== m[2]) return false; } else stack.push(m[2]);
  }
  return stack.length === 0;
}

test('elk stuk tekent in elke stijl zonder fouten', () => {
  for (const d of Blok.catalog.all) {
    for (const st of STYLES) {
      const svg = Blok.render.pieceSvg(d, st);
      assert.ok(!/NaN|undefined|Infinity/.test(svg), d.id + ' ' + st);
      assert.ok(wellFormed(svg), 'geen geldige SVG: ' + d.id + ' ' + st);
      assert.match(svg, /width="[\d.]+mm" height="[\d.]+mm"/);
    }
  }
});

test('3D-lagen van een stuk zijn precies even groot (passen op elkaar)', () => {
  for (const d of Blok.catalog.all) {
    const sizes = ['3d-vorm', '3d-tekst', '3d-marker'].map((st) => Blok.render.pieceSvg(d, st).match(/viewBox="([^"]+)"/)[1]);
    assert.equal(new Set(sizes).size, 1, d.id);
  }
});

test('alle stukken passen op A4, eventueel gedraaid', () => {
  const pages = Blok.sheets.printSheets('alles', 'kleur');
  assert.ok(pages.length >= 1);
  pages.forEach((p) => assert.ok(wellFormed(p.svg)));
  const placed = Blok.sheets.pack(Blok.sheets.setItems('alles')).flat();
  assert.equal(placed.length, Blok.catalog.all.length);
  // geen overlap binnen een vel
  for (const key of ['alles', 'klassenset']) {
    Blok.sheets.pack(Blok.sheets.setItems(key)).forEach((page) => {
      const boxes = page.map((p) => { const s = Blok.render.pieceSize(p.def); return { x: p.x, y: p.y, w: p.rot ? s.h : s.w, h: p.rot ? s.w : s.h, id: p.def.id }; });
      boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => {
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        assert.ok(!overlap, a.id + ' overlapt ' + b.id);
      }));
    });
  }
  placed.forEach((p) => {
    const s = Blok.render.pieceSize(p.def);
    const w = p.rot ? s.h : s.w, h = p.rot ? s.w : s.h;
    assert.ok(p.x >= 10 && p.x + w <= 200.5, p.def.id + ' past niet in de breedte');
    assert.ok(p.y >= 10 && p.y + h <= 287, p.def.id + ' past niet in de hoogte');
  });
});

test('klassenset en stickervel', () => {
  assert.ok(Blok.sheets.setItems('klassenset').length > 60);
  const stickers = Blok.sheets.stickerSheets();
  assert.ok(stickers.length >= 2);
  assert.ok(!/NaN/.test(stickers[0].svg));
});

test('script-weergave tekent C-blokken, anders en voorwaarden', () => {
  const s = Blok.program.script(['when_flag', { id: 'if', cond: 'touching_edge', body: [['say', 'Au!']], else: [['move', '10']] }, { id: 'forever', body: ['bounce'] }]);
  const svg = Blok.render.programSvg([s]);
  assert.ok(wellFormed(svg));
  assert.ok(!/NaN|undefined/.test(svg));
  assert.equal((svg.match(/data-uid=/g) || []).length, 7); // 6 blokken + 1 voorwaarde
});

test('tekst wordt als paden gezet (werkt in Tinkercad en zonder lettertype)', () => {
  const svg = Blok.render.pieceSvg(Blok.catalog.byId('move'), 'kleur');
  assert.ok(!/<text/.test(svg));
  assert.ok(Blok.font.width('neem', 7) > 10);
});
