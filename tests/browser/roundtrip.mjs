// Echte beeldtest in Chromium: opstelling tekenen -> nep-foto (gedraaid, onscherp, ruis)
// -> codevierkantjes zoeken -> scripts opbouwen -> vergelijken met het origineel.
//
// Gebruik: npm run test:browser   (vraagt playwright-core; Chromium via CHROMIUM_PATH of /opt/pw-browsers)
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pagina-fout:', e.message));
await page.goto('file://' + path.join(here, 'harness.html'));

const distortions = [
  { name: 'recht', pxPerMm: 4 },
  { name: 'gedraaid 12°', pxPerMm: 4, rotate: 12 },
  { name: 'op z\'n kant 95°', pxPerMm: 4, rotate: 95 },
  { name: 'klein (2,2 px/mm)', pxPerMm: 2.2, rotate: -5 },
  { name: 'onscherp + ruis', pxPerMm: 4, rotate: 4, blur: 1.6, noise: 0.25 },
  { name: 'schaduw + scheef', pxPerMm: 4.5, rotate: -8, shade: 0.55, skew: 0.06 },
];

const results = await page.evaluate(async (distortions) => {
  const dump = (scripts) => scripts.map((s) => {
    const out = [];
    const walk = (list, d) => (list || []).forEach((n) => {
      const args = n.args.map((a) => (a == null ? '' : a));
      while (args.length && args[args.length - 1] === '') args.pop();
      out.push('  '.repeat(d) + n.def.id + (args.length ? '(' + args.join(',') + ')' : '') + (n.cond ? '<' + n.cond.def.id + '>' : ''));
      walk(n.body, d + 1);
      if (n.elseBody) { out.push('  '.repeat(d) + 'anders'); walk(n.elseBody, d + 1); }
    });
    if (s.hat) out.push(s.hat.def.id);
    walk(s.body, 0);
    return out.join('\n');
  }).join('\n---\n');
  // In het origineel staan standaardwaarden niet als tegel; vergelijk dus met wat er echt ligt.
  const expected = (scripts) => {
    const strip = (list) => (list || []).forEach((n) => {
      n.args = n.args.map((a, i) => (n.argTiles[i] ? a : undefined));
      strip(n.body); strip(n.elseBody);
    });
    scripts.forEach((s) => strip(s.body));
    return dump(scripts);
  };
  const out = [];
  for (const ex of Blok.samples.EXAMPLES) {
    for (const d of distortions) {
      const scripts = Blok.samples.scriptsOf(ex);
      const want = expected(Blok.samples.scriptsOf(ex));
      const canvas = await Blok.samples.photo(scripts, Object.assign({ dropEnd: ex.dropEnd }, d));
      const t0 = performance.now();
      const markers = Blok.recognize.detectMarkers(canvas);
      const res = Blok.recognize.interpret(markers);
      const built = Blok.structure.build(res.scripts);
      const ms = Math.round(performance.now() - t0);
      const got = dump(built.scripts);
      const expectedCount = Blok.render.arrangement(scripts, { dropLastEnd: ex.dropEnd }).markers.length;
      out.push({ example: ex.id, distortion: d.name, size: canvas.width + 'x' + canvas.height, ms, found: markers.length, expectedCount,
        ok: got === want, got, want, issues: built.issues.map((i) => i.code) });
    }
  }
  return out;
}, distortions);

let failed = 0;
for (const r of results) {
  const markersOk = r.found === r.expectedCount;
  const pass = r.ok && markersOk;
  if (!pass) failed++;
  console.log(`${pass ? 'OK  ' : 'FOUT'} ${r.example.padEnd(15)} ${r.distortion.padEnd(20)} ${r.size.padEnd(10)} ${String(r.ms).padStart(5)} ms  vierkantjes ${r.found}/${r.expectedCount}  meldingen: ${r.issues.join(', ') || '-'}`);
  if (!r.ok) console.log('  verwacht:\n' + r.want.replace(/^/gm, '    ') + '\n  gekregen:\n' + r.got.replace(/^/gm, '    '));
}
await browser.close();
if (failed) {
  console.error(`${failed} van ${results.length} gevallen mislukt`);
  process.exit(1);
}
console.log(`Alle ${results.length} gevallen goed.`);
