// Herkennen: van codevierkantjes op een foto naar scripts.
//
// Stap 1 (alleen in de browser): codevierkantjes zoeken met js-aruco2 op een paar schalen.
// Stap 2 (overal, ook in tests): uit de ligging van de vierkantjes afleiden welke blokken
//         onder elkaar liggen, welke tegels in welk vakje liggen en hoe ver blokken inspringen.
//
// Uitkomst van stap 2: { scripts: [{ tokens: [...] }], loose: [...], unknown: [...], notes: [...] }
// Een token is één los stuk in volgorde van boven naar beneden, klaar voor Blok.structure.
(function (Blok) {
  'use strict';

  var G = Blok.GEOM;

  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k }; }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function unit(a) { var l = len(a) || 1; return { x: a.x / l, y: a.y / l }; }

  // ------------------------------------------------------------ stap 1: zoeken

  var detectorCache = {};
  function detector(maxErrors) {
    var k = String(maxErrors);
    if (!detectorCache[k]) detectorCache[k] = Blok.markers.createDetector(maxErrors);
    return detectorCache[k];
  }

  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // source: canvas, image of ImageBitmap. Zoekt op meerdere schalen (kleine foto's worden eerst
  // vergroot) plus één ontruiste ronde, en voegt dubbelingen samen.
  function detectMarkers(source, opts) {
    opts = opts || {};
    var W = source.videoWidth || source.naturalWidth || source.width;
    var H = source.videoHeight || source.naturalHeight || source.height;
    var longSide = Math.max(W, H);
    var passes = [];
    var addPass = function (target, blur) {
      var s = Math.min(2.5, target / longSide);
      if (s > 1 && longSide * s > 2600) s = 2600 / longSide;
      var dup = passes.some(function (p) { return p.blur === blur && Math.abs(p.s - s) < 0.08; });
      if (!dup) passes.push({ s: s, blur: blur });
    };
    (opts.sizes || [1600, 2400, 1000, 700]).forEach(function (t) { addPass(t, 0); });
    addPass(1600, 1);
    var found = [];
    passes.forEach(function (ps) {
      var w = Math.round(W * ps.s), h = Math.round(H * ps.s);
      var c = makeCanvas(w, h), ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (ps.blur) ctx.filter = 'blur(' + (ps.blur * Math.max(1, ps.s)) + 'px)';
      ctx.drawImage(source, 0, 0, w, h);
      var img = ctx.getImageData(0, 0, w, h);
      var list = detector(opts.maxErrors == null ? 2 : opts.maxErrors).detect(img);
      list.forEach(function (m) {
        found.push({
          id: m.id,
          hamming: m.hammingDistance,
          scale: ps.s,
          corners: m.corners.map(function (p) { return { x: p.x / ps.s, y: p.y / ps.s }; }),
        });
      });
    });
    return mergeDuplicates(found);
  }

  function centerOf(corners) {
    var c = { x: 0, y: 0 };
    corners.forEach(function (p) { c.x += p.x / 4; c.y += p.y / 4; });
    return c;
  }
  function sideOf(corners) {
    var s = 0;
    for (var i = 0; i < 4; i++) s += len(sub(corners[(i + 1) % 4], corners[i]));
    return s / 4;
  }

  // Hetzelfde vierkantje op twee schalen gevonden: houd de beste.
  function mergeDuplicates(list) {
    var out = [];
    list.sort(function (a, b) { return a.hamming - b.hamming || b.scale - a.scale; });
    list.forEach(function (m) {
      var c = centerOf(m.corners), side = sideOf(m.corners);
      var dup = out.some(function (o) {
        return o.id === m.id && len(sub(centerOf(o.corners), c)) < side * 0.5;
      });
      if (!dup) out.push(m);
    });
    return out;
  }

  // ------------------------------------------------------------ stap 2: ligging

  // Assen van een vierkantje: right = van linksboven naar rechtsboven, down = van linksboven naar linksonder,
  // beide met de lengte van één zijde.
  function frameOf(m) {
    var p = m.corners;
    return {
      c: centerOf(p),
      side: sideOf(p),
      right: mul(add(sub(p[1], p[0]), sub(p[2], p[3])), 0.5),
      down: mul(add(sub(p[3], p[0]), sub(p[2], p[1])), 0.5),
    };
  }

  // Punt p uitgedrukt in mm in het assenstelsel van vierkantje f (oorsprong = midden).
  function toLocal(f, p) {
    var d = sub(p, f.c);
    var a = f.right.x, b = f.down.x, c = f.right.y, e = f.down.y;
    var det = a * e - b * c;
    if (!det) return { x: 0, y: 0 };
    var u = (e * d.x - b * d.y) / det, v = (-c * d.x + a * d.y) / det;
    return { x: u * G.MARK, y: v * G.MARK };
  }

  // Waar het codevierkantje van een tegel ligt als die precies op vakje sl ligt,
  // gemeten vanaf het midden van het codevierkantje van het blok (mm).
  function expectedTileOffset(sl, tileKind) {
    var inTile = tileKind === 'bool' ? 11 : G.TILE_PAD;
    return { x: sl.x + inTile - G.PAD, y: 0 };
  }

  function interpret(markers, opts) {
    opts = opts || {};
    var cat = Blok.catalog, notes = [], unknown = [];
    var items = [];
    markers.forEach(function (m, i) {
      var def = cat.byCode(m.id);
      var f = frameOf(m);
      var it = { i: i, id: m.id, def: def, corners: m.corners, f: f, hamming: m.hamming || 0 };
      if (!def) unknown.push(it);
      else items.push(it);
    });

    // Gemiddelde "omlaag"-richting van de hele foto; stukken die daar sterk van afwijken liggen scheef of op z'n kop.
    var avg = { x: 0, y: 0 };
    items.forEach(function (it) { avg = add(avg, unit(it.f.down)); });
    var gdown = items.length ? unit(avg) : { x: 0, y: 1 };
    var gright = { x: gdown.y, y: -gdown.x }; // loodrecht op omlaag, naar rechts (y wijst omlaag)
    items.forEach(function (it) {
      var cos = dot(unit(it.f.down), gdown);
      if (cos < Math.cos(Math.PI / 4)) {
        it.rotated = true;
        it.f.down = mul(gdown, it.f.side);
        it.f.right = mul(gright, it.f.side);
      }
    });

    var blocks = items.filter(function (it) { return !cat.isTile(it.def); });
    var tiles = items.filter(function (it) { return cat.isTile(it.def); });
    blocks.forEach(function (b) {
      b.uid = Blok.program.uid('s');
      b.layout = Blok.render.layout(b.def, { mode: 'physical' });
      b.args = [];
      b.argTiles = [];
      b.cond = null;
    });

    // --- tegels in vakjes leggen (beste passing eerst)
    var cands = [];
    tiles.forEach(function (t) {
      blocks.forEach(function (b) {
        var local = toLocal(b.f, t.f.c);
        if (Math.abs(local.y) > 12 || local.x < 0 || local.x > b.layout.w + 20) return;
        b.layout.slots.forEach(function (sl) {
          var isBool = sl.p.type === 'bool';
          if (isBool !== (t.def.kind === 'bool')) return;
          var e = expectedTileOffset(sl, t.def.kind);
          var dx = local.x - e.x, dy = local.y - e.y;
          var maxRight = Math.max(16, sl.w - 18);
          if (dx < -16 || dx > maxRight) return;
          cands.push({ t: t, b: b, sl: sl, cost: Math.abs(dx) + 2 * Math.abs(dy) });
        });
      });
    });
    cands.sort(function (a, b) { return a.cost - b.cost; });
    var usedTile = {}, usedSlot = {};
    cands.forEach(function (c) {
      var sk = c.b.uid + ':' + c.sl.index;
      if (usedTile[c.t.i] || usedSlot[sk]) return;
      usedTile[c.t.i] = true;
      usedSlot[sk] = true;
      c.t.host = c.b;
      if (c.t.def.kind === 'bool') {
        c.b.cond = { uid: Blok.program.uid('s'), def: c.t.def, marker: c.t };
      } else {
        c.b.args[c.sl.index] = c.t.def.value;
        c.b.argTiles[c.sl.index] = c.t.def;
      }
    });
    var loose = tiles.filter(function (t) { return !t.host; });

    // --- blokken aan elkaar rijgen (afstanden gemeten in het gemiddelde assenstelsel van beide stukken,
    //     zodat een schuin genomen foto niet uitmaakt)
    var pairs = [];
    blocks.forEach(function (a) {
      blocks.forEach(function (b) {
        if (a === b) return;
        var f = { c: a.f.c, right: mul(add(a.f.right, b.f.right), 0.5), down: mul(add(a.f.down, b.f.down), 0.5) };
        var d = toLocal(f, b.f.c);
        var dx = d.x, dy = d.y;
        if (dy < 18 || dy > 50 || Math.abs(dx) > G.ARM + 9) return;
        var off = Math.min(Math.abs(dx), Math.abs(dx - G.ARM), Math.abs(dx + G.ARM));
        pairs.push({ a: a, b: b, dx: dx, dy: dy, cost: Math.abs(dy - G.H) + 0.6 * off });
      });
    });
    pairs.sort(function (p, q) { return p.cost - q.cost; });
    pairs.forEach(function (p) {
      if (p.a.next || p.b.prev) return;
      p.a.next = p.b;
      p.a.nextDx = p.dx;
      p.b.prev = p.a;
    });

    var starts = blocks.filter(function (b) { return !b.prev; });
    // links naar rechts, dan boven naar beneden (in de richting van de foto)
    starts.sort(function (a, b) {
      var ax = dot(a.f.c, gright), bx = dot(b.f.c, gright);
      if (Math.abs(ax - bx) > a.f.side * 2) return ax - bx;
      return dot(a.f.c, gdown) - dot(b.f.c, gdown);
    });
    var scripts = starts.map(function (s) {
      var tokens = [], cur = s, indent = 0, guard = 0;
      while (cur && guard++ < 500) {
        tokens.push({
          uid: cur.uid,
          def: cur.def,
          args: cur.args,
          argTiles: cur.argTiles,
          cond: cur.cond,
          indentMm: indent,
          rotated: !!cur.rotated,
          marker: { corners: cur.corners, center: cur.f.c, side: cur.f.side },
        });
        if (cur.next) indent += cur.nextDx;
        cur = cur.next;
      }
      return { tokens: tokens };
    });

    unknown.forEach(function (u) {
      notes.push({ level: 'let op', code: 'onbekend-vierkantje', msg: 'Ik zie een codevierkantje (nummer ' + u.id + ') dat niet bij een blok hoort. Is het van een andere set?' });
    });
    loose.forEach(function (t) {
      notes.push({ level: 'let op', code: 'losse-tegel', uid: null, msg: 'De tegel "' + Blok.catalog.labelOf(t.def) + '" ligt niet in een vakje van een blok. Leg hem precies op het vakje waar hij hoort.' });
    });

    return {
      scripts: scripts,
      loose: loose,
      unknown: unknown,
      notes: notes,
      all: items,
      down: gdown,
    };
  }

  Blok.recognize = {
    detectMarkers: detectMarkers,
    interpret: interpret,
    frameOf: frameOf,
    toLocal: toLocal,
  };
})(globalThis.Blok = globalThis.Blok || {});
