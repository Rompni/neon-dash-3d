/*
 * NEON DASH — buscador de rutas (el "bot").
 * Lo usan los tests en Node y el botón Verificar del editor (en un Web Worker).
 * Explora en anchura los estados de la simulación cambiando la entrada cada K ticks.
 */
(function (root) {
  'use strict';
  const Sim = typeof module !== 'undefined' && module.exports ? require('./sim.js') : root.Sim;
  const B = Sim.BLOCK;

  // Las monedas no cambian la física: salvo la que se busca, no distinguen estados.
  function keyOf(s, coinSet, need) {
    let used = '';
    for (const id in s.used) if (!coinSet || !coinSet.has(Number(id)) || Number(id) === need) used += id + ',';
    return s.mode + s.flip + (s.mini ? 'm' : '') + '|' + s.speed + '|' + (s.grounded ? 1 : 0) + (s.held ? 1 : 0) + (s.jumpBuf ? 1 : 0) +
      (s.ringBuf ? 1 : 0) + (s.spinning ? 1 : 0) + '|' + Math.round(s.x) + '|' + Math.round(s.y * 2) + '|' +
      Math.round(s.vy * 20) + '|' + (s.boost || 0) + '|' + used + (s.twin ? twinKey(s.twin) : '');
  }

  // Modo dual: el gemelo también distingue estados.
  function twinKey(t) {
    return '|T' + t.mode + t.flip + (t.mini ? 'm' : '') + (t.grounded ? 1 : 0) + (t.jumpBuf ? 1 : 0) + (t.ringBuf ? 1 : 0) +
      (t.spinning ? 1 : 0) + '|' + Math.round(t.y * 2) + '|' + Math.round(t.vy * 20) + '|' + (t.boost || 0);
  }

  // `need`: id de un objeto (p. ej. una moneda) que la ruta ganadora debe haber usado.
  // opts: { onProgress(x), maxSteps } para el editor.
  function solve(L, K, maxFrontier, start, need, opts) {
    let steps = 0;
    const root = start ? Sim.cloneState(start) : Sim.createState(L);
    root.events = null;
    const needObj = need != null ? L.objs[need] : null;
    const coinSet = new Set(L.coins || []);
    let frontier = [{ s: root, h: null, e: 0, n: 0 }];
    let furthest = 0, furthestCause = null;
    for (;;) {
      const next = new Map();
      let win = null;
      for (const node of frontier) {
        // Preferimos no cambiar la entrada: la ruta resultante usa pocas pulsaciones, como una persona.
        for (const want of [node.s.held, !node.s.held]) {
          const s = Sim.cloneState(node.s);
          if (want) Sim.press(s); else Sim.release(s);
          for (let k = 0; k < K && !s.dead && !s.won; k++) Sim.step(L, s);
          // Coste: saltos (×10) + cambios de entrada. Sólo salta cuando hace falta, como una persona.
          const edgesSoFar = node.n + (want !== node.s.held ? 1 : 0);
          const e = s.jumps * 10 + edgesSoFar;
          const h = { p: node.h, w: want, t: node.s.tick };
          if (needObj && !s.used[need] && s.x > needObj.x1 + 40) continue; // ya no puede cogerla
          if (s.won) {
            if (!win || e < win.e) win = { ok: true, hist: h, ticks: s.tick, e };
            continue;
          }
          if (s.dead) {
            if (s.x > furthest) { furthest = s.x; furthestCause = s.cause; }
            continue;
          }
          const key = keyOf(s, coinSet, need);
          const prev = next.get(key);
          if (!prev || e < prev.e) next.set(key, { s, h, e, n: edgesSoFar });
        }
      }
      if (win) return win;
      steps++;
      if (opts && opts.onProgress && steps % 25 === 0) opts.onProgress(frontier.length ? frontier[0].s.x : 0);
      if (opts && opts.maxSteps && steps > opts.maxSteps) return { ok: false, furthest, cause: 'tiempo', timeout: true };
      frontier = Array.from(next.values());
      if (!frontier.length) return { ok: false, furthest, cause: furthestCause };
      if (frontier.length > maxFrontier) {
        if (needObj) {
          // Buscando una moneda: primero las rutas que ya la tienen, luego las que más se le acercan.
          const cy = (needObj.y0 + needObj.y1) / 2;
          const near = (n) => n.s.x > needObj.x0 - 12 * B && n.s.x < needObj.x1;
          const score = (n) => (n.s.used[need] ? 0 : near(n) ? 1e6 + Math.abs(n.s.y - cy) * 10 : 1e6) + n.e;
          frontier.sort((a, b) => score(a) - score(b));
        } else frontier.sort((a, b) => a.e - b.e);
        const keep = frontier.slice(0, maxFrontier >> 1);
        const rest = frontier.slice(maxFrontier >> 1);
        const stride = rest.length / (maxFrontier - keep.length);
        for (let i = 0; i < maxFrontier - keep.length; i++) keep.push(rest[Math.floor(i * stride)]);
        frontier = keep;
      }
    }
  }

  const api = { solve, keyOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Solver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
