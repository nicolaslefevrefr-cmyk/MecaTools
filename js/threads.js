/* threads.js — profil de filetage métrique ISO (ISO 68-1, ISO 724) */
(function (root) {
  'use strict';
  const MP = (root.MP = root.MP || {});
  const T30 = Math.tan(Math.PI / 6);

  /** Diamètres caractéristiques d'un filetage métrique ISO de diamètre nominal d et de pas P. */
  MP.threadDims = function (d, P) {
    const d2 = d - 0.649519 * P;      // diamètre sur flancs
    const d3 = d - 1.226869 * P;      // diamètre à fond de filet (vis)
    const D1 = d - 1.082532 * P;      // diamètre intérieur de l'écrou
    const As = Math.PI / 4 * Math.pow((d2 + d3) / 2, 2); // section résistante (ISO 898-1)
    return { d, P, d2, d3, D1, H: 0.866025 * P, As };
  };

  /** Profil de vis : rayon en fonction de la position axiale s (sommet plat P/8 centré en s = 0). */
  MP.extThreadProfile = function (d, P) {
    const rMaj = d / 2, r3 = (d - 1.226869 * P) / 2;
    const fl = (rMaj - r3) * T30;
    const c = P / 16;
    return MP.periodic([[0, rMaj], [c, rMaj], [c + fl, r3], [P - c - fl, r3], [P - c, rMaj]], P);
  };

  /** Profil d'écrou : fond de filet P/8 en s = 0, sommet plat P/4 ; jeu radial c (impression 3D). */
  MP.intThreadProfile = function (d, P, clr) {
    const rMaj = d / 2 + clr, r1 = (d - 1.082532 * P) / 2 + clr;
    const fl = (rMaj - r1) * T30;
    const c = P / 16;
    return MP.periodic([[0, rMaj], [c, rMaj], [c + fl, r1], [P - c - fl, r1], [P - c, rMaj]], P);
  };

  /** Longueur filetée b d'une vis à filetage partiel (ISO 4014 : 2d+6 ; ISO 4762 : 2d+12 si l ≤ 125). */
  MP.partialThreadLength = function (d, l, extra) {
    let b = 2 * d + (extra === undefined ? 6 : extra);
    if (l > 125 && l <= 200) b += 6;
    else if (l > 200) b += 19;
    return Math.min(b, l);
  };

  /** Rayon de filet à l'angle theta et à la cote z : hélice droite (hand = 'R') ou gauche. */
  MP.helixPhase = function (z, z0, theta, lead, hand) {
    return (z - z0) - (hand === 'L' ? -1 : 1) * lead * theta / MP.TAU;
  };

  /**
   * Polyligne axiale d'une colonne (angle theta) d'une surface hélicoïdale.
   * Les sommets sont placés sur les points anguleux du profil (maillage économe) ;
   * les extrémités peuvent être raffinées (chanfreins). Nombre de points identique pour toutes les colonnes.
   *  o.f      profil périodique f(s) (avec f.bps)      o.period   période axiale (pas ou pas axial)
   *  o.lead   avance par tour                          o.hand     'R' | 'L'
   *  o.zref   origine de phase                         o.z0, o.z1 bornes axiales
   *  o.post   (r, z) => r : modification (chanfrein)   o.refLo / o.refHi : longueurs raffinées en début / fin
   *  o.fineDz pas du raffinement
   */
  MP.helixColumn = function (theta, o) {
    const sg = o.hand === 'L' ? -1 : 1;
    const shift = sg * o.lead * theta / MP.TAU;
    const pt = (z) => [o.post(o.f((z - o.zref) - shift), z), z];
    const out = [];
    let refLo = o.refLo || 0, refHi = o.refHi || 0;
    const L = o.z1 - o.z0;
    if (L < refLo + refHi + 0.5 * o.period) { refLo = L; refHi = 0; }
    const zA0 = o.z0 + refLo, zA1 = o.z1 - refHi;
    if (refLo > 0) for (const z of MP.levels(o.z0, zA0, o.fineDz)) out.push(pt(z));
    if (zA1 - zA0 > 1e-9) {
      const per = o.period, maxS = per, sh = Math.abs(o.lead);
      const mMin = Math.floor((zA0 - o.zref - sh - maxS) / per) - 1;
      const mMax = Math.ceil((zA1 - o.zref + sh) / per) + 1;
      const bps = o.f.bps;
      for (let m = mMin; m <= mMax; m++) {
        for (let k = 0; k < bps.length; k++) {
          const z = Math.min(zA1, Math.max(zA0, o.zref + shift + m * per + bps[k]));
          out.push(pt(z));
        }
      }
    }
    if (refHi > 0) { const lv = MP.levels(zA1, o.z1, o.fineDz); for (let j = 1; j < lv.length; j++) out.push(pt(lv[j])); }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
