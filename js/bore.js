/* bore.js — alésage central, rainure de clavette (moyeu) et clavette parallèle (ISO 773 / DIN 6885) */
(function (root) {
  'use strict';
  const MP = (root.MP = root.MP || {});
  const TAU = MP.TAU;
  const PARTS = (MP.PARTS = MP.PARTS || {});

  /* Clavettes parallèles : [d arbre max, b largeur, h hauteur, t2 profondeur dans le moyeu, t1 profondeur dans l'arbre] */
  const KEYS = [[8, 2, 2, 1.0, 1.2], [10, 3, 3, 1.4, 1.8], [12, 4, 4, 1.8, 2.5], [17, 5, 5, 2.3, 3.0], [22, 6, 6, 2.8, 3.5],
    [30, 8, 7, 3.3, 4.0], [38, 10, 8, 3.3, 5.0], [44, 12, 8, 3.3, 5.0], [50, 14, 9, 3.8, 5.5], [58, 16, 10, 4.3, 6.0]];
  MP.keyStd = function (d) {
    for (const k of KEYS) if (d <= k[0]) return { b: k[1], h: k[2], t2: k[3], t1: k[4], std: d > 6 };
    const k = KEYS[KEYS.length - 1];
    return { b: k[1], h: k[2], t2: k[3], t1: k[4], std: false };
  };
  // en dessous de 6 mm (hors norme) : rainure proportionnelle
  const keyFor = (d) => {
    if (d >= 6) return MP.keyStd(d);
    const b = Math.max(1, Math.round(d * 0.3 * 2) / 2);
    return { b, h: b, t2: Math.round(b * 0.5 * 10) / 10 || 0.5, t1: b * 0.6, std: false };
  };
  MP.keyFor = keyFor;

  MP.keyDefaults = function (bore) {
    const k = keyFor(bore || 5);
    return { key: false, keyW: k.b, keyT: k.t2, keyL: 200 };
  };
  /** Rétablit largeur / profondeur normalisées pour l'alésage courant (appelé quand l'alésage change). */
  MP.keyFill = function (p) {
    if (p.keyW === undefined || !(p.bore > 0)) return;
    const k = keyFor(p.bore);
    p.keyW = k.b; p.keyT = k.t2;
  };
  MP.keyParams = function (section) {
    const on = (p) => p.bore > 0;
    const open = (p) => p.bore > 0 && p.key;
    return [
      { key: 'key', label: 'Rainure de clavette', type: 'check', section, showIf: on,
        help: 'Rainure dans l’alésage, d’axe parallèle à l’arbre. Cotes par défaut : ISO 773 / DIN 6885 selon le diamètre d’alésage.' },
      { key: 'keyW', label: 'Largeur de rainure b', unit: 'mm', type: 'number', min: 0.5, max: 40, step: 0.1, section, showIf: open, std: true },
      { key: 'keyT', label: 'Hauteur de rainure t2 (au-dessus de l’alésage)', unit: 'mm', type: 'number', min: 0.2, max: 20, step: 0.1, section, showIf: open, std: true },
      { key: 'keyL', label: 'Longueur de rainure', unit: 'mm', type: 'number', min: 1, max: 300, step: 0.5, section, showIf: open,
        help: 'Mesurée depuis la face inférieure ; au-delà de la longueur de la pièce, la rainure est traversante.' }
    ];
  };
  MP.keyTable = function (p) { if (!(p.bore > 0)) return {}; const k = keyFor(p.bore); return { keyW: k.b, keyT: k.t2 }; };

  /** Rainure rectangulaire dans l'alésage de rayon a : rayon du trou en fonction de l'angle (rainure vers +x). */
  MP.keyway = function (a, key, warn) {
    let w = key.w, t = key.t;
    if (w > 1.8 * a) { w = 1.8 * a; if (warn) warn.push('Rainure plus large que 90 % de l’alésage : largeur limitée à ' + (Math.round(w * 100) / 100) + ' mm.'); }
    const thB = Math.asin(w / (2 * a)), thC = Math.atan((w / 2) / (a + t));
    const fn = (theta) => {
      let th = ((theta + Math.PI) % TAU + TAU) % TAU - Math.PI;
      if (Math.abs(th) >= thB - 1e-12) return a;
      const s = Math.abs(Math.sin(th)), c = Math.cos(th);
      let r = (a + t) / c;
      if (s > 1e-12) r = Math.min(r, (w / 2) / s);
      return Math.max(r, a);
    };
    return { fn, w, t, len: key.len, extras: [thB, -thB, thC, -thC] };
  };

  /** Chaîne d'alésage descendante (du haut vers le bas), points non vrillés (3e valeur = 1). */
  MP.boreChain = function (theta, a, kw, zBot, zTop) {
    if (!kw) return [[a, zTop, 1], [a, zBot, 1]];
    const h = kw.fn(theta), total = zTop - zBot;
    if (kw.len >= total - 1e-9) return [[h, zTop, 1], [h, zTop, 1], [h, zBot, 1], [h, zBot, 1]];
    const zs = zBot + kw.len;
    return [[a, zTop, 1], [a, zs, 1], [h, zs, 1], [h, zBot, 1]];
  };

  /** Insère des colonnes aux angles voulus dans un contour d'engrenage [{th, rho}] (point sur la corde). */
  MP.insertAngles = function (pts, extras) {
    const arr = pts.slice(), t0 = arr[0].th;
    for (let e of extras) {
      e = t0 + (((e - t0) % TAU) + TAU) % TAU;
      if (arr.some((q) => Math.abs(q.th - e) < 1e-9)) continue;
      for (let i = 0; i < arr.length; i++) {
        const A = arr[i], B = i + 1 < arr.length ? arr[i + 1] : { th: arr[0].th + TAU, rho: arr[0].rho };
        if (A.th + 1e-9 < e && e < B.th - 1e-9) {
          const p1 = [A.rho * Math.cos(A.th), A.rho * Math.sin(A.th)], p2 = [B.rho * Math.cos(B.th), B.rho * Math.sin(B.th)];
          const d = [Math.cos(e), Math.sin(e)], v = [p2[0] - p1[0], p2[1] - p1[1]];
          const den = v[0] * d[1] - v[1] * d[0];
          let rho = A.rho;
          if (Math.abs(den) > 1e-12) {
            const u = -(p1[0] * d[1] - p1[1] * d[0]) / den;
            rho = (p1[0] + u * v[0]) * d[0] + (p1[1] + u * v[1]) * d[1];
          }
          arr.splice(i + 1, 0, { th: e, rho });
          break;
        }
      }
    }
    return arr;
  };

  /* ================= Clavette parallèle ISO 773 / DIN 6885 ================= */
  const SHAFTS = [6, 8, 10, 12, 14, 15, 16, 17, 18, 19, 20, 22, 24, 25, 28, 30, 32, 35, 38, 40, 42, 45, 48, 50, 55, 58];
  const KLEN = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40, 45, 50, 56, 63, 70, 80];
  const f2 = (v) => (Math.round(v * 100) / 100).toString();
  PARTS.key = {
    id: 'key', name: 'Clavette parallèle', group: 'Transmission', std: 'ISO 773 · DIN 6885', icon: 'key',
    fill(p) {
      const k = keyFor(parseFloat(p.size));
      p.b = k.b; p.h = k.h; return p;
    },
    defaults() {
      const p = { size: '10', type: 'A', clr: 0 };
      p.l = KLEN.reduce((a, b) => (Math.abs(b - 1.4 * 10) < Math.abs(a - 1.4 * 10) ? b : a));
      return this.fill(p);
    },
    table(p) { const k = keyFor(parseFloat(p.size)); return { b: k.b, h: k.h }; },
    params: [
      { key: 'size', label: 'Diamètre d’arbre (alésage)', type: 'select', options: SHAFTS.map((d) => ({ v: String(d), label: 'Ø ' + d + ' mm' })), section: 'Clavette' },
      { key: 'type', label: 'Forme', type: 'select', options: [{ v: 'A', label: 'A — bouts ronds' }, { v: 'B', label: 'B — bouts carrés' }], section: 'Clavette' },
      { key: 'b', label: 'Largeur b', unit: 'mm', type: 'number', min: 1, max: 40, step: 0.1, std: true, section: 'Cotes' },
      { key: 'h', label: 'Hauteur h', unit: 'mm', type: 'number', min: 1, max: 30, step: 0.1, std: true, section: 'Cotes' },
      { key: 'l', label: 'Longueur l', unit: 'mm', type: 'number', min: 3, max: 200, step: 1, hints: KLEN, section: 'Cotes' },
      { key: 'clr', label: 'Jeu d’impression (retrait)', unit: 'mm', type: 'number', min: 0, max: 0.5, step: 0.05, section: 'Cotes',
        help: 'Retranche cette valeur à b, h et l pour compenser la sur-extrusion en FDM.' }
    ],
    label(p) { return 'Clavette ' + p.type + ' ' + p.b + '×' + p.h + '×' + p.l + ' (Ø' + p.size + ')'; },
    build(p) {
      const b = p.b - p.clr, h = p.h - p.clr, l = p.l - p.clr, warn = [];
      if (l < b) warn.push('Longueur inférieure à la largeur.');
      let poly = [];
      if (p.type === 'B' || l <= b) poly = [[-l / 2, -b / 2], [l / 2, -b / 2], [l / 2, b / 2], [-l / 2, b / 2]];
      else {
        const r = b / 2, c = l / 2 - r, n = 20;
        for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + Math.PI * i / n; poly.push([c + r * Math.cos(a), r * Math.sin(a)]); }
        for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + Math.PI * i / n; poly.push([-c + r * Math.cos(a), r * Math.sin(a)]); }
      }
      const k = keyFor(parseFloat(p.size));
      const info = [['Désignation', this.label(p)], ['Rainure dans le moyeu t2', f2(k.t2) + ' mm'], ['Rainure dans l’arbre t1', f2(k.t1) + ' mm'],
        ['Hauteur hors arbre', f2(h - k.t1) + ' mm'], ['Norme', k.std ? 'cotes ISO 773 pour cet arbre' : 'arbre hors plage ISO 773 (6 à 58 mm)']];
      return { mesh: MP.extrude(poly, 0, h), info, warnings: warn };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
