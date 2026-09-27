// Printvellen (A4), stickervellen met codevierkantjes, sets en ZIP-pakketten.
(function (Blok) {
  'use strict';

  var G = Blok.GEOM;
  var R = Blok.render;
  var C = Blok.catalog;
  var A4 = { w: 210, h: 297, margin: 10 };

  function n(v) { return +(+v).toFixed(2); }

  // Aantallen per groepje van 2 à 3 leerlingen. Genoeg voor alle opdrachten in de app.
  var CLASS_SET = {
    when_flag: 1, when_key_space: 1, when_key_left: 1, when_key_right: 1, when_clicked: 1,
    move: 3, turn_right: 2, turn_left: 1, goto_xy: 1, point_dir: 1, change_x: 1, change_y: 1, bounce: 1,
    say_secs: 1, say: 1, next_costume: 1, change_size: 1,
    play_sound: 1,
    wait: 2, repeat: 2, forever: 1, if: 1, repeat_until: 1, stop_all: 1, else: 1, end: 4,
    pen_down: 1, pen_up: 1, pen_clear: 1, pen_size: 1, pen_color: 1, pen_hue: 1,
    touching_edge: 1, key_space: 1, mouse_down: 1,
    n_1: 1, n_2: 1, n_3: 1, n_4: 1, n_5: 1, n_6: 1, n_8: 1, n_10: 2, n_15: 1, n_20: 1, n_30: 1, n_36: 1,
    n_45: 1, n_50: 1, n_60: 1, n_72: 1, n_90: 2, n_100: 2, n_120: 1, n_144: 1, n_180: 1,
    n_min10: 1, n_min90: 1, n_0_5: 1,
    t_hallo: 1, t_au: 1, t_klaar: 1,
    c_rood: 1, c_oranje: 1, c_geel: 1, c_groen: 1, c_blauw: 1, c_paars: 1, c_roze: 1, c_zwart: 1,
  };

  var SETS = {
    klassenset: { name: 'Klassenset (één groepje)', counts: CLASS_SET },
    alles: { name: 'Alles één keer', filter: function () { return true; } },
    blokken: { name: 'Alleen blokken', filter: function (d) { return !C.isTile(d); } },
    tegels: { name: 'Alleen tegels (getallen, tekst, kleuren, voorwaarden)', filter: function (d) { return C.isTile(d); } },
  };
  Object.keys(Blok.CATEGORIES).forEach(function (k) {
    if (k === 'values') return;
    SETS['cat_' + k] = { name: 'Categorie ' + Blok.CATEGORIES[k].name, filter: function (d) { return d.cat === k && d.kind !== 'bool'; } };
  });

  function setItems(key) {
    var set = SETS[key] || SETS.alles;
    var out = [];
    if (set.counts) {
      Object.keys(set.counts).forEach(function (id) {
        var d = C.byId(id);
        for (var i = 0; i < set.counts[id]; i++) out.push(d);
      });
    } else {
      C.all.forEach(function (d) { if (set.filter(d)) out.push(d); });
    }
    return out;
  }

  // Plankpakking: hoge stukken eerst, rij voor rij.
  function pack(defs, opts) {
    opts = opts || {};
    var gap = opts.gap || 4;
    var W = A4.w - 2 * A4.margin, H = A4.h - 2 * A4.margin - 14; // onderaan ruimte voor voettekst
    var items = defs.map(function (d, i) { var s = R.pieceSize(d); return { def: d, w: s.w + 1, h: s.h + 1, i: i }; });
    items.sort(function (a, b) { return b.h - a.h || b.w - a.w || a.i - b.i; });
    // te brede stukken een kwartslag draaien
    items.forEach(function (it) {
      if (it.w > W) {
        if (it.h > W || it.w > H) throw new Error(it.def.id + ' past niet op A4');
        it.rot = true;
        var t = it.w; it.w = it.h; it.h = t;
      }
    });
    items.sort(function (a, b) { return b.h - a.h || b.w - a.w || a.i - b.i; });
    // Rij voor rij: begin met het hoogste stuk en vul de ruimte ernaast op met planken van kleinere stukken.
    var pages = [[]], y = 0;
    function place(it, x, yy) {
      pages[pages.length - 1].push({ def: it.def, x: A4.margin + x, y: A4.margin + yy, rot: !!it.rot, w: it.w });
    }
    function fillRegion(x0, y0, w, h) {
      var ry = y0;
      for (;;) {
        var idx = -1;
        for (var k = 0; k < items.length; k++) {
          if (items[k].w <= w && ry + items[k].h <= y0 + h) { idx = k; break; }
        }
        if (idx < 0) return;
        var shelf = [items.splice(idx, 1)[0]], used = shelf[0].w, shelfH = shelf[0].h;
        for (var j = 0; j < items.length; j++) {
          if (used + gap + items[j].w <= w && items[j].h <= shelfH) {
            used += gap + items[j].w;
            shelf.push(items.splice(j, 1)[0]);
            j--;
          }
        }
        var x = x0;
        shelf.forEach(function (it) { place(it, x, ry); x += it.w + gap; });
        ry += shelfH + gap;
      }
    }
    while (items.length) {
      var first = items.shift();
      if (y + first.h > H) { pages.push([]); y = 0; }
      place(first, 0, y);
      fillRegion(first.w + gap, y, W - first.w - gap, first.h);
      y += first.h + gap;
    }
    return pages;
  }

  function footer(text, style) {
    var y = A4.h - A4.margin - 4;
    var col = '#5B6475';
    // Lijn van precies 50 mm om te controleren of op ware grootte is geprint.
    var ruler = '<path d="M' + A4.margin + ' ' + n(y - 6) + 'h50" stroke="' + col + '" stroke-width="0.4"/>' +
      '<path d="M' + A4.margin + ' ' + n(y - 8) + 'v4M' + (A4.margin + 50) + ' ' + n(y - 8) + 'v4" stroke="' + col + '" stroke-width="0.4"/>';
    var t1 = Blok.font.path('50 mm - klopt dit? Print op 100 %, niet "aanpassen aan pagina".', A4.margin + 54, y - 4.8, 3);
    var t2 = Blok.font.path(text, A4.margin, y + 1.5, 3);
    return style.indexOf('3d') === 0 ? '' : ruler + '<path d="' + t1 + t2 + '" fill="' + col + '"/>';
  }

  function pageSvg(placements, style, label) {
    var inner = placements.map(function (p) {
      if (!p.rot) return R.pieceInner(p.def, p.x, p.y, style);
      return '<g transform="translate(' + n(p.x + p.w) + ' ' + n(p.y) + ') rotate(90)">' + R.pieceInner(p.def, 0, 0, style) + '</g>';
    }).join('');
    inner += footer(label, style);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">' +
      '<title>' + R.esc(label) + '</title>' + inner + '</svg>';
  }

  // A4-vellen voor een set in een stijl. Geeft [{name, svg}] terug.
  function printSheets(setKey, style) {
    var pages = pack(setItems(setKey));
    var styleName = R.STYLE_NAMES[style] || style;
    return pages.map(function (pl, i) {
      var label = 'Blokkenscanner - ' + (SETS[setKey] || SETS.alles).name + ' - ' + styleName + ' - blad ' + (i + 1) + ' van ' + pages.length;
      return { name: 'blad-' + (i + 1) + '-' + style + '.svg', svg: pageSvg(pl, style, label) };
    });
  }

  // Stickervel: alleen codevierkantjes met de naam eronder, om op zelf getekende blokken te plakken.
  function stickerSheets(defs) {
    defs = defs || C.all;
    var cellW = 31, cellH = 33, cols = Math.floor((A4.w - 2 * A4.margin) / cellW), rows = Math.floor((A4.h - 2 * A4.margin - 14) / cellH);
    var per = cols * rows, pages = [];
    for (var p = 0; p * per < defs.length; p++) {
      var inner = '';
      defs.slice(p * per, (p + 1) * per).forEach(function (d, i) {
        var cx = A4.margin + (i % cols) * cellW, cy = A4.margin + Math.floor(i / cols) * cellH;
        var bx = cx + (cellW - G.MBOX) / 2;
        inner += '<rect x="' + n(cx + 0.5) + '" y="' + n(cy + 0.5) + '" width="' + (cellW - 1) + '" height="' + (cellH - 1) + '" rx="2" fill="none" stroke="#C4CAD4" stroke-width="0.25" stroke-dasharray="1 1"/>';
        inner += Blok.markers.svg(d.code, bx, cy + 1.5);
        var lines = stickerLabel(d);
        lines.forEach(function (line, li) {
          var size = 2.6, w = Blok.font.width(line, size);
          inner += '<path d="' + Blok.font.path(line, cx + (cellW - w) / 2, cy + 1.5 + G.MBOX + 3.4 + li * 3.1, size) + '" fill="#1D2433"/>';
        });
      });
      var label = 'Blokkenscanner - stickers met codevierkantjes - blad ' + (p + 1);
      inner += footer(label, 'kleur');
      pages.push({
        name: 'stickers-' + (p + 1) + '.svg',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297"><title>' + R.esc(label) + '</title>' + inner + '</svg>',
      });
    }
    return pages;
  }

  function stickerLabel(d) {
    var text = d.kind === 'value' ? (d.type === 'color' ? 'kleur ' + d.label : d.value)
      : d.label.replace(/ ▾\]/g, ']').replace('↻', 'rechtsom').replace('↺', 'linksom');
    var words = text.split(' '), lines = [''], max = 28;
    words.forEach(function (w) {
      var cur = lines[lines.length - 1];
      if (Blok.font.width((cur ? cur + ' ' : '') + w, 2.6) > max && cur) lines.push(w);
      else lines[lines.length - 1] = cur ? cur + ' ' + w : w;
    });
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(' ').slice(0, 18) + '…'];
    return lines;
  }

  function slug(s) {
    return String(s).toLowerCase()
      .replace(/[▾\[\]()<>?]/g, ' ').replace(/[ëé]/g, 'e').replace(/ï/g, 'i')
      .replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  }

  function fileName(d, style) {
    var folder = slug(Blok.CATEGORIES[d.cat].name);
    var name = d.kind === 'value' ? (d.type === 'color' ? 'kleur-' + d.label : d.type + '-' + d.value) : d.label;
    return folder + '/' + String(d.code).padStart(3, '0') + '-' + slug(name) + (style === 'kleur' ? '' : '-' + style) + '.svg';
  }

  // Alle losse stukken van een set als ZIP (elk stuk één keer). styles = ['kleur', ...]
  function zipPieces(setKey, styles) {
    var seen = {}, files = [];
    setItems(setKey).forEach(function (d) {
      if (seen[d.id]) return;
      seen[d.id] = true;
      styles.forEach(function (st) { files.push({ name: fileName(d, st), data: R.pieceSvg(d, st) }); });
    });
    files.push({ name: 'LEESMIJ.txt', data: readme(styles) });
    return Blok.zip(files);
  }

  function readme(styles) {
    return [
      'Blokkenscanner - losse blokken als SVG',
      '',
      'Alle bestanden zijn op ware grootte (millimeters). Print op 100 %.',
      'Bestandsnaam = codenummer + tekst van het blok.',
      '',
      'Stijlen in deze map: ' + styles.map(function (s) { return R.STYLE_NAMES[s] || s; }).join(', '),
      '  kleur            : zoals Scratch, om te printen (op stickerpapier of karton).',
      '  kleurplaat       : zwart-wit, leerlingen kleuren zelf in.',
      '  3D-vorm          : alleen de omtrek. Importeer in Tinkercad en maak 3 a 4 mm hoog.',
      '  3D-opdruk        : tekst, vakjes en het witte deel van het codevierkantje (0,6 mm hoog, wit filament).',
      '  3D-codevierkant  : het zwarte deel van het codevierkantje (0,6 mm hoog, zwart filament).',
      '',
      'De 3D-lagen hebben precies dezelfde afmetingen, zodat ze na importeren op elkaar passen.',
      'Heb je een printer met een kleur? Print dan de 3D-vorm en plak de kleur-versie als sticker erop.',
      '',
      'Het codevierkantje moet zwart-wit, plat en onbeschadigd blijven: de scanner leest het.',
    ].join('\r\n');
  }

  Blok.sheets = {
    SETS: SETS,
    CLASS_SET: CLASS_SET,
    setItems: setItems,
    pack: pack,
    printSheets: printSheets,
    stickerSheets: stickerSheets,
    zipPieces: zipPieces,
    fileName: fileName,
    slug: slug,
  };
})(globalThis.Blok = globalThis.Blok || {});
