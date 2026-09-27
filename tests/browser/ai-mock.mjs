// Test van de AI-modus zonder echte API: de Anthropic-server wordt nagebootst.
// Controleert het verzoek (model, structured output, fallback-header) en de verwerking.
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

let request = null;
const answer = {
  scripts: [{ blocks: [
    { block: 'when_flag', inputs: [], condition: 'none', unsure: false },
    { block: 'pen_down', inputs: [], condition: 'none', unsure: false },
    { block: 'repeat', inputs: ['4'], condition: 'none', unsure: false },
    { block: 'move', inputs: ['100'], condition: 'none', unsure: false },
    { block: 'turn_right', inputs: ['90'], condition: 'none', unsure: false },
  ] }],
  unrecognized: [],
  notes: 'Het getal bij herhaal is een beetje vaag.',
};
await page.route('https://api.anthropic.com/**', async (route) => {
  const r = route.request();
  if (r.method() === 'OPTIONS') {
    return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' } });
  }
  request = { url: r.url(), headers: r.headers(), body: JSON.parse(r.postData()) };
  await route.fulfill({
    status: 200,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    body: JSON.stringify({
      id: 'msg_test', type: 'message', role: 'assistant', model: request.body.model, stop_reason: 'end_turn', stop_sequence: null,
      content: [{ type: 'text', text: JSON.stringify(answer) }],
      usage: { input_tokens: 3400, output_tokens: 900 },
    }),
  });
});

await page.addInitScript(() => {
  localStorage.setItem('blokkenscanner.consent', 'true');
  sessionStorage.setItem('blokkenscanner.apiKey', JSON.stringify('sk-ant-test'));
});
await page.goto('file://' + path.join(here, '..', '..', 'index.html'));
await page.selectOption('#sample-select', 'vierkant');
await page.waitForFunction(() => /gevonden/.test(document.querySelector('#status').textContent), null, { timeout: 20000 });
await page.click('#mode-ai');
await page.click('#status button');
await page.waitForFunction(() => /Gelezen door/.test(document.querySelector('#status').textContent), null, { timeout: 20000 });

const status = await page.textContent('#status');
const verdict = await page.textContent('#verdict-title');
const issues = await page.$$eval('#issues .issue p', (ps) => ps.map((p) => p.textContent));
await browser.close();

const fail = [];
const b = request && request.body;
if (!b) fail.push('geen verzoek ontvangen');
else {
  if (b.model !== 'claude-opus-5') fail.push('model ' + b.model);
  if (b.fallbacks !== 'default') fail.push('fallbacks ontbreekt');
  if (!/server-side-fallback-2026-07-01/.test(request.headers['anthropic-beta'] || '')) fail.push('beta-header ontbreekt: ' + request.headers['anthropic-beta']);
  if (request.headers['x-api-key'] !== 'sk-ant-test') fail.push('api-sleutel niet meegestuurd');
  if (!b.output_config || b.output_config.format.type !== 'json_schema') fail.push('geen structured output');
  if (b.messages[0].content[0].type !== 'image' || b.messages[0].content[0].source.media_type !== 'image/jpeg') fail.push('geen foto meegestuurd');
  if ('betas' in b) fail.push('betas hoort in de header, niet in de body');
}
if (!/Gelezen door claude-opus-5/.test(status)) fail.push('status: ' + status);
if (!/werkt nog niet/.test(verdict)) fail.push('oordeel (verwacht: werkt nog niet, einde ontbreekt): ' + verdict);
if (!issues.some((t) => /einde-stuk/.test(t))) fail.push('verwacht melding over ontbrekend einde, kreeg: ' + issues.join(' | '));
if (errors.length) fail.push('paginafouten: ' + errors.join('; '));

console.log('status:', status);
console.log('oordeel:', verdict);
console.log('meldingen:', issues.join(' | '));
if (fail.length) { console.error('MISLUKT:\n- ' + fail.join('\n- ')); process.exit(1); }
console.log('AI-modus: verzoek en verwerking kloppen.');
