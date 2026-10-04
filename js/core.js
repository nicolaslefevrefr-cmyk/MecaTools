/* core.js — noyau géométrique : maillages étanches, export STL (unités : mm) */
(function (root) {
  'use strict';
  const MP = (root.MP = root.MP || {});
  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;

  /* ---------- Utilitaires ---------- */
  MP.TAU = TAU;
  MP.DEG = DEG;
  MP.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  MP.inv = (a) => Math.tan(a) - a; // fonction involute

  /** Rayon d'un hexagone (entre-plats s) à l'angle theta ; sommet à theta = 0. */
  MP.hexRadius = function (theta, s) {
    const a = s / 2;
    let d = theta - Math.PI / 6;
    d -= Math.round(d / (Math.PI / 3)) * (Math.PI / 3);
    return a / Math.cos(d);
  };

  /** Profil périodique linéaire par morceaux : pts = [[s, v], ...] sur [0, P). */
  MP.periodic = function (pts, P) {
    const n = pts.length;
    const fn = function (s) {
      s = s - Math.floor(s / P) * P;
      if (s < pts[0][0]) {
        const a = pts[n - 1], b = pts[0];
        const sa = a[0] - P;
        return a[1] + ((s - sa) / (b[0] - sa)) * (b[1] - a[1]);
      }
      for (let k = 0; k < n - 1; k++) {
        if (s <= pts[k + 1][0]) {
          const a = pts[k], b = pts[k + 1];
          const d = b[0] - a[0];
          return d < 1e-12 ? b[1] : a[1] + ((s - a[0]) / d) * (b[1] - a[1]);
        }
      }
      const a = pts[n - 1], b = pts[0];
      const sb = b[0] + P;
      return a[1] + ((s - a[0]) / (sb - a[0])) * (b[1] - a[1]);
    };
    // pts[0] est le milieu d'un plat (s = 0) : les vrais sommets sont les points suivants
    fn.bps = pts.slice(1).map((q) => q[0]);
    return fn;
  };

  /** Niveaux z uniformes entre z0 et z1 (extrémités exactes incluses). */
  MP.levels = function (z0, z1, dz) {
    const out = [z0];
    const n = Math.max(1, Math.floor((z1 - z0) / dz - 1e-9));
    for (let j = 1; j <= n; j++) {
      const z = z0 + j * dz;
      if (z < z1 - 1e-9) out.push(z);
    }
    out.push(z1);
    return out;
  };

  /* ---------- Solide de révolution à profil dépendant de l'angle ----------
     spec.thetas : angles des colonnes (croissants, doublons autorisés)
     spec.column(i) : polygone fermé [[rho, z], ...] (même nombre de points pour toutes les colonnes)
     spec.twist(z) : décalage angulaire optionnel (engrenages hélicoïdaux)
     spec.diag : 0/1, choix de la diagonale (sens d'hélice) */
  MP.revolve = function (spec) {
    const th = spec.thetas, n = th.length;
    const twist = spec.twist || null;
    const cols = new Array(n);
    for (let i = 0; i < n; i++) cols[i] = spec.column(i);
    const K = cols[0].length;
    const pos = new Float64Array(n * K * 3);
    for (let i = 0; i < n; i++) {
      const c = cols[i];
      if (c.length !== K) throw new Error('Colonnes de tailles différentes (' + c.length + ' ≠ ' + K + ')');
      for (let k = 0; k < K; k++) {
        const rho = c[k][0], z = c[k][1];
        const a = th[i] + (twist ? twist(z) : 0);
        const o = (i * K + k) * 3;
        pos[o] = rho * Math.cos(a);
        pos[o + 1] = rho * Math.sin(a);
        pos[o + 2] = z;
      }
    }
    const idx = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      for (let k = 0; k < K; k++) {
        const k2 = (k + 1) % K;
        const a = i * K + k, b = i * K + k2, c = j * K + k2, d = j * K + k;
        if (spec.diag) { idx.push(a, b, d, b, c, d); } else { idx.push(a, b, c, a, c, d); }
      }
    }
    return MP.finalize(pos, idx);
  };

  /* ---------- Prisme d'un polygone 2D (découpage en oreilles) ---------- */
  function earClip(poly) {
    const n = poly.length;
    const V = [];
    let area = 0;
    for (let i = 0; i < n; i++) {
      const p = poly[i], q = poly[(i + 1) % n];
      area += p[0] * q[1] - q[0] * p[1];
    }
    for (let i = 0; i < n; i++) V.push(area > 0 ? i : n - 1 - i);
    const tris = [];
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const inTri = (p, a, b, c) => {
      const d1 = cross(p, a, b), d2 = cross(p, b, c), d3 = cross(p, c, a);
      const neg = d1 < -1e-12 || d2 < -1e-12 || d3 < -1e-12;
      const pos = d1 > 1e-12 || d2 > 1e-12 || d3 > 1e-12;
      return !(neg && pos);
    };
    let guard = 0;
    while (V.length > 3 && guard++ < n * n) {
      let clipped = false;
      for (let k = 0; k < V.length; k++) {
        const i0 = V[(k + V.length - 1) % V.length], i1 = V[k], i2 = V[(k + 1) % V.length];
        const a = poly[i0], b = poly[i1], c = poly[i2];
        if (cross(a, b, c) <= 1e-12) continue;
        let ok = true;
        for (let m = 0; m < V.length; m++) {
          const im = V[m];
          if (im === i0 || im === i1 || im === i2) continue;
          if (inTri(poly[im], a, b, c)) { ok = false; break; }
        }
        if (!ok) continue;
        tris.push([i0, i1, i2]);
        V.splice(k, 1);
        clipped = true;
        break;
      }
      if (!clipped) break;
    }
    if (V.length === 3) tris.push([V[0], V[1], V[2]]);
    return tris;
  }

  /** Extrusion d'un polygone [[x, y], ...] entre z0 et z1. */
  MP.extrude = function (poly, z0, z1) {
    let ar = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      ar += p[0] * q[1] - q[0] * p[1];
    }
    if (ar < 0) poly = poly.slice().reverse(); // sens trigonométrique
    // suppression des doublons et des points alignés (sinon le découpage en oreilles reste bloqué)
    let changed = true;
    while (changed && poly.length > 3) {
      changed = false;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[(i + poly.length - 1) % poly.length], b = poly[i], c2 = poly[(i + 1) % poly.length];
        const cr = (b[0] - a[0]) * (c2[1] - a[1]) - (b[1] - a[1]) * (c2[0] - a[0]);
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-9 || Math.abs(cr) < 1e-10) { poly = poly.slice(0, i).concat(poly.slice(i + 1)); changed = true; break; }
      }
    }
    const n = poly.length;
    const pos = new Float64Array(n * 2 * 3);
    for (let i = 0; i < n; i++) {
      pos.set([poly[i][0], poly[i][1], z0], i * 3);
      pos.set([poly[i][0], poly[i][1], z1], (n + i) * 3);
    }
    const idx = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      idx.push(i, j, n + j, i, n + j, n + i);
    }
    for (const t of earClip(poly)) {
      idx.push(t[0], t[2], t[1]);               // face z0 (normale vers -z)
      idx.push(n + t[0], n + t[1], n + t[2]);   // face z1 (normale vers +z)
    }
    return MP.finalize(pos, idx);
  };

  /* ---------- Soudure des sommets, nettoyage, orientation ---------- */
  MP.finalize = function (pos, idx) {
    const map = new Map();
    const remap = new Int32Array(pos.length / 3);
    const out = [];
    const Q = 1e5;
    for (let v = 0; v < remap.length; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      const key = Math.round(x * Q) + ',' + Math.round(y * Q) + ',' + Math.round(z * Q);
      let id = map.get(key);
      if (id === undefined) {
        id = out.length / 3;
        map.set(key, id);
        out.push(x, y, z);
      }
      remap[v] = id;
    }
    const tri = [];
    for (let t = 0; t < idx.length; t += 3) {
      const a = remap[idx[t]], b = remap[idx[t + 1]], c = remap[idx[t + 2]];
      if (a === b || b === c || a === c) continue;
      tri.push(a, b, c);
    }
    const mesh = { pos: Float64Array.from(out), idx: Uint32Array.from(tri) };
    if (MP.volume(mesh) < 0) {
      for (let t = 0; t < mesh.idx.length; t += 3) {
        const tmp = mesh.idx[t + 1]; mesh.idx[t + 1] = mesh.idx[t + 2]; mesh.idx[t + 2] = tmp;
      }
    }
    return mesh;
  };

  /** Fusionne plusieurs maillages disjoints en un seul (ex. pièces d'un assemblage). */
  MP.merge = function (meshes) {
    let np = 0, ni = 0;
    for (const m of meshes) { np += m.pos.length; ni += m.idx.length; }
    const pos = new Float64Array(np), idx = new Uint32Array(ni);
    let po = 0, io = 0;
    for (const m of meshes) {
      pos.set(m.pos, po);
      const base = po / 3;
      for (let t = 0; t < m.idx.length; t++) idx[io + t] = m.idx[t] + base;
      po += m.pos.length; io += m.idx.length;
    }
    return { pos, idx };
  };

  /* ---------- Mesures et contrôle d'étanchéité ---------- */
  MP.volume = function (m) {
    const p = m.pos, ix = m.idx;
    let v = 0;
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      v += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
            p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
            p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
    }
    return v;
  };

  MP.bbox = function (m) {
    const p = m.pos;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        if (p[i + k] < lo[k]) lo[k] = p[i + k];
        if (p[i + k] > hi[k]) hi[k] = p[i + k];
      }
    }
    return { min: lo, max: hi, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
  };

  /** Chaque arête orientée doit apparaître une fois et son inverse une fois. */
  MP.check = function (m) {
    const V = m.pos.length / 3, ix = m.idx;
    const cnt = new Map();
    let bad = 0;
    const add = (a, b) => {
      const k = a * V + b;
      cnt.set(k, (cnt.get(k) || 0) + 1);
    };
    for (let t = 0; t < ix.length; t += 3) {
      add(ix[t], ix[t + 1]); add(ix[t + 1], ix[t + 2]); add(ix[t + 2], ix[t]);
    }
    for (const [k, c] of cnt) {
      const a = Math.floor(k / V), b = k - a * V;
      if (c !== 1 || cnt.get(b * V + a) !== 1) bad++;
    }
    return { watertight: bad === 0, badEdges: bad, triangles: ix.length / 3, vertices: V, volume: MP.volume(m) };
  };

  /* ---------- Export STL binaire ---------- */
  MP.toSTL = function (m, name) {
    const nt = m.idx.length / 3;
    const buf = new ArrayBuffer(84 + nt * 50);
    const dv = new DataView(buf);
    const head = ('Atelier Mecanique - ' + (name || 'piece') + ' - mm').slice(0, 79);
    for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i) & 0x7f);
    dv.setUint32(80, nt, true);
    const p = m.pos, ix = m.idx;
    let o = 84;
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true);
      o += 12;
      for (const q of [a, b, c]) {
        dv.setFloat32(o, p[q], true); dv.setFloat32(o + 4, p[q + 1], true); dv.setFloat32(o + 8, p[q + 2], true);
        o += 12;
      }
      dv.setUint16(o, 0, true); o += 2;
    }
    return buf;
  };
})(typeof window !== 'undefined' ? window : globalThis);
