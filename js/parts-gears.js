/* parts-gears.js — engrenages droits / hélicoïdaux, crémaillère, vis sans fin, roue à vis */
(function (root) {
  'use strict';
  const MP = (root.MP = root.MP || {});
  const C = MP.CATALOG, TAU = MP.TAU, DEG = MP.DEG, tan = Math.tan, cos = Math.cos;
  const PARTS = (MP.PARTS = MP.PARTS || {});
  const f2 = (v) => (Math.round(v * 100) / 100).toString();
  const f3 = (v) => (Math.round(v * 1000) / 1000).toString();
  const handOpts = [{ v: 'R', label: 'Droite' }, { v: 'L', label: 'Gauche' }];

  /* ---------- Géométrie d'une denture en développante (section transversale) ----------
     o : z, mt (module transversal), alphaT, ha, hf (saillie / creux en mm), st (épaisseur transversale au primitif) */
  function gearGeometry(o, nf) {
    const r = o.mt * o.z / 2, rb = r * cos(o.alphaT), ra = r + o.ha, rf = r - o.hf, warn = [];
    const invAt = MP.inv(o.alphaT);
    const psi = (rho) => o.st / (2 * r) + invAt - MP.inv(Math.acos(Math.min(1, rb / rho)));
    let raE = ra;
    const wTip = (rho) => psi(rho) * rho - 0.05 * o.mt; // demi-épaisseur de tête restante
    if (wTip(ra) < 0) {
      let lo = Math.max(rb, r), hi = ra;
      for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (wTip(mid) > 0) lo = mid; else hi = mid; }
      raE = lo;
      warn.push('Dents pointues : diamètre de tête réduit (déport trop grand ou trop peu de dents).');
    }
    if (rf < 0.2) warn.push('Diamètre de pied trop petit.');
    const undercut = rf < rb - 1e-9, rs = Math.max(rb, rf);
    const zmin = 2 * (1 - (o.x || 0)) / Math.pow(Math.sin(o.alphaT), 2);
    if (o.z < zmin - 1e-9) warn.push('Sous-coupe théorique (z < ' + Math.ceil(zmin) + ') : augmenter z ou le déport x.');
    const tau = TAU / o.z, pts = [];
    const root = undercut ? psi(rb) : psi(rs);
    if (tau - 2 * root < 0.01) warn.push('Dents trop épaisses : le creux de pied est quasi nul (réduire le déport).');
    for (let j = 0; j < o.z; j++) {
      const ph = j * tau;
      if (undercut) pts.push({ th: ph - root, rho: rf });
      for (let k = 0; k <= nf; k++) { const rho = rs + (raE - rs) * k / nf; pts.push({ th: ph - psi(rho), rho }); }
      if (psi(raE) > 0.005) pts.push({ th: ph, rho: raE });
      for (let k = nf; k >= 0; k--) { const rho = rs + (raE - rs) * k / nf; pts.push({ th: ph + psi(rho), rho }); }
      if (undercut) pts.push({ th: ph + root, rho: rf });
      const gap = tau - 2 * root, n = Math.max(0, Math.ceil(gap / 0.1) - 1);
      for (let k = 1; k <= n; k++) pts.push({ th: ph + root + gap * k / (n + 1), rho: rf });
    }
    return { pts, r, rb, ra: raE, rf, warnings: warn };
  }

  /* ---------- Solide d'engrenage (alésage, rainure de clavette, moyeu, hélice) ---------- */
  function gearSolid(g, o) {
    const H = o.H, a = o.bore > 0.05 ? o.bore / 2 : 0, warn = [];
    const kw = a > 0 && o.key ? MP.keyway(a, o.key, warn) : null;
    const reach = kw ? a + kw.t : a;
    let rh = 0, hl = 0;
    if (o.hubD > 0 && o.hubL > 0) {
      rh = o.hubD / 2; hl = o.hubL;
      if (rh > g.rf - 0.2) { rh = g.rf - 0.2; warn.push('Diamètre de moyeu limité au diamètre de pied.'); }
      if (rh < reach + 0.5) { rh = reach + 0.5; warn.push('Diamètre de moyeu relevé : paroi minimale de 0,5 mm autour de l\u2019alésage' + (kw ? ' et de la rainure.' : '.')); }
    }
    if (a > 0 && a > g.rf - 0.4) warn.push('Alésage trop grand pour la roue.');
    else if (kw && reach > (rh || g.rf) - 0.4) warn.push('Rainure trop profonde : moins de 0,4 mm de paroi restante.');
    const pts = kw ? MP.insertAngles(g.pts, kw.extras) : g.pts;
    const th = pts.map((q) => q.th), zTop = rh ? H + hl : H;
    const S = o.tw ? Math.max(1, Math.min(80, Math.ceil(Math.abs(o.tw) * H * 8 / (TAU / o.z)))) : 1;
    const zs = []; for (let s = 0; s <= S; s++) zs.push(H * s / S);
    const tw = o.tw || 0;
    const mesh = MP.revolve({
      thetas: th, twist: tw ? (z) => tw * Math.min(Math.max(z, 0), H) : null,
      column(i) {
        const rho = pts[i].rho, ch = a > 0 ? MP.boreChain(th[i], a, kw, 0, zTop) : null;
        const out = [ch ? ch[ch.length - 1] : [0, 0]];
        for (const z of zs) out.push([rho, z]);
        if (rh) out.push([rh, H], [rh, H + hl]);
        if (ch) for (const q of ch) out.push(q); else out.push([0, zTop]);
        return out;
      }
    });
    return { mesh, warnings: warn, kw };
  }
  const keyOf = (p) => (p.key && p.bore > 0 ? { w: p.keyW, t: p.keyT, len: p.keyL } : null);
  const keyInfo = (p) => (p.key && p.bore > 0 ? [['Rainure de clavette', p.keyW + ' × ' + p.keyT + ' mm (au-dessus de l\u2019alésage), longueur ' + (p.keyL >= 200 ? 'traversante' : p.keyL + ' mm')]] : []);

  const gearBase = [
    { key: 'z', label: 'Nombre de dents z', type: 'number', min: 6, max: 200, step: 1, section: 'Denture' },
    { key: 'x', label: 'Coefficient de déport x', type: 'number', min: -0.6, max: 1, step: 0.05, section: 'Denture' },
    { key: 'j', label: 'Jeu de denture (impression)', unit: 'mm', type: 'number', min: 0, max: 0.6, step: 0.02, section: 'Denture',
      help: "Amincit chaque dent de cette valeur. 0 = profil théorique ; 0,05 à 0,2 mm est courant en impression 3D." },
    { key: 'b', label: 'Largeur de denture b', unit: 'mm', type: 'number', min: 1, max: 100, step: 0.5, section: 'Corps' },
    { key: 'bore', label: 'Alésage', unit: 'mm', type: 'number', min: 0, max: 60, step: 0.1, section: 'Corps',
      help: '0 = roue pleine. Alésages usuels : 3, 4, 5, 6, 8, 10 mm (ajouter ~0,1 mm de jeu pour une impression FDM).' },
    { key: 'hubD', label: 'Diamètre de moyeu', unit: 'mm', type: 'number', min: 0, max: 80, step: 0.5, section: 'Corps' },
    { key: 'hubL', label: 'Longueur de moyeu', unit: 'mm', type: 'number', min: 0, max: 60, step: 0.5, section: 'Corps' }
  ].concat(MP.keyParams('Corps'));
  const resOf = (ctx) => (ctx.N >= 72 ? 16 : ctx.N <= 24 ? 6 : 10);

  /* ================= Engrenage droit (ISO 53) ================= */
  PARTS.spur = {
    id: 'spur', name: 'Engrenage droit', group: 'Transmission', std: 'ISO 53 · module ISO 54', icon: 'gear',
    defaults() { return Object.assign({ m: 1, z: 20, alpha: 20, x: 0, j: 0, b: 8, bore: 5, hubD: 0, hubL: 0 }, MP.keyDefaults(5)); },
    params: [{ key: 'm', label: 'Module m', unit: 'mm', type: 'number', min: 0.1, max: 20, step: 0.05, hints: C.MODULES, section: 'Denture' },
      { key: 'alpha', label: 'Angle de pression', unit: '°', type: 'number', min: 14.5, max: 25, step: 0.5, section: 'Denture' }].concat(gearBase),
    label(p) { return 'Engrenage droit m' + p.m + ' z' + p.z; },
    build(p, ctx) {
      const a = p.alpha * DEG, st = p.m * (Math.PI / 2 + 2 * p.x * tan(a)) - p.j;
      const g = gearGeometry({ z: p.z, mt: p.m, alphaT: a, ha: (1 + p.x) * p.m, hf: (1.25 - p.x) * p.m, st, x: p.x }, resOf(ctx));
      const s = gearSolid(g, { H: p.b, bore: p.bore, hubD: p.hubD, hubL: p.hubL, z: p.z, key: keyOf(p) });
      const info = [['Désignation', this.label(p)], ['Diamètre primitif d', f3(p.m * p.z) + ' mm'], ['Diamètre de tête da', f3(2 * g.ra) + ' mm'],
        ['Diamètre de pied df', f3(2 * g.rf) + ' mm'], ['Diamètre de base db', f3(2 * g.rb) + ' mm'], ['Pas p = π·m', f3(Math.PI * p.m) + ' mm'],
        ['Entraxe avec une roue de même taille', f3(p.m * p.z) + ' mm']].concat(keyInfo(p));
      return { mesh: s.mesh, info, warnings: g.warnings.concat(s.warnings) };
    }
  };

  /* ================= Engrenage hélicoïdal ================= */
  PARTS.helical = {
    id: 'helical', name: 'Engrenage hélicoïdal', group: 'Transmission', std: 'ISO 21771 · module normal', icon: 'helical',
    defaults() { return Object.assign({ m: 1, z: 20, beta: 15, hand: 'R', alpha: 20, x: 0, j: 0, b: 14, bore: 5, hubD: 0, hubL: 0 }, MP.keyDefaults(5)); },
    params: [{ key: 'm', label: 'Module normal mn', unit: 'mm', type: 'number', min: 0.1, max: 20, step: 0.05, hints: C.MODULES, section: 'Denture' },
      { key: 'beta', label: "Angle d'hélice β", unit: '°', type: 'number', min: 5, max: 45, step: 0.5, section: 'Denture' },
      { key: 'hand', label: "Sens de l'hélice", type: 'select', options: handOpts, section: 'Denture' },
      { key: 'alpha', label: 'Angle de pression normal', unit: '°', type: 'number', min: 14.5, max: 25, step: 0.5, section: 'Denture' }].concat(gearBase),
    label(p) { return 'Engrenage hélicoïdal m' + p.m + ' z' + p.z + ' β' + p.beta + (p.hand === 'L' ? ' G' : ' D'); },
    build(p, ctx) {
      const be = p.beta * DEG, an = p.alpha * DEG, mt = p.m / cos(be), at = Math.atan(tan(an) / cos(be));
      const st = mt * (Math.PI / 2 + 2 * p.x * tan(an)) - p.j / cos(be);
      const g = gearGeometry({ z: p.z, mt, alphaT: at, ha: (1 + p.x) * p.m, hf: (1.25 - p.x) * p.m, st, x: p.x }, resOf(ctx));
      const tw = (p.hand === 'L' ? -1 : 1) * tan(be) / g.r;
      const s = gearSolid(g, { H: p.b, bore: p.bore, hubD: p.hubD, hubL: p.hubL, tw, z: p.z, key: keyOf(p) });
      const eps = p.b * Math.sin(be) / (Math.PI * p.m), warn = g.warnings.concat(s.warnings);
      if (eps < 1) warn.push('Recouvrement εβ < 1 : augmenter la largeur ou l’angle d’hélice pour un engrènement progressif.');
      const info = [['Désignation', this.label(p)], ['Module transversal mt', f3(mt) + ' mm'], ['Diamètre primitif d', f3(2 * g.r) + ' mm'],
        ['Diamètre de tête da', f3(2 * g.ra) + ' mm'], ['Diamètre de pied df', f3(2 * g.rf) + ' mm'], ['Diamètre de base db', f3(2 * g.rb) + ' mm'],
        ['Recouvrement εβ', f2(eps)], ['Engrènement', 'avec une roue d’hélice de sens opposé (axes parallèles)']];
      return { mesh: s.mesh, info, warnings: warn };
    }
  };

  /* ================= Crémaillère ================= */
  PARTS.rack = {
    id: 'rack', name: 'Crémaillère', group: 'Transmission', std: 'ISO 53 · profil de référence', icon: 'rack',
    defaults() { return { m: 1, nt: 12, alpha: 20, j: 0, b: 8, body: 4 }; },
    params: [
      { key: 'm', label: 'Module m', unit: 'mm', type: 'number', min: 0.1, max: 20, step: 0.05, hints: C.MODULES, section: 'Denture' },
      { key: 'nt', label: 'Nombre de dents', type: 'number', min: 2, max: 200, step: 1, section: 'Denture' },
      { key: 'alpha', label: 'Angle de pression', unit: '°', type: 'number', min: 14.5, max: 25, step: 0.5, section: 'Denture' },
      { key: 'j', label: 'Jeu de denture (impression)', unit: 'mm', type: 'number', min: 0, max: 0.6, step: 0.02, section: 'Denture' },
      { key: 'b', label: 'Largeur b', unit: 'mm', type: 'number', min: 1, max: 100, step: 0.5, section: 'Corps' },
      { key: 'body', label: 'Épaisseur sous le pied', unit: 'mm', type: 'number', min: 0.5, max: 40, step: 0.5, section: 'Corps' }
    ],
    label(p) { return 'Crémaillère m' + p.m + ' ×' + p.nt + ' dents'; },
    build(p) {
      const m = p.m, pp = Math.PI * m, ta = tan(p.alpha * DEG), ha = m, hf = 1.25 * m, warn = [];
      const half = pp / 4 - p.j / 2, tip = half - ha * ta, rootH = half + hf * ta;
      if (tip < 0.05 * m) warn.push('Tête de dent pointue : réduire le jeu de denture.');
      const L = pp * p.nt, top = [[0, -hf]];
      for (let k = 0; k < p.nt; k++) {
        const xc = k * pp + pp / 2;
        top.push([xc - rootH, -hf], [xc - tip, ha], [xc + tip, ha], [xc + rootH, -hf]);
      }
      top.push([L, -hf]);
      const poly = [[0, -hf - p.body], [L, -hf - p.body]].concat(top.slice().reverse());
      const mesh = MP.extrude(poly, 0, p.b);
      const info = [['Désignation', this.label(p)], ['Pas p = π·m', f3(pp) + ' mm'], ['Longueur', f2(L) + ' mm'], ['Hauteur de denture', f3(ha + hf) + ' mm'],
        ['Hauteur totale', f2(ha + hf + p.body) + ' mm'], ['Ligne primitive', f2(hf + p.body) + ' mm au-dessus de la base']];
      return { mesh, info, warnings: warn };
    }
  };

  /* ================= Vis sans fin (profil axial ZA, DIN 3975) ================= */
  const wormQ = C.WORM_Q;
  PARTS.worm = {
    id: 'worm', name: 'Vis sans fin', group: 'Transmission', std: 'DIN 3975 · ISO/TR 10828', icon: 'worm',
    defaults() { return Object.assign({ m: 1, z1: 1, q: 10, alpha: 20, hand: 'R', L: 20, bore: 0, j: 0 }, MP.keyDefaults(5)); },
    params: [
      { key: 'm', label: 'Module axial m', unit: 'mm', type: 'number', min: 0.1, max: 20, step: 0.05, hints: C.MODULES, section: 'Filet' },
      { key: 'z1', label: "Nombre de filets z1 (entrées)", type: 'number', min: 1, max: 6, step: 1, section: 'Filet' },
      { key: 'q', label: 'Quotient diamétral q = d1/m', type: 'number', min: 5, max: 25, step: 0.1, hints: wormQ, section: 'Filet' },
      { key: 'hand', label: "Sens de l'hélice", type: 'select', options: handOpts, section: 'Filet' },
      { key: 'alpha', label: 'Angle de pression axial', unit: '°', type: 'number', min: 14.5, max: 25, step: 0.5, section: 'Filet' },
      { key: 'j', label: 'Jeu de filet (impression)', unit: 'mm', type: 'number', min: 0, max: 0.6, step: 0.02, section: 'Filet' },
      { key: 'L', label: 'Longueur de la vis', unit: 'mm', type: 'number', min: 2, max: 200, step: 0.5, section: 'Corps' },
      { key: 'bore', label: 'Alésage', unit: 'mm', type: 'number', min: 0, max: 40, step: 0.1, section: 'Corps' }
    ].concat(MP.keyParams('Corps')),
    label(p) { return 'Vis sans fin m' + p.m + ' z' + p.z1 + ' q' + p.q + (p.hand === 'L' ? ' G' : ' D'); },
    build(p, ctx) {
      const N = ctx.N, m = p.m, d1 = p.q * m, px = Math.PI * m, lead = p.z1 * px, ta = tan(p.alpha * DEG), warn = [];
      const rTip = d1 / 2 + m, rRoot = d1 / 2 - 1.2 * m, half = px / 4 - p.j / 2;
      const tipH = half - m * ta, rootH = half + 1.2 * m * ta;
      if (tipH < 0.05 * m) warn.push('Sommet de filet pointu : réduire le jeu de filet.');
      if (rootH * 2 > px - 0.02) warn.push('Filet trop épais : creux de pied nul.');
      if (p.bore / 2 > rRoot - 0.4) warn.push('Alésage trop grand : paroi de moins de 0,4 mm sous le fond de filet.');
      const f = MP.periodic([[0, rTip], [tipH, rTip], [rootH, rRoot], [px - rootH, rRoot], [px - tipH, rTip]], px);
      const a = p.bore > 0.05 ? p.bore / 2 : 0;
      const kw = a > 0 && p.key ? MP.keyway(a, { w: p.keyW, t: p.keyT, len: p.keyL }, warn) : null;
      if (kw && a + kw.t > rRoot - 0.4) warn.push('Rainure trop profonde : moins de 0,4 mm de paroi sous le fond de filet.');
      const th = MP.ringThetas(N, kw ? kw.extras : []);
      const mesh = MP.revolve({
        thetas: th, open: true,
        column(i) {
          const ch = MP.helixColumn(th[i], { f, period: px, lead, hand: p.hand, zref: 0, z0: 0, z1: p.L, post: (r) => r, fineDz: px / 12 });
          const bc = a > 0 ? MP.boreChain(th[i], a, kw, 0, p.L) : null;
          return [bc ? bc[bc.length - 1] : [0, 0]].concat(ch, bc || [[0, p.L]]);
        }
      });
      const gam = Math.atan(p.z1 / p.q) / DEG;
      const info = [['Désignation', this.label(p)], ['Diamètre primitif d1 = q·m', f3(d1) + ' mm'], ['Diamètre de tête da1', f3(2 * rTip) + ' mm'],
        ['Diamètre de pied df1', f3(2 * rRoot) + ' mm'], ['Pas axial px = π·m', f3(px) + ' mm'], ['Pas hélicoïdal (avance) pz', f3(lead) + ' mm'],
        ['Angle d’hélice γ', f2(gam) + '°'], ['Roue conjuguée', 'module ' + m + ', β = ' + f2(gam) + '°, même sens']].concat(keyInfo(p));
      return { mesh, info, warnings: warn };
    }
  };

  /* ================= Roue à vis (roue hélicoïdale non gorge) ================= */
  PARTS.wormwheel = {
    id: 'wormwheel', name: 'Roue à vis', group: 'Transmission', std: 'DIN 3975 · roue hélicoïdale', icon: 'wheel',
    defaults() { return Object.assign({ m: 1, z2: 30, z1: 1, q: 10, alpha: 20, hand: 'R', j: 0, b: 8, bore: 5, hubD: 0, hubL: 0 }, MP.keyDefaults(5)); },
    params: [
      { key: 'm', label: 'Module m (= module axial de la vis)', unit: 'mm', type: 'number', min: 0.1, max: 20, step: 0.05, hints: C.MODULES, section: 'Denture' },
      { key: 'z2', label: 'Nombre de dents z2', type: 'number', min: 10, max: 200, step: 1, section: 'Denture' },
      { key: 'z1', label: 'Filets de la vis z1', type: 'number', min: 1, max: 6, step: 1, section: 'Denture' },
      { key: 'q', label: 'Quotient diamétral q de la vis', type: 'number', min: 5, max: 25, step: 0.1, hints: wormQ, section: 'Denture' },
      { key: 'hand', label: "Sens de l'hélice (= celui de la vis)", type: 'select', options: handOpts, section: 'Denture' },
      { key: 'alpha', label: 'Angle de pression', unit: '°', type: 'number', min: 14.5, max: 25, step: 0.5, section: 'Denture' },
      { key: 'j', label: 'Jeu de denture (impression)', unit: 'mm', type: 'number', min: 0, max: 0.6, step: 0.02, section: 'Denture' },
      { key: 'b', label: 'Largeur b', unit: 'mm', type: 'number', min: 1, max: 100, step: 0.5, section: 'Corps' },
      { key: 'bore', label: 'Alésage', unit: 'mm', type: 'number', min: 0, max: 60, step: 0.1, section: 'Corps' },
      { key: 'hubD', label: 'Diamètre de moyeu', unit: 'mm', type: 'number', min: 0, max: 80, step: 0.5, section: 'Corps' },
      { key: 'hubL', label: 'Longueur de moyeu', unit: 'mm', type: 'number', min: 0, max: 60, step: 0.5, section: 'Corps' }
    ],
    label(p) { return 'Roue à vis m' + p.m + ' z' + p.z2 + ' (vis z' + p.z1 + ' q' + p.q + ')'; },
    build(p, ctx) {
      const m = p.m, a = p.alpha * DEG, gam = Math.atan(p.z1 / p.q), warn = [];
      if (p.z2 < 20) warn.push('Moins de 20 dents : engrènement médiocre avec une vis sans fin.');
      const g = gearGeometry({ z: p.z2, mt: m, alphaT: a, ha: m, hf: 1.2 * m, st: Math.PI * m / 2 - p.j }, resOf(ctx));
      const tw = (p.hand === 'L' ? -1 : 1) * tan(gam) / g.r;
      const s = gearSolid(g, { H: p.b, bore: p.bore, hubD: p.hubD, hubL: p.hubL, tw, z: p.z2, key: keyOf(p) });
      const d1 = p.q * m, ent = m * (p.q + p.z2) / 2;
      const info = [['Désignation', this.label(p)], ['Diamètre primitif d2', f3(m * p.z2) + ' mm'], ['Diamètre de tête da2', f3(2 * g.ra) + ' mm'],
        ['Diamètre de pied df2', f3(2 * g.rf) + ' mm'], ['Entraxe avec la vis a = m(q+z2)/2', f3(ent) + ' mm'],
        ['Rapport de réduction i = z2/z1', f2(p.z2 / p.z1)], ['Angle d’hélice β = γ', f2(gam / DEG) + '°'],
        ['Vis conjuguée', 'd1 = ' + f3(d1) + ' mm, module ' + m + ', z1 = ' + p.z1]].concat(keyInfo(p));
      return { mesh: s.mesh, info, warnings: warn.concat(g.warnings, s.warnings) };
    }
  };
  ['spur', 'helical', 'wormwheel', 'worm'].forEach((id) => { PARTS[id].table = (p) => MP.keyTable(p); });
})(typeof window !== 'undefined' ? window : globalThis);
