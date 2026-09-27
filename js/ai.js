// AI-modus: vrij getekende blokken laten lezen door Claude (Anthropic API).
//
// De foto gaat naar Anthropic. Doe dit alleen met toestemming van de school (AVG) en zonder
// gezichten of namen in beeld. De API-sleutel is van de docent en blijft in deze browser.
//
// Claude schrijft alleen over wat er getekend is (ook fouten). Het controleren doet deze app
// zelf, met dezelfde regels als bij de codevierkantjes.
(function (Blok) {
  'use strict';

  var MODELS = [
    { id: 'claude-opus-5', name: 'Claude Opus 5 (standaard, leest het best)' },
    { id: 'claude-sonnet-5', name: 'Claude Sonnet 5 (sneller, goedkoper)' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5 (snelst, minder nauwkeurig)' },
  ];
  var DEFAULT_MODEL = 'claude-opus-5';

  var COLOR_NAMES = {
    rood: '#FF0000', oranje: '#FF8C00', geel: '#FFD700', groen: '#00A650', blauw: '#0066FF',
    paars: '#8A2BE2', roze: '#FF4FA3', zwart: '#000000', wit: '#FFFFFF', bruin: '#8B4513', grijs: '#808080',
    lichtblauw: '#5CB1D6', donkerblauw: '#00008B', lichtgroen: '#7CD17C', donkergroen: '#006400',
  };

  function blockList() {
    var C = Blok.catalog;
    var lines = C.blocks().map(function (d) {
      if (d.id === 'else') return '- else: "anders" (middle bar of an if/else block)';
      if (d.id === 'end') return '- end: closes a C-shaped block (see rules)';
      return '- ' + d.id + ': ' + d.label;
    });
    var conds = C.conditions().map(function (d) { return '- ' + d.id + ': ' + d.label; });
    return { blocks: lines.join('\n'), conds: conds.join('\n') };
  }

  function systemPrompt() {
    var L = blockList();
    return [
      'You transcribe photos of Scratch 3 code made by children (age 8-14) with paper, cardboard or 3D-printed blocks, often hand-drawn. Block labels are in Dutch.',
      'A separate program checks the code after you, so transcribe exactly what is on the photo, including mistakes. Never fix, complete, reorder or improve the code.',
      '',
      'Blocks (id: Dutch text; (x) = round or rectangular input with its default value, < > = hexagonal condition input, [x ▾] = fixed dropdown choice):',
      L.blocks,
      '',
      'Conditions (only used inside a < > input):',
      L.conds,
      '',
      'Rules:',
      '1. One entry in "scripts" per separate stack of blocks that are connected or placed directly under each other. Order: left to right, then top to bottom.',
      '2. List the blocks of a stack from top to bottom.',
      '3. C-shaped blocks (repeat, forever, if, repeat_until): list the C-block, then the blocks inside its mouth, then a block with id "end" at the point where the C-shape closes. For an if block with an "anders" part, put a block "else" between the two groups.',
      '4. If a C-shape is drawn open (the bottom arm is missing), do NOT add "end". If the drawing contains a separate "einde" or "anders" piece, use "end" or "else" for it where it lies.',
      '5. "inputs": the values written in the input slots, left to right, exactly as written (for example "10", "0,5", "tien", "Hallo!"). Use "" for an empty slot. For a pen colour input write the colour name in Dutch (rood, blauw, ...) or a hex code like "#FF0000".',
      '6. "condition": the id of the condition in the hexagonal slot, or "none" if the block has no such slot or it is empty.',
      '7. Blocks that match no id: describe them briefly in Dutch in "unrecognized" and leave them out of "scripts".',
      '8. "unsure": true when you are not sure which block it is or what is written in it.',
      '9. "notes": at most two short sentences in Dutch for a 10-year-old about how readable the photo or drawing is (not about whether the code is correct). Empty string if there is nothing to say.',
    ].join('\n');
  }

  function schema() {
    var C = Blok.catalog;
    var blockIds = C.blocks().map(function (d) { return d.id; });
    var condIds = C.conditions().map(function (d) { return d.id; }).concat(['none']);
    return {
      type: 'object',
      properties: {
        scripts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              blocks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    block: { type: 'string', enum: blockIds },
                    inputs: { type: 'array', items: { type: 'string' } },
                    condition: { type: 'string', enum: condIds },
                    unsure: { type: 'boolean' },
                  },
                  required: ['block', 'inputs', 'condition', 'unsure'],
                  additionalProperties: false,
                },
              },
            },
            required: ['blocks'],
            additionalProperties: false,
          },
        },
        unrecognized: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
      },
      required: ['scripts', 'unrecognized', 'notes'],
      additionalProperties: false,
    };
  }

  function normaliseColor(v) {
    var s = String(v || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
    var key = s.toLowerCase().replace(/[^a-z]/g, '');
    return COLOR_NAMES[key] || s;
  }

  // AI-antwoord -> dezelfde tokens als de codevierkantjes-herkenning oplevert.
  function toTokenScripts(data) {
    var C = Blok.catalog, notes = [];
    var scripts = (data.scripts || []).map(function (s) {
      var tokens = [];
      (s.blocks || []).forEach(function (b) {
        var def = C.byId(b.block);
        if (!def) return;
        var args = [];
        def.slots.forEach(function (slot, i) {
          if (slot.type === 'bool') return;
          var v = (b.inputs || [])[valueIndex(def, i)];
          if (v == null) return;
          args[i] = slot.type === 'color' ? normaliseColor(v) : String(v);
        });
        var cond = null;
        if (b.condition && b.condition !== 'none') {
          var cd = C.byId(b.condition);
          if (cd) cond = { uid: Blok.program.uid('a'), def: cd };
        }
        tokens.push({ uid: Blok.program.uid('a'), def: def, args: args, argTiles: [], cond: cond, unsure: !!b.unsure });
      });
      return { tokens: tokens };
    }).filter(function (s) { return s.tokens.length; });
    (data.unrecognized || []).forEach(function (u) {
      notes.push({ level: 'let op', code: 'ai-onbekend', msg: 'Dit blok ken ik niet: ' + u });
    });
    scripts.forEach(function (s) {
      s.tokens.forEach(function (t) {
        if (t.unsure) notes.push({ level: 'tip', code: 'ai-onzeker', uid: t.uid, msg: 'Ik weet niet zeker of ik "' + C.labelOf(t.def) + '" goed lees. Klopt dit blok?' });
      });
    });
    if (data.notes) notes.push({ level: 'tip', code: 'ai-opmerking', msg: data.notes });
    return { scripts: scripts, notes: notes };
  }

  // Invoer i in de AI-lijst telt alleen de niet-zeshoekige vakjes.
  function valueIndex(def, slotIndex) {
    var k = 0;
    for (var i = 0; i < slotIndex; i++) if (def.slots[i].type !== 'bool') k++;
    return k;
  }

  // Maak de foto kleiner (max 1568 px) en zet om naar JPEG-base64.
  function imagePayload(source) {
    var max = 1568, W = source.width, H = source.height, s = Math.min(1, max / Math.max(W, H));
    var c = document.createElement('canvas');
    c.width = Math.round(W * s);
    c.height = Math.round(H * s);
    c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  }

  function friendlyError(err) {
    var A = globalThis.AnthropicSDK && globalThis.AnthropicSDK.Anthropic;
    if (A) {
      if (err instanceof A.AuthenticationError) return 'De API-sleutel wordt niet geaccepteerd. Controleer hem bij Instellingen.';
      if (err instanceof A.PermissionDeniedError) return 'Deze API-sleutel mag dit model niet gebruiken. Kies een ander model of vraag toegang aan.';
      if (err instanceof A.RateLimitError) return 'Er zijn te veel foto\'s tegelijk gestuurd. Wacht een halve minuut en probeer het opnieuw.';
      if (err instanceof A.BadRequestError) return 'Anthropic weigerde het verzoek: ' + err.message;
      if (err instanceof A.APIConnectionError) return 'Geen verbinding met Anthropic. Is er internet, en blokkeert het schoolnetwerk api.anthropic.com niet?';
      if (err instanceof A.APIError) return 'Fout van Anthropic (' + err.status + '): ' + err.message;
    }
    return err && err.message ? err.message : String(err);
  }

  // Stuurt de foto naar Claude. settings: {apiKey, model}. Geeft {tokenScripts, notes, usage, model} terug.
  function recognizePhoto(source, settings) {
    var SDK = globalThis.AnthropicSDK;
    if (!SDK) return Promise.reject(new Error('De Anthropic-bibliotheek is niet geladen.'));
    if (!settings || !settings.apiKey) return Promise.reject(new Error('Vul eerst een API-sleutel in bij Instellingen.'));
    var client = new SDK.Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
    var model = settings.model || DEFAULT_MODEL;
    var params = {
      model: model,
      max_tokens: 16000,
      system: systemPrompt(),
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imagePayload(source) } },
          { type: 'text', text: 'Transcribeer de Scratch-blokken op deze foto.' },
        ],
      }],
      output_config: { format: { type: 'json_schema', schema: schema() } },
    };
    var request;
    if (model === 'claude-opus-5') {
      // Weigert het veiligheidsfilter (onterecht) een foto, dan probeert de API het zelf met een ander model.
      params.betas = ['server-side-fallback-2026-07-01'];
      params.fallbacks = 'default';
      request = client.beta.messages.create(params);
    } else {
      request = client.messages.create(params);
    }
    return request.then(function (res) {
      if (res.stop_reason === 'refusal') throw new Error('Claude wilde deze foto niet verwerken. Maak een nieuwe foto met alleen de blokken in beeld.');
      if (res.stop_reason === 'max_tokens') throw new Error('Het antwoord was te lang. Fotografeer minder blokken tegelijk.');
      var text = null;
      res.content.forEach(function (b) { if (b.type === 'text') text = b.text; });
      if (!text) throw new Error('Claude gaf geen leesbaar antwoord.');
      var data;
      try { data = JSON.parse(text); } catch (e) { throw new Error('Het antwoord van Claude was geen geldige JSON.'); }
      var conv = toTokenScripts(data);
      return { tokenScripts: conv.scripts, notes: conv.notes, usage: res.usage, model: res.model, raw: data };
    }, function (err) {
      throw new Error(friendlyError(err));
    });
  }

  Blok.ai = {
    MODELS: MODELS,
    DEFAULT_MODEL: DEFAULT_MODEL,
    systemPrompt: systemPrompt,
    schema: schema,
    toTokenScripts: toTokenScripts,
    recognizePhoto: recognizePhoto,
    normaliseColor: normaliseColor,
  };
})(globalThis.Blok = globalThis.Blok || {});
