/* catalog.js — cotes normalisées (système métrique, ISO) */
(function (root) {
  'use strict';
  const MP = (root.MP = root.MP || {});

  /* Filetages métriques ISO 261 : pas gros + pas fins usuels */
  const THREADS = {
    'M2':   { d: 2,   coarse: 0.4,  fine: [0.25] },
    'M2.5': { d: 2.5, coarse: 0.45, fine: [0.35] },
    'M3':   { d: 3,   coarse: 0.5,  fine: [0.35] },
    'M4':   { d: 4,   coarse: 0.7,  fine: [0.5] },
    'M5':   { d: 5,   coarse: 0.8,  fine: [0.5] },
    'M6':   { d: 6,   coarse: 1.0,  fine: [0.75] },
    'M8':   { d: 8,   coarse: 1.25, fine: [1.0, 0.75] },
    'M10':  { d: 10,  coarse: 1.5,  fine: [1.25, 1.0] },
    'M12':  { d: 12,  coarse: 1.75, fine: [1.5, 1.25] },
    'M14':  { d: 14,  coarse: 2.0,  fine: [1.5] },
    'M16':  { d: 16,  coarse: 2.0,  fine: [1.5] },
    'M18':  { d: 18,  coarse: 2.5,  fine: [2.0, 1.5] },
    'M20':  { d: 20,  coarse: 2.5,  fine: [2.0, 1.5] },
    'M24':  { d: 24,  coarse: 3.0,  fine: [2.0] }
  };

  /* Vis à tête hexagonale ISO 4014 / 4017 : s = ouverture de clé, k = hauteur de tête, dw = diamètre d'appui mini */
  const HEX_BOLT = {
    'M2':   { s: 4,    k: 1.4,  dw: 3.4 },
    'M2.5': { s: 5,    k: 1.7,  dw: 4.3 },
    'M3':   { s: 5.5,  k: 2,    dw: 4.57 },
    'M4':   { s: 7,    k: 2.8,  dw: 5.88 },
    'M5':   { s: 8,    k: 3.5,  dw: 6.88 },
    'M6':   { s: 10,   k: 4,    dw: 8.88 },
    'M8':   { s: 13,   k: 5.3,  dw: 11.63 },
    'M10':  { s: 16,   k: 6.4,  dw: 14.63 },
    'M12':  { s: 18,   k: 7.5,  dw: 16.63 },
    'M14':  { s: 21,   k: 8.8,  dw: 19.64 },
    'M16':  { s: 24,   k: 10,   dw: 22.49 },
    'M18':  { s: 27,   k: 11.5, dw: 25.34 },
    'M20':  { s: 30,   k: 12.5, dw: 28.19 },
    'M24':  { s: 36,   k: 15,   dw: 33.61 }
  };

  /* Vis à tête cylindrique à six pans creux ISO 4762 : dk, k = d, s = clé, t = profondeur mini */
  const SOCKET_CAP = {
    'M2':   { dk: 3.8,  k: 2,  s: 1.5, t: 1 },
    'M2.5': { dk: 4.5,  k: 2.5, s: 2,  t: 1.1 },
    'M3':   { dk: 5.5,  k: 3,  s: 2.5, t: 1.3 },
    'M4':   { dk: 7,    k: 4,  s: 3,   t: 2 },
    'M5':   { dk: 8.5,  k: 5,  s: 4,   t: 2.5 },
    'M6':   { dk: 10,   k: 6,  s: 5,   t: 3 },
    'M8':   { dk: 13,   k: 8,  s: 6,   t: 4 },
    'M10':  { dk: 16,   k: 10, s: 8,   t: 5 },
    'M12':  { dk: 18,   k: 12, s: 10,  t: 6 },
    'M14':  { dk: 21,   k: 14, s: 12,  t: 7 },
    'M16':  { dk: 24,   k: 16, s: 14,  t: 8 },
    'M18':  { dk: 27,   k: 18, s: 14,  t: 9 },
    'M20':  { dk: 30,   k: 20, s: 17,  t: 10 },
    'M24':  { dk: 36,   k: 24, s: 19,  t: 12 }
  };

  /* Écrous hexagonaux ISO 4032 (normal, m) et ISO 4035 (bas, m) ; s = clé ; dw = appui mini */
  const NUT = {
    'M2':   { s: 4,    m: 1.6,  mThin: 1.2, dw: 3.1 },
    'M2.5': { s: 5,    m: 2,    mThin: 1.6, dw: 4.1 },
    'M3':   { s: 5.5,  m: 2.4,  mThin: 1.8, dw: 4.6 },
    'M4':   { s: 7,    m: 3.2,  mThin: 2.2, dw: 5.9 },
    'M5':   { s: 8,    m: 4.7,  mThin: 2.7, dw: 6.9 },
    'M6':   { s: 10,   m: 5.2,  mThin: 3.2, dw: 8.9 },
    'M8':   { s: 13,   m: 6.8,  mThin: 4,   dw: 11.6 },
    'M10':  { s: 16,   m: 8.4,  mThin: 5,   dw: 14.6 },
    'M12':  { s: 18,   m: 10.8, mThin: 6,   dw: 16.6 },
    'M14':  { s: 21,   m: 12.8, mThin: 7,   dw: 19.6 },
    'M16':  { s: 24,   m: 14.8, mThin: 8,   dw: 22.5 },
    'M18':  { s: 27,   m: 15.8, mThin: 9,   dw: 24.8 },
    'M20':  { s: 30,   m: 18,   mThin: 10,  dw: 27.7 },
    'M24':  { s: 36,   m: 21.5, mThin: 12,  dw: 33.3 }
  };

  /* Rondelles plates ISO 7089 (série normale) : d1 = trou, d2 = extérieur, h = épaisseur */
  const WASHER = {
    'M2':   { d1: 2.2,  d2: 5,  h: 0.3 },
    'M2.5': { d1: 2.7,  d2: 6,  h: 0.5 },
    'M3':   { d1: 3.2,  d2: 7,  h: 0.5 },
    'M4':   { d1: 4.3,  d2: 9,  h: 0.8 },
    'M5':   { d1: 5.3,  d2: 10, h: 1 },
    'M6':   { d1: 6.4,  d2: 12, h: 1.6 },
    'M8':   { d1: 8.4,  d2: 16, h: 1.6 },
    'M10':  { d1: 10.5, d2: 20, h: 2 },
    'M12':  { d1: 13,   d2: 24, h: 2.5 },
    'M14':  { d1: 15,   d2: 28, h: 2.5 },
    'M16':  { d1: 17,   d2: 30, h: 3 },
    'M18':  { d1: 19,   d2: 34, h: 3 },
    'M20':  { d1: 21,   d2: 37, h: 3 },
    'M24':  { d1: 25,   d2: 44, h: 4 }
  };

  /* Longueurs normalisées usuelles (ISO 4014 / 4017 / 4762), mm */
  const LENGTHS = [4, 5, 6, 8, 10, 12, 14, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100, 110, 120, 130, 140, 150];

  /* Modules ISO 54 : série I puis série II (à éviter si possible) */
  const MODULES = [0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10,
    0.35, 0.7, 0.9, 1.75, 2.25, 2.75, 3.5, 4.5, 5.5, 7, 9];

  /* Quotient diamétral de vis sans fin q = d1 / m (DIN 3976 / ISO/TR 10828) */
  const WORM_Q = [6.3, 7.1, 8, 9, 10, 11.2, 12.5, 14, 16, 18, 20];

  MP.CATALOG = { THREADS, HEX_BOLT, SOCKET_CAP, NUT, WASHER, LENGTHS, MODULES, WORM_Q };
  MP.THREAD_SIZES = Object.keys(THREADS);
})(typeof window !== 'undefined' ? window : globalThis);
