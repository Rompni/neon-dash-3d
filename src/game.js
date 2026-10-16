/*
 * NEON DASH 3D — bucle, entrada, cámara, menús y guardado.
 * La física corre a 240 Hz con paso fijo (como en Neon Dash) y el dibujo interpola entre ticks.
 */
const B = Sim.BLOCK, TPS = Sim.TPS, TICK_MS = 1000 / TPS;
const VIEW_H = 320; // alto de referencia para la cámara, en unidades de la física (≈10.7 bloques)
const MODE_NAME = { cube: 'cubo', ship: 'nave', ball: 'bola', ufo: 'ovni', wave: 'onda', robot: 'robot', spider: 'araña', swing: 'swing' };
// Garaje: diseños por modo (nodo del GLB) y su precio en monedas. El primero de cada modo es gratis.
// 12 estilos (columnas de la hoja de iconos). Cada uno se desbloquea para todos los modos al llegar a un número
// de monedas recogidas (hay 23 en los niveles) y trae sus propios colores.
const STYLE_NAMES = ['Clásico', 'Demonio', 'Tecno', 'Sonrisa', 'Pinchos', 'Núcleo', 'Cristal', 'Cuernos', 'Blindado', 'Runa', 'Ojos', 'Equis'];
const STYLE_COINS = [0, 1, 2, 3, 5, 7, 9, 11, 13, 16, 19, 22];
const STYLE_COLORS = [['#ffd23a', '#27e3ff'], ['#ff3b3b', '#ff7a3d'], ['#e8ecf2', '#27e3ff'], ['#9b4dff', '#ff4fd8'], ['#2a2a33', '#7dff3a'], ['#ff8a1c', '#27e3ff'],
  ['#5ab8ff', '#bff3ff'], ['#7a1010', '#ff3b3b'], ['#e8b84a', '#27e3ff'], ['#6a2cff', '#ff4fd8'], ['#2fae4a', '#7dff3a'], ['#ff9a1c', '#ffd23a']];
const styles = (base) => STYLE_NAMES.map((n, i) => [i ? `${base}_${i + 1}` : base, n, i]);
const DESIGNS = {
  cube: styles('cubo'), ship: styles('nave'), ball: styles('bola'), ufo: styles('ovni'), wave: styles('onda'),
  robot: styles('robot'), spider: styles('arana'), swing: styles('swing'),
};
// Ícono SVG del sprite de index.html (sustituye a los emojis).
const ico = (n) => `<svg class="i"><use href="#i-${n}"/></svg>`;
// Miniatura del garaje: posición en public/icons/garaje.webp (12 estilos × 8 modos, hecha con Blender).
const THUMB_ROW = { cube: 0, ship: 1, ball: 2, ufo: 3, wave: 4, robot: 5, spider: 6, swing: 7 };
const thumbPos = (mode, k) => `${(k / 11) * 100}% ${(THUMB_ROW[mode] / 7) * 100}%`;
const MODE_LABEL = { cube: 'Cubo', ship: 'Nave', ball: 'Bola', ufo: 'Ovni', wave: 'Onda', robot: 'Robot', spider: 'Araña', swing: 'Swing' };
const PALETTES = [['#27e3ff', '#ffd23a'], ['#5dff7a', '#27e3ff'], ['#ff4fa3', '#ffe23b'], ['#ffb13b', '#ff3b3b'], ['#b48cff', '#5dff7a'], ['#ffffff', '#ff4fa3']];
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ guardado
const SAVE_KEY = 'neondash3d.v1';
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; }
}
const save = Object.assign({ music: 0.7, sfx: 0.8, quality: 'alta', resolution: 'nativa', palette: 0, best: {}, coins: {}, designs: {}, unlocked: [], designColors: true, bonusCoins: 0 }, loadSave());
// regalo de 1000 monedas, una sola vez por partida guardada
if (!save.gift1000) { save.bonusCoins = (save.bonusCoins || 0) + 1000; save.gift1000 = true; persist(); }
function totalCoins() { return Object.values(save.coins).reduce((n, l) => n + l.length, 0) + (save.bonusCoins || 0); }
function styleOf(id) { const m = /_(\d+)$/.exec(id); return m ? Number(m[1]) - 1 : 0; }
function styleUnlocked(k) { return totalCoins() >= STYLE_COINS[k]; }
// colores de cada modo: los del diseño elegido, o null si el jugador usa sus paletas
function modeColors() {
  if (!save.designColors) return null;
  const out = {};
  for (const mode of Object.keys(DESIGNS)) out[mode] = STYLE_COLORS[styleOf(save.designs[mode] || DESIGNS[mode][0][0])];
  return out;
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* sin almacenamiento */ }
}
function bestOf(id) { return save.best[id] || (save.best[id] = { normal: 0, practice: 0 }); }
function colorsOfPlayer() { return PALETTES[save.palette] || PALETTES[0]; }

// ------------------------------------------------------------------ estado
const defs = Levels.list;
const game = {
  screen: 'menu', sel: 0, L: null, s: null, practice: false, paused: false, attempts: 1,
  queue: [], simClock: 0, alpha: 0, deadAt: 0, wonAt: 0, yOff: 0, lift: 0,
  camY: 0, prevCamY: 0, camTarget: NaN, checkpoints: [], lastCpTick: 0, waveTrail: [], menuT: 0,
  held: new Set(),
};

function showScreen(name) {
  game.screen = name;
  for (const id of ['menu', 'levels', 'pause', 'settings', 'complete', 'editor', 'garage', 'rewards']) $(id).hidden = id !== name;
  if (name === 'menu' && typeof renderWallet === 'function') renderWallet();
  $('hud').hidden = !(name === 'play' || name === 'pause' || name === 'complete');
  // música del menú (canción real en bucle); el editor va en silencio hasta que se prueba el nivel
  if (MENU_SCREENS.includes(name)) Sound.menu(MENU_TRACK, () => MENU_SCREENS.includes(game.screen));
  else if (name === 'editor' && Sound.playing() === MENU_TRACK) Sound.stop(0.4);
}
const MENU_TRACK = 'track:neon-menu-loop', MENU_SCREENS = ['menu', 'levels', 'garage', 'rewards'];
// Canción de un nivel: 'track:<id>' (MP3 real) si está disponible; si no, la sintetizada de respaldo (def.synth).
function songOf(def) {
  if (def.song && def.song.startsWith('track:') && !Sound.isReady(def.song)) return def.synth || 'pulso';
  return def.song;
}

// ------------------------------------------------------------------ triggers del nivel
// Estado de los triggers visuales para la x del jugador (función pura de x, igual que en Neon Dash).
const EASE = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inout: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  bounce: (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; },
};
function triggerState(def, x) {
  const out = { pulse: 0, pulseColor: '#ffffff', shake: 0, off: {}, alpha: {} };
  for (const tr of (def && def.triggers) || []) {
    const tx = tr.x * B;
    if (tx > x) break;
    const p = Math.min(1, (x - tx) / (tr.dur * B));
    switch (tr.kind) {
      case 'pulse': if (p < 1 && 1 - p > out.pulse) { out.pulse = 1 - p; out.pulseColor = tr.color; } break;
      case 'shake': if (p < 1) out.shake = Math.max(out.shake, tr.power * (1 - p)); break;
      case 'move': {
        const e = (EASE[tr.ease] || EASE.inout)(p);
        const o = out.off[tr.group] || (out.off[tr.group] = [0, 0]);
        o[0] += tr.dx * B * e; o[1] += tr.dy * B * e;
        break;
      }
      case 'fade': {
        const from = out.alpha[tr.group] != null ? out.alpha[tr.group] : 1;
        out.alpha[tr.group] = from + (tr.alpha - from) * EASE.inout(p);
        break;
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ partida
function previewLevel(i) {
  const L = Sim.compileLevel(defs[i]);
  World.buildLevel(L);
  game.preview = L;
  game.menuT = 0;
  startDemo();
}

// Tiempo (s) que tarda el jugador en llegar a la x (bloques) según los portales de velocidad: para que la
// música empiece en su sitio al arrancar desde un punto.
function timeAtX(def, x) {
  const sp = def.objects.filter((o) => o.t === 'portal' && o.kind === 'speed' && o.x < x).sort((a, b) => a.x - b.x);
  let t = 0, lastX = 0, v = def.startSpeed || 1;
  for (const o of sp) { t += (o.x - lastX) * B / Sim.SPEEDS[v].ups; lastX = o.x; v = o.value; }
  return t + (x - lastX) * B / Sim.SPEEDS[v].ups;
}
// Estado al empezar en la x (bloques): modo, velocidad, gravedad y tamaño que dejan los portales anteriores.
function applyStart(L, s, x) {
  const portals = L.def.objects.filter((o) => o.t === 'portal' && o.x < x).sort((a, b) => a.x - b.x);
  for (const o of portals) {
    if (o.kind === 'speed') s.speed = o.value;
    else if (o.kind === 'flip') s.flip = -1;
    else if (o.kind === 'unflip') s.flip = 1;
    else if (o.kind === 'mini') s.mini = true;
    else if (o.kind === 'big') s.mini = false;
    else if (MODE_NAME[o.kind]) s.mode = o.kind;
  }
  s.x = s.px = x * B;
  if (Sim.P.CORRIDOR[s.mode]) { s.lo = 0; s.hi = Sim.P.CORRIDOR[s.mode]; } else { s.lo = 0; s.hi = Infinity; if (!Sim.FLYING[s.mode]) s.flip = 1; }
  const half = Sim.halfOf(s);
  // de pie sobre lo que haya debajo (o en el suelo); en los pasillos, en el centro
  let y = half;
  if (s.hi !== Infinity) y = (s.lo + s.hi) / 2;
  else for (const o of L.objs) if (o.solid && o.x0 <= s.x && o.x1 >= s.x && o.y1 + half > y && o.y1 < 5 * B) y = o.y1 + half;
  s.y = s.py = y;
  s.grounded = false;
  s.tick = Math.round(timeAtX(L.def, x) * TPS);
}

// Nivel hecho en el editor: se juega igual que uno oficial y, al salir, se vuelve al editor.
// start: { x } en bloques para empezar desde ese punto ("Probar desde aquí").
function startCustom(def, practice, start) {
  game.custom = def;
  game.songId = songOf(def);
  game.customStart = start && start.x > 0 ? start.x : 0;
  const L = Sim.compileLevel(def);
  L.custom = true;
  World.buildLevel(L);
  game.L = L;
  game.practice = !!practice;
  game.attempts = 1;
  game.checkpoints = [];
  game.paused = false;
  showScreen('play');
  $('practiceTag').hidden = !practice;
  game.introAt = performance.now();
  newAttempt();
  $('view').focus();
}

function startLevel(i, practice) {
  game.custom = null;
  if (!game.songReady) game.songId = songOf(defs[i]);
  game.songReady = false;
  game.customStart = 0;
  game.sel = i;
  const L = Sim.compileLevel(defs[i]);
  World.buildLevel(L);
  game.L = L;
  game.practice = practice;
  game.attempts = 1;
  game.checkpoints = [];
  game.paused = false;
  showScreen('play');
  $('practiceTag').hidden = !practice;
  game.introAt = performance.now();
  newAttempt();
  $('view').focus();
}

function initialCamY() { return -VIEW_H * 0.27; }

function newAttempt() {
  const L = game.L;
  const cp = game.practice && game.checkpoints.length ? game.checkpoints[game.checkpoints.length - 1] : null;
  let s;
  if (cp) {
    s = Sim.cloneState(cp.state);
    game.camY = game.prevCamY = game.camTarget = cp.camY;
  } else {
    s = Sim.createState(L);
    if (game.custom && game.customStart) applyStart(L, s, game.customStart);
    game.camY = game.prevCamY = game.camTarget = s.hi !== Infinity ? (s.lo + s.hi) / 2 - VIEW_H / 2 : Math.max(initialCamY(), s.y - VIEW_H * 0.4);
  }
  s.events = [];
  s.held = s.jumpBuf = s.ringBuf = false;
  if (game.held.size) { Sim.press(s); s.ringBuf = false; }
  game.s = s;
  game.queue.length = 0;
  game.deadAt = game.wonAt = 0;
  game.waveTrail = [];
  game.yOff = game.lift = 0;
  game.winX = game.winY = 0;
  game.lastCpTick = s.tick;
  syncCheckpoints();
  if (window.ND3D.Meta) window.ND3D.Meta.attempt();
  const lead = game.practice && !save.practiceMusic ? (Sound.stop(0), 0) : Sound.start(game.songId || songOf(L.def), s.tick / TPS);
  game.simClock = performance.now() + lead;
  showAttempt();
}

function showNewBest(p) {
  const el = $('newBest');
  el.textContent = '¡Nuevo récord! ' + p + '%';
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function showAttempt() {
  const el = $('attempt');
  el.hidden = !save.showAttempts;
  el.textContent = game.practice ? 'Práctica' : 'Intento ' + game.attempts;
  el.style.transition = 'none';
  el.style.opacity = '1';
  clearTimeout(game.attemptTimer);
  game.attemptTimer = setTimeout(() => { el.style.transition = 'opacity 0.8s'; el.style.opacity = '0'; }, 1100);
}

function restartLevel() {
  if (!game.L) return;
  if (!game.practice) game.checkpoints = [];
  game.attempts++;
  game.paused = false;
  showScreen('play');
  newAttempt();
}

function pct(s) { return Math.max(0, Math.min(100, Math.floor(s.x / game.L.endX * 100))); }
function record(p) {
  if (game.custom) return;
  const b = bestOf(game.L.id);
  const key = game.practice ? 'practice' : 'normal';
  if (p > b[key]) { b[key] = p; persist(); }
}

function syncCheckpoints() {
  World.setCheckpoints(game.practice ? game.checkpoints.map((c) => ({ x: c.state.x, y: c.state.y })) : []);
}
function addCheckpoint(manual) {
  const s = game.s;
  if (s.dead || s.won) return;
  game.checkpoints.push({ state: Sim.cloneState(s), camY: game.camY });
  game.lastCpTick = s.tick;
  syncCheckpoints();
  if (manual) Sound.sfx('checkpoint');
}
function practiceAuto() {
  const s = game.s;
  if (!game.practice || s.dead || s.won || s.tick - game.lastCpTick < TPS * 2) return;
  if (Sim.FLYING[s.mode] || s.grounded) addCheckpoint(false);
}

// Efectos de un evento de la física (sin sonido ni guardado): los usa la partida y la demo del menú.
function visualEvent(e, s, L) {
  const [c1, c2] = colorsOfPlayer();
  switch (e.type) {
    case 'death': World.FX.death(e.x, e.y, c1, c2); break;
    case 'win': World.FX.win(e.x, e.y); break;
    case 'jump': {
      // los eventos del gemelo del modo dual llevan twin: true
      const p = e.twin && s.twin ? s.twin : s;
      if (p.mode === 'cube' || p.mode === 'ball' || p.mode === 'robot') World.FX.jump(p.x, p.y - p.flip * Sim.halfOf(p), p.flip);
      break;
    }
    case 'orb': {
      const o = L.objs[e.id];
      if (!o) break;
      const hex = World.PAD_COLOR[o.kind] || '#ffd23a';
      World.FX.ring(o.x * B + 15, o.y * B + 15, hex, 28, 4.5, 0.4);
      World.FX.burst(o.x * B + 15, o.y * B + 15, hex, 18, 3, 0.4, 0.14);
      break;
    }
    case 'pad': {
      const o = L.objs[e.id];
      if (o) World.FX.column(o.x * B + 15, o.y * B + (o.r ? 26 : 4), World.PAD_COLOR[o.kind] || '#ffd23a', o.r ? -1 : 1);
      break;
    }
    case 'portal': {
      const o = e.id != null ? L.objs[e.id] : null;
      const hex = e.kind === 'speed' ? World.SPEED_COLOR[e.value] : World.MODE_COLOR[e.kind] || '#ffffff';
      if (o) World.FX.portal(o, hex);
      if (e.kind === 'speed') World.FX.fovKick = 0.8;
      break;
    }
    case 'teleport':
      World.FX.teleport(e.x, e.fromY != null ? e.fromY : e.y, e.toY != null ? e.toY : e.y, c1);
      break;
    case 'coin': {
      const o = L.objs[e.id];
      if (o) { World.FX.ring(o.x * B + 15, o.y * B + 15, '#ffd23a', 20, 3.5, 0.5); World.FX.burst(o.x * B + 15, o.y * B + 15, '#ffd23a', 24, 3, 0.6, 0.15); }
      break;
    }
  }
}

function handleEvents(now) {
  const s = game.s, L = game.L;
  for (const e of s.events) {
    visualEvent(e, s, L);
    switch (e.type) {
      case 'death': {
        game.deadAt = now;
        Sound.stop(0.12);
        Sound.sfx('death');
        const p = pct(s);
        if (!game.practice && !game.custom && p >= 5 && p > bestOf(L.id).normal) showNewBest(p);
        if (window.ND3D.Meta) window.ND3D.Meta.death(p);
        record(p);
        break;
      }
      case 'win':
        game.wonAt = now;
        game.winX = s.x; game.winY = s.y;
        game.lastReward = window.ND3D.Meta ? window.ND3D.Meta.win(s) : '';
        Sound.stop(1.2);
        Sound.sfx('complete');
        record(100);
        if (!game.practice && !game.custom) {
          const got = new Set(save.coins[L.id] || []);
          for (const id of L.coins) if (s.used[id]) got.add(id);
          save.coins[L.id] = Array.from(got);
          persist();
        }
        break;
      case 'coin':
        Sound.sfx('coin');
        break;
      case 'jump': case 'flap': case 'teleport':
        if (window.ND3D.Meta && !e.twin) window.ND3D.Meta.jump();
        break;
    }
  }
  s.events.length = 0;
}

// Cámara vertical (igual que Neon Dash). c guarda camY, prevCamY y camTarget: la partida o la demo.
function cameraStep(s, c) {
  c.prevCamY = c.camY;
  let target;
  if (s.hi !== Infinity) {
    target = (s.lo + s.hi) / 2 - VIEW_H / 2;
  } else {
    target = Number.isFinite(c.camTarget) ? c.camTarget : initialCamY();
    const bottom = VIEW_H * 0.3, top = VIEW_H * 0.36;
    if (s.y - target < bottom) target = s.y - bottom;
    if (target + VIEW_H - s.y < top) target = s.y + top - VIEW_H;
    target = Math.max(target, initialCamY());
  }
  c.camTarget = target;
  // en los pasillos de los modos voladores la cámara se recoloca más despacio (sin tirón al cambiar de modo)
  c.camY += (target - c.camY) * (s.hi !== Infinity ? 0.012 : 0.035);
}

// ------------------------------------------------------------------ demo del menú
// Reproduce la ruta del bot (src/demos.js) del nivel elegido: el jugador juega solo de fondo.
const demo = { L: null, s: null, edges: null, i: 0, clock: 0, endAt: 0, alpha: 0, camY: 0, prevCamY: 0, camTarget: NaN, trail: [], yOff: 0, lift: 0 };
function startDemo() {
  const L = game.preview;
  demo.L = L;
  demo.edges = (typeof Demos !== 'undefined' && Demos[L.id]) || null;
  const s = demo.s = Sim.createState(L);
  s.events = [];
  demo.i = 0;
  demo.endAt = 0;
  demo.trail = [];
  demo.yOff = demo.lift = 0;
  demo.camY = demo.prevCamY = demo.camTarget = Math.max(initialCamY(), s.y - VIEW_H * 0.4);
  demo.clock = performance.now();
}
function stepDemo(now) {
  const s = demo.s;
  let n = 0;
  while (demo.clock + TICK_MS <= now) {
    if (++n > TPS) { demo.clock = now; break; }
    if (!s.dead && !s.won) {
      const ed = demo.edges;
      while (demo.i < ed.length && ed[demo.i] <= s.tick) { if (demo.i % 2 === 0) Sim.press(s); else Sim.release(s); demo.i++; }
      const was = s.grounded;
      Sim.step(demo.L, s);
      snapStep(demo, s, was);
      for (const e of s.events) {
        if (e.type === 'death' || e.type === 'win') demo.endAt = now;
        visualEvent(e, s, demo.L);
      }
      s.events.length = 0;
      if (s.mode === 'wave' && !s.dead) { demo.trail.push(s.x, s.y); if (demo.trail.length > 1800) demo.trail.splice(0, 2); }
      else if (demo.trail.length) demo.trail.length = 0;
    }
    cameraStep(s, demo);
    demo.clock += TICK_MS;
  }
  demo.alpha = Math.max(0, Math.min(1, (now - demo.clock) / TICK_MS));
  if (demo.endAt && now - demo.endAt > 1600) startDemo();
}

function stepPlay(now) {
  const s = game.s;
  let n = 0;
  while (game.simClock + TICK_MS <= now) {
    if (++n > TPS) { game.simClock = now; break; } // atasco largo: no recuperar más de 1 s
    const tEnd = game.simClock + TICK_MS;
    const q = game.queue;
    while (q.length && q[0].t <= tEnd) {
      const ev = q.shift();
      if (ev.down) Sim.press(s); else Sim.release(s);
    }
    if (!s.dead && !s.won) {
      const was = s.grounded;
      Sim.step(game.L, s);
      snapStep(game, s, was);
      handleEvents(now);
      if (s.mode === 'wave' && !s.dead) {
        game.waveTrail.push(s.x, s.y);
        if (game.waveTrail.length > 1800) game.waveTrail.splice(0, 2);
      } else if (game.waveTrail.length && !s.dead) game.waveTrail.length = 0;
      practiceAuto();
    }
    cameraStep(s, game);
    game.simClock = tEnd;
  }
  game.alpha = Math.max(0, Math.min(1, (now - game.simClock) / TICK_MS));
  if (s.dead && game.deadAt && now - game.deadAt > 950) {
    game.attempts++;
    newAttempt();
  }
  if (s.won && game.wonAt && now - game.wonAt > 1800 && game.screen === 'play') showComplete();
}

function pause() {
  if (game.screen !== 'play' || game.s.dead || game.s.won) return;
  labelQuit();
  game.paused = true;
  Sim.release(game.s);
  Sound.stop(0.1);
  renderSettings();
  showScreen('pause');
}
function resume() {
  if (!game.paused) return;
  game.paused = false;
  showScreen('play');
  game.queue.length = 0;
  const lead = game.practice && !save.practiceMusic ? 0 : Sound.start(game.songId || songOf(game.L.def), game.s.tick / TPS);
  game.simClock = performance.now() + lead;
  $('view').focus();
}

// En los niveles del editor, "Niveles" vuelve al editor: los botones lo dicen.
function labelQuit() {
  const t = game.custom ? 'Editor' : 'Niveles';
  $('quitBtn').textContent = t;
  $('doneLevels').textContent = t;
}

function showComplete() {
  labelQuit();
  const s = game.s, L = game.L;
  const got = L.coins.filter((id) => s.used[id]).length;
  $('doneTitle').textContent = game.practice ? '¡Práctica completada!' : '¡Nivel completado!';
  $('doneAttempts').textContent = game.attempts;
  $('doneJumps').textContent = s.jumps;
  const secs = Math.round(s.tick / TPS);
  $('doneTime').textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
  $('doneCoins').textContent = got + '/' + L.coins.length;
  $('doneReward').innerHTML = game.lastReward || '';
  $('doneNext').hidden = !!game.custom || game.sel >= defs.length - 1;
  showScreen('complete');
  $('doneNext').hidden ? $('doneRetry').focus() : $('doneNext').focus();
}

// ------------------------------------------------------------------ dibujo
// La física apoya el centro del jugador en la diagonal de las rampas: al entrar o salir de una, la altura
// salta de golpe (en 2D no se notaba, en 3D sí). Estas dos funciones sólo cambian el dibujo:
// - snapStep (cada tick): si estando apoyado la altura salta más de lo que permite una rampa, el salto
//   pasa a un desfase (yOff) que el dibujo reparte en ~0,1 s;
// - visualY (cada fotograma): devuelve la altura a dibujar, colocando el modelo en las rampas para que se
//   apoye en la superficie inclinada (ni hundido ni flotando).
function snapStep(c, s, wasGrounded) {
  if (!wasGrounded || !s.grounded || s.mode === 'wave') return;
  const dy = s.y - s.py;
  const lim = Sim.SPEEDS[s.speed].ups / TPS * 2.2;
  if (Math.abs(dy) > lim) c.yOff -= dy - Math.sign(dy) * lim;
}
function visualY(c, s, y, dt) {
  c.yOff *= Math.exp(-dt * 16);
  if (Math.abs(c.yOff) < 0.05) c.yOff = 0;
  // En rampa, el modelo va inclinado como la rampa: su centro debe quedar a half / cos(ángulo) de la
  // diagonal (la física lo apoya en el centro al subir y en la esquina de atrás al bajar).
  const half = Sim.halfOf(s);
  let target = 0;
  if (s.slope && s.grounded && s.mode !== 'wave') {
    const want = Sim.slopeY(s.slope, s.x) + s.flip * half / Math.cos(s.slope.angle * Math.PI / 180);
    target = want - s.y;
  }
  c.lift += (target - c.lift) * (1 - Math.exp(-dt * 14));
  return y + c.yOff + c.lift;
}

function beatPulse(tick, bpm) {
  const ph = (tick / TPS * (bpm || 150) / 60) % 1;
  return Math.exp(-ph * 5);
}
// Estado del gemelo del modo dual (s.twin), interpolado como el jugador.
function twinView(s, a) {
  const t = s.twin;
  if (!t) return null;
  return { x: t.px + (t.x - t.px) * a, y: t.py + (t.y - t.py) * a, rot: lerpAngle(t.prot != null ? t.prot : t.rot, t.rot, a), mode: t.mode, mini: t.mini, flip: t.flip, dead: t.dead, grounded: t.grounded };
}
// Rectángulos de la física para la opción de hitboxes: jugador (exterior e interior), gemelo y objetos cercanos.
function hitboxesOf(s, L) {
  const out = [];
  for (const p of [s, s.twin]) {
    if (!p) continue;
    const h = Sim.halfOf(p), ih = Sim.innerOf(p);
    out.push([p.x - h, p.y - h, p.x + h, p.y + h, 0], [p.x - ih, p.y - ih, p.x + ih, p.y + ih, 1]);
  }
  for (const o of Sim.query(L, s.x - 90, s.x + 600)) if (!o.deco) out.push([o.x0, o.y0, o.x1, o.y1, o.hazard ? 2 : (o.solid || o.slope) ? 3 : 4]);
  return out;
}
function lerpAngle(a, b, t) {
  let d = ((b - a) % 360 + 540) % 360 - 180;
  return a + d * t;
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop); // primero: un error en un fotograma no debe parar el bucle
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); // nunca negativo (saltos de reloj)
  last = now;
  let view;
  if (game.s && (game.screen === 'play' || game.screen === 'pause' || game.screen === 'complete')) {
    if (game.screen === 'play' && !game.paused) stepPlay(now);
    const s = game.s, a = game.alpha;
    const x = s.px + (s.x - s.px) * a, y = visualY(game, s, s.py + (s.y - s.py) * a, dt);
    const camY = game.prevCamY + (game.camY - game.prevCamY) * a;
    view = {
      x, y, rot: lerpAngle(s.prot, s.rot, a), mode: s.mode, mini: s.mini, flip: s.flip, dead: s.dead, visible: true,
      camX: x + 3.6 * B, camY: camY + VIEW_H / 2, beat: beatPulse(s.tick, game.L.def.bpm), colorsX: x,
      used: s.used, savedCoins: save.coins[game.L.id], trail: game.waveTrail, lo: s.lo, hi: s.hi,
      grounded: s.grounded, trig: triggerState(game.L.def, x), twin: twinView(s, a), boost: s.boost || 0,
      intro: game.attempts === 1 && game.introAt ? (now - game.introAt) / 1000 : null,
      wonT: s.won && game.wonAt ? (now - game.wonAt) / 1000 : null,
    };
    if (s.won) view.camX = game.winX + 3.6 * B;
    if (save.hitboxes) view.boxes = hitboxesOf(s, game.L);
    updateHud(s);
  } else if (game.screen === 'garage') {
    view = { x: 0, y: 3 * B, visible: true, mode: game.garageMode, rot: 0, flip: 1, camX: 0, camY: 3 * B, beat: beatPulse(performance.now() / 1000 * TPS, 120) * 0.5, colorsX: 0, menu: true, garage: true, lo: 0, hi: Infinity };
    // hueco libre encima del panel del garaje, para encuadrar el modelo ahí
    const gp = document.querySelector('#garage .panel');
    if (gp && window.innerHeight) {
      // el hueco libre más grande: encima del panel o a su izquierda
      const r = gp.getBoundingClientRect(), W0 = window.innerWidth, H0 = window.innerHeight;
      const top = { x0: 0, x1: 1, y0: 0, y1: r.top / H0 }, left = { x0: 0, x1: r.left / W0, y0: 0, y1: 1 };
      view.garageFree = (top.y1 * W0 * H0) >= (left.x1 * W0 * H0) ? top : left;
    }
  } else if (game.screen === 'editor' && window.ND3D.editor && window.ND3D.editor.view) {
    view = window.ND3D.editor.view(dt);
  } else {
    // menús: el jugador juega solo el nivel elegido (o, sin ruta, la cámara lo recorre)
    const L = game.preview;
    if (demo.s && demo.L === L && demo.edges) {
      stepDemo(now);
      const s = demo.s, a = demo.alpha;
      const x = s.px + (s.x - s.px) * a, y = visualY(demo, s, s.py + (s.y - s.py) * a, dt);
      view = {
        x, y, rot: lerpAngle(s.prot, s.rot, a), mode: s.mode, mini: s.mini, flip: s.flip, dead: s.dead, visible: true, menu: true,
        camX: x + 3.6 * B, camY: demo.prevCamY + (demo.camY - demo.prevCamY) * a + VIEW_H / 2, beat: beatPulse(s.tick, L.def.bpm) * 0.7,
        colorsX: x, used: s.used, trail: demo.trail, lo: s.lo, hi: s.hi,
        grounded: s.grounded, boost: s.boost || 0, trig: triggerState(L.def, x), twin: twinView(s, a), wonT: s.won && demo.endAt ? (now - demo.endAt) / 1000 : null,
      };
    } else {
      game.menuT += dt;
      const x = L ? (game.menuT * 3.2 * B) % Math.max(B, L.endX) : 0;
      view = { x, y: 0, visible: false, camX: x, camY: 4.2 * B, beat: beatPulse(game.menuT * TPS, 128) * 0.6, colorsX: x, menu: true, lo: 0, hi: Infinity };
    }
  }
  World.frame(view, dt);
}

let hudPct = -1;
function updateHud(s) {
  $('hud').querySelector('.top').style.visibility = save.showPct ? '' : 'hidden';
  const p = pct(s);
  if (p === hudPct) return;
  hudPct = p;
  $('progress').style.width = p + '%';
  $('pct').textContent = p + '%';
}

// ------------------------------------------------------------------ entrada
const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
// Momento real de la pulsación: e.timeStamp es cuándo la registró el sistema (misma base que performance.now()).
// Con pocos Hz el navegador puede entregar el evento varios ms después; así el salto cae en el paso de la física
// que toca y la jugabilidad es la misma a 30 que a 240 Hz.
function inputTime(e) {
  const now = performance.now();
  const t = e && e.timeStamp;
  return t > 0 && t <= now && now - t < 250 ? t : now;
}
function enqueue(ev) {
  const q = game.queue;
  let i = q.length;
  while (i > 0 && q[i - 1].t > ev.t) i--;
  q.splice(i, 0, ev);
}
function down(src, e) {
  if (game.held.has(src)) return;
  game.held.add(src);
  if (game.screen === 'play' && !game.paused) enqueue({ t: inputTime(e), down: true });
}
function up(src, e) {
  if (!game.held.delete(src)) return;
  if (game.held.size === 0 && game.screen === 'play' && !game.paused) enqueue({ t: inputTime(e), down: false });
}
window.addEventListener('keydown', (e) => {
  if (JUMP_KEYS.has(e.code)) {
    if (game.screen === 'play') { e.preventDefault(); if (!e.repeat) down(e.code, e); }
    return;
  }
  if (e.repeat) return;
  switch (e.code) {
    case 'Escape': case 'KeyP':
      if (game.screen === 'play') pause();
      else if (game.screen === 'pause') resume();
      else if (game.screen === 'levels') showScreen('menu');
      else if (game.screen === 'garage') leaveGarage();
      else if (game.screen === 'settings') showScreen('menu');
      break;
    case 'KeyR':
      if (game.screen === 'play' || game.screen === 'pause' || game.screen === 'complete') restartLevel();
      break;
    case 'KeyH':
      save.hitboxes = !save.hitboxes; persist();
      break;
    case 'KeyZ':
      if (game.screen === 'play' && game.practice) addCheckpoint(true);
      break;
    case 'KeyX':
      if (game.screen === 'play' && game.practice) { game.checkpoints.pop(); syncCheckpoints(); }
      break;
    case 'ArrowLeft':
      if (game.screen === 'levels') selectLevel(game.sel - 1);
      break;
    case 'ArrowRight':
      if (game.screen === 'levels') selectLevel(game.sel + 1);
      break;
  }
});
window.addEventListener('keyup', (e) => { if (JUMP_KEYS.has(e.code)) up(e.code, e); });
window.addEventListener('pointerdown', (e) => {
  if (game.screen !== 'play' || e.target.closest('button')) return;
  down('p' + e.pointerId, e);
});
window.addEventListener('pointerup', (e) => up('p' + e.pointerId, e));
window.addEventListener('pointercancel', (e) => up('p' + e.pointerId, e));
window.addEventListener('blur', () => { for (const k of Array.from(game.held)) up(k); if (game.screen === 'play') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.screen === 'play') pause(); });
window.addEventListener('resize', () => World.resize());

// ------------------------------------------------------------------ menús
function unlockAudio() {
  Sound.resume();
  Sound.setVolumes(save.music, save.sfx);
  if (MENU_SCREENS.includes(game.screen)) Sound.menu(MENU_TRACK, () => MENU_SCREENS.includes(game.screen));
}
function click() { Sound.sfx('click'); }

function selectLevel(i) {
  const n = defs.length;
  game.sel = ((i % n) + n) % n;
  renderLevelCard();
  previewLevel(game.sel);
}
// Duración del nivel (s): lo que tarda en llegar a la meta según los portales de velocidad.
const durCache = new Map();
function levelDuration(def) {
  if (!durCache.has(def.id)) durCache.set(def.id, timeAtX(def, Sim.compileLevel(def).endX / B));
  return durCache.get(def.id);
}
function fmtDur(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function renderLevelCard() {
  const def = defs[game.sel];
  $('lvName').textContent = def.name;
  $('lvDiff').textContent = def.difficulty || '';
  $('lvTime').innerHTML = ico('clock') + ' ' + fmtDur(levelDuration(def));
  $('lvStars').innerHTML = ico('star').repeat(Math.min(10, def.stars || 0));
  const modes = new Set([def.startMode || 'cube']);
  for (const o of def.objects) if (o.t === 'portal' && MODE_NAME[o.kind]) modes.add(o.kind);
  $('lvModes').textContent = 'Modos: ' + Array.from(modes).map((m) => MODE_NAME[m]).join(' · ');
  const b = bestOf(def.id);
  $('lvBest').style.width = b.normal + '%'; $('lvBestTxt').textContent = b.normal + '%';
  $('lvPrac').style.width = b.practice + '%'; $('lvPracTxt').textContent = b.practice + '%';
  const total = def.objects.filter((o) => o.t === 'coin').length;
  const got = (save.coins[def.id] || []).length;
  $('lvCoins').innerHTML = Array.from({ length: total }, (_, k) => `<span class="coin-dot${k < got ? ' got' : ''}"></span>`).join('');
  $('lvDots').innerHTML = defs.map((_, k) => `<i class="${k === game.sel ? 'on' : ''}"></i>`).join('');
  $('lvStars').classList.toggle('earned', !!save.completed && !!save.completed[def.id]);
  if (typeof renderSongRow === 'function') renderSongRow();
  if (typeof renderWallet === 'function') renderWallet();
}

// ------------------------------------------------------------------ garaje
function designsAvailable(mode) {
  // sólo se ofrecen los diseños que existen en los modelos cargados (el primero siempre)
  return DESIGNS[mode].filter(([id], i) => i === 0 || World.hasModel(id));
}
function applyDesigns() {
  // en el garaje, el diseño que se está mirando (aunque esté bloqueado) se ve en el modelo
  const designs = Object.assign({}, save.designs);
  if (game.screen === 'garage' && game.garagePreview) designs[game.garageMode] = game.garagePreview;
  const mc = modeColors();
  if (mc && game.screen === 'garage' && game.garagePreview) mc[game.garageMode] = STYLE_COLORS[styleOf(game.garagePreview)];
  World.setDesigns(designs, mc);
  World.setPlayerColors(...colorsOfPlayer());
}
function renderGarage() {
  const mode = game.garageMode;
  const coins = totalCoins();
  $('garageCoins').textContent = coins;
  $('garageTabs').innerHTML = Object.keys(DESIGNS).map((m) => `<button class="${m === mode ? 'on' : ''}" data-mode="${m}">${MODE_LABEL[m]}</button>`).join('');
  const cur = save.designs[mode] || DESIGNS[mode][0][0];
  const look = game.garagePreview || cur;
  $('garageList').innerHTML = designsAvailable(mode).map(([id, name, k]) => {
    const open = styleUnlocked(k);
    const label = id === cur ? `${ico('check')} Elegido` : open ? 'Elegir' : `${ico('lock')} ${STYLE_COINS[k]}`;
    return `<button class="design${id === cur ? ' on' : ''}${id === look && id !== cur ? ' look' : ''}${open ? '' : ' locked'}" data-id="${id}" data-k="${k}">` +
      `<i class="thumb" style="background-position:${thumbPos(mode, k)}"></i><b>${name}</b><span>${label}</span></button>`;
  }).join('');
  $('garagePalettes').innerHTML = `<div class="seg"><button class="${save.designColors ? 'on' : ''}" data-dc="1">Del diseño</button><button class="${save.designColors ? '' : 'on'}" data-dc="0">Mis colores</button></div>` +
    (save.designColors ? '' : PALETTES.map(([a, b], k) => `<button class="swatch${k === save.palette ? ' on' : ''}" data-pal="${k}" aria-label="Colores ${k + 1}" style="background:linear-gradient(135deg, ${a} 50%, ${b} 50%)"></button>`).join(''));
  $('garageTabs').querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { click(); game.garageMode = b.dataset.mode; game.garagePreview = null; applyDesigns(); renderGarage(); }));
  $('garageList').querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => {
    const k = Number(b.dataset.k);
    click();
    if (!styleUnlocked(k)) {
      // bloqueado: se enseña igual, para ver cómo es
      game.garagePreview = b.dataset.id;
      $('garageMsg').textContent = `Vista previa. Se desbloquea al recoger ${STYLE_COINS[k]} monedas (llevas ${totalCoins()}).`;
      applyDesigns(); renderGarage();
      return;
    }
    game.garagePreview = null;
    save.designs[mode] = b.dataset.id;
    $('garageMsg').textContent = '';
    persist(); applyDesigns(); renderGarage();
  }));
  $('garagePalettes').querySelectorAll('[data-dc]').forEach((b) => b.addEventListener('click', () => {
    save.designColors = b.dataset.dc === '1'; persist(); click(); applyDesigns(); renderGarage();
  }));
  $('garagePalettes').querySelectorAll('[data-pal]').forEach((b) => b.addEventListener('click', () => {
    save.palette = Number(b.dataset.pal); persist(); click(); applyDesigns(); renderGarage();
  }));
}

function renderSettings() {
  const html = `
    <div class="setting"><label for="volMusic{n}">Música</label><input type="range" id="volMusic{n}" min="0" max="1" step="0.05" value="${save.music}"></div>
    <div class="setting"><label for="volSfx{n}">Efectos</label><input type="range" id="volSfx{n}" min="0" max="1" step="0.05" value="${save.sfx}"></div>
    ${[['showPct', 'Mostrar porcentaje'], ['showAttempts', 'Mostrar intentos'], ['hitboxes', 'Ver hitboxes (H)'], ['practiceMusic', 'Música en práctica'], ['reduceFlash', 'Reducir destellos']].map(([k, n]) =>
      `<div class="setting"><span>${n}</span><div class="seg"><button class="${save[k] ? 'on' : ''}" data-opt="${k}" data-v="1">Sí</button><button class="${save[k] ? '' : 'on'}" data-opt="${k}" data-v="0">No</button></div></div>`).join('')}
    <div class="setting"><span>Resolución</span><div class="seg">${[['nativa', 'Nativa'], ['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']].map(([r, n]) => `<button class="${save.resolution === r ? 'on' : ''}" data-res="${r}">${n}</button>`).join('')}</div></div>
    <div class="setting"><span>Calidad</span><div class="seg" data-quality>${['alta', 'baja'].map((q) => `<button class="${save.quality === q ? 'on' : ''}" data-q="${q}">${q === 'alta' ? 'Alta' : 'Baja'}</button>`).join('')}</div></div>
    <div class="setting"><span>Colores</span><div class="swatches">${PALETTES.map(([a, b], k) => `<button class="swatch${k === save.palette ? ' on' : ''}" data-pal="${k}" aria-label="Colores ${k + 1}" style="background:linear-gradient(135deg, ${a} 50%, ${b} 50%)"></button>`).join('')}</div></div>
    <p class="credit">${Tracks.credit}</p>`;
  document.querySelectorAll('[data-settings]').forEach((el, n) => {
    el.innerHTML = html.replace(/\{n\}/g, n);
    el.querySelector(`#volMusic${n}`).addEventListener('input', (e) => { save.music = Number(e.target.value); Sound.setVolumes(save.music, save.sfx); persist(); });
    el.querySelector(`#volSfx${n}`).addEventListener('input', (e) => { save.sfx = Number(e.target.value); Sound.setVolumes(save.music, save.sfx); persist(); });
    el.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => { save[b.dataset.opt] = b.dataset.v === '1'; persist(); click(); World.setReduceFlash(save.reduceFlash); renderSettings(); }));
    el.querySelectorAll('[data-res]').forEach((b) => b.addEventListener('click', () => { save.resolution = b.dataset.res; World.setResolution(save.resolution); persist(); click(); renderSettings(); }));
    el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { save.quality = b.dataset.q; World.W.resolution = save.resolution;
World.setQuality(save.quality); persist(); click(); renderSettings(); }));
    el.querySelectorAll('[data-pal]').forEach((b) => b.addEventListener('click', () => {
      save.palette = Number(b.dataset.pal); persist(); click();
      const [c1, c2] = colorsOfPlayer(); World.setPlayerColors(c1, c2);
      renderSettings();
    }));
  });
}

$('playBtn').addEventListener('click', () => { unlockAudio(); click(); renderLevelCard(); showScreen('levels'); $('startLevel').focus(); });
$('settingsBtn').addEventListener('click', () => { unlockAudio(); renderSettings(); showScreen('settings'); });
$('garageBtn').addEventListener('click', () => { unlockAudio(); click(); game.garageMode = game.garageMode || 'cube'; renderGarage(); showScreen('garage'); });
$('garageBack').addEventListener('click', () => { click(); leaveGarage(); });
function leaveGarage() { game.garagePreview = null; showScreen('menu'); applyDesigns(); }
$('settingsClose').addEventListener('click', () => { click(); showScreen('menu'); });
$('levelsBack').addEventListener('click', () => { click(); showScreen('menu'); });
$('prevLevel').addEventListener('click', () => { click(); selectLevel(game.sel - 1); });
$('nextLevel').addEventListener('click', () => { click(); selectLevel(game.sel + 1); });
// con canción propia, se carga antes de empezar
async function playSel(practice) { unlockAudio(); game.songId = await prepareSong(defs[game.sel]); game.songReady = true; startLevel(game.sel, practice); }
$('startLevel').addEventListener('click', () => playSel(false));
$('startPractice').addEventListener('click', () => playSel(true));
$('pauseBtn').addEventListener('click', () => pause());
$('resumeBtn').addEventListener('click', () => resume());
$('restartBtn').addEventListener('click', () => restartLevel());
$('quitBtn').addEventListener('click', () => { quitToLevels(); });
$('doneNext').addEventListener('click', () => { click(); game.sel++; playSel(false); });
$('doneRetry').addEventListener('click', () => { click(); game.attempts = 0; restartLevel(); });
$('doneLevels').addEventListener('click', () => { quitToLevels(); });
function quitToLevels() {
  click();
  Sound.stop(0.2);
  game.s = null;
  game.paused = false;
  if (game.custom && window.ND3D.editor) { game.custom = null; window.ND3D.editor.open(); return; }
  renderLevelCard();
  previewLevel(game.sel);
  showScreen('levels');
}

// ------------------------------------------------------------------ arranque
World.initScene($('view'));
World.setQuality(save.quality);
World.setPlayerColors(...colorsOfPlayer());
World.setDesigns(save.designs, modeColors());
World.loadModels(() => { World.setPlayerColors(...colorsOfPlayer()); if (game.screen === 'garage') renderGarage(); });
previewLevel(0);
showScreen('menu');
const loading = $('loading');
loading.style.opacity = '0';
setTimeout(() => loading.remove(), 500);
// Herramientas de depuración (consola): avanzar fotogramas a mano, colocar al jugador y acercar la cámara.
const dev = {
  async run(secs) { for (let i = 0, n = Math.round(secs * 60); i < n; i++) { loop(performance.now()); await new Promise((r) => setTimeout(r, 16)); } },
  async peek(li, xb, yb, mode) {
    for (const id of ['menu', 'levels', 'pause', 'settings', 'complete']) $(id).hidden = true;
    const L = Sim.compileLevel(defs[li]);
    World.buildLevel(L); game.L = L;
    const s = Sim.createState(L);
    s.x = s.px = xb * B; s.y = s.py = (yb || 0) * B + 15;
    if (mode) { s.mode = mode; s.hi = Infinity; }
    s.events = []; game.s = s; game.alpha = 0; game.camY = game.prevCamY = s.y - VIEW_H * 0.35; game.yOff = game.lift = 0;
    game.screen = 'pause'; game.paused = true; $('hud').hidden = true;
    await dev.run(1.2);
  },
  closeup(on) {
    const W = World.W;
    if (!W.__render) W.__render = W.composer.render.bind(W.composer);
    W.composer.render = on ? (dt) => { const p = W.player.group.position; W.camera.position.set(p.x - 1.2, p.y + 1.0, 3.8); W.camera.lookAt(p.x + 0.3, p.y, 0); W.__render(dt); } : W.__render;
  },
};
window.__nd3d = { game, demo, World, save, loop, dev };
// API para módulos que se cargan después (src/editor.js): ver docs en el README.
window.ND3D = Object.assign(window.ND3D || {}, {
  World, game, save, persist, showScreen, startCustom, previewLevel, click, unlockAudio,
  songOf,
  backToMenu() { previewLevel(game.sel); showScreen('menu'); },
});
window.dispatchEvent(new Event('nd3d-ready'));
requestAnimationFrame(loop);
