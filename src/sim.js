/*
 * NEON DASH — simulación de física.
 *
 * Módulo puro y determinista: sin DOM, sin Math.random, sin tiempo real.
 * El juego y los tests en Node usan exactamente este archivo.
 *
 * Unidades: 1 bloque = 30 u. El suelo está en y = 0 y la posición del jugador
 * es el centro de su hitbox. Las velocidades verticales van en u por "frame de
 * 60 Hz", igual que el motor original, y se integran con el factor 0.9.
 * La física corre a 240 ticks por segundo.
 */
(function (root) {
  'use strict';

  const TPS = 240;
  const DT = 60 / TPS;      // un tick medido en frames de 60 Hz (0.25)
  const YDT = DT * 0.9;     // paso de integración vertical
  const BLOCK = 30;

  // Velocidad horizontal (u/s), modificador interno y escala de giro de la bola.
  const SPEEDS = {
    0.5: { ups: 251.16, mod: 0.7, ballK: 1.2405638 },
    1:   { ups: 311.58, mod: 0.9, ballK: 1 },
    2:   { ups: 387.42, mod: 1.1, ballK: 0.80424345 },
    3:   { ups: 468.0,  mod: 1.3, ballK: 0.6657693 },
    4:   { ups: 576.0,  mod: 1.6, ballK: 0.5409375 },
  };

  const P = {
    JUMP: 11.180032,
    GRAVITY: 0.958199,
    FLY_GRAVITY: 0.9582,
    TERMINAL: 15,
    FLY_MAX_UP: 8,
    FLY_MAX_DOWN: -6.4,
    UFO_FLAP: 7,
    BALL_MULT: 0.6,
    CUBE_SPIN: 180 / 0.43333334,  // grados/s: media vuelta por salto
    CUBE_SPIN_MINI: 180 / 0.33333334,
    PAD_SPIN: 270,
    BALL_SPIN: 600,
    HALF: 15,          // media hitbox exterior
    INNER_HALF: 4.5,   // hitbox interior (30 %) para choques con bloques
    WAVE_HALF: 5,
    SNAP: 10,          // margen de aterrizaje sobre bordes
    SNAP_FLY: 6,
    PAD_V: { yellow: 16, pink: 10.4, red: 20 },
    ORB_K: { yellow: 1, pink: 0.65, red: 1.38, green: 1 },
    BLACK_V: -14,      // orbe negro: caída en picado (marco de la gravedad)
    GRAV_KICK: 0.5,    // impulso hacia el nuevo suelo tras orbe/pad azul (× JUMP)
    CORRIDOR: { ship: 300, ufo: 300, wave: 300, ball: 240, swing: 300 },
    // Robot: salto de altura variable. Sale a ROBOT_V y, mientras se mantiene (hasta ROBOT_HOLD ticks ≈ 0,35 s),
    // la gravedad sólo le frena un ROBOT_HOLD_G: un toque es un saltito (~1 bloque), una pulsación media ~2 y
    // mantener del todo ~3,3. El margen de 0,35 s es para que se note la diferencia con pulsaciones humanas.
    ROBOT_V: 6,
    ROBOT_HOLD: 84,
    ROBOT_HOLD_G: 0.12,
    // Araña: alcance máximo del teletransporte hasta la superficie de enfrente (u).
    SPIDER_REACH: 450,
    // Columpio: gravedad hacia el lado actual y velocidad terminal (cada toque invierte la gravedad).
    SWING_G: 0.479,
    SWING_MAX: 6.4,
    // Tamaño mini (valores del motor original)
    MINI: 0.6,
    MINI_JUMP: 0.8,
    MINI_FLY: 0.85,
    MINI_MAX_UP: 9.4118,
    MINI_MAX_DOWN: -7.5294,
    UFO_FLAP_MINI: 8,
    SAW_K: 0.85,       // radio del círculo de daño respecto al dibujo
  };

  const FLYING = { ship: true, ufo: true, wave: true, swing: true };
  // Modos de suelo: sin corredor, con la gravedad del cubo.
  const GROUND = { cube: true, robot: true, spider: true };

  // ---------------------------------------------------------------- nivel

  function setBox(o, x0, y0, x1, y1) { o.x0 = x0; o.y0 = y0; o.x1 = x1; o.y1 = y1; }

  // Altura de la rampa en x. dir 1 = sube hacia la derecha ("/"), -1 = baja ("\").
  function slopeY(o, x) {
    const t = Math.max(0, Math.min(1, (x - o.x0) / (o.x1 - o.x0)));
    return o.y0 + (o.y1 - o.y0) * (o.dir > 0 ? t : 1 - t);
  }

  // ¿Toca el rectángulo la parte sólida de la rampa? Una rampa normal es sólida bajo la diagonal;
  // una rampa de techo (o.ceil) es sólida por encima.
  function slopeHit(o, bx0, by0, bx1, by1) {
    if (bx1 <= o.x0 || bx0 >= o.x1 || by1 <= o.y0 || by0 >= o.y1) return false;
    const xa = Math.max(bx0, o.x0), xb = Math.min(bx1, o.x1);
    if (o.ceil) return by1 > Math.min(slopeY(o, xa), slopeY(o, xb)) + 0.01;
    return by0 < Math.max(slopeY(o, xa), slopeY(o, xb)) - 0.01;
  }

  // ------------------------------------------------------- triggers de grupo
  /*
   * Grupos: cualquier objeto (o decorado) puede llevar `group: n` o `groups: [n, m]` (enteros).
   * Triggers en def.triggers, ordenados por x (bloques). Cada uno se activa cuando la x del jugador pasa por
   * él y su efecto es una función pura de esa x: no hay estado de triggers en la partida (el bot y keyOf no
   * cambian). Los que afectan a la física (move, rotate, toggle, follow) mueven las cajas de choque.
   *   move:      { x, group, dx, dy (bloques), dur (bloques de avance), ease }
   *   rotate:    { x, group, deg (+ = horario), dur, ease, cx?, cy? (centro en bloques; si no, el del grupo) }
   *   alpha:     { x, group, alpha, dur, ease }   (sólo visual; 'fade' es el nombre antiguo)
   *   toggle:    { x, group, on: true | false }   (apagado: no choca y no se dibuja)
   *   spawn:     { x, target, delay (bloques) }  dispara los triggers con spawnOnly: true cuyo `id` es target
   *              (o, si no tienen id, cuyo `group` es target) como si estuvieran en x + delay.
   *   follow:    { x, group, follower, dur, kx, ky }  el grupo follower copia el desplazamiento (move) de group
   *              multiplicado por kx, ky durante dur bloques (dur 0 = hasta el final).
   *   camzoom:   { x, zoom, dur, ease }   camoffset: { x, dx, dy, dur, ease }   camrotate: { x, deg, dur, ease }
   *              (cámara, sólo visual; zoom 2 = el doble de cerca)
   * Aproximación del giro en la física: el centro de cada objeto gira exacto alrededor del centro del grupo;
   * su caja gira al múltiplo de 90° más cercano (exacto para giros de 90°, 180°, 270°). Las sierras son
   * círculos, así que con ellas el giro es exacto con cualquier ángulo.
   */
  const EASE = {
    linear: (t) => t,
    in: (t) => t * t,
    out: (t) => 1 - (1 - t) * (1 - t),
    inout: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    bounce: (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; },
  };
  const easeOf = (name) => EASE[name] || EASE.inout;
  // Triggers que cambian dónde chocan los objetos de su grupo.
  const PHYS_KINDS = { move: 'group', rotate: 'group', toggle: 'group', follow: 'follower' };

  function groupsOf(o) {
    let g = null;
    if (Array.isArray(o.groups)) for (const v of o.groups) if (Number.isInteger(v)) (g || (g = [])).push(v);
    if (Number.isInteger(o.group) && !(g && g.includes(o.group))) (g || (g = [])).unshift(o.group);
    return g;
  }

  // Lista efectiva de triggers: los normales en su x y los lanzados por spawn en x + delay (en cadena, hasta
  // 8 niveles). Devuelve [{ tr, x (u) }] ordenada por x.
  function expandTriggers(def) {
    const src = ((def && def.triggers) || []).filter((t) => t && typeof t.x === 'number' && isFinite(t.x));
    const out = [];
    const match = (t, target) => t.id != null ? t.id === target : t.group === target;
    const add = (tr, x, depth) => {
      out.push({ tr, x });
      if (tr.kind !== 'spawn' || depth >= 8 || tr.target == null) return;
      const d = (typeof tr.delay === 'number' && isFinite(tr.delay) ? Math.max(0, tr.delay) : 0) * BLOCK;
      for (const t2 of src) if (t2.spawnOnly && t2 !== tr && match(t2, tr.target)) add(t2, x + d, depth + 1);
    };
    for (const tr of src) if (!tr.spawnOnly) add(tr, tr.x * BLOCK, 0);
    out.sort((a, b) => a.x - b.x); // estable: a igual x, el orden del nivel
    return out;
  }

  // Desplazamiento (u) de un grupo sólo por sus triggers move, en la x dada.
  function moveOffset(T, g, x) {
    let dx = 0, dy = 0;
    for (const { tr, x: tx } of T) {
      if (tx > x) break;
      if (tr.kind !== 'move' || tr.group !== g) continue;
      const dur = (tr.dur || 0) * BLOCK;
      const e = easeOf(tr.ease)(dur > 0 ? Math.min(1, (x - tx) / dur) : 1);
      dx += (tr.dx || 0) * BLOCK * e; dy += (tr.dy || 0) * BLOCK * e;
    }
    return [dx, dy];
  }

  function computeGroupState(L, T, x) {
    const out = { off: {}, rot: {}, center: {}, alpha: {}, hidden: {}, cam: { zoom: 1, dx: 0, dy: 0, deg: 0 } };
    const cam = out.cam;
    for (const { tr, x: tx } of T) {
      if (tx > x) break;
      const dur = (tr.dur || 0) * BLOCK;
      const p = dur > 0 ? Math.min(1, (x - tx) / dur) : 1;
      const e = easeOf(tr.ease)(p);
      const g = tr.group;
      switch (tr.kind) {
        case 'move': {
          const o = out.off[g] || (out.off[g] = [0, 0]);
          o[0] += (tr.dx || 0) * BLOCK * e; o[1] += (tr.dy || 0) * BLOCK * e;
          break;
        }
        case 'rotate':
          out.rot[g] = (out.rot[g] || 0) + (tr.deg || 0) * e;
          if (typeof tr.cx === 'number' && typeof tr.cy === 'number') out.center[g] = [tr.cx * BLOCK, tr.cy * BLOCK];
          break;
        case 'alpha': case 'fade': {
          const from = out.alpha[g] != null ? out.alpha[g] : 1;
          const to = typeof tr.alpha === 'number' ? tr.alpha : 1;
          out.alpha[g] = from + (to - from) * e;
          break;
        }
        case 'toggle':
          if (tr.on === false) out.hidden[g] = true; else delete out.hidden[g];
          break;
        case 'follow': {
          if (tr.follower == null) break;
          const xe = dur > 0 ? Math.min(x, tx + dur) : x;
          const a = moveOffset(T, g, tx), b = moveOffset(T, g, xe);
          const kx = typeof tr.kx === 'number' ? tr.kx : 1, ky = typeof tr.ky === 'number' ? tr.ky : 1;
          const o = out.off[tr.follower] || (out.off[tr.follower] = [0, 0]);
          o[0] += (b[0] - a[0]) * kx; o[1] += (b[1] - a[1]) * ky;
          break;
        }
        case 'camzoom': { const to = tr.zoom > 0 ? tr.zoom : 1; cam.zoom += (to - cam.zoom) * e; break; }
        case 'camoffset':
          cam.dx += ((tr.dx || 0) * BLOCK - cam.dx) * e;
          cam.dy += ((tr.dy || 0) * BLOCK - cam.dy) * e;
          break;
        case 'camrotate': cam.deg += ((tr.deg || 0) - cam.deg) * e; break;
      }
    }
    for (const g in out.rot) if (!out.center[g]) out.center[g] = (L.gcenter && L.gcenter[g]) || [0, 0];
    return out;
  }

  /*
   * Estado de los grupos para la x del jugador (u). Función pura de x (con una caché de dos entradas):
   * { off: {g: [dx, dy] u}, rot: {g: grados, + = horario}, center: {g: [cx, cy] u}, alpha: {g: 0..1},
   *   hidden: {g: true}, cam: { zoom, dx, dy (u), deg } }. No hay que modificar el resultado.
   */
  function groupState(L, x) {
    const T = L.trigs || (L.trigs = expandTriggers(L.def));
    const c = L._gsc || (L._gsc = [null, null]);
    if (c[0] && c[0].x === x) return c[0].v;
    if (c[1] && c[1].x === x) return c[1].v;
    const v = computeGroupState(L, T, x);
    c[1] = c[0]; c[0] = { x, v };
    return v;
  }

  // Transformación de un objeto con los grupos `grp` (lista de enteros) en el estado gs: desplazamiento,
  // giro (el del primer grupo que gire) y centro, apagado y transparencia. La usan la física y el dibujo.
  function groupXform(gs, grp) {
    let dx = 0, dy = 0, rot = 0, c = null, hidden = false, alpha = 1;
    if (grp) for (const g of grp) {
      const f = gs.off[g];
      if (f) { dx += f[0]; dy += f[1]; }
      if (gs.hidden[g]) hidden = true;
      if (gs.alpha[g] != null) alpha *= gs.alpha[g];
      if (!c && gs.rot[g]) { rot = gs.rot[g]; c = gs.center[g]; }
    }
    return { dx, dy, rot, c, hidden, alpha };
  }

  // Esquina del ángulo recto de una rampa, en orden horario: 0 abajo-izq, 1 arriba-izq, 2 arriba-der, 3 abajo-der.
  const SLOPE_CORNER = (dir, ceil) => (ceil ? (dir > 0 ? 1 : 2) : (dir > 0 ? 3 : 0));

  // Coloca los objetos de grupos con triggers físicos según la x. prev = true escribe la posición anterior
  // (q0, q1, qx0, qx1, qoff) que usa el arrastre de plataformas.
  function placeDyn(L, x, prev) {
    if (prev ? L._dynPX === x : L._dynX === x) return;
    if (prev) L._dynPX = x; else L._dynX = x;
    const gs = groupState(L, x);
    for (const o of L.dyn) {
      const t = groupXform(gs, o.grp);
      let px = o.bpx, py = o.bpy, k = 0;
      if (t.rot) {
        const a = -t.rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
        const rx = px - t.c[0], ry = py - t.c[1];
        px = t.c[0] + rx * ca - ry * sa;
        py = t.c[1] + rx * sa + ry * ca;
        k = ((Math.round(t.rot / 90) % 4) + 4) % 4;
      }
      px += t.dx; py += t.dy;
      let a0 = o.lb[0], b0 = o.lb[1], a1 = o.lb[2], b1 = o.lb[3];
      for (let i = 0; i < k; i++) { const n0 = b0, n1 = -a1, n2 = b1, n3 = -a0; a0 = n0; b0 = n1; a1 = n2; b1 = n3; } // 90° horario
      if (prev) { o.qx0 = px + a0; o.q0 = py + b0; o.qx1 = px + a1; o.q1 = py + b1; o.qoff = t.hidden; continue; }
      o.off = t.hidden;
      setBox(o, px + a0, py + b0, px + a1, py + b1);
      if (o.circle) { o.cx = px; o.cy = py; }
      if (o.slope) {
        const cn = (SLOPE_CORNER(o.bdir, o.bceil) + k) % 4;
        o.dir = cn === 3 || cn === 1 ? 1 : -1;
        o.ceil = cn === 1 || cn === 2;
        o.angle = -o.dir * Math.atan2(o.y1 - o.y0, o.x1 - o.x0) * 180 / Math.PI;
      }
    }
  }

  // Plataformas en movimiento: si el jugador estaba apoyado en un sólido de un grupo, se mueve con él en
  // vertical (en horizontal el jugador siempre avanza a su velocidad, como en el original).
  function carry(L, s, wasGrounded) {
    if (!wasGrounded) return;
    placeDyn(L, s.px, true);
    const half = halfOf(s), f = s.flip, feet = s.py - f * half;
    let best = 0, found = false;
    for (const o of L.dyn) {
      if (!o.solid || o.off || o.qoff) continue;
      if (!(o.qx0 < s.px + half && o.qx1 > s.px - half)) continue;
      const was = f > 0 ? o.q1 : o.q0;
      if (Math.abs(feet - was) > 0.5) continue;
      const d = (f > 0 ? o.y1 : o.y0) - was;
      if (!found || d * f > best * f) { best = d; found = true; }
    }
    if (found) s.y += best;
  }

  function compileLevel(def) {
    const objs = [];
    const cols = Object.create(null);
    const dyn = [];
    // grupos con triggers que cambian la física: sus objetos van a la lista dinámica, no a las columnas
    const physG = new Set();
    for (const tr of def.triggers || []) if (tr && PHYS_KINDS[tr.kind] && tr[PHYS_KINDS[tr.kind]] != null) physG.add(tr[PHYS_KINDS[tr.kind]]);
    const gbox = Object.create(null);
    const growBox = (g, x0, y0, x1, y1) => {
      const b = gbox[g] || (gbox[g] = [Infinity, Infinity, -Infinity, -Infinity]);
      b[0] = Math.min(b[0], x0); b[1] = Math.min(b[1], y0); b[2] = Math.max(b[2], x1); b[3] = Math.max(b[3], y1);
    };
    for (const raw of def.objects) {
      const o = Object.assign({}, raw);
      o.id = objs.length;
      o._q = 0;
      const X = o.x * BLOCK, Y = o.y * BLOCK;
      const r = o.r || 0;
      switch (o.t) {
        case 'block': {
          o.solid = true;
          setBox(o, X, Y, X + (o.w || 1) * BLOCK, Y + (o.h || 1) * BLOCK);
          break;
        }
        case 'slope': {
          o.slope = true;
          o.dir = o.dir || 1;
          setBox(o, X, Y, X + (o.w || 1) * BLOCK, Y + (o.h || 1) * BLOCK);
          // Ángulo de la superficie en grados, positivo = sentido horario en pantalla.
          o.angle = -o.dir * Math.atan2(o.y1 - o.y0, o.x1 - o.x0) * 180 / Math.PI;
          break;
        }
        case 'spike': {
          o.hazard = true;
          const small = o.size === 0.5;
          const cx = X + 15, cy = Y + 15;
          // Rectángulo central pequeño, siempre dentro del triángulo visible.
          const a0 = small ? 2 : 9, a1 = small ? 8 : 21;
          if (r === 0) setBox(o, cx - 3, Y + a0, cx + 3, Y + a1);
          else if (r === 180) setBox(o, cx - 3, Y + 30 - a1, cx + 3, Y + 30 - a0);
          else if (r === 90) setBox(o, X + a0, cy - 3, X + a1, cy + 3);
          else setBox(o, X + 30 - a1, cy - 3, X + 30 - a0, cy + 3);
          break;
        }
        case 'saw': {
          o.hazard = true;
          o.circle = true;
          o.cx = X + 15;
          o.cy = Y + 15;
          o.rad = (o.size || 1) * 15 * P.SAW_K;
          setBox(o, o.cx - o.rad, o.cy - o.rad, o.cx + o.rad, o.cy + o.rad);
          break;
        }
        case 'pad': {
          o.trigger = true;
          if (r === 180) setBox(o, X + 2, Y + 26, X + 28, Y + 30);
          else setBox(o, X + 2, Y, X + 28, Y + 4);
          break;
        }
        case 'orb': {
          o.trigger = true;
          setBox(o, X + 15 - 18, Y + 15 - 18, X + 15 + 18, Y + 15 + 18);
          break;
        }
        case 'coin': {
          o.trigger = true;
          setBox(o, X + 3, Y + 3, X + 27, Y + 27);
          break;
        }
        case 'portal': {
          o.trigger = true;
          // girado 90° o 270°: el portal queda tumbado y se cruza en vertical
          if (r === 90 || r === 270) setBox(o, X + 15 - 50, Y + 15 - 12, X + 15 + 50, Y + 15 + 12);
          else setBox(o, X + 15 - 12, Y + 15 - 50, X + 15 + 12, Y + 15 + 50);
          break;
        }
        default:
          o.deco = true;
      }
      objs.push(o);
      const grp = groupsOf(raw);
      if (grp) {
        o.grp = grp;
        // caja visible (para el centro del grupo) y pivote del objeto (centro de su caja o de su celda)
        const vb = o.solid || o.slope ? [o.x0, o.y0, o.x1, o.y1] : [X, Y, X + BLOCK, Y + BLOCK];
        for (const g of grp) growBox(g, vb[0], vb[1], vb[2], vb[3]);
        if (!o.deco && grp.some((g) => physG.has(g))) {
          o.dyn = true;
          o.bpx = (vb[0] + vb[2]) / 2; o.bpy = (vb[1] + vb[3]) / 2;
          o.lb = [o.x0 - o.bpx, o.y0 - o.bpy, o.x1 - o.bpx, o.y1 - o.bpy];
          o.base = { x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1, cx: o.cx, cy: o.cy, dir: o.dir, ceil: o.ceil, angle: o.angle };
          if (o.slope) { o.bdir = o.dir; o.bceil = !!o.ceil; }
          o.off = false;
          dyn.push(o);
          continue;
        }
      }
      if (o.deco) continue;
      for (let c = Math.floor(o.x0 / BLOCK); c <= Math.floor(o.x1 / BLOCK); c++) {
        (cols[c] || (cols[c] = [])).push(o.id);
      }
    }
    for (const d of def.decos || []) {
      const grp = groupsOf(d);
      if (grp) for (const g of grp) growBox(g, d.x * BLOCK, d.y * BLOCK, d.x * BLOCK, d.y * BLOCK);
    }
    const gcenter = Object.create(null);
    for (const g in gbox) gcenter[g] = [(gbox[g][0] + gbox[g][2]) / 2, (gbox[g][1] + gbox[g][3]) / 2];
    return {
      id: def.id,
      name: def.name,
      def,
      objs,
      cols,
      dyn,
      gcenter,
      trigs: expandTriggers(def),
      _dynX: NaN, _dynPX: NaN,
      endX: def.length * BLOCK,
      startMode: def.startMode || 'cube',
      startSpeed: def.startSpeed || 1,
      coins: objs.filter((o) => o.t === 'coin').map((o) => o.id),
      _stamp: 0,
      _buf: [],
    };
  }

  function query(L, x0, x1) {
    const out = L._buf;
    out.length = 0;
    const stamp = ++L._stamp;
    const c1 = Math.floor(x1 / BLOCK);
    for (let c = Math.floor(x0 / BLOCK); c <= c1; c++) {
      const list = L.cols[c];
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const o = L.objs[list[i]];
        if (o._q !== stamp) { o._q = stamp; out.push(o); }
      }
    }
    // objetos de grupos con triggers (ya colocados con placeDyn para la x actual): mismas columnas
    const dyn = L.dyn;
    if (dyn && dyn.length) {
      const c0 = Math.floor(x0 / BLOCK);
      for (let i = 0; i < dyn.length; i++) {
        const o = dyn[i];
        if (!o.off && Math.floor(o.x0 / BLOCK) <= c1 && Math.floor(o.x1 / BLOCK) >= c0) out.push(o);
      }
    }
    return out;
  }

  function hit(o, x0, y0, x1, y1) {
    return o.x0 < x1 && o.x1 > x0 && o.y0 < y1 && o.y1 > y0;
  }

  function circleHit(o, x0, y0, x1, y1) {
    const cx = Math.max(x0, Math.min(x1, o.cx)), cy = Math.max(y0, Math.min(y1, o.cy));
    const dx = cx - o.cx, dy = cy - o.cy;
    return dx * dx + dy * dy < o.rad * o.rad;
  }

  // --------------------------------------------------------------- estado

  function createState(L) {
    const s = {
      tick: 0,
      x: 0, y: P.HALF, vy: 0,
      px: 0, py: P.HALF, prot: 0,
      flip: 1,
      mode: L.startMode,
      speed: L.startSpeed,
      mini: false,
      lo: 0, hi: Infinity,
      grounded: true, onCeil: false,
      slope: null, slopeU: 0,
      rot: 0, spinning: false, spinRate: 0,
      boost: 0,          // robot: ticks que aún puede sostener el salto
      held: false, jumpBuf: false, ringBuf: false,
      dead: false, won: false, cause: null,
      jumps: 0, coins: 0,
      used: {},
      events: [],
      twin: null,        // modo dual: el gemelo (mismo tipo de objeto, con isTwin = true)
    };
    if (P.CORRIDOR[s.mode]) s.hi = P.CORRIDOR[s.mode];
    return s;
  }

  function cloneState(s) {
    const c = Object.assign({}, s);
    c.used = Object.assign({}, s.used);
    c.events = s.events ? [] : null;
    if (s.twin) {
      c.twin = Object.assign({}, s.twin);
      c.twin.used = c.used; // los objetos usados son comunes a los dos
      c.twin.events = c.events;
    }
    return c;
  }

  function emit(s, type, extra) {
    if (!s.events) return;
    const e = { type, x: s.x, y: s.y, tick: s.tick };
    if (s.isTwin) e.twin = true;
    if (extra) Object.assign(e, extra);
    s.events.push(e);
  }

  // Superficie más cercana en la vertical del jugador, buscando hacia arriba (dir = 1) o hacia abajo (-1):
  // cara de bloque, cara plana o diagonal de rampa, o el límite del corredor. Devuelve la y de la
  // superficie o null si no hay ninguna al alcance. No usa el búfer de query (se llama desde los bucles
  // de collide).
  function findSurface(L, s, dir, half, reach) {
    const x0 = s.x - half, x1 = s.x + half;
    const from = s.y + dir * half;
    let best = dir > 0 ? s.hi : s.lo;
    const seen = Object.create(null);
    const dyn = L.dyn && L.dyn.length ? L.dyn : null;
    if (dyn) placeDyn(L, s.x);
    for (let c = Math.floor(x0 / BLOCK), c1 = Math.floor(x1 / BLOCK); c <= c1 + (dyn ? 1 : 0); c++) {
      const list = c <= c1 ? L.cols[c] : dyn; // la vuelta extra recorre los objetos dinámicos
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const o = c <= c1 ? L.objs[list[i]] : list[i];
        if (o.off) continue;
        if (seen[o.id]) continue;
        seen[o.id] = 1;
        if (!o.solid && !o.slope) continue;
        if (!(o.x0 < x1 && o.x1 > x0)) continue;
        let face;
        if (o.solid || (dir > 0 ? !o.ceil : o.ceil)) face = dir > 0 ? o.y0 : o.y1;
        else {
          const xa = Math.max(o.x0, x0), xb = Math.min(o.x1, x1);
          face = dir > 0 ? Math.min(slopeY(o, xa), slopeY(o, xb)) : Math.max(slopeY(o, xa), slopeY(o, xb));
        }
        if (dir > 0 ? face >= from - 0.5 && face < best : face <= from + 0.5 && face > best) best = face;
      }
    }
    if (!isFinite(best) || Math.abs(best - from) > (reach || P.SPIDER_REACH)) return null;
    return best;
  }

  // Modo dual: crea el gemelo en el lado opuesto, a la misma distancia de su superficie que el jugador
  // de la suya, con la gravedad contraria y la misma entrada.
  function makeTwin(L, s) {
    const f = s.flip, half = halfOf(s);
    const up = findSurface(L, s, f, half, 40 * BLOCK);
    const down = findSurface(L, s, -f, half, 40 * BLOCK);
    const d = down != null ? (s.y - down) * f : half;
    const y = up != null ? up - f * d : s.y;
    return {
      isTwin: true,
      tick: s.tick,
      x: s.x, y, vy: -s.vy,
      px: s.x, py: y, prot: -s.rot,
      flip: -f,
      mode: s.mode, speed: s.speed, mini: s.mini,
      lo: s.lo, hi: s.hi,
      grounded: false, onCeil: false,
      slope: null, slopeU: 0,
      rot: -s.rot, spinning: s.spinning, spinRate: s.spinRate,
      boost: s.boost,
      held: s.held, jumpBuf: s.jumpBuf, ringBuf: false,
      dead: false, won: false, cause: null,
      jumps: 0, coins: 0,
      used: s.used,
      events: s.events,
      twin: null,
    };
  }

  // Medidas del jugador según modo y tamaño.
  function halfOf(s) { return (s.mode === 'wave' ? P.WAVE_HALF : P.HALF) * (s.mini ? P.MINI : 1); }
  function innerOf(s) { return P.INNER_HALF * (s.mini ? P.MINI : 1); }
  function spinOf(s) { return s.mini ? P.CUBE_SPIN_MINI : P.CUBE_SPIN; }

  // Entrada. Pulsar arma el salto y el búfer de orbes; soltar los cancela. El gemelo recibe la misma entrada.
  function press(s) {
    if (s.twin) press(s.twin);
    if (s.held) return;
    s.held = true;
    s.jumpBuf = true;
    s.ringBuf = true;
  }

  function release(s) {
    if (s.twin) release(s.twin);
    s.held = false;
    s.jumpBuf = false;
    s.ringBuf = false;
  }

  // ---------------------------------------------------------------- paso

  function step(L, s) {
    if (s.dead || s.won) return;
    const dx = SPEEDS[s.speed].ups / TPS;
    const twin = s.twin;
    stepBody(L, s, dx, twin);

    // El gemelo (si ya existía al empezar el tick) avanza igual; si muere uno, muere la partida.
    if (!s.dead && twin && s.twin === twin) {
      twin.tick = s.tick;
      twin.events = s.events;
      stepBody(L, twin, dx, s);
      s.jumps += twin.jumps; twin.jumps = 0;
      s.coins += twin.coins; twin.coins = 0;
      if (twin.dead) {
        s.dead = true;
        s.cause = twin.cause;
        emit(s, 'death', { cause: twin.cause, x: twin.x, y: twin.y, twin: true });
      }
    }
    s.tick++;

    if (!s.dead && s.x >= L.endX) {
      s.won = true;
      emit(s, 'win');
    }
  }

  function stepBody(L, s, dx, partner) {
    s.px = s.x; s.py = s.y; s.prot = s.rot;
    updateJump(L, s);
    s.x += dx;
    s.y += s.vy * YDT;
    collide(L, s, partner);
    if (!s.dead) updateRotation(s);
  }

  function startSpin(s, rate) {
    s.spinning = true;
    s.spinRate = rate;
  }

  function updateJump(L, s) {
    let u = s.vy * s.flip; // velocidad en el marco de la gravedad (+ = alejándose del suelo)
    const v16 = s.mini ? (FLYING[s.mode] ? P.MINI_FLY : P.MINI_JUMP) : 1;
    const maxUp = s.mini ? P.MINI_MAX_UP : P.FLY_MAX_UP;
    const maxDown = s.mini ? P.MINI_MAX_DOWN : P.FLY_MAX_DOWN;

    switch (s.mode) {
      case 'cube': {
        if (s.grounded && s.jumpBuf) {
          u = P.JUMP * v16;
          // En una rampa de subida el salto hereda parte del impulso (como en el original).
          if (s.slopeU > 0) u = Math.min(u * 1.4, u + s.slopeU * 0.25);
          s.slopeU = 0;
          s.grounded = false;
          s.ringBuf = false;
          s.jumps++;
          startSpin(s, spinOf(s));
          emit(s, 'jump');
        } else {
          u -= P.GRAVITY * YDT;
          if (u < -P.TERMINAL) u = -P.TERMINAL;
          // Al salir por arriba de una rampa conserva la velocidad de subida.
          if (!s.grounded && s.slopeU > 0) { if (u < s.slopeU) u = s.slopeU; s.slopeU = 0; }
          if (!s.grounded && !s.spinning && u < 0) startSpin(s, spinOf(s));
        }
        break;
      }
      case 'robot': {
        // Salto de altura variable: arranca a ROBOT_V y, mientras se pulsa, la gravedad casi no le frena.
        const v = P.ROBOT_V * v16;
        if (!s.held) s.boost = 0;
        if (s.grounded && s.jumpBuf) {
          u = v;
          if (s.slopeU > 0) u = Math.min(u * 1.4, u + s.slopeU * 0.25);
          s.slopeU = 0;
          s.boost = P.ROBOT_HOLD;
          s.grounded = false;
          s.ringBuf = false;
          s.jumps++;
          emit(s, 'jump');
        } else if (s.boost > 0 && u > 0) {
          s.boost--;
          u -= P.GRAVITY * P.ROBOT_HOLD_G * YDT;
        } else {
          s.boost = 0;
          u -= P.GRAVITY * YDT;
          if (u < -P.TERMINAL) u = -P.TERMINAL;
          if (!s.grounded && s.slopeU > 0) { if (u < s.slopeU) u = s.slopeU; s.slopeU = 0; }
        }
        break;
      }
      case 'spider': {
        // Un toque en el suelo lleva al instante a la superficie de enfrente e invierte la gravedad.
        if (s.grounded && s.jumpBuf) {
          const half = halfOf(s);
          const fromY = s.y;
          const surf = findSurface(L, s, s.flip, half);
          s.flip = -s.flip;
          s.slopeU = 0;
          s.grounded = false;
          s.jumpBuf = false;
          s.ringBuf = false;
          s.jumps++;
          if (surf != null) {
            s.y = surf + s.flip * half;
            s.py = s.y; // sin interpolar: el render dibuja el rastro con el evento
            u = 0;
          } else u = -P.JUMP * P.GRAV_KICK; // sin superficie: cae hacia el nuevo suelo, como la bola
          emit(s, 'teleport', { fromY, toY: s.y });
        } else {
          u -= P.GRAVITY * YDT;
          if (u < -P.TERMINAL) u = -P.TERMINAL;
          if (!s.grounded && s.slopeU > 0) { if (u < s.slopeU) u = s.slopeU; s.slopeU = 0; }
        }
        s.vy = u * s.flip;
        return;
      }
      case 'swing': {
        // Cada toque invierte la gravedad; la velocidad se curva hacia el nuevo lado (zigzag en arcos).
        if (s.held && s.ringBuf) {
          s.ringBuf = false;
          s.flip = -s.flip;
          u = -u; // misma velocidad, medida en el marco de la nueva gravedad
          s.grounded = false;
          s.slopeU = 0;
          s.jumps++;
          emit(s, 'flap');
        }
        u -= P.SWING_G * YDT / v16;
        if (!s.grounded && s.slopeU > 0) { if (u < s.slopeU) u = s.slopeU; s.slopeU = 0; }
        const m = P.SWING_MAX * (s.mini ? P.MINI_MAX_UP / P.FLY_MAX_UP : 1);
        u = Math.max(-m, Math.min(m, u));
        s.vy = u * s.flip;
        return;
      }
      case 'ball': {
        if (s.grounded && s.jumpBuf) {
          s.flip = -s.flip;
          u = -P.JUMP * P.BALL_MULT * v16; // sale disparada hacia el nuevo suelo
          s.slopeU = 0;
          s.grounded = false;
          s.jumpBuf = false;
          s.ringBuf = false;
          s.jumps++;
          emit(s, 'jump');
        } else {
          u -= P.FLY_GRAVITY * P.BALL_MULT * YDT;
          if (u < -P.TERMINAL) u = -P.TERMINAL;
          if (!s.grounded && s.slopeU > 0) { if (u < s.slopeU) u = s.slopeU; s.slopeU = 0; }
        }
        break;
      }
      case 'ship': {
        const g = P.FLY_GRAVITY;
        const falling = u < 2 * g;
        if (s.held) u += g * (falling ? 0.5 : 0.4) * YDT / v16;
        else u -= g * (falling ? 0.8 : 1.2) * 0.4 * YDT / v16;
        // Al salir por arriba de una rampa conserva la velocidad de subida (como el cubo y la bola).
        if (!s.grounded && s.slopeU > 0) { if (u < s.slopeU) u = s.slopeU; s.slopeU = 0; }
        u = Math.max(maxDown, Math.min(maxUp, u));
        break;
      }
      case 'ufo': {
        if (s.held && s.ringBuf) {
          s.ringBuf = false;
          const flap = s.mini ? P.UFO_FLAP_MINI * v16 : P.UFO_FLAP;
          if (u < flap) u = flap;
          s.jumps++;
          emit(s, 'flap');
        }
        const g = P.FLY_GRAVITY;
        const falling = u < 2 * g;
        u -= g * YDT * (falling ? 0.8 : 1.2) * 0.5 / v16;
        if (!s.grounded && s.slopeU > 0) { if (u < s.slopeU) u = s.slopeU; s.slopeU = 0; }
        u = Math.max(maxDown, Math.min(maxUp, u));
        break;
      }
      case 'wave': {
        // 45° exactos (mini: el doble de pendiente).
        const v = SPEEDS[s.speed].ups / TPS / YDT * (s.mini ? 2 : 1);
        u = s.held ? v : -v;
        break;
      }
    }
    s.vy = u * s.flip;
  }

  function die(s, cause) {
    s.dead = true;
    s.cause = cause;
    if (!s.isTwin) emit(s, 'death', { cause }); // la del gemelo la emite step, una sola vez
  }

  function setMode(s, mode, o) {
    const changed = s.mode !== mode;
    if (changed) {
      s.mode = mode;
      s.vy *= 0.5;
      s.spinning = false;
      s.grounded = false;
      s.slopeU = 0;
      s.boost = 0;
    }
    if (GROUND[mode]) {
      s.lo = 0;
      s.hi = Infinity;
    } else {
      const H = P.CORRIDOR[mode];
      const cy = (o.y0 + o.y1) / 2;
      s.lo = o.floor != null ? o.floor * BLOCK : Math.max(0, Math.round((cy - H / 2) / BLOCK) * BLOCK);
      s.hi = s.lo + H;
    }
    emit(s, 'portal', { kind: mode, changed, id: o.id });
  }

  // partner: el otro jugador en modo dual (los portales de modo, tamaño y velocidad cambian a los dos).
  function applyPortal(L, s, o, partner) {
    s.used[o.id] = 1;
    switch (o.kind) {
      case 'dual':
        if (!s.isTwin && !s.twin) {
          s.twin = makeTwin(L, s);
          emit(s, 'portal', { kind: 'dual', id: o.id, twinY: s.twin.y });
        }
        break;
      case 'single':
        if (s.isTwin && partner) { partner.twin = null; emit(s, 'portal', { kind: 'single', id: o.id }); }
        else if (s.twin) { s.twin = null; emit(s, 'portal', { kind: 'single', id: o.id }); }
        break;
      case 'flip':
        if (s.flip > 0) { s.flip = -1; s.vy *= 0.5; s.grounded = false; emit(s, 'portal', { kind: 'flip', id: o.id }); }
        break;
      case 'unflip':
        if (s.flip < 0) { s.flip = 1; s.vy *= 0.5; s.grounded = false; emit(s, 'portal', { kind: 'unflip', id: o.id }); }
        break;
      case 'speed':
        s.speed = o.value;
        if (partner) partner.speed = o.value;
        emit(s, 'portal', { kind: 'speed', value: o.value, id: o.id });
        break;
      case 'mini':
      case 'big':
        if (partner) partner.mini = o.kind === 'mini';
        if (s.mini !== (o.kind === 'mini')) {
          s.mini = o.kind === 'mini';
          emit(s, 'portal', { kind: o.kind, id: o.id });
        }
        break;
      default:
        setMode(s, o.kind, o);
        if (partner) setMode(partner, o.kind, o);
    }
  }

  function applyPad(s, o) {
    s.used[o.id] = 1;
    s.boost = 0;
    const fly = FLYING[s.mode];
    if (o.kind === 'blue') {
      s.flip = -s.flip;
      s.vy = -P.JUMP * P.GRAV_KICK * s.flip;
    } else {
      let u = P.PAD_V[o.kind];
      if (s.mode === 'ball') u *= P.BALL_MULT;
      if (s.mini && !fly) u *= P.MINI_JUMP;
      if (fly) u = Math.min(u, s.mini ? P.MINI_MAX_UP : P.FLY_MAX_UP);
      s.vy = u * s.flip;
    }
    s.grounded = false;
    s.slopeU = 0;
    if (s.mode === 'cube') startSpin(s, P.PAD_SPIN);
    emit(s, 'pad', { kind: o.kind, id: o.id });
  }

  function applyOrb(s, o) {
    s.used[o.id] = 1;
    s.boost = 0;
    s.ringBuf = false;
    if (s.mode === 'ball') s.jumpBuf = false;
    const fly = FLYING[s.mode];
    if (o.kind === 'blue') {
      s.flip = -s.flip;
      s.vy = -P.JUMP * P.GRAV_KICK * s.flip;
    } else if (o.kind === 'black') {
      s.vy = P.BLACK_V * s.flip;
    } else {
      if (o.kind === 'green') s.flip = -s.flip; // invierte la gravedad y salta en el nuevo sentido
      let u = P.JUMP * P.ORB_K[o.kind];
      if (s.mode === 'ball') u *= P.BALL_MULT;
      if (s.mini && !fly) u *= P.MINI_JUMP;
      if (fly) u = Math.min(u, s.mini ? P.MINI_MAX_UP : P.FLY_MAX_UP);
      s.vy = u * s.flip;
    }
    s.grounded = false;
    s.slopeU = 0;
    s.jumps++;
    if (s.mode === 'cube') startSpin(s, spinOf(s));
    emit(s, 'orb', { kind: o.kind, id: o.id });
  }

  function collide(L, s, partner) {
    const wasGrounded = s.grounded;
    const prevSlope = s.slope;
    s.grounded = false;
    s.onCeil = false;
    s.slope = null;

    // 0) Objetos de grupos con triggers: se colocan para esta x y arrastran al jugador que iba encima.
    if (L.dyn && L.dyn.length) {
      placeDyn(L, s.x);
      carry(L, s, wasGrounded);
    }

    // 1) Portales primero: pueden cambiar modo, tamaño, gravedad y límites.
    let near = query(L, s.x - 40, s.x + 40);
    {
      const h0 = halfOf(s);
      for (let i = 0; i < near.length; i++) {
        const o = near[i];
        if (o.t === 'portal' && !s.used[o.id] && hit(o, s.x - h0, s.y - h0, s.x + h0, s.y + h0)) applyPortal(L, s, o, partner);
      }
    }

    const mode = s.mode;
    const f = s.flip;
    const k = s.mini ? P.MINI : 1;
    const half = halfOf(s);
    const snapT = (FLYING[mode] ? P.SNAP_FLY : P.SNAP) * k;
    const canHead = FLYING[mode] || mode === 'ball';

    // 2) Suelo y techo del corredor.
    if (s.y - half < s.lo) {
      s.y = s.lo + half;
      if (s.vy < 0) s.vy = 0;
      if (f > 0) { s.grounded = true; s.slopeU = 0; } else s.onCeil = true;
    }
    if (s.y + half > s.hi) {
      s.y = s.hi - half;
      if (s.vy > 0) s.vy = 0;
      if (f < 0) s.grounded = true; else s.onCeil = true;
    }
    if (s.y > s.lo + 2400 || s.y < s.lo - 600) { die(s, 'out'); return; }

    near = query(L, s.x - half - 2, s.x + half + 2);

    // 3) Bloques sólidos (y la cara plana de las rampas: la de abajo de una rampa normal con la gravedad
    //    invertida, la de arriba de una rampa de techo con la gravedad normal):
    //    aterrizar o pegarse al techo dentro del margen.
    for (let i = 0; i < near.length; i++) {
      const o = near[i];
      if (!o.solid && !(o.slope && (o.ceil ? f > 0 : f < 0))) continue;
      if (!hit(o, s.x - half, s.y - half, s.x + half, s.y + half)) continue;
      if (mode === 'wave') {
        // la onda sólo muere si toca el triángulo, no la mitad vacía de la caja
        if (o.slope && !slopeHit(o, s.x - half, s.y - half, s.x + half, s.y + half)) continue;
        die(s, o.slope ? 'slope' : 'block'); return;
      }

      const u = s.vy * f;
      const surf = f > 0 ? o.y1 : o.y0;
      const pen = (surf - (s.y - f * half)) * f;
      const prevPen = (surf - (s.py - f * half)) * f;
      if (u <= 0 && (pen <= snapT || prevPen <= snapT)) {
        s.y = surf + f * half;
        s.vy = 0;
        s.grounded = true;
        s.slopeU = 0;
        continue;
      }
      // Rampa de techo por encima con la gravedad normal: la diagonal hace de techo (la nave, el ovni
      // y la bola se deslizan por debajo, igual que por los bloques).
      if (canHead && u >= 0 && o.ceil && f > 0) {
        const xa = Math.max(o.x0, s.x - half), xb = Math.min(o.x1, s.x + half);
        const csurf = Math.min(slopeY(o, xa), slopeY(o, xb));
        const hpen = (s.y + half) - csurf;
        if (hpen > 0 && hpen <= snapT + 6) {
          s.y = csurf - half;
          if (s.vy > 0) s.vy = 0;
          s.onCeil = true;
        }
        continue;
      }
      if (canHead && u >= 0 && o.solid) {
        const csurf = f > 0 ? o.y0 : o.y1;
        const hpen = ((s.y + f * half) - csurf) * f;
        const prevHpen = ((s.py + f * half) - csurf) * f;
        if (hpen <= snapT || prevHpen <= snapT) {
          s.y = csurf - f * half;
          s.vy = 0;
          s.onCeil = true;
        }
      }
    }

    // 4) Rampas con gravedad normal: el centro sigue la diagonal.
    if (f > 0) {
      const dx = SPEEDS[s.speed].ups / TPS;
      for (let i = 0; i < near.length; i++) {
        const o = near[i];
        if (!o.slope || o.ceil) continue;
        if (!hit(o, s.x - half, s.y - half, s.x + half, s.y + half)) continue;
        if (mode === 'wave') {
          if (slopeHit(o, s.x - half, s.y - half, s.x + half, s.y + half)) { die(s, 'slope'); return; }
          continue;
        }
        // En las bajadas el jugador se apoya en su esquina de atrás (el punto que de verdad toca la rampa):
        // así empezar y terminar la bajada es continuo, sin caer de golpe ni quedarse flotando.
        const down = o.dir < 0;
        const sup = (x) => slopeY(o, down ? Math.max(o.x0, x - half) : x);
        const sy = sup(s.x);
        const pen = sy - (s.y - half);
        const prevPen = sup(s.px) - (s.py - half);
        const rise = dx * (o.y1 - o.y0) / (o.x1 - o.x0);
        const u = s.vy;
        // Subiendo, el jugador lleva la velocidad vertical de la rampa: al llegar arriba sigue subiendo
        // y cae en parábola (también sobre el bloque de la cima), en vez de frenar en seco.
        const over = down ? s.x - half <= o.x1 && s.x >= o.x0 - half : s.x >= o.x0 && s.x <= o.x1;
        const upV = o.dir > 0 && over && s.x < o.x1 ? rise / YDT : 0;
        // bajando lleva la velocidad de la rampa: si la rampa acaba en el aire, sigue cayendo con ella
        const downV = down && s.x - half < o.x1 ? -rise / YDT : 0;
        // Bajando se mantiene pegado (para poder saltar). Si el hueco es mayor que lo que baja la rampa en
        // un tick (al salir de un bloque a una rampa de bajada), no baja de golpe: desciende el doble de
        // rápido que la rampa hasta alcanzarla.
        const stick = (wasGrounded || prevSlope) && over && pen < 0 && pen > -(half + rise + 2) && u <= 0;
        if (u <= upV + 1e-6 && ((pen >= 0 && (pen <= snapT + rise || prevPen <= snapT)) || stick)) {
          s.y = pen < 0 ? Math.max(sy + half, s.y - 2 * rise - 0.5) : sy + half;
          s.vy = upV || downV;
          s.grounded = true;
          s.slope = o;
          // Subiendo guarda la velocidad vertical; pasada la cima la conserva para el impulso de salida.
          if (o.dir > 0) { if (s.x < o.x1) s.slopeU = rise / YDT; } else s.slopeU = 0;
        }
      }
    }

    // 4b) Rampas de techo con la gravedad invertida: espejo del paso 4, la diagonal hace de suelo.
    if (f < 0) {
      const dx = SPEEDS[s.speed].ups / TPS;
      for (let i = 0; i < near.length; i++) {
        const o = near[i];
        if (!o.slope || !o.ceil) continue;
        if (!hit(o, s.x - half, s.y - half, s.x + half, s.y + half)) continue;
        if (mode === 'wave') {
          if (slopeHit(o, s.x - half, s.y - half, s.x + half, s.y + half)) { die(s, 'slope'); return; }
          continue;
        }
        const down = o.dir > 0;
        const sup = (x) => slopeY(o, down ? Math.max(o.x0, x - half) : x);
        const sy = sup(s.x);
        const pen = (s.y + half) - sy;
        const prevPen = (s.py + half) - sup(s.px);
        const rise = dx * (o.y1 - o.y0) / (o.x1 - o.x0);
        const u = -s.vy;
        const over = down ? s.x - half <= o.x1 && s.x >= o.x0 - half : s.x >= o.x0 && s.x <= o.x1;
        const upV = o.dir < 0 && over && s.x < o.x1 ? rise / YDT : 0;
        const downV = down && s.x - half < o.x1 ? -rise / YDT : 0;
        const stick = (wasGrounded || prevSlope) && over && pen < 0 && pen > -(half + rise + 2) && u <= 0;
        if (u <= upV + 1e-6 && ((pen >= 0 && (pen <= snapT + rise || prevPen <= snapT)) || stick)) {
          s.y = pen < 0 ? Math.min(sy - half, s.y + 2 * rise + 0.5) : sy - half;
          s.vy = -(upV || downV);
          s.grounded = true;
          s.slope = o;
          // con la gravedad invertida "subir" es acercarse al suelo de abajo: rampas de techo descendentes
          if (o.dir < 0) { if (s.x < o.x1) s.slopeU = rise / YDT; } else s.slopeU = 0;
        }
      }
    }

    // 5) Muerte por sólido: la hitbox interior dentro de un bloque o de una rampa.
    const ih = innerOf(s);
    for (let i = 0; i < near.length; i++) {
      const o = near[i];
      if (o.solid && hit(o, s.x - ih, s.y - ih, s.x + ih, s.y + ih)) { die(s, 'block'); return; }
      if (o.slope && slopeHit(o, s.x - ih, s.y - ih, s.x + ih, s.y + ih)) { die(s, 'slope'); return; }
    }

    // 6) Peligros, pads, orbes y monedas con la hitbox exterior.
    const x0 = s.x - half, y0 = s.y - half, x1 = s.x + half, y1 = s.y + half;
    for (let i = 0; i < near.length; i++) {
      const o = near[i];
      if (o.hazard) {
        if (o.circle ? circleHit(o, x0, y0, x1, y1) : hit(o, x0, y0, x1, y1)) { die(s, o.circle ? 'saw' : 'spike'); return; }
      } else if (o.t === 'pad') {
        if (!s.used[o.id] && hit(o, x0, y0, x1, y1)) applyPad(s, o);
      } else if (o.t === 'orb') {
        if (!s.used[o.id] && s.held && s.ringBuf && hit(o, x0, y0, x1, y1)) applyOrb(s, o);
      } else if (o.t === 'coin') {
        if (!s.used[o.id] && hit(o, x0, y0, x1, y1)) {
          s.used[o.id] = 1;
          s.coins++;
          emit(s, 'coin', { id: o.id });
        }
      }
    }
  }

  // Interpolación angular por el camino corto.
  function approachAngle(from, to, t) {
    let d = (to - from) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return from + d * t;
  }

  function updateRotation(s) {
    const sp = SPEEDS[s.speed];
    switch (s.mode) {
      case 'cube': {
        if (s.grounded) {
          s.spinning = false;
          // En rampa se alinea con la pendiente; en llano, con el múltiplo de 90° más cercano.
          const a = s.slope ? s.slope.angle : 0;
          const target = Math.round((s.rot - a) / 90) * 90 + a;
          s.rot = approachAngle(s.rot, target, Math.min(1, sp.mod * 0.175 * 3) * DT);
        } else if (s.spinning) {
          s.rot += s.flip * s.spinRate / TPS;
        }
        break;
      }
      case 'ball':
        s.rot += s.flip * P.BALL_SPIN / sp.ballK / TPS;
        break;
      case 'robot':
      case 'spider': {
        // Siempre derechos: en rampa se alinean con la pendiente; en el aire vuelven a 0.
        const a = s.grounded && s.slope ? s.slope.angle : 0;
        s.rot = approachAngle(s.rot, a, Math.min(1, sp.mod * 0.175 * 3) * DT);
        break;
      }
      default: {
        const dx = s.x - s.px, dy = s.y - s.py;
        let target = -Math.atan2(dy, dx) * 180 / Math.PI; // + = horario
        let k = 0.15;
        if (s.mode === 'wave') k = s.mini ? 0.4 : 0.25;
        if (s.mode === 'ufo') {
          k = 0.07;
          target = Math.max(target * -0.4 * s.flip, -5.73);
          target *= s.flip;
        }
        s.rot = approachAngle(s.rot, target, k * DT);
      }
    }
    if (s.rot > 7200 || s.rot < -7200) s.rot %= 360;
  }

  const api = {
    TPS, DT, YDT, BLOCK, SPEEDS, P, FLYING, GROUND,
    compileLevel, createState, cloneState, step, press, release, query, hit,
    slopeY, slopeHit, halfOf, innerOf, findSurface,
    EASE, groupsOf, expandTriggers, groupState, groupXform, placeDyn,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
