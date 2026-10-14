// Tests de los triggers de grupo (move, rotate, toggle, spawn, follow, alpha, cámara): node test/triggers.test.js
'use strict';
const assert = require('node:assert/strict');
const Sim = require('../src/sim.js');
const Levels = require('../src/levels.js');
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

function level(objects, triggers, extra) {
  return Sim.compileLevel(Object.assign({ id: 't', name: 't', length: 120, objects, triggers: triggers || [] }, extra || {}));
}

// Corre sin pulsar hasta la x (bloques), la muerte o la meta.
function runTo(L, xb, s, each) {
  s = s || Sim.createState(L);
  while (!s.dead && !s.won && s.x < xb * B) { Sim.step(L, s); if (each) each(s); }
  return s;
}

console.log('triggers de grupo');

test('move: un bloque que baja corta el paso donde está ahora (sin el trigger se pasa por debajo)', () => {
  const objs = [{ t: 'block', x: 20, y: 5, w: 1, h: 3, group: 1 }];
  const free = runTo(level(objs), 30);
  assert.ok(!free.dead, 'sin trigger el bloque queda por encima');
  const L = level(objs, [{ kind: 'move', x: 5, group: 1, dx: 0, dy: -5, dur: 4, ease: 'linear' }]);
  const s = runTo(L, 30);
  assert.ok(s.dead, 'choca con el bloque movido');
  assert.equal(s.cause, 'block');
  assert.ok(Math.abs(s.x - 20 * B) < 20, 'muere al llegar al bloque, x=' + s.x);
});

test('move: una plataforma lleva al jugador arriba y abajo sin despegarse', () => {
  const objs = [{ t: 'block', x: 4, y: 0, w: 40, h: 0.25, group: 1 }];
  const L = level(objs, [
    { kind: 'move', x: 10, group: 1, dx: 0, dy: 3, dur: 6, ease: 'linear' },
    { kind: 'move', x: 24, group: 1, dx: 0, dy: -3, dur: 6, ease: 'linear' },
  ]);
  let air = 0;
  const s = runTo(L, 20, null, (st) => { if (st.x > 8 * B && !st.grounded) air++; });
  assert.ok(!s.dead);
  assert.ok(Math.abs(s.y - (3.25 * B + 15)) < 0.01, 'arriba con la plataforma, y=' + s.y);
  runTo(L, 36, s, (st) => { if (!st.grounded) air++; });
  assert.ok(!s.dead);
  assert.ok(Math.abs(s.y - (0.25 * B + 15)) < 0.01, 'abajo otra vez, y=' + s.y);
  assert.equal(air, 0, 'siempre apoyado');
});

test('move: el cubo puede saltar desde la plataforma en movimiento', () => {
  const L = level([{ t: 'block', x: 4, y: 0, w: 40, h: 0.25, group: 1 }], [{ kind: 'move', x: 10, group: 1, dx: 0, dy: 3, dur: 8, ease: 'linear' }]);
  const s = runTo(L, 13);
  assert.ok(s.grounded);
  const y0 = s.y;
  Sim.press(s); Sim.step(L, s); Sim.release(s);
  for (let i = 0; i < 40; i++) Sim.step(L, s);
  assert.ok(s.y > y0 + 40, 'salta');
});

test('toggle: los pinchos apagados no matan (y al encenderlos otra vez, sí)', () => {
  const objs = [{ t: 'spike', x: 10, y: 0, group: 2 }, { t: 'spike', x: 30, y: 0, group: 2 }];
  assert.ok(runTo(level(objs), 40).dead, 'sin trigger mata');
  const L = level(objs, [{ kind: 'toggle', x: 3, group: 2, on: false }, { kind: 'toggle', x: 20, group: 2, on: true }]);
  const s = runTo(L, 25);
  assert.ok(!s.dead, 'el primer pincho está apagado');
  runTo(L, 40, s);
  assert.ok(s.dead && s.cause === 'spike', 'el segundo, encendido, mata');
});

test('rotate 90°: la caja de un bloque 3×1 pasa a 1×3 alrededor de su centro', () => {
  const L = level([{ t: 'block', x: 10, y: 0, w: 3, h: 1, group: 3 }], [{ kind: 'rotate', x: 1, group: 3, deg: 90, dur: 0 }]);
  const o = L.objs[0];
  const s = runTo(L, 2);
  assert.ok(!s.dead);
  assert.deepEqual([o.x0, o.y0, o.x1, o.y1].map((v) => Math.round(v * 1000) / 1000), [330, -30, 360, 60]);
});

test('rotate: rampa girada 90° (horario) cambia de lado y una sierra gira alrededor del centro dado', () => {
  const L = level([
    { t: 'slope', x: 10, y: 0, w: 1, h: 1, dir: 1, group: 4 },
    { t: 'saw', x: 20, y: 5, group: 5 },
  ], [
    { kind: 'rotate', x: 1, group: 4, deg: 90, dur: 0 },
    { kind: 'rotate', x: 1, group: 5, deg: 180, dur: 2, cx: 20.5, cy: 3.5 },
  ]);
  const sl = L.objs[0], saw = L.objs[1];
  runTo(L, 4);
  assert.equal(sl.dir, -1); assert.ok(!sl.ceil, '/ sólida abajo → \\ sólida abajo');
  assert.ok(Math.abs(saw.cx - 20.5 * B) < 1e-6 && Math.abs(saw.cy - 1.5 * B) < 1e-6, 'sierra en ' + saw.cx + ',' + saw.cy);
  // a mitad del giro (90°) la sierra está a la derecha del centro
  Sim.placeDyn(L, 2 * B);
  assert.ok(Math.abs(saw.cx - (20.5 * B + 2 * B)) < 1e-6 && Math.abs(saw.cy - 3.5 * B) < 1e-6, 'a mitad: ' + saw.cx + ',' + saw.cy);
});

test('spawn: lanza su objetivo con retraso (y el objetivo no se dispara solo)', () => {
  const L = level([{ t: 'block', x: 50, y: 6, group: 1 }], [
    { kind: 'move', x: 1, id: 'm', spawnOnly: true, group: 1, dx: 0, dy: 5, dur: 0 },
    { kind: 'spawn', x: 5, target: 'm', delay: 10 },
    { kind: 'alpha', x: 2, group: 7, alpha: 0, dur: 0, spawnOnly: true },
    { kind: 'spawn', x: 6, target: 7, delay: 1 },
  ]);
  assert.equal(Sim.groupState(L, 2 * B).off[1], undefined);
  assert.equal(Sim.groupState(L, 14.9 * B).off[1], undefined);
  assert.deepEqual(Sim.groupState(L, 15 * B).off[1], [0, 150]);
  assert.equal(Sim.groupState(L, 6.9 * B).alpha[7], undefined);
  assert.equal(Sim.groupState(L, 7 * B).alpha[7], 0, 'por grupo si el objetivo no tiene id');
});

test('follow: el seguidor copia el movimiento del líder con kx, ky (y lo choca en su sitio)', () => {
  const L = level([{ t: 'block', x: 40, y: 0, group: 2 }], [
    { kind: 'move', x: 10, group: 1, dx: 4, dy: 2, dur: 4, ease: 'linear' },
    { kind: 'follow', x: 10, group: 1, follower: 2, kx: 0.5, ky: 1, dur: 0 },
  ]);
  assert.deepEqual(Sim.groupState(L, 12 * B).off[2], [30, 30]);
  assert.deepEqual(Sim.groupState(L, 20 * B).off[2], [60, 60]);
  assert.equal(L.dyn.length, 1, 'el seguidor es dinámico');
  Sim.placeDyn(L, 20 * B);
  assert.equal(L.objs[0].x0, 40 * B + 60);
  assert.equal(L.objs[0].y0, 60);
});

test('alpha (y el alias fade) y triggers de cámara', () => {
  const L = level([], [
    { kind: 'alpha', x: 2, group: 1, alpha: 0, dur: 2, ease: 'linear' },
    { kind: 'fade', x: 2, group: 2, alpha: 0.5, dur: 0 },
    { kind: 'camzoom', x: 4, zoom: 2, dur: 2, ease: 'linear' },
    { kind: 'camoffset', x: 4, dx: 2, dy: -1, dur: 0 },
    { kind: 'camrotate', x: 4, deg: 10, dur: 0 },
  ]);
  const g = Sim.groupState(L, 3 * B);
  assert.equal(g.alpha[1], 0.5); assert.equal(g.alpha[2], 0.5);
  assert.deepEqual(g.cam, { zoom: 1, dx: 0, dy: 0, deg: 0 });
  assert.deepEqual(Sim.groupState(L, 5 * B).cam, { zoom: 1.5, dx: 60, dy: -30, deg: 10 });
  assert.equal(L.dyn.length, 0, 'alpha y cámara no vuelven dinámico nada');
});

test('groupState es una función pura de x (mismo resultado en cualquier orden)', () => {
  const objs = [{ t: 'block', x: 30, y: 2, w: 3, h: 1, group: 1 }, { t: 'saw', x: 40, y: 4, groups: [2, 1] }];
  const trigs = [
    { kind: 'move', x: 5, group: 1, dx: 3, dy: 1, dur: 6, ease: 'bounce' },
    { kind: 'rotate', x: 8, group: 2, deg: 270, dur: 10, ease: 'out' },
    { kind: 'toggle', x: 12, group: 1, on: false },
    { kind: 'toggle', x: 18, group: 1, on: true },
    { kind: 'follow', x: 6, group: 1, follower: 3, kx: -1, ky: 2, dur: 3 },
    { kind: 'spawn', x: 9, target: 'r', delay: 2.5 },
    { kind: 'rotate', x: 0, id: 'r', spawnOnly: true, group: 1, deg: 45, dur: 3 },
  ];
  const xs = [];
  for (let x = 0; x < 30 * B; x += 7.3) xs.push(x);
  const A = level(objs, trigs), C = level(objs, trigs);
  const fwd = xs.map((x) => JSON.stringify(Sim.groupState(A, x)));
  const rev = xs.slice().reverse().map((x) => JSON.stringify(Sim.groupState(C, x))).reverse();
  assert.deepEqual(fwd, rev);
  // y las cajas también dependen sólo de x
  Sim.placeDyn(A, 100); const b1 = A.dyn.map((o) => [o.x0, o.y0, o.x1, o.y1, o.off]);
  Sim.placeDyn(A, 400); Sim.placeDyn(A, 100);
  assert.deepEqual(A.dyn.map((o) => [o.x0, o.y0, o.x1, o.y1, o.off]), b1);
});

test('cloneState no cambia: el estado no guarda nada de los triggers y las copias avanzan igual', () => {
  const L = level([{ t: 'block', x: 4, y: 0, w: 40, h: 0.25, group: 1 }, { t: 'spike', x: 30, y: 0.25, group: 2 }], [
    { kind: 'move', x: 10, group: 1, dx: 0, dy: 2, dur: 6 },
    { kind: 'toggle', x: 20, group: 2, on: false },
  ]);
  const plain = Sim.createState(level([]));
  const s = runTo(L, 12);
  assert.deepEqual(Object.keys(s).sort(), Object.keys(plain).sort());
  const c = Sim.cloneState(s);
  assert.equal(keyOf(c), keyOf(s));
  // se avanza otro estado entre medias (otra x): no debe afectar a las copias
  const other = runTo(L, 25);
  runTo(L, 35, s); runTo(L, 35, c);
  assert.ok(!other.dead && !s.dead);
  assert.equal(keyOf(c), keyOf(s));
  assert.equal(c.y, s.y);
});

test('niveles del juego: los objetos dinámicos son sólo los de grupos con triggers de movimiento', () => {
  // Los niveles pueden mover objetos reales (sierras, plataformas). Todo lo que no está en un grupo
  // movido, girado, apagado o seguido sigue en la rejilla estática.
  for (const def of Levels.list) {
    const L = Sim.compileLevel(def);
    const moving = new Set();
    for (const e of L.trigs || []) {
      const t = e.tr || e; // compileLevel envuelve cada trigger como { tr, x }
      if (['move', 'rotate', 'toggle'].includes(t.kind)) moving.add(t.group);
      if (t.kind === 'follow') moving.add(t.follower);
    }
    for (const o of L.dyn) {
      const gs = o.groups || (o.group != null ? [o.group] : []);
      assert.ok(gs.some((g) => moving.has(g)), def.id + ': objeto dinámico sin trigger que lo mueva');
    }
  }
  // un trigger move mueve su grupo la mitad del recorrido a mitad de su duración
  const orb = Levels.list.find((d) => (d.triggers || []).some((t) => t.kind === 'move' && t.dur > 0));
  if (orb) {
    const L = Sim.compileLevel(orb);
    const tr = orb.triggers.find((t) => t.kind === 'move' && t.dur > 0);
    const g = Sim.groupState(L, (tr.x + tr.dur / 2) * B);
    assert.ok(Math.abs(g.off[tr.group][0] - tr.dx * B * 0.5) < 1e-6);
  }
});

console.log(failures ? failures + ' fallos' : 'todo ok');
if (failures) process.exitCode = 1;
