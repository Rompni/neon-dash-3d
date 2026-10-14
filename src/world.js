/*
 * NEON DASH 3D — mundo en Three.js.
 *
 * La física es la de Neon Dash (src/sim.js, plano 2D a 240 Hz). Aquí sólo se dibuja:
 * 1 bloque = 30 u de la física = 1 unidad 3D. El plano de juego es z = 0 y los objetos
 * tienen 1 bloque de fondo (z de -0.5 a 0.5). La cámara mira desde +z, un poco desde la izquierda
 * y desde arriba, para que se vean las caras de arriba y de los lados.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SavePass } from 'three/addons/postprocessing/SavePass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BU = Sim.BLOCK;
const DEG = Math.PI / 180;
const MODE_COLOR = { cube: '#7dff5a', ship: '#ff5ad1', ball: '#ff6b3d', ufo: '#ffb13b', wave: '#3bd8ff', flip: '#ffe23b', unflip: '#3b8bff', mini: '#ff7ad9', big: '#5dff7a',
  robot: '#e8e8ff', spider: '#b48cff', swing: '#fff35a', dual: '#ff8a3d', single: '#3bffd0' };
const SPEED_COLOR = { 0.5: '#ffa43b', 1: '#3bc6ff', 2: '#7dff5a', 3: '#ff5ad1', 4: '#ff3b3b' };
const PAD_COLOR = { yellow: '#ffd23a', pink: '#ff4fa3', blue: '#27e3ff', red: '#ff3b3b', green: '#5dff7a', black: '#5a4c7a' };
const WHITE = new THREE.Color(1, 1, 1);

// ------------------------------------------------------------------ colores del nivel
// Mismo criterio que Neon Dash: cada cambio de color se funde en 8 bloques.
const colorCache = new WeakMap();
function colorsAt(def, x) {
  let list = colorCache.get(def);
  if (!list) {
    list = (def.colors && def.colors.length ? def.colors : [{ x: 0, bg: '#2a53d6', ground: '#1c3aa8' }]).map((c) => ({
      x: c.x * BU,
      fade: (c.fade != null ? c.fade : 8) * BU,
      bg: new THREE.Color(c.bg),
      ground: new THREE.Color(c.ground),
      line: new THREE.Color(c.line || '#ffffff'),
      obj: c.obj ? new THREE.Color(c.obj) : new THREE.Color(c.bg).lerp(WHITE, 0.45),
    }));
    colorCache.set(def, list);
  }
  let cur = list[0], prev = list[0];
  for (let i = 0; i < list.length; i++) if (list[i].x <= x) { prev = i > 0 ? list[i - 1] : list[i]; cur = list[i]; }
  const t = cur === prev ? 1 : Math.min(1, Math.max(0, (x - cur.x) / Math.max(1, cur.fade)));
  return {
    bg: prev.bg.clone().lerp(cur.bg, t),
    ground: prev.ground.clone().lerp(cur.ground, t),
    line: prev.line.clone().lerp(cur.line, t),
    obj: prev.obj.clone().lerp(cur.obj, t),
  };
}

// ------------------------------------------------------------------ geometría
// Barras finas a lo largo de segmentos 3D (para los bordes de neón).
function bars(segs, t) {
  const up = new THREE.Vector3(0, 0, 1), geos = [];
  for (const [a, b] of segs) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    const g = new THREE.BoxGeometry(t, t, len + t);
    g.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(up, d.normalize()),
      new THREE.Vector3(1, 1, 1)));
    geos.push(g);
  }
  return mergeGeometries(geos);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function prismEdges(pts, z0, z1) {
  const segs = [];
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
    segs.push([V(ax, ay, z0), V(bx, by, z0)], [V(ax, ay, z1), V(bx, by, z1)], [V(ax, ay, z0), V(ax, ay, z1)]);
  }
  return segs;
}
function star(n, ro, ri) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = Math.PI / 2 + i * Math.PI / n, r = i % 2 ? ri : ro;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}
function chevron() {
  const s = new THREE.Shape();
  s.moveTo(-0.18, 0.32); s.lineTo(0.02, 0.32); s.lineTo(0.24, 0); s.lineTo(0.02, -0.32); s.lineTo(-0.18, -0.32); s.lineTo(0.04, 0);
  s.closePath();
  return s;
}

const GEO = {};
function initGeometry() {
  GEO.block = new RoundedBoxGeometry(1, 1, 1, 2, 0.05);
  GEO.blockEdges = bars(prismEdges([[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], -0.5, 0.5), 0.045);
  for (const [k, r, h] of [['spike', 0.435, 0.93], ['spikeSmall', 0.34, 0.47]]) {
    const g = new THREE.ConeGeometry(r, h, 4, 1);
    g.translate(0, -0.5 + h / 2, 0);
    GEO[k] = g;
    const apex = V(0, -0.5 + h, 0), base = [V(0, -0.5, r), V(r, -0.5, 0), V(0, -0.5, -r), V(-r, -0.5, 0)];
    GEO[k + 'Edges'] = bars(base.map((b, i) => [b, base[(i + 1) % 4]]).concat(base.map((b) => [b, apex])), 0.032);
  }
  const gear = new THREE.Shape();
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2 + (i % 2 ? 0 : 0.07), r = i % 2 ? 0.38 : 0.5;
    if (i) gear.lineTo(Math.cos(a) * r, Math.sin(a) * r); else gear.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.1, 0, Math.PI * 2, true); gear.holes.push(hole);
  const gp = gear.getPoints().map((p) => [p.x, p.y]);
  const rimSegs = [];
  for (const z of [0.105, -0.105]) gp.forEach((p, i) => { const q = gp[(i + 1) % gp.length]; rimSegs.push([V(p[0], p[1], z), V(q[0], q[1], z)]); });
  GEO.sawRim = bars(rimSegs, 0.025);
  GEO.saw = new THREE.ExtrudeGeometry(gear, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 2, curveSegments: 4 });
  GEO.saw.translate(0, 0, -0.08);
  GEO.sawRing = new THREE.TorusGeometry(0.27, 0.022, 8, 48);
  GEO.sawHub = new THREE.CylinderGeometry(0.13, 0.13, 0.34, 24).rotateX(Math.PI / 2);
  GEO.orb = new THREE.SphereGeometry(0.33, 32, 16);
  GEO.orbRing = new THREE.TorusGeometry(0.43, 0.035, 12, 48);
  GEO.thinRing = new THREE.TorusGeometry(0.43, 0.018, 8, 48);
  GEO.padBase = new THREE.BoxGeometry(0.88, 0.08, 0.7).translate(0, -0.46, 0);
  GEO.padDome = new THREE.SphereGeometry(0.4, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.42, 0.8).translate(0, -0.42, 0);
  GEO.beam = new THREE.CylinderGeometry(0.34, 0.4, 1.3, 24, 1, true).translate(0, 0.23, 0);
  GEO.coin = new THREE.CylinderGeometry(0.36, 0.36, 0.08, 40).rotateX(Math.PI / 2);
  GEO.coinRim = new THREE.TorusGeometry(0.36, 0.028, 10, 40);
  const st = new THREE.ExtrudeGeometry(star(5, 0.2, 0.085), { depth: 0.03, bevelEnabled: false });
  GEO.coinStar = mergeGeometries([st.clone().translate(0, 0, 0.04), st.clone().rotateY(Math.PI).translate(0, 0, -0.04)]);
  GEO.portal = new THREE.TorusGeometry(1, 0.085, 16, 72).rotateY(Math.PI / 2).scale(1, 1.55, 0.8);
  GEO.portalInner = new THREE.TorusGeometry(0.86, 0.025, 8, 72).rotateY(Math.PI / 2).scale(1, 1.55, 0.8);
  GEO.portalGlow = new THREE.PlaneGeometry(1.5, 3.1).rotateY(Math.PI / 2);
  GEO.cap = new THREE.OctahedronGeometry(0.13);
  GEO.chevron = new THREE.ExtrudeGeometry(chevron(), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }).translate(0, 0, -0.06);
  GEO.box = new THREE.BoxGeometry(1, 1, 1);
  GEO.plane = new THREE.PlaneGeometry(1, 1);
}
// Junta bloques que se tocan en rectángulos más grandes (primero en filas, luego en columnas), para que
// una fila de bloques se vea como una sola superficie lisa. Sólo afecta al dibujo.
function mergeBlocks(blocks) {
  const MAXW = 12 * BU;
  const rows = blocks.map((o) => ({ x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1 })).sort((a, b) => a.y0 - b.y0 || a.y1 - b.y1 || a.x0 - b.x0);
  const h = [];
  for (const r of rows) {
    const last = h[h.length - 1];
    if (last && last.y0 === r.y0 && last.y1 === r.y1 && Math.abs(last.x1 - r.x0) < 0.01 && r.x1 - last.x0 <= MAXW) last.x1 = r.x1;
    else h.push(r);
  }
  h.sort((a, b) => a.x0 - b.x0 || a.x1 - b.x1 || a.y0 - b.y0);
  const out = [];
  for (const r of h) {
    const last = out[out.length - 1];
    if (last && last.x0 === r.x0 && last.x1 === r.x1 && Math.abs(last.y1 - r.y0) < 0.01) last.y1 = r.y1;
    else out.push(r);
  }
  return out;
}
// Contorno exterior de la unión de bloques (como en GD): sólo se dibuja neón donde un lado es bloque y el otro
// aire, así una pared hecha de muchas columnas se ve como una sola pieza y no como una rejilla brillante.
// Devuelve segmentos [x0, y0, x1, y1] (en unidades de la física) horizontales y verticales, ya unidos.
function unionIntervals(list) {
  list.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [a, b] of list) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 1e-6) last[1] = Math.max(last[1], b); else out.push([a, b]);
  }
  return out;
}
function xorIntervals(A, B) {
  const ev = [];
  for (const [a, b] of A) ev.push([a, 1, 0], [b, -1, 0]);
  for (const [a, b] of B) ev.push([a, 0, 1], [b, 0, -1]);
  ev.sort((p, q) => p[0] - q[0]);
  const out = [];
  let ca = 0, cb = 0, start = null;
  for (let i = 0; i < ev.length; i++) {
    ca += ev[i][1]; cb += ev[i][2];
    if (i + 1 < ev.length && Math.abs(ev[i + 1][0] - ev[i][0]) < 1e-6) continue;
    const on = (ca > 0) !== (cb > 0);
    if (on && start === null) start = ev[i][0];
    else if (!on && start !== null) { if (ev[i][0] - start > 1e-6) out.push([start, ev[i][0]]); start = null; }
  }
  return out;
}
function outlineSegments(rects) {
  const segs = [];
  const r6 = (v) => Math.round(v * 1000) / 1000;
  const ys = [...new Set(rects.flatMap((r) => [r6(r.y0), r6(r.y1)]))];
  for (const y of ys) {
    const above = [], below = [];
    for (const r of rects) {
      if (r.y0 <= y + 1e-6 && r.y1 > y + 1e-6) above.push([r.x0, r.x1]);
      if (r.y0 < y - 1e-6 && r.y1 >= y - 1e-6) below.push([r.x0, r.x1]);
    }
    for (const [a, b] of xorIntervals(unionIntervals(above), unionIntervals(below))) segs.push([a, y, b, y]);
  }
  const byX = rects.slice().sort((a, b) => a.x0 - b.x0);
  const xs = [...new Set(rects.flatMap((r) => [r6(r.x0), r6(r.x1)]))].sort((a, b) => a - b);
  let maxW = 0;
  for (const r of rects) maxW = Math.max(maxW, r.x1 - r.x0);
  let lo = 0;
  for (const x of xs) {
    while (lo < byX.length && byX[lo].x0 < x - maxW - 1) lo++;
    const right = [], left = [];
    for (let i = lo; i < byX.length && byX[i].x0 <= x + 1e-6; i++) {
      const r = byX[i];
      if (r.x0 <= x + 1e-6 && r.x1 > x + 1e-6) right.push([r.y0, r.y1]);
      if (r.x0 < x - 1e-6 && r.x1 >= x - 1e-6) left.push([r.y0, r.y1]);
    }
    for (const [a, b] of xorIntervals(unionIntervals(right), unionIntervals(left))) segs.push([x, a, x, b]);
  }
  return segs;
}
// Triángulo (unidades) de una rampa, en el mismo orden que slopeGeo.
function slopeTri(o) {
  const w = o.x1 - o.x0, h = o.y1 - o.y0;
  const pts = !o.ceil ? (o.dir > 0 ? [[0, 0], [w, 0], [w, h]] : [[0, 0], [w, 0], [0, h]]) : (o.dir > 0 ? [[0, h], [0, 0], [w, h]] : [[0, h], [w, 0], [w, h]]);
  return pts.map(([x, y]) => [o.x0 + x, o.y0 + y]);
}
function inTri(px, py, t, tol) {
  const [a, b, c] = t;
  const d = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const P = [px, py];
  const d1 = d(P, a, b), d2 = d(P, b, c), d3 = d(P, c, a);
  // distancia con signo aproximada: se normaliza por la longitud de cada lado
  const n1 = d1 / Math.hypot(a[0] - b[0], a[1] - b[1]), n2 = d2 / Math.hypot(b[0] - c[0], b[1] - c[1]), n3 = d3 / Math.hypot(c[0] - a[0], c[1] - a[1]);
  const neg = n1 < -tol || n2 < -tol || n3 < -tol, pos = n1 > tol || n2 > tol || n3 > tol;
  return !(neg && pos);
}
// Geometría de neón del contorno de bloques y rampas juntos: barras en la cara de delante y la de detrás, y
// aristas de profundidad en las esquinas; color por vértice según la x (los cambios de color del nivel).
// Un lado de bloque tapado por una rampa, o un lado de rampa pegado a un bloque, no se dibuja.
function outlineGeometry(rects, slopes, colorAt) {
  const tris = slopes.map(slopeTri);
  const inRect = (x, y) => rects.some((r) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1);
  const STEP = BU / 2;
  const keep = [];
  const pieces = (ax, ay, bx, by, test) => {
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / STEP));
    let start = null;
    for (let i = 0; i <= n; i++) {
      const ok = i < n && test(ax + (bx - ax) * (i + 0.5) / n, ay + (by - ay) * (i + 0.5) / n);
      if (ok && start === null) start = i;
      if (!ok && start !== null) {
        keep.push([ax + (bx - ax) * start / n, ay + (by - ay) * start / n, ax + (bx - ax) * i / n, ay + (by - ay) * i / n]);
        start = null;
      }
    }
  };
  for (const [ax, ay, bx, by] of outlineSegments(rects)) pieces(ax, ay, bx, by, (x, y) => !tris.some((t) => inTri(x, y, t, 0.5)));
  tris.forEach((t, k) => {
    for (let i = 0; i < 3; i++) {
      const [ax, ay] = t[i], [bx, by] = t[(i + 1) % 3];
      // normal hacia fuera del triángulo
      const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      let nx = by - ay, ny = -(bx - ax);
      const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
      if ((ax - cx) * nx + (ay - cy) * ny < 0) { nx = -nx; ny = -ny; }
      pieces(ax, ay, bx, by, (x, y) => {
        const ox = x + nx * 2, oy = y + ny * 2;
        return !inRect(ox, oy) && !tris.some((u, j) => j !== k && inTri(ox, oy, u, 0.5));
      });
    }
  });
  const t = 0.045, geos = [], corners = new Map(), up = new THREE.Vector3(0, 0, 1);
  const push = (a, b, c) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const g = new THREE.BoxGeometry(t, t, len + t);
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(up, d.normalize()), new THREE.Vector3(1, 1, 1)));
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    geos.push(g);
  };
  for (const [ax, ay, bx, by] of keep) {
    const c = colorAt((ax + bx) / 2);
    const x0 = ax / BU, y0 = ay / BU, x1 = bx / BU, y1 = by / BU;
    push(V(x0, y0, 0.5), V(x1, y1, 0.5), c);
    push(V(x0, y0, -0.5), V(x1, y1, -0.5), c);
    for (const [px, py] of [[x0, y0], [x1, y1]]) corners.set(px.toFixed(2) + ',' + py.toFixed(2), [px, py, c]);
  }
  for (const [px, py, c] of corners.values()) push(V(px, py, -0.5), V(px, py, 0.5), c);
  return geos.length ? mergeGeometries(geos) : null;
}
const blockCache = new Map();
function blockGeo(key) {
  if (blockCache.has(key)) return blockCache.get(key);
  const [w, h] = key.split('x').map(Number);
  const r = {
    body: new RoundedBoxGeometry(w, h, 1, 2, 0.05),
    edges: bars(prismEdges([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], -0.5, 0.5), 0.045),
  };
  blockCache.set(key, r);
  return r;
}
const slopeCache = new Map();
function slopeGeo(w, h, dir, ceil) {
  const key = `${w},${h},${dir},${ceil ? 1 : 0}`;
  if (slopeCache.has(key)) return slopeCache.get(key);
  let pts;
  if (!ceil) pts = dir > 0 ? [[0, 0], [w, 0], [w, h]] : [[0, 0], [w, 0], [0, h]];
  else pts = dir > 0 ? [[0, h], [0, 0], [w, h]] : [[0, h], [w, 0], [w, h]];
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const body = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
  const r = { body, edges: bars(prismEdges(pts, -0.5, 0.5), 0.045) };
  slopeCache.set(key, r);
  return r;
}

// ------------------------------------------------------------------ materiales
const MAT = {};
function glowMaterial(kind, color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv;
      void main(){
        ${kind === 'radial'
          ? 'float a = pow(max(0.0, 1.0 - length(vUv - 0.5) * 2.0), 2.2);'
          : 'float a = pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.12, vUv.y) * 0.9;'}
        gl_FragColor = vec4(uColor * a * uAlpha, a * uAlpha);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}
const colorMats = new Map();
function neonOf(hex, k) {
  const key = 'n' + hex + k;
  if (!colorMats.has(key)) colorMats.set(key, new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k || 2.4) }));
  return colorMats.get(key);
}
function glossyOf(hex, emit) {
  const key = 'g' + hex + emit;
  if (!colorMats.has(key)) {
    colorMats.set(key, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.18, metalness: 0.1, emissive: hex, emissiveIntensity: emit }));
  }
  return colorMats.get(key);
}
function glowOf(kind, hex) {
  const key = kind + hex;
  if (!colorMats.has(key)) colorMats.set(key, glowMaterial(kind, hex));
  return colorMats.get(key);
}
function initMaterials() {
  MAT.body = new THREE.MeshStandardMaterial({ color: 0x0b0e20, metalness: 0.2, roughness: 0.45, envMapIntensity: 0.18 });
  MAT.metal = new THREE.MeshStandardMaterial({ color: 0x4a4c5e, metalness: 0.85, roughness: 0.25 });
  MAT.spike = new THREE.MeshStandardMaterial({ color: 0x3a3a52, metalness: 0.55, roughness: 0.28, flatShading: true });
  MAT.neon = new THREE.MeshBasicMaterial({ color: 0xffffff });
  MAT.neonV = new THREE.MeshBasicMaterial({ vertexColors: true });
  MAT.gold = new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 1, roughness: 0.2, emissive: 0x7a4400, emissiveIntensity: 0.5 });
  MAT.goldLight = new THREE.MeshStandardMaterial({ color: 0xfff1b0, metalness: 0.8, roughness: 0.25, emissive: 0xffd23a, emissiveIntensity: 0.6 });
  MAT.ghost = new THREE.MeshStandardMaterial({ color: 0x9fb4ff, metalness: 0.6, roughness: 0.3, transparent: true, opacity: 0.35, emissive: 0x3050a0, emissiveIntensity: 0.6 });
  MAT.white = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.8, 1.8) });
  MAT.shadow = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false,
    alphaMap: radialTexture() });
}
function radialTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ------------------------------------------------------------------ escena
const W = {
  renderer: null, scene: null, camera: null, composer: null, bloom: null, post: null,
  level: null, levelGroup: null, anim: [], player: null, quality: 'alta',
  floorY: 0, ceilY: Infinity, ceilVis: 0, time: 0, ballAng: 0, lastX: null,
  cam: { d: 1, e: 1.3, s: -2.2, roll: 0, rollT: 0, kick: 0, mode: null, flipRoll: 1 },
  cos: { trail: 'clasica', death: 'cubitos', flame: 'naranja', glow: null }, reduceFlash: false,
  designs: {}, groups: [], scenery: [], skyFollow: [], theme: 'ciudad', cpGroup: null, squash: 0, wasGrounded: true, streakPts: [],
};

const SKY_VS = 'varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }';
const SKY_FS = `uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uGlow; uniform float uBeat; varying vec3 vDir;
  float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
  void main(){
    float y = vDir.y;
    vec3 c = mix(uMid, uTop, smoothstep(0.0, 0.55, y));
    c = mix(c, uMid * 0.55, smoothstep(0.0, -0.3, y));
    c += uGlow * pow(max(0.0, 1.0 - abs(y - 0.04) * 6.0), 3.0) * (0.55 + 0.25 * uBeat);
    vec3 q = floor(vDir * 420.0);
    float s = step(0.9965, hash(q)) * smoothstep(0.05, 0.4, y);
    c += vec3(s) * (0.6 + 0.4 * hash(q + 1.0));
    gl_FragColor = vec4(c, 1.0);
  }`;

// Edificios: ventanas calculadas en el shader a partir de la posición en el mundo.
const CITY_VS = `varying vec3 vLocal; varying vec3 vWorld; varying float vSeed;
  void main(){
    vLocal = position;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vSeed = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const CITY_FS = `uniform vec3 uBody; uniform vec3 uWin; uniform vec3 uFog; uniform float uFogD; uniform float uBeat;
  varying vec3 vLocal; varying vec3 vWorld; varying float vSeed;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    vec3 c = uBody;
    vec2 g = vec2(vWorld.x + vWorld.z * 0.7, vWorld.y) * vec2(1.4, 1.8);
    vec2 cell = floor(g), f = fract(g);
    float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.25, f.y) * step(f.y, 0.75);
    float lit = step(0.78, hash(cell + vSeed));
    c += uWin * win * lit * (0.9 + 0.5 * hash(cell * 1.3));
    // aristas: cerca del borde en dos ejes a la vez (cada cara entera está en ±0.5 de uno solo)
    float ex = smoothstep(0.465, 0.5, abs(vLocal.x)), ez = smoothstep(0.465, 0.5, abs(vLocal.z));
    float rim = smoothstep(0.985, 1.0, vLocal.y) * max(ex, ez) + 0.4 * ex * ez;
    c += uWin * rim * (0.9 + uBeat * 0.5);
    float d = length(vWorld - cameraPosition);
    float fog = 1.0 - exp(-uFogD * uFogD * d * d);
    gl_FragColor = vec4(mix(c, uFog, fog), 1.0);
  }`;

// Suelo: rejilla luminosa que se apaga con la distancia y brilla más cerca del plano de juego.
const FLOOR_VS = 'varying vec3 vWorld; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }';
const FLOOR_FS = `uniform vec3 uGround; uniform vec3 uLine; uniform vec3 uFog; uniform float uFogD; uniform float uBeat; uniform float uVis;
  varying vec3 vWorld;
  float grid(vec2 p, float w){ vec2 d = abs(fract(p - 0.5) - 0.5) / fwidth(p); return 1.0 - min(min(d.x, d.y) / w, 1.0); }
  void main(){
    vec2 p = vWorld.xz;
    float near = exp(-abs(vWorld.z) * 0.12);
    vec3 c = uGround * (0.12 + 0.22 * near);
    float g1 = grid(p, 1.2) * 0.5, g4 = grid(p / 4.0, 1.6);
    c += uLine * (g1 * 0.22 + g4 * 0.6) * (0.25 + 0.75 * near) * (0.85 + 0.3 * uBeat);
    c += uLine * smoothstep(0.7, 0.0, abs(vWorld.z - 0.2)) * 0.25;
    float d = length(vWorld - cameraPosition);
    float fog = 1.0 - exp(-uFogD * uFogD * d * d);
    gl_FragColor = vec4(mix(c, uFog, fog), uVis);
  }`;

function initScene(canvas) {
  const r = W.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 0.95;
  r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = W.scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(r);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  W.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
  initGeometry();
  initMaterials();

  W.hemi = new THREE.HemisphereLight(0x9aa8ff, 0x10081e, 0.45);
  scene.add(W.hemi);
  W.sun = new THREE.DirectionalLight(0xffffff, 1.0);
  W.sun.position.set(-6, 12, 10);
  scene.add(W.sun, W.sun.target);
  W.rim = new THREE.DirectionalLight(0x8f7bff, 1.2);
  W.rim.position.set(8, 4, -10);
  scene.add(W.rim, W.rim.target);

  W.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uBeat: { value: 0 } },
    vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false,
  }));
  W.sky.renderOrder = -10;
  scene.add(W.sky);

  const floorMat = () => new THREE.ShaderMaterial({
    uniforms: { uGround: { value: new THREE.Color() }, uLine: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uFogD: { value: 0.02 }, uBeat: { value: 0 }, uVis: { value: 1 } },
    vertexShader: FLOOR_VS, fragmentShader: FLOOR_FS, transparent: true,
  });
  W.floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), floorMat());
  W.ceil = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2), floorMat());
  W.floorLine = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  W.ceilLine = new THREE.Mesh(GEO.box, W.floorLine.material);
  scene.add(W.floor, W.ceil, W.floorLine, W.ceilLine);

  W.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), MAT.shadow);
  scene.add(W.shadow);

  W.cityMat = new THREE.ShaderMaterial({
    uniforms: { uBody: { value: new THREE.Color() }, uWin: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uFogD: { value: 0.02 }, uBeat: { value: 0 } },
    vertexShader: CITY_VS, fragmentShader: CITY_FS,
  });

  initParticles();
  initShards();
  W.player = makePlayer('#27e3ff', '#ffd23a');
  scene.add(W.player.group);
  initPost();
}

// ------------------------------------------------------------------ postproceso
const POST_FS = `uniform sampler2D tDiffuse; uniform float uFlash; uniform vec3 uFlashColor; uniform float uAberr; uniform float uVig; varying vec2 vUv;
  void main(){
    vec2 dir = (vUv - 0.5);
    vec3 c;
    c.r = texture2D(tDiffuse, vUv + dir * uAberr).r;
    c.g = texture2D(tDiffuse, vUv).g;
    c.b = texture2D(tDiffuse, vUv - dir * uAberr).b;
    float v = smoothstep(0.95, 0.25, length(dir) * uVig);
    c *= mix(0.55, 1.0, v);
    c = mix(c, uFlashColor, uFlash);
    gl_FragColor = vec4(c, 1.0);
  }`;
// Bloom selectivo: el brillo se calcula en una pasada aparte (bloomComposer) en la que el jugador se pinta
// de negro; luego se suma a la imagen normal. Así el neón brilla y el jugador conserva sus colores, nítido.
const MIX_FS = `uniform sampler2D tDiffuse; uniform sampler2D tBloom; uniform sampler2D tBloomBase; uniform float uOn; varying vec2 vUv;
  void main(){
    vec3 glow = max(texture2D(tBloom, vUv).rgb - texture2D(tBloomBase, vUv).rgb, 0.0);
    gl_FragColor = texture2D(tDiffuse, vUv) + uOn * vec4(glow, 0.0);
  }`;
const VS_UV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
function initPost() {
  const b = W.bloomComposer = new EffectComposer(W.renderer);
  b.renderToScreen = false;
  b.addPass(new RenderPass(W.scene, W.camera));
  // el pase de bloom devuelve imagen + brillo: se guarda la imagen antes para quedarse sólo con el brillo
  W.bloomBase = new SavePass();
  b.addPass(W.bloomBase);
  W.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.28, 0.8);
  b.addPass(W.bloom);
  const c = W.composer = new EffectComposer(W.renderer);
  c.addPass(new RenderPass(W.scene, W.camera));
  W.mix = new ShaderPass({ uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, tBloomBase: { value: null }, uOn: { value: 1 } }, vertexShader: VS_UV, fragmentShader: MIX_FS });
  c.addPass(W.mix);
  W.post = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) }, uAberr: { value: 0.0015 }, uVig: { value: 1.25 } },
    vertexShader: VS_UV,
    fragmentShader: POST_FS,
  });
  c.addPass(W.post);
  c.addPass(new OutputPass());
  W.blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
}
// Pinta el jugador de negro (sólo para la pasada del bloom), salvo lo que sí debe brillar: el fuego del motor.
function hidePlayerFromBloom(on) {
  for (const pl of [W.player, W.twin]) if (pl) pl.group.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      const m = o.material;
      if (m.isShaderMaterial || m.userData.neon || (m.emissiveIntensity > 1 && /motor/.test(m.name))) return;
      o.userData.realMat = m;
      o.material = W.blackMat;
    } else if (o.userData.realMat) {
      o.material = o.userData.realMat;
      o.userData.realMat = null;
    }
  });
}
function renderFrame(dt) {
  const bloomOn = W.quality !== 'baja';
  W.mix.uniforms.uOn.value = bloomOn ? 1 : 0;
  if (bloomOn) {
    hidePlayerFromBloom(true);
    W.bloomComposer.render(dt);
    hidePlayerFromBloom(false);
    W.mix.uniforms.tBloom.value = W.bloomComposer.readBuffer.texture;
    W.mix.uniforms.tBloomBase.value = W.bloomBase.renderTarget.texture;
  }
  W.composer.render(dt);
}
function setResolution(r) {
  W.resolution = r;
  resize();
}
function setQuality(q) {
  W.quality = q;
  resize();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  if (!w || !h) return; // ventana plegada: sin tamaño no se puede renderizar
  // resolución: 'nativa' usa la densidad de la pantalla (hasta 2x); el resto es una escala fija
  const native = Math.min(window.devicePixelRatio || 1, 2);
  const pr = Math.max(0.35, { nativa: native, alta: 1, media: 0.75, baja: 0.5 }[W.resolution || 'nativa'] || native);
  W.renderer.setPixelRatio(pr);
  W.renderer.setSize(w, h, false);
  W.composer.setPixelRatio(pr);
  W.composer.setSize(w, h);
  W.bloomComposer.setPixelRatio(Math.min(pr, 1));
  W.bloomComposer.setSize(w, h);
  W.bloomBase.renderTarget.setSize(W.bloomComposer.renderTarget1.width, W.bloomComposer.renderTarget1.height);
  W.camera.aspect = w / h;
  W.camera.updateProjectionMatrix();
  W.particles.material.uniforms.uScale.value = h * pr * 0.5;
}

// ------------------------------------------------------------------ nivel
function disposeLevel() {
  if (!W.levelGroup) return;
  W.scene.remove(W.levelGroup);
  W.levelGroup.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
    if (o.userData.ownGeo) o.geometry.dispose();
  });
  W.levelGroup = null;
  W.anim = [];
  W.groups = [];
  W.tgroups = [];
  W.scenery = [];
  W.skyFollow = [];
}

function buildLevel(L) {
  disposeLevel();
  W.level = L;
  const def = L.def;
  const grp = W.levelGroup = new THREE.Group();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const objCol = (x) => colorsAt(def, x).obj;
  const blocks = L.objs.filter((o) => o.t === 'block' && !o.grp); // los de grupos van sueltos (wrapGrouped)
  const spikes = L.objs.filter((o) => o.t === 'spike' && !o.grp);

  // bloques: cuerpo y bordes de neón instanciados por tamaño (para no estirar esquinas ni aristas);
  // el color de cada uno sale de su x
  const bySize = new Map();
  for (const o of mergeBlocks(blocks)) {
    const k = (o.x1 - o.x0) / BU + 'x' + (o.y1 - o.y0) / BU;
    if (!bySize.has(k)) bySize.set(k, []);
    bySize.get(k).push(o);
  }
  for (const [k, list] of bySize) {
    const g = blockGeo(k);
    const body = new THREE.InstancedMesh(g.body, MAT.body, list.length);
    list.forEach((o, i) => {
      m4.makeTranslation((o.x0 + o.x1) / 2 / BU, (o.y0 + o.y1) / 2 / BU, 0);
      body.setMatrixAt(i, m4);
    });
    grp.add(body);
  }
  // bordes de neón: sólo el contorno exterior de todos los bloques juntos
  const outline = outlineGeometry(blocks.map((o) => ({ x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1 })), L.objs.filter((o) => o.t === 'slope' && !o.grp), (x) => objCol(x).multiplyScalar(1.7));
  if (outline) {
    const mesh = new THREE.Mesh(outline, MAT.neonV);
    mesh.userData.ownGeo = true;
    grp.add(mesh);
  }
  // pinchos: pirámides facetadas con aristas de neón
  for (const small of [false, true]) {
    const list = spikes.filter((o) => (o.size === 0.5) === small);
    if (!list.length) continue;
    const body = new THREE.InstancedMesh(small ? GEO.spikeSmall : GEO.spike, MAT.spike, list.length);
    const edges = new THREE.InstancedMesh(small ? GEO.spikeSmallEdges : GEO.spikeEdges, MAT.neon, list.length);
    list.forEach((o, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -(o.r || 0) * DEG);
      m4.compose(pos.set(o.x + 0.5, o.y + 0.5, 0), q, scl.set(1, 1, 1));
      body.setMatrixAt(i, m4); edges.setMatrixAt(i, m4);
      edges.setColorAt(i, objCol(o.x * BU).lerp(new THREE.Color('#ff4fa3'), 0.35).multiplyScalar(2.0));
    });
    grp.add(body, edges);
  }
  for (const o of L.objs) {
    if (o.base) { Object.assign(o, o.base); L._dynX = NaN; } // objeto de un grupo con triggers: posición inicial
    const n0 = grp.children.length;
    const cx = o.x + 0.5, cy = o.y + 0.5;
    switch (o.t) {
      case 'slope': {
        const g = slopeGeo((o.x1 - o.x0) / BU, (o.y1 - o.y0) / BU, o.dir, o.ceil);
        const b = new THREE.Mesh(g.body, MAT.body);
        b.position.set(o.x0 / BU, o.y0 / BU, 0);
        grp.add(b);
        // las rampas fijas van en el contorno común; las de grupos (que se mueven) llevan sus propios bordes
        if (o.grp) {
          const e = new THREE.Mesh(g.edges, new THREE.MeshBasicMaterial({ color: objCol(o.x0).multiplyScalar(1.7) }));
          e.position.copy(b.position);
          grp.add(e);
        }
        break;
      }
      case 'saw': {
        const s = new THREE.Group();
        s.position.set(o.cx / BU, o.cy / BU, 0);
        s.scale.setScalar(o.size || 1);
        const c = objCol(o.cx).lerp(new THREE.Color('#ff4fa3'), 0.5);
        s.add(new THREE.Mesh(GEO.saw, MAT.metal), new THREE.Mesh(GEO.sawHub, MAT.metal));
        const ring = new THREE.Mesh(GEO.sawRing, new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.0) }));
        ring.position.z = 0.12;
        const ring2 = ring.clone(); ring2.position.z = -0.12;
        s.add(ring, ring2, new THREE.Mesh(GEO.sawRim, new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.2) })));
        grp.add(s);
        W.anim.push({ o, kind: 'saw', obj: s });
        break;
      }
      case 'pad': {
        const p = new THREE.Group();
        p.position.set(cx, cy, 0);
        if (o.r === 180) p.scale.y = -1;
        const hex = PAD_COLOR[o.kind] || '#ffd23a';
        const beam = new THREE.Mesh(GEO.beam, glowOf('beam', hex));
        p.add(new THREE.Mesh(GEO.padBase, MAT.metal), new THREE.Mesh(GEO.padDome, glossyOf(hex, 1.6)), beam);
        grp.add(p);
        W.anim.push({ o, kind: 'pad', obj: p, beam });
        break;
      }
      case 'orb': {
        const g = new THREE.Group();
        g.position.set(cx, cy, 0);
        const hex = PAD_COLOR[o.kind] || '#ffd23a';
        const ball = new THREE.Mesh(GEO.orb, glossyOf(hex, o.kind === 'black' ? 0.6 : 1.2));
        const ring = new THREE.Mesh(GEO.orbRing, o.kind === 'black' ? neonOf('#c8beff', 2) : MAT.white);
        const pulse = new THREE.Mesh(GEO.thinRing, new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(2.5), transparent: true }));
        const halo = new THREE.Mesh(GEO.plane, glowOf('radial', hex));
        halo.scale.setScalar(2.1); halo.position.z = -0.45;
        g.add(halo, ball, ring, pulse);
        grp.add(g);
        W.anim.push({ o, kind: 'orb', obj: g, ring, pulse, ball });
        break;
      }
      case 'coin': {
        const g = new THREE.Group();
        g.position.set(cx, cy, 0);
        const spin = new THREE.Group();
        spin.add(new THREE.Mesh(GEO.coin, MAT.gold), new THREE.Mesh(GEO.coinRim, MAT.gold), new THREE.Mesh(GEO.coinStar, MAT.goldLight));
        spin.children.forEach((m) => { m.userData.mat = m.material; });
        const halo = new THREE.Mesh(GEO.plane, glowOf('radial', '#ffd23a'));
        halo.scale.setScalar(1.6); halo.position.z = -0.3;
        g.add(halo, spin);
        grp.add(g);
        W.anim.push({ o, kind: 'coin', obj: g, spin, halo, taken: 0 });
        break;
      }
      case 'portal': {
        const g = new THREE.Group();
        g.position.set(cx, cy, 0);
        if (o.kind === 'speed') {
          const hex = SPEED_COLOR[o.value] || '#3bc6ff';
          const n = { 0.5: 1, 1: 1, 2: 2, 3: 3, 4: 4 }[o.value] || 1;
          const chevs = [];
          for (let i = 0; i < n; i++) {
            const c = new THREE.Mesh(GEO.chevron, glossyOf(hex, 1.4));
            c.position.x = (i - (n - 1) / 2) * 0.3;
            if (o.value === 0.5) c.rotation.y = Math.PI;
            c.scale.setScalar(1.4);
            g.add(c); chevs.push(c);
          }
          const glow = new THREE.Mesh(GEO.plane, glowOf('radial', hex));
          glow.scale.set(2.4, 2.4, 1); glow.position.z = -0.4;
          g.add(glow);
          W.anim.push({ o, kind: 'speed', obj: g, chevs });
        } else {
          const hex = MODE_COLOR[o.kind] || '#ffffff';
          const ring = new THREE.Mesh(GEO.portal, neonOf(hex, 2.1));
          const inner = new THREE.Mesh(GEO.portalInner, neonOf(hex, 1.4));
          const glow = new THREE.Mesh(GEO.portalGlow, glowOf('radial', hex));
          const capT = new THREE.Mesh(GEO.cap, MAT.white), capB = capT.clone();
          capT.position.y = 1.62; capB.position.y = -1.62;
          g.add(glow, ring, inner, capT, capB);
          g.rotation.y = -0.85; // girado hacia la cámara: de canto sería una línea
          W.anim.push({ o, kind: 'portal', obj: g, inner, glow, caps: [capT, capB] });
        }
        // portal girado: un grupo exterior gira en el plano de juego (el interior guarda la inclinación)
        if (o.r) { const outer = new THREE.Group(); outer.position.copy(g.position); g.position.set(0, 0, 0); outer.rotation.z = -o.r * DEG; outer.add(g); grp.add(outer); }
        else grp.add(g);
        break;
      }
    }
    if (o.grp) wrapGrouped(L, o, grp, n0, objCol);
  }
  buildDecos(def, grp);
  buildScenery(L, grp);
  buildGate(L, grp);
  W.scene.add(grp);
  if (W.player) precompile();
  const len = L.endX / BU;
  for (const f of [W.floor, W.ceil]) { f.scale.set(len + 260, 1, 90); f.position.x = len / 2 + 40; }
  for (const f of [W.floorLine, W.ceilLine]) { f.scale.set(len + 260, 0.05, 0.05); f.position.set(len / 2 + 40, 0, 0.55); }
}

// Objeto de un grupo (o.grp): sus mallas van sueltas (no instanciadas con las demás) dentro de un envoltorio
// que frame() mueve, gira y oculta según Sim.groupState. Bloques y pinchos se crean aquí (fuera de las
// instancias); el resto ya lo ha añadido buildLevel a partir del hijo n0.
function wrapGrouped(L, o, grp, n0, objCol) {
  const m4 = new THREE.Matrix4();
  if (o.t === 'block') {
    const g = blockGeo((o.x1 - o.x0) / BU + 'x' + (o.y1 - o.y0) / BU);
    const body = new THREE.InstancedMesh(g.body, MAT.body, 1), edges = new THREE.InstancedMesh(g.edges, MAT.neon, 1);
    m4.makeTranslation((o.x0 + o.x1) / 2 / BU, (o.y0 + o.y1) / 2 / BU, 0);
    body.setMatrixAt(0, m4); edges.setMatrixAt(0, m4);
    edges.setColorAt(0, objCol(o.x0).multiplyScalar(1.7));
    grp.add(body, edges);
  } else if (o.t === 'spike') {
    const small = o.size === 0.5;
    const body = new THREE.InstancedMesh(small ? GEO.spikeSmall : GEO.spike, MAT.spike, 1);
    const edges = new THREE.InstancedMesh(small ? GEO.spikeSmallEdges : GEO.spikeEdges, MAT.neon, 1);
    m4.compose(new THREE.Vector3(o.x + 0.5, o.y + 0.5, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -(o.r || 0) * DEG), new THREE.Vector3(1, 1, 1));
    body.setMatrixAt(0, m4); edges.setMatrixAt(0, m4);
    edges.setColorAt(0, objCol(o.x * BU).lerp(new THREE.Color('#ff4fa3'), 0.35).multiplyScalar(2.0));
    grp.add(body, edges);
  }
  const kids = grp.children.slice(n0);
  if (!kids.length) return;
  const wrap = new THREE.Group();
  for (const k of kids) { grp.remove(k); wrap.add(k); }
  // con triggers de transparencia, materiales propios (los compartidos no se tocan)
  const fades = (L.trigs || []).some(({ tr }) => (tr.kind === 'alpha' || tr.kind === 'fade') && o.grp.includes(tr.group));
  if (fades) wrap.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; if (m.userData.mat) m.userData.mat = m.material; } });
  grp.add(wrap);
  (W.tgroups || (W.tgroups = [])).push({ obj: wrap, grp: o.grp, fades });
}

// Aplica Sim.groupState (gs) a los objetos y decorados con grupo. Sin gs (editor), todo en su sitio.
const _gsV = new THREE.Vector3();
function applyGroups(gs) {
  const xf = (grp) => (gs ? Sim.groupXform(gs, grp) : { dx: 0, dy: 0, rot: 0, c: null, hidden: false, alpha: 1 });
  const setAlpha = (obj, al) => obj.traverse((m) => { if (!m.isMesh) return; if (m.material.uniforms && m.material.uniforms.uAlpha) m.material.uniforms.uAlpha.value = al; else m.material.opacity = al; });
  for (const g of W.tgroups || []) {
    const t = xf(g.grp);
    // p' = R·(p − c) + c + off  →  posición del envoltorio = c + off − R·c
    const a = -t.rot * DEG, cx = t.c ? t.c[0] / BU : 0, cy = t.c ? t.c[1] / BU : 0;
    g.obj.rotation.z = a;
    g.obj.position.set(cx + t.dx / BU - (cx * Math.cos(a) - cy * Math.sin(a)), cy + t.dy / BU - (cx * Math.sin(a) + cy * Math.cos(a)), 0);
    g.obj.visible = !t.hidden && t.alpha > 0.01;
    if (g.fades) setAlpha(g.obj, t.alpha);
  }
  // decorados (def.decos con group): se mueven, giran alrededor del centro del grupo y se desvanecen
  for (const g of W.groups) {
    const t = xf(g.grps || [g.group]);
    _gsV.copy(g.base);
    if (t.rot) {
      const a = -t.rot * DEG, cx = t.c[0] / BU, cy = t.c[1] / BU, rx = _gsV.x - cx, ry = _gsV.y - cy;
      _gsV.x = cx + rx * Math.cos(a) - ry * Math.sin(a); _gsV.y = cy + rx * Math.sin(a) + ry * Math.cos(a);
    }
    g.obj.position.set(_gsV.x + t.dx / BU, _gsV.y + t.dy / BU, _gsV.z);
    if (t.rot || g.rotated) { g.obj.rotation.z = -t.rot * DEG; g.rotated = !!t.rot; }
    setAlpha(g.obj, t.alpha);
    g.obj.visible = !t.hidden && t.alpha > 0.01;
  }
}

// Triggers de cámara (gs.cam): zoom (distancia ÷ zoom), desplazamiento y giro, sobre la cámara del juego.
function applyCamTrig(cam, k, tx, ty, roll) {
  if (!k || (k.zoom === 1 && !k.dx && !k.dy && !k.deg)) return;
  const z = k.zoom > 0 ? k.zoom : 1, ox = k.dx / BU, oy = k.dy / BU;
  cam.position.set(tx + ox + (cam.position.x - tx) / z, ty + oy + (cam.position.y - ty) / z, cam.position.z / z);
  cam.lookAt(_gsV.set(tx + ox, ty + oy, 0));
  cam.rotateZ(roll + k.deg * DEG); // deg + = el mundo gira en sentido horario en pantalla
}

function buildDecos(def, grp) {
  for (const d of def.decos || []) {
    const hex = d.color || '#ffffff';
    const z = d.layer === 'fg' ? 1.6 : -1.4 - (d.par || 0) * 8;
    const a = d.alpha != null ? d.alpha : 1;
    let m = null;
    switch (d.kind) {
      case 'glow':
        m = new THREE.Mesh(GEO.plane, glowOf('radial', hex));
        m.scale.setScalar((d.r || 2) * 2.4);
        m.position.set(d.x, d.y, z);
        break;
      case 'pillar': {
        m = new THREE.Group();
        const w = d.w || 1, h = d.h || 6;
        const body = new THREE.Mesh(GEO.box, MAT.body);
        body.scale.set(w * 0.8, h, w * 0.8);
        const e = new THREE.Mesh(bars(prismEdges([[-0.4 * w, 0], [0.4 * w, 0], [0.4 * w, h], [-0.4 * w, h]], -0.4 * w, 0.4 * w), 0.04), neonOf(hex, 1.8 * a));
        e.userData.ownGeo = true;
        body.position.y = h / 2;
        m.add(body, e);
        m.position.set(d.x + 0.5, d.y, z);
        break;
      }
      case 'ring':
        m = new THREE.Mesh(new THREE.TorusGeometry(d.r || 2, 0.05, 10, 64), neonOf(hex, 1.8 * a));
        m.userData.ownGeo = true;
        m.position.set(d.x, d.y, z);
        W.anim.push({ kind: 'spin', obj: m, k: 0.3 });
        break;
      case 'diamond':
        m = new THREE.Mesh(new THREE.OctahedronGeometry(d.r || 0.8), new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.9 * a, metalness: 0.4, roughness: 0.2, flatShading: true }));
        m.userData.ownGeo = true;
        m.position.set(d.x, d.y, z);
        W.anim.push({ kind: 'spin', obj: m, k: 0.8 });
        break;
      case 'arrow':
        m = new THREE.Mesh(GEO.chevron, glossyOf(hex, 1.2));
        m.scale.setScalar(1.6);
        m.position.set(d.x, d.y, z);
        break;
      case 'line':
        m = new THREE.Mesh(GEO.box, neonOf(hex, 1.6 * a));
        m.scale.set(d.w || 4, 0.05, 0.05);
        m.position.set(d.x + (d.w || 4) / 2, d.y, z);
        break;
    }
    if (m) {
      const dg = Sim.groupsOf(d);
      if (dg) {
        m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; } });
        W.groups.push({ obj: m, base: m.position.clone(), group: dg[0], grps: dg });
      }
      grp.add(m);
    }
  }
  // figuras flotantes del fondo, deterministas por nivel
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const geos = [new THREE.OctahedronGeometry(1), new THREE.TorusGeometry(1, 0.08, 8, 48), new THREE.IcosahedronGeometry(1)];
  for (let x = 10; x < W.level.endX / BU + 40; x += 9 + rnd() * 10) {
    const k = Math.floor(rnd() * geos.length);
    const m = new THREE.Mesh(geos[k], k === 1 ? MAT.neon : new THREE.MeshStandardMaterial({ color: 0x15132b, metalness: 0.6, roughness: 0.3, flatShading: true, emissive: 0x2a1a6a, emissiveIntensity: 0.5 }));
    m.position.set(x, 5 + rnd() * 7, -10 - rnd() * 14);
    m.scale.setScalar(0.8 + rnd() * 1.6);
    m.rotation.set(rnd() * 6, rnd() * 6, 0);
    grp.add(m);
    W.anim.push({ kind: 'float', obj: m, k: 0.2 + rnd() * 0.4, y0: m.position.y, ph: rnd() * 6 });
  }
}

function buildCity(L, grp, hk) {
  hk = hk || 1;
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const len = L.endX / BU;
  const items = [];
  for (const [z, hmin, hmax, step] of [[-24, 3, 12, 3.2], [-40, 6, 20, 4.2], [-64, 10, 34, 5.5]]) {
    for (let x = -50; x < len + 90; x += step * (0.6 + rnd() * 0.8)) {
      items.push([x, z + (rnd() - 0.5) * 6, 1.4 + rnd() * 3.2, hmin + rnd() * (hmax - hmin), 1.6 + rnd() * 3]);
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, W.cityMat, items.length);
  const m4 = new THREE.Matrix4();
  items.forEach(([x, z, w, h, d], i) => mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(x, -0.02, z), new THREE.Quaternion(), new THREE.Vector3(w, h * hk, d))));
  mesh.frustumCulled = false;
  mesh.userData.ownGeo = true;
  grp.add(mesh);
}

// ------------------------------------------------------------------ fondos por nivel
// Cada nivel tiene su paisaje de fondo (def.theme o, si no, según el nivel). Las piezas lejanas usan un
// shader facetado con niebla: cara iluminada según su orientación y cimas que brillan con el color del nivel.
const THEME_BY_LEVEL = { 'primer-pulso': 'ciudad', orbita: 'espacio', 'fase-doble': 'cristales', ladera: 'montanas', espejo: 'atardecer', abismo: 'vacio', 'bano-de-sangre': 'volcan', telarana: 'cristales' };
const THEMES = ['ciudad', 'montanas', 'atardecer', 'cristales', 'espacio', 'vacio', 'volcan', 'bosque', 'desierto', 'glaciar', 'circuito', 'oceano', 'ruinas', 'tormenta'];
const THEME_NAMES = { ciudad: 'Ciudad', montanas: 'Montañas', atardecer: 'Atardecer', cristales: 'Cristales', espacio: 'Espacio', vacio: 'Vacío', volcan: 'Volcán',
  bosque: 'Bosque', desierto: 'Desierto', glaciar: 'Glaciar', circuito: 'Circuito', oceano: 'Océano', ruinas: 'Ruinas', tormenta: 'Tormenta' };
const FAR_VS = `varying vec3 vWorld; varying vec3 vLocal;
  void main(){
    vLocal = position;
    #ifdef USE_INSTANCING
      vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    #else
      vec4 wp = modelMatrix * vec4(position, 1.0);
    #endif
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const FAR_FS = `uniform vec3 uBody; uniform vec3 uGlow; uniform vec3 uFog; uniform float uFogD; uniform float uBeat; uniform float uPeak; uniform float uY0; uniform float uY1;
  varying vec3 vWorld; varying vec3 vLocal;
  void main(){
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    if (dot(n, cameraPosition - vWorld) < 0.0) n = -n;
    float lit = 0.3 + 0.7 * max(dot(n, normalize(vec3(-0.4, 0.8, 0.5))), 0.0);
    vec3 c = uBody * lit;
    float h = clamp((vLocal.y - uY0) / (uY1 - uY0), 0.0, 1.0);
    c += uGlow * pow(h, uPeak) * (1.0 + uBeat * 0.5);
    float d = length(vWorld - cameraPosition);
    float fog = 1.0 - exp(-uFogD * uFogD * d * d);
    gl_FragColor = vec4(mix(c, uFog, fog), 1.0);
  }`;
function farMaterial(opts) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uBody: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uFog: { value: new THREE.Color() },
      uFogD: { value: 0.017 }, uBeat: { value: 0 }, uPeak: { value: opts.peak || 5 }, uY0: { value: opts.y0 != null ? opts.y0 : 0 }, uY1: { value: opts.y1 != null ? opts.y1 : 1 },
    },
    vertexShader: FAR_VS, fragmentShader: FAR_FS,
  });
  W.scenery.push({ mat: m, body: opts.body || 0.07, glow: opts.glow || 'line', glowK: opts.glowK || 0.8, fog: opts.fog || 1 });
  return m;
}
function scatter(geo, mat, items, grp) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  items.forEach((it, i) => mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(it[0], it[1], it[2]), q.setFromEuler(e.set(it[6] || 0, it[7] || 0, it[8] || 0)), new THREE.Vector3(it[3], it[4], it[5]))));
  mesh.frustumCulled = false;
  mesh.userData.ownGeo = true;
  grp.add(mesh);
  return mesh;
}
function mountains(L, grp, rows, opts) {
  let seed = opts.seed || 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const len = L.endX / BU, items = [];
  for (const [z, hmin, hmax, wmin, wmax] of rows) {
    for (let x = -80; x < len + 140;) {
      const w = wmin + rnd() * (wmax - wmin);
      items.push([x, -0.05, z + (rnd() - 0.5) * 10, w, hmin + rnd() * (hmax - hmin), w * (0.6 + rnd() * 0.5), 0, rnd() * 6, 0]);
      x += w * (0.45 + rnd() * 0.35);
    }
  }
  const geo = new THREE.ConeGeometry(0.5, 1, opts.sides || 6, opts.jag ? 3 : 1).translate(0, 0.5, 0);
  if (opts.jag) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0.05 && y < 0.95) { pos.setX(i, pos.getX(i) * (0.75 + rnd() * 0.5)); pos.setZ(i, pos.getZ(i) * (0.75 + rnd() * 0.5)); pos.setY(i, y + (rnd() - 0.5) * 0.12); }
    }
  }
  return scatter(geo, farMaterial(opts), items, grp);
}
// Sol de atardecer (synthwave): disco con degradado y franjas, siempre en el horizonte detrás de la cámara.
function sun(grp, top, bottom, size) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(top) }, uBot: { value: new THREE.Color(bottom) }, uBeat: { value: 0 } },
    vertexShader: VS_UV,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uBot; uniform float uBeat; varying vec2 vUv;
      void main(){
        vec2 p = vUv - 0.5; float r = length(p);
        float disc = smoothstep(0.31, 0.3, r);
        float stripes = step(0.0, p.y) + step(0.5, fract((p.y + 0.3) * 18.0 + p.y * 6.0)) * step(p.y, 0.0);
        vec3 c = mix(uBot, uTop, smoothstep(-0.3, 0.3, p.y)) * 1.6;
        float halo = pow(max(0.0, 1.0 - r * 2.0), 3.0) * (0.6 + 0.3 * uBeat);
        gl_FragColor = vec4(c * disc * stripes + mix(uBot, uTop, 0.5) * halo, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  m.scale.setScalar(size || 90);
  m.userData.ownGeo = true;
  grp.add(m);
  W.skyFollow.push({ obj: m, dx: 10, y: 14, z: -260, k: 1, beat: m.material });
  return m;
}
function starField(grp, n) {
  const pos = new Float32Array(n * 3);
  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, b = rnd() * 0.9 + 0.05, r = 260;
    pos.set([Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r - 20, Math.sin(a) * Math.cos(b) * r * 0.6 - 120], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false }));
  pts.userData.ownGeo = true;
  grp.add(pts);
  W.skyFollow.push({ obj: pts, dx: 0, y: 0, z: 0, k: 0.97 });
}
function planets(L, grp) {
  const len = L.endX / BU;
  const PL_FS = `uniform vec3 uA; uniform vec3 uB; uniform vec3 uRim; varying vec3 vN; varying vec3 vLocal; varying vec3 vView;
    void main(){
      float band = sin(vLocal.y * 9.0 + sin(vLocal.x * 3.0) * 1.2) * 0.5 + 0.5;
      vec3 c = mix(uA, uB, band);
      float lit = 0.15 + 0.85 * max(dot(normalize(vN), normalize(vec3(-0.6, 0.5, 0.6))), 0.0);
      float rim = pow(1.0 - max(dot(normalize(vN), normalize(vView)), 0.0), 3.0);
      gl_FragColor = vec4(c * lit + uRim * rim * 1.4, 1.0);
    }`;
  const PL_VS = `varying vec3 vN; varying vec3 vLocal; varying vec3 vView;
    void main(){ vLocal = position; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vView = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
  const sets = [['#ff7a3d', '#ffd23a', '#ffb13b'], ['#3b8bff', '#7af0ff', '#9fd6ff'], ['#b48cff', '#ff4fa3', '#ff9be0'], ['#5dff7a', '#1c8a6a', '#bfffe9']];
  const geo = new THREE.SphereGeometry(1, 48, 24);
  let k = 0;
  for (let x = 30; x < len + 120; x += 110, k++) {
    const [a, b, rim] = sets[k % sets.length];
    const p = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: { uA: { value: new THREE.Color(a).multiplyScalar(0.5) }, uB: { value: new THREE.Color(b).multiplyScalar(0.5) }, uRim: { value: new THREE.Color(rim) } }, vertexShader: PL_VS, fragmentShader: PL_FS }));
    const r = 14 + (k * 7) % 18;
    p.scale.setScalar(r);
    p.position.set(x, 16 + (k * 11) % 20, -170 - (k * 37) % 60);
    p.rotation.z = 0.3;
    grp.add(p);
    if (k % 2 === 0) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.06, 6, 96), neonOf(rim, 1.1));
      ring.scale.set(r, r, r * 0.25);
      ring.rotation.set(1.25, 0, 0.3);
      ring.position.copy(p.position);
      ring.userData.ownGeo = true;
      grp.add(ring);
    }
    W.anim.push({ kind: 'spin', obj: p, k: 0.05 });
  }
}
function seeded(n) {
  let seed = n;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}
// Aurora boreal: cortina de bandas que ondulan, siempre al fondo.
function aurora(grp, a, b) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), new THREE.ShaderMaterial({
    uniforms: { uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uTime: { value: 0 }, uBeat: { value: 0 } },
    vertexShader: VS_UV,
    fragmentShader: `uniform vec3 uA; uniform vec3 uB; uniform float uTime; uniform float uBeat; varying vec2 vUv;
      void main(){
        float x = vUv.x * 6.0;
        float w = sin(x * 1.3 + uTime * 0.35) * 0.08 + sin(x * 3.1 - uTime * 0.6) * 0.04;
        float y = vUv.y - 0.45 - w;
        float band = exp(-y * y * 60.0) + 0.6 * exp(-pow(y - 0.16, 2.0) * 120.0);
        float rays = 0.6 + 0.4 * sin(x * 22.0 + uTime * 1.5 + sin(x * 5.0) * 2.0);
        float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
        vec3 c = mix(uA, uB, smoothstep(-0.1, 0.25, y)) * band * rays * edge * (0.9 + uBeat * 0.3);
        gl_FragColor = vec4(c, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  m.scale.set(520, 120, 1);
  m.userData.ownGeo = true;
  grp.add(m);
  W.skyFollow.push({ obj: m, dx: 0, y: 40, z: -280, k: 0.92, beat: m.material });
  W.timeMats.push(m.material);
}
// Rayos de luz que bajan desde arriba (océano, bosque).
function lightShafts(L, grp, hex, n) {
  const rnd = seeded(41);
  for (let x = -20; x < L.endX / BU + 60; x += n + rnd() * n) {
    const g = new THREE.Mesh(GEO.plane, glowOf('beam', hex));
    g.scale.set(4 + rnd() * 5, 50, 1);
    g.position.set(x, 18, -30 - rnd() * 40);
    g.rotation.z = Math.PI + 0.25;
    grp.add(g);
  }
}
// Rayos de la tormenta: se encienden un instante y caen lejos.
function stormBolts(grp) {
  const bolts = [];
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
    const ln = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(3, 3, 4), transparent: true }));
    ln.visible = false; ln.frustumCulled = false; ln.userData.ownGeo = true;
    grp.add(ln);
    bolts.push({ ln, life: 0 });
  }
  W.storm = { bolts, next: 2 };
}
function strike(b, x) {
  const pos = b.ln.geometry.attributes.position;
  const z = -70 - Math.random() * 60;
  let px = x, py = 70;
  for (let i = 0; i < 24; i++) {
    pos.setXYZ(i, px, py, z);
    px += (Math.random() - 0.5) * 6; py -= 3.2 + Math.random() * 0.6;
  }
  pos.needsUpdate = true;
  b.ln.visible = true; b.life = 0.22;
}
function updateStorm(view, dt) {
  const st = W.storm;
  st.next -= dt;
  if (st.next <= 0) {
    st.next = 1.5 + Math.random() * 4;
    const b = st.bolts.find((q) => q.life <= 0);
    if (b) {
      strike(b, view.camX / BU - 30 + Math.random() * 70);
      if (!W.reduceFlash) { W.lightning = 1; }
    }
  }
  for (const b of st.bolts) {
    if (b.life > 0) {
      b.life -= dt;
      b.ln.material.opacity = Math.random() < 0.3 ? 0.2 : Math.max(0, b.life / 0.22);
      if (b.life <= 0) b.ln.visible = false;
    }
  }
}
// Partículas del ambiente según el fondo (ceniza, nieve, burbujas, luciérnagas, lluvia, datos).
function ambientParticles(view) {
  const cx = view.camX / BU, fy = W.floorY, r = Math.random;
  switch (W.theme) {
    case 'volcan':
      if (r() < 0.5) particle(cx - 12 + r() * 34, fy + r() * 1.5, -6 - r() * 22, (r() - 0.5) * 0.6, 1.2 + r() * 2, 0, 2.5, 0.18 + r() * 0.15, r() < 0.5 ? '#ff6b3d' : '#ffb13b', { drag: 0.2 });
      break;
    case 'glaciar':
      if (r() < 0.8) particle(cx - 14 + r() * 40, fy + 14, -3 - r() * 25, -0.6 - r() * 0.6, -1.2 - r() * 0.8, 0, 9, 0.07 + r() * 0.07, '#cfe8ff', { drag: 0 });
      break;
    case 'oceano':
      if (r() < 0.45) particle(cx - 12 + r() * 36, fy, -3 - r() * 25, (r() - 0.5) * 0.3, 1 + r() * 1.5, 0, 7, 0.08 + r() * 0.12, '#9fe8ff', { drag: 0 });
      break;
    case 'bosque':
      if (r() < 0.25) particle(cx - 10 + r() * 32, fy + 0.5 + r() * 6, -4 - r() * 20, (r() - 0.5) * 0.8, (r() - 0.5) * 0.8, 0, 3, 0.09 + r() * 0.06, r() < 0.6 ? '#d9ff5a' : '#7affb0', { drag: 0 });
      break;
    case 'tormenta':
      for (let i = 0; i < 3; i++) particle(cx - 12 + r() * 40, fy + 16, -2 - r() * 20, -3, -26, 0, 0.8, 0.04, '#8fa8d8', { drag: 0, square: true });
      break;
    case 'circuito':
      if (r() < 0.3) { const up = r() < 0.5; particle(cx - 8 + r() * 30, up ? fy : fy + 12, -8 - r() * 20, 0, up ? 6 : -6, 0, 2, 0.1, r() < 0.5 ? '#3bffd0' : '#3b8bff', { drag: 0, square: true }); }
      break;
    case 'desierto':
      if (r() < 0.3) particle(cx - 14 + r() * 36, fy + r() * 2, -3 - r() * 18, 3 + r() * 3, (r() - 0.3) * 0.6, 0, 3, 0.05 + r() * 0.05, '#ffd9a0', { drag: 0 });
      break;
  }
}
function buildScenery(L, grp) {
  const theme = THEMES.includes(L.def.theme3d) ? L.def.theme3d : THEME_BY_LEVEL[L.id] || 'ciudad';
  W.theme = theme;
  W.storm = null; W.timeMats = []; W.lightning = 0;
  switch (theme) {
    case 'ciudad': buildCity(L, grp); break;
    case 'montanas':
      mountains(L, grp, [[-38, 6, 14, 10, 18], [-64, 12, 26, 18, 30], [-100, 22, 42, 30, 46]], { seed: 9, peak: 6, glowK: 0.9 });
      sun(grp, '#ffe23b', '#ff4fa3', 70);
      break;
    case 'atardecer':
      mountains(L, grp, [[-50, 3, 9, 14, 26], [-85, 6, 16, 24, 40]], { seed: 21, peak: 3, sides: 4, glowK: 1.1 });
      sun(grp, '#ffd23a', '#ff3b8f', 110);
      buildCity(L, grp, 0.5);
      break;
    case 'cristales': {
      let seed = 13;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const items = [];
      for (let x = -60; x < L.endX / BU + 120; x += 2 + rnd() * 5) {
        const w = 0.8 + rnd() * 3, h = 3 + rnd() * 12;
        items.push([x, -0.5 + rnd() * 2, -14 - rnd() * 60, w, h, w, (rnd() - 0.5) * 0.5, rnd() * 3, (rnd() - 0.5) * 0.6]);
      }
      scatter(new THREE.OctahedronGeometry(1, 0), farMaterial({ y0: -1, y1: 1, peak: 3.5, glow: 'obj', glowK: 0.45, body: 0.22 }), items, grp);
      break;
    }
    case 'espacio':
      starField(grp, 2600);
      planets(L, grp);
      break;
    case 'vacio': {
      let seed = 17;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let x = 0; x < L.endX / BU + 60; x += 26) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(9 + rnd() * 6, 0.12, 8, 96), neonOf('#7a5cff', 1.2));
        ring.position.set(x, 6, -34 - rnd() * 20);
        ring.userData.ownGeo = true;
        grp.add(ring);
        W.anim.push({ kind: 'roll', obj: ring, k: (rnd() - 0.5) * 0.4 });
      }
      const items = [];
      for (let x = -60; x < L.endX / BU + 120; x += 3 + rnd() * 6) items.push([x, -0.05, -20 - rnd() * 70, 0.6 + rnd() * 1.6, 6 + rnd() * 26, 0.6 + rnd() * 1.6, 0, rnd() * 3, 0]);
      scatter(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), farMaterial({ peak: 12, body: 0.05, glowK: 0.9 }), items, grp);
      starField(grp, 1200);
      break;
    }
    case 'volcan':
      mountains(L, grp, [[-36, 8, 18, 10, 18], [-62, 14, 30, 18, 30], [-96, 22, 44, 30, 46]], { seed: 31, peak: 4, jag: true, sides: 5, glow: 'red', glowK: 1.2, body: 0.09 });
      sun(grp, '#ff6b3d', '#ff2a3a', 80);
      break;
    case 'bosque': {
      // pinos: tronco y tres pisos de copa, en tres filas
      const rnd = seeded(23), trunks = [], tiers = [[], [], []];
      for (const [z0, zr, hmin, hmax] of [[-16, 10, 4, 7], [-34, 14, 6, 11], [-60, 20, 9, 16]]) {
        for (let x = -60; x < L.endX / BU + 120; x += 1.6 + rnd() * 3) {
          const h = hmin + rnd() * (hmax - hmin), w = h * (0.36 + rnd() * 0.1), z = z0 - rnd() * zr;
          trunks.push([x, -0.05, z, w * 0.14, h * 0.3, w * 0.14]);
          for (let k = 0; k < 3; k++) tiers[k].push([x, h * (0.2 + k * 0.22), z, w * (1 - k * 0.24), h * (0.42 - k * 0.06), w * (1 - k * 0.24), 0, rnd() * 6, 0]);
        }
      }
      scatter(new THREE.CylinderGeometry(0.5, 0.6, 1, 5).translate(0, 0.5, 0), farMaterial({ peak: 2, body: 0.05, glowK: 0.1 }), trunks, grp);
      const cone = new THREE.ConeGeometry(0.5, 1, 7).translate(0, 0.5, 0);
      tiers.forEach((it, k) => scatter(cone.clone(), farMaterial({ peak: 3, body: 0.09, glow: 'obj', glowK: 0.35 + k * 0.15 }), it, grp));
      mountains(L, grp, [[-110, 20, 38, 30, 46]], { seed: 7, peak: 5, glowK: 0.5, body: 0.05 });
      lightShafts(L, grp, '#d9ffb0', 30);
      break;
    }
    case 'desierto': {
      // dunas suaves, pirámides y un sol enorme
      const rnd = seeded(19), dunes = [], pyr = [];
      for (const [z, s0, s1] of [[-30, 6, 12], [-55, 10, 20], [-90, 16, 30]]) {
        for (let x = -60; x < L.endX / BU + 140; x += s0 + rnd() * s0) dunes.push([x, -0.3, z + (rnd() - 0.5) * 8, s0 + rnd() * (s1 - s0), 1.5 + rnd() * s0 * 0.25, 6 + rnd() * 6]);
      }
      for (let x = 20; x < L.endX / BU + 140; x += 45 + rnd() * 60) {
        const h = 10 + rnd() * 18;
        pyr.push([x, -0.05, -70 - rnd() * 30, h * 1.6, h, h * 1.6, 0, Math.PI / 4, 0]);
      }
      scatter(new THREE.SphereGeometry(0.5, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), farMaterial({ y0: 0, y1: 0.5, peak: 4, body: 0.12, glowK: 0.5 }), dunes, grp);
      scatter(new THREE.ConeGeometry(0.5, 1, 4).translate(0, 0.5, 0), farMaterial({ peak: 8, body: 0.1, glow: 'obj', glowK: 1 }), pyr, grp);
      sun(grp, '#ffd27a', '#ff5a3b', 75);
      break;
    }
    case 'glaciar': {
      // picos de hielo afilados y aurora boreal
      mountains(L, grp, [[-32, 6, 14, 6, 12], [-58, 12, 26, 10, 20], [-96, 22, 44, 20, 36]], { seed: 45, peak: 2.2, jag: true, sides: 4, glow: 'obj', glowK: 0.7, body: 0.16 });
      const rnd = seeded(51), shards = [];
      for (let x = -60; x < L.endX / BU + 120; x += 3 + rnd() * 6) shards.push([x, -0.2, -12 - rnd() * 10, 0.5 + rnd() * 0.8, 1.5 + rnd() * 4, 0.5 + rnd() * 0.8, (rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.4]);
      scatter(new THREE.ConeGeometry(0.5, 1, 4).translate(0, 0.5, 0), farMaterial({ peak: 2, body: 0.25, glow: 'obj', glowK: 0.6 }), shards, grp);
      aurora(grp, '#3bffb0', '#b48cff');
      starField(grp, 900);
      break;
    }
    case 'circuito': {
      // torres de servidores, pistas de luz y una rejilla de chips
      const rnd = seeded(61), towers = [], chips = [];
      for (const [z, hmin, hmax] of [[-22, 3, 9], [-40, 6, 16], [-66, 10, 28]]) {
        for (let x = -50; x < L.endX / BU + 100; x += 2.5 + rnd() * 3.5) towers.push([x, -0.02, z + (rnd() - 0.5) * 6, 1 + rnd() * 1.6, hmin + rnd() * (hmax - hmin), 1 + rnd() * 1.6]);
      }
      for (let x = -40; x < L.endX / BU + 100; x += 6 + rnd() * 8) chips.push([x, 14 + rnd() * 18, -50 - rnd() * 30, 3 + rnd() * 3, 0.3, 3 + rnd() * 3, Math.PI / 2, 0, 0]);
      scatter(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), farMaterial({ peak: 7, body: 0.07, glow: 'line', glowK: 0.7 }), towers, grp);
      scatter(new THREE.BoxGeometry(1, 1, 1), farMaterial({ y0: -0.5, y1: 0.5, peak: 1, body: 0.05, glowK: 0.5 }), chips, grp);
      const len = L.endX / BU + 160;
      for (let i = 0; i < 9; i++) {
        const tr = new THREE.Mesh(GEO.box, neonOf(i % 2 ? '#3bffd0' : '#3b8bff', 1.3));
        tr.scale.set(len, 0.06, 0.06);
        tr.position.set(len / 2 - 60, 2 + i * 3.2 + rnd() * 1.5, -30 - i * 5);
        grp.add(tr);
      }
      break;
    }
    case 'oceano': {
      // fondo marino: rocas, algas que se mecen, rayos de sol y burbujas
      const rnd = seeded(71), rocks = [];
      for (let x = -60; x < L.endX / BU + 120; x += 3 + rnd() * 5) {
        const w = 1.5 + rnd() * 5;
        rocks.push([x, -0.6, -16 - rnd() * 60, w, w * (0.4 + rnd() * 0.5), w, rnd(), rnd() * 6, rnd()]);
      }
      scatter(new THREE.DodecahedronGeometry(0.6, 0), farMaterial({ y0: -0.6, y1: 0.6, peak: 3, body: 0.14, glow: 'obj', glowK: 0.4 }), rocks, grp);
      for (let x = -40; x < L.endX / BU + 80; x += 2 + rnd() * 4) {
        const k = new THREE.Mesh(GEO.box, neonOf(rnd() < 0.5 ? '#3bffb0' : '#3bc6ff', 0.7 + rnd() * 0.5));
        const h = 3 + rnd() * 7;
        k.geometry = GEO.box;
        const g = new THREE.Group();
        k.scale.set(0.12, h, 0.12); k.position.y = h / 2;
        g.add(k);
        g.position.set(x, -0.1, -10 - rnd() * 30);
        grp.add(g);
        W.anim.push({ kind: 'sway', obj: g, k: 0.6 + rnd() * 0.8, ph: rnd() * 6 });
      }
      lightShafts(L, grp, '#7ae8ff', 18);
      mountains(L, grp, [[-110, 18, 34, 30, 50]], { seed: 77, peak: 4, glowK: 0.4, body: 0.08 });
      break;
    }
    case 'ruinas': {
      // columnas de un templo (algunas rotas), arcos y rocas flotando
      const rnd = seeded(83), cols = [], caps = [], rocks = [];
      for (const [z, h0] of [[-20, 8], [-42, 13]]) {
        for (let x = -40; x < L.endX / BU + 100; x += 5 + rnd() * 3) {
          const broken = rnd() < 0.35, h = h0 * (broken ? 0.3 + rnd() * 0.4 : 1);
          cols.push([x, -0.05, z, 1.1, h, 1.1, broken ? (rnd() - 0.5) * 0.2 : 0, 0, broken ? (rnd() - 0.5) * 0.2 : 0]);
          if (!broken) caps.push([x, h, z, 1.8, 0.5, 1.8]);
        }
      }
      for (let x = -40; x < L.endX / BU + 100; x += 9 + rnd() * 14) rocks.push([x, 12 + rnd() * 16, -40 - rnd() * 40, 2 + rnd() * 4, 1.5 + rnd() * 3, 2 + rnd() * 4, rnd(), rnd() * 6, rnd()]);
      scatter(new THREE.CylinderGeometry(0.5, 0.5, 1, 10).translate(0, 0.5, 0), farMaterial({ peak: 3, body: 0.12, glowK: 0.5 }), cols, grp);
      scatter(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), farMaterial({ peak: 1, body: 0.12, glow: 'obj', glowK: 0.8 }), caps, grp);
      scatter(new THREE.IcosahedronGeometry(0.6, 0), farMaterial({ y0: -0.6, y1: 0.6, peak: 2, body: 0.1, glow: 'obj', glowK: 0.6 }), rocks, grp);
      for (let x = 30; x < L.endX / BU + 100; x += 70 + rnd() * 40) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(10, 0.25, 6, 48, Math.PI), neonOf('#ffd23a', 0.9));
        arch.position.set(x, 0, -70);
        arch.userData.ownGeo = true;
        grp.add(arch);
      }
      sun(grp, '#ffb86b', '#ff4fa3', 48);
      break;
    }
    case 'tormenta':
      mountains(L, grp, [[-40, 8, 16, 12, 20], [-70, 14, 28, 20, 32], [-110, 22, 40, 30, 46]], { seed: 91, peak: 6, jag: true, sides: 5, glowK: 0.6, body: 0.05 });
      buildCity(L, grp, 0.6);
      stormBolts(grp);
      break;
  }
}

function buildGate(L, grp) {
  const x = L.endX / BU;
  const g = new THREE.Group();
  g.position.set(x, 0, 0);
  for (let i = 0; i < 7; i++) {
    const bar = new THREE.Mesh(GEO.box, neonOf('#ffffff', 1.6));
    bar.scale.set(0.06, 14, 0.06);
    bar.position.set(i * 0.5, 7, -1.5 + (i % 2) * 3);
    g.add(bar);
  }
  const glow = new THREE.Mesh(GEO.plane, glowOf('beam', '#bfa8ff'));
  glow.scale.set(5, 16, 1); glow.position.set(1.5, 8, -0.8); glow.rotation.z = Math.PI;
  g.add(glow);
  grp.add(g);
  W.gate = { group: g, glow };
}

// ------------------------------------------------------------------ jugador
function canvasTex(draw, size) {
  const c = document.createElement('canvas'); c.width = c.height = size || 256;
  draw(c.getContext('2d'), c.width);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function cubeFace(c1, c2) {
  return canvasTex((g, S) => {
    g.fillStyle = c1; g.fillRect(0, 0, S, S);
    g.fillStyle = '#0a0a14'; g.fillRect(S * 0.06, S * 0.06, S * 0.88, S * 0.88);
    g.fillStyle = c1; g.fillRect(S * 0.14, S * 0.14, S * 0.72, S * 0.72);
    g.fillStyle = c2; g.fillRect(S * 0.24, S * 0.24, S * 0.52, S * 0.52);
    g.fillStyle = '#0a0a14';
    g.fillRect(S * 0.31, S * 0.34, S * 0.13, S * 0.14); g.fillRect(S * 0.56, S * 0.34, S * 0.13, S * 0.14);
    g.fillRect(S * 0.31, S * 0.58, S * 0.38, S * 0.08);
  });
}
function ballTex(c1, c2) {
  return canvasTex((g, S) => {
    g.fillStyle = c1; g.fillRect(0, 0, S, S);
    g.fillStyle = '#0a0a14'; g.fillRect(0, S * 0.42, S, S * 0.16);
    g.fillStyle = c2; g.fillRect(0, S * 0.46, S, S * 0.08);
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(S * (0.125 + i * 0.25), S * 0.25, S * 0.06, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(S * (0.125 + i * 0.25), S * 0.75, S * 0.06, 0, Math.PI * 2); g.fill(); }
  });
}
function makePlayer(c1, c2) {
  const group = new THREE.Group();
  const face = cubeFace(c1, c2);
  const skin = new THREE.MeshStandardMaterial({ map: face, emissiveMap: face, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.35, metalness: 0.1 });
  const main = new THREE.MeshStandardMaterial({ color: c1, roughness: 0.3, metalness: 0.35, emissive: c1, emissiveIntensity: 0.12 });
  const accent = new THREE.MeshStandardMaterial({ color: c2, roughness: 0.3, metalness: 0.35, emissive: c2, emissiveIntensity: 0.25 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35 });
  const flame = glowMaterial('radial', '#ffb13b');

  const cube = new THREE.Mesh(new RoundedBoxGeometry(0.94, 0.94, 0.94, 3, 0.1), skin);

  const ship = new THREE.Group();
  const hull = new THREE.Shape();
  hull.moveTo(0.62, -0.02); hull.lineTo(0.18, 0.16); hull.lineTo(-0.5, 0.2); hull.lineTo(-0.56, -0.08); hull.lineTo(-0.28, -0.24); hull.lineTo(0.32, -0.18); hull.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hull, { depth: 0.46, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3 }).translate(0, 0, -0.23);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 1.05), accent);
  wing.position.set(-0.12, -0.08, 0); wing.rotation.y = 0.15;
  const pilot = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.38, 0.38, 2, 0.05), skin);
  pilot.position.set(-0.08, 0.36, 0);
  const engine = new THREE.Mesh(GEO.plane, flame);
  engine.position.set(-0.72, -0.02, 0.3); engine.scale.set(0.7, 0.45, 1);
  ship.add(new THREE.Mesh(hullGeo, main), wing, pilot, engine);
  const engineRef = { mesh: engine };

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.47, 40, 20), new THREE.MeshStandardMaterial({ map: ballTex(c1, c2), roughness: 0.25, metalness: 0.25, emissive: 0xffffff, emissiveMap: ballTex(c1, c2), emissiveIntensity: 0.15 }));

  const ufo = new THREE.Group();
  const prof = [[0, -0.2], [0.3, -0.18], [0.56, -0.04], [0.6, 0.02], [0.4, 0.1], [0, 0.12]].map(([x, y]) => new THREE.Vector2(x, y));
  ufo.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 40), main));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  dome.position.y = 0.1;
  const ufoPilot = pilot.clone(); ufoPilot.scale.setScalar(0.62); ufoPilot.position.set(0, 0.2, 0);
  ufo.add(dome, ufoPilot);
  const lights0 = [];
  for (let i = 0; i < 8; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), MAT.white);
    const a = i / 8 * Math.PI * 2;
    l.position.set(Math.cos(a) * 0.5, -0.02, Math.sin(a) * 0.5);
    ufo.add(l); lights0.push(l);
  }

  const wave = new THREE.Group();
  const dart = new THREE.Shape();
  dart.moveTo(0.42, 0); dart.lineTo(-0.3, 0.27); dart.lineTo(-0.14, 0); dart.lineTo(-0.3, -0.27); dart.closePath();
  wave.add(new THREE.Mesh(new THREE.ExtrudeGeometry(dart, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2 }).translate(0, 0, -0.11), main));
  wave.add(new THREE.Mesh(bars(prismEdges([[0.42, 0], [-0.3, 0.27], [-0.14, 0], [-0.3, -0.27]], -0.13, 0.13), 0.025), new THREE.MeshBasicMaterial({ color: new THREE.Color(c1).multiplyScalar(2.4) })));

  // los modos nuevos usan de reserva un modelo parecido hasta tener el suyo
  const rotors = [];
  const rigs = {};
  const models = { cube, ship, ball, ufo, wave, robot: cube.clone(), spider: cube.clone(), swing: ufo.clone() };
  models.spider.scale.set(1, 0.8, 1);
  let lights = lights0;
  if (W.glb) {
    // Modelos de Blender (src/models.js): se clonan y color1/color2 toman la paleta del jugador
    let tint = {}, mc1 = c1, mc2 = c2;
    const recolor = (m) => {
      if (m.name.startsWith('neon')) {
        if (!tint[m.name]) { const n = tint[m.name] = new THREE.MeshStandardMaterial({ name: 'neon', color: mc2, emissive: mc2, emissiveIntensity: 0.8, roughness: 0.4 }); n.userData.neon = true; }
        return tint[m.name];
      }
      const base = m.name.startsWith('color1') ? mc1 : m.name.startsWith('color2') ? mc2 : null;
      if (!base) return m;
      if (!tint[m.name]) { tint[m.name] = m.clone(); tint[m.name].color.set(base); tint[m.name].emissive.set(base); tint[m.name].emissiveIntensity = 0.12; }
      return tint[m.name];
    };
    for (const [mode, base] of Object.entries(GLB_NAMES)) {
      // cada modo puede llevar los colores de su diseño (W.modeColors) o los del jugador
      const mc = W.modeColors && W.modeColors[mode];
      mc1 = mc ? mc[0] : c1; mc2 = mc ? mc[1] : c2; tint = {};
      const name = W.designs[mode] || base;
      const src = W.glb.getObjectByName(name) || W.glb.getObjectByName(base);
      if (!src) continue;
      const node = src.clone(true);
      node.position.set(0, 0, 0);
      node.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(recolor) : recolor(o.material); });
      const g = new THREE.Group();
      g.add(node);
      if (mode === 'robot' || mode === 'spider') rigs[mode] = buildRig(node, mode);
      if (mode === 'ship') { const fl = engine.clone(); fl.position.set(-0.86, -0.04, 0); g.add(fl); }
      if (mode === 'swing') {
        const rotorParts = [];
        node.traverse((o) => { if (o.isMesh && /rotor/.test(o.name)) rotorParts.push(o); });
        if (rotorParts.length) {
          node.updateMatrixWorld(true);
          const bb = new THREE.Box3();
          for (const r of rotorParts) bb.expandByObject(r);
          const hub = new THREE.Group();
          hub.position.copy(bb.getCenter(new THREE.Vector3()));
          node.add(hub);
          hub.updateMatrixWorld(true);
          for (const r of rotorParts) hub.attach(r);
          rotors.push(hub);
        }
        const blades = [];
        node.traverse((o) => { if (o.isMesh && /aspa/.test(o.name)) blades.push(o); });
        node.updateMatrixWorld(true);
        for (const b of blades) {
          b.geometry.computeBoundingBox();
          const c = b.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(b.matrixWorld);
          const hub = new THREE.Group();
          hub.position.set(Math.sign(c.x) * 0.42, 0.27, 0);
          node.add(hub);
          hub.updateMatrixWorld(true);
          hub.attach(b);
          rotors.push(hub);
        }
      }
      models[mode] = g;
    }
    lights = [];
    models.ufo.traverse((o) => { if (o.isMesh && /luz/.test(o.name)) lights.push(o); });
    const fl = models.ship.children.find((o) => o.material === flame);
    if (fl) engineRef.mesh = fl;
  }
  for (const m of Object.values(models)) { tame(m); outline(m); m.visible = false; group.add(m); }
  // halo de brillo (color de brillo del jugador, se elige en la tienda/garaje)
  const halo = new THREE.Mesh(GEO.plane, glowMaterial('radial', '#ffffff'));
  halo.scale.setScalar(2.4); halo.position.z = -0.7; halo.visible = false;
  group.add(halo);
  // luz de color para el entorno cercano; lejos del modelo para no quemarlo
  const light = new THREE.PointLight(c1, 3, 9, 1.2);
  light.position.set(0, 0.6, 3.2);
  group.add(light);
  const trail = makeTrail(c1);
  W.scene.add(trail.mesh);
  const streak = makeTrail(c2);
  streak.mesh.material.opacity = 0.45;
  streak.mesh.material.blending = THREE.AdditiveBlending;
  streak.mesh.material.depthWrite = false;
  W.scene.add(streak.mesh);
  return { group, models, engine: engineRef.mesh, lights, light, trail, streak, rotors, rigs, halo, flame, c1, c2 };
}
const GLB_NAMES = { cube: 'cubo', ship: 'nave', ball: 'bola', ufo: 'ovni', wave: 'onda', robot: 'robot', spider: 'arana', swing: 'swing' };
// Diseño elegido en el garaje para cada modo (nombre del nodo del GLB); si no existe se usa el básico.
function setDesigns(map, modeColors) { W.designs = Object.assign({}, map); W.modeColors = modeColors || null; }
function hasModel(name) { return !!(W.glb && W.glb.getObjectByName(name)); }
// Carga los modelos de Blender en segundo plano; al terminar se rehace el jugador con ellos.
function loadModels(onReady) {
  if (typeof Models3D === 'undefined') return;
  fetch(Models3D).then((r) => r.arrayBuffer()).then((buf) => {
    new GLTFLoader().parse(buf, '', (gltf) => { W.glb = gltf.scene; onReady && onReady(); }, (e) => console.warn('modelos 3D:', e));
  }).catch((e) => console.warn('modelos 3D:', e));
}
// Compila de una vez todos los shaders de la escena (todos los modelos del jugador visibles un momento).
// Sin esto, el primer cambio de modo compila los del modelo nuevo en ese instante y se nota un tirón.
function precompile() {
  const pl = W.player, shown = [];
  for (const m of Object.values(pl.models)) { shown.push([m, m.visible]); m.visible = true; }
  const gv = pl.group.visible; pl.group.visible = true;
  const tv = pl.trail.mesh.visible; pl.trail.mesh.visible = true;
  try {
    W.renderer.compile(W.scene, W.camera);
    // un render fuera de pantalla sube también las geometrías a la GPU
    W.warmRT = W.warmRT || new THREE.WebGLRenderTarget(64, 64);
    W.renderer.setRenderTarget(W.warmRT);
    W.renderer.render(W.scene, W.camera);
    W.renderer.setRenderTarget(null);
  } catch (e) { /* no crítico */ }
  for (const [m, v] of shown) m.visible = v;
  pl.group.visible = gv; pl.trail.mesh.visible = tv;
}
// Diamantes verdes en los puntos de control del modo práctica. list: [{x, y}] en unidades de la física.
function setCheckpoints(list) {
  if (W.cpGroup) { W.scene.remove(W.cpGroup); W.cpGroup = null; }
  if (!list || !list.length) return;
  const g = new THREE.Group();
  for (const c of list) {
    const d = new THREE.Group();
    d.position.set(c.x / BU, c.y / BU, 0);
    const gem = new THREE.Mesh(GEO.cap, neonOf('#5dff7a', 2.0));
    gem.scale.set(1.6, 2.4, 1.6);
    const halo = new THREE.Mesh(GEO.plane, glowOf('radial', '#5dff7a'));
    halo.scale.setScalar(1.3); halo.position.z = -0.2;
    d.add(halo, gem);
    g.add(d);
  }
  W.cpGroup = g;
  W.scene.add(g);
}
function setPlayerColors(c1, c2) {
  if (W.twin) { W.scene.remove(W.twin.group, W.twin.trail.mesh, W.twin.streak.mesh); W.twin = null; }
  W.scene.remove(W.player.group, W.player.trail.mesh, W.player.streak.mesh);
  W.player = makePlayer(c1, c2);
  W.scene.add(W.player.group);
  W.twin = makePlayer(c2, c1);
  W.twin.group.remove(W.twin.light);
  W.twin.group.visible = false;
  W.scene.add(W.twin.group);
  precompile();
}

// Materiales del jugador: acabado brillante (barniz suave) pero sin que la luz los queme ni lave los colores.
// Los puntos de luz (ojos) brillan por debajo del umbral del bloom para no convertirse en manchas.
function tame(root) {
  const done = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.userData.outline) return;
    const m = o.material;
    if (!m || !m.isMeshStandardMaterial || m.transparent || m.userData.neon) return;
    if (m.emissiveIntensity > 1) { m.emissiveIntensity = /motor/.test(m.name) ? 1.3 : 0.9; return; }
    if (!done.has(m)) {
      const n = new THREE.MeshPhysicalMaterial({
        name: m.name, color: m.color.clone().multiplyScalar(0.82), map: m.map,
        roughness: 0.38, metalness: 0.05, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.35,
        emissive: m.emissive, emissiveMap: m.emissiveMap, emissiveIntensity: Math.min(m.emissiveIntensity || 0, 0.08),
      });
      done.set(m, n);
    }
    o.material = done.get(m);
  });
}
// Contorno oscuro (casco invertido): una copia algo mayor de cada pieza principal que sólo pinta sus caras de
// atrás. Como los iconos de GD, hace que el jugador se lea bien sobre el neón y el bloom.
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x05040c, side: THREE.BackSide });
function outline(root) {
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.outline) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const main = m && m.isMeshStandardMaterial && !m.transparent && !(m.emissiveIntensity > 1) && !/luz|motor|vidrio|ojo|brillo|boca/.test(o.name + ' ' + (m.name || ''));
    if (main) parts.push(o);
  });
  for (const o of parts) {
    o.geometry.computeBoundingBox();
    const c = o.geometry.boundingBox.getCenter(new THREE.Vector3());
    const size = o.geometry.boundingBox.getSize(new THREE.Vector3());
    const k = 1 + 0.045 / Math.max(0.3, size.x, size.y, size.z); // ~0,02 de grosor en la dimensión mayor
    const hull = new THREE.Mesh(o.geometry, OUTLINE);
    hull.userData.outline = true;
    // escala alrededor del centro de la pieza
    hull.position.copy(c).multiplyScalar(1 - k);
    hull.scale.setScalar(k);
    o.add(hull);
  }
}

// Esqueleto sencillo para andar: cada pata (y cada brazo del robot) cuelga de un pivote en su cadera u
// hombro y oscila alrededor del eje z (el de la cámara). Las piezas se identifican por el nombre que
// tienen en Blender: robot_pata1 / robot_pie-1 / robot_brazo1…, arana_pata10_muslo (lado ±1, fila 0-2)…
function buildRig(node, mode) {
  const rig = { joints: [], body: node };
  const kids = [...node.children];
  node.updateMatrixWorld(true);
  const joint = (parts, pos, off, amp, air) => {
    if (!parts.length) return;
    const p = new THREE.Group();
    p.position.copy(pos);
    node.add(p);
    p.updateMatrixWorld(true);
    for (const m of parts) p.attach(m);
    rig.joints.push({ pivot: p, off, amp, air });
  };
  if (mode === 'robot') {
    // Pata de dos huesos para cinemática inversa: cadera → rodilla → tobillo (con el pie aparte, que se
    // mantiene plano). Se miden en la pose de reposo del modelo.
    rig.run = true;
    const box = new THREE.Box3();
    const centerOf = (o) => { box.setFromObject(o); return box.getCenter(new THREE.Vector3()); };
    for (const sd of [1, -1]) {
      const legs = kids.filter((o) => new RegExp(`_(pata|pie|muelle)${sd}$`).test(o.name));
      if (legs.length) {
        const feet = legs.filter((o) => new RegExp(`(^|_)pie${sd}$`).test(o.name));
        const knee = legs.find((o) => /rodilla/.test(o.name));
        const thighs = legs.filter((o) => new RegExp(`(^|_)pata${sd}$`).test(o.name) && !/canilla|rodilla|neon/.test(o.name));
        const K0 = knee ? centerOf(knee) : new THREE.Vector3(sd * 0.3, -0.27, 0);
        let H = new THREE.Vector3(sd * 0.1, -0.1, 0);
        if (thighs.length) {
          box.setFromObject(thighs[0]);
          // la cadera es el extremo del muslo más cercano al cuerpo; su altura, la del lado contrario a la rodilla
          const hx = Math.abs(box.min.x) < Math.abs(box.max.x) ? box.min.x : box.max.x;
          const hy = Math.abs(box.max.y - K0.y) < Math.abs(box.min.y - K0.y) ? box.min.y + 0.03 : box.max.y - 0.03;
          H = new THREE.Vector3(hx, hy, 0);
        }
        let F0 = new THREE.Vector3(K0.x, -0.42, 0);
        if (feet.length) { box.setFromObject(feet[0]); F0 = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, 0); }
        const upper = [], lower = [], foot = [];
        for (const o of legs) {
          if (feet.includes(o)) foot.push(o);
          else if (centerOf(o).y < K0.y - 0.02 && !/rodilla/.test(o.name)) lower.push(o);
          else upper.push(o);
        }
        const hip = new THREE.Group(); hip.position.copy(H); node.add(hip); hip.updateMatrixWorld(true);
        for (const o of upper) hip.attach(o);
        const kn = new THREE.Group(); kn.position.copy(K0).sub(H); hip.add(kn); kn.updateMatrixWorld(true);
        for (const o of lower) kn.attach(o);
        const ank = new THREE.Group(); ank.position.copy(F0).sub(K0); kn.add(ank); ank.updateMatrixWorld(true);
        for (const o of foot) ank.attach(o);
        const L1 = Math.max(0.05, H.distanceTo(K0)), L2 = Math.max(0.05, K0.distanceTo(F0));
        const a1r = Math.atan2(K0.y - H.y, K0.x - H.x), a2r = Math.atan2(F0.y - K0.y, F0.x - K0.x);
        // hacia qué lado se dobla la rodilla en reposo (para que la solución no la invierta)
        const bendSide = Math.sign((F0.x - H.x) * (K0.y - H.y) - (F0.y - H.y) * (K0.x - H.x)) || 1;
        rig.joints.push({ pivot: hip, knee: kn, ankle: ank, H, F0, L1, L2, a1r, a2r, bendSide, off: sd > 0 ? 0 : 0.5, leg: true, sd, tx: F0.x, ty: F0.y });
      }
      const arms = kids.filter((o) => new RegExp(`_(brazo|mano)${sd}$`).test(o.name));
      if (arms.length) {
        const sh = new THREE.Group(); sh.position.set(sd * 0.3, 0.02, 0); node.add(sh); sh.updateMatrixWorld(true);
        for (const o of arms) sh.attach(o);
        rig.joints.push({ pivot: sh, off: sd > 0 ? Math.PI : 0, arm: true, sd });
      }
    }
  } else {
    const groups = {};
    for (const o of kids) {
      const m = /_pata(-?1)(\d)_(muslo|rodilla|pierna)$/.exec(o.name);
      if (!m) continue;
      const key = m[1] + m[2];
      (groups[key] || (groups[key] = { s: Number(m[1]), k: Number(m[2]), parts: [] })).parts.push(o);
    }
    for (const g of Object.values(groups)) {
      const z = g.parts.reduce((a, o) => a + o.position.z, 0) / g.parts.length;
      // marcha en trípode: dos grupos de patas alternos, como una araña de verdad
      const off = ((g.s > 0 ? 0 : 1) + g.k) % 2 * Math.PI;
      joint(g.parts, new THREE.Vector3(g.s * 0.18, 0.08, z * 0.6), off, 0.32, 0.28 * g.s);
    }
  }
  return rig;
}
// Anima el esqueleto según lo recorrido (x en unidades 3D), así los pasos no patinan.
function animateRig(pl, mode, x, grounded, dt) {
  const rig = pl.rigs && pl.rigs[mode];
  if (!rig) return;
  const k = Math.min(1, Math.max(0, 1 - Math.exp(-dt * 16)));
  // zancada larga: a 10 bloques/s da unos 3,5 pasos por segundo (robot) y 4,5 (araña); más rápido se ve a tirones
  const ph = x * Math.PI * 2 / (mode === 'spider' ? 2.3 : 3.0);
  const ease = (o, prop, target) => { o.rotation[prop] += (target - o.rotation[prop]) * k; };
  if (rig.run) {
    // Paso de mecha: cada pie pasa el 55 % del ciclo apoyado (se desliza hacia atrás mientras el cuerpo avanza)
    // y el resto en el aire, levantándose en arco y volviendo adelante. La cadera y la rodilla salen de la
    // posición del pie (cinemática inversa de dos huesos) y el pie se mantiene plano.
    const CYCLE = 1.7, DUTY = 0.55, STRIDE = 0.36, LIFT = 0.17;
    const base = x / CYCLE;
    const smooth = (u) => u * u * (3 - 2 * u);
    for (const j of rig.joints) {
      if (j.arm) { ease(j.pivot, 'z', grounded ? Math.sin((base + (j.sd > 0 ? 0.5 : 0)) * Math.PI * 2) * 0.6 : 0.9 * j.sd); continue; }
      if (!j.leg) continue;
      let fx, fy;
      if (grounded) {
        const p = ((base + j.off) % 1 + 1) % 1;
        if (p < DUTY) { const u = p / DUTY; fx = j.F0.x + STRIDE * (0.5 - u); fy = j.F0.y; }
        else { const u = smooth((p - DUTY) / (1 - DUTY)); fx = j.F0.x + STRIDE * (u - 0.5); fy = j.F0.y + LIFT * Math.sin(Math.PI * u); }
      } else {
        // en el aire: patas recogidas
        fx = j.F0.x - j.sd * 0.06; fy = j.F0.y + 0.13;
      }
      j.tx += (fx - j.tx) * (grounded ? 1 : k); j.ty += (fy - j.ty) * (grounded ? 1 : k);
      // dos huesos: ley del coseno desde la cadera hasta el pie
      const dx = j.tx - j.H.x, dy = j.ty - j.H.y;
      const d = Math.min(j.L1 + j.L2 - 1e-3, Math.max(Math.abs(j.L1 - j.L2) + 1e-3, Math.hypot(dx, dy)));
      const phi = Math.atan2(dy, dx);
      const alpha = Math.acos(Math.min(1, Math.max(-1, (j.L1 * j.L1 + d * d - j.L2 * j.L2) / (2 * j.L1 * d))));
      const a1 = phi + j.bendSide * alpha;
      const kx = j.H.x + j.L1 * Math.cos(a1), ky = j.H.y + j.L1 * Math.sin(a1);
      const a2 = Math.atan2(j.ty - ky, j.tx - kx);
      j.pivot.rotation.z = a1 - j.a1r;
      j.knee.rotation.z = (a2 - j.a2r) - (a1 - j.a1r);
      j.ankle.rotation.z = -(a2 - j.a2r); // pie plano
    }
    // el cuerpo baja un poco en cada apoyo (dos por ciclo) y va algo inclinado hacia delante
    const bob = grounded ? (1 - Math.cos(base * Math.PI * 4)) * 0.5 * 0.035 : 0;
    rig.body.position.y += (bob - rig.body.position.y) * k;
    ease(rig.body, 'z', grounded ? -0.07 : -0.03);
    return;
  }
  for (const j of rig.joints) {
    const target = grounded ? Math.sin(ph + j.off) * j.amp : j.air;
    j.pivot.rotation.z += (target - j.pivot.rotation.z) * k;
  }
}

// Cinta a partir de puntos en unidades 3D [x0, y0, x1, y1…], más fina por la cola.
function ribbon(t, pts, w) {
  const n = Math.min(t.MAX, pts.length / 2);
  for (let i = 0; i < n; i++) {
    const x = pts[i * 2], y = pts[i * 2 + 1];
    const k = Math.min(i + 1, n - 1), h = Math.max(i - 1, 0);
    let dx = pts[k * 2] - pts[h * 2], dy = pts[k * 2 + 1] - pts[h * 2 + 1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const ww = w * (i / Math.max(1, n - 1));
    t.posArr.set([x - dy * ww, y + dx * ww, -0.05, x + dy * ww, y - dx * ww, -0.05], i * 6);
  }
  t.geo.attributes.position.needsUpdate = true;
  t.geo.setDrawRange(0, Math.max(0, n - 1) * 6);
  t.mesh.visible = n > 2;
}
// Estela de la onda: cinta que sigue los puntos recientes.
function makeTrail(hex) {
  const MAX = 900;
  const posArr = new Float32Array(MAX * 2 * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3).setUsage(THREE.DynamicDrawUsage));
  const idx = [];
  for (let i = 0; i < MAX - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(2.2), side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  mesh.frustumCulled = false;
  return { mesh, posArr, geo, MAX };
}
function updateTrail(pts, w) {
  const t = W.player.trail;
  const n = Math.min(t.MAX, pts.length / 2);
  const off = pts.length / 2 - n;
  for (let i = 0; i < n; i++) {
    const j = off + i;
    const x = pts[j * 2] / BU, y = pts[j * 2 + 1] / BU;
    const k = Math.min(j + 1, pts.length / 2 - 1), h = Math.max(j - 1, 0);
    let dx = pts[k * 2] - pts[h * 2], dy = pts[k * 2 + 1] - pts[h * 2 + 1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const ww = w * (0.35 + 0.65 * i / n);
    t.posArr.set([x - dy * ww, y + dx * ww, 0, x + dy * ww, y - dx * ww, 0], i * 6);
  }
  t.geo.attributes.position.needsUpdate = true;
  t.geo.setDrawRange(0, Math.max(0, n - 1) * 6);
  t.mesh.visible = n > 1;
}

// ------------------------------------------------------------------ partículas
const PMAX = 4000;
const P = { n: 0 };
function initParticles() {
  const geo = new THREE.BufferGeometry();
  P.pos = new Float32Array(PMAX * 3); P.col = new Float32Array(PMAX * 3); P.size = new Float32Array(PMAX); P.alpha = new Float32Array(PMAX);
  P.shape = new Float32Array(PMAX);
  P.vel = new Float32Array(PMAX * 3); P.life = new Float32Array(PMAX); P.max = new Float32Array(PMAX); P.drag = new Float32Array(PMAX); P.grav = new Float32Array(PMAX); P.s0 = new Float32Array(PMAX);
  geo.setAttribute('position', new THREE.BufferAttribute(P.pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(P.col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(P.size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('alpha', new THREE.BufferAttribute(P.alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('shape', new THREE.BufferAttribute(P.shape, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 } },
    vertexShader: `attribute float size; attribute float alpha; attribute float shape; attribute vec3 color; uniform float uScale; varying vec3 vC; varying float vA; varying float vS;
      void main(){ vC = color; vA = alpha; vS = shape; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying float vA; varying float vS;
      void main(){
        vec2 q = abs(gl_PointCoord - 0.5) * 2.0;
        float a = vS > 0.5 ? step(max(q.x, q.y), 0.8) * vA : pow(max(0.0, 1.0 - length(q)), 1.6) * vA;
        gl_FragColor = vec4(vC * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  W.particles = new THREE.Points(geo, mat);
  W.particles.frustumCulled = false;
  W.scene.add(W.particles);
}
// x, y, z en unidades 3D; vx, vy, vz en unidades/s.
function particle(x, y, z, vx, vy, vz, life, size, color, opts) {
  if (P.n >= PMAX) return;
  const i = P.n++;
  const c = color.isColor ? color : new THREE.Color(color);
  P.pos.set([x, y, z], i * 3); P.vel.set([vx, vy, vz], i * 3); P.col.set([c.r * 2, c.g * 2, c.b * 2], i * 3);
  P.life[i] = P.max[i] = life; P.size[i] = P.s0[i] = size; P.alpha[i] = 1;
  P.drag[i] = opts && opts.drag != null ? opts.drag : 2; P.grav[i] = opts && opts.grav || 0; P.shape[i] = opts && opts.square ? 1 : 0;
}
function updateParticles(dt) {
  let j = 0;
  for (let i = 0; i < P.n; i++) {
    const life = P.life[i] - dt;
    if (life <= 0) continue;
    const k = Math.exp(-P.drag[i] * dt);
    const vx = P.vel[i * 3] * k, vy = P.vel[i * 3 + 1] * k + P.grav[i] * dt, vz = P.vel[i * 3 + 2] * k;
    P.pos[j * 3] = P.pos[i * 3] + vx * dt; P.pos[j * 3 + 1] = P.pos[i * 3 + 1] + vy * dt; P.pos[j * 3 + 2] = P.pos[i * 3 + 2] + vz * dt;
    P.vel[j * 3] = vx; P.vel[j * 3 + 1] = vy; P.vel[j * 3 + 2] = vz;
    P.col[j * 3] = P.col[i * 3]; P.col[j * 3 + 1] = P.col[i * 3 + 1]; P.col[j * 3 + 2] = P.col[i * 3 + 2];
    P.life[j] = life; P.max[j] = P.max[i]; P.drag[j] = P.drag[i]; P.grav[j] = P.grav[i]; P.s0[j] = P.s0[i]; P.shape[j] = P.shape[i];
    const f = life / P.max[j];
    P.alpha[j] = Math.min(1, f * 1.6); P.size[j] = P.s0[j] * (0.4 + 0.6 * f);
    j++;
  }
  P.n = j;
  const g = W.particles.geometry;
  for (const a of ['position', 'color', 'size', 'alpha', 'shape']) g.attributes[a].needsUpdate = true;
  g.setDrawRange(0, P.n);
}

// Trozos del jugador al morir: cubitos con gravedad que rebotan en el suelo.
const SH = { max: 90, list: [] };
function initShards() {
  SH.mesh = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 1, 0.12), new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.35 }), SH.max);
  SH.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  SH.mesh.count = 0;
  SH.mesh.frustumCulled = false;
  W.scene.add(SH.mesh);
}
function shatter(x, y, c1, c2) {
  SH.list = [];
  for (let i = 0; i < SH.max; i++) {
    const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 7;
    SH.list.push({
      p: new THREE.Vector3(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6),
      v: new THREE.Vector3(Math.cos(a) * v, Math.sin(a) * v + 3, (Math.random() - 0.3) * 6),
      r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, 0),
      s: 0.06 + Math.random() * 0.14, life: 1.4 + Math.random() * 0.8,
      c: new THREE.Color(i % 3 ? c1 : c2),
    });
  }
  SH.list.forEach((s, i) => SH.mesh.setColorAt(i, s.c));
  if (SH.mesh.instanceColor) SH.mesh.instanceColor.needsUpdate = true;
}
function updateShards(dt) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  let n = 0;
  for (const s of SH.list) {
    s.life -= dt;
    if (s.life <= 0) continue;
    s.v.y -= 22 * dt;
    s.p.addScaledVector(s.v, dt);
    if (s.p.y < W.floorY + s.s / 2) { s.p.y = W.floorY + s.s / 2; s.v.y *= -0.45; s.v.x *= 0.7; s.v.z *= 0.7; }
    s.r.x += s.w.x * dt; s.r.y += s.w.y * dt;
    const k = Math.min(1, s.life / 0.4) * s.s;
    SH.mesh.setMatrixAt(n++, m4.compose(s.p, q.setFromEuler(s.r), new THREE.Vector3(k, k, k)));
  }
  SH.mesh.count = n;
  SH.mesh.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------ efectos (coordenadas de la física)
const FX = {
  shake: 0, flash: 0, flashColor: new THREE.Color(1, 1, 1), aberr: 0, fovKick: 0,
  jump(x, y, flip) {
    for (let i = 0; i < 10; i++) particle(x / BU + (Math.random() - 0.5) * 0.7, y / BU, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 3, -flip * Math.random() * 1.5, (Math.random() - 0.5) * 2, 0.4, 0.12 + Math.random() * 0.1, '#ffffff', { drag: 4 });
  },
  burst(x, y, hex, n, speed, life, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI, v = speed * (0.4 + Math.random() * 0.6);
      particle(x / BU, y / BU, 0, Math.cos(a) * Math.cos(b) * v, Math.sin(a) * Math.cos(b) * v, Math.sin(b) * v, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), i % 3 ? hex : '#ffffff', { drag: 3 });
    }
  },
  ring(x, y, hex, n, speed, life) {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      particle(x / BU, y / BU, 0, Math.cos(a) * speed, Math.sin(a) * speed, 0, life, 0.16, hex, { drag: 4 });
    }
  },
  column(x, y, hex, up) {
    for (let i = 0; i < 26; i++) particle(x / BU + (Math.random() - 0.5) * 0.7, y / BU, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, up * (5 + Math.random() * 9), 0, 0.5 + Math.random() * 0.3, 0.14 + Math.random() * 0.1, i % 3 ? hex : '#ffffff', { drag: 3 });
  },
  portal(o, hex) {
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = o.y + 0.5 + Math.sin(a) * 1.55, z = Math.cos(a) * 0.8;
      particle(o.x + 0.5, y, z, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 2, z * 2, 0.6 + Math.random() * 0.3, 0.12 + Math.random() * 0.1, i % 3 ? hex : '#ffffff', { drag: 3 });
    }
    this.flash = Math.max(this.flash, 0.12); this.flashColor.set(hex);
  },
  teleport(x, fromY, toY, hex) {
    const a = Math.min(fromY, toY), b = Math.max(fromY, toY);
    for (let i = 0; i < 40; i++) {
      const y = a + (b - a) * (i / 39);
      particle(x / BU + (Math.random() - 0.5) * 0.25, y / BU, (Math.random() - 0.5) * 0.3, -1 - Math.random() * 2, (Math.random() - 0.5) * 0.6, 0, 0.35 + Math.random() * 0.2, 0.16, i % 3 ? hex : '#ffffff', { drag: 4 });
    }
    this.flash = Math.max(this.flash, 0.08); this.flashColor.set(hex);
  },
  death(x, y, c1, c2) {
    const kind = W.cos.death;
    if (kind === 'explosion') {
      this.burst(x, y, c1, 120, 13, 1.0, 0.3); this.burst(x, y, '#ffd23a', 60, 7, 0.7, 0.25); this.ring(x, y, '#ffffff', 40, 8, 0.5);
      this.shake = 0.9; this.flash = 0.6;
    } else if (kind === 'pixeles') {
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        const ox = (i - 3.5) / 8, oy = (j - 3.5) / 8;
        particle(x / BU + ox, y / BU + oy, 0, ox * 3 + (Math.random() - 0.5), oy * 3 + Math.random(), (Math.random() - 0.5) * 2, 0.8 + Math.random() * 0.5, 0.13, (i + j) % 3 ? c1 : c2, { drag: 1.5, grav: -4, square: true });
      }
      this.shake = 0.4; this.flash = 0.25;
    } else if (kind === 'anillo') {
      for (let k = 0; k < 3; k++) setTimeout(() => this.ring(x, y, k % 2 ? c2 : c1, 48, 4 + k * 3, 0.6), k * 120);
      this.burst(x, y, c1, 30, 4, 0.6, 0.18); this.shake = 0.3; this.flash = 0.3;
    } else if (kind === 'chispas') {
      for (let i = 0; i < 90; i++) particle(x / BU, y / BU, 0, (Math.random() - 0.5) * 6, 4 + Math.random() * 7, (Math.random() - 0.5) * 3, 0.9 + Math.random() * 0.5, 0.1, i % 3 ? c1 : '#ffffff', { drag: 1, grav: -14 });
      this.shake = 0.4; this.flash = 0.3;
    } else {
      shatter(x / BU, y / BU, c1, c2);
      this.burst(x, y, c1, 90, 9, 0.9, 0.22);
      this.shake = 0.6; this.flash = 0.5;
    }
    this.flashColor.set('#ffffff'); this.aberr = 0.012;
  },
  win(x, y) {
    for (let k = 0; k < 6; k++) {
      const cx = x + (Math.random() * 8 - 1) * BU, cy = y + (2 + Math.random() * 5) * BU;
      const hex = ['#ffd23a', '#5dff7a', '#27e3ff', '#ff4fa3'][k % 4];
      setTimeout(() => this.burst(cx, cy, hex, 70, 7, 1.3, 0.2), k * 220);
    }
    this.flash = 0.35; this.flashColor.set('#ffffff');
  },
};

// ------------------------------------------------------------------ fotograma
const tmpV = new THREE.Vector3();
const RED_GLOW = new THREE.Color('#ff4a1c');
const LIGHTNING = new THREE.Color('#c8d6ff');
const GROUND_MODES = new Set(['cube', 'ball', 'robot', 'spider']);
// dónde nace la estela pixelada de cada volador (respecto al centro del jugador)
const PIXEL_TRAIL = { ship: [-0.6, 0], wave: [-0.35, 0], ufo: [0, -0.3], swing: [0, -0.35] };
const FLIP_MODES = new Set(['ship', 'ufo', 'wave', 'swing', 'robot', 'spider']);
// [distancia relativa, altura, desplazamiento lateral] de la cámara para cada modo
const CAM_MODE = { cube: [1, 1.3, -2.2], ball: [1.04, 1.0, -2.6], ship: [1.12, 0.6, -3.3], ufo: [1.1, 0.8, -3.0], wave: [1.15, 0.45, -3.5],
  robot: [1, 1.3, -2.2], spider: [1.04, 1.0, -2.5], swing: [1.12, 0.6, -3.3] };
/*
 * view: { x, y, rot, mode, mini, flip, dead, visible, camX, camY, beat, colorsX, used, t, menu, trail, speed, lo, hi }
 * x, y, camX, camY en unidades de la física; camY es el centro vertical de la vista.
 */
function frame(view, dt) {
  dt = Math.max(0, Math.min(0.1, dt || 0));
  W.time += dt;
  const t = W.time;
  const L = W.level;
  const cols = L ? colorsAt(L.def, view.colorsX) : { bg: new THREE.Color('#2a53d6'), ground: new THREE.Color('#1c3aa8'), line: WHITE.clone(), obj: WHITE.clone() };
  const beat = view.beat || 0;
  // triggers del nivel: destello de color (pulse) y sacudida (shake)
  const trig = view.trig;
  const pulse = trig ? trig.pulse : 0;
  if (pulse > 0 && !W.reduceFlash) { const pc = new THREE.Color(trig.pulseColor); cols.bg.lerp(pc, pulse * 0.45); cols.line.lerp(pc, pulse * 0.5); cols.obj.lerp(pc, pulse * 0.3); }
  if (trig && trig.shake > 0) FX.shake = Math.max(FX.shake, trig.shake * 0.04);

  // cielo, niebla, suelo y ciudad
  const bg = cols.bg;
  W.sky.material.uniforms.uTop.value.copy(bg).multiplyScalar(0.06);
  W.sky.material.uniforms.uMid.value.copy(bg).multiplyScalar(0.36);
  W.sky.material.uniforms.uGlow.value.copy(cols.line).lerp(bg, 0.4).multiplyScalar(0.5);
  W.sky.material.uniforms.uBeat.value = beat;
  const fogC = bg.clone().multiplyScalar(0.26), fogD = 0.017;
  for (const f of [W.floor, W.ceil]) {
    const u = f.material.uniforms;
    u.uGround.value.copy(cols.ground); u.uLine.value.copy(cols.line).multiplyScalar(0.8); u.uFog.value.copy(fogC); u.uFogD.value = fogD; u.uBeat.value = beat;
  }
  const cu = W.cityMat.uniforms;
  cu.uBody.value.copy(bg).multiplyScalar(0.04); cu.uWin.value.copy(cols.line).lerp(cols.obj, 0.5).multiplyScalar(0.45); cu.uFog.value.copy(fogC); cu.uFogD.value = fogD; cu.uBeat.value = beat;
  W.floorLine.material.color.copy(cols.line).multiplyScalar(1.8 + beat * 0.8);
  // paisaje del fondo
  for (const sc of W.scenery) {
    const u = sc.mat.uniforms;
    u.uBody.value.copy(bg).multiplyScalar(sc.body);
    u.uGlow.value.copy(sc.glow === 'obj' ? cols.obj : sc.glow === 'red' ? RED_GLOW : cols.line).multiplyScalar(sc.glowK * (1 + pulse * 0.6));
    u.uFog.value.copy(fogC); u.uFogD.value = fogD; u.uBeat.value = beat;
  }
  // objetos y decorados movidos, girados, apagados o desvanecidos por los triggers de grupo (Sim.groupState,
  // función pura de la x del jugador: la misma que usa la física). view.gsX la fuerza (p. ej. el editor).
  const gsX = view.gsX != null ? view.gsX : trig ? view.x : null;
  W.gs = L && gsX != null ? Sim.groupState(L, gsX) : null;
  applyGroups(W.gs);
  ambientParticles(view);
  if (W.storm) updateStorm(view, dt);
  if (W.timeMats) for (const m of W.timeMats) m.uniforms.uTime.value = t;
  // relámpago: el cielo se aclara un instante
  if (W.lightning > 0) {
    W.sky.material.uniforms.uMid.value.lerp(LIGHTNING, W.lightning * 0.5);
    W.sky.material.uniforms.uTop.value.lerp(LIGHTNING, W.lightning * 0.25);
    W.lightning = Math.max(0, W.lightning - dt * 4);
  }
  W.hemi.color.copy(bg).lerp(WHITE, 0.5);

  // suelo y techo (el techo aparece en los pasillos de los modos voladores)
  const lo = (view.lo || 0) / BU;
  W.floorY += (lo - W.floorY) * Math.min(1, dt * 8);
  W.floor.position.y = W.floorY; W.floorLine.position.y = W.floorY;
  const hasCeil = view.hi != null && view.hi !== Infinity;
  if (hasCeil) W.ceilY = W.ceilY === Infinity ? view.hi / BU + 6 : W.ceilY + (view.hi / BU - W.ceilY) * Math.min(1, dt * 8);
  W.ceilVis += ((hasCeil ? 1 : 0) - W.ceilVis) * Math.min(1, dt * 6);
  if (!hasCeil && W.ceilVis < 0.02) W.ceilY = Infinity;
  const showCeil = W.ceilY !== Infinity && W.ceilVis > 0.01;
  W.ceil.visible = W.ceilLine.visible = showCeil;
  if (showCeil) {
    W.ceil.position.y = W.ceilY + (1 - W.ceilVis) * 4; W.ceilLine.position.y = W.ceil.position.y;
    W.ceil.material.uniforms.uVis.value = W.ceilVis;
  }

  // objetos animados
  const used = view.used || {};
  for (const a of W.anim) {
    switch (a.kind) {
      case 'saw': a.obj.rotation.z = -t * 7; break;
      case 'orb': {
        const ph = (t * 1.2) % 1;
        a.pulse.scale.setScalar(1 + ph * 0.6);
        a.pulse.material.opacity = 0.9 * (1 - ph);
        a.ring.rotation.y = t * 2.2; a.ring.rotation.x = Math.sin(t * 1.3) * 0.4;
        const k = used[a.o.id] ? 0.45 : 1 + beat * 0.08;
        a.obj.scale.setScalar(k);
        break;
      }
      case 'coin': {
        const taken = used[a.o.id];
        if (taken) a.taken = Math.min(1, a.taken + dt * 2.5); else a.taken = 0;
        a.spin.rotation.y = t * 2.4 + a.o.id + a.taken * 12;
        a.obj.position.y = a.o.y + 0.5 + Math.sin(t * 3 + a.o.id) * 0.06 + a.taken * 1.4;
        a.obj.visible = a.taken < 1;
        a.obj.scale.setScalar(1 - a.taken * 0.6);
        const ghost = view.savedCoins && view.savedCoins.includes(a.o.id);
        a.spin.children.forEach((m) => { m.material = ghost ? MAT.ghost : m.userData.mat; });
        break;
      }
      case 'portal':
        a.inner.rotation.x = t * 1.5;
        a.glow.material.uniforms.uAlpha.value = 0.55 + 0.25 * Math.sin(t * 4) + beat * 0.3;
        a.caps.forEach((c, i) => { c.rotation.y = t * 3 * (i ? -1 : 1); });
        break;
      case 'speed':
        a.chevs.forEach((c, i) => { c.position.y = Math.sin(t * 6 - i * 0.8) * 0.06; });
        break;
      case 'pad':
        a.beam.material.uniforms.uAlpha.value = 0.65 + 0.35 * Math.sin(t * 10 + a.o.id);
        break;
      case 'spin': a.obj.rotation.y += dt * a.k; a.obj.rotation.x += dt * a.k * 0.4; break;
      case 'sway': a.obj.rotation.z = Math.sin(t * a.k + a.ph) * 0.18; break;
      case 'roll': a.obj.rotation.z += dt * a.k; a.obj.rotation.y = Math.sin(t * 0.2 + a.k * 10) * 0.4; break;
      case 'float':
        a.obj.rotation.x += dt * a.k; a.obj.rotation.y += dt * a.k * 0.7;
        a.obj.position.y = a.y0 + Math.sin(t * 0.6 + a.ph) * 0.6;
        break;
    }
  }

  // jugador
  const pl = W.player;
  let px = view.x / BU, py = view.y / BU;
  // salida: al ganar, el jugador sigue hacia la puerta de meta, sube un poco, gira y se desvanece en la luz
  let outro = 0;
  if (view.wonT != null) {
    const tw = view.wonT;
    px += tw * 9;
    py += Math.min(1, tw / 0.7) * 1.6;
    outro = Math.min(1, Math.max(0, (tw - 0.45) / 0.55));
    if (W.gate) W.gate.glow.material.uniforms.uAlpha.value = 1 + Math.min(1, tw) * 0.7;
  } else if (W.gate) W.gate.glow.material.uniforms.uAlpha.value = 1;
  pl.group.visible = !!view.visible && !view.dead;
  for (const [k, m] of Object.entries(pl.models)) m.visible = k === view.mode;
  if (pl.group.visible) {
    pl.group.position.set(px, py, 0);
    // la bola rueda según la distancia recorrida (sin patinar); el resto usa el giro de la física
    if (view.mode === 'ball') {
      const dxb = W.lastX == null ? 0 : px - W.lastX;
      if (Math.abs(dxb) < 2) W.ballAng -= dxb / (0.47 * (view.mini ? 0.6 : 1)) * (view.flip || 1);
      pl.group.rotation.set(0, 0, W.ballAng);
    } else pl.group.rotation.set(0, 0, -(view.rot || 0) * DEG - (view.wonT || 0) * 9);
    W.lastX = px;
    const sc = (view.mini ? 0.6 : 1) * (1 - outro);
    const fl = FLIP_MODES.has(view.mode) ? (view.flip || 1) : 1;
    // aplastamiento al aterrizar (cubo, bola, robot, araña)
    if (view.grounded && !W.wasGrounded && GROUND_MODES.has(view.mode)) W.squash = 1;
    W.squash *= Math.exp(-dt * 12);
    const sq = W.squash;
    pl.group.scale.set(sc * (1 + 0.14 * sq), sc * fl * (1 - 0.2 * sq), sc * (1 + 0.14 * sq));
    pl.group.position.y -= 0.1 * sq * sc * (view.flip || 1);
    if (view.mode === 'ship') { pl.engine.visible = !view.garage; pl.engine.scale.set(0.6 + Math.random() * 0.35, 0.4 + Math.random() * 0.15, 1); }
    if (view.mode === 'ufo') pl.lights.forEach((l, i) => { l.visible = Math.floor(t * 8 + i) % 2 === 0; });
    if (view.mode === 'swing') pl.rotors.forEach((r, i) => { r.rotation.y += dt * 28 * (i % 2 ? -1 : 1); });
    // propulsión del robot mientras se mantiene el salto
    if (view.mode === 'robot' && view.boost > 0 && !view.grounded) {
      for (let i = 0; i < 2; i++) particle(px + (Math.random() - 0.5) * 0.35 * sc, py - 0.5 * sc * (view.flip || 1), (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.6, -(view.flip || 1) * (2 + Math.random() * 2), 0, 0.3, 0.13, i ? '#ffb13b' : '#ffffff', { drag: 3 });
    }
    if (view.mode === 'robot' || view.mode === 'spider') animateRig(pl, view.mode, view.garage ? t * 3 : px, view.garage || !!view.grounded, dt);
    if (PIXEL_TRAIL[view.mode] && !view.garage && Math.random() < 0.55) {
      const [ox, oy] = PIXEL_TRAIL[view.mode];
      particle(px + ox * sc + (Math.random() - 0.5) * 0.15, py + oy * sc * fl + (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.3, -1.5 - Math.random() * 1.5, (Math.random() - 0.5) * 0.4 + oy * 0.8 * fl, 0, 0.45 + Math.random() * 0.25, 0.1 + Math.random() * 0.07, Math.random() < 0.7 ? pl.c2 : pl.c1, { drag: 1.5, square: true });
    }
    if (view.mode === 'ship') {
      const fc = flameColor(t);
      pl.flame.uniforms.uColor.value.copy(fc);
      if (Math.random() < 0.7) particle(px - 0.55 * sc, py - 0.02 * fl, 0.2, -2 - Math.random() * 2, (Math.random() - 0.5), 0, 0.35, 0.12, fc, { drag: 2, square: W.cos.flame === 'pixeles' });
    }
    pl.light.intensity = 1.6 + beat * 1.2;
  }
  if (view.garage && pl.group.visible) {
    pl.group.rotation.set(0.18, t * 0.7, 0);
    pl.group.scale.setScalar(1);
    pl.group.position.y = py + Math.sin(t * 1.6) * 0.06;
  }
  // gemelo del modo dual (s.twin en la física)
  if (W.twin) {
    const tw = view.twin, tp = W.twin;
    tp.group.visible = !!(tw && view.visible && !view.dead && !tw.dead);
    tp.streak.mesh.visible = false;
    if (tp.group.visible) {
      for (const [k, m] of Object.entries(tp.models)) m.visible = k === tw.mode;
      tp.group.position.set(tw.x / BU, tw.y / BU, 0);
      tp.group.rotation.set(0, 0, -(tw.rot || 0) * DEG);
      const ts = tw.mini ? 0.6 : 1;
      const tf = (tw.mode === 'ship' || tw.mode === 'ufo' || tw.mode === 'wave' || tw.mode === 'swing' || tw.mode === 'spider' || tw.mode === 'robot') ? (tw.flip || 1) : 1;
      tp.group.scale.set(ts, ts * tf, ts);
      if (tw.mode === 'swing') tp.rotors.forEach((r, i) => { r.rotation.y += dt * 28 * (i % 2 ? -1 : 1); });
      if (tw.mode === 'robot' || tw.mode === 'spider') animateRig(tp, tw.mode, tw.x / BU, !!tw.grounded, dt);
    }
  }
  W.wasGrounded = !!view.grounded;
  // estela (streak): los últimos ~0,2 s de recorrido, salvo en la onda (que ya deja la suya)
  const sp = W.streakPts;
  if (!pl.group.visible || view.mode === 'wave' || (sp.length && px < sp[sp.length - 2] - 1)) sp.length = 0;
  if (pl.group.visible && view.mode !== 'wave') { sp.push(px, py); if (sp.length > 26) sp.splice(0, 2); }
  if (view.garage) sp.length = 0;
  const trailKind = W.cos.trail;
  if (sp.length > 4 && (trailKind === 'clasica' || trailKind === 'arcoiris')) {
    ribbon(pl.streak, sp, (view.mini ? 0.12 : 0.2) * (1 - outro));
    if (trailKind === 'arcoiris') pl.streak.mesh.material.color.setHSL((t * 0.6) % 1, 1, 0.55).multiplyScalar(2.2);
    else pl.streak.mesh.material.color.set(pl.c2).multiplyScalar(2.2);
  } else pl.streak.mesh.visible = false;
  if (pl.group.visible && !view.garage && view.mode !== 'wave' && !view.dead) {
    if (trailKind === 'pixeles' && Math.random() < 0.6) particle(px - 0.3 * sc, py + (Math.random() - 0.5) * 0.3, 0, -1.2, (Math.random() - 0.5) * 0.5, 0, 0.5, 0.11, Math.random() < 0.7 ? pl.c2 : pl.c1, { drag: 1.5, square: true });
    else if (trailKind === 'chispas' && Math.random() < 0.7) particle(px - 0.2 * sc, py + (Math.random() - 0.5) * 0.4, 0, -2 - Math.random(), (Math.random() - 0.5) * 2, (Math.random() - 0.5), 0.35, 0.09, Math.random() < 0.5 ? '#ffffff' : pl.c1, { drag: 3 });
    else if (trailKind === 'fuego' && Math.random() < 0.8) particle(px - 0.25 * sc, py - 0.2 * sc + Math.random() * 0.3, 0, -1.5, 1 + Math.random() * 1.5, 0, 0.45, 0.16, Math.random() < 0.5 ? '#ff6b1c' : '#ffd23a', { drag: 2 });
  }
  pl.halo.visible = !!W.cos.glow && pl.group.visible;
  if (pl.halo.visible) { pl.halo.material.uniforms.uColor.value.set(W.cos.glow); pl.halo.material.uniforms.uAlpha.value = 0.75 + beat * 0.3; }
  if (W.cpGroup) W.cpGroup.children.forEach((d, i) => { d.children[1].rotation.y = t * 2 + i; d.position.z = Math.sin(t * 2 + i) * 0.05; });
  W.shadow.visible = pl.group.visible;
  if (pl.group.visible) {
    const hgt = Math.max(0, py - W.floorY);
    W.shadow.position.set(px, W.floorY + 0.01, 0);
    const s = Math.max(0.2, 1.2 - hgt * 0.15);
    W.shadow.scale.set(s, 1, s * 0.8);
    W.shadow.material.opacity = Math.max(0, 0.5 - hgt * 0.06);
  }
  if (view.trail && view.mode === 'wave' && !view.dead) updateTrail(view.trail, view.mini ? 0.07 : 0.11);
  else pl.trail.mesh.visible = false;

  // cámara: un poco desde la izquierda y desde arriba, para que el mundo se vea en 3D
  const cam = W.camera;
  const aspect = cam.aspect;
  const vfov = cam.fov * DEG;
  const needH = view.menu ? 10 : 8.4, needW = 14;
  let dist = Math.max(needH / (2 * Math.tan(vfov / 2)), needW / (2 * Math.tan(vfov / 2) * aspect));
  dist = Math.min(dist, 30);
  FX.fovKick *= Math.exp(-dt * 3);
  const cx = view.camX / BU, cy = view.camY / BU;
  // perfil de cámara por modo: los voladores se ven desde más lejos y más de lado; transición suave
  const prof = CAM_MODE[view.visible ? view.mode : 'cube'] || CAM_MODE.cube;
  const kc = 1 - Math.exp(-dt * 2.2);
  const C = W.cam;
  C.d += (prof[0] * (view.mini ? 0.92 : 1) - C.d) * kc;
  C.e += (prof[1] - C.e) * kc;
  C.s += (prof[2] - C.s) * kc;
  if (view.visible && view.mode !== C.mode) {
    if (C.mode && !view.dead) { C.rollT = (C.flipRoll = -C.flipRoll) * 0.05; FX.fovKick = Math.max(FX.fovKick, 0.45); }
    C.mode = view.mode;
  }
  C.rollT *= Math.exp(-dt * 2.2);
  C.roll += (C.rollT - C.roll) * (1 - Math.exp(-dt * 6));
  C.kick += (FX.fovKick - C.kick) * (1 - Math.exp(-dt * 6));
  FX.shake *= Math.exp(-dt * 6);
  const sh = FX.shake;
  const sway = view.menu ? Math.sin(t * 0.25) * 1.5 : 0;
  // entrada: al empezar un nivel la cámara llega desde lejos y desde arriba (1,5 s)
  let ik = view.intro != null ? Math.max(0, 1 - view.intro / 1.5) : 0;
  ik = ik * ik * (3 - 2 * ik);
  cam.position.set(cx + C.s + sway - ik * 6 + (Math.random() - 0.5) * sh, cy + C.e + ik * 5 + (Math.random() - 0.5) * sh, dist * C.d - C.kick * 1.5 + ik * 14);
  cam.lookAt(tmpV.set(cx + 0.4, cy - 0.1, 0));
  cam.rotateZ(C.roll);
  if (W.gs) applyCamTrig(cam, W.gs.cam, cx + 0.4, cy - 0.1, C.roll);
  if (view.garage) {
    // Garaje: el modelo entero (≈1,7 bloques con cuernos o rotor) cabe en el hueco libre que deja el panel
    // (garageFree = rectángulo en fracciones de la pantalla) y queda centrado en él.
    const fr = view.garageFree || { x0: 0, x1: 1, y0: 0, y1: 0.5 };
    const fw = Math.max(0.2, fr.x1 - fr.x0), fh = Math.max(0.2, fr.y1 - fr.y0);
    const tanH = Math.tan(vfov / 2), S = 1.7;
    const d = Math.max(S / (0.78 * fh * 2 * tanH), S / (0.78 * fw * 2 * tanH * aspect));
    const cxN = fr.x0 + fr.x1 - 1, cyN = 1 - (fr.y0 + fr.y1); // centro del hueco en coordenadas de pantalla (-1..1)
    const tx = px - cxN * d * tanH * aspect, ty = py - cyN * d * tanH;
    cam.position.set(tx - 0.25 * d / 3, ty + 0.18 * d / 3, d);
    cam.lookAt(tx, ty, 0);
  }
  W.sun.target.position.set(cx, cy, 0); W.sun.position.set(cx - 6, cy + 12, 10);
  W.sky.position.copy(cam.position);
  for (const f of W.skyFollow) {
    f.obj.position.set(cam.position.x * f.k + f.dx, f.y + cam.position.y * 0.2, f.z);
    if (f.beat) f.beat.uniforms.uBeat.value = beat;
  }

  // posproceso
  FX.flash *= Math.exp(-dt * 5);
  FX.aberr *= Math.exp(-dt * 4);
  if (W.reduceFlash) { FX.shake = Math.min(FX.shake, 0.08); FX.aberr = 0; }
  W.post.uniforms.uFlash.value = Math.min(0.85, FX.flash) * (W.reduceFlash ? 0.12 : 1);
  W.post.uniforms.uFlashColor.value.copy(FX.flashColor);
  W.post.uniforms.uAberr.value = 0.0012 + FX.aberr;
  W.bloom.strength = 0.85 + beat * 0.2 + pulse * 0.5;

  drawHitboxes(view.boxes);
  updateParticles(dt);
  updateShards(dt);
  if (window.innerWidth && window.innerHeight) renderFrame(dt);
}

// Color de la llama de la nave según el cosmético elegido.
const FLAME_COLORS = { naranja: '#ffb13b', azul: '#3bc6ff', verde: '#5dff7a', rosa: '#ff4fd8', pixeles: '#ffd23a' };
const tmpFlame = new THREE.Color();
function flameColor(t) {
  if (W.cos.flame === 'arcoiris') return tmpFlame.setHSL((t * 0.8) % 1, 1, 0.6);
  return tmpFlame.set(FLAME_COLORS[W.cos.flame] || FLAME_COLORS.naranja);
}
// Hitboxes (opción de Ajustes o tecla H): rectángulos de la física dibujados delante del plano de juego.
// boxes: [x0, y0, x1, y1, tipo] en unidades de la física; tipo 0 jugador, 1 interior, 2 peligro, 3 sólido, 4 activador.
const HB_COLORS = [[0.3, 1, 0.4], [0.2, 0.6, 1], [1, 0.25, 0.3], [0.4, 0.7, 1], [1, 0.85, 0.2]];
function drawHitboxes(boxes) {
  if (!boxes || !boxes.length) { if (W.hitLines) W.hitLines.visible = false; return; }
  if (!W.hitLines) {
    const MAX = 600;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 8 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 8 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    W.hitLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
    W.hitLines.renderOrder = 10; W.hitLines.frustumCulled = false; W.hitLines.userData.max = MAX;
    W.scene.add(W.hitLines);
  }
  const pos = W.hitLines.geometry.attributes.position.array, col = W.hitLines.geometry.attributes.color.array;
  const n = Math.min(boxes.length, W.hitLines.userData.max);
  for (let i = 0; i < n; i++) {
    const [a, b, c, d, k] = boxes[i];
    const x0 = a / BU, y0 = b / BU, x1 = c / BU, y1 = d / BU, z = 0.62;
    pos.set([x0, y0, z, x1, y0, z, x1, y0, z, x1, y1, z, x1, y1, z, x0, y1, z, x0, y1, z, x0, y0, z], i * 24);
    const cc = HB_COLORS[k] || HB_COLORS[3];
    for (let v = 0; v < 8; v++) col.set(cc, i * 24 + v * 3);
  }
  W.hitLines.geometry.attributes.position.needsUpdate = true;
  W.hitLines.geometry.attributes.color.needsUpdate = true;
  W.hitLines.geometry.setDrawRange(0, n * 8);
  W.hitLines.visible = true;
}
function setCosmetics(c) { Object.assign(W.cos, c); }
function setReduceFlash(on) { W.reduceFlash = !!on; }

const World = { W, THEME_NAMES, THEME_BY_LEVEL, setCosmetics, setReduceFlash, setResolution, THEMES, setCheckpoints, setDesigns, hasModel, loadModels, initScene, buildLevel, frame, resize, setQuality, setPlayerColors, colorsAt, FX, particle, BU, MODE_COLOR, SPEED_COLOR, PAD_COLOR };
