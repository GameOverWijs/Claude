// Voorbeeldprogramma's en nep-foto's, zodat je de scanner kunt proberen zonder eerst te printen.
(function (Blok) {
  'use strict';

  var EXAMPLES = [
    {
      id: 'vierkant',
      name: 'Vierkant tekenen',
      spec: [['when_flag', 'pen_clear', 'pen_down', { id: 'repeat', args: ['4'], body: [['move', '100'], ['turn_right', '90']] }]],
    },
    {
      id: 'vergeten-einde',
      name: 'Driehoek met een fout (einde-stuk vergeten)',
      // Het einde-stuk ontbreekt bewust; 'dropEnd' haalt het weg uit de opstelling.
      spec: [['when_flag', 'pen_down', { id: 'repeat', args: ['3'], body: [['move', '100'], ['turn_left', '120']] }, 'pen_up']],
      dropEnd: true,
    },
    {
      id: 'heen-en-weer',
      name: 'Heen en weer lopen',
      spec: [['when_flag', { id: 'forever', body: [['move', '10'], 'bounce'] }]],
    },
    {
      id: 'als-dan',
      name: 'Au! bij de rand',
      spec: [['when_flag', ['point_dir', '90'], { id: 'repeat_until', cond: 'touching_edge', body: [['move', '10']] }, ['say_secs', 'Au!', '2']]],
    },
  ];

  function scriptsOf(example) {
    return example.spec.map(function (list) { return Blok.program.script(list); });
  }

  // SVG van een opstelling zoals op tafel, met een tafelblad erachter.
  function sceneSvg(scripts, opts) {
    opts = opts || {};
    var arr = Blok.render.arrangement(scripts, { style: opts.style || 'kleur', dropLastEnd: opts.dropEnd });
    var inner = arr.inner;
    var bg = '<rect x="0" y="0" width="' + arr.w + '" height="' + arr.h + '" fill="' + (opts.table || '#D9CBB4') + '"/>';
    return { svg: Blok.render.wrapSvg(bg + inner, arr.w, arr.h, 'voorbeeld', { margin: 0 }), w: arr.w, h: arr.h };
  }

  function loadImage(svg) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('SVG kon niet getekend worden')); };
      img.src = url;
    });
  }

  // Nep-foto: opstelling op tafel, wat gedraaid, onscherp, met ruis en een schaduw.
  // opts: pxPerMm, rotate (graden), blur (px), noise (0..1), shade (0..1)
  function photo(scripts, opts) {
    opts = opts || {};
    var scene = sceneSvg(scripts, opts);
    var k = opts.pxPerMm || 4;
    return loadImage(scene.svg).then(function (img) {
      var w = Math.round(scene.w * k), h = Math.round(scene.h * k);
      var rot = ((opts.rotate || 0) * Math.PI) / 180;
      var W = Math.ceil(Math.abs(w * Math.cos(rot)) + Math.abs(h * Math.sin(rot))) + 80;
      var H = Math.ceil(Math.abs(w * Math.sin(rot)) + Math.abs(h * Math.cos(rot))) + 80;
      var c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      var ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = opts.table || '#D9CBB4';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(rot);
      if (opts.skew) ctx.transform(1, opts.skew, 0, 1, 0, 0);
      if (opts.blur) ctx.filter = 'blur(' + opts.blur + 'px)';
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
      ctx.filter = 'none';
      if (opts.shade) {
        var g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,' + opts.shade + ')');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      if (opts.noise) {
        var data = ctx.getImageData(0, 0, W, H), d = data.data, amp = opts.noise * 255;
        var seed = 12345;
        var rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
        for (var i = 0; i < d.length; i += 4) {
          var nz = (rnd() - 0.5) * amp;
          d[i] += nz; d[i + 1] += nz; d[i + 2] += nz;
        }
        ctx.putImageData(data, 0, 0);
      }
      return c;
    });
  }

  Blok.samples = { EXAMPLES: EXAMPLES, scriptsOf: scriptsOf, sceneSvg: sceneSvg, photo: photo, loadImage: loadImage };
})(globalThis.Blok = globalThis.Blok || {});
