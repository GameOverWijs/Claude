// Scratch-achtige uitvoerder met een virtuele klok (30 beelden per seconde).
//
// Elk script is een "draad" (generator). Een draad loopt door tot hij moet wachten of
// een lus-ronde klaar is, net als in Scratch. Omdat de klok virtueel is, kan dezelfde
// code zichtbaar (in het tempo van het scherm) of in een flits (voor de opdrachtcontrole) lopen.
(function (Blok) {
  'use strict';

  var STAGE = { w: 480, h: 360 };
  var COSTUME = { w: 58, h: 70 };
  var DEFAULT_PEN = { h: 200 / 3, s: 100, v: 100 }; // Scratch-standaard: blauw

  function toNum(v) {
    var n = Number(String(v == null ? '' : v).trim());
    return isFinite(n) ? n : 0;
  }
  function wrapDir(d) {
    d = ((d + 180) % 360 + 360) % 360 - 180;
    return d === -180 ? 180 : d;
  }
  function hsvToRgb(h, s, v) {
    h = ((h % 100) + 100) % 100 / 100 * 6; s /= 100; v /= 100;
    var i = Math.floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
    var rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
    return '#' + rgb.map(function (c) { return ('0' + Math.round(c * 255).toString(16)).slice(-2); }).join('');
  }
  function rgbToHsv(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    if (!m) return { h: DEFAULT_PEN.h, s: 100, v: 100 };
    var r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = (h / 6) * 100;
      if (h < 0) h += 100;
    }
    return { h: h, s: max ? (d / max) * 100 : 0, v: max * 100 };
  }

  function Runtime(scripts, opts) {
    opts = opts || {};
    this.scripts = scripts || [];
    this.dt = 1 / 30;
    this.slow = opts.slow || 0;
    this.onSound = opts.onSound || null;
    this.reset();
  }

  Runtime.prototype.reset = function () {
    this.time = 0;
    this.frame = 0;
    this.threads = [];
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false };
    this.sprite = { x: 0, y: 0, dir: 90, size: 100, visible: true, costume: 0, colorEffect: 0, bubble: null };
    this.pen = { down: false, h: DEFAULT_PEN.h, s: DEFAULT_PEN.s, v: DEFAULT_PEN.v, size: 1 };
    this.penLines = [];
    this.log = { says: [], sounds: [], costumes: [], edge: 0, fenced: 0, positions: [], moved: false, looks: 0, clears: 0 };
    this.stoppedAll = false;
  };

  Runtime.prototype.penColor = function () {
    return hsvToRgb(this.pen.h, this.pen.s, this.pen.v);
  };

  // --- sprite-meetkunde ---
  Runtime.prototype.bounds = function () {
    var s = this.sprite, k = s.size / 100;
    var w = COSTUME.w * k, h = COSTUME.h * k;
    var a = ((90 - s.dir) * Math.PI) / 180;
    var bw = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
    var bh = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
    return { left: s.x - bw / 2, right: s.x + bw / 2, top: s.y + bh / 2, bottom: s.y - bh / 2, w: bw, h: bh };
  };

  Runtime.prototype.touchingEdge = function () {
    var b = this.bounds();
    return b.left < -STAGE.w / 2 || b.right > STAGE.w / 2 || b.top > STAGE.h / 2 || b.bottom < -STAGE.h / 2;
  };

  // Scratch houdt minstens een stukje van de sprite in beeld.
  Runtime.prototype.fence = function (x, y) {
    var s = this.sprite, ox = s.x, oy = s.y;
    s.x = x; s.y = y;
    var b = this.bounds();
    s.x = ox; s.y = oy;
    var inset = Math.floor(Math.min(15, Math.min(b.w, b.h) / 2));
    var L = -STAGE.w / 2 + inset, R = STAGE.w / 2 - inset, T = STAGE.h / 2 - inset, B = -STAGE.h / 2 + inset;
    var dx = 0, dy = 0;
    if (b.right < L) dx = L - b.right;
    if (b.left > R) dx = R - b.left;
    if (b.top < B) dy = B - b.top;
    if (b.bottom > T) dy = T - b.bottom;
    if (dx || dy) this.log.fenced++;
    return { x: x + dx, y: y + dy };
  };

  Runtime.prototype.setXY = function (x, y) {
    var s = this.sprite, p = this.fence(x, y);
    if (this.pen.down && (p.x !== s.x || p.y !== s.y)) {
      this.penLines.push({ x1: s.x, y1: s.y, x2: p.x, y2: p.y, color: this.penColor(), size: this.pen.size, t: this.time });
    }
    if (p.x !== s.x || p.y !== s.y) this.log.moved = true;
    s.x = p.x;
    s.y = p.y;
    if (this.touchingEdge()) this.log.edge++;
  };

  Runtime.prototype.bounce = function () {
    var b = this.bounds();
    var dist = {
      left: Math.max(0, STAGE.w / 2 + b.left),
      top: Math.max(0, STAGE.h / 2 - b.top),
      right: Math.max(0, STAGE.w / 2 - b.right),
      bottom: Math.max(0, STAGE.h / 2 + b.bottom),
    };
    var near = null, min = Infinity;
    Object.keys(dist).forEach(function (k) { if (dist[k] < min) { min = dist[k]; near = k; } });
    if (min > 0) return;
    var rad = ((90 - this.sprite.dir) * Math.PI) / 180, dx = Math.cos(rad), dy = Math.sin(rad);
    if (near === 'left') dx = Math.max(0.2, Math.abs(dx));
    if (near === 'top') dy = Math.min(-0.2, -Math.abs(dy));
    if (near === 'right') dx = Math.min(-0.2, -Math.abs(dx));
    if (near === 'bottom') dy = Math.max(0.2, Math.abs(dy));
    this.sprite.dir = wrapDir(90 - (Math.atan2(dy, dx) * 180) / Math.PI);
    var p = this.fence(this.sprite.x, this.sprite.y);
    this.setXY(p.x, p.y);
  };

  // --- voorwaarden ---
  Runtime.prototype.evalCond = function (c) {
    if (!c) return false;
    var d = c.def;
    if (d.id === 'touching_edge') return this.touchingEdge();
    if (d.id === 'touching_mouse') {
      var b = this.bounds();
      return this.mouse.x >= b.left && this.mouse.x <= b.right && this.mouse.y >= b.bottom && this.mouse.y <= b.top;
    }
    if (d.id === 'mouse_down') return !!this.mouse.down;
    if (d.key) return !!this.keys[d.key];
    return false;
  };

  // --- uitvoeren ---
  function arg(nd, i) { return Blok.program.argValue(nd, i); }

  function* waitSecs(rt, secs) {
    var until = rt.time + Math.max(0, secs);
    do { yield; } while (rt.time < until - 1e-9);
  }

  function* runList(rt, list, th) {
    for (var i = 0; i < (list || []).length; i++) {
      if (rt.stoppedAll || th.stopped) return;
      var nd = list[i];
      th.current = nd.uid;
      yield* runNode(rt, nd, th);
      if (rt.slow && nd.def.kind !== 'c') yield* waitSecs(rt, rt.slow);
    }
  }

  function* runNode(rt, nd, th) {
    var s = rt.sprite, id = nd.def.id;
    switch (id) {
      case 'move': {
        var steps = toNum(arg(nd, 0)), rad = ((90 - s.dir) * Math.PI) / 180;
        rt.setXY(s.x + steps * Math.cos(rad), s.y + steps * Math.sin(rad));
        break;
      }
      case 'turn_right': s.dir = wrapDir(s.dir + toNum(arg(nd, 0))); break;
      case 'turn_left': s.dir = wrapDir(s.dir - toNum(arg(nd, 0))); break;
      case 'goto_xy': rt.setXY(toNum(arg(nd, 0)), toNum(arg(nd, 1))); break;
      case 'glide_xy': {
        var secs = toNum(arg(nd, 0)), sx = s.x, sy = s.y, tx = toNum(arg(nd, 1)), ty = toNum(arg(nd, 2)), t0 = rt.time;
        if (secs <= 0) { rt.setXY(tx, ty); break; }
        while (rt.time - t0 < secs) {
          var f = (rt.time - t0) / secs;
          rt.setXY(sx + (tx - sx) * f, sy + (ty - sy) * f);
          yield;
        }
        rt.setXY(tx, ty);
        break;
      }
      case 'point_dir': s.dir = wrapDir(toNum(arg(nd, 0))); break;
      case 'change_x': rt.setXY(s.x + toNum(arg(nd, 0)), s.y); break;
      case 'set_x': rt.setXY(toNum(arg(nd, 0)), s.y); break;
      case 'change_y': rt.setXY(s.x, s.y + toNum(arg(nd, 0))); break;
      case 'set_y': rt.setXY(s.x, toNum(arg(nd, 0))); break;
      case 'bounce': rt.bounce(); break;

      case 'say':
      case 'say_secs':
      case 'think_secs': {
        var text = String(arg(nd, 0));
        var kind = id === 'think_secs' ? 'think' : 'say';
        var bubble = { kind: kind, text: text };
        s.bubble = text === '' ? null : bubble;
        rt.log.says.push({ t: rt.time, text: text, kind: kind });
        if (id !== 'say') {
          yield* waitSecs(rt, toNum(arg(nd, 1)));
          if (s.bubble === bubble) s.bubble = null;
        }
        break;
      }
      case 'next_costume': s.costume = (s.costume + 1) % 2; rt.log.costumes.push(rt.time); rt.log.looks++; break;
      case 'change_size': s.size = Math.max(5, Math.min(500, s.size + toNum(arg(nd, 0)))); rt.log.looks++; break;
      case 'set_size': s.size = Math.max(5, Math.min(500, toNum(arg(nd, 0)))); rt.log.looks++; break;
      case 'change_color_effect': s.colorEffect += toNum(arg(nd, 0)); rt.log.looks++; break;
      case 'clear_effects': s.colorEffect = 0; break;
      case 'show': s.visible = true; rt.log.looks++; break;
      case 'hide': s.visible = false; rt.log.looks++; break;

      case 'play_sound':
      case 'play_sound_wait':
        rt.log.sounds.push(rt.time);
        if (rt.onSound) rt.onSound(nd.def.sound);
        if (id === 'play_sound_wait') yield* waitSecs(rt, 0.4);
        break;

      case 'wait': yield* waitSecs(rt, toNum(arg(nd, 0))); break;
      case 'repeat': {
        var times = Math.round(toNum(arg(nd, 0)));
        for (var k = 0; k < times; k++) {
          yield* runList(rt, nd.body, th);
          if (rt.stoppedAll || th.stopped) return;
          yield;
        }
        break;
      }
      case 'forever':
        for (;;) {
          yield* runList(rt, nd.body, th);
          if (rt.stoppedAll || th.stopped) return;
          yield;
        }
        break; // niet bereikbaar
      case 'if':
        if (rt.evalCond(nd.cond)) yield* runList(rt, nd.body, th);
        else if (nd.elseBody) yield* runList(rt, nd.elseBody, th);
        break;
      case 'repeat_until':
        while (!rt.evalCond(nd.cond)) {
          yield* runList(rt, nd.body, th);
          if (rt.stoppedAll || th.stopped) return;
          yield;
        }
        break;
      case 'wait_until':
        while (!rt.evalCond(nd.cond)) yield;
        break;
      case 'stop_all': rt.stopAll(); return;

      case 'pen_down':
        rt.pen.down = true;
        rt.penLines.push({ x1: s.x, y1: s.y, x2: s.x, y2: s.y, color: rt.penColor(), size: rt.pen.size, t: rt.time, dot: true });
        break;
      case 'pen_up': rt.pen.down = false; break;
      case 'pen_clear': rt.penLines = []; rt.log.clears++; break;
      case 'pen_size': rt.pen.size = Math.max(1, Math.min(1200, toNum(arg(nd, 0)))); break;
      case 'pen_color': {
        var hsv = rgbToHsv(arg(nd, 0));
        rt.pen.h = hsv.h; rt.pen.s = hsv.s; rt.pen.v = hsv.v;
        break;
      }
      case 'pen_hue': rt.pen.h = (((rt.pen.h + toNum(arg(nd, 0))) % 100) + 100) % 100; break;
      default:
        break;
    }
  }

  Runtime.prototype.startScript = function (script) {
    // Scratch herstart een script dat al loopt
    this.threads = this.threads.filter(function (t) { return t.script !== script; });
    var th = { script: script, current: script.hat && script.hat.uid, stopped: false, done: false };
    var rt = this;
    th.gen = (function* () { yield* runList(rt, script.body, th); })();
    this.threads.push(th);
  };

  Runtime.prototype.trigger = function (event, key) {
    var rt = this;
    this.stoppedAll = false;
    this.scripts.forEach(function (s) {
      if (!s.hat) return;
      var d = s.hat.def;
      if (d.event === event && (event !== 'key' || d.key === key)) rt.startScript(s);
    });
  };

  Runtime.prototype.greenFlag = function () { this.trigger('flag'); };

  Runtime.prototype.keyDown = function (key) {
    var wasDown = this.keys[key];
    this.keys[key] = true;
    if (!wasDown) this.trigger('key', key);
  };
  Runtime.prototype.keyUp = function (key) { this.keys[key] = false; };

  Runtime.prototype.click = function (x, y) {
    var b = this.bounds();
    if (this.sprite.visible && x >= b.left && x <= b.right && y >= b.bottom && y <= b.top) this.trigger('click');
  };

  Runtime.prototype.stopAll = function () {
    this.stoppedAll = true;
    this.threads.forEach(function (t) { t.stopped = true; });
  };

  Runtime.prototype.running = function () {
    return this.threads.some(function (t) { return !t.done && !t.stopped; });
  };

  Runtime.prototype.activeUids = function () {
    return this.threads.filter(function (t) { return !t.done && !t.stopped; }).map(function (t) { return t.current; });
  };

  Runtime.prototype.step = function () {
    var list = this.threads.slice();
    for (var i = 0; i < list.length; i++) {
      var th = list[i];
      if (th.done || th.stopped) continue;
      var r = th.gen.next();
      if (r.done) th.done = true;
    }
    this.threads = this.threads.filter(function (t) { return !t.done && !t.stopped; });
    this.time += this.dt;
    this.frame++;
    if (this.frame % 3 === 0) this.log.positions.push({ t: this.time, x: this.sprite.x, y: this.sprite.y, dir: this.sprite.dir });
  };

  // Laat de groene-vlag-scripts in een flits lopen (voor controles). Geeft het logboek terug.
  Runtime.prototype.runHeadless = function (seconds) {
    this.greenFlag();
    var frames = Math.round((seconds || 10) / this.dt);
    for (var f = 0; f < frames && this.running(); f++) this.step();
    return {
      finished: !this.running(),
      time: this.time,
      penLines: this.penLines,
      log: this.log,
      sprite: this.sprite,
    };
  };

  Blok.Runtime = Runtime;
  Blok.runtimeUtil = { toNum: toNum, wrapDir: wrapDir, hsvToRgb: hsvToRgb, rgbToHsv: rgbToHsv, STAGE: STAGE, COSTUME: COSTUME };
})(globalThis.Blok = globalThis.Blok || {});
