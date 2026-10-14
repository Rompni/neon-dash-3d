// Calcula con el bot de Neon Dash una ruta ganadora por nivel y la guarda en src/demos.js.
// El menú la reproduce para que el jugador juegue solo de fondo.
// Uso: node tools/solve-demos.js [K=6] [idNivel…]   (con ids, sólo recalcula esos y conserva el resto)
'use strict';
const fs = require('fs');
const path = require('path');
const Sim = require('../src/sim.js');
const Levels = require('../src/levels.js');
const { solve } = require('../src/solver.js');

const K = Number(process.argv[2]) || 6;
const only = process.argv.slice(3);
let out = {};
if (only.length) { require('../src/demos.js'); out = Object.assign({}, globalThis.Demos); }
for (const def of Levels.list) {
  if (only.length && !only.includes(def.id)) continue;
  const t0 = Date.now();
  const L = Sim.compileLevel(def);
  const r = solve(L, K, 4000);
  if (!r.ok) { console.log(`${def.id}: sin ruta (llega a ${(r.furthest / Sim.BLOCK).toFixed(0)})`); continue; }
  const steps = [];
  for (let h = r.hist; h; h = h.p) steps.push(h);
  steps.reverse();
  const edges = [];
  let held = false;
  for (const st of steps) if (st.w !== held) { edges.push(st.t); held = st.w; }
  out[def.id] = edges; // ticks donde cambia la entrada: pulsa, suelta, pulsa…
  console.log(`${def.id}: ${edges.length / 2 | 0} pulsaciones, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
const js = `/* Generado por tools/solve-demos.js. No editar a mano. */
(function (root) {
  'use strict';
  // Por nivel: ticks en los que cambia la entrada (pulsa, suelta, pulsa…), calculados con el bot.
  root.Demos = ${JSON.stringify(out)};
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'demos.js'), js);
console.log(`src/demos.js: ${(js.length / 1024).toFixed(1)} KB`);
