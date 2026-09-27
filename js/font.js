// Tekst meten en omzetten naar SVG-paden met de ingebakken glyph-data (js/font-data.js).
(function (Blok) {
  'use strict';

  var TOKEN = /([MLQCZ])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g;
  var parsed = {};

  function data() {
    if (!Blok.FONT_DATA) throw new Error('js/font-data.js is niet geladen');
    return Blok.FONT_DATA;
  }

  function glyph(ch) {
    var g = data().glyphs[ch];
    return g || data().glyphs['?'];
  }

  // Glyph-pad eenmalig ontleden naar [commando, getallen...].
  function commands(ch) {
    if (parsed[ch]) return parsed[ch];
    var d = glyph(ch).d, out = [], cur = null, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(d))) {
      if (m[1]) {
        cur = [m[1]];
        out.push(cur);
      } else if (cur) {
        cur.push(parseFloat(m[2]));
      }
    }
    parsed[ch] = out;
    return out;
  }

  function normalise(text) {
    return String(text == null ? '' : text);
  }

  // Breedte in dezelfde eenheid als size (mm in deze app).
  function width(text, size) {
    var f = data(), t = normalise(text), w = 0;
    for (var i = 0; i < t.length; i++) {
      w += glyph(t[i]).w;
      if (i + 1 < t.length) w += f.kern[t[i] + t[i + 1]] || 0;
    }
    return (w * size) / f.unitsPerEm;
  }

  function r(v) {
    return Math.round(v * 100) / 100;
  }

  // SVG-paddata voor tekst met de basislijn op (x, y).
  function path(text, x, y, size) {
    var f = data(), t = normalise(text), s = size / f.unitsPerEm, pen = 0, out = '';
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      var cmds = commands(ch);
      for (var c = 0; c < cmds.length; c++) {
        var cmd = cmds[c];
        out += cmd[0];
        for (var k = 1; k + 1 < cmd.length; k += 2) {
          out += (k > 1 ? ' ' : '') + r(x + (pen + cmd[k]) * s) + ' ' + r(y + cmd[k + 1] * s);
        }
      }
      pen += glyph(ch).w;
      if (i + 1 < t.length) pen += f.kern[ch + t[i + 1]] || 0;
    }
    return out;
  }

  // Hoogte van hoofdletters, handig om tekst verticaal te centreren.
  function capHeight(size) {
    return (data().capHeight * size) / data().unitsPerEm;
  }

  function xHeight(size) {
    return (data().xHeight * size) / data().unitsPerEm;
  }

  Blok.font = { width: width, path: path, capHeight: capHeight, xHeight: xHeight };
})(globalThis.Blok = globalThis.Blok || {});
