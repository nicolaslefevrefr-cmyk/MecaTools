/* parts-fasteners.js — visserie : vis H, vis CHC, tige filetée, écrous, rondelles */
(function (root) {
  'use strict';
  const MP = (root.MP = root.MP || {});
  const C = MP.CATALOG, TAU = MP.TAU, T30 = Math.tan(Math.PI / 6);
  const PARTS = (MP.PARTS = MP.PARTS || {});

  const f2 = (v) => (Math.round(v * 100) / 100).toString();
  const f3 = (v) => (Math.round(v * 1000) / 1000).toString();
  const uniform = (N) => MP.ringThetas(N);          // anneau ouvert 0..2π (filets hélicoïdaux)
  const uniformClosed = (N) => Array.from({ length: N }, (_, i) => (i * TAU) / N);
  const sizeOpts = MP.THREAD_SIZES.map((s) => ({ v: s, label: s }));
  const handOpts = [{ v: 'R', label: 'Droite (standard)' }, { v: 'L', label: 'Gauche' }];
  const threadOpts = [{ v: 'partial', label: 'Partiel (b normalisé)' }, { v: 'full', label: 'Complet' }];
  const pitchOpts = (p) => {
    const t = C.THREADS[p.size];
    if (!t) return [];
    return [{ v: t.coarse, label: f3(t.coarse) + ' (pas gros)' }].concat(t.fine.map((x) => ({ v: x, label: f3(x) + ' (pas fin)' })));
  };
  const lengthHint = C.LENGTHS;

  function fillThread(p) {
    const t = C.THREADS[p.size];
    p.d = t.d;
    const ok = [t.coarse].concat(t.fine).some((x) => Math.abs(x - p.P) < 1e-9);
    if (!ok) p.P = t.coarse;
    return t;
  }
  function threadInfo(p) {
    const g = MP.threadDims(p.d, p.P);
    return [
      ['Pas P', f3(p.P) + ' mm'], ['Diamètre sur flancs d2', f3(g.d2) + ' mm'],
      ['Diamètre à fond de filet d3', f3(g.d3) + ' mm'], ['Section résistante As', f2(g.As) + ' mm²']
    ];
  }
  const threadParams = [
    { key: 'size', label: 'Taille normalisée', type: 'select', options: sizeOpts, section: 'Filetage' },
    { key: 'P', label: 'Pas', unit: 'mm', type: 'select', numeric: true, options: pitchOpts, section: 'Filetage' },
    { key: 'd', label: 'Diamètre nominal d', unit: 'mm', type: 'number', min: 1, max: 48, step: 0.1, std: true, section: 'Filetage' },
    { key: 'hand', label: 'Sens du filet', type: 'select', options: handOpts, section: 'Filetage' }
  ];

  /* alésage axial : rayon utilisé (limité pour garder une paroi de 0,4 mm sous le fond de filet) */
  function boreR(p, rt, warn, cap) {
    let a = p.bore > 0.05 ? p.bore / 2 : 0;
    const lim = Math.min(rt - 0.4, cap === undefined ? Infinity : cap);
    if (a > lim) { a = Math.max(0, lim); warn.push('Alésage trop grand : limité à ' + Math.round(a * 2 * 100) / 100 + ' mm (paroi minimale sous le fond de filet).'); }
    return a;
  }
  const boreInfo = (p, a) => (a > 0 ? [['Alésage axial', Math.round(a * 2 * 100) / 100 + ' mm']] : []);

  /* ---------- Chaîne de filet (profil à angle fixé), maillage économe sur les sommets du profil ---------- */
  function boltChain(p, t, z0, zE, ext, rt) {
    const cl = p.d / 2 - rt + 0.15 * p.P;
    return MP.helixColumn(t, {
      f: ext, period: p.P, lead: p.P, hand: p.hand, zref: z0, z0, z1: zE, refLo: 0, refHi: cl, fineDz: p.P / 24,
      post: (r, z) => Math.min(r, rt + (zE - z))
    });
  }

  /* ================= Vis à tête hexagonale ISO 4014 / 4017 ================= */
  PARTS.hexbolt = {
    id: 'hexbolt', name: 'Vis à tête hexagonale', group: 'Visserie', std: 'ISO 4014 / ISO 4017',
    icon: 'bolt',
    fill(p) {
      const t = C.HEX_BOLT[p.size]; fillThread(p);
      p.s = t.s; p.k = t.k; p.dw = t.dw; return p;
    },
    defaults() { return this.fill({ size: 'M8', P: 1.25, l: 40, thread: 'partial', hand: 'R', bore: 0 }); },
    table(p) { const t = C.HEX_BOLT[p.size] || {}; return { d: C.THREADS[p.size].d, s: t.s, k: t.k, dw: t.dw }; },
    params: threadParams.concat([
      { key: 'l', label: 'Longueur sous tête l', unit: 'mm', type: 'number', min: 3, max: 300, step: 1, hints: lengthHint, section: 'Longueur' },
      { key: 'thread', label: 'Longueur filetée', type: 'select', options: threadOpts, section: 'Longueur' },
      { key: 's', label: 'Ouverture de clé s', unit: 'mm', type: 'number', min: 2, max: 80, step: 0.1, std: true, section: 'Tête' },
      { key: 'k', label: 'Hauteur de tête k', unit: 'mm', type: 'number', min: 1, max: 40, step: 0.1, std: true, section: 'Tête' },
      { key: 'dw', label: "Diamètre d'appui dw", unit: 'mm', type: 'number', min: 2, max: 80, step: 0.1, std: true, section: 'Tête' },
      { key: 'bore', label: 'Alésage axial (traversant)', unit: 'mm', type: 'number', min: 0, max: 40, step: 0.1, section: 'Alésage',
        help: '0 = pièce pleine. Permet par exemple une vis ou une tige creuse (passage de câble).' }
    ]),
    label(p) { return 'Vis H ' + p.size + '×' + p.l + (p.P !== C.THREADS[p.size].coarse ? '×' + f3(p.P) : '') + (p.thread === 'full' ? ' ISO 4017' : ' ISO 4014'); },
    build(p, ctx) {
      const N = ctx.N, { d, P, s, k, l } = p;
      const b = p.thread === 'full' ? l : MP.partialThreadLength(d, l, 6);
      const zE = k + l, z0 = zE - b;
      const ext = MP.extThreadProfile(d, P), g = MP.threadDims(d, P), rt = g.d3 / 2;
      const r0 = Math.min(p.dw / 2, s / 2 - 1e-3), th = uniform(N), warn = [];
      const a = boreR(p, rt, warn);
      if (p.dw > s) warn.push("dw > s : diamètre d'appui limité à l'ouverture de clé.");
      const mesh = MP.revolve({
        thetas: th, open: true,
        column(i) {
          const rh = MP.hexRadius(th[i], s), zc = Math.min((rh - r0) * T30, k / 2 - 1e-6);
          const pts = [[a, 0], [r0, 0], [rh, zc], [rh, k - zc], [r0, k], [d / 2, k], [d / 2, z0]];
          return pts.concat(boltChain(p, th[i], z0, zE, ext, rt), [[a, zE]]);
        }
      });
      const info = [['Désignation', this.label(p)], ['Longueur filetée b', f2(b) + ' mm'],
        ['Cote sur sommets e', f2(s / Math.cos(Math.PI / 6)) + ' mm']].concat(boreInfo(p, a), threadInfo(p));
      return { mesh, info, warnings: warn };
    }
  };

  /* ================= Vis CHC ISO 4762 ================= */
  PARTS.sockethead = {
    id: 'sockethead', name: 'Vis à tête cylindrique six pans creux', group: 'Visserie', std: 'ISO 4762',
    icon: 'cap',
    fill(p) {
      const t = C.SOCKET_CAP[p.size]; fillThread(p);
      p.dk = t.dk; p.k = t.k; p.s = t.s; p.t = t.t; return p;
    },
    defaults() { return this.fill({ size: 'M5', P: 0.8, l: 20, thread: 'partial', hand: 'R', bore: 0 }); },
    table(p) { const t = C.SOCKET_CAP[p.size]; return { d: C.THREADS[p.size].d, dk: t.dk, k: t.k, s: t.s, t: t.t }; },
    params: threadParams.concat([
      { key: 'l', label: 'Longueur sous tête l', unit: 'mm', type: 'number', min: 3, max: 300, step: 1, hints: lengthHint, section: 'Longueur' },
      { key: 'thread', label: 'Longueur filetée', type: 'select', options: threadOpts, section: 'Longueur' },
      { key: 'dk', label: 'Diamètre de tête dk', unit: 'mm', type: 'number', min: 2, max: 80, step: 0.1, std: true, section: 'Tête' },
      { key: 'k', label: 'Hauteur de tête k', unit: 'mm', type: 'number', min: 1, max: 40, step: 0.1, std: true, section: 'Tête' },
      { key: 's', label: 'Six pans creux s', unit: 'mm', type: 'number', min: 1, max: 40, step: 0.1, std: true, section: 'Tête' },
      { key: 't', label: 'Profondeur empreinte t', unit: 'mm', type: 'number', min: 0.5, max: 30, step: 0.1, std: true, section: 'Tête' },
      { key: 'bore', label: 'Alésage axial (traversant)', unit: 'mm', type: 'number', min: 0, max: 40, step: 0.1, section: 'Alésage',
        help: '0 = pièce pleine. Permet par exemple une vis ou une tige creuse (passage de câble).' }
    ]),
    label(p) { return 'Vis CHC ' + p.size + '×' + p.l + (p.P !== C.THREADS[p.size].coarse ? '×' + f3(p.P) : '') + ' ISO 4762'; },
    build(p, ctx) {
      const N = ctx.N, { d, P, k, l, dk, s, t } = p;
      const b = p.thread === 'full' ? l : MP.partialThreadLength(d, l, 12);
      const zE = k + l, z0 = zE - b, th = uniform(N), warn = [];
      const ext = MP.extThreadProfile(d, P), g = MP.threadDims(d, P), rt = g.d3 / 2;
      const ch = Math.max(0.15, 0.05 * dk), rs = (s / 2) / Math.cos(Math.PI / 6);
      const a = boreR(p, rt, warn, s / 2 - 0.2);
      if (rs > dk / 2 - 0.3) warn.push("L'empreinte est trop grande pour la tête.");
      if (t > k - 0.3) warn.push("Profondeur d'empreinte supérieure à la hauteur de tête.");
      const mesh = MP.revolve({
        thetas: th, open: true,
        column(i) {
          const rh = MP.hexRadius(th[i], s);
          const pts = [[a, t], [rh, t], [rh, 0], [dk / 2 - ch, 0], [dk / 2, ch], [dk / 2, k], [d / 2, k], [d / 2, z0]];
          return pts.concat(boltChain(p, th[i], z0, zE, ext, rt), [[a, zE]]);
        }
      });
      const info = [['Désignation', this.label(p)], ['Longueur filetée b', f2(b) + ' mm']].concat(boreInfo(p, a), threadInfo(p));
      return { mesh, info, warnings: warn };
    }
  };

  /* ================= Tige filetée ================= */
  PARTS.rod = {
    id: 'rod', name: 'Tige filetée', group: 'Visserie', std: 'ISO 261 / DIN 976',
    icon: 'rod',
    fill(p) { fillThread(p); return p; },
    defaults() { return this.fill({ size: 'M8', P: 1.25, l: 100, hand: 'R', bore: 0 }); },
    table(p) { return { d: C.THREADS[p.size].d }; },
    params: threadParams.concat([
      { key: 'l', label: 'Longueur totale', unit: 'mm', type: 'number', min: 3, max: 400, step: 1, section: 'Longueur' },
      { key: 'bore', label: 'Alésage axial (traversant)', unit: 'mm', type: 'number', min: 0, max: 40, step: 0.1, section: 'Alésage',
        help: '0 = pièce pleine. Permet par exemple une vis ou une tige creuse (passage de câble).' }
    ]),
    label(p) { return 'Tige filetée ' + p.size + '×' + p.l + (p.P !== C.THREADS[p.size].coarse ? '×' + f3(p.P) : ''); },
    build(p, ctx) {
      const N = ctx.N, { d, P, l } = p;
      const ext = MP.extThreadProfile(d, P), g = MP.threadDims(d, P), rt = g.d3 / 2, th = uniform(N), warn = [];
      const a = boreR(p, rt, warn);
      const mesh = MP.revolve({
        thetas: th, open: true,
        column(i) {
          const cl = d / 2 - rt + 0.15 * P;
          const pts = [[a, 0]].concat(MP.helixColumn(th[i], {
            f: ext, period: P, lead: P, hand: p.hand, zref: 0, z0: 0, z1: l, refLo: cl, refHi: cl, fineDz: P / 24,
            post: (r, z) => Math.min(r, rt + z, rt + (l - z))
          }));
          pts.push([a, l]);
          return pts;
        }
      });
      return { mesh, info: [['Désignation', this.label(p)]].concat(boreInfo(p, a), threadInfo(p)), warnings: warn };
    }
  };

  /* ================= Écrous hexagonaux ISO 4032 / 4035 ================= */
  function nutPart(id, name, std, thin) {
    return {
      id, name, group: 'Visserie', std, icon: 'nut',
      fill(p) {
        const t = C.NUT[p.size]; fillThread(p);
        p.s = t.s; p.m = thin ? t.mThin : t.m; p.dw = t.dw; return p;
      },
      defaults() { return this.fill({ size: 'M8', P: 1.25, clr: 0, hand: 'R' }); },
      table(p) { const t = C.NUT[p.size]; return { d: C.THREADS[p.size].d, s: t.s, m: thin ? t.mThin : t.m, dw: t.dw }; },
      params: threadParams.concat([
        { key: 'clr', label: "Jeu radial d'impression", unit: 'mm', type: 'number', min: 0, max: 0.6, step: 0.05, section: 'Filetage',
          help: '0 = cotes ISO nominales. Pour une impression FDM, 0,10 à 0,25 mm évite que le filet se soude à la vis.' },
        { key: 's', label: 'Ouverture de clé s', unit: 'mm', type: 'number', min: 2, max: 80, step: 0.1, std: true, section: 'Corps' },
        { key: 'm', label: 'Hauteur m', unit: 'mm', type: 'number', min: 0.8, max: 40, step: 0.1, std: true, section: 'Corps' },
        { key: 'dw', label: "Diamètre d'appui dw", unit: 'mm', type: 'number', min: 2, max: 80, step: 0.1, std: true, section: 'Corps' }
      ]),
      label(p) { return (thin ? 'Écrou bas ' : 'Écrou H ') + p.size + (p.P !== C.THREADS[p.size].coarse ? '×' + f3(p.P) : '') + ' ' + std; },
      build(p, ctx) {
        const N = ctx.N, { d, P, s, m, clr } = p, th = uniform(N), warn = [];
        const f = MP.intThreadProfile(d, P, clr), r0 = Math.min(p.dw / 2, s / 2 - 1e-3);
        const rcs = d / 2 + clr + 0.04 * d, r1 = (d - 1.082532 * P) / 2 + clr, cl = rcs - r1 + 0.15 * P;
        if (m < 0.8 * P) warn.push('Hauteur inférieure à 0,8 P : moins de un tour de filet engagé.');
        const mesh = MP.revolve({
          thetas: th, open: true,
          column(i) {
            const rh = MP.hexRadius(th[i], s), zc = Math.min((rh - r0) * T30, m / 2 - 1e-6);
            const post = (r, z) => Math.max(r, rcs - Math.min(z, m - z));
            const chain = MP.helixColumn(th[i], { f, period: P, lead: P, hand: p.hand, zref: 0, z0: 0, z1: m, refLo: cl, refHi: cl, fineDz: P / 24, post });
            const pts = [[chain[0][0], 0], [r0, 0], [rh, zc], [rh, m - zc], [r0, m]];
            for (let j = chain.length - 1; j >= 0; j--) pts.push(chain[j]);
            return pts;
          }
        });
        const info = [['Désignation', this.label(p)], ['Cote sur sommets e', f2(s / Math.cos(Math.PI / 6)) + ' mm'],
          ['Diamètre intérieur D1', f3(MP.threadDims(d, P).D1 + 2 * clr) + ' mm']].concat(threadInfo(p));
        return { mesh, info, warnings: warn };
      }
    };
  }
  PARTS.nut = nutPart('nut', 'Écrou hexagonal', 'ISO 4032', false);
  PARTS.thinnut = nutPart('thinnut', 'Écrou hexagonal bas', 'ISO 4035', true);

  /* ================= Rondelle plate ISO 7089 ================= */
  PARTS.washer = {
    id: 'washer', name: 'Rondelle plate', group: 'Visserie', std: 'ISO 7089', icon: 'washer',
    fill(p) { const t = C.WASHER[p.size]; p.d1 = t.d1; p.d2 = t.d2; p.h = t.h; return p; },
    defaults() { return this.fill({ size: 'M8' }); },
    table(p) { return Object.assign({}, C.WASHER[p.size]); },
    params: [
      { key: 'size', label: 'Taille normalisée', type: 'select', options: sizeOpts, section: 'Cotes' },
      { key: 'd1', label: 'Diamètre intérieur d1', unit: 'mm', type: 'number', min: 1, max: 80, step: 0.1, std: true, section: 'Cotes' },
      { key: 'd2', label: 'Diamètre extérieur d2', unit: 'mm', type: 'number', min: 2, max: 120, step: 0.1, std: true, section: 'Cotes' },
      { key: 'h', label: 'Épaisseur h', unit: 'mm', type: 'number', min: 0.2, max: 10, step: 0.1, std: true, section: 'Cotes' }
    ],
    label(p) { return 'Rondelle ' + p.size + ' ISO 7089'; },
    build(p) {
      const N = 96, th = uniformClosed(N), warn = [];
      if (p.d2 <= p.d1 + 0.5) warn.push("Le diamètre extérieur doit dépasser le diamètre intérieur.");
      const mesh = MP.revolve({ thetas: th, column: () => [[p.d1 / 2, 0], [p.d2 / 2, 0], [p.d2 / 2, p.h], [p.d1 / 2, p.h]] });
      return { mesh, info: [['Désignation', this.label(p)], ['Diamètre intérieur d1', f2(p.d1) + ' mm'], ['Diamètre extérieur d2', f2(p.d2) + ' mm'], ['Épaisseur h', f2(p.h) + ' mm']], warnings: warn };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
