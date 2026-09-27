// Opdrachten: controleert of de code doet wat de opdracht vraagt, door hem in een flits
// uit te voeren en te kijken wat Robo tekent, zegt of doet.
(function (Blok) {
  'use strict';

  function r(v) { return Math.round(v); }
  function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
  function heading(s) { return (Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180) / Math.PI; }
  function turn(a, b) {
    var d = heading(b) - heading(a);
    while (d > 180) d -= 360;
    while (d <= -180) d += 360;
    return d;
  }

  // Getekende lijnen samenvoegen tot rechte zijden in één doorlopend pad.
  function penPath(lines) {
    var segs = lines.filter(function (l) { return !l.dot && dist(l.x1, l.y1, l.x2, l.y2) > 0.5; });
    var out = [];
    segs.forEach(function (l) {
      var last = out[out.length - 1];
      if (last && dist(last.x2, last.y2, l.x1, l.y1) < 0.6 && Math.abs(turn(last, l)) < 1) {
        last.x2 = l.x2; last.y2 = l.y2;
      } else {
        out.push({ x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 });
      }
    });
    // alleen het eerste doorlopende stuk
    var path = [];
    for (var i = 0; i < out.length; i++) {
      if (i && dist(out[i - 1].x2, out[i - 1].y2, out[i].x1, out[i].y1) > 0.6) break;
      path.push(out[i]);
    }
    return { all: out, path: path };
  }

  function len(s) { return dist(s.x1, s.y1, s.x2, s.y2); }

  function nothingDrawn(res) {
    if (res.log.moved) return 'Robo liep wel, maar er is niets getekend. Zet "pen neer" boven de beweegblokken.';
    return 'Er is niets getekend en Robo is niet bewogen. Staan de blokken onder de groene vlag?';
  }

  // Regelmatige veelhoek (of ster): n zijden, bij elke hoek 'turnDeg' graden draaien.
  function polygonCheck(n, turnDeg, name, lid) {
    return function (res) {
      var p = penPath(res.penLines).path;
      if (!p.length) return { ok: false, msg: nothingDrawn(res) };
      var sx = p[0].x1, sy = p[0].y1, loop = null;
      for (var i = 0; i < p.length; i++) {
        if (dist(p[i].x2, p[i].y2, sx, sy) < 2) { loop = p.slice(0, i + 1); break; }
      }
      var turns = [];
      var seq = loop || p;
      for (var k = 1; k < seq.length; k++) turns.push(turn(seq[k - 1], seq[k]));
      if (loop) turns.push(turn(loop[loop.length - 1], loop[0]));
      var avgTurn = turns.length ? turns.reduce(function (a, b) { return a + Math.abs(b); }, 0) / turns.length : 0;
      var turnHint = turns.length && Math.abs(avgTurn - turnDeg) > 3
        ? ' Robo draait bij elke hoek ' + r(avgTurn) + ' graden; voor een ' + name + ' moet dat ' + turnDeg + ' graden zijn.'
        : '';
      if (!loop) {
        if (p.length < n) {
          return { ok: false, msg: 'Robo tekent ' + p.length + (p.length === 1 ? ' zijde' : ' zijden') + ', maar een ' + name + ' heeft er ' + n + '. Herhaal vaker.' + turnHint };
        }
        return { ok: false, msg: 'De lijn komt niet terug bij het begin, dus ' + lid + ' ' + name + ' is niet dicht.' + turnHint };
      }
      if (loop.length !== n) {
        return { ok: false, msg: 'Je vorm heeft ' + loop.length + ' hoeken, maar een ' + name + ' heeft er ' + n + '.' + turnHint };
      }
      var lens = loop.map(len), min = Math.min.apply(null, lens), max = Math.max.apply(null, lens);
      if (max > min * 1.05 + 1) {
        return { ok: false, msg: 'Niet alle zijden zijn even lang: van ' + r(min) + ' tot ' + r(max) + ' stappen. Gebruik bij elke zijde hetzelfde getal.' };
      }
      if (turnHint) return { ok: false, msg: turnHint.trim() };
      if (res.log.fenced) {
        return { ok: false, msg: lid.charAt(0).toUpperCase() + lid.slice(1) + ' ' + name + ' past niet op het speelveld: Robo liep tegen de rand. Maak de zijden korter.' };
      }
      return { ok: true, msg: 'Goed zo! Robo tekent een ' + name + ' met zijden van ' + r(min) + ' stappen.' };
    };
  }

  function stairsCheck(res) {
    var p = penPath(res.penLines).path;
    if (!p.length) return { ok: false, msg: nothingDrawn(res) };
    var hor = function (s) { return Math.abs(s.y2 - s.y1) < 0.5; };
    var ver = function (s) { return Math.abs(s.x2 - s.x1) < 0.5; };
    var steps = 0;
    for (var i = 0; i + 1 < p.length; i += 2) {
      var a = p[i], b = p[i + 1];
      var pair = (hor(a) && ver(b)) || (ver(a) && hor(b));
      if (!pair) break;
      steps++;
    }
    var lens = p.slice(0, steps * 2).map(len);
    if (steps < 3) return { ok: false, msg: 'Ik zie ' + steps + (steps === 1 ? ' traptrede' : ' traptredes') + '. Een trap heeft er minstens 3: steeds een stukje vooruit en een stukje omhoog.' };
    var min = Math.min.apply(null, lens), max = Math.max.apply(null, lens);
    if (max > min * 1.05 + 1) return { ok: false, msg: 'De treden zijn niet allemaal even groot (' + r(min) + ' tot ' + r(max) + ' stappen).' };
    return { ok: true, msg: 'Goed zo! Een trap met ' + steps + ' treden van ' + r(min) + ' stappen.' };
  }

  function helloCheck(res) {
    var says = res.log.says.filter(function (s) { return s.text.trim() !== ''; });
    if (!says.length) return { ok: false, msg: 'Robo zegt niets. Gebruik een "zeg"-blok onder de groene vlag.' };
    var hit = says.filter(function (s) { return /hallo/i.test(s.text); })[0];
    if (!hit) return { ok: false, msg: 'Robo zegt "' + says[0].text + '", maar de opdracht is "Hallo!".' };
    if (hit.kind === 'think') return { ok: false, msg: 'Robo denkt "Hallo!" in een wolkje. Gebruik "zeg" in plaats van "denk".' };
    return { ok: true, msg: 'Goed zo! Robo zegt "' + hit.text + '".' };
  }

  function backAndForthCheck(res) {
    var pos = res.log.positions;
    if (!res.log.moved) return { ok: false, msg: 'Robo beweegt niet.' };
    var turns = 0, lastSign = 0, minX = Infinity, maxX = -Infinity;
    for (var i = 1; i < pos.length; i++) {
      var dx = pos[i].x - pos[i - 1].x;
      minX = Math.min(minX, pos[i].x);
      maxX = Math.max(maxX, pos[i].x);
      if (Math.abs(dx) < 0.01) continue;
      var sg = dx > 0 ? 1 : -1;
      if (lastSign && sg !== lastSign) turns++;
      lastSign = sg;
    }
    if (res.finished && turns < 2) return { ok: false, msg: 'Robo stopt na ' + res.time.toFixed(1).replace('.', ',') + ' seconden. Met "herhaal" (zonder getal) blijft hij doorlopen.' };
    if (turns < 2) {
      if (res.log.fenced) return { ok: false, msg: 'Robo loopt tegen de rand en blijft daar hangen. Laat hem omkeren met "keer om aan de rand".' };
      return { ok: false, msg: 'Robo loopt maar één kant op. Laat hem omkeren met "keer om aan de rand".' };
    }
    if (maxX - minX < 250) return { ok: false, msg: 'Robo loopt heen en weer, maar maar een klein stukje. Laat hem van rand tot rand lopen.' };
    return { ok: true, msg: 'Goed zo! Robo liep in 10 seconden ' + turns + ' keer om.' };
  }

  function danceCheck(res) {
    var c = res.log.costumes;
    if (c.length < 4) return { ok: false, msg: 'Robo wisselt ' + c.length + ' keer van houding. Voor een dansje minstens 4 keer (gebruik "volgend uiterlijk" in een herhaal-lus).' };
    var span = c[c.length - 1] - c[0];
    if (span / (c.length - 1) < 0.15) return { ok: false, msg: 'Robo wisselt zo snel van houding dat je het niet ziet. Zet een "wacht"-blok in de lus.' };
    return { ok: true, msg: 'Goed zo! Robo danst: ' + c.length + ' keer een andere houding.' };
  }

  var LIST = [
    {
      id: 'vrij', title: 'Vrij bouwen', goal: 'Bouw wat je wilt. De scanner kijkt of de code werkt.',
      check: null,
    },
    {
      id: 'vierkant', title: 'Teken een vierkant', goal: 'Laat Robo een vierkant tekenen.',
      hint: 'Een vierkant heeft 4 even lange zijden. Hoeveel graden draai je bij elke hoek?',
      blocks: ['when_flag', 'pen_down', 'repeat', 'move', 'turn_right', 'end'],
      solution: [['when_flag', 'pen_clear', 'pen_down', { id: 'repeat', args: ['4'], body: [['move', '100'], ['turn_right', '90']] }]],
      check: polygonCheck(4, 90, 'vierkant', 'het'),
    },
    {
      id: 'driehoek', title: 'Teken een driehoek', goal: 'Laat Robo een driehoek met drie even lange zijden tekenen.',
      hint: 'Robo draait in totaal één rondje: 360 graden, verdeeld over 3 hoeken.',
      blocks: ['when_flag', 'pen_down', 'repeat', 'move', 'turn_left', 'end'],
      solution: [['when_flag', 'pen_clear', 'pen_down', { id: 'repeat', args: ['3'], body: [['move', '100'], ['turn_left', '120']] }]],
      check: polygonCheck(3, 120, 'driehoek', 'de'),
    },
    {
      id: 'zeshoek', title: 'Teken een zeshoek', goal: 'Laat Robo een zeshoek tekenen, zoals een bijenraat.',
      hint: '6 hoeken, samen weer één rondje van 360 graden.',
      blocks: ['when_flag', 'pen_down', 'repeat', 'move', 'turn_right', 'end'],
      solution: [['when_flag', 'pen_clear', 'pen_down', { id: 'repeat', args: ['6'], body: [['move', '60'], ['turn_right', '60']] }]],
      check: polygonCheck(6, 60, 'zeshoek', 'de'),
    },
    {
      id: 'ster', title: 'Teken een ster', goal: 'Laat Robo een ster met 5 punten tekenen.',
      hint: 'Bij een ster draait Robo in totaal twee rondjes: 720 graden over 5 punten.',
      blocks: ['when_flag', 'pen_down', 'repeat', 'move', 'turn_right', 'end'],
      solution: [['when_flag', 'pen_clear', 'pen_down', { id: 'repeat', args: ['5'], body: [['move', '150'], ['turn_right', '144']] }]],
      check: polygonCheck(5, 144, 'ster', 'de'),
    },
    {
      id: 'trap', title: 'Teken een trap', goal: 'Laat Robo een trap met minstens 3 treden tekenen.',
      hint: 'Eén trede is: een stukje vooruit, draaien, een stukje omhoog, terugdraaien.',
      blocks: ['when_flag', 'pen_down', 'repeat', 'move', 'turn_left', 'turn_right', 'end'],
      solution: [['when_flag', 'pen_clear', ['goto_xy', '-100', '-100'], 'pen_down', { id: 'repeat', args: ['4'], body: [['move', '40'], ['turn_left', '90'], ['move', '40'], ['turn_right', '90']] }]],
      check: stairsCheck,
    },
    {
      id: 'hallo', title: 'Zeg hallo', goal: 'Laat Robo "Hallo!" zeggen als je op de groene vlag klikt.',
      blocks: ['when_flag', 'say_secs'],
      solution: [['when_flag', ['say_secs', 'Hallo!', '2']]],
      check: helloCheck,
    },
    {
      id: 'heen-en-weer', title: 'Heen en weer', goal: 'Laat Robo steeds heen en weer lopen, van rand tot rand.',
      hint: 'Robo moet blijven lopen en omdraaien als hij de rand raakt.',
      blocks: ['when_flag', 'forever', 'move', 'bounce', 'end'],
      solution: [['when_flag', { id: 'forever', body: [['move', '10'], 'bounce'] }]],
      check: backAndForthCheck,
      seconds: 10,
    },
    {
      id: 'dans', title: 'Dansje', goal: 'Laat Robo dansen door steeds van houding te wisselen.',
      hint: 'Gebruik "volgend uiterlijk" en "wacht" in een herhaal-lus.',
      blocks: ['when_flag', 'repeat', 'next_costume', 'wait', 'end'],
      solution: [['when_flag', { id: 'repeat', args: ['10'], body: ['next_costume', ['wait', '0.5']] }]],
      check: danceCheck,
    },
  ];

  function byId(id) {
    return LIST.filter(function (a) { return a.id === id; })[0] || LIST[0];
  }

  // Voert de code in een flits uit en controleert de opdracht.
  function evaluate(assignment, scripts) {
    var rt = new Blok.Runtime(scripts);
    var res = rt.runHeadless(assignment.seconds || 12);
    var outcome = assignment.check ? assignment.check(res) : null;
    return { run: res, outcome: outcome };
  }

  // Waarschuwingen uit een proefrit (los van de opdracht).
  function runIssues(res, scripts) {
    var out = [];
    var hasFlag = scripts.some(function (s) { return s.hat && s.hat.def.event === 'flag'; });
    if (!hasFlag) return out;
    var visible = res.log.moved || res.penLines.length || res.log.says.length || res.log.looks || res.log.sounds.length;
    if (!visible) out.push({ level: 'let op', code: 'niets-zichtbaar', msg: 'Als je op de groene vlag klikt, zie je niets gebeuren. Robo beweegt niet, tekent niet en zegt niets.' });
    if (res.log.fenced) out.push({ level: 'let op', code: 'rand', msg: 'Robo liep tegen de rand van het speelveld en kon niet verder. Klopt dat?' });
    return out;
  }

  Blok.assignments = { LIST: LIST, byId: byId, evaluate: evaluate, runIssues: runIssues, penPath: penPath };
})(globalThis.Blok = globalThis.Blok || {});
