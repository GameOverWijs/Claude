// Herkende code bewaren als Scratch 3-project (.sb3), met Robo als sprite.
// Open het bestand op scratch.mit.edu via Bestand > Uploaden van je computer.
(function (Blok) {
  'use strict';

  // ---------------------------------------------------------------- MD5 (voor asset-namen)
  function md5(bytes) {
    var K = new Uint32Array(64), S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
    for (var i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    var len = bytes.length, nBlocks = ((len + 8) >> 6) + 1, words = new Uint32Array(nBlocks * 16);
    for (i = 0; i < len; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
    words[len >> 2] |= 0x80 << ((len % 4) * 8);
    words[nBlocks * 16 - 2] = (len * 8) >>> 0;
    words[nBlocks * 16 - 1] = Math.floor((len * 8) / 4294967296);
    var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (var blk = 0; blk < nBlocks; blk++) {
      var A = a0, B = b0, C = c0, D = d0;
      for (var j = 0; j < 64; j++) {
        var F, g;
        if (j < 16) { F = (B & C) | (~B & D); g = j; }
        else if (j < 32) { F = (D & B) | (~D & C); g = (5 * j + 1) % 16; }
        else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * j) % 16; }
        var s = S[(j >> 4) * 4 + (j % 4)];
        var tmp = D;
        D = C;
        C = B;
        var x = (A + F + K[j] + words[blk * 16 + g]) >>> 0;
        B = (B + ((x << s) | (x >>> (32 - s)))) >>> 0;
        A = tmp;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    return [a0, b0, c0, d0].map(function (v) {
      var h = '';
      for (var k = 0; k < 4; k++) h += ('0' + ((v >>> (k * 8)) & 0xff).toString(16)).slice(-2);
      return h;
    }).join('');
  }

  function utf8(s) { return new TextEncoder().encode(s); }

  // ---------------------------------------------------------------- assets
  function roboSvg(costume) {
    var arms = costume === 1
      ? '<path d="M18 47l-9-16M62 47l9-16" stroke="#0E7C73" stroke-width="5" stroke-linecap="round"/>'
      : '<path d="M18 51l-8 12M62 51l8 12" stroke="#0E7C73" stroke-width="5" stroke-linecap="round"/>';
    var eyes = costume === 1
      ? '<path d="M31 39a3.5 3.5 0 0 1 6 0M45 39a3.5 3.5 0 0 1 6 0" stroke="#1D2433" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
      : '<circle cx="35" cy="37" r="3.2" fill="#1D2433"/><circle cx="49" cy="37" r="3.2" fill="#1D2433"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="90" viewBox="0 0 80 90">' + arms +
      '<path d="M40 21v-8" stroke="#0E7C73" stroke-width="3"/><circle cx="40" cy="11" r="4.5" fill="#FFBF00"/>' +
      '<rect x="17" y="20" width="46" height="50" rx="11" fill="#13A89E" stroke="#0E7C73" stroke-width="2"/>' +
      '<rect x="24" y="27" width="32" height="22" rx="7" fill="#E8FBF8"/>' + eyes +
      '<path d="M37.6 43.7a5 5 0 0 0 8.8 0" stroke="#1D2433" stroke-width="2" fill="none"/>' +
      '<circle cx="28" cy="72" r="5" fill="#1D2433"/><circle cx="52" cy="72" r="5" fill="#1D2433"/>' +
      '<path d="M63 49l10 6-10 6z" fill="#FF8C1A"/></svg>';
  }

  function backdropSvg() {
    var lines = '';
    for (var x = 0; x <= 480; x += 40) lines += '<path d="M' + x + ' 0V360" stroke="' + (x === 240 ? '#C9D2DC' : '#EEF1F4') + '"/>';
    for (var y = 20; y <= 340; y += 40) lines += '<path d="M0 ' + y + 'H480" stroke="' + (y === 180 ? '#C9D2DC' : '#EEF1F4') + '"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="480" height="360" fill="#fff"/>' + lines + '</svg>';
  }

  // Kort piepje: 0,3 s, 880 Hz, 22050 Hz mono 16 bit.
  function beepWav() {
    var rate = 22050, n = Math.round(rate * 0.3), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    var str = function (o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) {
      var env = Math.min(1, i / 200) * (1 - i / n);
      v.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * 880 * i) / rate) * env * 12000), true);
    }
    return { bytes: new Uint8Array(buf), rate: rate, samples: n };
  }

  // ---------------------------------------------------------------- blokken
  // Soort vakje per invoernaam (Scratch "shadow"-types): 4 getal, 5 positief, 6 geheel, 8 hoek, 9 kleur, 10 tekst.
  var SHADOW = { DIRECTION: 8, DURATION: 5, TIMES: 6, MESSAGE: 10, COLOR: 9 };

  function serialize(scripts) {
    var blocks = {}, usesPen = false, x = 40;
    var menu = function (parent, opcode, field, value) {
      var id = Blok.program.uid('m');
      var f = {};
      f[field] = [value, null];
      blocks[id] = { opcode: opcode, next: null, parent: parent, inputs: {}, fields: f, shadow: true, topLevel: false };
      return id;
    };
    var condBlock = function (c, parent) {
      var d = c.def, id = c.uid || Blok.program.uid('c');
      var b = { opcode: d.op, next: null, parent: parent, inputs: {}, fields: {}, shadow: false, topLevel: false };
      blocks[id] = b;
      if (d.op === 'sensing_touchingobject') b.inputs.TOUCHINGOBJECTMENU = [1, menu(id, 'sensing_touchingobjectmenu', 'TOUCHINGOBJECTMENU', d.menuValue)];
      if (d.op === 'sensing_keypressed') b.inputs.KEY_OPTION = [1, menu(id, 'sensing_keyoptions', 'KEY_OPTION', d.key)];
      return id;
    };
    var list = function (nodes, parent) {
      var ids = nodes.map(function (nd) { return nd.uid; });
      nodes.forEach(function (nd, i) { block(nd, i ? ids[i - 1] : parent, ids[i + 1] || null); });
      return ids[0] || null;
    };
    var block = function (nd, parent, next) {
      var d = nd.def;
      var op = d.id === 'if' && nd.elseBody ? d.opElse : d.op;
      if (d.cat === 'pen') usesPen = true;
      var b = { opcode: op, next: next, parent: parent, inputs: {}, fields: {}, shadow: false, topLevel: false };
      blocks[nd.uid] = b;
      (d.inputs || []).forEach(function (name, k) {
        var slot = d.slots[k];
        if (slot.type === 'bool') {
          if (nd.cond) b.inputs[name] = [2, condBlock(nd.cond, nd.uid)];
          return;
        }
        var v = Blok.program.argValue(nd, k);
        var type = SHADOW[name] || 4;
        if (type === 9 && !/^#[0-9a-f]{6}$/i.test(v)) type = 4;
        b.inputs[name] = [1, [type, String(v)]];
      });
      for (var f in d.fields || {}) b.fields[f] = [d.fields[f], null];
      if (d.op === 'sound_play' || d.op === 'sound_playuntildone') b.inputs.SOUND_MENU = [1, menu(nd.uid, 'sound_sounds_menu', 'SOUND_MENU', 'Piep')];
      if (d.op === 'pen_changePenColorParamBy') b.inputs.COLOR_PARAM = [1, menu(nd.uid, 'pen_menu_colorParam', 'colorParam', 'color')];
      if (d.op === 'control_stop') b.mutation = { tagName: 'mutation', children: [], hasnext: 'false' };
      if (d.kind === 'c') {
        var first = list(nd.body || [], nd.uid);
        if (first) b.inputs.SUBSTACK = [2, first];
        if (nd.elseBody) {
          var first2 = list(nd.elseBody, nd.uid);
          if (first2) b.inputs.SUBSTACK2 = [2, first2];
        }
      }
    };
    scripts.forEach(function (s) {
      var nodes = (s.hat ? [s.hat] : []).concat(s.body.filter(function (nd) { return !nd.unreachable; }));
      if (!nodes.length) return;
      list(nodes, null);
      var top = blocks[nodes[0].uid];
      top.topLevel = true;
      top.x = x;
      top.y = 40;
      x += 360;
    });
    return { blocks: blocks, usesPen: usesPen };
  }

  // Geeft de .sb3 als Uint8Array.
  function build(scripts) {
    var ser = serialize(scripts);
    var files = [];
    var asset = function (content, ext) {
      var bytes = typeof content === 'string' ? utf8(content) : content;
      var id = md5(bytes);
      files.push({ name: id + '.' + ext, data: bytes });
      return id;
    };
    var bg = asset(backdropSvg(), 'svg');
    var c0 = asset(roboSvg(0), 'svg');
    var c1 = asset(roboSvg(1), 'svg');
    var wav = beepWav();
    var snd = asset(wav.bytes, 'wav');
    var project = {
      targets: [
        {
          isStage: true, name: 'Stage', variables: {}, lists: {}, broadcasts: {}, blocks: {}, comments: {},
          currentCostume: 0,
          costumes: [{ name: 'raster', dataFormat: 'svg', assetId: bg, md5ext: bg + '.svg', rotationCenterX: 240, rotationCenterY: 180 }],
          sounds: [], volume: 100, layerOrder: 0, tempo: 60, videoTransparency: 50, videoState: 'on', textToSpeechLanguage: null,
        },
        {
          isStage: false, name: 'Robo', variables: {}, lists: {}, broadcasts: {}, blocks: ser.blocks, comments: {},
          currentCostume: 0,
          costumes: [
            { name: 'Robo-a', bitmapResolution: 1, dataFormat: 'svg', assetId: c0, md5ext: c0 + '.svg', rotationCenterX: 40, rotationCenterY: 45 },
            { name: 'Robo-b', bitmapResolution: 1, dataFormat: 'svg', assetId: c1, md5ext: c1 + '.svg', rotationCenterX: 40, rotationCenterY: 45 },
          ],
          sounds: [{ name: 'Piep', assetId: snd, dataFormat: 'wav', format: '', rate: wav.rate, sampleCount: wav.samples, md5ext: snd + '.wav' }],
          volume: 100, layerOrder: 1, visible: true, x: 0, y: 0, size: 100, direction: 90, draggable: false, rotationStyle: 'all around',
        },
      ],
      monitors: [],
      extensions: ser.usesPen ? ['pen'] : [],
      meta: { semver: '3.0.0', vm: '0.2.0', agent: 'Blokkenscanner' },
    };
    files.unshift({ name: 'project.json', data: JSON.stringify(project) });
    return Blok.zip(files);
  }

  Blok.sb3 = { build: build, serialize: serialize, md5: md5, roboSvg: roboSvg };
})(globalThis.Blok = globalThis.Blok || {});
