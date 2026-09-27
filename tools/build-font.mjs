// Zet het (gesubsette) Nunito ExtraBold-lettertype om naar js/font-data.js:
// per teken de omtrek als SVG-pad plus de voorloopbreedte, en de kerning-paren.
// Zo kan de app tekst als paden in SVG's zetten (nodig voor Tinkercad, lasersnijders
// en printers zonder dit lettertype) zonder een lettertypebibliotheek mee te laden.
//
// Gebruik: npm run build:font
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const buf = fs.readFileSync(path.join(root, 'fonts/Nunito-ExtraBold-subset.ttf'));
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const chars = [];
for (let c = 0x20; c <= 0x7e; c++) chars.push(String.fromCharCode(c));
for (let c = 0xa0; c <= 0xff; c++) chars.push(String.fromCharCode(c));
chars.push('‘', '’', '“', '”', '…', '–', '—', '•', '€');

// Eigen serialisatie: toPathData(0) van opentype.js plakt soms getallen aan elkaar ("2550").
function pathData(cmds) {
  const nums = (vals) => vals.map((v) => String(Math.round(v) + 0))
    .map((s, i) => (i && s[0] !== '-' ? ' ' : '') + s).join('');
  return cmds.map((c) => {
    if (c.type === 'Z') return 'Z';
    if (c.type === 'M' || c.type === 'L') return c.type + nums([c.x, c.y]);
    if (c.type === 'Q') return 'Q' + nums([c.x1, c.y1, c.x, c.y]);
    if (c.type === 'C') return 'C' + nums([c.x1, c.y1, c.x2, c.y2, c.x, c.y]);
    throw new Error('onbekend padcommando ' + c.type);
  }).join('');
}

const glyphs = {};
for (const ch of chars) {
  const g = font.charToGlyph(ch);
  if (!g || (g.index === 0 && ch !== ' ')) continue;
  // Pad in lettertype-eenheden met y omlaag (SVG-richting), oorsprong op de basislijn.
  const p = g.getPath(0, 0, font.unitsPerEm);
  glyphs[ch] = { w: g.advanceWidth, d: pathData(p.commands) };
}

// Kerning alleen voor ASCII plus de Nederlandse accenttekens; kleine correcties vallen weg.
const kernChars = chars.filter((c) => c.charCodeAt(0) < 0x7f || 'éëèïöüáó'.includes(c));
const kern = {};
for (const a of kernChars) {
  if (!glyphs[a]) continue;
  for (const b of kernChars) {
    if (!glyphs[b]) continue;
    const k = font.getKerningValue(font.charToGlyph(a), font.charToGlyph(b));
    if (Math.abs(k) >= 10) kern[a + b] = k;
  }
}

const data = {
  family: 'Nunito ExtraBold',
  unitsPerEm: font.unitsPerEm,
  ascender: font.ascender,
  descender: font.descender,
  capHeight: font.tables.os2 ? font.tables.os2.sCapHeight : Math.round(font.unitsPerEm * 0.7),
  xHeight: font.tables.os2 ? font.tables.os2.sxHeight : Math.round(font.unitsPerEm * 0.5),
  glyphs,
  kern,
};

const out =
  '// GEGENEREERD door tools/build-font.mjs - niet met de hand aanpassen.\n' +
  '// Lettertype: Nunito ExtraBold, (c) The Nunito Project Authors, SIL Open Font License 1.1 (zie fonts/OFL.txt).\n' +
  '(function (Blok) {\n  Blok.FONT_DATA = ' + JSON.stringify(data) + ';\n' +
  '})(globalThis.Blok = globalThis.Blok || {});\n';
fs.writeFileSync(path.join(root, 'js/font-data.js'), out);
console.log('glyphs', Object.keys(glyphs).length, 'kern pairs', Object.keys(kern).length, 'bytes', out.length);
