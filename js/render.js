// SVG-tekenwerk: losse fysieke stukken (om te printen of te 3D-printen), tegels,
// complete scripts in Scratch-stijl en proef-"foto's".
//
// Coördinaten zijn millimeters, y naar beneden.
(function (Blok) {
  'use strict';

  var G = Blok.GEOM;
  var font = Blok.font;

  var INK = '#1D2433';
  var SLOT_TEXT = '#575E75';
  var TILE_EDGE = '#8A93A6';

  // Maten per tekenwijze. 'physical' = echte blokken met codevierkantje, 'script' = scherm.
  var PHYS = { H: G.H, slotH: G.TILE_H, fs: G.FS, gap: G.GAP, right: 4.5, menuH: 17, menuFs: 6.2, menuPad: 2.6, stroke: 0.5 };
  var SCRIPT = { H: G.S_H, slotH: G.S_SLOT_H, fs: 6, gap: 1.8, right: 3.5, menuH: 14, menuFs: 5.4, menuPad: 2.2, stroke: 0.45, left: 3.8 };
  var ICON_W = { flag: 1.25, right: 1.15, left: 1.15, pen: 1.75, loop: 1.1 };

  function n(v) { return +(+v).toFixed(2); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function cat(def) { return Blok.CATEGORIES[def.cat]; }
  function hasBody(def) { return def.kind !== 'value' && def.kind !== 'bool'; }

  // ------------------------------------------------------------------ vormen

  function notchRight(x, y) {
    return 'L' + n(x) + ' ' + n(y) +
      'L' + n(x + G.NOTCH_SLOPE) + ' ' + n(y + G.NOTCH_D) +
      'L' + n(x + G.NOTCH_SLOPE + G.NOTCH_FLAT) + ' ' + n(y + G.NOTCH_D) +
      'L' + n(x + 2 * G.NOTCH_SLOPE + G.NOTCH_FLAT) + ' ' + n(y);
  }
  function tabLeft(x, y) {
    return 'L' + n(x + 2 * G.NOTCH_SLOPE + G.NOTCH_FLAT) + ' ' + n(y) +
      'L' + n(x + G.NOTCH_SLOPE + G.NOTCH_FLAT) + ' ' + n(y + G.NOTCH_D) +
      'L' + n(x + G.NOTCH_SLOPE) + ' ' + n(y + G.NOTCH_D) +
      'L' + n(x) + ' ' + n(y);
  }
  function arc(r, x, y) { return 'A' + n(r) + ' ' + n(r) + ' 0 0 1 ' + n(x) + ' ' + n(y); }

  // Bovenrand van (x,y) naar rechts tot x+w, met inkeping op notchAt (of geen).
  function topEdge(x, y, w, notchAt, r) {
    var s = '';
    if (notchAt != null) s += notchRight(notchAt, y);
    s += 'L' + n(x + w - r) + ' ' + n(y) + arc(r, x + w, y + r);
    return s;
  }
  // Rechterrand omlaag tot y2 en onderrand naar links tot xl, met nokje op tabAt.
  function rightAndBottom(x, w, y2, xl, tabAt, r, roundLeft) {
    var s = 'L' + n(x + w) + ' ' + n(y2 - r) + arc(r, x + w - r, y2);
    if (tabAt != null) s += tabLeft(tabAt, y2);
    if (roundLeft) s += 'L' + n(xl + r) + ' ' + n(y2) + arc(r, xl, y2 - r);
    else s += 'L' + n(xl) + ' ' + n(y2);
    return s;
  }

  function hatCap(x, y, capH) {
    var k = capH / 0.75, W = G.CAP_W;
    return 'M' + n(x) + ' ' + n(y + capH) +
      'C' + n(x + 0.26 * W) + ' ' + n(y + capH - k) + ' ' + n(x + 0.74 * W) + ' ' + n(y + capH - k) + ' ' + n(x + W) + ' ' + n(y + capH);
  }

  // Gewoon blok of startblok (hat) of kapblok (cap). Geeft pad-data.
  function stackPath(x, y, w, h, o) {
    var r = G.RADIUS, s;
    var top = y;
    if (o.hat) {
      s = hatCap(x, y, o.capH);
      top = y + o.capH;
      s += 'L' + n(x + w - r) + ' ' + n(top) + arc(r, x + w, top + r);
    } else {
      s = 'M' + n(x) + ' ' + n(y + r) + arc(r, x + r, y);
      s += topEdge(x, y, w, x + G.NOTCH_X, r);
    }
    s += rightAndBottom(x, w, top + h, x, o.tab === false ? null : x + G.NOTCH_X, r, true);
    return s + 'Z';
  }

  // Los C-bovenstuk: blok + armstompje links.
  function cTopPiecePath(x, y, w, h) {
    var r = G.RADIUS, A = G.ARM;
    var s = 'M' + n(x) + ' ' + n(y + r) + arc(r, x + r, y) + topEdge(x, y, w, x + G.NOTCH_X, r);
    s += rightAndBottom(x, w, y + h, x + A, x + A + G.NOTCH_X, r, false);
    s += 'L' + n(x + A) + ' ' + n(y + h + G.STUB) + 'L' + n(x) + ' ' + n(y + h + G.STUB) + 'Z';
    return s;
  }
  // Los einde-stuk (stompje boven + balk) of anders-stuk (stompje boven + balk + stompje onder).
  function barPiecePath(x, y, w, h, withLowerStub) {
    var r = G.RADIUS, A = G.ARM, S = G.STUB;
    var s = 'M' + n(x) + ' ' + n(y) + 'L' + n(x + A) + ' ' + n(y) + 'L' + n(x + A) + ' ' + n(y + S);
    s += topEdge(x + A, y + S, w - A, x + A + G.NOTCH_X, r);
    if (withLowerStub) {
      s += rightAndBottom(x, w, y + S + h, x + A, x + A + G.NOTCH_X, r, false);
      s += 'L' + n(x + A) + ' ' + n(y + S + h + S) + 'L' + n(x) + ' ' + n(y + S + h + S) + 'Z';
    } else {
      s += rightAndBottom(x, w, y + S + h, x, x + G.NOTCH_X, r, true) + 'Z';
    }
    return s;
  }

  // Volledig C-blok voor schermweergave. rows = [{h}] afwisselend balk/binnenkant:
  // top (h), binnen (h), [anders-balk (h), binnen (h)], onderbalk (h).
  function cBlockPath(x, y, w, parts, tab) {
    var r = G.RADIUS, A = G.S_ARM;
    var s = 'M' + n(x) + ' ' + n(y + r) + arc(r, x + r, y) + topEdge(x, y, w, x + G.NOTCH_X, r);
    var cy = y;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.type === 'bar') {
        if (i > 0) {
          // bovenkant van een balk onder een binnenruimte: inkeping voor het laatste binnenblok
          s += topEdge(x + A, cy, w - A, x + A + G.NOTCH_X, r);
        }
        var last = i === parts.length - 1;
        if (last) {
          s += rightAndBottom(x, w, cy + p.h, x, tab ? x + G.NOTCH_X : null, r, true);
        } else {
          s += rightAndBottom(x, w, cy + p.h, x + A, x + A + G.NOTCH_X, r, false);
        }
      } else {
        s += 'L' + n(x + A) + ' ' + n(cy + p.h);
      }
      cy += p.h;
    }
    return s + 'Z';
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    return 'M' + n(x + r) + ' ' + n(y) + 'L' + n(x + w - r) + ' ' + n(y) + arc(r, x + w, y + r) +
      'L' + n(x + w) + ' ' + n(y + h - r) + arc(r, x + w - r, y + h) +
      'L' + n(x + r) + ' ' + n(y + h) + arc(r, x, y + h - r) +
      'L' + n(x) + ' ' + n(y + r) + arc(r, x + r, y) + 'Z';
  }
  function hexPath(x, y, w, h) {
    var p = h / 2;
    return 'M' + n(x) + ' ' + n(y + h / 2) + 'L' + n(x + p) + ' ' + n(y) + 'L' + n(x + w - p) + ' ' + n(y) +
      'L' + n(x + w) + ' ' + n(y + h / 2) + 'L' + n(x + w - p) + ' ' + n(y + h) + 'L' + n(x + p) + ' ' + n(y + h) + 'Z';
  }
  // Rand als gevuld pad (voor 3D-opdruk): buitenvorm min binnenvorm.
  function ringPath(shapeFn, x, y, w, h, t) {
    return shapeFn(x, y, w, h) + shapeFn(x + t, y + t, w - 2 * t, h - 2 * t);
  }

  // ------------------------------------------------------------------ pictogrammen

  function flagIcon(x, cy, s) {
    var pole = 'M' + n(x + 0.1 * s) + ' ' + n(cy - 0.58 * s) + 'h' + n(0.11 * s) + 'v' + n(1.16 * s) + 'h' + n(-0.11 * s) + 'Z';
    var fx = x + 0.21 * s, fy = cy - 0.55 * s, fw = 0.95 * s, fh = 0.58 * s;
    var flag = 'M' + n(fx) + ' ' + n(fy) +
      'C' + n(fx + 0.3 * fw) + ' ' + n(fy - 0.18 * fh) + ' ' + n(fx + 0.55 * fw) + ' ' + n(fy + 0.25 * fh) + ' ' + n(fx + fw) + ' ' + n(fy + 0.05 * fh) +
      'L' + n(fx + fw) + ' ' + n(fy + fh) +
      'C' + n(fx + 0.55 * fw) + ' ' + n(fy + 1.2 * fh) + ' ' + n(fx + 0.3 * fw) + ' ' + n(fy + 0.78 * fh) + ' ' + n(fx) + ' ' + n(fy + 0.95 * fh) + 'Z';
    return { pole: pole, flag: flag };
  }

  // Cirkelpijl. clockwise = true voor ↻.
  function turnIcon(x, cy, s, clockwise) {
    var R = 0.36 * s, t = 0.13 * s, cx = x + 0.55 * s;
    var a1 = -20, a2 = 280;
    var rad = function (a) { return (a * Math.PI) / 180; };
    var pt = function (a, rr) { return [cx + rr * Math.cos(rad(a)), cy + rr * Math.sin(rad(a))]; };
    var o1 = pt(a1, R + t / 2), o2 = pt(a2, R + t / 2), i2 = pt(a2, R - t / 2), i1 = pt(a1, R - t / 2);
    var ue = [Math.cos(rad(a2)), Math.sin(rad(a2))];
    var tan = [-Math.sin(rad(a2)), Math.cos(rad(a2))];
    var h = 0.13 * s, L = 0.27 * s;
    var bOut = [cx + (R + t / 2 + h) * ue[0], cy + (R + t / 2 + h) * ue[1]];
    var bIn = [cx + (R - t / 2 - h) * ue[0], cy + (R - t / 2 - h) * ue[1]];
    var tip = [cx + R * ue[0] + tan[0] * L, cy + R * ue[1] + tan[1] * L];
    var P = function (p) { return n(p[0]) + ' ' + n(p[1]); };
    var d = 'M' + P(o1) + 'A' + n(R + t / 2) + ' ' + n(R + t / 2) + ' 0 1 1 ' + P(o2) +
      'L' + P(bOut) + 'L' + P(tip) + 'L' + P(bIn) + 'L' + P(i2) +
      'A' + n(R - t / 2) + ' ' + n(R - t / 2) + ' 0 1 0 ' + P(i1) + 'Z';
    if (!clockwise) {
      // spiegelen rond cx
      d = d.replace(/([MLA])([^MLAZ]*)/g, function (m, cmd, args) {
        var v = args.trim().split(/\s+/).map(Number);
        if (cmd === 'A') {
          v[4] = v[4] ? 0 : 1;
          v[5] = n(2 * cx - v[5]);
        } else {
          v[0] = n(2 * cx - v[0]);
        }
        return cmd + v.join(' ');
      });
    }
    return d;
  }

  function penIcon(x, cy, s) {
    // potlood schuin naar linksonder, met punt en gumrandje
    var cx = x + 0.6 * s, L = 1.3 * s, W = 0.38 * s, T = 0.34 * s;
    var ang = (-45 * Math.PI) / 180;
    var P = function (pts) {
      return 'M' + pts.map(function (p) {
        return n(cx + p[0] * Math.cos(ang) - p[1] * Math.sin(ang)) + ' ' + n(cy - p[0] * Math.sin(ang) - p[1] * Math.cos(ang));
      }).join('L') + 'Z';
    };
    var body = P([[-L / 2, 0], [-L / 2 + T, -W / 2], [L / 2 - 0.22 * s, -W / 2], [L / 2 - 0.22 * s, W / 2], [-L / 2 + T, W / 2]]);
    var cap = P([[L / 2 - 0.16 * s, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [L / 2 - 0.16 * s, W / 2]]);
    return body + cap;
  }

  function menuArrow(x, cy, s) {
    return 'M' + n(x) + ' ' + n(cy - 0.35 * s) + 'L' + n(x + 0.9 * s) + ' ' + n(cy - 0.35 * s) + 'L' + n(x + 0.45 * s) + ' ' + n(cy + 0.25 * s) + 'Z';
  }

  // ------------------------------------------------------------------ tekst

  function textEl(text, x, cy, size, fill, asText) {
    var base = cy + font.capHeight(size) * 0.5 - size * 0.02;
    if (asText) {
      return '<text x="' + n(x) + '" y="' + n(base) + '" font-family="Nunito, \'Nunito ExtraBold\', Arial, sans-serif" font-weight="800" font-size="' + n(size) + '" fill="' + fill + '">' + esc(text) + '</text>';
    }
    return '<path d="' + font.path(text, x, base, size) + '" fill="' + fill + '"/>';
  }

  // ------------------------------------------------------------------ opmaak (layout)

  function valueTileLayout(def) {
    var textW = def.type === 'color'
      ? 11 + G.GAP + font.width(def.label, G.FS)
      : font.width(def.value, G.TILE_FS);
    var w = G.TILE_PAD + G.MBOX + G.GAP + textW + 4;
    return { w: Math.max(w, 36), h: G.TILE_H };
  }

  function partsWidth(parts, M) {
    var w = 0;
    parts.forEach(function (p, i) {
      if (i) w += M.gap;
      if (p.t === 'text') w += font.width(p.text, M.fs);
      else if (p.t === 'menu') w += font.width(p.text, M.menuFs) + 2 * M.menuPad + 0.9 * M.menuFs;
      else if (p.t === 'icon') w += ICON_W[p.icon] * M.fs;
    });
    return w;
  }

  var boolSlotW = null;
  function physicalBoolSlotWidth() {
    if (boolSlotW == null) boolSlotW = boolTileLayout(Blok.catalog.byId('touching_edge')).w;
    return boolSlotW;
  }
  function boolTileLayout(def) {
    var start = 11 + G.MBOX + G.GAP;
    return { w: start + partsWidth(def.parts, PHYS) + 9, h: G.TILE_H, start: start };
  }

  function defaultTileFor(slot) {
    if (slot.type === 'color') return { type: 'color', label: 'blauw', value: slot.def };
    return { type: slot.type, value: slot.def };
  }

  // Opmaak van een blok. opts.mode: 'physical' of 'script'. Voor 'script' kan opts.node
  // (uit de structuur-parser) waarden en voorwaarden meegeven.
  function layout(def, opts) {
    opts = opts || {};
    var phys = (opts.mode || 'physical') === 'physical';
    var M = phys ? PHYS : SCRIPT;
    var node = opts.node;
    var x = phys ? G.PAD + G.MBOX + G.GAP + 0.6 : M.left;
    var items = [];
    var slotIndex = 0;
    def.parts.forEach(function (p, i) {
      if (i) x += M.gap;
      var it = { p: p, x: x, w: 0 };
      if (p.t === 'text') it.w = font.width(p.text, M.fs);
      else if (p.t === 'icon') it.w = ICON_W[p.icon] * M.fs;
      else if (p.t === 'menu') it.w = font.width(p.text, M.menuFs) + 2 * M.menuPad + 0.9 * M.menuFs;
      else if (p.t === 'slot') {
        it.index = slotIndex++;
        if (phys) {
          it.w = p.type === 'bool' ? physicalBoolSlotWidth() : valueTileLayout(defaultTileFor(p)).w;
          it.h = G.TILE_H;
        } else {
          var v = node ? slotValue(node, it.index, p) : p.def;
          if (p.type === 'bool') {
            var c = node && node.cond;
            it.cond = c || null;
            it.w = c ? conditionLayout(c).w : 14;
          } else if (p.type === 'color') {
            it.w = M.slotH * 1.3;
          } else {
            it.w = Math.max(font.width(String(v), M.fs * 0.95) + 5.6, M.slotH * 1.25);
          }
          it.h = M.slotH;
          it.value = v;
        }
      }
      items.push(it);
      x += it.w;
    });
    var w = x + M.right;
    if (def.kind === 'hat') w = Math.max(w, G.CAP_W + 12);
    if (def.kind === 'c' || def.kind === 'else' || def.kind === 'end') w = Math.max(w, phys ? 62 : 40);
    if (phys && def.kind === 'stack') w = Math.max(w, 58);
    var H = M.H;
    var bodyTop = 0;
    if (phys) {
      if (def.kind === 'hat') bodyTop = G.CAP_H;
      if (def.kind === 'end' || def.kind === 'else') bodyTop = G.STUB;
    } else if (def.kind === 'hat') {
      bodyTop = G.S_CAP_H;
    }
    return {
      def: def,
      mode: phys ? 'physical' : 'script',
      w: w,
      H: H,
      bodyTop: bodyTop,
      items: items,
      slots: items.filter(function (it) { return it.p.t === 'slot'; }),
      // midden van het codevierkantje t.o.v. linkerbovenhoek van het stuk
      marker: phys ? { x: G.PAD + G.MBOX / 2, y: bodyTop + H / 2 } : null,
    };
  }

  function slotValue(node, index, slot) {
    var a = node.args && node.args[index];
    return a == null || a === '' ? slot.def : a;
  }

  function conditionLayout(c) {
    var M = SCRIPT;
    var w = partsWidth(c.def.parts, M) + M.slotH + 2;
    return { w: Math.max(w, 20), h: M.slotH };
  }

  // Totale afmetingen van een los fysiek stuk (inclusief kap, stompjes en nokje).
  function pieceSize(def) {
    if (def.kind === 'value') return valueTileLayout(def);
    if (def.kind === 'bool') return boolTileLayout(def);
    var L = layout(def, { mode: 'physical' });
    var h = L.H;
    if (def.kind === 'hat') h += G.CAP_H + G.NOTCH_D;
    else if (def.kind === 'stack') h += G.NOTCH_D;
    else if (def.kind === 'c') h += G.STUB;
    else if (def.kind === 'end') h += G.STUB + G.NOTCH_D;
    else if (def.kind === 'else') h += 2 * G.STUB;
    return { w: L.w, h: h, layout: L };
  }

  // ------------------------------------------------------------------ stijlen

  // style: 'kleur' | 'kleurplaat' | '3d-vorm' | '3d-tekst' | '3d-marker'
  function palette(def, style) {
    var c = cat(def);
    if (style === 'kleurplaat') {
      return { fill: '#FFFFFF', stroke: '#000000', text: '#000000', menuFill: '#FFFFFF', menuText: '#000000', slotFill: '#FFFFFF', slotStroke: '#000000', slotText: '#000000', icon: '#000000', flag: '#FFFFFF' };
    }
    return { fill: c.fill, stroke: c.dark, text: '#FFFFFF', menuFill: c.menu, menuText: '#FFFFFF', slotFill: '#FFFFFF', slotStroke: c.dark, slotText: SLOT_TEXT, icon: '#FFFFFF', flag: '#4CBF56' };
  }

  // Onderdelen (tekst, menu's, vakjes, pictogrammen) van een blok tekenen.
  function drawItems(L, x0, cy, pal, style, M, o) {
    var out = '';
    var relief = style === '3d-tekst';
    var asText = o && o.editableText;
    L.items.forEach(function (it) {
      var p = it.p, x = x0 + it.x;
      if (p.t === 'text') {
        out += textEl(p.text, x, cy, M.fs, relief ? '#000' : pal.text, asText);
      } else if (p.t === 'icon') {
        var s = M.fs;
        if (p.icon === 'flag') {
          var f = flagIcon(x, cy, s);
          if (relief) out += '<path d="' + f.pole + f.flag + '" fill="#000"/>';
          else out += '<path d="' + f.pole + '" fill="' + (style === 'kleurplaat' ? '#000' : '#FFFFFF') + '"/>' +
            '<path d="' + f.flag + '" fill="' + pal.flag + '" stroke="' + (style === 'kleurplaat' ? '#000' : '#3D8B45') + '" stroke-width="0.35"/>';
        } else if (p.icon === 'right' || p.icon === 'left' || p.icon === 'loop') {
          out += '<path d="' + turnIcon(x, cy, s, p.icon !== 'left') + '" fill="' + (relief ? '#000' : pal.icon) + '"/>';
        } else if (p.icon === 'pen') {
          out += '<path d="' + penIcon(x, cy, s) + '" fill="' + (relief ? '#000' : pal.icon) + '"/>';
          var sx = x + ICON_W.pen * s - 0.35 * s;
          if (relief) out += '<rect x="' + n(sx) + '" y="' + n(cy - 0.62 * s) + '" width="0.6" height="' + n(1.24 * s) + '" fill="#000"/>';
          else out += '<rect x="' + n(sx) + '" y="' + n(cy - 0.62 * s) + '" width="0.4" height="' + n(1.24 * s) + '" fill="' + (style === 'kleurplaat' ? '#000' : pal.stroke) + '" opacity="0.6"/>';
        }
      } else if (p.t === 'menu') {
        var mh = M.menuH, my = cy - mh / 2;
        if (relief) {
          out += '<path d="' + ringPath(function (a, b, c2, d) { return roundRect(a, b, c2, d, 2.4); }, x, my, it.w, mh, 0.7) + '" fill="#000" fill-rule="evenodd"/>';
          out += textEl(p.text, x + M.menuPad, cy, M.menuFs, '#000');
          out += '<path d="' + menuArrow(x + it.w - M.menuPad - 0.9 * M.menuFs + 0.3, cy, M.menuFs) + '" fill="#000"/>';
        } else {
          out += '<path d="' + roundRect(x, my, it.w, mh, 2.4) + '" fill="' + pal.menuFill + '" stroke="' + pal.stroke + '" stroke-width="0.35"/>';
          out += textEl(p.text, x + M.menuPad, cy, M.menuFs, pal.menuText, asText);
          out += '<path d="' + menuArrow(x + it.w - M.menuPad - 0.9 * M.menuFs + 0.3, cy, M.menuFs) + '" fill="' + pal.menuText + '"/>';
        }
      } else if (p.t === 'slot') {
        out += drawSlot(it, x, cy, pal, style, M, o);
      }
    });
    return out;
  }

  function drawSlot(it, x, cy, pal, style, M, o) {
    var p = it.p, h = it.h, y = cy - h / 2, out = '';
    var relief = style === '3d-tekst';
    var shape = p.type === 'bool' ? hexPath : function (a, b, c, d) { return roundRect(a, b, c, d, L_RADIUS(M, d)); };
    var bad = o && o.badSlots && o.badSlots.indexOf(it.index) >= 0;
    if (M === PHYS) {
      if (relief) {
        out += '<path d="' + ringPath(shape, x, y, it.w, h, 0.8) + '" fill="#000" fill-rule="evenodd"/>';
      } else {
        var fill = p.type === 'bool' ? (style === 'kleurplaat' ? '#FFFFFF' : pal.stroke) : pal.slotFill;
        out += '<path d="' + shape(x, y, it.w, h) + '" fill="' + fill + '" stroke="' + pal.slotStroke + '" stroke-width="0.45"/>';
      }
      if (p.type !== 'bool') {
        var label = p.type === 'color' ? 'kleur' : p.def;
        var tw = font.width(label, G.TILE_FS);
        var tf = relief ? '#000' : (style === 'kleurplaat' ? '#000' : SLOT_TEXT);
        if (p.type === 'color' && style !== 'kleurplaat' && !relief) {
          out += '<circle cx="' + n(x + it.w / 2 - tw / 2 - 5) + '" cy="' + n(cy) + '" r="4" fill="' + p.def + '"/>';
          out += textEl(label, x + it.w / 2 - tw / 2 + 1, cy, G.TILE_FS, tf, o && o.editableText);
        } else {
          out += textEl(label, x + (it.w - tw) / 2, cy, G.TILE_FS, tf, o && o.editableText);
        }
      }
      return out;
    }
    // schermweergave
    if (p.type === 'bool') {
      if (it.cond) return drawCondition(it.cond, x, cy, o);
      return '<path d="' + hexPath(x, y, it.w, h) + '" fill="' + pal.stroke + '" stroke="' + (bad ? '#E5484D' : pal.stroke) + '" stroke-width="' + (bad ? 0.9 : 0.35) + '"/>';
    }
    if (p.type === 'color') {
      var col = /^#[0-9a-f]{6}$/i.test(it.value) ? it.value : '#FFFFFF';
      return '<path d="' + roundRect(x, y, it.w, h, h / 2) + '" fill="' + col + '" stroke="' + (bad ? '#E5484D' : '#FFFFFF') + '" stroke-width="' + (bad ? 0.9 : 0.6) + '"/>';
    }
    out += '<path d="' + roundRect(x, y, it.w, h, h / 2) + '" fill="#FFFFFF" stroke="' + (bad ? '#E5484D' : pal.stroke) + '" stroke-width="' + (bad ? 0.9 : 0.35) + '"/>';
    var s = String(it.value), size = M.fs * 0.95, tw2 = font.width(s, size);
    out += textEl(s, x + (it.w - tw2) / 2, cy, size, bad ? '#C62828' : SLOT_TEXT);
    return out;
  }
  function L_RADIUS(M, h) { return M === PHYS ? 4 : h / 2; }

  function drawCondition(c, x, cy, o) {
    var def = c.def, M = SCRIPT, pal = palette(def, 'kleur');
    var CL = conditionLayout(c), h = CL.h, out = '';
    out += '<g data-uid="' + esc(c.uid || '') + '">';
    out += '<path d="' + hexPath(x, cy - h / 2, CL.w, h) + '" fill="' + pal.fill + '" stroke="' + pal.stroke + '" stroke-width="0.35"/>';
    var px = x + h / 2 + 0.5;
    def.parts.forEach(function (p, i) {
      if (i) px += M.gap;
      if (p.t === 'text') {
        out += textEl(p.text, px, cy, M.fs, '#FFFFFF');
        px += font.width(p.text, M.fs);
      } else if (p.t === 'menu') {
        var w = font.width(p.text, M.menuFs) + 2 * M.menuPad + 0.9 * M.menuFs, mh = M.menuH - 3;
        out += '<path d="' + roundRect(px, cy - mh / 2, w, mh, 2) + '" fill="' + pal.menuFill + '" stroke="' + pal.stroke + '" stroke-width="0.3"/>';
        out += textEl(p.text, px + M.menuPad, cy, M.menuFs, '#FFFFFF');
        out += '<path d="' + menuArrow(px + w - M.menuPad - 0.9 * M.menuFs + 0.3, cy, M.menuFs) + '" fill="#FFFFFF"/>';
        px += w;
      }
    });
    return out + '</g>';
  }

  // ------------------------------------------------------------------ losse stukken

  function markerFor(def, x, y, style) {
    if (style === '3d-vorm') return '';
    if (style === '3d-tekst') {
      // wit deel van het codevierkantje: kader min zwart vlak, plus witte vakjes
      var cell = G.CELL, b = G.MBOX, inner = G.MARK;
      var ring = roundRect(x, y, b, b, cell * 0.5) + 'M' + n(x + cell) + ' ' + n(y + cell) + 'h' + n(inner) + 'v' + n(inner) + 'h' + n(-inner) + 'Z';
      var paths = Blok.markers.cellPaths(def.code, x + cell, y + cell, cell);
      return '<path d="' + ring + '" fill="#000" fill-rule="evenodd"/><path d="' + paths.white + '" fill="#000"/>';
    }
    if (style === '3d-marker') return Blok.markers.svg(def.code, x, y, { mode: 'black' });
    return Blok.markers.svg(def.code, x, y);
  }

  // Binnenkant (SVG-fragment) van een los stuk met linkerbovenhoek in (x, y).
  function pieceInner(def, x, y, style, o) {
    style = style || 'kleur';
    o = o || {};
    if (def.kind === 'value') return valueTileInner(def, x, y, style, o);
    if (def.kind === 'bool') return boolTileInner(def, x, y, style, o);
    var L = layout(def, { mode: 'physical' });
    var pal = palette(def, style);
    var shape;
    var H = L.H;
    if (def.kind === 'hat') shape = stackPath(x, y, L.w, H, { hat: true, capH: G.CAP_H });
    else if (def.kind === 'stack') shape = stackPath(x, y, L.w, H, {});
    else if (def.kind === 'cap') shape = stackPath(x, y, L.w, H, { tab: false });
    else if (def.kind === 'c') shape = cTopPiecePath(x, y, L.w, H);
    else if (def.kind === 'end') shape = barPiecePath(x, y, L.w, H, false);
    else if (def.kind === 'else') shape = barPiecePath(x, y, L.w, H, true);
    var out = '<g class="piece" data-id="' + def.id + '">';
    if (style === '3d-vorm') {
      out += '<path d="' + shape + '" fill="#000"/>';
    } else if (style !== '3d-tekst' && style !== '3d-marker') {
      out += '<path d="' + shape + '" fill="' + pal.fill + '" stroke="' + pal.stroke + '" stroke-width="' + PHYS.stroke + '" stroke-linejoin="round"/>';
    }
    var cy = y + L.bodyTop + H / 2;
    if (style !== '3d-vorm' && style !== '3d-marker') out += drawItems(L, x, cy, pal, style, PHYS, o);
    out += markerFor(def, x + G.PAD, cy - G.MBOX / 2, style);
    return out + '</g>';
  }

  function valueTileInner(def, x, y, style, o) {
    var T = valueTileLayout(def), out = '<g class="tile" data-id="' + def.id + '">';
    var h = T.h, cy = y + h / 2;
    var outline = roundRect(x, y, T.w, h, 4);
    if (style === '3d-vorm') return out + '<path d="' + outline + '" fill="#000"/></g>';
    var ink = style === 'kleurplaat' ? '#000' : INK;
    if (style !== '3d-tekst' && style !== '3d-marker') {
      out += '<path d="' + outline + '" fill="#FFFFFF" stroke="' + (style === 'kleurplaat' ? '#000' : TILE_EDGE) + '" stroke-width="0.5"/>';
    }
    var tx = x + G.TILE_PAD + G.MBOX + G.GAP;
    if (style !== '3d-marker') {
      if (def.type === 'color') {
        if (style === '3d-tekst') out += '<circle cx="' + n(tx + 5.5) + '" cy="' + n(cy) + '" r="5.5" fill="#000"/>';
        else out += '<circle cx="' + n(tx + 5.5) + '" cy="' + n(cy) + '" r="5.5" fill="' + (style === 'kleurplaat' ? '#FFFFFF' : def.value) + '" stroke="' + ink + '" stroke-width="0.4"/>';
        out += textEl(def.label, tx + 11 + G.GAP, cy, G.FS, style === '3d-tekst' ? '#000' : ink, o.editableText);
      } else {
        out += textEl(def.value, tx, cy, G.TILE_FS, style === '3d-tekst' ? '#000' : ink, o.editableText);
      }
    }
    out += markerFor(def, x + G.TILE_PAD, y + G.TILE_PAD, style);
    return out + '</g>';
  }

  function boolTileInner(def, x, y, style, o) {
    var T = boolTileLayout(def), pal = palette(def, style), out = '<g class="tile" data-id="' + def.id + '">';
    var h = T.h, cy = y + h / 2, shape = hexPath(x, y, T.w, h);
    if (style === '3d-vorm') return out + '<path d="' + shape + '" fill="#000"/></g>';
    if (style !== '3d-tekst' && style !== '3d-marker') {
      out += '<path d="' + shape + '" fill="' + pal.fill + '" stroke="' + pal.stroke + '" stroke-width="0.5" stroke-linejoin="round"/>';
    }
    if (style !== '3d-marker') {
      var L = { items: [] }, px = T.start;
      def.parts.forEach(function (p, i) {
        if (i) px += PHYS.gap;
        var w = p.t === 'text' ? font.width(p.text, PHYS.fs) : font.width(p.text, PHYS.menuFs) + 2 * PHYS.menuPad + 0.9 * PHYS.menuFs;
        L.items.push({ p: p, x: px, w: w });
        px += w;
      });
      out += drawItems(L, x, cy, pal, style, PHYS, o);
    }
    out += markerFor(def, x + 11, y + G.TILE_PAD, style);
    return out + '</g>';
  }

  function wrapSvg(inner, w, h, title, opts) {
    opts = opts || {};
    var m = opts.margin == null ? 1 : opts.margin;
    var reg = '';
    if (opts.registration) {
      // twee piepkleine hoekjes zodat alle 3D-lagen precies even groot zijn en op elkaar passen
      reg = '<rect x="' + n(-m) + '" y="' + n(-m) + '" width="0.2" height="0.2" fill="#000"/>' +
        '<rect x="' + n(w + m - 0.2) + '" y="' + n(h + m - 0.2) + '" width="0.2" height="0.2" fill="#000"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + n(w + 2 * m) + 'mm" height="' + n(h + 2 * m) + 'mm" viewBox="' +
      n(-m) + ' ' + n(-m) + ' ' + n(w + 2 * m) + ' ' + n(h + 2 * m) + '">' +
      (title ? '<title>' + esc(title) + '</title>' : '') + reg + inner + '</svg>';
  }

  var STYLE_NAMES = {
    kleur: 'kleur',
    kleurplaat: 'kleurplaat',
    '3d-vorm': '3D-vorm',
    '3d-tekst': '3D-opdruk',
    '3d-marker': '3D-codevierkant',
  };

  // Los stuk als compleet SVG-bestand.
  function pieceSvg(def, style, o) {
    style = style || 'kleur';
    var size = pieceSize(def);
    var title = (def.label || def.id) + ' (code ' + def.code + ', ' + STYLE_NAMES[style] + ')';
    return wrapSvg(pieceInner(def, 0, 0, style, o), size.w, size.h, title, { registration: style.indexOf('3d') === 0 });
  }

  // ------------------------------------------------------------------ scripts (scherm)

  function nodeHeight(node) {
    var def = node.def;
    if (def.kind === 'c') {
      var h = G.S_H + listHeight(node.body, true) + G.S_BOTTOM;
      if (node.elseBody) h += G.S_H + listHeight(node.elseBody, true);
      return h;
    }
    if (def.kind === 'hat') return G.S_CAP_H + G.S_H;
    return G.S_H;
  }
  function listHeight(list, inner) {
    var h = 0;
    (list || []).forEach(function (nd) { h += nodeHeight(nd); });
    return inner ? Math.max(h, 8) : h;
  }

  function drawNode(node, x, y, o) {
    var def = node.def, pal = palette(def, 'kleur');
    var L = layout(def, { mode: 'script', node: node });
    var bad = (o.issues && o.issues[node.uid]) || null;
    var cls = 'blk' + (bad && bad.level === 'fout' ? ' has-error' : '') + (node.unreachable ? ' unreachable' : '');
    var out = '<g class="' + cls + '" data-uid="' + esc(node.uid || '') + '">';
    var shapeAttrs = '" fill="' + pal.fill + '" stroke="' + pal.stroke + '" stroke-width="' + SCRIPT.stroke + '" stroke-linejoin="round" class="shape"/>';
    var h = nodeHeight(node);
    var slotOpts = { badSlots: bad && bad.slots };
    if (def.kind === 'c') {
      var parts = [{ type: 'bar', h: G.S_H }, { type: 'inner', h: listHeight(node.body, true) }];
      if (node.elseBody) parts.push({ type: 'bar', h: G.S_H }, { type: 'inner', h: listHeight(node.elseBody, true) });
      parts.push({ type: 'bar', h: G.S_BOTTOM });
      out += '<path d="' + cBlockPath(x, y, L.w, parts, !def.forever) + shapeAttrs;
      out += drawItems(L, x, y + G.S_H / 2, pal, 'kleur', SCRIPT, slotOpts);
      var inner = drawList(node.body, x + G.S_ARM, y + G.S_H, o);
      var cy = y + G.S_H + listHeight(node.body, true);
      if (node.elseBody) {
        out += textEl('anders', x + SCRIPT.left, cy + G.S_H / 2, SCRIPT.fs, '#FFFFFF');
        inner += drawList(node.elseBody, x + G.S_ARM, cy + G.S_H, o);
        cy += G.S_H + listHeight(node.elseBody, true);
      }
      if (def.loop) out += '<path d="' + turnIcon(x + L.w - 9, cy + G.S_BOTTOM / 2, 5.2, true) + '" fill="#FFFFFF"/>';
      out += '</g>' + inner;
      return { svg: out, h: h };
    }
    var capH = def.kind === 'hat' ? G.S_CAP_H : 0;
    out += '<path d="' + stackPath(x, y, L.w, G.S_H, { hat: def.kind === 'hat', capH: capH, tab: def.kind !== 'cap' }) + shapeAttrs;
    out += drawItems(L, x, y + capH + G.S_H / 2, pal, 'kleur', SCRIPT, slotOpts);
    out += '</g>';
    return { svg: out, h: h };
  }

  function drawList(list, x, y, o) {
    var out = '';
    (list || []).forEach(function (nd) {
      var r = drawNode(nd, x, y, o);
      out += r.svg;
      y += r.h;
    });
    return out;
  }

  function scriptWidth(nodes, depth) {
    var w = 0;
    (nodes || []).forEach(function (nd) {
      w = Math.max(w, depth * G.S_ARM + layout(nd.def, { mode: 'script', node: nd }).w);
      if (nd.body) w = Math.max(w, scriptWidth(nd.body, depth + 1));
      if (nd.elseBody) w = Math.max(w, scriptWidth(nd.elseBody, depth + 1));
    });
    return w;
  }

  function scriptNodes(script) {
    return (script.hat ? [script.hat] : []).concat(script.body || []);
  }

  // Een of meer scripts naast elkaar. opts.issues = {uid: {level, slots}}.
  function programSvg(scripts, opts) {
    opts = opts || {};
    var gapX = 10, x = 0, maxH = 0, out = '';
    scripts.forEach(function (s) {
      var nodes = scriptNodes(s);
      var w = scriptWidth(nodes, 0);
      var h = listHeight(nodes) + G.NOTCH_D;
      out += '<g class="script">' + drawList(nodes, x, 0, opts) + '</g>';
      x += w + gapX;
      maxH = Math.max(maxH, h);
    });
    var W = Math.max(x - gapX, 10), H = Math.max(maxH, 10);
    var svg = wrapSvg(out, W, H, opts.title || 'Scratch-code', { margin: 2 });
    if (opts.scale) svg = svg.replace(/width="([\d.]+)mm" height="([\d.]+)mm"/, function (m, a, b) {
      return 'width="' + n(a * opts.scale) + '" height="' + n(b * opts.scale) + '"';
    });
    return svg;
  }

  // ------------------------------------------------------------------ opstelling (proef-foto)

  // Zet een script terug om naar de losse fysieke stukken in de volgorde op tafel.
  function physicalTokens(script) {
    var out = [];
    function walk(list, depth) {
      (list || []).forEach(function (nd) {
        out.push({ node: nd, def: nd.def, depth: depth });
        if (nd.def.kind === 'c') {
          walk(nd.body, depth + 1);
          if (nd.elseBody) {
            out.push({ def: Blok.catalog.byId('else'), depth: depth });
            walk(nd.elseBody, depth + 1);
          }
          out.push({ def: Blok.catalog.byId('end'), depth: depth });
        }
      });
    }
    walk(scriptNodes(script), 0);
    return out;
  }

  // Hoekpunten van het zwarte vierkant van een codevierkantje waarvan het witte kader op (bx, by) begint.
  function markerCorners(code, bx, by) {
    var x = bx + G.CELL, y = by + G.CELL, m = G.MARK;
    return { id: code, corners: [{ x: x, y: y }, { x: x + m, y: y }, { x: x + m, y: y + m }, { x: x, y: y + m }] };
  }

  // Tekent de losse stukken en tegels zoals een leerling ze neerlegt.
  // Geeft {inner, w, h, markers} terug; markers = waar de codevierkantjes liggen (mm), handig voor tests.
  function arrangement(scripts, opts) {
    opts = opts || {};
    var style = opts.style || 'kleur';
    var out = '', tiles = '', markers = [], x = opts.x0 || 20, maxW = 0, maxH = 0;
    scripts.forEach(function (s) {
      var tokens = physicalTokens(s);
      if (opts.dropLastEnd) {
        for (var k = tokens.length - 1; k >= 0; k--) {
          if (tokens[k].def.kind === 'end') { tokens.splice(k, 1); break; }
        }
      }
      var bodyTop = (opts.y0 || 20) + (tokens.length && tokens[0].def.kind === 'hat' ? G.CAP_H : G.STUB);
      var w = 0;
      tokens.forEach(function (t) {
        var L = layout(t.def, { mode: 'physical' });
        var px = x + t.depth * G.ARM + (t.shift || 0), py = bodyTop - L.bodyTop;
        out += pieceInner(t.def, px, py, style);
        markers.push(markerCorners(t.def.code, px + G.PAD, bodyTop + (G.H - G.MBOX) / 2));
        if (t.node) {
          L.slots.forEach(function (sl) {
            var tile = null;
            if (sl.p.type === 'bool') tile = t.node.cond ? t.node.cond.def : null;
            else if (t.node.argTiles && t.node.argTiles[sl.index]) tile = t.node.argTiles[sl.index];
            if (!tile) return;
            var tx = px + sl.x, ty = bodyTop + (G.H - G.TILE_H) / 2;
            tiles += pieceInner(tile, tx, ty, style);
            markers.push(markerCorners(tile.code, tx + (tile.kind === 'bool' ? 11 : G.TILE_PAD), ty + G.TILE_PAD));
          });
        }
        w = Math.max(w, t.depth * G.ARM + L.w);
        bodyTop += G.H + (opts.spacing || 0);
      });
      maxW = x + w;
      maxH = Math.max(maxH, bodyTop + G.NOTCH_D);
      x += w + (opts.scriptGap || 30);
    });
    return { inner: out + tiles, w: maxW + 20, h: maxH + 20, markers: markers };
  }

  Blok.render = {
    PHYS: PHYS,
    SCRIPT: SCRIPT,
    layout: layout,
    pieceSize: pieceSize,
    pieceInner: pieceInner,
    pieceSvg: pieceSvg,
    valueTileLayout: valueTileLayout,
    boolTileLayout: boolTileLayout,
    wrapSvg: wrapSvg,
    programSvg: programSvg,
    physicalTokens: physicalTokens,
    arrangement: arrangement,
    STYLE_NAMES: STYLE_NAMES,
    esc: esc,
  };
})(globalThis.Blok = globalThis.Blok || {});
