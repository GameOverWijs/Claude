// Van een rij losse stukken (tokens) naar scripts met geneste C-blokken.
//
// Losse C-blokken hebben een apart einde-stuk (en eventueel een anders-stuk), net als haakjes.
// Ontbreekt een einde, dan kijkt de parser naar het inspringen op de foto om te raden
// waar het C-blok ophoudt, en meldt dat als fout.
(function (Blok) {
  'use strict';

  var G = Blok.GEOM;

  function nodeFromToken(t) {
    var nd = {
      uid: t.uid || Blok.program.uid('s'),
      def: t.def,
      args: (t.args || []).slice(),
      argTiles: (t.argTiles || []).slice(),
      cond: t.cond || null,
      indentMm: t.indentMm,
      rotated: !!t.rotated,
      unsure: !!t.unsure,
      marker: t.marker || null,
    };
    if (t.def.kind === 'c') nd.body = [];
    return nd;
  }

  function label(nd) {
    return '"' + (nd.parts ? Blok.catalog.labelOf(nd) : Blok.program.label(nd)) + '"';
  }

  // Eén rij tokens -> één of meer scripts (een startblok halverwege begint een nieuw script).
  function parseTokens(tokens, inferByIndent) {
    var scripts = [], issues = [];
    var cur = null, frames = [], lastNode = null;

    function startScript() {
      cur = { hat: null, body: [] };
      scripts.push(cur);
      frames = [];
    }
    function list() {
      if (!frames.length) return cur.body;
      var f = frames[frames.length - 1];
      return f.node[f.part];
    }
    function closeImplicit(reason) {
      var f = frames.pop();
      var where = lastNode && lastNode !== f.node ? ' na ' + label(lastNode) : '';
      if (reason === 'indent') {
        issues.push({
          level: 'fout', code: 'geen-einde', uid: f.node.uid,
          msg: 'Het C-blok ' + label(f.node) + ' heeft geen einde-stuk. Aan het inspringen te zien hoort het einde' + where + '. Leg daar een einde-stuk neer.',
        });
      } else {
        issues.push({
          level: 'fout', code: 'geen-einde', uid: f.node.uid,
          msg: 'Het C-blok ' + label(f.node) + ' heeft geen einde-stuk. Nu hoort alles eronder erbij. Leg een einde-stuk onder het laatste blok dat erin hoort.',
        });
      }
    }

    startScript();
    tokens.forEach(function (t) {
      var def = t.def;
      if (inferByIndent && frames.length && t.indentMm != null && def.kind !== 'end' && def.kind !== 'else') {
        while (frames.length && frames[frames.length - 1].indent != null &&
          t.indentMm < frames[frames.length - 1].indent + G.ARM * 0.5) {
          closeImplicit('indent');
        }
      }
      if (def.kind === 'hat') {
        if (cur.hat || cur.body.length) {
          while (frames.length) closeImplicit('end');
          issues.push({
            level: 'let op', code: 'startblok-midden', uid: t.uid,
            msg: 'Het startblok ' + label(t) + ' ligt midden in een rij blokken. Een startblok kan alleen bovenaan. Ik zie het als een nieuw script.',
          });
          startScript();
        }
        cur.hat = nodeFromToken(t);
        lastNode = cur.hat;
        return;
      }
      if (def.kind === 'end') {
        if (frames.length) {
          frames.pop();
        } else {
          issues.push({ level: 'fout', code: 'los-einde', uid: t.uid, msg: 'Er ligt een einde-stuk zonder C-blok erboven (zoals herhaal of als). Haal het weg of leg het goede C-blok erboven.' });
        }
        return;
      }
      if (def.kind === 'else') {
        var top = frames[frames.length - 1];
        if (top && top.node.def.id === 'if' && top.part === 'body' && !top.node.elseBody) {
          top.node.elseBody = [];
          top.part = 'elseBody';
        } else {
          issues.push({ level: 'fout', code: 'los-anders', uid: t.uid, msg: 'Er ligt een anders-stuk dat niet bij een "als ... dan"-blok hoort. Het anders-stuk komt tussen "als" en het einde-stuk.' });
        }
        return;
      }
      var nd = nodeFromToken(t);
      list().push(nd);
      lastNode = nd;
      if (def.kind === 'c') frames.push({ node: nd, part: 'body', indent: t.indentMm });
    });
    while (frames.length) closeImplicit('end');
    return { scripts: scripts, issues: issues };
  }

  function hasIndent(tokens) {
    return tokens.length > 1 && tokens.every(function (t) { return typeof t.indentMm === 'number'; });
  }

  // Controleer of het inspringen op de foto klopt met de einde-stukken.
  function indentHints(scripts) {
    var out = [];
    scripts.forEach(function (s) {
      var base = s.hat ? s.hat.indentMm : s.body.length ? s.body[0].indentMm : null;
      if (base == null) return;
      Blok.program.walk(s.body, function (nd, depth, parent) {
        if (nd.indentMm == null) return;
        var measured = (nd.indentMm - base) / G.ARM;
        if (Math.abs(measured - depth) > 0.6) {
          out.push({
            level: 'tip', code: 'inspringen', uid: nd.uid,
            msg: measured > depth
              ? label(nd) + ' ligt ingesprongen, maar hoort volgens de einde-stukken niet binnen een C-blok. Klopt dat?'
              : label(nd) + ' hoort binnen ' + (parent ? label(parent) : 'een C-blok') + ', maar ligt niet ingesprongen. Schuif hem een stukje naar rechts, dan zie je het beter.',
          });
        }
      });
    });
    return out;
  }

  // tokenScripts: [{tokens}] uit Blok.recognize.interpret of uit de AI-herkenning.
  function build(tokenScripts) {
    var scripts = [], issues = [];
    tokenScripts.forEach(function (ts) {
      var tokens = ts.tokens;
      var first = parseTokens(tokens, false);
      var res = first;
      var missing = first.issues.some(function (i) { return i.code === 'geen-einde'; });
      if (missing && hasIndent(tokens)) {
        var second = parseTokens(tokens, true);
        // alleen gebruiken als het inspringen echt iets oplost (niet meer fouten geeft)
        if (second.issues.length <= first.issues.length) res = second;
      }
      scripts = scripts.concat(res.scripts);
      issues = issues.concat(res.issues);
    });
    issues = issues.concat(indentHints(scripts));
    scripts.forEach(function (s) {
      Blok.program.walkScript(s, function (nd) {
        if (nd.rotated) issues.push({ level: 'tip', code: 'gedraaid', uid: nd.uid, msg: label(nd) + ' ligt scheef of op zijn kop. Leg het recht, dan leest de scanner het beter.' });
      });
    });
    return { scripts: scripts, issues: issues };
  }

  Blok.structure = { build: build, parseTokens: parseTokens };
})(globalThis.Blok = globalThis.Blok || {});
