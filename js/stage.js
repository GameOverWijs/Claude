// Het speelveld (480 x 360, zoals in Scratch) met Robo, de penlijnen en tekstballonnen.
(function (Blok) {
  'use strict';

  var W = 480, H = 360;

  function Stage(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.grid = opts.grid !== false;
    this.penCanvas = document.createElement('canvas');
    this.drawnLines = 0;
    this.lastLines = null;
    this.resize();
  }

  Stage.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var cssW = this.canvas.clientWidth || W;
    var scale = (cssW / W) * dpr;
    this.scale = scale;
    this.canvas.width = Math.round(W * scale);
    this.canvas.height = Math.round(H * scale);
    this.penCanvas.width = this.canvas.width;
    this.penCanvas.height = this.canvas.height;
    this.drawnLines = 0;
    this.lastLines = null;
  };

  // Scratch-coördinaten -> canvas (in eenheden van het speelveld, schaal via transform)
  function sx(x) { return x + W / 2; }
  function sy(y) { return H / 2 - y; }

  Stage.prototype.toStage = function (clientX, clientY) {
    var r = this.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * W - W / 2, y: H / 2 - ((clientY - r.top) / r.height) * H };
  };

  Stage.prototype.drawBackground = function (ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    if (!this.grid) return;
    ctx.lineWidth = 1 / this.scale;
    for (var x = -240; x <= 240; x += 40) {
      ctx.strokeStyle = x === 0 ? '#C9D2DC' : '#EEF1F4';
      ctx.beginPath(); ctx.moveTo(sx(x), 0); ctx.lineTo(sx(x), H); ctx.stroke();
    }
    for (var y = -160; y <= 160; y += 40) {
      ctx.strokeStyle = y === 0 ? '#C9D2DC' : '#EEF1F4';
      ctx.beginPath(); ctx.moveTo(0, sy(y)); ctx.lineTo(W, sy(y)); ctx.stroke();
    }
    ctx.fillStyle = '#9AA5B1';
    ctx.font = '600 9px system-ui, sans-serif';
    ctx.fillText('x: 240', W - 34, sy(0) - 4);
    ctx.fillText('x: -240', 3, sy(0) - 4);
    ctx.fillText('y: 180', sx(0) + 4, 11);
    ctx.fillText('y: -180', sx(0) + 4, H - 4);
  };

  Stage.prototype.drawPen = function (lines) {
    var pc = this.penCanvas.getContext('2d');
    if (lines !== this.lastLines || lines.length < this.drawnLines) {
      pc.setTransform(1, 0, 0, 1, 0, 0);
      pc.clearRect(0, 0, this.penCanvas.width, this.penCanvas.height);
      this.drawnLines = 0;
      this.lastLines = lines;
    }
    pc.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    pc.lineCap = 'round';
    pc.lineJoin = 'round';
    for (var i = this.drawnLines; i < lines.length; i++) {
      var l = lines[i];
      pc.strokeStyle = l.color;
      pc.fillStyle = l.color;
      pc.lineWidth = Math.max(l.size, 1);
      if (l.dot) {
        pc.beginPath();
        pc.arc(sx(l.x1), sy(l.y1), Math.max(l.size, 1) / 2, 0, Math.PI * 2);
        pc.fill();
      } else {
        pc.beginPath();
        pc.moveTo(sx(l.x1), sy(l.y1));
        pc.lineTo(sx(l.x2), sy(l.y2));
        pc.stroke();
      }
    }
    this.drawnLines = lines.length;
  };

  // Robo: een vriendelijke robot die naar rechts kijkt (richting 90). Uiterlijk 0 of 1.
  function drawRobo(ctx, costume) {
    var round = function (x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    ctx.lineJoin = 'round';
    // armen
    ctx.strokeStyle = '#0E7C73';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (costume === 1) {
      ctx.moveTo(-22, 2); ctx.lineTo(-31, -14);
      ctx.moveTo(22, 2); ctx.lineTo(31, -14);
    } else {
      ctx.moveTo(-22, 6); ctx.lineTo(-30, 18);
      ctx.moveTo(22, 6); ctx.lineTo(30, 18);
    }
    ctx.stroke();
    // antenne
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, -32); ctx.stroke();
    ctx.fillStyle = '#FFBF00';
    ctx.beginPath(); ctx.arc(0, -34, 4.5, 0, Math.PI * 2); ctx.fill();
    // lijf
    round(-23, -25, 46, 50, 11);
    ctx.fillStyle = '#13A89E';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0E7C73';
    ctx.stroke();
    // gezicht
    round(-16, -18, 32, 22, 7);
    ctx.fillStyle = '#E8FBF8';
    ctx.fill();
    ctx.fillStyle = '#1D2433';
    if (costume === 1) {
      ctx.lineWidth = 2.4; ctx.strokeStyle = '#1D2433';
      ctx.beginPath(); ctx.arc(-6, -6, 3.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(8, -6, 3.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(-5, -8, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(9, -8, 3.2, 0, Math.PI * 2); ctx.fill();
    }
    // mond
    ctx.lineWidth = 2; ctx.strokeStyle = '#1D2433';
    ctx.beginPath(); ctx.arc(2, -3, 5, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    // wielen
    ctx.fillStyle = '#1D2433';
    ctx.beginPath(); ctx.arc(-12, 27, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, 27, 5, 0, Math.PI * 2); ctx.fill();
    // neus: laat zien welke kant Robo op kijkt
    ctx.fillStyle = '#FF8C1A';
    ctx.beginPath(); ctx.moveTo(23, 4); ctx.lineTo(33, 10); ctx.lineTo(23, 16); ctx.closePath(); ctx.fill();
  }

  function wrapText(ctx, text, max) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines.slice(0, 6);
  }

  Stage.prototype.drawBubble = function (ctx, s, b) {
    ctx.font = '700 13px Nunito, system-ui, sans-serif';
    var lines = wrapText(ctx, b.text, 150);
    var tw = Math.max.apply(null, lines.map(function (l) { return ctx.measureText(l).width; }));
    var w = Math.max(tw + 20, 40), h = lines.length * 16 + 12;
    var bx = sx(s.x) + 22, by = sy(s.y) - 40 - h;
    if (bx + w > W - 2) bx = sx(s.x) - 22 - w;
    bx = Math.max(2, bx);
    by = Math.max(2, by);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#A7B0BE';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    var r = 10;
    ctx.moveTo(bx + r, by);
    ctx.arcTo(bx + w, by, bx + w, by + h, r);
    ctx.arcTo(bx + w, by + h, bx, by + h, r);
    ctx.arcTo(bx, by + h, bx, by, r);
    ctx.arcTo(bx, by, bx + w, by, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    var tx = Math.min(Math.max(sx(s.x), bx + 14), bx + w - 14);
    if (b.kind === 'think') {
      [[tx - 4, by + h + 7, 4], [tx - 9, by + h + 15, 2.5]].forEach(function (c) {
        ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
    } else {
      ctx.beginPath();
      ctx.moveTo(tx - 8, by + h - 1);
      ctx.lineTo(tx - 12, by + h + 12);
      ctx.lineTo(tx + 4, by + h - 1);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tx - 8, by + h); ctx.lineTo(tx - 12, by + h + 12); ctx.lineTo(tx + 4, by + h);
      ctx.stroke();
    }
    ctx.fillStyle = '#1D2433';
    lines.forEach(function (l, i) { ctx.fillText(l, bx + 10, by + 20 + i * 16); });
  };

  Stage.prototype.render = function (rt) {
    var ctx = this.canvas.getContext('2d');
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.drawBackground(ctx);
    if (rt) {
      this.drawPen(rt.penLines);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.penCanvas, 0, 0);
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      var s = rt.sprite;
      if (s.visible) {
        ctx.save();
        ctx.translate(sx(s.x), sy(s.y));
        ctx.rotate(((s.dir - 90) * Math.PI) / 180);
        ctx.scale(s.size / 100, s.size / 100);
        if (s.colorEffect) ctx.filter = 'hue-rotate(' + Math.round((s.colorEffect * 1.8) % 360) + 'deg)';
        drawRobo(ctx, s.costume);
        ctx.restore();
        if (s.bubble) this.drawBubble(ctx, s, s.bubble);
      }
    }
  };

  Blok.Stage = Stage;
  Blok.drawRobo = drawRobo;
})(globalThis.Blok = globalThis.Blok || {});
