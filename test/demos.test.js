// Las rutas del menú (src/demos.js) deben completar cada nivel al reproducirlas: node test/demos.test.js
'use strict';
const Sim = require('../src/sim.js');
const Levels = require('../src/levels.js');
require('../src/demos.js');
let fails = 0;
for (const def of Levels.list) {
  const L = Sim.compileLevel(def);
  const ed = globalThis.Demos[def.id];
  const s = Sim.createState(L);
  s.events = [];
  let i = 0;
  while (!s.dead && !s.won && s.tick < 240 * 600) {
    while (ed && i < ed.length && ed[i] <= s.tick) { if (i % 2 === 0) Sim.press(s); else Sim.release(s); i++; }
    Sim.step(L, s);
    s.events.length = 0;
  }
  const ok = s.won;
  if (!ok) fails++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${def.id}${ok ? '' : ' (muere en ' + (s.x / Sim.BLOCK).toFixed(1) + ')'}`);
}
console.log(fails ? `\n${fails} rutas fallan` : '\ntodas las rutas completan su nivel');
process.exit(fails ? 1 : 0);
