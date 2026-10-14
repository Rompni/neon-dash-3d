// Tests de los modos nuevos (robot, araña, columpio y dual): node test/modes.test.js
'use strict';
const assert = require('node:assert/strict');
const Sim = require('../src/sim.js');
const { keyOf } = require('../src/solver.js');

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

function level(objects, extra) {
  return Sim.compileLevel(Object.assign({ id: 't', name: 't', length: 400, objects }, extra || {}));
}

// Altura máxima (en bloques) de un salto de robot manteniendo `hold` ticks.
function robotApex(hold) {
  const L = level([], { startMode: 'robot' });
  const s = Sim.createState(L);
  Sim.step(L, s);
  Sim.press(s);
  let apex = 0;
  for (let i = 0; i < 300; i++) {
    if (i === hold) Sim.release(s);
    Sim.step(L, s);
    apex = Math.max(apex, s.y - Sim.P.HALF);
  }
  return apex / B;
}

console.log('modos nuevos');

test('portal girado 90°: queda tumbado y se cruza igual (cambia el modo)', () => {
  const L = level([{ t: 'portal', kind: 'ship', x: 6, y: 0, r: 90 }]);
  const o = L.objs[0];
  assert.ok(o.x1 - o.x0 > o.y1 - o.y0, 'la caja del portal es horizontal');
  const s = Sim.createState(L);
  for (let i = 0; i < 400 && s.mode !== 'ship'; i++) Sim.step(L, s);
  assert.equal(s.mode, 'ship');
});

test('robot: cuanto más se mantiene, más sube (toque ≈ 1 bloque, todo ≈ 3,3)', () => {
  const tap = robotApex(10), mid = robotApex(40), full = robotApex(84), over = robotApex(200);
  assert.ok(tap > 0.8 && tap < 1.25, 'toque (40 ms): ' + tap);
  assert.ok(mid > 1.7 && mid < 2.5, 'medio (0,17 s): ' + mid);
  assert.ok(full > 3 && full < 3.6, 'mantenido (0,35 s): ' + full);
  assert.ok(Math.abs(over - full) < 0.15, 'mantener más no sube más: ' + over);
  assert.ok(robotApex(20) > tap + 0.2 && robotApex(60) > mid + 0.3, 'la altura crece de forma progresiva');
});

test('robot: emite jump, no gira y repite el salto si se mantiene', () => {
  const L = level([], { startMode: 'robot' });
  const s = Sim.createState(L);
  Sim.press(s);
  let jumps = 0, maxRot = 0;
  for (let i = 0; i < 600; i++) {
    Sim.step(L, s);
    jumps += s.events.filter((e) => e.type === 'jump').length;
    s.events.length = 0;
    maxRot = Math.max(maxRot, Math.abs(s.rot));
  }
  assert.ok(jumps >= 3, 'saltos: ' + jumps);
  assert.ok(maxRot < 1e-6, 'rotación: ' + maxRot);
});

test('portal de robot: cambia el modo y libera el corredor', () => {
  const L = level([{ t: 'portal', kind: 'ship', x: 2, y: 1 }, { t: 'portal', kind: 'robot', x: 8, y: 1 }]);
  const s = Sim.createState(L);
  for (let i = 0; i < 240; i++) Sim.step(L, s);
  assert.equal(s.mode, 'robot');
  assert.equal(s.hi, Infinity);
  assert.ok(s.events.some((e) => e.type === 'portal' && e.kind === 'robot'));
});

test('araña: teletransporte al techo y vuelta al suelo', () => {
  const L = level([{ t: 'block', x: 0, y: 5, w: 40, h: 1 }], { startMode: 'spider' });
  const s = Sim.createState(L);
  for (let i = 0; i < 10; i++) Sim.step(L, s);
  Sim.press(s);
  Sim.step(L, s);
  assert.equal(s.flip, -1);
  assert.equal(s.y, 5 * B - Sim.P.HALF, 'pegada bajo el techo');
  const tp = s.events.find((e) => e.type === 'teleport');
  assert.ok(tp && tp.fromY === Sim.P.HALF && tp.toY === s.y, 'evento teleport con fromY/toY');
  // mantener no hace nada más
  for (let i = 0; i < 20; i++) Sim.step(L, s);
  assert.ok(s.grounded && s.flip === -1, 'sigue en el techo');
  Sim.release(s);
  Sim.press(s);
  Sim.step(L, s);
  assert.equal(s.flip, 1);
  assert.equal(s.y, Sim.P.HALF, 'de vuelta en el suelo');
});

test('araña: aterriza sobre el bloque más cercano y en el aire no hace nada', () => {
  const L = level([{ t: 'block', x: 0, y: 3, w: 40, h: 1 }, { t: 'block', x: 0, y: 7, w: 40, h: 1 }], { startMode: 'spider' });
  const s = Sim.createState(L);
  Sim.step(L, s);
  Sim.press(s); Sim.step(L, s); Sim.release(s);
  assert.equal(s.y, 3 * B - Sim.P.HALF, 'el bloque de abajo tapa el de arriba');
  // en el aire: sin efecto
  const L2 = level([], { startMode: 'spider' });
  const a = Sim.createState(L2);
  a.y = 100; a.grounded = false;
  Sim.press(a); Sim.step(L2, a);
  assert.equal(a.flip, 1);
});

test('araña: sin superficie al alcance invierte la gravedad y cae', () => {
  const L = level([], { startMode: 'spider' });
  const s = Sim.createState(L);
  Sim.step(L, s);
  Sim.press(s); Sim.step(L, s);
  assert.equal(s.flip, -1);
  for (let i = 0; i < 30; i++) Sim.step(L, s);
  assert.ok(s.y > 60 && s.vy > 0, 'cae hacia arriba: y=' + s.y);
});

test('columpio: cada toque invierte la gravedad (flap) y zigzaguea dentro del corredor', () => {
  const L = level([{ t: 'portal', kind: 'swing', x: 3, y: 1, floor: 0 }]);
  const s = Sim.createState(L);
  while (s.mode !== 'swing') Sim.step(L, s);
  assert.equal(s.hi, 300);
  s.events.length = 0;
  Sim.press(s); Sim.step(L, s);
  assert.equal(s.flip, -1);
  assert.equal(s.events.filter((e) => e.type === 'flap').length, 1);
  // mantener no cambia nada: sube con velocidad limitada
  let maxV = 0;
  for (let i = 0; i < 120; i++) { Sim.step(L, s); maxV = Math.max(maxV, s.vy); }
  assert.equal(s.flip, -1);
  assert.ok(maxV <= Sim.P.SWING_MAX + 1e-9 && maxV > Sim.P.SWING_MAX - 0.5, 'velocidad terminal: ' + maxV);
  Sim.release(s); Sim.step(L, s);
  assert.equal(s.flip, -1, 'soltar no invierte');
  Sim.press(s); Sim.step(L, s);
  assert.equal(s.flip, 1);
  // la velocidad cambia de forma continua (arco), no de golpe
  const v0 = s.vy;
  Sim.step(L, s);
  assert.ok(Math.abs(s.vy - v0) < 0.2, 'arco suave');
  assert.ok(!s.dead && s.y <= 300);
});

function dualLevel(extra) {
  return level([{ t: 'block', x: 0, y: 6, w: 60, h: 1 }, { t: 'portal', kind: 'dual', x: 4, y: 1 }].concat(extra || []));
}

test('dual: el gemelo aparece en el techo, con la gravedad contraria, y salta en espejo', () => {
  const L = dualLevel();
  const s = Sim.createState(L);
  while (!s.twin) Sim.step(L, s);
  assert.equal(s.twin.flip, -1);
  assert.ok(s.events.some((e) => e.type === 'portal' && e.kind === 'dual'));
  for (let i = 0; i < 10; i++) Sim.step(L, s);
  assert.equal(s.twin.y, 6 * B - Sim.P.HALF);
  assert.ok(s.twin.grounded);
  Sim.press(s);
  for (let i = 0; i < 30; i++) {
    Sim.step(L, s);
    assert.equal(s.twin.x, s.x);
    assert.ok(Math.abs((s.y - Sim.P.HALF) - (6 * B - Sim.P.HALF - s.twin.y)) < 1e-6, 'espejo en el tick ' + i);
  }
  const jumps = s.events.filter((e) => e.type === 'jump');
  assert.ok(jumps.some((e) => e.twin) && jumps.some((e) => !e.twin), 'saltan los dos');
});

test('dual: si muere el gemelo muere la partida (un solo evento death)', () => {
  const L = dualLevel([{ t: 'spike', x: 20, y: 5, r: 180 }]);
  const s = Sim.createState(L);
  for (let i = 0; i < 2000 && !s.dead; i++) Sim.step(L, s);
  assert.ok(s.dead, 'muere');
  const deaths = s.events.filter((e) => e.type === 'death');
  assert.equal(deaths.length, 1);
  assert.ok(deaths[0].twin && deaths[0].y > 100, 'posición del gemelo');
});

test('dual: portales de modo cambian a los dos y single quita el gemelo', () => {
  const L = dualLevel([{ t: 'portal', kind: 'robot', x: 10, y: 1 }, { t: 'portal', kind: 'single', x: 16, y: 1 }]);
  const s = Sim.createState(L);
  while (s.x < 13 * B) Sim.step(L, s);
  assert.equal(s.mode, 'robot');
  assert.equal(s.twin.mode, 'robot');
  while (s.x < 18 * B) Sim.step(L, s);
  assert.equal(s.twin, null);
  assert.ok(!s.dead);
});

test('dual: cloneState copia el gemelo y keyOf lo distingue', () => {
  const L = dualLevel();
  const s = Sim.createState(L);
  while (!s.twin) Sim.step(L, s);
  for (let i = 0; i < 10; i++) Sim.step(L, s);
  const c = Sim.cloneState(s);
  assert.notEqual(c.twin, s.twin);
  assert.equal(c.twin.used, c.used, 'used común en la copia');
  c.twin.y = 0;
  assert.notEqual(s.twin.y, 0);
  const d = Sim.cloneState(s);
  assert.equal(keyOf(d), keyOf(s));
  d.twin.y -= 20;
  assert.notEqual(keyOf(d), keyOf(s));
  // la copia se simula igual que el original
  const e = Sim.cloneState(s);
  for (let i = 0; i < 100; i++) { Sim.step(L, s); Sim.step(L, e); }
  assert.equal(e.twin.y, s.twin.y);
  assert.equal(e.y, s.y);
});

if (failures) {
  console.log(`\n${failures} test(s) fallaron`);
  process.exit(1);
}
console.log('\ntodo ok');
