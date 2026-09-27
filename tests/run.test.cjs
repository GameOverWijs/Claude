const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const Blok = require('./load.cjs');

const S = (list) => [Blok.program.script(list)];
const codes = (issues) => issues.map((i) => i.code);

test('controle: geen startblok, lege lus, komma, tekst als getal, blokken na herhaal', () => {
  assert.ok(codes(Blok.validate.check(S([['move', '10']]))).includes('geen-start'));
  assert.ok(codes(Blok.validate.check(S(['when_flag', { id: 'repeat', args: ['3'], body: [] }]))).includes('leeg-c'));
  assert.ok(codes(Blok.validate.check(S(['when_flag', ['wait', '0,5']]))).includes('komma'));
  assert.ok(codes(Blok.validate.check(S(['when_flag', ['move', 'tien']]))).includes('geen-getal'));
  const iss = Blok.validate.check(S(['when_flag', { id: 'forever', body: ['bounce'] }, ['move', '10']]));
  assert.ok(codes(iss).includes('na-einde'));
  assert.equal(Blok.validate.verdict(iss).level, 'fout');
});

test('controle: tip om herhaal te gebruiken', () => {
  const list = ['when_flag'];
  for (let i = 0; i < 4; i++) list.push(['move', '50'], ['turn_right', '90']);
  const tip = Blok.validate.check(S(list)).find((i) => i.code === 'gebruik-herhaal');
  assert.ok(tip);
  assert.match(tip.msg, /4 keer/);
});

test('uitvoerder: vierkant tekenen komt terug op het beginpunt', () => {
  const rt = new Blok.Runtime(S(['when_flag', 'pen_down', { id: 'repeat', args: ['4'], body: [['move', '100'], ['turn_right', '90']] }]));
  const res = rt.runHeadless(5);
  assert.ok(res.finished);
  const lines = res.penLines.filter((l) => !l.dot);
  assert.equal(lines.length, 4);
  assert.ok(Math.abs(res.sprite.x) < 1e-6 && Math.abs(res.sprite.y) < 1e-6);
  assert.equal(res.sprite.dir, 90);
});

test('uitvoerder: wacht en zeg nemen echte (virtuele) tijd', () => {
  const rt = new Blok.Runtime(S(['when_flag', ['say_secs', 'Hallo!', '2'], ['wait', '1']]));
  const res = rt.runHeadless(10);
  assert.ok(res.finished);
  assert.ok(res.time >= 3 && res.time < 3.2, 'tijd ' + res.time);
  assert.equal(res.log.says[0].text, 'Hallo!');
});

test('uitvoerder: herhaal-lus stopt nooit, stop alle wel', () => {
  const rt = new Blok.Runtime(S(['when_flag', { id: 'forever', body: [['move', '10'], 'bounce'] }]));
  const res = rt.runHeadless(3);
  assert.ok(!res.finished);
  const rt2 = new Blok.Runtime(S(['when_flag', ['move', '10'], 'stop_all']));
  assert.ok(rt2.runHeadless(3).finished);
});

test('uitvoerder: keer om aan de rand draait Robo om', () => {
  const rt = new Blok.Runtime(S(['when_flag', { id: 'forever', body: [['move', '10'], 'bounce'] }]));
  const res = rt.runHeadless(4);
  const xs = res.log.positions.map((p) => p.x);
  assert.ok(Math.max(...xs) > 200 && Math.min(...xs) < -200);
});

test('uitvoerder: toetsen en voorwaarden', () => {
  const scripts = S(['when_key_space', { id: 'if', cond: 'key_space', body: [['change_x', '25']] }]);
  const rt = new Blok.Runtime(scripts);
  rt.keyDown('space');
  for (let i = 0; i < 5; i++) rt.step();
  assert.equal(rt.sprite.x, 25);
});

test('opdrachten: alle voorbeeldoplossingen slagen', () => {
  Blok.assignments.LIST.filter((a) => a.solution).forEach((a) => {
    const ev = Blok.assignments.evaluate(a, a.solution.map((l) => Blok.program.script(l)));
    assert.ok(ev.outcome.ok, a.id + ': ' + ev.outcome.msg);
  });
});

test('opdrachten: foute oplossingen geven een bruikbare uitleg', () => {
  const sq = Blok.assignments.byId('vierkant');
  const wrongAngle = Blok.assignments.evaluate(sq, S(['when_flag', 'pen_down', { id: 'repeat', args: ['4'], body: [['move', '100'], ['turn_right', '60']] }]));
  assert.ok(!wrongAngle.outcome.ok);
  assert.match(wrongAngle.outcome.msg, /60 graden.*90 graden/);
  const noPen = Blok.assignments.evaluate(sq, S(['when_flag', { id: 'repeat', args: ['4'], body: [['move', '100'], ['turn_right', '90']] }]));
  assert.match(noPen.outcome.msg, /pen neer/);
  const tooFew = Blok.assignments.evaluate(sq, S(['when_flag', 'pen_down', { id: 'repeat', args: ['3'], body: [['move', '100'], ['turn_right', '90']] }]));
  assert.match(tooFew.outcome.msg, /3 zijden/);
});

test('AI-antwoord wordt omgezet naar dezelfde tokens als de codevierkantjes', () => {
  const data = {
    scripts: [{ blocks: [
      { block: 'when_flag', inputs: [], condition: 'none', unsure: false },
      { block: 'pen_color', inputs: ['rood'], condition: 'none', unsure: false },
      { block: 'if', inputs: [], condition: 'touching_edge', unsure: false },
      { block: 'say_secs', inputs: ['Au!', '2'], condition: 'none', unsure: true },
      { block: 'end', inputs: [], condition: 'none', unsure: false },
    ] }],
    unrecognized: ['een blok met "maak een kloon"'],
    notes: '',
  };
  const conv = Blok.ai.toTokenScripts(data);
  const built = Blok.structure.build(conv.scripts);
  const s = built.scripts[0];
  assert.equal(s.hat.def.id, 'when_flag');
  assert.equal(s.body[0].args[0], '#FF0000');
  assert.equal(s.body[1].cond.def.id, 'touching_edge');
  assert.deepEqual(s.body[1].body[0].args, ['Au!', '2']);
  assert.ok(conv.notes.some((n) => n.code === 'ai-onbekend'));
  assert.ok(conv.notes.some((n) => n.code === 'ai-onzeker'));
});

test('AI-schema: alle velden verplicht en geen extra velden (structured outputs)', () => {
  const check = (s) => {
    if (s.type === 'object') {
      assert.equal(s.additionalProperties, false);
      assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort());
      Object.values(s.properties).forEach(check);
    }
    if (s.type === 'array') check(s.items);
  };
  check(Blok.ai.schema());
});

test('ZIP: CRC en opbouw kloppen', () => {
  const data = new TextEncoder().encode('Blokkenscanner 123');
  assert.equal(Blok.crc32(data), zlib.crc32(Buffer.from(data)));
  const z = Blok.zip([{ name: 'a.txt', data: 'hallo' }, { name: 'map/b.svg', data: '<svg/>' }]);
  const buf = Buffer.from(z);
  assert.equal(buf.readUInt32LE(0), 0x04034b50);
  assert.equal(buf.readUInt32LE(buf.length - 22), 0x06054b50);
  assert.equal(buf.readUInt16LE(buf.length - 22 + 10), 2);
});

test('.sb3: project.json verwijst naar bestaande assets en klopt als boom', () => {
  const scripts = S(['when_flag', 'pen_down', ['pen_color', '#FF0000'], { id: 'if', cond: 'touching_edge', body: [['say', 'Au!']], else: [['pen_hue', '10']] }, 'play_sound', 'stop_all']);
  const buf = Buffer.from(Blok.sb3.build(scripts));
  // bestanden uit de (ongecomprimeerde) zip halen
  const files = {};
  let p = 0;
  while (buf.readUInt32LE(p) === 0x04034b50) {
    const size = buf.readUInt32LE(p + 18), nlen = buf.readUInt16LE(p + 26);
    const name = buf.slice(p + 30, p + 30 + nlen).toString();
    files[name] = buf.slice(p + 30 + nlen, p + 30 + nlen + size);
    p += 30 + nlen + size;
  }
  const project = JSON.parse(files['project.json']);
  const sprite = project.targets[1];
  [...sprite.costumes, ...sprite.sounds, ...project.targets[0].costumes].forEach((a) => {
    assert.ok(files[a.md5ext], 'ontbreekt: ' + a.md5ext);
    assert.equal(Blok.sb3.md5(new Uint8Array(files[a.md5ext])), a.assetId);
  });
  const blocks = sprite.blocks;
  Object.entries(blocks).forEach(([id, b]) => {
    if (b.next) assert.equal(blocks[b.next].parent, id);
    if (b.parent) assert.ok(blocks[b.parent], 'ouder bestaat niet voor ' + id);
    Object.values(b.inputs).forEach((inp) => { if (typeof inp[1] === 'string') assert.equal(blocks[inp[1]].parent, id); });
  });
  assert.equal(Object.values(blocks).filter((b) => b.topLevel).length, 1);
  assert.ok(project.extensions.includes('pen'));
  assert.ok(Object.values(blocks).some((b) => b.opcode === 'control_if_else'));
});
