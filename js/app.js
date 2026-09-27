// De Blokkenscanner-app: knoppen, foto's, uitkomsten en downloads.
(function (Blok) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const LEVELS = ['fout', 'let op', 'tip'];
  const LEVEL_NAME = { fout: 'Fout', 'let op': 'Let op', tip: 'Tip', goed: 'Goed' };
  const PRICES = { 'claude-opus-5': [5, 25], 'claude-sonnet-5': [2, 10], 'claude-haiku-4-5': [1, 5] }; // dollar per miljoen tokens (in, uit)
  const TABS = { scan: 'scannen', blocks: 'blokken', tasks: 'opdrachten', help: 'uitleg', settings: 'instellingen' };

  const state = {
    mode: 'markers',
    image: null,
    source: null,
    result: null,
    runtime: null,
    stage: null,
    assignment: 'vrij',
    live: null,
    raf: 0,
    lastTick: 0,
    acc: 0,
    audio: null,
  };

  // ------------------------------------------------------------------ opslag
  const store = {
    get(key, fallback, session) {
      try {
        const v = (session ? sessionStorage : localStorage).getItem('blokkenscanner.' + key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value, session) {
      try { (session ? sessionStorage : localStorage).setItem('blokkenscanner.' + key, JSON.stringify(value)); } catch (e) { /* opslag geblokkeerd */ }
    },
    remove(key) {
      try { localStorage.removeItem('blokkenscanner.' + key); sessionStorage.removeItem('blokkenscanner.' + key); } catch (e) { /* */ }
    },
  };

  const settings = {
    model: store.get('model', Blok.ai.DEFAULT_MODEL),
    consent: store.get('consent', false),
    remember: store.get('remember', false),
    maxErrors: store.get('maxErrors', 2),
    apiKey: store.get('apiKey', '') || store.get('apiKey', '', true),
  };

  // ------------------------------------------------------------------ hulpjes
  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach((c) => c && e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return e;
  }

  function download(name, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function setStatus(text, busy) {
    const s = $('status');
    s.textContent = text || '';
    s.classList.toggle('busy', !!busy);
  }

  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

  function fmtNumber(n, digits) {
    return n.toLocaleString('nl-NL', { minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0 });
  }

  // ------------------------------------------------------------------ tabbladen
  function showTab(key) {
    Object.keys(TABS).forEach((k) => {
      const on = k === key;
      $('tab-btn-' + k).setAttribute('aria-selected', on ? 'true' : 'false');
      $('tab-' + k).hidden = !on;
    });
    if (key !== 'scan') stopLive();
    try { history.replaceState(null, '', '#' + TABS[key]); } catch (e) { /* */ }
    if (key === 'scan' && state.stage) { state.stage.resize(); renderStage(); }
  }

  function initTabs() {
    Object.keys(TABS).forEach((k) => $('tab-btn-' + k).addEventListener('click', () => showTab(k)));
    const hash = (location.hash || '').slice(1);
    const found = Object.keys(TABS).find((k) => TABS[k] === hash);
    showTab(found || 'scan');
  }

  // ------------------------------------------------------------------ foto's
  function toCanvas(src, maxSide) {
    const W = src.videoWidth || src.naturalWidth || src.width, H = src.videoHeight || src.naturalHeight || src.height;
    const s = Math.min(1, (maxSide || 3200) / Math.max(W, H));
    const c = document.createElement('canvas');
    c.width = Math.round(W * s);
    c.height = Math.round(H * s);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  async function imageFromFile(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* val terug op <img> */ }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Deze foto kan ik niet openen. Probeer een JPG of PNG.')); };
      img.src = url;
    });
  }

  async function loadFile(file, source) {
    if (!file || !/^image\//.test(file.type || 'image/')) {
      setStatus('Dat is geen foto. Kies een JPG- of PNG-bestand.');
      return;
    }
    stopLive();
    setStatus('Foto openen…', true);
    try {
      const img = await imageFromFile(file);
      setPhoto(toCanvas(img), source || 'foto');
      await processPhoto();
    } catch (e) {
      setStatus(e.message);
    }
  }

  function setPhoto(canvas, source) {
    state.image = canvas;
    state.source = source;
    const view = $('photo-canvas');
    view.width = canvas.width;
    view.height = canvas.height;
    view.getContext('2d').drawImage(canvas, 0, 0);
    view.hidden = false;
    $('photo-empty').hidden = true;
    const ov = $('photo-overlay');
    ov.width = canvas.width;
    ov.height = canvas.height;
    ov.getContext('2d').clearRect(0, 0, ov.width, ov.height);
    ov.hidden = false;
  }

  // ------------------------------------------------------------------ verwerken
  async function processPhoto() {
    if (!state.image) return;
    stopRun();
    if (state.mode === 'ai') return processAI();
    setStatus('Codevierkantjes zoeken…', true);
    await nextFrame();
    const t0 = performance.now();
    let markers;
    try {
      markers = Blok.recognize.detectMarkers(state.image, { maxErrors: settings.maxErrors });
    } catch (e) {
      setStatus('Er ging iets mis bij het zoeken: ' + e.message);
      return;
    }
    const rec = Blok.recognize.interpret(markers);
    const built = Blok.structure.build(rec.scripts);
    const ms = Math.round(performance.now() - t0);
    const blocks = rec.all.filter((it) => !Blok.catalog.isTile(it.def)).length;
    const tiles = rec.all.length - blocks;
    setStatus(markers.length
      ? `${blocks} ${blocks === 1 ? 'blok' : 'blokken'} en ${tiles} ${tiles === 1 ? 'tegel' : 'tegels'} gevonden in ${fmtNumber(ms / 1000, 1)} s.`
      : 'Geen codevierkantjes gevonden. Staan ze scherp, recht van boven en helemaal in beeld?');
    drawOverlay(rec);
    finish(built, rec.notes);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = el('script', { src });
      s.onload = resolve;
      s.onerror = () => reject(new Error('Kon ' + src + ' niet laden.'));
      document.head.appendChild(s);
    });
  }

  async function processAI() {
    const problem = aiProblem();
    if (problem) {
      setStatus(problem);
      showResult(null);
      return;
    }
    $('photo-overlay').getContext('2d').clearRect(0, 0, 1e5, 1e5);
    setStatus('Claude leest de tekening. Dit duurt meestal 10 tot 40 seconden…', true);
    try {
      if (!globalThis.AnthropicSDK) await loadScript('vendor/anthropic-sdk/anthropic-sdk.min.js');
      const t0 = performance.now();
      const res = await Blok.ai.recognizePhoto(state.image, settings);
      const s = (performance.now() - t0) / 1000;
      const built = Blok.structure.build(res.tokenScripts);
      const p = PRICES[settings.model];
      const u = res.usage || {};
      const cost = p ? ((u.input_tokens || 0) * p[0] + (u.output_tokens || 0) * p[1]) / 1e6 : null;
      setStatus(`Gelezen door ${res.model} in ${fmtNumber(s, 0)} s · ${fmtNumber(u.input_tokens || 0)} + ${fmtNumber(u.output_tokens || 0)} tokens` +
        (cost != null ? ` · ongeveer $${fmtNumber(cost, 3)}` : '') + '.');
      finish(built, res.notes);
    } catch (e) {
      setStatus(e.message);
    }
  }

  function aiProblem() {
    if (!settings.consent) return 'De AI-modus staat uit: vink bij Instellingen aan dat de school toestemming geeft.';
    if (!settings.apiKey) return 'Vul bij Instellingen een API-sleutel in om de AI-modus te gebruiken.';
    if (location.protocol === 'file:' && !navigator.onLine) return 'Voor de AI-modus is internet nodig.';
    return '';
  }

  function finish(built, notes) {
    const scripts = built.scripts;
    let issues = (notes || []).concat(built.issues, Blok.validate.check(scripts));
    const assignment = Blok.assignments.byId(state.assignment);
    const ev = Blok.assignments.evaluate(assignment, scripts);
    issues = issues.concat(Blok.assignments.runIssues(ev.run, scripts));
    const seen = {};
    issues = issues.filter((i) => (seen[i.msg] ? false : (seen[i.msg] = true)));
    issues.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
    showResult({ scripts, issues, outcome: ev.outcome });
  }

  function reevaluate() {
    if (!state.result) return;
    const r = state.result;
    const assignment = Blok.assignments.byId(state.assignment);
    const ev = Blok.assignments.evaluate(assignment, r.scripts);
    r.outcome = ev.outcome;
    renderVerdict();
    renderOutcome();
  }

  // ------------------------------------------------------------------ tekenen van uitkomsten
  function drawOverlay(rec) {
    const ov = $('photo-overlay');
    const ctx = ov.getContext('2d');
    ctx.clearRect(0, 0, ov.width, ov.height);
    const lw = Math.max(2, ov.width / 350);
    const quad = (c) => { ctx.beginPath(); c.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
    // volgorde van de blokken in elk script
    ctx.lineWidth = lw * 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.setLineDash([lw * 3, lw * 2]);
    rec.scripts.forEach((s) => {
      ctx.beginPath();
      s.tokens.forEach((t, i) => (i ? ctx.lineTo(t.marker.center.x, t.marker.center.y) : ctx.moveTo(t.marker.center.x, t.marker.center.y)));
      ctx.stroke();
    });
    ctx.setLineDash([]);
    rec.all.forEach((it) => {
      const cat = Blok.CATEGORIES[it.def.cat];
      const loose = Blok.catalog.isTile(it.def) && !it.host;
      ctx.lineWidth = lw * 2;
      ctx.strokeStyle = loose ? '#FF8C1A' : it.def.cat === 'values' ? '#FFFFFF' : cat.fill;
      quad(it.corners);
      ctx.stroke();
      if (it.host) {
        ctx.lineWidth = lw;
        ctx.strokeStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(it.f.c.x, it.f.c.y);
        ctx.lineTo(it.host.f.c.x, it.host.f.c.y);
        ctx.stroke();
      }
    });
    rec.unknown.forEach((u) => {
      ctx.lineWidth = lw * 2;
      ctx.strokeStyle = '#E5484D';
      quad(u.corners);
      ctx.stroke();
    });
    // nummers bij de blokken
    const fs = Math.max(12, ov.width / 55);
    ctx.font = `800 ${fs}px Nunito, system-ui, sans-serif`;
    rec.scripts.forEach((s) => s.tokens.forEach((t, i) => {
      const p = t.marker.corners[0];
      const text = String(i + 1);
      const w = ctx.measureText(text).width + fs * 0.6;
      ctx.fillStyle = '#1D2433';
      ctx.fillRect(p.x - w - lw, p.y - fs * 1.3 - lw, w, fs * 1.3);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(text, p.x - w - lw + fs * 0.3, p.y - lw - fs * 0.3);
    }));
  }

  function issueMap(issues) {
    const map = {};
    issues.forEach((i) => {
      if (!i.uid) return;
      const cur = map[i.uid] || { level: 'tip', slots: [] };
      if (LEVELS.indexOf(i.level) < LEVELS.indexOf(cur.level)) cur.level = i.level;
      (i.slots || []).forEach((s) => cur.slots.push(s));
      map[i.uid] = cur;
    });
    return map;
  }

  function showResult(result) {
    state.result = result;
    const has = !!(result && result.scripts.length);
    $('btn-dl-script').disabled = !has;
    $('btn-dl-sb3').disabled = !has;
    renderCode();
    renderIssues();
    renderVerdict();
    renderOutcome();
    prepareRuntime();
  }

  function renderCode() {
    const view = $('code-view');
    const r = state.result;
    if (!r || !r.scripts.length) {
      view.innerHTML = '<p class="code-empty">Nog geen code herkend.</p>';
      return;
    }
    // zo groot mogelijk leesbaar, maar op een smal scherm niet onnodig breed
    const natural = Blok.render.programSvg(r.scripts, { issues: issueMap(r.issues), title: 'Herkende code' });
    const mm = parseFloat((natural.match(/width="([\d.]+)mm"/) || [0, 100])[1]);
    const room = Math.max(200, view.clientWidth - 24);
    const scale = Math.max(2.4, Math.min(3.4, room / mm));
    view.innerHTML = natural.replace(/width="([\d.]+)mm" height="([\d.]+)mm"/, (m, a, b) => `width="${(a * scale).toFixed(1)}" height="${(b * scale).toFixed(1)}"`);
  }

  const ICONS = {
    goed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/></svg>',
    'let op': '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 1 21h22zm-1 7h2v6h-2zm0 8h2v2h-2z"/></svg>',
    fout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4-6.3-6.3-6.3 6.3-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z"/></svg>',
    leeg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 7h2v6h-2zm0 8h2v2h-2zm1-13a10 10 0 1 0 0 20 10 10 0 0 0 0-20"/></svg>',
  };

  function renderVerdict() {
    const r = state.result;
    let v;
    if (!r) v = { level: 'leeg', title: 'Nog niets gecontroleerd', text: state.image ? 'Er is nog geen code herkend.' : 'Maak een foto of kies een voorbeeld.' };
    else {
      v = Blok.validate.verdict(r.issues);
      if (v.level !== 'fout' && r.outcome) {
        if (r.outcome.ok) {
          v = { level: v.level, title: v.level === 'goed' ? 'De code werkt en de opdracht is gelukt' : 'De opdracht is gelukt', text: r.outcome.msg + (v.level === 'goed' ? '' : ' Kijk wel even naar de meldingen.') };
        } else {
          v = { level: 'let op', title: 'De code werkt, maar de opdracht is nog niet gelukt', text: r.outcome.msg };
        }
      }
    }
    const box = $('verdict');
    box.dataset.level = v.level;
    $('verdict-badge').innerHTML = ICONS[v.level];
    $('verdict-title').textContent = v.title;
    $('verdict-text').textContent = v.text;
    $('verdict-text').className = v.level === 'leeg' ? 'muted' : '';
  }

  function renderIssues() {
    const list = $('issues');
    list.innerHTML = '';
    const r = state.result;
    const issues = r ? r.issues : [];
    $('issues-card').hidden = !issues.length;
    issues.forEach((i) => {
      const body = el('div', {}, [el('p', { text: i.msg })]);
      if (i.uid && document.querySelector(`#code-view [data-uid="${CSS.escape(i.uid)}"]`)) {
        body.appendChild(el('button', { type: 'button', class: 'link', text: 'Laat zien welk blok', onclick: () => flashBlock(i.uid) }));
      }
      list.appendChild(el('li', { class: 'issue', 'data-level': i.level }, [el('span', { class: 'pill', text: LEVEL_NAME[i.level] }), body]));
    });
  }

  function flashBlock(uid) {
    const g = document.querySelector(`#code-view [data-uid="${CSS.escape(uid)}"]`);
    if (!g) return;
    g.classList.add('flash');
    g.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    setTimeout(() => g.classList.remove('flash'), 1800);
  }

  function renderOutcome() {
    const box = $('outcome');
    const r = state.result;
    const a = Blok.assignments.byId(state.assignment);
    $('task-goal').textContent = a.goal + (a.hint ? ' Tip: ' + a.hint : '');
    if (!r || !r.outcome) { box.hidden = true; return; }
    box.hidden = false;
    box.dataset.ok = r.outcome.ok ? 'true' : 'false';
    box.textContent = (r.outcome.ok ? 'Opdracht gelukt: ' : 'Opdracht nog niet gelukt: ') + r.outcome.msg;
  }

  // ------------------------------------------------------------------ speelveld
  function prepareRuntime() {
    stopRun();
    const r = state.result;
    const scripts = r ? r.scripts : [];
    state.runtime = new Blok.Runtime(scripts, { onSound: beep });
    const hasFlag = scripts.some((s) => s.hat && s.hat.def.event === 'flag');
    const hasKeys = scripts.some((s) => {
      let k = s.hat && s.hat.def.event === 'key';
      Blok.program.walkScript(s, (nd) => { if (nd.cond && nd.cond.def.key) k = true; });
      return k;
    });
    $('btn-flag').disabled = !hasFlag;
    $('btn-stop').disabled = !scripts.length;
    $('keys').hidden = !hasKeys;
    renderStage();
  }

  function renderStage() {
    if (!state.stage) return;
    state.stage.render(state.runtime);
  }

  function highlight(uids) {
    document.querySelectorAll('#code-view .blk.running').forEach((g) => g.classList.remove('running'));
    uids.forEach((u) => {
      const g = u && document.querySelector(`#code-view [data-uid="${CSS.escape(u)}"]`);
      if (g) g.classList.add('running');
    });
  }

  function tick(t) {
    const rt = state.runtime;
    state.raf = 0;
    if (!rt) return;
    const dt = state.lastTick ? Math.min(0.1, (t - state.lastTick) / 1000) : rt.dt;
    state.lastTick = t;
    state.acc += dt;
    let steps = 0;
    while (state.acc >= rt.dt && steps < 4) {
      rt.step();
      state.acc -= rt.dt;
      steps++;
    }
    renderStage();
    if (rt.running()) {
      highlight(rt.activeUids());
      state.raf = requestAnimationFrame(tick);
    } else {
      // klaar; een laatste tekstballon blijft staan, net als in Scratch
      highlight([]);
    }
  }

  function startLoop() {
    if (!state.raf) {
      state.lastTick = 0;
      state.acc = 0;
      state.raf = requestAnimationFrame(tick);
    }
  }

  function greenFlag() {
    const rt = state.runtime;
    if (!rt) return;
    unlockAudio();
    rt.reset();
    rt.slow = $('slow').checked ? 0.45 : 0;
    rt.greenFlag();
    startLoop();
  }

  function stopRun() {
    if (state.runtime) state.runtime.stopAll();
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    highlight([]);
  }

  function unlockAudio() {
    if (state.audio) return;
    try { state.audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { state.audio = null; }
  }

  function beep() {
    const ac = state.audio;
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.3);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.32);
  }

  const KEYMAP = { ArrowLeft: 'left arrow', ArrowRight: 'right arrow', ArrowUp: 'up arrow', ArrowDown: 'down arrow', ' ': 'space' };

  function initStage() {
    state.stage = new Blok.Stage($('stage'));
    window.addEventListener('resize', () => { state.stage.resize(); renderStage(); });
    $('btn-flag').addEventListener('click', greenFlag);
    $('btn-stop').addEventListener('click', stopRun);
    $('grid').addEventListener('change', () => { state.stage.grid = $('grid').checked; renderStage(); });
    const canvas = $('stage');
    canvas.addEventListener('pointermove', (e) => {
      if (!state.runtime) return;
      const p = state.stage.toStage(e.clientX, e.clientY);
      state.runtime.mouse.x = p.x;
      state.runtime.mouse.y = p.y;
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (!state.runtime) return;
      unlockAudio();
      const p = state.stage.toStage(e.clientX, e.clientY);
      Object.assign(state.runtime.mouse, { x: p.x, y: p.y, down: true });
      state.runtime.click(p.x, p.y);
      startLoop();
    });
    window.addEventListener('pointerup', () => { if (state.runtime) state.runtime.mouse.down = false; });
    $('keys').querySelectorAll('[data-key]').forEach((b) => {
      const key = b.dataset.key;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (state.runtime) { unlockAudio(); state.runtime.keyDown(key); startLoop(); } });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => state.runtime && state.runtime.keyUp(key)));
    });
    document.addEventListener('keydown', (e) => {
      const key = KEYMAP[e.key];
      if (!key || !state.runtime || $('tab-scan').hidden || $('keys').hidden) return;
      if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) return;
      e.preventDefault();
      state.runtime.keyDown(key);
      startLoop();
    });
    document.addEventListener('keyup', (e) => {
      const key = KEYMAP[e.key];
      if (key && state.runtime) state.runtime.keyUp(key);
    });
    prepareRuntime();
  }

  // ------------------------------------------------------------------ live camera
  async function startLive() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('Deze browser geeft geen toegang tot de camera. Gebruik "Foto maken".');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      const video = $('live-video');
      video.srcObject = stream;
      await video.play();
      state.live = { stream, timer: 0 };
      video.hidden = false;
      $('photo-canvas').hidden = true;
      $('photo-empty').hidden = true;
      $('live-controls').hidden = false;
      const ov = $('photo-overlay');
      ov.hidden = false;
      ov.width = video.videoWidth;
      ov.height = video.videoHeight;
      setStatus('Richt de camera recht op de blokken. Groene randen = gevonden codevierkantjes.');
      state.live.timer = setInterval(liveScan, 400);
    } catch (e) {
      setStatus(e.name === 'NotAllowedError' ? 'De camera mag niet gebruikt worden. Geef toestemming in de browser, of gebruik "Foto maken".' : 'De camera start niet: ' + e.message);
    }
  }

  function liveScan() {
    const video = $('live-video');
    if (!state.live || !video.videoWidth) return;
    const markers = Blok.recognize.detectMarkers(video, { sizes: [960], maxErrors: settings.maxErrors });
    const ov = $('photo-overlay');
    if (ov.width !== video.videoWidth) { ov.width = video.videoWidth; ov.height = video.videoHeight; }
    const ctx = ov.getContext('2d');
    ctx.clearRect(0, 0, ov.width, ov.height);
    ctx.lineWidth = Math.max(3, ov.width / 250);
    markers.forEach((m) => {
      const def = Blok.catalog.byCode(m.id);
      ctx.strokeStyle = def ? '#35E07A' : '#E5484D';
      ctx.beginPath();
      m.corners.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();
    });
    $('live-count').textContent = markers.length === 1 ? '1 codevierkantje in beeld' : markers.length + ' codevierkantjes in beeld';
  }

  function stopLive() {
    if (!state.live) return;
    clearInterval(state.live.timer);
    state.live.stream.getTracks().forEach((t) => t.stop());
    state.live = null;
    const video = $('live-video');
    video.srcObject = null;
    video.hidden = true;
    $('live-controls').hidden = true;
    if (state.image) {
      $('photo-canvas').hidden = false;
      const ov = $('photo-overlay');
      ov.width = state.image.width;
      ov.height = state.image.height;
    } else {
      $('photo-empty').hidden = false;
      $('photo-overlay').hidden = true;
    }
  }

  async function snapLive() {
    const video = $('live-video');
    if (!state.live || !video.videoWidth) return;
    const c = toCanvas(video);
    stopLive();
    setPhoto(c, 'camera');
    await processPhoto();
  }

  // ------------------------------------------------------------------ scan-tab
  function setMode(mode) {
    state.mode = mode;
    $('mode-markers').setAttribute('aria-pressed', mode === 'markers' ? 'true' : 'false');
    $('mode-ai').setAttribute('aria-pressed', mode === 'ai' ? 'true' : 'false');
    const help = $('mode-help');
    help.textContent = '';
    if (mode === 'markers') {
      help.textContent = 'Elk blok heeft een zwart-wit codevierkantje. Werkt zonder internet; de foto blijft op dit apparaat.';
    } else {
      help.appendChild(document.createTextNode('Voor zelf getekende blokken zonder codevierkantjes. De foto gaat naar Claude (Anthropic) om te lezen. '));
      const problem = aiProblem();
      if (problem) help.appendChild(el('button', { type: 'button', class: 'link', text: 'Eerst instellen', onclick: () => showTab('settings') }));
    }
    if (state.image && !state.live) {
      const again = el('button', { type: 'button', class: 'btn small', text: mode === 'ai' ? 'Lees deze foto met AI' : 'Lees deze foto opnieuw', onclick: processPhoto });
      setStatus('');
      $('status').appendChild(again);
    }
  }

  function initScan() {
    $('mode-markers').addEventListener('click', () => setMode('markers'));
    $('mode-ai').addEventListener('click', () => setMode('ai'));
    ['file-camera', 'file-pick'].forEach((id) => $(id).addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) loadFile(f, 'foto');
    }));
    $('btn-live').addEventListener('click', startLive);
    $('btn-live-stop').addEventListener('click', stopLive);
    $('btn-snap').addEventListener('click', snapLive);

    const wrap = $('photo-wrap');
    ['dragenter', 'dragover'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); wrap.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => wrap.addEventListener(ev, () => wrap.classList.remove('drag')));
    wrap.addEventListener('drop', (e) => {
      e.preventDefault();
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadFile(f, 'foto');
    });
    document.addEventListener('paste', (e) => {
      if ($('tab-scan').hidden) return;
      const item = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => i.type.startsWith('image/'));
      if (item) loadFile(item.getAsFile(), 'foto');
    });

    const sel = $('sample-select');
    Blok.samples.EXAMPLES.forEach((ex) => sel.appendChild(el('option', { value: ex.id, text: ex.name })));
    sel.addEventListener('change', async () => {
      const ex = Blok.samples.EXAMPLES.find((x) => x.id === sel.value);
      sel.value = '';
      if (ex) await loadExample(Blok.samples.scriptsOf(ex), ex.dropEnd);
    });

    const tsel = $('task-select');
    Blok.assignments.LIST.forEach((a) => tsel.appendChild(el('option', { value: a.id, text: a.title })));
    tsel.addEventListener('change', () => { state.assignment = tsel.value; reevaluate(); });

    $('btn-dl-script').addEventListener('click', () => {
      if (!state.result) return;
      download('mijn-scratch-code.svg', Blok.render.programSvg(state.result.scripts, { title: 'Mijn Scratch-code' }), 'image/svg+xml');
    });
    $('btn-dl-sb3').addEventListener('click', () => {
      if (!state.result) return;
      download('blokkenscanner.sb3', Blok.sb3.build(state.result.scripts), 'application/x.scratch.sb3');
    });
    renderOutcome();
  }

  async function loadExample(scripts, dropEnd) {
    stopLive();
    const prevMode = state.mode;
    if (prevMode !== 'markers') setMode('markers');
    setStatus('Voorbeeldfoto maken…', true);
    try {
      const canvas = await Blok.samples.photo(scripts, { dropEnd, rotate: -4, pxPerMm: 4, shade: 0.25, noise: 0.05, blur: 0.6 });
      setPhoto(canvas, 'voorbeeld');
      await processPhoto();
    } catch (e) {
      setStatus('Het voorbeeld lukte niet: ' + e.message);
    }
  }

  // ------------------------------------------------------------------ blokken-tab
  function initBlocks() {
    const setSel = $('set-select'), styleSel = $('style-select');
    Object.keys(Blok.sheets.SETS).forEach((k) => setSel.appendChild(el('option', { value: k, text: Blok.sheets.SETS[k].name })));
    setSel.value = store.get('set', 'klassenset');
    styleSel.value = store.get('style', 'kleur');
    const refresh = () => {
      store.set('set', setSel.value);
      store.set('style', styleSel.value);
      renderPieces();
    };
    setSel.addEventListener('change', refresh);
    styleSel.addEventListener('change', refresh);
    $('btn-sheets').addEventListener('click', () => {
      const pages = Blok.sheets.printSheets(setSel.value, styleSel.value);
      download(`blokken-${setSel.value}-${styleSel.value}-A4.zip`, Blok.zip(pages.map((p) => ({ name: p.name, data: p.svg }))), 'application/zip');
    });
    $('btn-zip').addEventListener('click', () => {
      download(`blokken-${setSel.value}-${styleSel.value}.zip`, Blok.sheets.zipPieces(setSel.value, [styleSel.value]), 'application/zip');
    });
    $('btn-zip-3d').addEventListener('click', () => {
      download(`blokken-${setSel.value}-3d.zip`, Blok.sheets.zipPieces(setSel.value, ['3d-vorm', '3d-tekst', '3d-marker', 'kleur']), 'application/zip');
    });
    $('btn-stickers').addEventListener('click', () => {
      const seen = {};
      const defs = Blok.sheets.setItems(setSel.value).filter((d) => (seen[d.id] ? false : (seen[d.id] = true)));
      const pages = Blok.sheets.stickerSheets(defs);
      download('stickers-codevierkantjes.zip', Blok.zip(pages.map((p) => ({ name: p.name, data: p.svg }))), 'application/zip');
    });
    renderPieces();
  }

  function renderPieces() {
    const setKey = $('set-select').value, style = $('style-select').value;
    const items = Blok.sheets.setItems(setKey);
    const counts = {};
    items.forEach((d) => { counts[d.id] = (counts[d.id] || 0) + 1; });
    const unique = Blok.catalog.all.filter((d) => counts[d.id]);
    const pages = Blok.sheets.pack(items).length;
    $('set-info').textContent = `${items.length} stukken, ${unique.length} verschillende, ${pages} A4-${pages === 1 ? 'vel' : 'vellen'}.`;
    const host = $('piece-list');
    host.innerHTML = '';
    Object.keys(Blok.CATEGORIES).forEach((catKey) => {
      const defs = unique.filter((d) => (catKey === 'sensing' ? d.cat === 'sensing' : d.cat === catKey));
      if (!defs.length) return;
      const cat = Blok.CATEGORIES[catKey];
      const grid = el('div', { class: 'piece-grid' });
      defs.forEach((d) => {
        const svg = Blok.render.pieceSvg(d, style);
        const title = d.kind === 'value' ? (d.type === 'color' ? 'kleur ' + d.label : d.value) : Blok.catalog.labelOf(d);
        const card = el('div', { class: 'piece' }, [
          el('div', { class: 'preview', html: svg.replace(/width="[\d.]+mm" height="[\d.]+mm"/, '') }),
          el('div', { class: 'meta' }, [
            el('strong', { text: title }),
            el('span', { class: 'code', text: `code ${d.code}` + (counts[d.id] > 1 ? ` · ${counts[d.id]}×` : '') }),
          ]),
          d.help ? el('p', { text: d.help }) : null,
          el('div', { class: 'btn-row' }, [
            el('button', { type: 'button', class: 'btn small', text: 'SVG', onclick: () => download(Blok.sheets.fileName(d, style).split('/').pop(), svg, 'image/svg+xml') }),
          ]),
        ]);
        grid.appendChild(card);
      });
      host.appendChild(el('div', { class: 'card' }, [
        el('div', { class: 'cat-title' }, [el('span', { class: 'swatch', style: `background:${cat.fill}` }), el('h2', { text: catKey === 'sensing' ? 'Waarnemen (voorwaarde-tegels)' : cat.name })]),
        grid,
      ]));
    });
  }

  // ------------------------------------------------------------------ opdrachten-tab
  function initTasks() {
    const host = $('task-list');
    Blok.assignments.LIST.filter((a) => a.check).forEach((a) => {
      const sol = a.solution.map((l) => Blok.program.script(l));
      const blocks = (a.blocks || []).map((id) => Blok.catalog.labelOf(Blok.catalog.byId(id)).replace(/\([^)]*\)/g, '( )')).join(' · ');
      const card = el('div', { class: 'card task' }, [
        el('h2', { text: a.title }),
        el('p', { text: a.goal }),
        a.hint ? el('p', { class: 'small muted', text: 'Tip voor leerlingen: ' + a.hint }) : null,
        blocks ? el('p', { class: 'small', text: 'Nodig: ' + blocks }) : null,
        el('details', {}, [
          el('summary', { text: 'Voorbeeldoplossing (voor de leerkracht)' }),
          el('div', { class: 'solution', html: Blok.render.programSvg(sol, { scale: 2.6, title: 'Voorbeeldoplossing ' + a.title }) }),
        ]),
        el('div', { class: 'btn-row' }, [
          el('button', { type: 'button', class: 'btn small', text: 'Kies deze opdracht', onclick: () => chooseTask(a.id) }),
          el('button', { type: 'button', class: 'btn small', text: 'Scan de voorbeeldoplossing', onclick: () => { chooseTask(a.id); loadExample(a.solution.map((l) => Blok.program.script(l))); } }),
        ]),
      ]);
      host.appendChild(card);
    });
  }

  function chooseTask(id) {
    state.assignment = id;
    $('task-select').value = id;
    reevaluate();
    renderOutcome();
    showTab('scan');
  }

  // ------------------------------------------------------------------ instellingen
  function initSettings() {
    const key = $('api-key'), remember = $('api-remember'), model = $('api-model'), consent = $('api-consent'), maxErr = $('max-errors');
    Blok.ai.MODELS.forEach((m) => model.appendChild(el('option', { value: m.id, text: m.name })));
    key.value = settings.apiKey;
    remember.checked = settings.remember;
    model.value = settings.model;
    consent.checked = settings.consent;
    maxErr.value = String(settings.maxErrors);
    const save = () => {
      settings.apiKey = key.value.trim();
      settings.remember = remember.checked;
      settings.model = model.value;
      settings.consent = consent.checked;
      settings.maxErrors = Number(maxErr.value);
      store.set('model', settings.model);
      store.set('consent', settings.consent);
      store.set('remember', settings.remember);
      store.set('maxErrors', settings.maxErrors);
      store.remove('apiKey');
      if (settings.apiKey) store.set('apiKey', settings.apiKey, !settings.remember);
      const problem = aiProblem();
      $('api-state').textContent = problem || 'De AI-modus is klaar voor gebruik.';
    };
    [key, remember, model, consent, maxErr].forEach((i) => i.addEventListener('change', save));
    key.addEventListener('input', save);
    save();
  }

  // ------------------------------------------------------------------ start
  function start() {
    initTabs();
    initScan();
    initStage();
    initBlocks();
    initTasks();
    initSettings();
    setMode('markers');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  Blok.app = { state, processPhoto, loadExample, showTab };
})(globalThis.Blok = globalThis.Blok || {});
