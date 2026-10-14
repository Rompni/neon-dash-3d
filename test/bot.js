// Bot de verificación: demuestra que cada nivel se puede completar.
// Uso: node test/bot.js [K=4] [idNivel]   (npm run bot: K=4 y K=12 para todos los niveles)
// K = cada cuántos ticks puede cambiar la entrada (4 → 60 Hz, 8 → 30 Hz).
'use strict';
const Sim = require('../src/sim.js');
const Levels = require('../src/levels.js');

const B = Sim.BLOCK;

const { solve, keyOf } = require('../src/solver.js');

// Convierte la historia en una lista de cambios de entrada {tick, down}.
function edges(hist) {
  const steps = [];
  for (let h = hist; h; h = h.p) steps.push(h);
  steps.reverse();
  const out = [];
  let held = false;
  for (const st of steps) {
    if (st.w !== held) { out.push({ tick: st.t, down: st.w }); held = st.w; }
  }
  return out;
}

function replay(L, es, until) {
  const s = Sim.createState(L);
  s.events = null;
  let i = 0;
  while (!s.dead && !s.won && s.tick < until) {
    while (i < es.length && es[i].tick <= s.tick) {
      if (es[i].down) Sim.press(s); else Sim.release(s);
      i++;
    }
    Sim.step(L, s);
  }
  return s;
}

// Ventanas de timing "humanas": convierte cada salto/orbe/aleteo de la ruta en un toque corto
// y mide cuántos ticks puede adelantarse o retrasarse ese toque sin perder la partida.
// La x depende sólo del tiempo, así que un tick equivale a una posición fija del nivel.
function replayEvents(L, es, until) {
  const s = Sim.createState(L);
  s.events = [];
  const out = [];
  let i = 0;
  const modeAt = [];
  let lastAir = -99;
  while (!s.dead && !s.won && s.tick < until) {
    while (i < es.length && es[i].tick <= s.tick) {
      if (es[i].down) Sim.press(s); else Sim.release(s);
      i++;
    }
    modeAt[s.tick] = s.mode;
    const before = s.tick;
    if (!s.grounded) lastAir = before;
    Sim.step(L, s);
    for (const e of s.events) if (e.type === 'jump' || e.type === 'orb' || e.type === 'flap' || e.type === 'teleport') {
      out.push({ tick: before, type: e.type, mode: modeAt[before], x: e.x, chain: e.type === 'jump' && before - lastAir <= 2 });
    }
    s.events.length = 0;
  }
  return { s, taps: out, modeAt };
}

function windows(L, es, total) {
  const { taps, modeAt } = replayEvents(L, es, total + 10);
  const tapModes = { cube: 1, ball: 1, ufo: 1, spider: 1, swing: 1 }; // el robot no: la duración importa
  const N = total + 10;
  const heldOrig = new Uint8Array(N);
  let h = 0, j = 0;
  for (let t = 0; t < N; t++) {
    while (j < es.length && es[j].tick <= t) { h = es[j].down ? 1 : 0; j++; }
    heldOrig[t] = h;
  }
  const tapList = taps.filter((t) => tapModes[t.mode]);

  // Entrada deseada en el tick t con desplazamientos {k: d} para algunos toques.
  const heldAt = (t, shifts) => {
    const m = modeAt[t] || 'cube';
    if (!tapModes[m]) return heldOrig[t];
    for (let k = 0; k < tapList.length; k++) {
      const tp = tapList[k];
      if (tp.tick > t + 80) break;
      const at = tp.tick + (shifts[k] || 0);
      const end = Math.max(at, tp.tick) + 3;
      if (t >= at && t < end) return 1;
    }
    return 0;
  };

  // Instantáneas del recorrido base para simular sólo el tramo afectado.
  const snaps = new Map();
  {
    const s = Sim.createState(L);
    s.events = null;
    const want = new Set(tapList.map((tp) => Math.max(0, tp.tick - 70)));
    while (!s.dead && !s.won && s.tick < N) {
      if (want.has(s.tick)) snaps.set(s.tick, Sim.cloneState(s));
      const v = heldAt(s.tick, {});
      if (v && !s.held) Sim.press(s); else if (!v && s.held) Sim.release(s);
      Sim.step(L, s);
    }
    if (!s.won) return { error: 'la ruta con toques no completa el nivel (x=' + (s.x / B).toFixed(1) + ', ' + s.cause + ')' };
  }

  const survives = (k, shifts, until) => {
    const s = Sim.cloneState(snaps.get(Math.max(0, tapList[k].tick - 70)));
    s.events = null;
    while (!s.dead && !s.won && s.tick < until) {
      const v = heldAt(s.tick, shifts);
      if (v && !s.held) Sim.press(s); else if (!v && s.held) Sim.release(s);
      Sim.step(L, s);
    }
    return !s.dead;
  };

  const res = [];
  tapList.forEach((t, k) => {
    // Basta con sobrevivir hasta el toque k+2; el toque k+1 puede reajustarse (como haría una persona).
    const until = k + 2 < tapList.length ? tapList[k + 2].tick : t.tick + 400;
    const ok = (d) => {
      const sh = {};
      sh[k] = d;
      if (survives(k, sh, until)) return true;
      if (k + 1 >= tapList.length) return false;
      for (let d2 = 1; d2 <= 40; d2++) {
        for (const sign of [-1, 1]) {
          sh[k + 1] = sign * d2;
          if (survives(k, sh, until)) return true;
        }
      }
      return false;
    };
    let early = 0, late = 0;
    while (early < 60 && ok(-(early + 1))) early++;
    while (late < 60 && ok(late + 1)) late++;
    res.push({ tick: t.tick, x: t.x / B, mode: t.mode, type: t.chain ? 'chain' : t.type, early, late, width: early + late + 1 });
  });
  return res;
}

function main() {
  const K = Number(process.argv[2] || 4);
  const only = process.argv[3];
  let bad = 0;
  for (const def of Levels.list) {
    if (only && def.id !== only) continue;
    const L = Sim.compileLevel(def);
    const t0 = Date.now();
    const r = solve(L, K, 4000);
    const ms = Date.now() - t0;
    if (!r.ok) {
      bad++;
      console.log(`✗ ${def.name}: imposible con K=${K}. Llega hasta x=${(r.furthest / B).toFixed(1)} (${r.cause}) [${ms} ms]`);
      continue;
    }
    const es = edges(r.hist);
    const check = replay(L, es, r.ticks + 10);
    // Ningún portal debe poder esquivarse: si la ruta ganadora se salta uno, el nivel está mal cerrado.
    const skipped = L.objs.filter((o) => o.t === 'portal' && !check.used[o.id]);
    if (skipped.length) {
      bad++;
      console.log(`✗ ${def.name}: se puede ganar esquivando portales en x=${skipped.map((o) => o.x).join(', ')}`);
    }
    console.log(`✓ ${def.name}: completable con K=${K} (${(r.ticks / Sim.TPS).toFixed(1)} s, ${es.filter((e) => e.down).length} pulsaciones) [${ms} ms] replay=${check.won}`);
    if (process.env.WINDOWS) {
      const w = windows(L, es, r.ticks);
      if (w.error) { console.log('   ' + w.error); continue; }
      const chains = w.filter((it) => it.type === 'chain');
      const real = w.filter((it) => it.type !== 'chain').sort((a, b) => a.width - b.width);
      console.log(`   ${real.length} toques de timing + ${chains.length} saltos encadenados (se hacen manteniendo)`);
      console.log('   ventanas más justas (240 ticks = 1 s):');
      for (const it of real.slice(0, Number(process.env.WINDOWS) || 8)) {
        console.log(`   x=${it.x.toFixed(1).padStart(6)} ${it.mode.padEnd(4)} ${it.type.padEnd(4)} ventana ${String(it.width).padStart(2)} ticks (${(it.width / 0.24).toFixed(0)} ms)  [-${it.early}, +${it.late}]`);
      }
    }
  }
  if (bad) process.exit(1);
}

if (require.main === module) main();
module.exports = { solve, edges, replay, windows, replayEvents };
