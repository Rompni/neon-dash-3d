// La jugabilidad no depende de los Hz de la pantalla: el bucle de game.js (paso fijo a 240 Hz, pulsaciones con
// su momento real aplicadas en el paso que toca) da exactamente el mismo resultado a 30, 60, 144 o 240 fps,
// aunque los fotogramas lleguen con temblor. Aquí se reproduce ese bucle con las rutas de la demo.
'use strict';
const assert = require('assert');
const Sim = require('../src/sim.js');
const Levels = require('../src/levels.js');
require('../src/demos.js');

const TPS = Sim.TPS, TICK_MS = 1000 / TPS;

// Igual que stepPlay en game.js: avanza la física hasta `now` aplicando las pulsaciones con t <= fin del paso.
function play(L, presses, fps, seed) {
  const s = Sim.createState(L);
  let rnd = seed;
  const r = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  let simClock = 0, now = 0, qi = 0;
  const queue = [];
  while (!s.dead && !s.won && now < 200000) {
    now += (1000 / fps) * (0.8 + 0.4 * r()); // fotograma con temblor
    // los eventos que "ocurrieron" antes de este fotograma ya están en la cola (con su momento real)
    while (qi < presses.length && presses[qi].t <= now) queue.push(presses[qi++]);
    while (simClock + TICK_MS <= now && !s.dead && !s.won) {
      const tEnd = simClock + TICK_MS;
      while (queue.length && queue[0].t <= tEnd) { const ev = queue.shift(); if (ev.down) Sim.press(s); else Sim.release(s); }
      Sim.step(L, s);
      simClock = tEnd;
    }
  }
  return { won: s.won, dead: s.dead, tick: s.tick, x: Math.round(s.x), coins: Object.keys(s.used).length };
}

let fails = 0;
for (const def of Levels.list) {
  const edges = globalThis.Demos[def.id];
  if (!edges) continue;
  const L = Sim.compileLevel(def);
  // cada cambio de entrada en su tick, con un instante real dentro de ese tick (como una persona)
  const presses = edges.map((tk, i) => ({ t: tk * TICK_MS + 0.5 + (i * 7 % 3), down: i % 2 === 0 }));
  const ref = play(L, presses, 1000, 1);
  const res = [30, 60, 144, 240].map((fps) => play(L, presses, fps, fps * 13 + 1));
  try {
    for (const r of res) assert.deepStrictEqual(r, ref);
    assert.ok(ref.won, 'la ruta debería completar el nivel');
    console.log('  ok   ' + def.id + ' (30/60/144/240 fps: mismo resultado)');
  } catch (e) {
    fails++;
    console.log('  FAIL ' + def.id + ' ' + JSON.stringify({ ref, res }));
  }
}
if (fails) { console.log(fails + ' fallos'); process.exit(1); }
console.log('todo ok');
