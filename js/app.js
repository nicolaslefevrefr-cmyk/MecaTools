/* app.js — interface : bibliothèque, paramètres, visualisation 3D, export STL */
(function () {
  'use strict';
  const MP = window.MP, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const STORE = 'atelier-meca-v1';
  const QUALITY = { draft: 24, std: 48, fine: 72 };
  const state = { part: 'nut', params: null, quality: 'std', preset: null };
  let viewer = null, built = null, buildTimer = 0, checkTimer = 0, lastPartId = null;

  /* ---------- Utilitaires ---------- */
  const fmt = (v) => (Math.round(v * 1000) / 1000).toString();
  const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[×·]/g, 'x').replace(/[^A-Za-z0-9.]+/g, '_').replace(/^_+|_+$/g, '');
  const part = () => MP.PARTS[state.part];
  const num = (v) => (typeof v === 'number' && isFinite(v));
  function save() { try { localStorage.setItem(STORE, JSON.stringify({ part: state.part, params: state.params, quality: state.quality })); } catch (e) {} }
  function restore() {
    try {
      const o = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (o && MP.PARTS[o.part]) { state.part = o.part; state.params = Object.assign(MP.PARTS[o.part].defaults(), o.params); state.quality = o.quality || 'std'; return; }
    } catch (e) {}
    state.params = part().defaults();
  }

  /* ---------- Chargement d'une pièce ---------- */
  function loadPart(id, over, presetKey) {
    const P = MP.PARTS[id];
    const p = P.defaults();
    if (over) { if (over.size && P.fill) { p.size = over.size; P.fill(p); } Object.assign(p, over); if (over.bore !== undefined) MP.keyFill(Object.assign(p, over)); Object.assign(p, over); }
    state.part = id; state.params = p; state.preset = presetKey || null;
    renderLibrary(); renderParams(); scheduleBuild(0);
  }

  /* ---------- Reconstruction du maillage ---------- */
  function scheduleBuild(delay) { clearTimeout(buildTimer); buildTimer = setTimeout(rebuild, delay === undefined ? 90 : delay); }
  function rebuild() {
    const P = part(), t0 = performance.now();
    $('#part-title').textContent = P.label(state.params);
    $('#part-std').textContent = P.name + ' · ' + P.std;
    let r;
    try { r = P.build(state.params, { N: QUALITY[state.quality] }); }
    catch (e) { console.error(e); setHud(null, e.message); return; }
    if (!r.mesh || !r.mesh.idx.length) { setHud(null, 'Paramètres incohérents : aucune géométrie.'); return; }
    built = { r, label: P.label(state.params), ms: performance.now() - t0 };
    if (viewer) viewer.setMesh(r.mesh, lastPartId === state.part);
    lastPartId = state.part;
    showInfo(r);
    setHud(r);
    save();
  }
  function setHud(r, err) {
    const chk = $('#hud-check');
    if (!r) { $('#hud-dims').textContent = '—'; $('#hud-mass').textContent = '—'; chk.textContent = err || 'Erreur'; chk.className = 'chip bad'; return; }
    const bb = MP.bbox(r.mesh);
    $('#hud-dims').textContent = bb.size.map((v) => (Math.round(v * 100) / 100)).join(' × ') + ' mm';
    const vol = Math.abs(MP.volume(r.mesh));
    const gr = vol / 1000 * 1.24;
    $('#hud-mass').textContent = (gr >= 10 ? gr.toFixed(1) : gr.toFixed(2)) + ' g PLA · ' + Math.round(r.mesh.idx.length / 300) / 10 + ' k tri.';
    chk.textContent = 'Contrôle…'; chk.className = 'chip';
    clearTimeout(checkTimer);
    checkTimer = setTimeout(() => {
      const c = MP.check(r.mesh);
      chk.textContent = c.watertight ? 'Maillage étanche ✓' : 'Maillage non étanche (' + c.badEdges + ' arêtes)';
      chk.className = 'chip ' + (c.watertight ? 'ok' : 'bad');
    }, 30);
    const wb = $('#warnbar');
    if (r.warnings && r.warnings.length) { wb.hidden = false; wb.innerHTML = '<ul>' + r.warnings.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul>'; }
    else wb.hidden = true;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Export STL ---------- */
  function exportSTL() {
    if (!built) return;
    const c = MP.check(built.r.mesh);
    if (!c.watertight && !confirm('Le maillage présente ' + c.badEdges + ' arêtes ouvertes. Exporter quand même ?')) return;
    const buf = MP.toSTL(built.r.mesh, built.label);
    const blob = new Blob([buf], { type: 'model/stl' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = slug(built.label) + '.stl';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ---------- Bibliothèque ---------- */
  function isActive(item, pr) {
    if (state.part !== item.part) return false;
    const p = state.params, o = pr.over;
    return Object.keys(o).every((k) => (typeof o[k] === 'number' ? Math.abs(p[k] - o[k]) < 1e-9 : p[k] === o[k]));
  }
  function renderLibrary() {
    const q = $('#lib-search').value.trim().toLowerCase(), box = $('#lib-list');
    let html = '', any = false;
    for (const grp of MP.LIBRARY) {
      let gh = '';
      for (const item of grp.items) {
        const hay = (item.title + ' ' + item.std + ' ' + item.part).toLowerCase();
        const match = !q || hay.includes(q);
        const pres = item.presets.map((pr, i) => ({ pr, i })).filter((x) => match || x.pr.label.toLowerCase().includes(q));
        if (!pres.length) continue;
        any = true;
        const open = state.part === item.part || (q && pres.length) ? ' open' : '';
        gh += '<details class="lib-item"' + open + '><summary><span class="name">' + esc(item.title) + '</span><span class="std">' + esc(item.std) + '</span></summary><div class="chips">' +
          pres.map((x) => '<button class="pchip' + (isActive(item, x.pr) ? ' active' : '') + '" data-part="' + item.part + '" data-i="' + x.i + '">' + esc(x.pr.label) + '</button>').join('') + '</div></details>';
      }
      if (gh) html += '<div class="lib-group">' + esc(grp.group) + '</div>' + gh;
    }
    box.innerHTML = any ? html : '<p class="lib-empty">Aucune pièce ne correspond à « ' + esc(q) + ' ».</p>';
  }
  $('#lib-list').addEventListener('click', (e) => {
    const b = e.target.closest('.pchip'); if (!b) return;
    const item = MP.LIBRARY.flatMap((g) => g.items).find((it) => it.part === b.dataset.part);
    loadPart(item.part, item.presets[+b.dataset.i].over);
    closeDrawers();
  });
  $('#lib-search').addEventListener('input', renderLibrary);

  /* ---------- Formulaire de paramètres ---------- */
  function optionsOf(f, p) { return typeof f.options === 'function' ? f.options(p) : f.options; }
  function renderParams() {
    const P = part(), p = state.params, body = $('#params-body');
    const table = P.table ? P.table(p) : {};
    let html = '', last = '';
    for (const f of P.params) {
      if (f.section !== last) { html += '<div class="sect">' + esc(f.section) + '</div>'; last = f.section; }
      if (f.showIf && !f.showIf(p)) continue;
      const v = p[f.key];
      let dot = '';
      if (f.std && table[f.key] !== undefined) dot = '<i class="dot ' + (Math.abs(table[f.key] - v) < 1e-9 ? 'iso' : 'mod') + '" title="' + (Math.abs(table[f.key] - v) < 1e-9 ? 'Cote ISO' : 'Cote modifiée (ISO : ' + fmt(table[f.key]) + ')') + '"></i>';
      let ctl;
      if (f.type === 'check') {
        ctl = '<input type="checkbox" class="chk" data-k="' + f.key + '"' + (v ? ' checked' : '') + '>';
      } else if (f.type === 'select') {
        const opts = optionsOf(f, p);
        ctl = '<select data-k="' + f.key + '">' + opts.map((o) => '<option value="' + o.v + '"' + (String(o.v) === String(v) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select>';
      } else {
        ctl = '<input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-k="' + f.key + '" value="' + fmt(v) + '"' + (f.hints ? ' list="dl-' + f.key + '"' : '') + '>';
        if (f.hints) ctl += '<datalist id="dl-' + f.key + '">' + f.hints.map((h) => '<option value="' + h + '"></option>').join('') + '</datalist>';
        ctl += '<span class="unit">' + (f.unit || '') + '</span>';
      }
      const slider = f.type === 'number' && !f.hints && f.max - f.min > 0 ? '<input type="range" data-k="' + f.key + '" min="' + f.min + '" max="' + f.max + '" step="' + (f.step || 0.1) + '" value="' + v + '" aria-label="' + esc(f.label) + '">' : '';
      html += '<div class="field"><div class="frow">' + dot + '<label>' + esc(f.label) + '</label><div class="ctl">' + ctl + '</div></div>' + slider + (f.help ? '<p class="help">' + esc(f.help) + '</p>' : '') + '</div>';
    }
    html += '<div class="sect">Affichage et maillage</div><div class="field"><div class="frow"><label>Qualité du maillage</label><div class="ctl"><select data-q>' +
      [['draft', 'Brouillon (rapide)'], ['std', 'Standard'], ['fine', 'Fin (STL lourd)']].map((o) => '<option value="' + o[0] + '"' + (o[0] === state.quality ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div></div>' +
      '<p class="help">« Fin » affine les filetages et les dentures ; le fichier STL est alors plus volumineux.</p></div>';
    html += '<div class="sect">Cotes calculées</div><div class="info" id="info"></div>';
    html += '<p class="legend"><i class="dot iso"></i> cote ISO <i class="dot mod"></i> cote modifiée</p>';
    body.innerHTML = html;
    if (built) showInfo(built.r);
  }
  function showInfo(r) {
    const el = $('#info'); if (!el) return;
    el.innerHTML = r.info.map((x) => '<div><span>' + esc(x[0]) + '</span><span>' + esc(x[1]) + '</span></div>').join('');
  }
  function refreshDots() {
    const P = part(), p = state.params, table = P.table ? P.table(p) : {};
    for (const f of P.params) {
      if (!f.std || table[f.key] === undefined) continue;
      const inp = $('[data-k="' + f.key + '"]', $('#params-body')); if (!inp) continue;
      const dot = inp.closest('.field').querySelector('.dot'); if (!dot) continue;
      const same = Math.abs(table[f.key] - p[f.key]) < 1e-9;
      dot.className = 'dot ' + (same ? 'iso' : 'mod');
      dot.title = same ? 'Cote ISO' : 'Cote modifiée (ISO : ' + fmt(table[f.key]) + ')';
    }
  }
  function setParam(k, raw, fromRange) {
    const P = part(), f = P.params.find((x) => x.key === k); if (!f) return;
    let v = raw;
    if (f.type === 'check') v = !!raw;
    else if (f.type === 'select') v = (f.numeric ? parseFloat(raw) : raw);
    else { v = parseFloat(String(raw).replace(',', '.')); if (!num(v)) return; v = Math.min(f.max, Math.max(f.min, v)); }
    state.params[k] = v;
    if (k === 'size' && MP.CATALOG.THREADS[v] && 'P' in state.params) state.params.P = MP.CATALOG.THREADS[v].coarse; // pas gros par défaut
    if (k === 'size' && P.fill) { P.fill(state.params); renderParams(); }
    else if (k === 'key') renderParams();
    else if (k === 'bore' && P.params.some((x) => x.key === 'key')) { MP.keyFill(state.params); renderParams(); }
    else {
      // synchronise champ numérique et curseur (sauf celui en cours de saisie)
      $$('[data-k="' + k + '"]', $('#params-body')).forEach((el) => { if (el === document.activeElement || el.tagName === 'SELECT') return; el.value = el.type === 'range' ? v : fmt(v); });
      refreshDots();
      if (k === 'P') renderParams();
    }
    state.preset = null;
    scheduleBuild(fromRange ? 40 : 110);
  }
  $('#params-body').addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.q !== undefined) return;
    if (t.dataset.k && t.tagName === 'INPUT' && t.type !== 'checkbox') {
      const v = parseFloat(String(t.value).replace(',', '.'));
      if (num(v)) { const f = part().params.find((x) => x.key === t.dataset.k); if (f && v >= f.min && v <= f.max) setParam(t.dataset.k, v, t.type === 'range'); }
    }
  });
  $('#params-body').addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.q !== undefined) { state.quality = t.value; scheduleBuild(0); save(); return; }
    if (!t.dataset.k) return;
    if (t.type === 'checkbox') setParam(t.dataset.k, t.checked);
    else if (t.tagName === 'SELECT') setParam(t.dataset.k, t.value);
    else { setParam(t.dataset.k, t.value); const f = part().params.find((x) => x.key === t.dataset.k); t.value = fmt(state.params[t.dataset.k]); renderLibrary(); }
  });
  $('#btn-reset').addEventListener('click', () => {
    const P = part();
    if (P.fill) P.fill(state.params); else state.params = P.defaults();
    renderParams(); scheduleBuild(0);
  });

  /* ---------- Tiroirs ---------- */
  function openDrawer(id) {
    closeDrawers();
    const d = $('#' + id); d.classList.add('open'); d.setAttribute('aria-hidden', 'false');
    $('#scrim').hidden = false;
    $('#btn-lib').setAttribute('aria-expanded', String(id === 'drawer-lib'));
    $('#btn-params').setAttribute('aria-expanded', String(id === 'drawer-params'));
  }
  function closeDrawers() {
    $$('.drawer').forEach((d) => { d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); });
    $('#scrim').hidden = true;
    $('#btn-lib').setAttribute('aria-expanded', 'false'); $('#btn-params').setAttribute('aria-expanded', 'false');
  }
  $('#btn-lib').addEventListener('click', () => { renderLibrary(); openDrawer('drawer-lib'); });
  $('#btn-params').addEventListener('click', () => openDrawer('drawer-params'));
  $('#scrim').addEventListener('click', closeDrawers);
  $$('[data-close]').forEach((b) => b.addEventListener('click', closeDrawers));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawers(); });
  $('#btn-export').addEventListener('click', exportSTL);
  $('#btn-export2').addEventListener('click', exportSTL);

  /* ---------- Barre de vues ---------- */
  $$('.vb[data-view]').forEach((b) => b.addEventListener('click', () => {
    $$('.vb[data-view]').forEach((x) => x.classList.toggle('active', x === b));
    if (viewer) viewer.view(b.dataset.view);
  }));
  $('#tg-wire').addEventListener('click', (e) => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', on); e.currentTarget.classList.toggle('active', on); if (viewer) viewer.setWire(on); });
  $('#tg-grid').addEventListener('click', (e) => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', on); e.currentTarget.classList.toggle('active', on); if (viewer) viewer.setGrid(on); });

  /* ---------- PWA (version zip uniquement) ---------- */
  if (!window.__STANDALONE__) {
    let deferred = null;
    const installed = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; if (!installed) $('#btn-install').hidden = false; });
    window.addEventListener('appinstalled', () => { $('#btn-install').hidden = true; deferred = null; });
    $('#btn-install').addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch (e) {} deferred = null; $('#btn-install').hidden = true; });
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }

  /* ---------- Démarrage ---------- */
  restore();
  try { viewer = new window.Viewer($('#viewport')); } catch (e) { console.error(e); }
  renderLibrary(); renderParams(); rebuild();
  window.__app = { state, loadPart, rebuild, exportSTL };
})();
