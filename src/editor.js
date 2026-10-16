/*
 * NEON DASH 3D — editor de niveles.
 * Vista lateral en 3D con el mismo dibujo (world.js) y la misma física (sim.js) que el juego.
 * Los niveles se guardan en este navegador y se comparten con un código de texto (ND1., compatible con Neon Dash).
 * Usa window.ND3D (ver el final de src/game.js).
 */
import * as THREE from 'three';
// la física y el bot, como texto, para el Web Worker del botón Verificar
import SIM_SRC from './sim.js?raw';
import SOLVER_SRC from './solver.js?raw';

const STORE = 'neondash3d.levels.v1';
const DEG = Math.PI / 180;
const MODES = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider', 'swing'];
// Textos de la interfaz (src/i18n.js): T('clave', { variables }). Todo lo visible se traduce al dibujarlo, así un
// cambio de idioma (evento 'langchange') sólo tiene que volver a dibujar.
const T = (key, vars) => window.I18N.t(key, vars);
const modeName = (m) => T('mode.' + m);
const SPEEDS = [0.5, 1, 2, 3, 4];
// canciones sintetizadas: nombre en song.<id>
const SONGS = ['pulso', 'orbita', 'fase', 'ladera', 'espejo', 'abismo', 'sangre'];
const SONG_BPM = { pulso: 155.79, orbita: 150, fase: 170, ladera: 140, espejo: 160, abismo: 175, sangre: 186 };
// canciones reales (MP3, tracks.js): van primero en la lista
if (window.Tracks) {
  const real = Object.entries(Tracks.TRACKS).filter(([, t]) => !t.loop).map(([id]) => 'track:' + id);
  for (const id of real) SONG_BPM[id] = Tracks.TRACKS[id.slice(6)].bpm;
  SONGS.unshift(...real);
}
function songName(id) {
  if (!id.startsWith('track:')) return T('song.' + id);
  const tr = Tracks.TRACKS[id.slice(6)];
  return `${window.I18N.trackName(id.slice(6), tr.name)} (${tr.bpm} BPM)`;
}
const PAD_KINDS = ['yellow', 'pink', 'red', 'blue'];
const ORB_KINDS = ['yellow', 'pink', 'red', 'blue', 'green', 'black'];
const kindName = (k) => T('color.' + k);
const PORTAL_KINDS = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider', 'swing', 'flip', 'unflip', 'mini', 'big', 'dual', 'single'];
const portalName = (k) => (MODES.includes(k) ? modeName(k) : T('portal.' + k));
const DECO_KINDS = ['glow', 'pillar', 'ring', 'diamond', 'arrow', 'line'];
const decoName = (k) => T('deco.' + k);
// nombre y nombre en minúsculas (el español escribe "Portal: cubo"; el inglés, "Portal: Cube")
const nl = (name) => ({ name, lname: name.toLowerCase() });
const EXTRA_COLOR = { robot: '#c8ff3b', spider: '#b48cff', swing: '#ffd23a', dual: '#ff7a3d', single: '#7ad9ff' };

// ------------------------------------------------------------ paleta
const CATS = ['bloques', 'peligros', 'saltos', 'portales', 'extra', 'triggers'];
// Triggers (ver sim.js): se colocan como marcas verticales en su x; `y` sólo sirve para dibujar la marca.
const EASES = ['inout', 'linear', 'in', 'out', 'bounce'];
// nombre de cada trigger: trig.<tipo> (src/i18n.js)
const TRIG = {
  move: { icon: '⇄', color: '#3bc8ff', tpl: { group: 1, dx: 2, dy: 0, dur: 4, ease: 'inout' } },
  rotate: { icon: '⟳', color: '#b48cff', tpl: { group: 1, deg: 90, dur: 4, ease: 'inout' } },
  alpha: { icon: '◐', color: '#cfd6ff', tpl: { group: 1, alpha: 0, dur: 2 } },
  toggle: { icon: '⏻', color: '#7ee83a', tpl: { group: 1, on: false } },
  spawn: { icon: '✦', color: '#ffd23a', tpl: { target: 1, delay: 4 } },
  follow: { icon: '⇉', color: '#ff7a3d', tpl: { group: 1, follower: 2, dur: 8, kx: 1, ky: 1 } },
  camzoom: { icon: '⊕', color: '#ff5a8a', tpl: { zoom: 1.4, dur: 4, ease: 'inout' } },
  camoffset: { icon: '✥', color: '#ff5a8a', tpl: { dx: 0, dy: 2, dur: 4, ease: 'inout' } },
  camrotate: { icon: '↻', color: '#ff5a8a', tpl: { deg: 8, dur: 4, ease: 'inout' } },
  pulse: { icon: '✺', color: '#ffffff', tpl: { color: '#ffffff', dur: 4 } },
  shake: { icon: '≋', color: '#ffb13b', tpl: { power: 4, dur: 3 } },
};
const trigName = (k) => T('trig.' + k);
// Campos editables de cada trigger: [campo, etiqueta (clave ed.f.<etiqueta>), tipo, mín, máx, paso]
const TRIG_FIELDS = {
  move: [['group', 'group', 'int', 1, 999], ['dx', 'dxMove', 'num', -200, 200, 0.5], ['dy', 'dyMove', 'num', -60, 60, 0.5], ['dur', 'dur', 'num', 0, 400, 0.5], ['ease', 'ease', 'ease']],
  rotate: [['group', 'group', 'int', 1, 999], ['deg', 'degCw', 'num', -3600, 3600, 15], ['dur', 'dur', 'num', 0, 400, 0.5], ['ease', 'ease', 'ease'], ['center', 'center', 'center']],
  alpha: [['group', 'group', 'int', 1, 999], ['alpha', 'alpha', 'num', 0, 1, 0.1], ['dur', 'dur', 'num', 0, 400, 0.5]],
  toggle: [['group', 'group', 'int', 1, 999], ['on', 'on', 'bool']],
  spawn: [['target', 'target', 'target'], ['delay', 'delay', 'num', 0, 400, 0.5]],
  follow: [['group', 'leader', 'int', 1, 999], ['follower', 'follower', 'int', 1, 999], ['kx', 'kx', 'num', -10, 10, 0.1], ['ky', 'ky', 'num', -10, 10, 0.1], ['dur', 'durAlways', 'num', 0, 2000, 0.5]],
  camzoom: [['zoom', 'zoom', 'num', 0.3, 4, 0.1], ['dur', 'dur', 'num', 0, 400, 0.5], ['ease', 'ease', 'ease']],
  camoffset: [['dx', 'dxOff', 'num', -30, 30, 0.5], ['dy', 'dyOff', 'num', -30, 30, 0.5], ['dur', 'dur', 'num', 0, 400, 0.5], ['ease', 'ease', 'ease']],
  camrotate: [['deg', 'deg', 'num', -180, 180, 1], ['dur', 'dur', 'num', 0, 400, 0.5], ['ease', 'ease', 'ease']],
  pulse: [['color', 'color', 'color'], ['dur', 'dur', 'num', 0, 40, 0.5]],
  shake: [['power', 'power', 'num', 0, 20, 0.5], ['dur', 'dur', 'num', 0, 40, 0.5]],
};
const TRIG_ID = /^[A-Za-z0-9_-]{1,20}$/;
// Nombre de cada objeto de la paleta: se traduce al leerlo (it.name), ver named().
const named = (it, key, vars) => Object.defineProperty(it, 'name', { enumerable: true, get: () => T(key, vars && vars()) });
const ITEMS = [
  named({ id: 'block', cat: 'bloques', tpl: { t: 'block', w: 1, h: 1 } }, 'item.block'),
  named({ id: 'slab', cat: 'bloques', tpl: { t: 'block', w: 1, h: 0.5 } }, 'item.slab'),
  named({ id: 'wide', cat: 'bloques', tpl: { t: 'block', w: 3, h: 1 } }, 'item.wide'),
  named({ id: 'slope1', cat: 'bloques', tpl: { t: 'slope', w: 1, h: 1, dir: 1 } }, 'item.slope1'),
  named({ id: 'slope2', cat: 'bloques', tpl: { t: 'slope', w: 2, h: 1, dir: 1 } }, 'item.slope2'),
  named({ id: 'steep', cat: 'bloques', tpl: { t: 'slope', w: 1, h: 2, dir: 1 } }, 'item.steep'),
  named({ id: 'ceil1', cat: 'bloques', tpl: { t: 'slope', w: 1, h: 1, dir: 1, ceil: true } }, 'item.ceil1'),
  named({ id: 'spike', cat: 'peligros', tpl: { t: 'spike', r: 0 } }, 'item.spike'),
  named({ id: 'spikeTop', cat: 'peligros', tpl: { t: 'spike', r: 180 } }, 'item.spikeTop'),
  named({ id: 'small', cat: 'peligros', tpl: { t: 'spike', r: 0, size: 0.5 } }, 'item.small'),
  named({ id: 'saw1', cat: 'peligros', tpl: { t: 'saw', size: 1 } }, 'item.saw1'),
  named({ id: 'saw2', cat: 'peligros', tpl: { t: 'saw', size: 2 } }, 'item.saw2'),
];
const kindVars = (k) => () => ({ Kind: kindName(k), kind: kindName(k).toLowerCase() });
for (const k of PAD_KINDS) ITEMS.push(named({ id: 'pad_' + k, cat: 'saltos', tpl: { t: 'pad', kind: k, r: 0 } }, 'item.pad', kindVars(k)));
for (const k of ORB_KINDS) ITEMS.push(named({ id: 'orb_' + k, cat: 'saltos', tpl: { t: 'orb', kind: k } }, 'item.orb', kindVars(k)));
for (const k of PORTAL_KINDS) ITEMS.push(named({ id: 'p_' + k, cat: 'portales', tpl: { t: 'portal', kind: k } }, 'item.portal', () => nl(portalName(k))));
for (const v of SPEEDS) ITEMS.push(named({ id: 'sp' + v, cat: 'portales', tpl: { t: 'portal', kind: 'speed', value: v } }, 'item.speed', () => ({ v })));
ITEMS.push(
  named({ id: 'coin', cat: 'extra', tpl: { t: 'coin' } }, 'item.coin'),
  named({ id: 'color', cat: 'extra', special: 'color' }, 'item.color'),
);
for (const k of DECO_KINDS) ITEMS.push(named({ id: 'd_' + k, cat: 'extra', deco: { kind: k, color: '#ffffff' } }, 'item.deco', () => nl(decoName(k))));
for (const k of Object.keys(TRIG)) ITEMS.push(named({ id: 't_' + k, cat: 'triggers', trig: Object.assign({ kind: k }, TRIG[k].tpl) }, 'item.trig', () => nl(trigName(k))));
const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
const num = (v, a, b) => typeof v === 'number' && isFinite(v) && v >= a && v <= b;

function boot() {
  const ND = window.ND3D;
  if (!ND || !ND.World || boot.done) return;
  boot.done = true;
  const Sim = window.Sim, World = ND.World, W = World.W, game = ND.game;
  const B = Sim.BLOCK;
  const $ = (id) => document.getElementById(id);
  const canvas = $('view');
  const root = $('editor');
  const MODE_COLOR = Object.assign({}, EXTRA_COLOR, World.MODE_COLOR || {});
  const PAD_COLOR = World.PAD_COLOR || {};
  const SPEED_COLOR = World.SPEED_COLOR || {};

  // ------------------------------------------------------------ guardado
  function load() {
    try { const v = JSON.parse(localStorage.getItem(STORE)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  let levels = load();
  function persistLevels() {
    try { localStorage.setItem(STORE, JSON.stringify(levels)); return true; } catch (e) { toast(T('ed.t.saveFail')); return false; }
  }
  function uid() { return 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
  function newLevel() {
    return {
      id: uid(), name: T('ed.n.new', { n: levels.length + 1 }), song: 'pulso', bpm: SONG_BPM.pulso,
      startMode: 'cube', startSpeed: 1, length: 0, objects: [], decos: [], triggers: [],
      colors: [{ x: 0, bg: '#3d6bff', ground: '#2a3fb0', line: '#ffffff', obj: '#ff9f3b' }],
      created: Date.now(), updated: Date.now(),
    };
  }
  function autoLength(lv) {
    let max = 20;
    for (const o of lv.objects) max = Math.max(max, o.x + (o.w || 1));
    for (const d of lv.decos || []) max = Math.max(max, d.x + (d.w || 1));
    for (const t of lv.triggers || []) max = Math.max(max, t.x + 1);
    return Math.ceil(max + 12);
  }
  function lengthOf(lv) { return lv.length > 0 ? Math.max(lv.length, 10) : autoLength(lv); }
  function toDef(lv) {
    return {
      id: lv.id, name: lv.name, song: lv.song, bpm: lv.bpm, difficulty: 'Mío', stars: 0, theme: 'original', theme3d: lv.theme3d || 'ciudad',
      startMode: lv.startMode, startSpeed: lv.startSpeed,
      objects: lv.objects.map((o) => Object.assign({}, o)),
      decos: (lv.decos || []).map((d) => Object.assign({}, d)),
      colors: lv.colors.map((c) => Object.assign({}, c)).sort((a, b) => a.x - b.x),
      hints: [], length: lengthOf(lv),
      // triggers ordenados por x; `y` es sólo la altura de la marca en el editor
      triggers: (lv.triggers || []).map((t) => { const c = Object.assign({}, t); delete c.y; return c; }).sort((a, b) => a.x - b.x),
    };
  }

  // ------------------------------------------------------------ estado
  const ed = {
    lv: null, def: null, L: null, dirty: false, lastBuild: 0, builtLen: -1,
    cam: { x: 8, y: 4, h: 12 }, flat: false, fine: false,
    tool: 'place', item: 'block', cat: 'bloques', place: null,
    sel: null, hover: null, hoverHit: null,
    undo: [], redo: [], stroke: null,
    drag: null, pointers: new Map(), pinch: null, saveTimer: 0, spaceHeld: false,
    listT: 0,
  };
  const UNDO_FIELDS = ['objects', 'decos', 'triggers', 'colors','song', 'bpm', 'startMode', 'startSpeed', 'length', 'name'];
  function snapshot() { return JSON.stringify(Object.fromEntries(UNDO_FIELDS.map((f) => [f, ed.lv[f]]))); }
  function pushUndo() {
    // Un trazo (pintar o borrar arrastrando) se deshace de una vez.
    if (ed.stroke) { if (ed.stroke.pushed) return; ed.stroke.pushed = true; }
    ed.undo.push(snapshot());
    if (ed.undo.length > 150) ed.undo.shift();
    ed.redo.length = 0;
  }
  function restore(snap) {
    Object.assign(ed.lv, JSON.parse(snap));
    ed.sel = null;
    $('edName').value = ed.lv.name;
    changed();
    renderProps();
  }
  function undo() { if (!ed.undo.length) return; ed.redo.push(snapshot()); restore(ed.undo.pop()); }
  function redo() { if (!ed.redo.length) return; ed.undo.push(snapshot()); restore(ed.redo.pop()); }
  function changed() {
    ed.dirty = true;
    ed.lv.updated = Date.now();
    clearTimeout(ed.saveTimer);
    ed.saveTimer = setTimeout(persistLevels, 400);
    status();
  }

  // ------------------------------------------------------------ escena: nivel y ayudas
  const helpers = new THREE.Group();
  helpers.name = 'editor';
  helpers.visible = false;
  W.scene.add(helpers);
  const gridGroup = new THREE.Group(), markGroup = new THREE.Group(), selGroup = new THREE.Group(), ghostGroup = new THREE.Group();
  helpers.add(gridGroup, markGroup, selGroup, ghostGroup);
  function clearGroup(g) {
    for (const c of g.children.slice()) {
      g.remove(c);
      c.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.userData.ownMat) o.material.dispose(); });
    }
  }
  const lineMat = (hex, opacity, depth) => new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity, depthWrite: false, depthTest: depth !== false });
  function segments(pts, mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(g, mat);
    l.userData.ownMat = true;
    return l;
  }
  function buildGrid(len) {
    clearGroup(gridGroup);
    const minor = [], major = [], top = 30, x1 = len + 20;
    for (let x = 0; x <= x1; x++) (x % 4 === 0 ? major : minor).push(x, 0, 0, x, top, 0);
    for (let y = 1; y <= top; y++) (y % 4 === 0 ? major : minor).push(0, y, 0, x1, y, 0);
    gridGroup.add(segments(minor, lineMat(0xffffff, 0.13)), segments(major, lineMat(0xffffff, 0.32)));
    // inicio y meta
    gridGroup.add(segments([0, 0, 0, 0, top, 0], lineMat(0x7dff5a, 0.7, false)));
    gridGroup.add(segments([len, 0, 0, len, top, 0, len - 0.1, 0, 0, len - 0.1, top, 0], lineMat(0xffcf4a, 0.9, false)));
  }
  function buildMarks() {
    clearGroup(markGroup);
    ed.lv.colors.forEach((c, i) => {
      if (i === 0 || c.x <= 0) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 12, 0.14), new THREE.MeshBasicMaterial({ color: new THREE.Color(c.bg).multiplyScalar(1.6), transparent: true, opacity: 0.85, depthTest: false }));
      m.userData.ownMat = true;
      m.position.set(c.x, 6, 0.6);
      m.renderOrder = 5;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(c.ground).multiplyScalar(1.4), depthTest: false }));
      cap.userData.ownMat = true;
      cap.position.set(0, 6.3, 0);
      cap.renderOrder = 5;
      m.add(cap);
      markGroup.add(m);
    });
    // triggers: línea vertical en su x y una etiqueta con su icono a la altura y
    (ed.lv.triggers || []).forEach((t) => {
      const info = TRIG[t.kind] || { icon: '?', color: '#ffffff' };
      const y = trigY(t);
      const col = new THREE.Color(info.color);
      const line = segments([t.x, 0, 0, t.x, y - 0.42, 0, t.x, y + 0.42, 0, t.x, 14, 0], lineMat(col, t.spawnOnly ? 0.25 : 0.55, false));
      line.renderOrder = 6;
      markGroup.add(line);
      const lbl = t.kind === 'spawn' ? '→' + t.target : t.group != null ? String(t.kind === 'follow' ? t.group + '→' + t.follower : t.group) : '';
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: trigTex(info.icon, lbl, info.color, t.spawnOnly), depthTest: false, transparent: true }));
      sp.userData.ownMat = true;
      sp.scale.set(0.84, 0.84, 1);
      sp.position.set(t.x, y, 0.8);
      sp.renderOrder = 7;
      markGroup.add(sp);
    });
  }
  // Altura (bloques) de la marca de un trigger.
  function trigY(t) { return typeof t.y === 'number' ? t.y : 9; }
  // Textura de la etiqueta de un trigger (icono + grupo), con caché.
  const texCache = new Map();
  function trigTex(icon, lbl, color, dashed) {
    const key = icon + '|' + lbl + '|' + color + '|' + !!dashed;
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(14, 11, 34, 0.92)';
    g.strokeStyle = color;
    g.lineWidth = 8;
    if (dashed) g.setLineDash([14, 10]);
    g.beginPath();
    if (g.roundRect) g.roundRect(8, 8, 112, 112, 22); else g.rect(8, 8, 112, 112);
    g.fill(); g.stroke();
    g.fillStyle = color;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = "700 60px 'Chakra Petch', sans-serif";
    g.fillText(icon, 64, lbl ? 52 : 66);
    if (lbl) { g.fillStyle = '#ffffff'; g.font = "700 34px 'Chakra Petch', sans-serif"; g.fillText(lbl.slice(0, 7), 64, 100); }
    const tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, tex);
    return tex;
  }
  function rebuild() {
    ed.def = toDef(ed.lv);
    ed.L = Sim.compileLevel(ed.def);
    ed.L.custom = true;
    World.buildLevel(ed.L);
    if (ed.def.length !== ed.builtLen) { buildGrid(ed.def.length); ed.builtLen = ed.def.length; }
    buildMarks();
    renderSel();
    ed.dirty = false;
    ed.lastBuild = performance.now();
  }

  // Caja (en bloques) de un objeto, para seleccionar y resaltar.
  function boxOf(o) {
    switch (o.t) {
      case 'block': case 'slope': return [o.x, o.y, o.x + (o.w || 1), o.y + (o.h || 1)];
      case 'spike': {
        const k = o.size === 0.5 ? 0.5 : 1, r = o.r || 0;
        if (r === 0) return [o.x, o.y, o.x + 1, o.y + k];
        if (r === 180) return [o.x, o.y + 1 - k, o.x + 1, o.y + 1];
        if (r === 90) return [o.x, o.y, o.x + k, o.y + 1];
        return [o.x + 1 - k, o.y, o.x + 1, o.y + 1];
      }
      case 'saw': { const r = (o.size || 1) / 2; return [o.x + 0.5 - r, o.y + 0.5 - r, o.x + 0.5 + r, o.y + 0.5 + r]; }
      case 'pad': return o.r === 180 ? [o.x, o.y + 0.7, o.x + 1, o.y + 1] : [o.x, o.y, o.x + 1, o.y + 0.3];
      case 'portal': return o.kind === 'speed' ? [o.x, o.y - 0.3, o.x + 1, o.y + 1.3] : [o.x, o.y - 1.1, o.x + 1, o.y + 2.1];
      default: return [o.x, o.y, o.x + 1, o.y + 1];
    }
  }
  function decoBox(d) {
    const r = d.r || (d.kind === 'glow' || d.kind === 'ring' ? 2 : 1);
    if (d.kind === 'pillar') return [d.x, d.y, d.x + (d.w || 1), d.y + (d.h || 6)];
    if (d.kind === 'line') return [d.x, d.y - 0.3, d.x + (d.w || 6), d.y + 0.3];
    if (d.kind === 'arrow') return [d.x - 0.4, d.y - 0.5, d.x + 1.2, d.y + 0.5];
    return [d.x - r * 0.5, d.y - r * 0.5, d.x + r * 0.5, d.y + r * 0.5];
  }
  // Lo que hay bajo el cursor (en bloques): objeto, cambio de color o decorado; el de encima primero.
  function trigBox(t) { const y = trigY(t); return [t.x - 0.42, y - 0.42, t.x + 0.42, y + 0.42]; }
  function pick(bx, by) {
    const lv = ed.lv;
    const trigs = lv.triggers || [];
    for (let i = trigs.length - 1; i >= 0; i--) {
      const b = trigBox(trigs[i]);
      if (bx >= b[0] && bx <= b[2] && by >= b[1] && by <= b[3]) return { kind: 'trig', i };
    }
    for (let i = lv.objects.length - 1; i >= 0; i--) {
      const b = boxOf(lv.objects[i]);
      if (bx >= b[0] && bx <= b[2] && by >= b[1] && by <= b[3]) return { kind: 'obj', i };
    }
    for (let i = lv.colors.length - 1; i > 0; i--) {
      const c = lv.colors[i];
      if (Math.abs(bx - c.x) < 0.4 && by > -1 && by < 13) return { kind: 'color', i };
    }
    const decos = lv.decos || [];
    for (let i = decos.length - 1; i >= 0; i--) {
      const b = decoBox(decos[i]);
      if (bx >= b[0] && bx <= b[2] && by >= b[1] && by <= b[3]) return { kind: 'deco', i };
    }
    return null;
  }
  function boxOfHit(h) {
    if (!h) return null;
    if (h.kind === 'obj') return ed.lv.objects[h.i] ? boxOf(ed.lv.objects[h.i]) : null;
    if (h.kind === 'deco') return ed.lv.decos[h.i] ? decoBox(ed.lv.decos[h.i]) : null;
    if (h.kind === 'trig') return ed.lv.triggers[h.i] ? trigBox(ed.lv.triggers[h.i]) : null;
    const c = ed.lv.colors[h.i];
    return c ? [c.x - 0.3, 0, c.x + 0.3, 12.7] : null;
  }
  function selected() {
    const s = ed.sel;
    if (!s || !ed.lv) return null;
    if (s.kind === 'obj') return ed.lv.objects[s.i] || null;
    if (s.kind === 'deco') return ed.lv.decos[s.i] || null;
    if (s.kind === 'color') return ed.lv.colors[s.i] || null;
    if (s.kind === 'trig') return (ed.lv.triggers || [])[s.i] || null;
    return null;
  }
  function boxLines(b, hex, z) {
    const w = b[2] - b[0], h = b[3] - b[1];
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.06, h + 0.06, z || 1.15)), lineMat(hex, 0.95, false));
    l.userData.ownMat = true;
    l.position.set(b[0] + w / 2, b[1] + h / 2, 0);
    l.renderOrder = 10;
    return l;
  }
  // Grupos que resaltar: los del trigger u objeto elegido (o del trigger que se va a colocar).
  function selGroups() {
    const o = selected();
    const src = o || (ed.tool === 'place' && ITEM[ed.item] && ITEM[ed.item].trig ? ed.place : null);
    if (!src) return [];
    const out = [];
    const k = ed.sel ? ed.sel.kind : 'trig';
    if (k === 'trig') {
      if (src.group != null) out.push([src.group, 0x3bc8ff]);
      if (src.follower != null) out.push([src.follower, 0xff7a3d]);
      if (src.kind === 'spawn' && typeof src.target === 'number') out.push([src.target, 0xffd23a]);
    } else if (k === 'obj' || k === 'deco') for (const g of Sim.groupsOf(src) || []) out.push([g, 0x3bc8ff]);
    return out;
  }
  function renderSel() {
    clearGroup(selGroup);
    if (!ed.lv) return;
    // miembros de los grupos resaltados: caja de color, y los triggers de esos grupos
    for (const [g, hex] of selGroups()) {
      ed.lv.objects.forEach((o) => { const gs = Sim.groupsOf(o); if (gs && gs.includes(g)) selGroup.add(boxLines(boxOf(o), hex, 1.3)); });
      (ed.lv.decos || []).forEach((d) => { const gs = Sim.groupsOf(d); if (gs && gs.includes(g)) selGroup.add(boxLines(decoBox(d), hex, 1.3)); });
    }
    const b = boxOfHit(selected() ? ed.sel : null);
    if (b) selGroup.add(boxLines(b, 0xffcf4a));
    if (ed.hoverHit && (ed.tool === 'erase' || ed.tool === 'select') && !(ed.sel && ed.hoverHit.kind === ed.sel.kind && ed.hoverHit.i === ed.sel.i)) {
      const hb = boxOfHit(ed.hoverHit);
      if (hb) selGroup.add(boxLines(hb, ed.tool === 'erase' ? 0xff3b5c : 0xffffff));
    }
  }

  // Fantasma translúcido del objeto que se va a colocar.
  function ghostColor(o) {
    if (!o) return '#ffffff';
    if (o.t === 'spike' || o.t === 'saw') return '#ff4fa3';
    if (o.t === 'pad' || o.t === 'orb') return PAD_COLOR[o.kind] || '#ffd23a';
    if (o.t === 'portal') return o.kind === 'speed' ? (SPEED_COLOR[o.value] || '#3bc6ff') : (MODE_COLOR[o.kind] || '#ffffff');
    if (o.t === 'coin') return '#ffd23a';
    return (ed.lv && ed.lv.colors[0].obj) || '#ff9f3b';
  }
  function slopeShape(w, h, dir, ceil) {
    let pts = dir > 0 ? [[0, 0], [w, 0], [w, h]] : [[0, 0], [w, 0], [0, h]];
    if (ceil) pts = pts.map(([x, y]) => [x, h - y]);
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]); s.lineTo(pts[1][0], pts[1][1]); s.lineTo(pts[2][0], pts[2][1]); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
  }
  // Geometría (con origen en la esquina inferior izquierda de la celda) de un objeto o plantilla.
  function ghostGeo(o) {
    switch (o.t) {
      case 'block': return new THREE.BoxGeometry(o.w || 1, o.h || 1, 1).translate((o.w || 1) / 2, (o.h || 1) / 2, 0);
      case 'slope': return slopeShape(o.w || 1, o.h || 1, o.dir || 1, o.ceil);
      case 'spike': {
        const h = o.size === 0.5 ? 0.5 : 1;
        const g = new THREE.ConeGeometry(0.5, h, 4).rotateY(Math.PI / 4).translate(0, -0.5 + h / 2, 0);
        return g.rotateZ(-(o.r || 0) * DEG).translate(0.5, 0.5, 0);
      }
      case 'saw': return new THREE.CylinderGeometry((o.size || 1) / 2, (o.size || 1) / 2, 0.25, 24).rotateX(Math.PI / 2).translate(0.5, 0.5, 0);
      case 'pad': return new THREE.BoxGeometry(0.9, 0.22, 0.7).translate(0.5, o.r === 180 ? 0.89 : 0.11, 0);
      case 'orb': return new THREE.SphereGeometry(0.42, 16, 12).translate(0.5, 0.5, 0);
      case 'coin': return new THREE.CylinderGeometry(0.38, 0.38, 0.12, 20).rotateX(Math.PI / 2).translate(0.5, 0.5, 0);
      case 'portal': return o.kind === 'speed' ? new THREE.BoxGeometry(0.8, 1.6, 0.3).translate(0.5, 0.5, 0) : new THREE.BoxGeometry(0.7, 3.2, 0.7).translate(0.5, 0.5, 0);
      default: return new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0);
    }
  }
  let ghostKey = '';
  function updateGhost() {
    const show = ed.lv && ed.tool === 'place' && ed.hover && !ed.drag && !ed.pinch;
    ghostGroup.visible = !!show;
    if (!show) return;
    const it = ITEM[ed.item];
    const tpl = ed.place;
    const key = ed.item + JSON.stringify(tpl) + (ed.lv.colors[0].obj || '');
    if (key !== ghostKey) {
      ghostKey = key;
      clearGroup(ghostGroup);
      let geo, hex;
      if (it.special === 'color') { geo = new THREE.BoxGeometry(0.14, 12, 0.14).translate(0, 6, 0); hex = '#ff5a8a'; }
      else if (it.trig) { geo = new THREE.BoxGeometry(0.7, 0.7, 0.1); hex = TRIG[it.trig.kind].color; }
      else if (it.deco) { geo = new THREE.SphereGeometry(0.35, 12, 8).translate(0.5, 0.5, 0); hex = tpl.color || '#ffffff'; }
      else { geo = ghostGeo(tpl); hex = ghostColor(tpl); }
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: 0.42, depthTest: false, depthWrite: false }));
      mesh.userData.ownMat = true;
      mesh.renderOrder = 20;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(0xffffff, 0.9, false));
      edges.userData.ownMat = true;
      edges.renderOrder = 21;
      ghostGroup.add(mesh, edges);
    }
    const p = snapPos(ed.hover.x, ed.hover.y);
    if (it.special === 'color') ghostGroup.position.set(Math.max(1, Math.round(ed.hover.x)), 0, 0.6);
    else if (it.trig) ghostGroup.position.set(p.x, p.y + 0.5, 0.8);
    else ghostGroup.position.set(p.x, p.y, 0);
  }

  // ------------------------------------------------------------ cámara del editor
  // ed.cam: centro de la vista (x, y) y alto visible (h), en bloques.
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hitV = new THREE.Vector3();
  function editing() { return !!ed.lv && game.screen === 'editor'; }
  function applyCam() {
    const cam = W.camera;
    const dist = ed.cam.h / (2 * Math.tan(cam.fov * DEG / 2));
    const k = ed.flat ? 0 : 1;
    cam.position.set(ed.cam.x - 0.1 * dist * k, ed.cam.y + 0.05 * dist * k, dist);
    cam.up.set(0, 1, 0);
    cam.lookAt(ed.cam.x, ed.cam.y, 0);
    cam.updateMatrixWorld();
    W.sky.position.copy(cam.position);
  }
  // El mundo coloca su cámara de juego en frame(); en el editor se sustituye justo antes de dibujar.
  for (const name of ['bloomComposer', 'composer']) {
    const comp = W[name];
    if (!comp) continue;
    const orig = comp.render.bind(comp);
    comp.render = (dt) => {
      const on = editing();
      helpers.visible = on;
      if (on) applyCam();
      return orig(dt);
    };
  }
  // Celda junto a la cara del objeto que hay bajo el puntero (arriba, abajo o a los lados), para apilar en 3D.
  // Las caras de delante no cuentan: ahí manda el plano del fondo, como siempre.
  const stackRay = new THREE.Raycaster();
  function stackCell(cx, cy) {
    if (!W.levelGroup) return null;
    applyCam();
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / (r.width || 1)) * 2 - 1, -((cy - r.top) / (r.height || 1)) * 2 + 1);
    stackRay.setFromCamera(ndc, W.camera);
    const meshes = [];
    W.levelGroup.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.material && !o.material.transparent && o.material.isMeshStandardMaterial) meshes.push(o); });
    const hit = stackRay.intersectObjects(meshes, false).find((h) => h.distance < 80 && h.point.z > -0.6 && h.point.z < 0.6);
    if (!hit || !hit.face) return null;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (Math.abs(n.z) > Math.max(Math.abs(n.x), Math.abs(n.y))) return null;
    return { x: hit.point.x + n.x * 0.5, y: hit.point.y + n.y * 0.5 };
  }
  function toWorld(cx, cy) {
    applyCam();
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / (r.width || 1)) * 2 - 1, -((cy - r.top) / (r.height || 1)) * 2 + 1);
    ray.setFromCamera(ndc, W.camera);
    if (!ray.ray.intersectPlane(plane, hitV)) return { x: ed.cam.x, y: ed.cam.y };
    return { x: hitV.x, y: hitV.y };
  }
  function clampCam() {
    const c = ed.cam;
    c.h = Math.max(5, Math.min(40, c.h));
    c.x = Math.max(-10, Math.min(lengthOf(ed.lv) + 20, c.x));
    c.y = Math.max(-3, Math.min(40, c.y));
  }
  function zoomAt(cx, cy, factor) {
    const before = toWorld(cx, cy);
    ed.cam.h /= factor;
    clampCam();
    for (let i = 0; i < 2; i++) {
      const after = toWorld(cx, cy);
      ed.cam.x += before.x - after.x;
      ed.cam.y += before.y - after.y;
    }
    clampCam();
  }
  // Encuadra el comienzo del nivel en la parte libre de la pantalla (fuera del panel).
  function homeCam() {
    const vh = innerHeight || 600, vw = innerWidth || 800;
    // en vertical (móvil) se aleja para que quepan ~11 bloques a lo ancho
    ed.cam.h = Math.min(30, Math.max(vw < 720 ? 9 : 12, 11 * vh / vw));
    const ppb = vh / ed.cam.h;
    const r = $('edSide').getBoundingClientRect();
    const side = r.width && r.width < vw * 0.6;
    const left = side ? r.right + 20 : 16;
    const bottom = side ? 120 : vh - r.top + 60;
    ed.cam.x = (vw / 2 - left) / ppb + 1;
    ed.cam.y = (vh / 2 - bottom) / ppb + 0.2;
  }

  // ------------------------------------------------------------ acciones
  function snapPos(bx, by) {
    if (ed.fine) return { x: Math.round((bx - 0.5) * 2) / 2, y: Math.round((by - 0.5) * 2) / 2 };
    return { x: Math.floor(bx), y: Math.floor(by) };
  }
  function selectItem(id) {
    ed.item = id;
    const it = ITEM[id];
    ed.place = it.tpl ? Object.assign({}, it.tpl) : it.deco ? Object.assign({}, it.deco) : it.trig ? Object.assign({}, it.trig) : null;
    if (it.trig && ed.place.group != null && ed.lastGroup) ed.place.group = ed.lastGroup; // el último grupo usado
    ed.sel = null;
    setTool('place');
    renderPalette();
  }
  function placeAt(bx, by) {
    const it = ITEM[ed.item];
    const p = snapPos(bx, by);
    if (p.x < 0 || p.y < -1 || p.y > 60) return;
    const lv = ed.lv;
    if (it.special === 'color') {
      const x = Math.max(1, Math.round(bx));
      if (lv.colors.some((c) => c.x === x)) return;
      pushUndo();
      const base = lv.colors[0];
      lv.colors.push({ x, bg: '#ff5a8a', ground: '#b02a5c', line: base.line || '#ffffff', obj: base.obj || '#ffd23a', fade: 8 });
      ed.sel = { kind: 'color', i: lv.colors.length - 1 };
    } else if (it.deco) {
      pushUndo();
      lv.decos = lv.decos || [];
      // el pilar crece desde su base y la línea va hacia la derecha; el resto se centra en la celda
      const k = ed.place.kind;
      lv.decos.push(Object.assign({}, ed.place, { x: k === 'pillar' || k === 'line' ? p.x : p.x + 0.5, y: k === 'pillar' ? p.y : p.y + 0.5 }));
      ed.sel = { kind: 'deco', i: lv.decos.length - 1 };
    } else if (it.trig) {
      lv.triggers = lv.triggers || [];
      const y = p.y + 0.5;
      if (lv.triggers.some((t) => t.x === p.x && trigY(t) === y)) return;
      pushUndo();
      lv.triggers.push(Object.assign({}, ed.place, { x: p.x, y }));
      ed.sel = { kind: 'trig', i: lv.triggers.length - 1 };
    } else {
      const tpl = ed.place;
      // Sin duplicados exactos en la misma celda.
      if (lv.objects.some((o) => o.x === p.x && o.y === p.y && o.t === tpl.t && (o.kind || '') === (tpl.kind || '') && (o.r || 0) === (tpl.r || 0))) return;
      pushUndo();
      lv.objects.push(Object.assign({}, tpl, { x: p.x, y: p.y }));
      ed.sel = null; // el panel sigue mostrando lo que se coloca
    }
    changed();
    renderProps();
  }
  function removeSel() {
    const s = ed.sel;
    if (!s || !selected()) return;
    pushUndo();
    if (s.kind === 'obj') ed.lv.objects.splice(s.i, 1);
    else if (s.kind === 'deco') ed.lv.decos.splice(s.i, 1);
    else if (s.kind === 'trig') ed.lv.triggers.splice(s.i, 1);
    else if (s.kind === 'color' && s.i > 0) ed.lv.colors.splice(s.i, 1);
    ed.sel = null;
    ed.hoverHit = null;
    changed();
    renderProps();
  }
  function eraseAt(bx, by) {
    const hit = pick(bx, by);
    if (!hit) return;
    ed.sel = hit;
    removeSel();
  }
  // Gira 90°: pinchos y portales en 4 sentidos; pads suelo/techo; rampas suelo / → suelo \ → techo / → techo \.
  function rotateObj(o) {
    if (!o) return false;
    if (o.t === 'spike') o.r = ((o.r || 0) + 90) % 360;
    else if (o.t === 'pad') o.r = o.r === 180 ? 0 : 180;
    else if (o.t === 'portal') { o.r = ((o.r || 0) + 90) % 360; if (!o.r) delete o.r; }
    else if (o.t === 'slope') {
      const dir = o.dir || 1;
      if (!o.ceil) { if (dir > 0) o.dir = -1; else { o.dir = 1; o.ceil = true; } }
      else if (dir > 0) o.dir = -1;
      else { o.dir = 1; delete o.ceil; }
    } else return false;
    return true;
  }
  function rotate() {
    const o = selected();
    if (o && ed.sel.kind === 'obj') {
      const copy = Object.assign({}, o);
      if (!rotateObj(copy)) return;
      pushUndo();
      Object.keys(o).forEach((k) => delete o[k]);
      Object.assign(o, copy);
      changed();
    } else if (ed.tool === 'place' && ed.place) { if (rotateObj(ed.place)) renderPalette(); }
    renderProps();
  }
  function duplicateSel() {
    const o = selected();
    if (!o || ed.sel.kind === 'color') return;
    pushUndo();
    const c = Object.assign({}, o);
    c.x += ed.sel.kind === 'obj' ? (o.w || 1) : 1;
    if (ed.sel.kind === 'obj') { ed.lv.objects.push(c); ed.sel = { kind: 'obj', i: ed.lv.objects.length - 1 }; }
    else if (ed.sel.kind === 'trig') { ed.lv.triggers.push(c); ed.sel = { kind: 'trig', i: ed.lv.triggers.length - 1 }; }
    else { ed.lv.decos.push(c); ed.sel = { kind: 'deco', i: ed.lv.decos.length - 1 }; }
    changed();
    renderProps();
  }
  function moveSelTo(bx, by, grab) {
    const o = selected();
    if (!o) return;
    const k = ed.sel.kind;
    if (k === 'color') { const x = Math.max(1, Math.round(bx)); if (x !== o.x) { o.x = x; changed(); } return; }
    const sn = ed.fine || k === 'deco' || k === 'trig' ? 0.5 : 1;
    const nx = Math.max(0, Math.round((bx - grab.dx) / sn) * sn);
    const ny = Math.max(-1, Math.min(60, Math.round((by - grab.dy) / sn) * sn));
    if (nx === o.x && ny === o.y) return;
    o.x = nx; o.y = ny;
    changed();
  }

  // ------------------------------------------------------------ entrada
  function onDown(e) {
    if (!editing() || !$('edModal').hidden) return;
    e.preventDefault();
    canvas.focus();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* opcional */ }
    ed.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ed.pointers.size === 2) {
      // Dos dedos: desplazar y hacer zoom. El primer dedo no quería colocar: era el inicio del gesto.
      const [a, b] = [...ed.pointers.values()];
      if (ed.stroke && ed.stroke.pushed) restore(ed.undo.pop());
      else if (ed.drag && ed.drag.kind === 'move' && ed.drag.pushed) restore(ed.undo.pop());
      ed.stroke = null; ed.drag = null;
      ed.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      return;
    }
    if (ed.pointers.size > 2) return;
    const wp = toWorld(e.clientX, e.clientY);
    ed.hover = wp;
    if (ed.tool === 'pan' || e.button === 1 || ed.spaceHeld) { ed.drag = { kind: 'pan', grab: wp }; return; }
    if (e.button === 2) { ed.stroke = {}; eraseAt(wp.x, wp.y); ed.drag = { kind: 'erase' }; return; }
    if (ed.tool === 'place') {
      ed.stroke = {};
      const st = ed.flat ? null : stackCell(e.clientX, e.clientY);
      placeAt(st ? st.x : wp.x, st ? st.y : wp.y);
      ed.drag = { kind: 'paint', last: snapPos(wp.x, wp.y) };
      return;
    }
    if (ed.tool === 'erase') { ed.stroke = {}; eraseAt(wp.x, wp.y); ed.drag = { kind: 'erase' }; return; }
    // seleccionar / mover; en el vacío, desplaza la vista
    const hit = pick(wp.x, wp.y);
    ed.sel = hit;
    renderProps();
    renderSel();
    if (hit) {
      const o = selected();
      ed.drag = { kind: 'move', grab: { dx: wp.x - (o.x || 0), dy: wp.y - (o.y || 0) }, snap: snapshot(), pushed: false };
    } else ed.drag = { kind: 'pan', grab: wp };
  }
  function onMove(e) {
    if (!editing()) return;
    if (ed.pointers.has(e.pointerId)) ed.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ed.pinch && ed.pointers.size === 2) {
      const [a, b] = [...ed.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const p0 = toWorld(ed.pinch.cx, ed.pinch.cy), p1 = toWorld(cx, cy);
      ed.cam.x -= p1.x - p0.x; ed.cam.y -= p1.y - p0.y;
      zoomAt(cx, cy, d / ed.pinch.d);
      ed.pinch = { d, cx, cy };
      return;
    }
    const wp = toWorld(e.clientX, e.clientY);
    ed.hover = wp;
    const dr = ed.drag;
    if (!dr) {
      const h = (ed.tool === 'erase' || ed.tool === 'select') ? pick(wp.x, wp.y) : null;
      if (JSON.stringify(h) !== JSON.stringify(ed.hoverHit)) { ed.hoverHit = h; renderSel(); }
      status();
      return;
    }
    if (dr.kind === 'pan') {
      ed.cam.x -= wp.x - dr.grab.x;
      ed.cam.y -= wp.y - dr.grab.y;
      clampCam();
    } else if (dr.kind === 'paint') {
      const it = ITEM[ed.item];
      const p = snapPos(wp.x, wp.y);
      if ((p.x !== dr.last.x || p.y !== dr.last.y) && !it.special) {
        // Rellena las celdas intermedias aunque el puntero vaya rápido.
        const sn = ed.fine ? 0.5 : 1;
        const n = Math.max(Math.abs(p.x - dr.last.x), Math.abs(p.y - dr.last.y)) / sn;
        for (let i = 1; i <= n; i++) {
          const cx = dr.last.x + (p.x - dr.last.x) * i / n, cy = dr.last.y + (p.y - dr.last.y) * i / n;
          placeAt(cx + 0.5, cy + 0.5);
        }
      }
      dr.last = p;
    } else if (dr.kind === 'erase') {
      eraseAt(wp.x, wp.y);
    } else if (dr.kind === 'move') {
      if (!dr.pushed) { ed.undo.push(dr.snap); ed.redo.length = 0; dr.pushed = true; }
      moveSelTo(wp.x, wp.y, dr.grab);
    }
    status();
  }
  function onUp(e) {
    ed.pointers.delete(e.pointerId);
    if (ed.pointers.size < 2) ed.pinch = null;
    ed.stroke = null;
    if (ed.drag && ed.drag.kind === 'move') renderProps();
    ed.drag = null;
    if (e.pointerType === 'touch') ed.hover = null; // sin ratón, el fantasma no se queda flotando
  }
  function onWheel(e) {
    if (!editing()) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.altKey) { zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0025)); return; }
    const k = ed.cam.h / (innerHeight || 600);
    if (e.shiftKey) ed.cam.y -= e.deltaY * k;
    else {
      ed.cam.x += (e.deltaX + (Math.abs(e.deltaX) < 1 ? e.deltaY : 0)) * k;
      if (Math.abs(e.deltaX) >= 1) ed.cam.y -= e.deltaY * k;
    }
    clampCam();
  }
  function onKey(e) {
    if (game.screen !== 'editor') return;
    if (e.code === 'Escape' && !$('edModal').hidden) { closeModal(); return; }
    if (!ed.lv || !$('edModal').hidden) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
    const mod = e.ctrlKey || e.metaKey;
    const step = e.shiftKey ? 10 : 3;
    let handled = true;
    if (mod && e.code === 'KeyZ' && !e.shiftKey) undo();
    else if ((mod && e.code === 'KeyY') || (mod && e.shiftKey && e.code === 'KeyZ')) redo();
    else if (mod && e.code === 'KeyD') duplicateSel();
    else if (mod && e.code === 'KeyS') { persistLevels(); toast(T('ed.t.saved')); }
    else if (mod) handled = false;
    else if (e.code === 'Delete' || e.code === 'Backspace') removeSel();
    else if (e.code === 'KeyR') rotate();
    else if (e.code === 'Escape') { ed.sel = null; renderProps(); renderSel(); }
    else if (e.code === 'Space') ed.spaceHeld = true;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') ed.cam.x += step;
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') ed.cam.x -= step;
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') ed.cam.y += step;
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') ed.cam.y -= step;
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomAt(innerWidth / 2, innerHeight / 2, 1.2);
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.2);
    else if (e.code === 'Home') homeCam();
    else if (e.code === 'Digit1') setTool('place');
    else if (e.code === 'Digit2') setTool('select');
    else if (e.code === 'Digit3') setTool('erase');
    else if (e.code === 'Digit4') setTool('pan');
    else if (e.code === 'KeyG') toggleFine();
    else if (e.code === 'KeyV') toggleFlat();
    else if (e.code === 'KeyT') toggleTrigView();
    else if (e.code === 'KeyP') testPlay(false, e.shiftKey);
    else handled = false;
    clampCam();
    if (handled) e.preventDefault();
  }

  // ------------------------------------------------------------ interfaz
  const css = `
  #editor { padding: 0; display: block; }
  #editor[hidden] { display: none; }
  #editor .ed-ui { position: absolute; inset: 0; pointer-events: none; }
  #editor .ed-ui > * { pointer-events: auto; }
  .ed-box { position: absolute; background: linear-gradient(180deg, var(--panel-2), var(--panel)); border: 2px solid rgba(160, 140, 255, 0.35); border-radius: 14px; box-shadow: 0 12px 34px rgba(0, 0, 0, 0.5); backdrop-filter: blur(6px); }
  .ed-box::before, .ed-box::after { content: ''; position: absolute; width: 16px; height: 16px; border: 3px solid var(--gold); pointer-events: none; }
  .ed-box::before { left: -3px; top: -3px; border-right: 0; border-bottom: 0; border-radius: 8px 0 0 0; }
  .ed-box::after { right: -3px; bottom: -3px; border-left: 0; border-top: 0; border-radius: 0 0 8px 0; }
  .ed-top { top: max(10px, env(safe-area-inset-top)); left: 10px; right: 10px; display: flex; align-items: center; gap: 6px; padding: 7px 8px; overflow-x: auto; scrollbar-width: none; }
  .ed-top::-webkit-scrollbar { display: none; }
  .ed-top input { font: inherit; font-weight: 900; font-size: 16px; color: var(--text); background: rgba(255, 255, 255, 0.07); border: 2px solid rgba(255, 255, 255, 0.12); border-radius: 10px; padding: 6px 10px; min-width: 110px; flex: 1 1 160px; max-width: 280px; user-select: text; -webkit-user-select: text; }
  .ed-top .sp { flex: 1; }
  .ed-b { flex: none; font: inherit; font-weight: 900; font-size: 15px; color: var(--text); cursor: pointer; border: 0; border-radius: 10px; padding: 7px 10px; min-width: 38px; height: 38px; background: rgba(255, 255, 255, 0.08); box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.14); white-space: nowrap; }
  .ed-b:hover { background: rgba(255, 255, 255, 0.14); }
  .ed-b:active { transform: translateY(1px); }
  .ed-b:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .ed-b.on { background: var(--gold); color: #3a1a00; box-shadow: none; }
  .ed-b.go { color: #10230a; background: linear-gradient(180deg, #a6ff6a, #4fd62c); box-shadow: 0 3px 0 #23810e; }
  .ed-b.pr { color: #fff; background: linear-gradient(180deg, #b48cff, #7a4cf0); box-shadow: 0 3px 0 #4a24a8; }
  .ed-b.danger { color: #fff; background: linear-gradient(180deg, #ff6b7d, #e0284a); box-shadow: 0 3px 0 #8a1028; }
  .ed-b:disabled { opacity: 0.35; cursor: default; }
  .ed-side { left: 10px; top: 72px; bottom: 50px; width: 268px; display: flex; flex-direction: column; gap: 8px; padding: 10px; overflow: hidden; }
  .ed-tools { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
  .ed-tools .ed-b { padding: 6px 2px; font-size: 13px; height: auto; display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 0; }
  .ed-tools .ed-b i { font-style: normal; font-size: 17px; line-height: 1.1; }
  .ed-cats { display: flex; gap: 4px; flex-wrap: wrap; }
  .ed-cats button { font: inherit; font-weight: 900; font-size: 12px; border: 0; border-radius: 99px; padding: 4px 9px; cursor: pointer; background: rgba(255, 255, 255, 0.08); color: var(--muted); }
  .ed-cats button.on { background: var(--gold); color: #3a1a00; }
  .ed-pal { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; overflow-y: auto; min-height: 52px; flex: 0 1 auto; padding: 2px; }
  .ed-pal button { aspect-ratio: 1; border: 0; border-radius: 9px; cursor: pointer; background: rgba(0, 0, 0, 0.3); box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.1); padding: 3px; display: grid; place-items: center; }
  .ed-pal button.on { box-shadow: inset 0 0 0 2px var(--gold), 0 0 12px rgba(255, 207, 74, 0.45); background: rgba(255, 207, 74, 0.12); }
  .ed-pal svg { width: 100%; height: 100%; display: block; }
  .ed-props { border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 8px; overflow-y: auto; flex: 1 1 auto; min-height: 0; display: grid; gap: 7px; align-content: start; }
  .ed-props h3 { margin: 0; font-family: 'Chakra Petch', sans-serif; font-weight: 400; font-size: 18px; }
  .ed-props .tag, .ed-card .tag { color: var(--muted); font-weight: 800; font-size: 12px; }
  .ed-f { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 800; font-size: 14px; }
  .ed-f select, .ed-f input[type=number], .ed-f input[type=text] { font: inherit; font-weight: 800; font-size: 14px; color: var(--text); background: #1d1745; border: 2px solid rgba(255, 255, 255, 0.14); border-radius: 8px; padding: 4px 6px; max-width: 170px; user-select: text; -webkit-user-select: text; }
  .ed-f input[type=color] { width: 40px; height: 28px; border: 0; padding: 0; background: none; cursor: pointer; }
  .ed-f input[type=checkbox] { width: 20px; height: 20px; accent-color: var(--gold); }
  .ed-step { display: inline-flex; align-items: center; gap: 4px; }
  .ed-step b { min-width: 30px; text-align: center; }
  .ed-step button { width: 28px; height: 28px; border-radius: 8px; border: 0; cursor: pointer; font: inherit; font-weight: 900; color: #fff; background: #6a3fe0; }
  .ed-acts { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .ed-status { left: 290px; right: 10px; bottom: max(8px, env(safe-area-inset-bottom)); padding: 5px 10px; font-weight: 800; font-size: 13px; color: var(--muted); display: flex; gap: 8px; align-items: center; }
  .ed-status .keys { opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
  .ed-status #edPos { white-space: nowrap; }
  .ed-status .ed-b { height: 30px; min-width: 30px; padding: 3px 8px; font-size: 14px; }
  .ed-modal { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(5, 4, 14, 0.66); z-index: 5; }
  .ed-modal[hidden], .ed-list[hidden], .ed-ui[hidden] { display: none; }
  .ed-modal .panel { max-height: calc(100% - 20px); overflow-y: auto; width: min(480px, 100%); }
  .ed-modal textarea { width: 100%; min-height: 120px; font: 12px/1.35 ui-monospace, monospace; color: var(--text); background: #120e2c; border: 2px solid rgba(255, 255, 255, 0.14); border-radius: 10px; padding: 8px; resize: vertical; user-select: text; -webkit-user-select: text; word-break: break-all; }
  .ed-modal p { color: var(--muted); font-weight: 800; font-size: 14px; margin: 0 0 10px; }
  .ed-modal .err { color: #ff6b7d; min-height: 18px; margin: 6px 0 0; }
  .ed-modal .ed-f { margin-bottom: 9px; }
  .ed-list { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 16px; background: radial-gradient(ellipse at center, rgba(5, 4, 14, 0.25), rgba(5, 4, 14, 0.7)); }
  .ed-list .panel { width: min(560px, 100%); max-height: calc(100% - 8px); display: flex; flex-direction: column; }
  .ed-cards { overflow-y: auto; display: grid; gap: 10px; margin: 6px 0 4px; padding: 2px; }
  .ed-card { background: rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 10px 12px; }
  .ed-card h3 { margin: 0 0 2px; font-family: 'Chakra Petch', sans-serif; font-weight: 400; font-size: 20px; overflow-wrap: anywhere; }
  .ed-card .info { color: var(--muted); font-weight: 800; font-size: 13px; margin-bottom: 8px; }
  .ed-card .ed-acts .ed-b { height: 32px; font-size: 14px; }
  .ed-empty { color: var(--muted); font-weight: 800; text-align: center; padding: 16px 6px; margin: 0; }
  .ed-toast { position: absolute; left: 50%; top: 72px; transform: translateX(-50%); background: rgba(14, 11, 34, 0.94); border: 2px solid var(--gold); color: var(--text); font-weight: 900; padding: 8px 16px; border-radius: 12px; pointer-events: none; transition: opacity 0.3s; z-index: 9; white-space: nowrap; }
  @media (max-width: 720px) {
    .ed-top { left: 6px; right: 6px; padding: 5px 6px; gap: 4px; }
    .ed-top input { min-width: 60px; flex-basis: 70px; font-size: 14px; padding: 5px 7px; }
    .ed-b { height: 34px; min-width: 32px; padding: 4px 6px; font-size: 14px; }
    .ed-top .ed-b .lbl { display: none; }
    .ed-side { left: 6px; right: 6px; top: auto; bottom: max(6px, env(safe-area-inset-bottom)); width: auto; max-height: 46%; padding: 8px; gap: 6px; }
    .ed-tools .ed-b { flex-direction: row; justify-content: center; gap: 4px; padding: 4px; }
    .ed-pal { display: flex; overflow-x: auto; overflow-y: hidden; flex: none; min-height: 50px; }
    .ed-pal button { flex: none; width: 48px; height: 48px; }
    .ed-props { max-height: 24vh; }
    .ed-status { left: 6px; right: 6px; bottom: auto; top: 58px; padding: 3px 6px; font-size: 12px; gap: 4px; }
    .ed-status .keys { display: none; }
    .ed-status #edPos { flex: 1; overflow: hidden; text-overflow: ellipsis; }
    .ed-status .ed-b { height: 28px; min-width: 28px; padding: 2px 6px; }
  }`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Textos con data-i18n* (src/i18n.js): I18N.apply(root) los rellena al construir y al cambiar de idioma.
  root.innerHTML = `
    <div class="ed-ui" id="edUi" hidden>
      <div class="ed-box ed-top">
        <button class="ed-b" id="edBack" data-i18n-title="ed.myLevels" data-i18n-aria="ed.myLevels">‹</button>
        <input type="text" id="edName" maxlength="40" data-i18n-aria="ed.levelName">
        <button class="ed-b" id="edUndo" data-i18n-title="ed.undoTitle" data-i18n-aria="ed.undo">↶</button>
        <button class="ed-b" id="edRedo" data-i18n-title="ed.redoTitle" data-i18n-aria="ed.redo">↷</button>
        <button class="ed-b" id="edSettings" data-i18n-title="ed.settingsTitle" data-i18n-aria="ed.settingsTitle">⚙<span class="lbl"> <span data-i18n="ed.settings"></span></span></button>
        <button class="ed-b" id="edShare" data-i18n-title="ed.shareTitle" data-i18n-aria="ed.share">⇪<span class="lbl"> <span data-i18n="ed.share"></span></span></button>
        <button class="ed-b danger" id="edClear" data-i18n-title="ed.clearTitle" data-i18n-aria="ed.clearTitle">🗑</button>
        <span class="sp"></span>
        <button class="ed-b" id="edVerify" data-i18n-title="ed.verifyTitle" data-i18n-aria="ed.verify">✔<span class="lbl"> <span data-i18n="ed.verify"></span></span></button>
        <button class="ed-b go" id="edPlayHere" data-i18n-title="ed.playHereTitle" data-i18n-aria="ed.playHereAria">⏵<span class="lbl"> <span data-i18n="ed.playHere"></span></span></button>
        <button class="ed-b go" id="edPlay" data-i18n-title="ed.playTitle" data-i18n-aria="ed.play">▶<span class="lbl"> <span data-i18n="ed.play"></span></span></button>
        <button class="ed-b pr" id="edPractice" data-i18n-title="ed.practiceTitle" data-i18n-aria="ed.practice">◆<span class="lbl"> <span data-i18n="ed.practice"></span></span></button>
      </div>
      <div class="ed-box ed-side" id="edSide">
        <div class="ed-tools">
          <button class="ed-b" data-tool="place" data-i18n-title="ed.tool.placeTitle"><i>✚</i><span data-i18n="ed.tool.place"></span></button>
          <button class="ed-b" data-tool="select" data-i18n-title="ed.tool.selectTitle"><i>☝</i><span data-i18n="ed.tool.select"></span></button>
          <button class="ed-b" data-tool="erase" data-i18n-title="ed.tool.eraseTitle"><i>✖</i><span data-i18n="ed.tool.erase"></span></button>
          <button class="ed-b" data-tool="pan" data-i18n-title="ed.tool.panTitle"><i>✥</i><span data-i18n="ed.tool.pan"></span></button>
        </div>
        <div class="ed-cats" id="edCats" role="tablist"></div>
        <div class="ed-pal" id="edPal"></div>
        <div class="ed-props" id="edProps"></div>
      </div>
      <div class="ed-box ed-status">
        <span id="edPos">x 0 · y 0</span>
        <span class="keys" data-i18n="ed.keys"></span>
        <button class="ed-b" id="edFine" data-i18n-title="ed.fineTitle" data-i18n-aria="ed.fine">½</button>
        <button class="ed-b" id="edFlat" data-i18n-title="ed.flatTitle" data-i18n-aria="ed.flat">3D</button>
        <button class="ed-b" id="edTrigView" data-i18n-title="ed.trigViewTitle" data-i18n-aria="ed.trigView">T</button>
        <button class="ed-b" id="edZoomOut" data-i18n-title="ed.zoomOutTitle" data-i18n-aria="ed.zoomOut">−</button>
        <button class="ed-b" id="edZoomIn" data-i18n-title="ed.zoomInTitle" data-i18n-aria="ed.zoomIn">+</button>
        <button class="ed-b" id="edHome" data-i18n-title="ed.homeTitle" data-i18n-aria="ed.home">⌂</button>
      </div>
    </div>
    <div class="ed-list" id="edList" hidden>
      <div class="panel">
        <h2 data-i18n="ed.myLevels"></h2>
        <div class="ed-cards" id="edCards"></div>
        <div class="row">
          <button class="btn" id="edNew" data-i18n="ed.newLevel"></button>
          <button class="btn purple" id="edImport" data-i18n="ed.import"></button>
          <button class="btn ghost" id="edExit" data-i18n="ed.menu"></button>
        </div>
      </div>
    </div>
    <div class="ed-modal" id="edModal" hidden><div class="panel" id="edModalBody"></div></div>`;
  window.I18N.apply(root);

  let toastTimer = 0, toastEl = null;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'ed-toast'; root.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 1800);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function status() {
    if (!ed.lv) return;
    const h = ed.hover || { x: 0, y: 0 };
    $('edPos').textContent = T('ed.status', { x: Math.floor(h.x), y: Math.floor(h.y), n: ed.lv.objects.length, len: lengthOf(ed.lv), auto: ed.lv.length > 0 ? '' : T('ed.auto') });
    $('edUndo').disabled = !ed.undo.length;
    $('edRedo').disabled = !ed.redo.length;
  }
  function setTool(t) {
    ed.tool = t;
    ed.hoverHit = null;
    root.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    renderSel();
    renderProps();
  }
  function toggleFine() { ed.fine = !ed.fine; $('edFine').classList.toggle('on', ed.fine); }
  function toggleFlat() { ed.flat = !ed.flat; $('edFlat').textContent = ed.flat ? '2D' : '3D'; }
  // Vista previa: el mundo aplica los triggers como si el jugador estuviera en la x del centro de la vista.
  function toggleTrigView() { ed.trigView = !ed.trigView; $('edTrigView').classList.toggle('on', ed.trigView); }

  // Icono SVG de cada objeto de la paleta.
  function icon(it, o) {
    o = o || it.tpl;
    const objC = (ed.lv && ed.lv.colors[0].obj) || '#ff9f3b';
    const svg = (body) => `<svg viewBox="0 0 40 40" aria-hidden="true">${body}</svg>`;
    const st = 'stroke="#fff" stroke-width="1.6" stroke-linejoin="round"';
    if (it.trig) {
      const info = TRIG[it.trig.kind];
      return svg(`<path d="M20 3 V37" stroke="${info.color}" stroke-width="2" opacity=".5"/><rect x="7" y="9" width="26" height="22" rx="5" fill="#0e0b22" stroke="${info.color}" stroke-width="2.4"/><text x="20" y="26" text-anchor="middle" font-size="16" font-weight="900" fill="${info.color}" font-family="Nunito, sans-serif">${info.icon}</text>`);
    }
    if (it.special === 'color') return svg(['#ff5a8a', '#ffd23a', '#3bc8ff', '#7ee83a'].map((c, i) => `<rect x="${6 + i * 7}" y="7" width="7" height="26" fill="${c}"/>`).join('') + `<rect x="6" y="7" width="28" height="26" fill="none" ${st}/>`);
    if (it.deco) {
      const k = it.deco.kind;
      if (k === 'glow') return svg('<circle cx="20" cy="20" r="13" fill="#fff" opacity=".25"/><circle cx="20" cy="20" r="6" fill="#fff" opacity=".8"/>');
      if (k === 'pillar') return svg(`<rect x="14" y="6" width="12" height="30" fill="#2a2160" ${st}/>`);
      if (k === 'ring') return svg('<circle cx="20" cy="20" r="12" fill="none" stroke="#fff" stroke-width="2.5"/>');
      if (k === 'diamond') return svg(`<path d="M20 6 L32 20 L20 34 L8 20 Z" fill="none" ${st}/>`);
      if (k === 'arrow') return svg('<path d="M10 12 L18 20 L10 28 M20 12 L28 20 L20 28" fill="none" stroke="#fff" stroke-width="3"/>');
      return svg('<path d="M5 20 H35" stroke="#fff" stroke-width="3"/>');
    }
    switch (o.t) {
      case 'block': {
        const w = Math.min(3, o.w || 1), h = o.h || 1, s = 26 / Math.max(w, h, 1);
        const W2 = w * s, H2 = h * s;
        return svg(`<rect x="${20 - W2 / 2}" y="${33 - H2}" width="${W2}" height="${H2}" rx="2" fill="#1d1745" stroke="${objC}" stroke-width="2.4"/>`);
      }
      case 'slope': {
        const w = o.w || 1, h = o.h || 1, s = 26 / Math.max(w, h), W2 = w * s, H2 = h * s, x0 = 20 - W2 / 2, y0 = 33;
        let pts = (o.dir || 1) > 0 ? [[0, 0], [W2, 0], [W2, H2]] : [[0, 0], [W2, 0], [0, H2]];
        if (o.ceil) pts = pts.map(([x, y]) => [x, H2 - y]);
        return svg(`<path d="M${pts.map(([x, y]) => `${x0 + x} ${y0 - y}`).join(' L')} Z" fill="#1d1745" stroke="${objC}" stroke-width="2.4" stroke-linejoin="round"/>`);
      }
      case 'spike': {
        const h = o.size === 0.5 ? 13 : 26;
        return svg(`<g transform="rotate(${o.r || 0} 20 20)"><path d="M7 33 L20 ${33 - h} L33 33 Z" fill="#3a1030" stroke="#ff4fa3" stroke-width="2.4" stroke-linejoin="round"/></g>`);
      }
      case 'saw': {
        let d = '';
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 9 : 15; d += (i ? 'L' : 'M') + (20 + Math.cos(a) * r).toFixed(1) + ' ' + (20 + Math.sin(a) * r).toFixed(1); }
        return svg(`<path d="${d}Z" fill="#555a70" stroke="#ff4fa3" stroke-width="1.8"/><circle cx="20" cy="20" r="3.5" fill="#fff"/>`);
      }
      case 'pad': {
        const c = PAD_COLOR[o.kind] || '#ffd23a';
        return svg(`<g transform="${o.r === 180 ? 'rotate(180 20 20)' : ''}"><rect x="6" y="30" width="28" height="4" rx="1.5" fill="#888"/><path d="M9 30 Q20 16 31 30 Z" fill="${c}"/><path d="M14 22 V10 M20 20 V6 M26 22 V10" stroke="${c}" stroke-width="2" opacity=".55"/></g>`);
      }
      case 'orb': {
        const c = PAD_COLOR[o.kind] || '#ffd23a';
        return svg(`<circle cx="20" cy="20" r="14" fill="none" stroke="${o.kind === 'black' ? '#c8beff' : '#fff'}" stroke-width="2"/><circle cx="20" cy="20" r="9" fill="${c}"/>`);
      }
      case 'coin': return svg('<circle cx="20" cy="20" r="13" fill="#ffd23a" stroke="#fff3a8" stroke-width="2"/><path d="M20 12 L22.4 17.6 L28 18 L23.6 21.8 L25 27.4 L20 24.4 L15 27.4 L16.4 21.8 L12 18 L17.6 17.6 Z" fill="#d68a00"/>');
      case 'portal': {
        if (o.kind === 'speed') {
          const c = SPEED_COLOR[o.value] || '#3bc6ff', n = { 0.5: 1, 1: 1, 2: 2, 3: 3, 4: 4 }[o.value] || 1;
          let d = '';
          for (let i = 0; i < n; i++) { const x = 20 + (i - (n - 1) / 2) * 7; d += o.value === 0.5 ? `M${x + 3} 11 L${x - 4} 20 L${x + 3} 29 ` : `M${x - 3} 11 L${x + 4} 20 L${x - 3} 29 `; }
          return svg(`<path d="${d}" fill="none" stroke="${c}" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/>`);
        }
        const c = MODE_COLOR[o.kind] || '#fff';
        const lbl = { cube: '■', ship: '➤', ball: '●', ufo: '◓', wave: '◢', robot: 'R', spider: 'S', swing: '~', flip: '⇅', unflip: '↧', mini: 'm', big: 'M', dual: '2', single: '1' }[o.kind] || '';
        return svg(`<ellipse cx="20" cy="20" rx="9" ry="16" fill="none" stroke="${c}" stroke-width="3"/><text x="20" y="25" text-anchor="middle" font-size="14" font-weight="900" fill="${c}" font-family="Nunito, sans-serif">${lbl}</text>`);
      }
    }
    return svg('');
  }

  function renderPalette() {
    $('edCats').innerHTML = CATS.map((id) => `<button class="${id === ed.cat ? 'on' : ''}" data-cat="${id}" role="tab" aria-selected="${id === ed.cat}">${T('ed.cat.' + id)}</button>`).join('');
    $('edCats').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { ed.cat = b.dataset.cat; renderPalette(); }));
    const items = ITEMS.filter((i) => i.cat === ed.cat);
    $('edPal').innerHTML = items.map((i) => `<button data-item="${i.id}" class="${i.id === ed.item ? 'on' : ''}" title="${esc(i.name)}" aria-label="${esc(i.name)}">${icon(i, i.id === ed.item && ed.place && i.tpl ? ed.place : null)}</button>`).join('');
    $('edPal').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => selectItem(b.dataset.item)));
  }

  function stepper(label, value, id) {
    return `<div class="ed-f"><span>${label}</span><span class="ed-step"><button data-step="${id}" data-d="-1" aria-label="${T('ed.p.less', { label })}">−</button><b>${value}</b><button data-step="${id}" data-d="1" aria-label="${T('ed.p.more', { label })}">+</button></span></div>`;
  }
  const opt = (list, cur, name) => list.map((v) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(name ? name(v) : v)}</option>`).join('');
  // Panel de propiedades: del objeto seleccionado o, si no hay, de lo que se va a colocar.
  function renderProps() {
    const box = $('edProps');
    if (!ed.lv) { box.innerHTML = ''; return; }
    let o = selected(), k = o ? ed.sel.kind : null;
    const isSel = !!o;
    if (!o && ed.tool === 'place') {
      const it = ITEM[ed.item];
      if (it.special === 'color') {
        box.innerHTML = `<h3>${esc(T('item.color'))}</h3><span class="tag">${esc(T('ed.p.colorTag'))}</span>`;
        return;
      }
      o = ed.place; k = it.deco ? 'deco' : it.trig ? 'trig' : 'obj';
    }
    if (!o) {
      const tips = { select: 'ed.p.tipSelect', erase: 'ed.p.tipErase', pan: 'ed.p.tipPan' };
      box.innerHTML = `<span class="tag">${tips[ed.tool] ? T(tips[ed.tool]) : ''}</span>`;
      return;
    }
    let html = '', title = '';
    if (k === 'obj') {
      const it = ITEMS.find((i) => i.tpl && i.tpl.t === o.t && (i.tpl.kind || '') === (o.kind || '') && (o.kind !== 'speed' || i.tpl.value === o.value));
      title = o.t === 'block' ? T('item.block') : o.t === 'slope' ? (o.ceil ? T('item.ceil1') : T('ed.p.slope')) : o.t === 'spike' ? (o.size === 0.5 ? T('item.small') : T('item.spike')) : o.t === 'saw' ? T('item.saw1') : it ? it.name : o.t;
      if (o.t === 'block' || o.t === 'slope') html += stepper(T('ed.p.width'), o.w || 1, 'w') + stepper(T('ed.p.height'), o.h || 1, 'h');
      if (o.t === 'slope') html += `<div class="ed-f"><span>${T('item.ceil1')}</span><input type="checkbox" data-field="ceil" ${o.ceil ? 'checked' : ''}></div>`;
      if (o.t === 'spike') html += `<div class="ed-f"><span>${T('ed.p.small')}</span><input type="checkbox" data-field="small" ${o.size === 0.5 ? 'checked' : ''}></div>`;
      if (o.t === 'saw') html += `<div class="ed-f"><span>${T('ed.p.size')}</span><select data-field="size">${opt([0.5, 1, 1.5, 2, 2.5, 3], o.size || 1)}</select></div>`;
      if (o.t === 'pad') html += `<div class="ed-f"><span>${T('ed.p.type')}</span><select data-field="kind">${opt(PAD_KINDS, o.kind, kindName)}</select></div>`;
      if (o.t === 'orb') html += `<div class="ed-f"><span>${T('ed.p.type')}</span><select data-field="kind">${opt(ORB_KINDS, o.kind, kindName)}</select></div>`;
      if (o.t === 'portal' && o.kind !== 'speed') html += `<div class="ed-f"><span>${T('ed.p.portal')}</span><select data-field="kind">${opt(PORTAL_KINDS, o.kind, portalName)}</select></div>`;
      if (o.t === 'portal' && o.kind === 'speed') html += `<div class="ed-f"><span>${T('ed.p.speed')}</span><select data-field="value">${opt(SPEEDS, o.value, (v) => v + 'x')}</select></div>`;
      if (o.t === 'spike' || o.t === 'pad' || o.t === 'slope') html += `<div class="ed-acts"><button class="ed-b" data-act="rotate">${T('ed.p.rotate')}${o.t === 'spike' ? ' · ' + (o.r || 0) + '°' : ''}</button></div>`;
    } else if (k === 'deco') {
      title = T('item.deco', nl(DECO_KINDS.includes(o.kind) ? decoName(o.kind) : String(o.kind)));
      html += `<div class="ed-f"><span>${T('ed.p.color')}</span><input type="color" data-field="color" value="${o.color || '#ffffff'}"></div>`;
      if (o.kind === 'pillar') html += stepper(T('ed.p.width'), o.w || 1, 'w') + stepper(T('ed.p.height'), o.h || 6, 'h');
      else if (o.kind === 'line') html += stepper(T('ed.p.length'), o.w || 6, 'w');
      else if (o.kind !== 'arrow') html += stepper(T('ed.p.size'), o.r || (o.kind === 'glow' || o.kind === 'ring' ? 2 : 1), 'r');
      html += `<div class="ed-f"><span>${T('ed.p.layer')}</span><select data-field="layer"><option value="bg" ${o.layer !== 'fg' ? 'selected' : ''}>${T('ed.p.back')}</option><option value="fg" ${o.layer === 'fg' ? 'selected' : ''}>${T('ed.p.front')}</option></select></div>`;
    } else if (k === 'color') {
      title = T('ed.p.colorAt', { x: o.x });
      for (const [f, n] of [['bg', 'bg'], ['ground', 'ground'], ['obj', 'blocks'], ['line', 'line']]) {
        html += `<div class="ed-f"><span>${T('ed.p.' + n)}</span><input type="color" data-field="${f}" value="${o[f] || '#ffffff'}"></div>`;
      }
      html += stepper(T('ed.p.fade'), o.fade != null ? o.fade : 8, 'fade');
    } else if (k === 'trig') {
      title = T('item.trig', nl(TRIG[o.kind] ? trigName(o.kind) : String(o.kind)));
      for (const [f, lbl, type, mn, mx, st] of TRIG_FIELDS[o.kind] || []) {
        const label = T('ed.f.' + lbl);
        if (type === 'ease') html += `<div class="ed-f"><span>${label}</span><select data-tfield="${f}" data-type="ease">${EASES.map((v) => `<option value="${v}" ${(o.ease || 'inout') === v ? 'selected' : ''}>${T('ease.' + v)}</option>`).join('')}</select></div>`;
        else if (type === 'bool') html += `<div class="ed-f"><span>${label}</span><input type="checkbox" data-tfield="${f}" data-type="bool" ${o[f] !== false ? 'checked' : ''}></div>`;
        else if (type === 'color') html += `<div class="ed-f"><span>${label}</span><input type="color" data-tfield="${f}" data-type="color" value="${HEX.test(o[f]) ? o[f] : '#ffffff'}"></div>`;
        else if (type === 'target') html += `<div class="ed-f"><span>${label}</span><input type="text" maxlength="20" data-tfield="${f}" data-type="target" value="${esc(o[f] != null ? o[f] : '')}"></div>`;
        else if (type === 'center') {
          const has = typeof o.cx === 'number';
          html += `<div class="ed-f"><span>${label}</span><input type="checkbox" data-tfield="center" data-type="center" ${has ? 'checked' : ''}></div>`;
          if (has) html += `<div class="ed-f"><span>${T('ed.p.centerX')}</span><input type="number" step="0.5" data-tfield="cx" data-type="num" data-min="-10" data-max="20000" value="${o.cx}"></div><div class="ed-f"><span>${T('ed.p.centerY')}</span><input type="number" step="0.5" data-tfield="cy" data-type="num" data-min="-10" data-max="60" value="${o.cy}"></div>`;
        } else html += `<div class="ed-f"><span>${label}</span><input type="number" data-tfield="${f}" data-type="${type}" data-min="${mn}" data-max="${mx}" step="${type === 'int' ? 1 : st || 0.5}" value="${o[f] != null ? o[f] : ''}"></div>`;
      }
      html += `<div class="ed-f"><span>${T('ed.p.spawnOnly')}</span><input type="checkbox" data-tfield="spawnOnly" data-type="spawnOnly" ${o.spawnOnly ? 'checked' : ''}></div>`;
      html += `<div class="ed-f"><span>${T('ed.p.id')}</span><input type="text" maxlength="20" data-tfield="id" data-type="id" value="${esc(o.id != null ? o.id : '')}" placeholder="${esc(T('ed.p.optional'))}"></div>`;
      html += `<span class="tag">${esc(T('ed.p.trigTag'))}</span>`;
    }
    if (k === 'obj' || k === 'deco') {
      const gs = Sim.groupsOf(o);
      html += `<div class="ed-f"><span>${T('ed.p.group')}</span><input type="text" maxlength="30" data-gfield="1" value="${gs ? gs.join(', ') : ''}" placeholder="${esc(T('ed.p.groupPh'))}"></div>`;
    }
    if (isSel) {
      html += `<div class="ed-acts">${k !== 'color' ? `<button class="ed-b" data-act="dup" title="Ctrl+D">${T('ed.p.dup')}</button>` : ''}<button class="ed-b danger" data-act="delete" title="${T('ed.p.delKey')}">${T('ed.p.del')}</button></div>`;
      html += `<span class="tag">x ${o.x}${o.y != null && k !== 'trig' ? ' · y ' + o.y : ''}</span>`;
    } else html += `<span class="tag">${T(k === 'trig' ? 'ed.p.placeTrig' : 'ed.p.place')}</span>`;
    box.innerHTML = `<h3>${esc(title)}</h3>${html}`;
    const edit = (fn) => {
      if (isSel) pushUndo();
      fn();
      if (isSel) changed(); else renderPalette();
      renderProps();
    };
    box.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => edit(() => {
      const f = b.dataset.step, d = Number(b.dataset.d);
      const def = { w: k === 'deco' && o.kind === 'line' ? 6 : 1, h: k === 'deco' ? 6 : 1, r: o.kind === 'glow' || o.kind === 'ring' ? 2 : 1, fade: 8 }[f];
      const cur = o[f] != null ? o[f] : def;
      const stepv = f === 'fade' ? 2 : f === 'r' ? 0.5 : (o.t === 'block' && f === 'h' && (cur < 1 || (cur === 1 && d < 0))) ? 0.5 : 1;
      const minv = f === 'fade' ? 0 : 0.5;
      o[f] = Math.max(minv, Math.min(f === 'fade' ? 40 : 60, cur + d * stepv));
      if (o.t === 'slope' && o[f] < 1) o[f] = 1;
    })));
    box.querySelectorAll('[data-field]').forEach((el) => el.addEventListener(el.type === 'color' ? 'input' : 'change', () => {
      const f = el.dataset.field;
      const apply = () => {
        if (f === 'ceil') { if (el.checked) o.ceil = true; else delete o.ceil; }
        else if (f === 'small') { if (el.checked) o.size = 0.5; else delete o.size; }
        else if (f === 'size' || f === 'value') o[f] = Number(el.value);
        else if (f === 'layer') { if (el.value === 'fg') o.layer = 'fg'; else delete o.layer; }
        else o[f] = el.value;
      };
      if (el.type === 'color') { // el selector de color manda muchos cambios: una sola entrada de deshacer
        if (isSel && !el.dataset.pushed) { pushUndo(); el.dataset.pushed = '1'; }
        apply();
        if (isSel) changed();
        return;
      }
      edit(apply);
    }));
    box.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'delete') removeSel();
      else if (a === 'rotate') rotate();
      else if (a === 'dup') duplicateSel();
    }));
    // campos de los triggers
    box.querySelectorAll('[data-tfield]').forEach((el) => el.addEventListener(el.type === 'color' ? 'input' : 'change', () => {
      const f = el.dataset.tfield, type = el.dataset.type;
      const apply = () => {
        if (type === 'num' || type === 'int') {
          let v = Number(el.value);
          if (el.value === '' || !isFinite(v)) return;
          if (type === 'int') v = Math.round(v);
          v = Math.max(Number(el.dataset.min), Math.min(Number(el.dataset.max), v));
          o[f] = v;
          if (f === 'group' || f === 'follower') ed.lastGroup = v;
        } else if (type === 'ease') o.ease = el.value;
        else if (type === 'bool') o[f] = el.checked;
        else if (type === 'color') o[f] = el.value;
        else if (type === 'center') {
          if (el.checked) {
            // centro inicial: el de los objetos del grupo (o la x del trigger)
            const bs = ed.lv.objects.filter((ob) => (Sim.groupsOf(ob) || []).includes(o.group)).map(boxOf);
            o.cx = bs.length ? Math.round((Math.min(...bs.map((b) => b[0])) + Math.max(...bs.map((b) => b[2]))) ) / 2 : o.x;
            o.cy = bs.length ? Math.round((Math.min(...bs.map((b) => b[1])) + Math.max(...bs.map((b) => b[3]))) ) / 2 : 3;
          } else { delete o.cx; delete o.cy; }
        } else if (type === 'spawnOnly') { if (el.checked) o.spawnOnly = true; else delete o.spawnOnly; }
        else if (type === 'id') { const v = el.value.trim(); if (TRIG_ID.test(v)) o.id = v; else delete o.id; }
        else if (type === 'target') { const v = el.value.trim(); if (/^\d{1,3}$/.test(v)) o.target = Number(v); else if (TRIG_ID.test(v)) o.target = v; }
      };
      if (el.type === 'color') {
        if (isSel && !el.dataset.pushed) { pushUndo(); el.dataset.pushed = '1'; }
        apply();
        if (isSel) changed();
        return;
      }
      edit(apply);
      renderSel();
    }));
    // grupo(s) de un objeto o decorado: "1" o "1, 3"
    box.querySelectorAll('[data-gfield]').forEach((el) => el.addEventListener('change', () => {
      edit(() => {
        const gs = Array.from(new Set((el.value.match(/\d+/g) || []).map(Number).filter((v) => v >= 1 && v <= 999))).slice(0, 8);
        delete o.group; delete o.groups;
        if (gs.length) { o.group = gs[0]; ed.lastGroup = gs[0]; }
        if (gs.length > 1) o.groups = gs;
      });
      renderSel();
    }));
  }

  // ------------------------------------------------------------ ventanas
  function modal(html, bind) {
    $('edModalBody').innerHTML = html;
    $('edModal').hidden = false;
    if (bind) bind($('edModalBody'));
    const first = $('edModalBody').querySelector('textarea, input, select, button');
    if (first) first.focus();
  }
  function closeModal() {
    if ($('edModal').hidden) return;
    $('edModal').hidden = true;
    $('edModalBody').innerHTML = '';
    if (ed.lv) { renderProps(); status(); }
  }
  $('edModal').addEventListener('pointerdown', (e) => { if (e.target === $('edModal')) closeModal(); });

  function settingsModal() {
    const lv = ed.lv;
    const c0 = lv.colors[0];
    const before = snapshot();
    pushUndo(); // todo lo que se cambie en esta ventana se deshace de una vez
    modal(`
      <h2>${T('ed.s.title')}</h2>
      <div class="ed-f"><label for="stName">${T('ed.s.name')}</label><input type="text" id="stName" maxlength="40"></div>
      <div class="ed-f"><label for="stSong">${T('ed.s.music')}</label><select id="stSong">${SONGS.map((id) => `<option value="${id}" ${id === lv.song ? 'selected' : ''}>${esc(songName(id))}</option>`).join('')}</select></div>
      <div class="ed-f"><label for="stBpm">${T('ed.s.bpm')}</label><input type="number" id="stBpm" min="40" max="300" step="0.01" value="${lv.bpm}"></div>
      <div class="ed-f"><label for="stMode">${T('ed.s.mode')}</label><select id="stMode">${opt(MODES, lv.startMode, modeName)}</select></div>
      <div class="ed-f"><label for="stSpeed">${T('ed.s.speed')}</label><select id="stSpeed">${opt(SPEEDS, lv.startSpeed, (v) => v + 'x')}</select></div>
      <div class="ed-f"><label for="stLen">${T('ed.s.length')}</label><input type="number" id="stLen" min="0" max="20000" step="1" value="${lv.length || 0}"></div>
      <p id="stLenInfo"></p>
      <div class="ed-f"><label for="stTheme">${T('ed.s.theme')}</label><select id="stTheme">${window.ND3D.World.THEMES.map((t) => `<option value="${t}" ${t === (lv.theme3d || 'ciudad') ? 'selected' : ''}>${window.ND3D.World.THEME_NAMES[t]}</option>`).join('')}</select></div>
      <div class="ed-f"><label for="stBg">${T('ed.s.bg')}</label><input type="color" id="stBg" value="${c0.bg}"></div>
      <div class="ed-f"><label for="stGround">${T('ed.s.ground')}</label><input type="color" id="stGround" value="${c0.ground}"></div>
      <div class="ed-f"><label for="stLine">${T('ed.s.line')}</label><input type="color" id="stLine" value="${c0.line || '#ffffff'}"></div>
      <div class="ed-f"><label for="stObj">${T('ed.s.obj')}</label><input type="color" id="stObj" value="${c0.obj || '#ff9f3b'}"></div>
      <p>${esc(T('ed.s.colorsNote'))}</p>
      <div class="row"><button class="btn" id="stDone">${T('ed.s.done')}</button></div>`, (r) => {
      r.querySelector('#stName').value = lv.name;
      const info = () => { r.querySelector('#stLenInfo').textContent = T('ed.s.lenNow', { n: lengthOf(lv), auto: lv.length > 0 ? '' : T('ed.s.lenAuto') }); };
      const upd = () => { changed(); info(); };
      info();
      r.querySelector('#stName').addEventListener('input', (e) => { lv.name = e.target.value.slice(0, 40) || T('ed.n.untitled'); $('edName').value = lv.name; upd(); });
      r.querySelector('#stSong').addEventListener('change', (e) => { lv.song = e.target.value; if (lv.song.startsWith('track:')) Sound.loadTrack(lv.song); lv.bpm = SONG_BPM[lv.song]; r.querySelector('#stBpm').value = lv.bpm; upd(); });
      r.querySelector('#stBpm').addEventListener('change', (e) => { const v = Number(e.target.value); if (v >= 40 && v <= 300) lv.bpm = v; else e.target.value = lv.bpm; upd(); });
      r.querySelector('#stTheme').addEventListener('change', (e) => { lv.theme3d = e.target.value; upd(); });
      r.querySelector('#stMode').addEventListener('change', (e) => { lv.startMode = e.target.value; upd(); });
      r.querySelector('#stSpeed').addEventListener('change', (e) => { lv.startSpeed = Number(e.target.value); upd(); });
      r.querySelector('#stLen').addEventListener('change', (e) => { const v = Math.round(Number(e.target.value)); lv.length = v > 0 ? Math.min(20000, Math.max(10, v)) : 0; e.target.value = lv.length; upd(); });
      for (const [id, f] of [['stBg', 'bg'], ['stGround', 'ground'], ['stObj', 'obj'], ['stLine', 'line']]) {
        r.querySelector('#' + id).addEventListener('input', (e) => { c0[f] = e.target.value; upd(); });
      }
      r.querySelector('#stDone').addEventListener('click', () => {
        if (snapshot() === before) ed.undo.pop(); // sin cambios: no deja una entrada vacía
        closeModal(); renderPalette();
      });
    });
  }

  function clearModal() {
    modal(`<h2>${T('ed.c.title')}</h2><p>${T('ed.c.text')}</p>
      <div class="row"><button class="btn orange" id="clYes">${T('ed.c.yes')}</button><button class="btn ghost" id="clNo">${T('ed.cancel')}</button></div>`, (r) => {
      r.querySelector('#clYes').addEventListener('click', () => {
        pushUndo();
        ed.lv.objects = []; ed.lv.decos = []; ed.lv.triggers = []; ed.lv.colors = [ed.lv.colors[0]];
        ed.sel = null;
        changed(); closeModal();
      });
      r.querySelector('#clNo').addEventListener('click', closeModal);
    });
  }

  // ------------------------------------------------------------ compartir (formato ND1. de Neon Dash)
  function encode(lv) {
    const def = toDef(lv);
    const data = { v: 1, name: lv.name, theme: 'original', song: lv.song, bpm: lv.bpm, startMode: lv.startMode, startSpeed: lv.startSpeed, theme3d: lv.theme3d || 'ciudad',
      objects: def.objects, decos: def.decos, colors: def.colors };
    if ((lv.triggers || []).length) data.triggers = lv.triggers.map((t) => Object.assign({}, t));
    if (lv.length > 0) data.length = lv.length;
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return 'ND1.' + btoa(bin);
  }
  const HEX = /^#[0-9a-fA-F]{6}$/;
  function decode(code) {
    code = String(code || '').trim();
    if (code.length > 2000000) throw new Error(T('ed.err.long'));
    if (!code.startsWith('ND1.')) throw new Error(T('ed.err.prefix'));
    let data;
    try {
      const bin = atob(code.slice(4).replace(/\s+/g, ''));
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      data = JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) { throw new Error(T('ed.err.broken')); }
    return sanitize(data);
  }
  // Grupos de un objeto importado: enteros 1..999 (como mucho 8).
  function cleanGroups(o, c) {
    const gs = [];
    for (const v of [o.group].concat(Array.isArray(o.groups) ? o.groups.slice(0, 8) : [])) if (Number.isInteger(v) && v >= 1 && v <= 999 && !gs.includes(v)) gs.push(v);
    if (gs.length) c.group = gs[0];
    if (gs.length > 1) c.groups = gs;
  }
  // Triggers importados: sólo los tipos conocidos y sus campos, con números en rango.
  function cleanTriggers(list) {
    const out = [];
    for (const t of Array.isArray(list) ? list.slice(0, 1000) : []) {
      if (!t || !TRIG[t.kind] || !num(t.x, 0, 20000)) continue;
      const c = { kind: t.kind, x: t.x, y: num(t.y, -2, 60) ? t.y : 9 };
      for (const [f, , type, mn, mx] of TRIG_FIELDS[t.kind]) {
        const v = t[f];
        if (type === 'int') c[f] = Number.isInteger(v) && v >= mn && v <= mx ? v : TRIG[t.kind].tpl[f];
        else if (type === 'num') c[f] = num(v, mn, mx) ? v : TRIG[t.kind].tpl[f];
        else if (type === 'ease') { if (EASES.includes(v)) c.ease = v; }
        else if (type === 'bool') c[f] = v !== false;
        else if (type === 'color') c[f] = HEX.test(v) ? v : '#ffffff';
        else if (type === 'target') c[f] = Number.isInteger(v) && v >= 0 && v <= 999 ? v : typeof v === 'string' && TRIG_ID.test(v) ? v : 1;
        else if (type === 'center') { if (num(t.cx, -10, 20000) && num(t.cy, -10, 60)) { c.cx = t.cx; c.cy = t.cy; } }
      }
      if (t.spawnOnly === true) c.spawnOnly = true;
      if (typeof t.id === 'string' && TRIG_ID.test(t.id)) c.id = t.id;
      out.push(c);
    }
    return out;
  }
  // Valida campo a campo: tipos conocidos y números en rango. Nada se evalúa.
  function sanitize(d) {
    if (!d || typeof d !== 'object') throw new Error(T('ed.err.empty'));
    const lv = newLevel();
    lv.name = typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 40) : T('ed.n.imported');
    if (SONG_BPM[d.song]) lv.song = d.song;
    lv.bpm = num(d.bpm, 40, 300) ? d.bpm : SONG_BPM[lv.song];
    if (MODES.includes(d.startMode)) lv.startMode = d.startMode;
    if (SPEEDS.includes(d.startSpeed)) lv.startSpeed = d.startSpeed;
    if (num(d.length, 10, 20000)) lv.length = Math.round(d.length);
    if (window.ND3D.World.THEMES.includes(d.theme3d)) lv.theme3d = d.theme3d;
    const objs = Array.isArray(d.objects) ? d.objects : [];
    if (objs.length > 6000) throw new Error(T('ed.err.tooMany'));
    const KIND = { pad: PAD_KINDS, orb: ORB_KINDS, portal: PORTAL_KINDS.concat('speed') };
    lv.objects = [];
    for (const o of objs) {
      if (!o || typeof o !== 'object' || !num(o.x, 0, 20000) || !num(o.y, -2, 60)) continue;
      const c = { t: o.t, x: o.x, y: o.y };
      if (o.t === 'block' || o.t === 'slope') {
        c.w = num(o.w, 0.5, 200) ? o.w : 1;
        c.h = num(o.h, 0.5, 60) ? o.h : 1;
        if (o.t === 'slope') { c.dir = o.dir === -1 ? -1 : 1; if (o.ceil === true) c.ceil = true; }
      } else if (o.t === 'spike') {
        c.r = [0, 90, 180, 270].includes(o.r) ? o.r : 0;
        if (o.size === 0.5) c.size = 0.5;
      } else if (o.t === 'saw') {
        c.size = num(o.size, 0.5, 4) ? o.size : 1;
      } else if (KIND[o.t]) {
        if (!KIND[o.t].includes(o.kind)) continue;
        c.kind = o.kind;
        if (o.t === 'pad') c.r = o.r === 180 ? 180 : 0;
        if (o.kind === 'speed') { if (!SPEEDS.includes(o.value)) continue; c.value = o.value; }
        if (o.t === 'portal' && num(o.floor, 0, 50)) c.floor = o.floor;
        if (o.t === 'portal' && [90, 180, 270].includes(o.r)) c.r = o.r;
      } else if (o.t !== 'coin') continue;
      cleanGroups(o, c);
      lv.objects.push(c);
    }
    const decos = Array.isArray(d.decos) ? d.decos.slice(0, 2000) : [];
    lv.decos = [];
    for (const o of decos) {
      if (!o || !DECO_KINDS.includes(o.kind) || !num(o.x, -10, 20000) || !num(o.y, -10, 60)) continue;
      const c = { kind: o.kind, x: o.x, y: o.y, color: HEX.test(o.color) ? o.color : '#ffffff' };
      for (const f of ['w', 'h', 'r']) if (num(o[f], 0.1, 60)) c[f] = o[f];
      if (num(o.par, 0, 1)) c.par = o.par;
      if (num(o.alpha, 0, 1)) c.alpha = o.alpha;
      if (o.layer === 'fg') c.layer = 'fg';
      if (o.beat === true) c.beat = true;
      cleanGroups(o, c);
      lv.decos.push(c);
    }
    lv.triggers = cleanTriggers(d.triggers);
    const cols = Array.isArray(d.colors) ? d.colors.slice(0, 200) : [];
    const good = cols.filter((c) => c && num(c.x, 0, 20000) && HEX.test(c.bg) && HEX.test(c.ground)).map((c) => {
      const o = { x: c.x, bg: c.bg, ground: c.ground };
      if (HEX.test(c.line)) o.line = c.line;
      if (HEX.test(c.obj)) o.obj = c.obj;
      if (num(c.fade, 0, 40)) o.fade = c.fade;
      return o;
    }).sort((a, b) => a.x - b.x);
    if (good.length && good[0].x === 0) lv.colors = good;
    else lv.colors = [lv.colors[0]].concat(good.filter((c) => c.x > 0));
    return lv;
  }

  function shareModal(lv) {
    const code = encode(lv);
    modal(`<h2>${T('ed.sh.title')}</h2>
      <p>${T('ed.sh.text', { name: esc(lv.name) })}</p>
      <textarea id="shCode" readonly aria-label="${T('ed.code')}"></textarea>
      <p id="shMsg">${(code.length / 1024).toFixed(1)} KB</p>
      <div class="row"><button class="btn" id="shCopy">${T('ed.sh.copy')}</button><button class="btn ghost" id="shClose">${T('ed.close')}</button></div>`, (r) => {
      const ta = r.querySelector('#shCode');
      ta.value = code;
      r.querySelector('#shCopy').addEventListener('click', () => {
        const ok = () => { r.querySelector('#shMsg').textContent = T('ed.sh.copied'); };
        const fallback = () => { ta.focus(); ta.select(); r.querySelector('#shMsg').textContent = T('ed.sh.selected'); };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(ok, fallback);
          else fallback();
        } catch (e) { fallback(); }
      });
      r.querySelector('#shClose').addEventListener('click', closeModal);
    });
  }
  function importModal(text) {
    modal(`<h2>${T('ed.im.title')}</h2>
      <p>${T('ed.im.text')}</p>
      <textarea id="imCode" aria-label="${T('ed.code')}" placeholder="ND1.eyJ2Ij..."></textarea>
      <p class="err" id="imErr"></p>
      <div class="row"><button class="btn" id="imGo">${T('ed.im.go')}</button><button class="btn ghost" id="imClose">${T('ed.cancel')}</button></div>`, (r) => {
      const ta = r.querySelector('#imCode');
      if (text) ta.value = text;
      ta.addEventListener('input', () => { r.querySelector('#imErr').textContent = ''; });
      r.querySelector('#imGo').addEventListener('click', () => {
        try {
          const lv = decode(ta.value);
          levels.unshift(lv);
          persistLevels();
          closeModal();
          renderList();
          toast(T('ed.t.imported', { name: lv.name }));
        } catch (e) { r.querySelector('#imErr').textContent = e.message; }
      });
      r.querySelector('#imClose').addEventListener('click', closeModal);
    });
  }

  // ------------------------------------------------------------ Mis niveles
  function renderList() {
    const list = $('edCards');
    if (!levels.length) {
      list.innerHTML = `<p class="ed-empty">${esc(T('ed.l.empty'))}</p>`;
      return;
    }
    list.innerHTML = levels.map((lv, i) => {
      const sp = Sim.SPEEDS[lv.startSpeed || 1] || Sim.SPEEDS[1];
      const secs = Math.round(lengthOf(lv) * B / sp.ups);
      const modes = new Set([lv.startMode]);
      for (const o of lv.objects) if (o.t === 'portal' && MODES.includes(o.kind)) modes.add(o.kind);
      return `<div class="ed-card" data-i="${i}">
        <h3>${esc(lv.name)}</h3>
        <div class="info">${T('ed.l.info', { n: lv.objects.length, s: secs, modes: Array.from(modes).map((m) => (MODES.includes(m) ? modeName(m) : esc(m))).join(', ') })}</div>
        <div class="ed-acts" data-row>
          <button class="ed-b go" data-a="edit">${T('ed.l.edit')}</button>
          <button class="ed-b pr" data-a="play">${T('ed.l.play')}</button>
          <button class="ed-b" data-a="dup">${T('ed.l.dup')}</button>
          <button class="ed-b" data-a="share">${T('ed.l.share')}</button>
          <button class="ed-b danger" data-a="del" aria-label="${T('ed.l.delAria', { name: esc(lv.name) })}">🗑</button>
        </div>
      </div>`;
    }).join('');
    list.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.closest('[data-i]').dataset.i);
      const lv = levels[i];
      const a = b.dataset.a;
      ND.click();
      if (a === 'edit') openEditor(lv);
      else if (a === 'play') { openEditor(lv); testPlay(false); }
      else if (a === 'share') shareModal(lv);
      else if (a === 'dup') {
        const c = JSON.parse(JSON.stringify(lv));
        c.id = uid(); c.name = T('ed.n.copy', { name: lv.name }).slice(0, 40); c.created = c.updated = Date.now();
        delete c.cam;
        levels.splice(i + 1, 0, c);
        persistLevels(); renderList();
      } else if (a === 'del') {
        // Confirmación dentro de la propia tarjeta.
        const row = b.closest('[data-row]');
        row.innerHTML = `<span class="tag" style="font-weight:900">${T('ed.l.delAsk', { name: esc(lv.name) })}</span><button class="ed-b danger" data-c="yes">${T('ed.l.delYes')}</button><button class="ed-b" data-c="no">${T('ed.l.delNo')}</button>`;
        row.querySelector('[data-c="yes"]').addEventListener('click', () => { levels.splice(i, 1); persistLevels(); renderList(); });
        row.querySelector('[data-c="no"]').addEventListener('click', renderList);
      }
    }));
  }
  function showList() {
    if (ed.lv) { ed.lv.cam = Object.assign({}, ed.cam); clearTimeout(ed.saveTimer); persistLevels(); }
    ed.lv = null;
    ed.sel = null;
    levels = load();
    closeModal();
    ND.showScreen('editor');
    $('edUi').hidden = true;
    $('edList').hidden = false;
    renderList();
  }

  function openEditor(lv) {
    ed.lv = lv;
    if (lv.song && lv.song.startsWith('track:')) Sound.loadTrack(lv.song);
    lv.decos = lv.decos || [];
    lv.triggers = lv.triggers || [];
    for (const t of lv.triggers) if (typeof t.y !== 'number') t.y = 9;
    ed.sel = null; ed.hoverHit = null; ed.hover = null;
    ed.undo.length = 0; ed.redo.length = 0;
    ed.builtLen = -1;
    closeModal();
    ND.showScreen('editor');
    $('edList').hidden = true;
    $('edUi').hidden = false;
    $('edName').value = lv.name;
    if (!ed.place) ed.place = Object.assign({}, ITEM[ed.item].tpl);
    renderPalette();
    setTool(ed.tool);
    if (lv.cam && num(lv.cam.x, -50, 30000) && num(lv.cam.y, -50, 100) && num(lv.cam.h, 5, 40)) Object.assign(ed.cam, lv.cam); else homeCam();
    rebuild();
    status();
  }
  // Lo llama game.js al salir de una prueba: vuelve al mismo sitio del editor.
  function open() {
    if (ed.lv) {
      ND.showScreen('editor');
      $('edList').hidden = true;
      $('edUi').hidden = false;
      rebuild();
      renderProps();
      status();
      return;
    }
    showList();
  }
  function testPlay(practice, here) {
    if (!ed.lv) return;
    ed.lv.cam = Object.assign({}, ed.cam);
    clearTimeout(ed.saveTimer);
    persistLevels();
    closeModal();
    ed.drag = null; ed.pointers.clear(); ed.pinch = null; ed.stroke = null;
    ND.unlockAudio();
    ND.click();
    // desde aquí: unos bloques antes del centro de la vista
    ND.startCustom(toDef(ed.lv), !!practice, here ? { x: Math.max(0, Math.floor(ed.cam.x - 4)) } : null);
  }

  // Verificar: el bot de Neon Dash busca una ruta ganadora en un Web Worker (con la física y el bot del juego,
  // importados como texto al principio del archivo). Cambia la entrada como mucho cada 6 ticks (unas 40 veces por segundo).
  function verify() {
    if (!ed.lv) return;
    const def = toDef(ed.lv);
    if (!def.objects.length) { toast(T('ed.t.empty')); return; }
    const src = SIM_SRC + '\n' + SOLVER_SRC + `
      onmessage = (e) => {
        const L = Sim.compileLevel(e.data.def);
        const r = Solver.solve(L, 6, 3000, null, null, { maxSteps: 60000, onProgress(x) { postMessage({ progress: x / L.endX }); } });
        let taps = 0;
        if (r.ok) { let held = false; const st = []; for (let h = r.hist; h; h = h.p) st.push(h); for (let i = st.length - 1; i >= 0; i--) { if (st[i].w && !held) taps++; held = st[i].w; } }
        postMessage({ done: true, ok: r.ok, furthest: r.furthest, end: L.endX, cause: r.cause, timeout: !!r.timeout, taps });
      };`;
    const worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    // causa del choque: ed.v.c.<causa> (src/i18n.js)
    const CAUSE = ['spike', 'saw', 'block', 'slope', 'out', 'tiempo'];
    modal(`<h2>${T('ed.v.title')}</h2><p id="vfMsg">${T('ed.v.searching')}</p>
      <div class="bar"><div class="track"><div class="fill" id="vfBar" style="width:0%"></div></div></div>
      <div class="row"><button class="btn ghost small" id="vfClose">${T('ed.close')}</button></div>`, (b) => {
      b.querySelector('#vfClose').addEventListener('click', () => { worker.terminate(); closeModal(); });
    });
    worker.onmessage = (e) => {
      const d = e.data, msg = $('vfMsg'), bar = $('vfBar');
      if (!msg) { worker.terminate(); return; }
      if (d.progress != null) { bar.style.width = Math.min(100, Math.round(d.progress * 100)) + '%'; return; }
      worker.terminate();
      if (d.ok) {
        bar.style.width = '100%';
        msg.textContent = T('ed.v.ok', { n: d.taps });
      } else {
        const pct = Math.max(0, Math.min(100, Math.round(d.furthest / d.end * 100)));
        msg.textContent = d.timeout ? T('ed.v.timeout', { pct })
          : T('ed.v.fail', { pct, cause: T('ed.v.c.' + (CAUSE.includes(d.cause) ? d.cause : 'other')) });
        if (!d.timeout) { ed.cam.x = Math.max(4, d.furthest / B); }
      }
    };
    worker.onerror = (e) => { const msg = $('vfMsg'); if (msg) msg.textContent = T('ed.v.error', { msg: e.message || 'error' }); worker.terminate(); };
    worker.postMessage({ def });
  }
  function exitToMenu() {
    ed.lv = null;
    helpers.visible = false;
    ND.previewLevel(game.sel || 0); // el mundo vuelve a mostrar el nivel del menú
    ND.backToMenu();
  }

  // Vista del editor para World.frame: la cámara la pone applyCam(); aquí van el jugador en el inicio y los colores.
  function view(dt) {
    if (!ed.lv) {
      ed.listT += dt;
      const x = ed.listT * 2.5 * B;
      return { x, y: 0, visible: false, camX: x, camY: 4.2 * B, beat: 0, colorsX: x, menu: true, lo: 0, hi: Infinity };
    }
    if (ed.dirty && performance.now() - ed.lastBuild > 60) rebuild();
    updateGhost();
    const HALF = (Sim.P && Sim.P.HALF) || 15;
    return {
      x: 0, y: HALF, rot: 0, mode: ed.lv.startMode, mini: false, flip: 1, dead: false, visible: true,
      camX: ed.cam.x * B, camY: ed.cam.y * B, beat: 0, colorsX: ed.cam.x * B, used: {}, trail: null, lo: 0, hi: Infinity,
      gsX: ed.trigView ? ed.cam.x * B : null,
    };
  }

  // ------------------------------------------------------------ eventos
  const withClick = (fn) => () => { ND.click(); fn(); };
  $('editorBtn').addEventListener('click', () => { ND.unlockAudio(); ND.click(); open(); });
  $('edBack').addEventListener('click', withClick(showList));
  $('edExit').addEventListener('click', withClick(exitToMenu));
  $('edNew').addEventListener('click', withClick(() => { const lv = newLevel(); levels.unshift(lv); persistLevels(); openEditor(lv); }));
  $('edImport').addEventListener('click', withClick(() => importModal()));
  $('edName').addEventListener('input', (e) => { ed.lv.name = e.target.value.slice(0, 40) || T('ed.n.untitled'); changed(); });
  $('edUndo').addEventListener('click', undo);
  $('edRedo').addEventListener('click', redo);
  $('edSettings').addEventListener('click', withClick(settingsModal));
  $('edShare').addEventListener('click', withClick(() => shareModal(ed.lv)));
  $('edClear').addEventListener('click', withClick(clearModal));
  $('edPlay').addEventListener('click', () => testPlay(false));
  $('edPlayHere').addEventListener('click', () => testPlay(false, true));
  $('edVerify').addEventListener('click', () => verify());
  $('edPractice').addEventListener('click', () => testPlay(true));
  $('edFine').addEventListener('click', toggleFine);
  $('edFlat').addEventListener('click', toggleFlat);
  $('edTrigView').addEventListener('click', toggleTrigView);
  $('edZoomIn').addEventListener('click', () => zoomAt(innerWidth / 2, innerHeight / 2, 1.25));
  $('edZoomOut').addEventListener('click', () => zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.25));
  $('edHome').addEventListener('click', homeCam);
  root.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => { ed.sel = null; setTool(b.dataset.tool); }));
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', () => { if (!ed.drag) { ed.hover = null; ed.hoverHit = null; if (ed.lv) renderSel(); } });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => { if (game.screen === 'editor') e.preventDefault(); });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') ed.spaceHeld = false; });
  window.addEventListener('blur', () => { ed.spaceHeld = false; });
  // Pegar un código en la lista de niveles abre la importación ya rellena.
  window.addEventListener('paste', (e) => {
    if (game.screen !== 'editor' || ed.lv || !$('edModal').hidden) return;
    const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
    if (text.trim().startsWith('ND1.')) importModal(text.trim());
  });

  // Cambio de idioma (Ajustes de la pausa mientras se prueba un nivel): textos fijos y lo que esté a la vista.
  window.addEventListener('langchange', () => {
    window.I18N.apply(root);
    renderPalette();
    if (ed.lv) { renderProps(); status(); } else if (!$('edList').hidden) renderList();
  });

  ND.editor = { open, view, encode, decode, sanitize, toDef, _ed: ed };
}

if (window.ND3D && window.ND3D.World) boot();
else window.addEventListener('nd3d-ready', boot);
