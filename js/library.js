/* library.js — bibliothèque de pièces normalisées prêtes à charger */
(function (root) {
  'use strict';
  const MP = (root.MP = root.MP || {});
  const L = MP.CATALOG.LENGTHS;
  const nearestLen = (x) => L.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));

  const sizeChips = (id, lenFactor) => MP.THREAD_SIZES.map((s) => {
    const d = MP.CATALOG.THREADS[s].d, o = { size: s };
    if (lenFactor) o.l = Math.max(6, nearestLen(lenFactor * d));
    if (id === 'rod') o.l = 100;
    return { label: s, over: o };
  });

  const g = (label, over) => ({ label, over });

  MP.LIBRARY = [
    { group: 'Visserie', items: [
      { part: 'nut', title: 'Écrou hexagonal', std: 'ISO 4032', presets: sizeChips('nut') },
      { part: 'thinnut', title: 'Écrou hexagonal bas', std: 'ISO 4035', presets: sizeChips('thinnut') },
      { part: 'hexbolt', title: 'Vis à tête hexagonale', std: 'ISO 4014 / 4017', presets: sizeChips('hexbolt', 5) },
      { part: 'sockethead', title: 'Vis CHC six pans creux', std: 'ISO 4762', presets: sizeChips('sockethead', 4) },
      { part: 'rod', title: 'Tige filetée', std: 'ISO 261', presets: sizeChips('rod') },
      { part: 'washer', title: 'Rondelle plate', std: 'ISO 7089', presets: sizeChips('washer') }
    ] },
    { group: 'Transmission', items: [
      { part: 'worm', title: 'Vis sans fin', std: 'DIN 3975 · module axial', presets: [
        g('m0.4 · 1 filet · q10', { m: 0.4, z1: 1, q: 10, L: 10 }),
        g('m0.5 · 1 filet · q10', { m: 0.5, z1: 1, q: 10, L: 12 }),
        g('m0.5 · 2 filets · q10', { m: 0.5, z1: 2, q: 10, L: 12 }),
        g('m0.8 · 1 filet · q10', { m: 0.8, z1: 1, q: 10, L: 16 }),
        g('m1 · 1 filet · q10', { m: 1, z1: 1, q: 10, L: 20 }),
        g('m1 · 2 filets · q10', { m: 1, z1: 2, q: 10, L: 20 }),
        g('m1 · 1 filet · q10 · gauche', { m: 1, z1: 1, q: 10, L: 20, hand: 'L' }),
        g('m1.5 · 1 filet · q12.5', { m: 1.5, z1: 1, q: 12.5, L: 28 }),
        g('m2 · 1 filet · q10', { m: 2, z1: 1, q: 10, L: 36 })
      ] },
      { part: 'wormwheel', title: 'Roue à vis', std: 'DIN 3975 · avec sa vis (q10, 1 filet)', presets: [
        g('m0.4 · z30', { m: 0.4, z2: 30, z1: 1, q: 10, b: 3.5, bore: 3 }),
        g('m0.5 · z30', { m: 0.5, z2: 30, z1: 1, q: 10, b: 4, bore: 3 }),
        g('m0.5 · z40', { m: 0.5, z2: 40, z1: 1, q: 10, b: 4, bore: 3 }),
        g('m1 · z30', { m: 1, z2: 30, z1: 1, q: 10, b: 8, bore: 5 }),
        g('m1 · z40', { m: 1, z2: 40, z1: 1, q: 10, b: 8, bore: 5 }),
        g('m1 · z30 · gauche', { m: 1, z2: 30, z1: 1, q: 10, b: 8, bore: 5, hand: 'L' }),
        g('m1.5 · z30', { m: 1.5, z2: 30, z1: 1, q: 10, b: 11, bore: 6 }),
        g('m2 · z30', { m: 2, z2: 30, z1: 1, q: 10, b: 14, bore: 8 })
      ] },
      { part: 'spur', title: 'Engrenage droit', std: 'ISO 53 · α 20°', presets: [
        g('m0.5 · z20', { m: 0.5, z: 20, b: 4, bore: 3 }),
        g('m0.5 · z40', { m: 0.5, z: 40, b: 4, bore: 3 }),
        g('m0.8 · z24', { m: 0.8, z: 24, b: 6, bore: 4 }),
        g('m1 · z20', { m: 1, z: 20, b: 8, bore: 5 }),
        g('m1 · z30', { m: 1, z: 30, b: 8, bore: 5 }),
        g('m1 · z60', { m: 1, z: 60, b: 8, bore: 8 }),
        g('m1.5 · z20', { m: 1.5, z: 20, b: 10, bore: 6 }),
        g('m2 · z20', { m: 2, z: 20, b: 14, bore: 8 }),
        g('m2 · z40', { m: 2, z: 40, b: 14, bore: 8 }),
        g('m3 · z24', { m: 3, z: 24, b: 20, bore: 10 })
      ] },
      { part: 'helical', title: 'Engrenage hélicoïdal', std: 'ISO 21771 · α 20°', presets: [
        g('m0.5 · z24 · 15° D', { m: 0.5, z: 24, beta: 15, b: 8, bore: 3 }),
        g('m1 · z20 · 15° D', { m: 1, z: 20, beta: 15, b: 14, bore: 5 }),
        g('m1 · z20 · 15° G', { m: 1, z: 20, beta: 15, hand: 'L', b: 14, bore: 5 }),
        g('m1 · z30 · 20° D', { m: 1, z: 30, beta: 20, b: 12, bore: 5 }),
        g('m1.5 · z24 · 20° D', { m: 1.5, z: 24, beta: 20, b: 16, bore: 8 }),
        g('m1.5 · z24 · 20° G', { m: 1.5, z: 24, beta: 20, hand: 'L', b: 16, bore: 8 }),
        g('m2 · z20 · 20° D', { m: 2, z: 20, beta: 20, b: 20, bore: 8 })
      ] },
      { part: 'key', title: 'Clavette parallèle', std: 'ISO 773 · DIN 6885', presets: [6, 8, 10, 12, 15, 17, 20, 25, 30].map((d) => {
        const k = MP.keyFor(d), KL = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40, 45, 50, 56, 63, 70, 80];
        const len = KL.reduce((a, b) => (Math.abs(b - 1.4 * d) < Math.abs(a - 1.4 * d) ? b : a));
        return { label: 'Ø' + d + ' · ' + k.b + '×' + k.h + '×' + len, over: { size: String(d), l: len } };
      }) },
      { part: 'rack', title: 'Crémaillère', std: 'ISO 53', presets: [
        g('m0.5 · 30 dents', { m: 0.5, nt: 30, b: 4, body: 3 }),
        g('m1 · 12 dents', { m: 1, nt: 12, b: 8, body: 4 }),
        g('m1 · 20 dents', { m: 1, nt: 20, b: 8, body: 4 }),
        g('m1.5 · 10 dents', { m: 1.5, nt: 10, b: 10, body: 5 }),
        g('m2 · 8 dents', { m: 2, nt: 8, b: 14, body: 6 })
      ] }
    ] }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
