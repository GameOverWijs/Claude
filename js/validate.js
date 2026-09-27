// Controle van de code zonder hem uit te voeren. Meldingen in gewone taal voor leerlingen.
//
// Niveaus:  'fout'   = zo werkt de code niet (of niet zoals het er staat)
//           'let op' = werkt wel, maar waarschijnlijk niet zoals bedoeld
//           'tip'    = kan beter of handiger
(function (Blok) {
  'use strict';

  function label(nd) { return '"' + Blok.program.label(nd) + '"'; }

  function isNumber(v) {
    var s = String(v).trim();
    return s !== '' && !isNaN(Number(s)) && isFinite(Number(s));
  }

  function checkSlots(nd, issues) {
    nd.def.slots.forEach(function (slot, i) {
      var v = Blok.program.argValue(nd, i);
      if (slot.type === 'bool') {
        if (nd.cond) return;
        var msg = {
          if: 'Het blok ' + label(nd) + ' heeft geen voorwaarde in het zeshoekige vakje. Dan klopt de voorwaarde nooit en gebeurt wat erin staat nooit.',
          repeat_until: 'Het blok ' + label(nd) + ' heeft geen voorwaarde. Dan stopt de lus nooit.',
          wait_until: 'Het blok ' + label(nd) + ' heeft geen voorwaarde. Dan blijft het altijd wachten.',
        }[nd.def.id];
        issues.push({ level: nd.def.id === 'if' ? 'let op' : 'fout', code: 'lege-voorwaarde', uid: nd.uid, slots: [i], msg: msg });
        return;
      }
      if (slot.type === 'num') {
        if (/^#[0-9a-f]{6}$/i.test(v)) {
          issues.push({ level: 'fout', code: 'kleur-in-getal', uid: nd.uid, slots: [i], msg: 'In ' + label(nd) + ' ligt een kleur waar een getal hoort.' });
        } else if (/^\s*-?\d+,\d+\s*$/.test(v)) {
          issues.push({ level: 'fout', code: 'komma', uid: nd.uid, slots: [i], msg: 'In ' + label(nd) + ' staat "' + v + '". Scratch gebruikt een punt voor kommagetallen: schrijf ' + v.replace(',', '.') + '. Met een komma rekent Scratch met 0.' });
        } else if (!isNumber(v)) {
          issues.push({ level: 'fout', code: 'geen-getal', uid: nd.uid, slots: [i], msg: 'In ' + label(nd) + ' staat "' + v + '" waar een getal hoort. Scratch rekent dan met 0.' });
        }
      }
      if (slot.type === 'color' && !/^#[0-9a-f]{6}$/i.test(v)) {
        issues.push({ level: 'let op', code: 'geen-kleur', uid: nd.uid, slots: [i], msg: 'In ' + label(nd) + ' hoort een kleurtegel. Nu ligt er "' + v + '".' });
      }
    });
  }

  function num(nd, i) { return Number(Blok.program.argValue(nd, i)); }

  function checkValues(nd, issues) {
    var id = nd.def.id;
    if (id === 'repeat') {
      var t = num(nd, 0);
      if (isNumber(Blok.program.argValue(nd, 0)) && t < 1) {
        issues.push({ level: 'let op', code: 'nul-keer', uid: nd.uid, slots: [0], msg: label(nd) + ' herhaalt ' + t + ' keer. Wat erin staat gebeurt dus nooit.' });
      } else if (t > 0 && t !== Math.round(t)) {
        issues.push({ level: 'tip', code: 'halve-keer', uid: nd.uid, slots: [0], msg: 'Scratch rondt ' + t + ' keer herhalen af naar ' + Math.round(t) + ' keer.' });
      }
    }
    if ((id === 'wait' || id === 'say_secs' || id === 'think_secs' || id === 'glide_xy') && num(nd, id === 'wait' || id === 'glide_xy' ? 0 : 1) > 10) {
      issues.push({ level: 'tip', code: 'lang-wachten', uid: nd.uid, msg: label(nd) + ' duurt meer dan 10 seconden. Bedoel je dat?' });
    }
    if (id === 'move' && Math.abs(num(nd, 0)) > 480) {
      issues.push({ level: 'let op', code: 'te-ver', uid: nd.uid, slots: [0], msg: 'Het speelveld is 480 stappen breed. Met ' + label(nd) + ' loopt Robo tegen de rand.' });
    }
    if ((id === 'goto_xy' || id === 'glide_xy') && (Math.abs(num(nd, id === 'glide_xy' ? 1 : 0)) > 240 || Math.abs(num(nd, id === 'glide_xy' ? 2 : 1)) > 180)) {
      issues.push({ level: 'let op', code: 'buiten-veld', uid: nd.uid, msg: 'Het speelveld loopt van x: -240 tot 240 en van y: -180 tot 180. ' + label(nd) + ' valt daarbuiten.' });
    }
    if ((id === 'turn_right' || id === 'turn_left') && Math.abs(num(nd, 0)) >= 360 && num(nd, 0) % 360 === 0) {
      issues.push({ level: 'tip', code: 'rondje', uid: nd.uid, msg: label(nd) + ' draait precies een heel rondje (of meer). Robo kijkt daarna dezelfde kant op als ervoor.' });
    }
  }

  // Blokken na "herhaal" (altijd) of "stop alle" worden nooit uitgevoerd.
  function checkUnreachable(list, issues) {
    var dead = false, cause = null;
    (list || []).forEach(function (nd) {
      if (dead) {
        nd.unreachable = true;
        issues.push({
          level: 'fout', code: 'na-einde', uid: nd.uid,
          msg: label(nd) + ' komt na ' + label(cause) + '. ' + (cause.def.id === 'forever'
            ? 'Die lus stopt nooit, dus dit blok wordt nooit uitgevoerd. In Scratch kun je onder "herhaal" (zonder getal) niets vastklikken.'
            : 'Na "stop alle" gebeurt niets meer. In Scratch kun je daar niets onder vastklikken.'),
        });
      }
      if (nd.def.id === 'forever' || nd.def.id === 'stop_all') { dead = true; cause = cause || nd; }
      if (nd.body) checkUnreachable(nd.body, issues);
      if (nd.elseBody) checkUnreachable(nd.elseBody, issues);
    });
  }

  function sameSeq(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i].def.id !== b[i].def.id || a[i].def.kind === 'c' || b[i].def.kind === 'c') return false;
      var sa = a[i].def.slots.map(function (s, k) { return Blok.program.argValue(a[i], k); }).join('|');
      var sb = b[i].def.slots.map(function (s, k) { return Blok.program.argValue(b[i], k); }).join('|');
      if (sa !== sb) return false;
    }
    return true;
  }

  // Tip: dezelfde blokken 3 of meer keer achter elkaar -> gebruik herhaal.
  function repetitionTips(list, issues) {
    list = list || [];
    for (var size = 1; size <= 4; size++) {
      for (var start = 0; start + size * 3 <= list.length; start++) {
        var seq = list.slice(start, start + size), count = 1;
        while (start + (count + 1) * size <= list.length && sameSeq(seq, list.slice(start + count * size, start + (count + 1) * size))) count++;
        if (count >= 3) {
          var names = seq.map(label).join(' en ');
          issues.push({
            level: 'tip', code: 'gebruik-herhaal', uid: seq[0].uid,
            msg: 'Je gebruikt ' + count + ' keer achter elkaar ' + names + '. Met "herhaal (' + count + ')" wordt je code korter en makkelijker te veranderen.',
          });
          return;
        }
      }
    }
    list.forEach(function (nd) { if (nd.body) repetitionTips(nd.body, issues); if (nd.elseBody) repetitionTips(nd.elseBody, issues); });
  }

  function countBlocks(scripts) {
    var n = 0;
    scripts.forEach(function (s) { Blok.program.walkScript(s, function () { n++; }); });
    return n;
  }

  // scripts uit Blok.structure.build. Geeft een lijst meldingen.
  function check(scripts) {
    var issues = [];
    if (!scripts.length || !countBlocks(scripts)) {
      issues.push({ level: 'fout', code: 'niets', msg: 'Ik zie geen blokken. Staan alle codevierkantjes scherp en helemaal in beeld?' });
      return issues;
    }
    var flagScripts = 0;
    scripts.forEach(function (s) {
      if (!s.hat) {
        var first = s.body[0];
        issues.push({
          level: 'fout', code: 'geen-start', uid: first && first.uid,
          msg: (s.body.length === 1 ? 'Het blok ' + label(first) + ' ligt los' : 'Het script dat begint met ' + label(first) + ' heeft geen startblok') +
            ', dus het doet niets. Leg er een geel startblok boven, zoals "wanneer op groene vlag wordt geklikt".',
        });
      } else {
        if (s.hat.def.event === 'flag') flagScripts++;
        if (!s.body.length) issues.push({ level: 'let op', code: 'leeg-script', uid: s.hat.uid, msg: 'Onder ' + label(s.hat) + ' ligt nog niets. Wat moet er gebeuren?' });
      }
      Blok.program.walkScript(s, function (nd) {
        checkSlots(nd, issues);
        checkValues(nd, issues);
        if (nd.def.kind === 'c' && !nd.body.length) {
          issues.push({ level: 'let op', code: 'leeg-c', uid: nd.uid, msg: 'In ' + label(nd) + ' zit niets. Leg de blokken die erbij horen tussen het C-blok en het einde-stuk.' });
        }
        if (nd.elseBody && !nd.elseBody.length) {
          issues.push({ level: 'tip', code: 'leeg-anders', uid: nd.uid, msg: 'Het anders-deel van ' + label(nd) + ' is leeg. Dan kun je het anders-stuk ook weglaten.' });
        }
      });
      checkUnreachable(s.body, issues);
      repetitionTips(s.body, issues);
    });
    if (flagScripts > 1) {
      issues.push({ level: 'tip', code: 'meer-vlaggen', msg: 'Er zijn ' + flagScripts + ' scripts met de groene vlag. Die starten tegelijk, niet na elkaar.' });
    }
    return issues;
  }

  // Samenvatting voor de grote melding bovenaan.
  function verdict(issues) {
    var errors = issues.filter(function (i) { return i.level === 'fout'; }).length;
    var warns = issues.filter(function (i) { return i.level === 'let op'; }).length;
    if (errors) return { level: 'fout', title: 'Deze code werkt nog niet', text: errors === 1 ? 'Er is 1 ding dat je moet verbeteren.' : 'Er zijn ' + errors + ' dingen die je moet verbeteren.' };
    if (warns) return { level: 'let op', title: 'De code werkt, maar kijk even', text: 'Hij doet het, maar misschien niet zoals je bedoelt.' };
    return { level: 'goed', title: 'De code werkt', text: 'Alle blokken passen en kunnen uitgevoerd worden.' };
  }

  Blok.validate = { check: check, verdict: verdict, isNumber: isNumber };
})(globalThis.Blok = globalThis.Blok || {});
