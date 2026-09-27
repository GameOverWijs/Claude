// Codevierkantjes (ArUco-markers, 5x5 bits met zwarte rand).
//
// De 200 codes hieronder zijn eenmalig gekozen uit het OpenCV-woordenboek ARUCO_5X5_1000:
// elke twee codes verschillen in minstens 7 van de 25 vakjes, ook als je er een een kwart,
// half of driekwart slag draait. Een foto met 1 tot 3 verkeerd gelezen vakjes geeft dus nog
// steeds het goede blok. De volgorde ligt vast: nummer n in de catalogus is altijd code n,
// anders passen al geprinte blokken niet meer.
(function (Blok) {
  'use strict';

  var CODES = [
    0x145b2bc, 0x1c06e6, 0x1af0edd, 0x10395f7, 0x1aeb524, 0x1d4082d, 0xd3d7ec, 0xe2146b, 0x10d6132, 0x1313fa5,
    0x13cee03, 0x1a2dac0, 0x1e62b11, 0x5e7166, 0x1fcfca8, 0x51e37f, 0x97a758, 0xbea26f, 0xf64dc4, 0x1061de8,
    0x12dda75, 0x150e440, 0x16b0ca1, 0xba12de, 0x19cd023, 0x1a59972, 0x1c3ce8b, 0x224246, 0x3b9672, 0x24223b,
    0x27376e, 0x368873, 0x40d0ce, 0x4aaac8, 0x4643ba, 0x7a6fea, 0x998aac, 0x82d101, 0x9aad1d, 0x863c72,
    0xad2825, 0xa52f9e, 0xd849f7, 0xc309d9, 0xda7e31, 0xe9627a, 0xe9b997, 0xf94806, 0xf59125, 0xf6b7d7,
    0x11b58e4, 0x11ad279, 0x11e380b, 0x1169445, 0x12ffb4a, 0x158cb8d, 0x15987f0, 0x1422fdf, 0x14e1227, 0x156df22,
    0x173dbf1, 0x164c93c, 0x17cbb86, 0x1880a87, 0x19147dd, 0x184eb8a, 0x18d85ad, 0x1b2cda9, 0x1babd73, 0x1e9d432,
    0x1e76528, 0xf5740a, 0x1b11a53, 0x18ce65, 0x2ab219, 0x98e981, 0xa8061c, 0x141a158, 0x185314c, 0x196d12c,
    0x1fad3a2, 0x922b5, 0x19bce0, 0xb547c, 0x2c76f, 0x132289, 0x12d2a7, 0xc4b43, 0x67bc5, 0xfaa0d,
    0x1f1f54, 0x38e879, 0x323b23, 0x2c3647, 0x2da51b, 0x2e9d8d, 0x27c562, 0x3efdf5, 0x521ee0, 0x448efd,
    0x542f81, 0x55f6c9, 0x47e008, 0x4f9bf8, 0x46d558, 0x5ef65e, 0x692188, 0x6013ad, 0x68bc21, 0x72a5d0,
    0x6400e2, 0x6dce3a, 0x891409, 0x89d9fd, 0x8a3ee5, 0x8a952a, 0x8c277d, 0x9d0612, 0x8ee533, 0x9f04fb,
    0xb86f1b, 0xb1faee, 0xa36ff0, 0xb275f6, 0xb53332, 0xa603e1, 0xa798cf, 0xa6dc02, 0xb64b5f, 0xbfab99,
    0xcacc85, 0xcb8f5e, 0xcc6ea2, 0xce198b, 0xe12cbb, 0xf8c701, 0xf35752, 0xe47a8c, 0xe7cb65, 0x1084d18,
    0x113e202, 0x10d5dd3, 0x11447f3, 0x1286ae3, 0x1388a36, 0x12a3f49, 0x12d1b20, 0x12e4d6e, 0x1366ece, 0x1378dc1,
    0x14134dd, 0x148a50d, 0x151610b, 0x15b3684, 0x15fe0b1, 0x1605cc7, 0x1601e30, 0x179d565, 0x17d8899, 0x16705f4,
    0x166b079, 0x17e8bdc, 0x17eac67, 0x18875e0, 0x199d306, 0x18a6601, 0x19a44c7, 0x18c1115, 0x18d287e, 0x195dd09,
    0x19f4e25, 0x196c3c5, 0x1a005d2, 0x1b96e8c, 0x1b31709, 0x1b39d64, 0x1a53281, 0x1a5a22e, 0x1bcb4dd, 0x1b48e85,
    0x1b67820, 0x1b71f92, 0x1d031c7, 0x1ca38de, 0x1c35c71, 0x1db72f7, 0x1d3c064, 0x1d6ba18, 0x1dff33a, 0x1f02202,
    0x1f00fa6, 0x1ec0441, 0x1ec36bf, 0x1fd6bda, 0x1f46671, 0x1f49583, 0x1ee5ee1, 0x1fe3129, 0x1f746bc, 0x1cff5c5,
  ];

  var BITS = 5;          // databits per zijde
  var SIZE = BITS + 2;   // vakjes per zijde inclusief zwarte rand

  // Vakjes van code n als 5x5 array; 1 = wit, 0 = zwart (zelfde conventie als js-aruco2).
  function bits(n) {
    var s = CODES[n].toString(2);
    while (s.length < BITS * BITS) s = '0' + s;
    var rows = [];
    for (var r = 0; r < BITS; r++) {
      rows.push(s.slice(r * BITS, r * BITS + BITS).split('').map(Number));
    }
    return rows;
  }

  // Omtrek van een verzameling vakjes als lijst gesloten lussen (hoekpunten in vakjes).
  // grid[r][c] true = gevuld. Diagonaal rakende vakjes geven aparte lussen.
  function traceCells(grid) {
    var rows = grid.length, cols = grid[0].length;
    var filled = function (r, c) { return r >= 0 && c >= 0 && r < rows && c < cols && grid[r][c]; };
    var edges = {};
    var add = function (x1, y1, x2, y2) {
      var k = x1 + ',' + y1;
      (edges[k] = edges[k] || []).push([x2, y2]);
    };
    // Randen met de klok mee rond gevulde vakjes (y omlaag).
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (!grid[r][c]) continue;
        if (!filled(r - 1, c)) add(c, r, c + 1, r);
        if (!filled(r, c + 1)) add(c + 1, r, c + 1, r + 1);
        if (!filled(r + 1, c)) add(c + 1, r + 1, c, r + 1);
        if (!filled(r, c - 1)) add(c, r + 1, c, r);
      }
    }
    var loops = [];
    Object.keys(edges).forEach(function (start) {
      while (edges[start] && edges[start].length) {
        var loop = [];
        var cur = start;
        var guard = 0;
        while (edges[cur] && edges[cur].length && guard++ < 1000) {
          var p = cur.split(',').map(Number);
          loop.push(p);
          var next = edges[cur].shift();
          cur = next[0] + ',' + next[1];
          if (cur === start) break;
        }
        loops.push(simplify(loop));
      }
    });
    return loops;
  }

  // Haal punten weg die op een rechte lijn liggen.
  function simplify(loop) {
    var out = [];
    for (var i = 0; i < loop.length; i++) {
      var a = loop[(i - 1 + loop.length) % loop.length], b = loop[i], c = loop[(i + 1) % loop.length];
      var cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (cross !== 0) out.push(b);
    }
    return out;
  }

  function f(v) { return +(+v).toFixed(3); }

  function loopsToPath(loops, x0, y0, cell) {
    return loops.map(function (loop) {
      return 'M' + loop.map(function (p) { return f(x0 + p[0] * cell) + ' ' + f(y0 + p[1] * cell); }).join('L') + 'Z';
    }).join('');
  }

  // Pad-data voor de witte en de zwarte vakjes binnen het zwarte vierkant (inclusief rand).
  function cellPaths(n, x0, y0, cell) {
    var b = bits(n);
    var white = [], black = [];
    for (var r = 0; r < SIZE; r++) {
      white.push([]); black.push([]);
      for (var c = 0; c < SIZE; c++) {
        var inner = r > 0 && c > 0 && r < SIZE - 1 && c < SIZE - 1;
        var isWhite = inner && b[r - 1][c - 1] === 1;
        white[r].push(isWhite);
        black[r].push(!isWhite);
      }
    }
    return {
      white: loopsToPath(traceCells(white), x0, y0, cell),
      black: loopsToPath(traceCells(black), x0, y0, cell),
    };
  }

  // SVG-fragment van een codevierkantje. (x, y) = linkerbovenhoek van het witte kader.
  // opts.cell = vakjesgrootte in mm, opts.quiet = witte rand in vakjes (standaard 1),
  // opts.mode = 'print' (wit kader + zwart vlak + witte vakjes) of 'black' (alleen zwart, voor 3D).
  function svg(n, x, y, opts) {
    opts = opts || {};
    var cell = opts.cell || Blok.GEOM.CELL;
    var quiet = opts.quiet == null ? 1 : opts.quiet;
    var box = (SIZE + 2 * quiet) * cell;
    var x0 = x + quiet * cell, y0 = y + quiet * cell;
    var p = cellPaths(n, x0, y0, cell);
    if (opts.mode === 'black') {
      return '<path d="' + p.black + '" fill="#000"/>';
    }
    var r = opts.radius == null ? cell * 0.5 : opts.radius;
    return '<g class="marker" data-code="' + n + '">' +
      '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(box) + '" height="' + f(box) + '" rx="' + f(r) + '" fill="#fff"/>' +
      '<rect x="' + f(x0) + '" y="' + f(y0) + '" width="' + f(SIZE * cell) + '" height="' + f(SIZE * cell) + '" fill="#000"/>' +
      '<path d="' + p.white + '" fill="#fff"/>' +
      '</g>';
  }

  // Registreer het woordenboek bij js-aruco2 (alleen in de browser beschikbaar).
  // maxErrors = hoeveel verkeerd gelezen vakjes nog gecorrigeerd mogen worden (0..3).
  function createDetector(maxErrors) {
    var AR = globalThis.AR;
    if (!AR) throw new Error('js-aruco2 is niet geladen');
    AR.DICTIONARIES.BLOKKENSCANNER = { nBits: BITS * BITS, tau: 7, codeList: CODES };
    return new AR.Detector({
      dictionaryName: 'BLOKKENSCANNER',
      maxHammingDistance: (maxErrors == null ? 2 : maxErrors) + 1,
    });
  }

  Blok.markers = {
    CODES: CODES,
    BITS: BITS,
    SIZE: SIZE,
    count: CODES.length,
    bits: bits,
    svg: svg,
    cellPaths: cellPaths,
    traceCells: traceCells,
    createDetector: createDetector,
  };
})(globalThis.Blok = globalThis.Blok || {});
