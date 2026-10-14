// Tests de física: node test/physics.test.js
'use strict';
const assert = require('node:assert/strict');
const Sim = require('../src/sim.js');

const B = Sim.BLOCK;
let failures = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  ok   ' + name);
  } catch (e) {
    failures++;
    console.log('  FAIL ' + name + '\n       ' + e.message);
  }
}

function near(actual, expected, tol, label) {
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} (esperado ${expected} ± ${tol})`);
}

function level(objects, extra) {
  return Sim.compileLevel(Object.assign({ id: 't', name: 't', length: 400, objects }, extra || {}));
}

function run(L, s, ticks, inputAt) {
  for (let i = 0; i < ticks && !s.dead && !s.won; i++) {
    if (inputAt) {
      const want = inputAt(s.tick);
      if (want && !s.held) Sim.press(s);
      if (!want && s.held) Sim.release(s);
    }
    Sim.step(L, s);
  }
  return s;
}

console.log('física');

test('velocidad 1x = 10.386 bloques/s', () => {
  const L = level([]);
  const s = Sim.createState(L);
  run(L, s, Sim.TPS);
  near(s.x / B, 10.386, 0.001, 'bloques en 1 s');
});

test('velocidades 0.5x/2x/3x/4x', () => {
  const want = { 0.5: 8.372, 2: 12.914, 3: 15.6, 4: 19.2 };
  for (const k of Object.keys(want)) {
    const L = level([], { startSpeed: Number(k) });
    const s = Sim.createState(L);
    run(L, s, Sim.TPS);
    near(s.x / B, want[k], 0.001, k + 'x');
  }
});

test('salto del cubo: altura ≈ 2.17 bloques, ≈ 104 ticks, ≈ 4.49 bloques', () => {
  const L = level([]);
  const s = Sim.createState(L);
  Sim.press(s);
  Sim.step(L, s);
  Sim.release(s);
  const x0 = s.px;
  let apex = 0, ticks = 1;
  while (!s.grounded) {
    Sim.step(L, s);
    ticks++;
    apex = Math.max(apex, s.y - Sim.P.HALF);
  }
  near(apex / B, 2.2, 0.035, 'altura');
  near(ticks, 104, 2, 'ticks en el aire');
  near((s.x - x0) / B, 4.49, 0.06, 'distancia');
  near(Math.abs(s.rot), 180, 6, 'giro al aterrizar');
});

test('el cubo queda recto tras aterrizar', () => {
  const L = level([]);
  const s = Sim.createState(L);
  Sim.press(s);
  Sim.step(L, s);
  Sim.release(s);
  run(L, s, 200);
  const r = ((s.rot % 90) + 90) % 90;
  assert.ok(r < 0.5 || r > 89.5, 'rotación final ' + s.rot);
});

test('mantener pulsado encadena saltos', () => {
  const L = level([]);
  const s = Sim.createState(L);
  run(L, s, 400, () => true);
  assert.ok(s.jumps >= 3, 'saltos: ' + s.jumps);
});

test('chocar con un muro de 1 bloque mata', () => {
  const L = level([{ t: 'block', x: 10, y: 0 }]);
  const s = run(L, Sim.createState(L), 600);
  assert.equal(s.dead, true);
  assert.equal(s.cause, 'block');
  // muere tras penetrar ~10.5 u (hitbox interior), no al primer contacto
  near(s.x - 300, -4.5, 3, 'penetración');
});

test('aterriza sobre un bloque y sigue', () => {
  const L = level([{ t: 'block', x: 10, y: 0, w: 6 }]);
  const s = run(L, Sim.createState(L), 600, (t) => t >= 160 && t < 164);
  assert.equal(s.dead, false);
  assert.ok(s.x > 16 * B);
});

test('margen de aterrizaje: salto tardío contra bloque se perdona', () => {
  // Si los pies están a menos de 10 u bajo la arista mientras cae, sube encima.
  const L = level([{ t: 'block', x: 20, y: 0, w: 4 }]);
  let saved = 0;
  for (let t0 = 300; t0 < 480; t0++) {
    const s = run(L, Sim.createState(L), 800, (t) => t >= t0 && t < t0 + 2);
    if (!s.dead) saved++;
  }
  assert.ok(saved > 10, 'ventanas válidas: ' + saved);
});

test('pincho simple: correr encima mata, saltar a tiempo salva', () => {
  const L = level([{ t: 'spike', x: 12, y: 0 }]);
  assert.equal(run(L, Sim.createState(L), 600).dead, true);
  let ok = 0;
  for (let t0 = 0; t0 < 400; t0++) {
    if (!run(L, Sim.createState(L), 600, (t) => t >= t0 && t < t0 + 2).dead) ok++;
  }
  assert.ok(ok > 25, 'ticks válidos para saltar: ' + ok);
});

test('triple pincho posible, cuádruple imposible (1x)', () => {
  const windowFor = (n) => {
    const objs = [];
    for (let i = 0; i < n; i++) objs.push({ t: 'spike', x: 12 + i, y: 0 });
    const L = level(objs);
    let ok = 0;
    for (let t0 = 0; t0 < 400; t0++) {
      if (!run(L, Sim.createState(L), 600, (t) => t >= t0 && t < t0 + 2).dead) ok++;
    }
    return ok;
  };
  const w3 = windowFor(3), w4 = windowFor(4);
  assert.ok(w3 > 0, 'triple: ' + w3);
  assert.equal(w4, 0, 'cuádruple: ' + w4);
  console.log(`       ventana triple pincho: ${w3} ticks (${(w3 / 240 * 1000).toFixed(0)} ms)`);
});

test('nave: velocidad limitada a [-6.4, 8]', () => {
  const L = level([], { startMode: 'ship' });
  const s = Sim.createState(L);
  let min = 0, max = 0;
  run(L, s, 2000, (t) => {
    min = Math.min(min, s.vy); max = Math.max(max, s.vy);
    return (t % 600) < 300;
  });
  near(max, 8, 1e-9, 'máx');
  near(min, -6.4, 1e-9, 'mín');
  assert.equal(s.dead, false);
});

test('nave: suelo y techo del corredor (10 bloques)', () => {
  const L = level([], { startMode: 'ship' });
  const s = Sim.createState(L);
  run(L, s, 600, () => true);
  near(s.y, 300 - 15, 1e-9, 'techo');
  run(L, s, 600, () => false);
  near(s.y, 15, 1e-9, 'suelo');
});

test('onda: 45° exactos', () => {
  const L = level([], { startMode: 'wave' });
  const s = Sim.createState(L);
  Sim.press(s);
  Sim.step(L, s);
  Sim.step(L, s);
  near((s.y - s.py) / (s.x - s.px), 1, 1e-9, 'pendiente');
  Sim.release(s);
  Sim.step(L, s);
  near((s.y - s.py) / (s.x - s.px), -1, 1e-9, 'pendiente');
});

test('portal de gravedad invierte y se apoya en el techo', () => {
  const L = level([
    { t: 'portal', kind: 'flip', x: 5, y: 1 },
    { t: 'block', x: 0, y: 5, w: 30 },
  ]);
  const s = run(L, Sim.createState(L), 400);
  assert.equal(s.flip, -1);
  assert.equal(s.grounded, true);
  near(s.y, 150 - 15, 1e-9, 'apoyado bajo el techo');
});

test('pad amarillo ≈ 4.4 bloques de altura', () => {
  const L = level([{ t: 'pad', kind: 'yellow', x: 5, y: 0 }]);
  const s = Sim.createState(L);
  let apex = 0;
  run(L, s, 400, () => { apex = Math.max(apex, s.y - 15); return false; });
  near(apex / B, 4.45, 0.1, 'altura');
});

test('orbe amarillo: se activa pulsando dentro, no manteniendo desde el suelo', () => {
  const objs = [{ t: 'orb', kind: 'yellow', x: 15, y: 1 }];
  for (let i = 12; i < 19; i++) objs.push({ t: 'spike', x: i, y: 0 });
  const L = level(objs);
  // mantener desde el suelo consume el búfer → sin orbe → muere
  const held = run(L, Sim.createState(L), 900, (t) => t >= 215);
  assert.equal(held.dead, true);
  // salto + segundo clic en el orbe
  let best = 0;
  for (let t0 = 150; t0 < 300; t0 += 2) {
    for (let t1 = t0 + 10; t1 < t0 + 100; t1 += 2) {
      const s = run(L, Sim.createState(L), 900, (t) => (t >= t0 && t < t0 + 2) || (t >= t1 && t < t1 + 8));
      if (!s.dead) best++;
    }
  }
  assert.ok(best > 0, 'combinaciones válidas: ' + best);
});

test('bola: cambia de gravedad y rueda por el techo', () => {
  const L = level([], { startMode: 'ball' });
  const s = run(L, Sim.createState(L), 300, (t) => t < 3);
  assert.equal(s.flip, -1);
  near(s.y, 240 - 15, 1e-9, 'techo del corredor de bola');
});

test('determinismo', () => {
  const L = level([{ t: 'spike', x: 20, y: 0 }, { t: 'block', x: 30, y: 0, w: 3 }]);
  const pat = (t) => (t * 7919) % 97 < 9;
  const a = run(L, Sim.createState(L), 3000, pat);
  const b = run(L, Sim.createState(L), 3000, pat);
  assert.deepEqual([a.x, a.y, a.rot, a.dead], [b.x, b.y, b.rot, b.dead]);
});

console.log('objetos nuevos');

function track(L, s, ticks, inputAt) {
  let grounded = 0, maxY = -1e9, minY = 1e9;
  for (let i = 0; i < ticks && !s.dead && !s.won; i++) {
    if (inputAt) {
      const want = inputAt(s.tick);
      if (want && !s.held) Sim.press(s);
      if (!want && s.held) Sim.release(s);
    }
    Sim.step(L, s);
    if (s.grounded) grounded++;
    maxY = Math.max(maxY, s.y); minY = Math.min(minY, s.y);
  }
  return { s, grounded, maxY, minY };
}

test('rampa 45° de subida hasta una plataforma: no mata y queda arriba', () => {
  const L = level([{ t: 'slope', x: 10, y: 0, dir: 1 }, { t: 'block', x: 11, y: 0, w: 8 }]);
  const { s } = track(L, Sim.createState(L), 400);
  assert.equal(s.dead, false, 'muere: ' + s.cause);
  near(s.y, 45, 0.01, 'altura sobre la plataforma');
});

test('rampa 22.5° (2×1) también se sube sin morir', () => {
  const L = level([{ t: 'slope', x: 10, y: 0, w: 2, dir: 1 }, { t: 'block', x: 12, y: 0, w: 8 }]);
  const { s } = track(L, Sim.createState(L), 400);
  assert.equal(s.dead, false, 'muere: ' + s.cause);
  near(s.y, 45, 0.01, 'altura');
});

test('el cubo se inclina con la rampa', () => {
  const L = level([{ t: 'slope', x: 10, y: 0, w: 4, h: 2, dir: 1 }, { t: 'block', x: 14, y: 0, w: 4, h: 2 }]);
  const s = Sim.createState(L);
  while (s.x < 12 * B) Sim.step(L, s);
  const a = -Math.atan2(2, 4) * 180 / Math.PI;
  const r = ((s.rot - a) % 90 + 90) % 90;
  assert.ok(r < 3 || r > 87, 'rotación ' + s.rot.toFixed(1) + ' vs pendiente ' + a.toFixed(1));
});

test('al salir por arriba de una rampa conserva el impulso', () => {
  const L = level([{ t: 'slope', x: 10, y: 0, w: 2, h: 2, dir: 1 }]);
  const { s, maxY } = track(L, Sim.createState(L), 600);
  assert.equal(s.dead, false);
  assert.ok(maxY > 60 + 15 + 8, 'altura máxima ' + maxY.toFixed(1) + ' (cima en 75)');
});

test('rampa de bajada: se mantiene pegado y llega abajo vivo', () => {
  const L = level([{ t: 'block', x: 4, y: 0, w: 6, h: 2 }, { t: 'slope', x: 10, y: 0, w: 2, h: 2, dir: -1 }]);
  const s = Sim.createState(L);
  s.y = 75; s.py = 75; s.x = 5 * B;
  let air = 0;
  while (s.x < 13 * B && !s.dead) { Sim.step(L, s); if (s.x > 10.3 * B && s.x < 11.7 * B && !s.grounded) air++; }
  assert.equal(s.dead, false, 'muere: ' + s.cause);
  assert.ok(air <= 2, 'ticks en el aire bajando: ' + air);
  near(s.y, 15, 0.01, 'termina en el suelo');
});

test('chocar con el lado alto de una rampa de bajada mata', () => {
  const L = level([{ t: 'slope', x: 10, y: 0, w: 1, h: 2, dir: -1 }]);
  const { s } = track(L, Sim.createState(L), 400);
  assert.equal(s.dead, true);
  assert.equal(s.cause, 'slope');
});

test('la onda muere al tocar una rampa', () => {
  const L = level([{ t: 'slope', x: 10, y: 0, w: 2, h: 2, dir: 1 }], { startMode: 'wave' });
  const { s } = track(L, Sim.createState(L), 400);
  assert.equal(s.cause, 'slope');
});

// Onda que sube en paralelo a una diagonal a 45°, empezando a subir en x0 (u) desde el suelo.
function waveRise(L, s, x0, ticks, flip) {
  s.flip = flip || 1;
  // con la gravedad invertida, mantener baja (hacia el suelo de abajo) y soltar sube
  return run(L, s, ticks, (t) => (s.flip > 0 ? s.x >= x0 : s.x < x0));
}

test('la onda no muere en la mitad vacía de una rampa (sólo el triángulo cuenta)', () => {
  const L = level([{ t: 'slope', x: 10, y: 0, w: 2, h: 2, dir: 1 }], { startMode: 'wave' });
  const s = waveRise(L, Sim.createState(L), 285, 400);
  assert.equal(s.dead, false, 'pasa por encima de la diagonal sin tocarla');
  const L2 = level([{ t: 'slope', x: 10, y: 0, w: 2, h: 2, dir: 1 }], { startMode: 'wave' });
  const s2 = waveRise(L2, Sim.createState(L2), 330, 400);
  assert.equal(s2.cause, 'slope', 'si sube tarde, choca con la cara de la rampa');
});

test('rampa de techo: la onda muere en el triángulo y pasa bajo la mitad vacía', () => {
  const L = level([{ t: 'slope', x: 10, y: 2, w: 2, h: 2, dir: 1, ceil: true }], { startMode: 'wave' });
  assert.equal(waveRise(L, Sim.createState(L), 250, 400).cause, 'slope', 'sube contra la diagonal de arriba');
  const L2 = level([{ t: 'slope', x: 10, y: 2, w: 2, h: 2, dir: 1, ceil: true }], { startMode: 'wave' });
  assert.equal(run(L2, Sim.createState(L2), 400).dead, false, 'por el suelo pasa por debajo');
});

test('gravedad invertida: la onda respeta los triángulos de ambas rampas', () => {
  const mk = (o) => level([o], { startMode: 'wave' });
  const ceilO = { t: 'slope', x: 10, y: 8, w: 2, h: 2, dir: 1, ceil: true };
  assert.equal(waveRise(mk(ceilO), Sim.createState(mk(ceilO)), 85, 400, -1).dead, false, 'bajo la diagonal de techo sin tocarla');
  const floorO = { t: 'slope', x: 10, y: 0, w: 2, h: 2, dir: 1 };
  assert.equal(waveRise(mk(floorO), Sim.createState(mk(floorO)), 285, 400, -1).dead, false, 'sobre la diagonal de suelo sin tocarla');
  const L = mk(floorO), s = Sim.createState(L);
  s.flip = -1;
  assert.equal(run(L, s, 400, () => true).cause, 'slope', 'pegada al suelo choca con la rampa');
});

test('rampa de techo: el cubo aterriza en su cara plana de arriba', () => {
  const L = level([{ t: 'slope', x: 12, y: 1, w: 4, h: 1, dir: -1, ceil: true }]);
  const s = Sim.createState(L);
  s.x = s.px = 330; s.y = s.py = 150; s.grounded = false;
  let landed = false;
  for (let i = 0; i < 200 && !s.dead; i++) {
    Sim.step(L, s);
    if (s.grounded && s.x > 360 && s.x < 480 && Math.abs(s.y - 75) < 0.5) landed = true;
  }
  assert.equal(s.dead, false);
  assert.ok(landed, 'apoyado en y = 2.5 bloques sobre la rampa');
});

test('gravedad invertida: el cubo recorre por debajo una rampa de techo', () => {
  const L = level([
    { t: 'block', x: 0, y: 5, w: 10, h: 1 },
    { t: 'slope', x: 10, y: 3, w: 2, h: 2, dir: -1, ceil: true },
    { t: 'block', x: 12, y: 3, w: 10, h: 2 },
  ]);
  const s = Sim.createState(L);
  s.flip = -1; s.y = s.py = 135; s.grounded = false;
  let mid = null;
  for (let i = 0; i < 400 && !s.dead; i++) {
    Sim.step(L, s);
    if (mid === null && s.x >= 330) mid = s.y;
  }
  assert.equal(s.dead, false);
  near(mid, 105, 3, 'a mitad de rampa sigue la diagonal');
  near(s.y, 75, 0.5, 'después, bajo el bloque');
});

test('la nave se desliza por debajo de un techo de rampas sin morir', () => {
  // techo que baja (rampas de techo 2×1) y luego sigue plano más abajo
  const L = level([
    { t: 'block', x: 0, y: 6, w: 10, h: 4 },
    { t: 'slope', x: 10, y: 5.5, w: 1, h: 0.5, dir: -1, ceil: true }, { t: 'block', x: 10, y: 6, w: 1, h: 4 },
    { t: 'slope', x: 11, y: 5, w: 1, h: 0.5, dir: -1, ceil: true }, { t: 'block', x: 11, y: 5.5, w: 1, h: 4.5 },
    { t: 'block', x: 12, y: 5, w: 10, h: 5 },
  ], { startMode: 'ship' });
  const s = Sim.createState(L);
  Sim.press(s);
  while (s.x < 15 * B && !s.dead) Sim.step(L, s);
  assert.equal(s.dead, false);
  near(s.y, 150 - 15, 0.5, 'pegada al techo bajo');
});

test('sierra: correr hacia ella mata; saltarla a tiempo no', () => {
  const L = level([{ t: 'saw', x: 12, y: 0 }]);
  assert.equal(run(L, Sim.createState(L), 600).cause, 'saw');
  let ok = 0;
  for (let t0 = 0; t0 < 400; t0 += 2) if (!run(L, Sim.createState(L), 600, (t) => t >= t0 && t < t0 + 2).dead) ok++;
  assert.ok(ok > 5, 'ticks válidos: ' + ok);
});

test('orbe verde invierte la gravedad; orbe negro hunde', () => {
  const L = level([{ t: 'orb', kind: 'green', x: 12, y: 2 }, { t: 'block', x: 0, y: 7, w: 40 }]);
  let flipped = false;
  for (let t0 = 150; t0 < 330 && !flipped; t0 += 2) {
    const s = run(L, Sim.createState(L), 700, (t) => (t >= t0 - 60 && t < t0 - 56) || (t >= t0 && t < t0 + 4));
    if (s.flip === -1) flipped = true;
  }
  assert.ok(flipped, 'ninguna combinación activó el orbe verde');
  const L2 = level([{ t: 'orb', kind: 'black', x: 6, y: 3 }]);
  const s2 = Sim.createState(L2);
  s2.x = 6 * B; s2.px = s2.x; s2.y = 105; s2.py = 105; s2.vy = 2; s2.grounded = false;
  Sim.press(s2);
  let minVy = 0;
  for (let i = 0; i < 200; i++) { Sim.step(L2, s2); minVy = Math.min(minVy, s2.vy); }
  assert.ok(minVy <= Sim.P.BLACK_V + 0.01, 'velocidad tras el orbe negro: ' + minVy);
});

test('mini: salto ≈ 0.64× y hitbox de 18 u', () => {
  const L = level([{ t: 'portal', kind: 'mini', x: 2, y: 1 }]);
  const s = Sim.createState(L);
  while (!s.mini) Sim.step(L, s);
  for (let i = 0; i < 60; i++) Sim.step(L, s);
  near(Sim.halfOf(s) * 2, 18, 1e-9, 'hitbox');
  const y0 = s.y;
  Sim.press(s); Sim.step(L, s); Sim.release(s);
  let apex = 0;
  for (let i = 0; i < 200; i++) { Sim.step(L, s); apex = Math.max(apex, s.y - y0); }
  near(apex / 66.6, 0.64, 0.05, 'altura relativa');
});

test('monedas: se recogen una vez', () => {
  const L = level([{ t: 'coin', x: 8, y: 0 }, { t: 'coin', x: 14, y: 3 }]);
  const s = run(L, Sim.createState(L), 600);
  assert.equal(s.coins, 1);
  assert.equal(L.coins.length, 2);
});

if (failures) {
  console.log(`\n${failures} test(s) fallaron`);
  process.exit(1);
}
console.log('\ntodo ok');
