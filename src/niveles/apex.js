/* NEON DASH — nivel 'apex'. Se registra en NIVELES; levels.js lo construye con las utilidades comunes. */
(function (root) {
  'use strict';
  // ------------------------------------------------------------------ 12
  // Apex (Apex Finale, 150 BPM): el gran final. Todos los modos, mini y dual, sincronizados con la canción:
  // intro en cubo y robot → nave a 2x en la entrada → araña → bola en el corte → drop 1 en onda a 3x →
  // ruptura en ovni → bola y cubo mini a 2x → dual a 3x en el pico → columpio → nave mini a 3x en la subida →
  // silencio a 0,5x → drop final en onda dual a 3x → ovni → nave dual a 3x → onda a 4x → respiro → último golpe.
  // r(compás, tiempo) da la x en que suena cada tiempo; cada cambio de modo y velocidad cae al empezar un compás.

  // Pasillo de onda que gira en las x dadas (los tiempos de la canción), columna a columna con b.corridor.
  // o = { f0 (suelo inicial), dir (1 sube), turns: [x...], gap(x) (hueco vertical), k (1 onda, 2 onda mini),
  // tail (columnas del canal final) }. Si choca con el límite rebota antes; al final baja al suelo y deja un
  // canal de 3 de alto y `tail` columnas para el portal siguiente. Devuelve { x, path } (centro por columna).
  function onda(b, x0, x1, o) {
    const k = o.k || 1, top = 10;
    const turns = o.turns.slice().sort((p, q) => p - q);
    let f = o.f0 || 0, g = o.gap(x0), dir = o.dir || 1, ti = 0;
    const segs = [], path = [];
    for (let x = x0; x < x1; x++) {
      while (ti < turns.length && turns[ti] <= x + 0.5) { dir = -dir; ti++; }
      const g2 = o.gap(x);
      let d;
      if (Math.ceil(f / k) >= x1 - x - 1) d = -Math.min(k, f);          // bajada final hasta el suelo
      else {
        d = dir * k;
        if (f + d < 0 || f + d + g2 > top) { dir = -dir; d = dir * k; }
        if (f + d < 0 || f + d + g2 > top) d = 0;
      }
      segs.push([1, d, d + g2 - g]);
      path.push({ x: x + 0.5, c: f + d / 2 + (g + g2) / 4 });
      f += d; g = g2;
    }
    segs.push([1, 0, 3 - g]);
    segs.push([o.tail || 6, 0, 0]);
    const end = b.corridor(x0, o.f0 || 0, (o.f0 || 0) + o.gap(x0), segs, top);
    return { x: end.x, path };
  }

  // Puertas (columnas con un hueco) para columpio, ovni y nave: [x, fila baja del hueco, alto, ancho].
  // dy: las construye desplazadas (para que un trigger move las traiga a su sitio antes de que llegue el jugador).
  function puertas(b, list, dy) {
    dy = dy || 0;
    for (const [x, lo, size, w] of list) {
      if (lo > 0) b.block(x, dy, w || 2, lo);
      if (lo + size < 10) b.block(x, lo + size + dy, w || 2, 10 - lo - size);
    }
  }

  // Embudo para salir de un modo volador: el techo baja de `from` a 3 y sigue plano `len` columnas.
  function embudo(b, x, len, from) {
    from = from || 10;
    return b.corridor(x, 0, from, [[from - 3, 0, -1], [len, 0, 0]], Math.max(10, from));
  }

  // Pulsos en cada compás (fuerte) y en cada tiempo (suave) entre los compases a y z.
  function pulsos(b, r, a, z, c1, c2) {
    for (let n = a; n < z; n++) {
      b.pulse(r(n), c1, 4);
      if (c2) for (let t = 1; t < 4; t++) b.pulse(r(n, t), c2, 2);
    }
  }

  // Corona (decorados con grupo): un anillo grande con rayos y diamantes alrededor que el nivel gira.
  function corona(b, g, x, y, rad, color, n) {
    b.inGroup(g, () => {
      b.deco(x, y, 'ring', { r: rad, color, alpha: 0.75, par: 0.2 });
      b.deco(x, y, 'ring', { r: rad * 0.55, color, alpha: 0.5, par: 0.2 });
      for (let i = 0; i < (n || 8); i++) {
        const a = (i / (n || 8)) * Math.PI * 2;
        b.deco(x + Math.cos(a) * rad, y + Math.sin(a) * rad, 'diamond', { r: 0.45, color, par: 0.2 });
      }
    });
  }

  // Recorrido simétrico respecto a la fila 5 para la onda dual: el gemelo es el reflejo exacto del jugador,
  // así que basta con que todo sea simétrico. Estrechos (el suelo sube y el techo baja con rampas a 45°,
  // los dos pasan juntos por el centro) y obstáculos centrales (uno pasa por debajo y su reflejo por encima).
  // pasos = [[x, 'e', alto] | [x, 'c', medio alto] | [x, 's', tamaño]]; x = centro del elemento.
  function dualOnda(b, pasos) {
    for (const [x, t, h] of pasos) {
      if (t === 'e') b.corridor(Math.round(x) - h - 0.5, 0, 10, [[h, 1, -1], [1, 0, 0], [h, -1, 1]]);
      else if (t === 'c') b.block(Math.round(x) - 1, 5 - h, 2, 2 * h);
      else if (t === 's') b.saw(x - 0.5, 4.5, h);
    }
  }

  // Lo mismo para la nave dual, con bloques: 'e' = puerta con hueco central de 2·m, 'c' = bloque central de 2·m.
  function dualNave(b, pasos) {
    for (const [x, t, m] of pasos) {
      if (t === 'e') { b.block(x - 1, 0, 2, 5 - m); b.block(x - 1, 5 + m, 2, 5 - m); }
      else b.block(x - 1, 5 - m, 2, 2 * m);
    }
  }

  function apex() {
    const tramos = [[0, 1], [8, 2], [21, 1], [22, 3], [29, 1], [32, 2], [42, 3], [44, 2], [50, 3], [54, 0.5], [56, 3], [63, 2],
      [64, 3], [68, 4], [71, 1], [74, 3], [75, 1]];
    const r = ritmo('apex-finale', tramos);
    const b = new Builder({
      id: 'apex', card: '#ff2a6d', theme: 'original', theme3d: 'tormenta', name: 'Apex', difficulty: 'Demonio', stars: 10,
      song: 'track:apex-finale', synth: 'espejo', bpm: r.track.bpm, startSpeed: tramos[0][1],
    });
    // Portales de velocidad al empezar cada compás de cambio (a ras de suelo; en los canales centrales, más arriba).
    const alto = { 63: 4.2, 68: 4.2 };
    for (const [bar, v] of tramos.slice(1)) b.speed(r(bar), alto[bar] || 1, v);
    const B4 = (n, q) => r(n, q);  // atajo legible para los tiempos

    // ---------------------------------------------------------------- A · intro (compases 0-3): cubo a 1x
    b.color(0, '#140a24', '#0a0514', { line: '#ff6a9a', obj: '#ffe0ea' });
    adornos(b, 0, r(4), '#ff6a9a');
    pulsos(b, r, 0, 4, '#ff6a9a');
    b.deco(10, 5, 'glow', { r: 5, color: '#ff2a6d', alpha: 0.6 });
    corona(b, 1, r(2), 6.5, 3, '#ff6a9a');
    b.rotate(0, 1, 360, r(8), 'linear');
    b.spike(B4(1) + 2);
    b.spike(B4(1, 2) + 2);
    b.spikes(B4(2) + 2, 2);
    b.block(B4(2, 2) + 2, 0, 3, 1);
    b.spikes(B4(2, 3) + 1.5, 2);
    b.pad(B4(3) + 0.5, 0, 'yellow');
    b.spikes(B4(3) + 1.5, 4);
    b.spike(B4(3, 2) + 2.5);

    // ---------------------------------------------------------------- A2 · robot (compases 4-7) a 1x
    const xA2 = r(4);
    b.portal(xA2, 1, 'robot');
    b.color(xA2, '#200a30', '#12061c', { line: '#ff9ad0', obj: '#ffe0ea' });
    adornos(b, xA2, r(8), '#ff9ad0', { lines: 8.5 });
    pulsos(b, r, 4, 8, '#ff9ad0');
    b.hint(xA2 + 2, 4.5, 'Robot: cuanto más mantienes, más alto saltas');
    b.spike(B4(4, 1) + 2);                                // toque
    b.block(B4(4, 2) + 2, 0, 3, 2);                       // torre de 2
    b.spikes(B4(4, 3) + 2, 2);
    b.block(B4(5) + 2.5, 0, 3, 3);                        // torre de 3: salto completo
    b.spikes(B4(5) + 5.5, 3);
    b.block(B4(5, 2) + 2, 2, 8, 1);                       // techo bajo: sólo toques cortos
    b.small(B4(5, 2) + 4);
    b.small(B4(5, 3) + 3);
    b.spikes(B4(6) + 2, 3);
    b.block(B4(6, 2) + 2, 0, 2, 1);
    b.block(B4(6, 2) + 4, 0, 3, 3);
    b.spikes(B4(6, 3) + 3, 3);
    b.spike(B4(7) + 3.5);
    b.spikes(B4(7, 1) + 3, 2);
    b.corridor(r(8) - 6, 0, 6, [[3, 0, -1], [6, 0, 0]]);   // embudo hacia la nave
    b.portal(r(8), 1, 'ship');

    // ---------------------------------------------------------------- B · entrada (compases 8-13): nave a 2x
    const xB = r(8);
    b.color(xB, '#2a0a1e', '#180612', { line: '#ff4a8a', obj: '#ffffff' });
    b.shake(xB, 5, 3);
    pulsos(b, r, 8, 14, '#ff4a8a', '#a02a6a');
    adornos(b, xB, r(14), '#ff4a8a', { step: 6 });
    {
      const G = [[8, 2, 1, 5], [9, 0, 4, 5], [9, 2, 2, 5], [10, 0, 5, 4.5], [10, 2, 1.5, 4.5], [11, 0, 4, 4.5]];
      puertas(b, G.map(([n, q, lo, s]) => [r(n, q) - 1, lo, s]));
      b.coin(r(10, 1), 8.3);                              // arriba del todo entre dos puertas: subir de más
      // túnel ondulado al compás (compases 11-13)
      const t0 = Math.ceil(r(11, 2)), t1 = Math.floor(r(14) - 11);
      const per = r(13) - r(11);
      b.tunnel(t0, t1, (x) => 4.5 + 2.2 * Math.sin(((x - t0) / per) * Math.PI * 2), 4);
    }
    embudo(b, r(14) - 10, 6);
    b.portal(r(14), 1, 'spider');

    // ---------------------------------------------------------------- C · araña (compases 14-20) a 2x
    const xC = r(14);
    b.color(xC, '#0a1430', '#050a1c', { line: '#6ab0ff', obj: '#ffffff' });
    pulsos(b, r, 14, 21, '#6ab0ff', '#2a5aa0');
    adornos(b, xC, r(21), '#6ab0ff', { step: 6 });
    b.hint(xC + 4, 3.4, 'Araña: toca para saltar al otro lado');
    b.block(xC + 3, 5, r(21) - 5 - (xC + 3), 5);
    {
      // pinchos en el suelo (F) o en el techo (C) a cada tiempo: la araña cambia de lado sobre el ritmo
      const P = [[14, 2, 'F', 2], [14, 3, 'C', 2], [15, 0, 'F', 2], [15, 2, 'C', 3], [15, 3, 'F', 2], [16, 0, 'C', 2], [16, 1, 'F', 3],
        [16, 3, 'C', 3], [17, 0, 'F', 2], [17, 1, 'C', 2], [17, 2, 'F', 2], [17, 3, 'C', 2], [18, 0, 'F', 3], [18, 2, 'C', 4],
        [19, 0, 'F', 2], [19, 1, 'C', 2], [19, 2, 'F', 2], [19, 3, 'C', 2], [20, 0, 'F', 3], [20, 2, 'C', 2]];
      for (const [n, q, side, w] of P) {
        if (side === 'F') b.spikes(r(n, q) + 1, w);
        else b.spikes(r(n, q) + 1, w, 4, 180);
      }
      b.coin(r(20, 3) + 1, 4);                            // en el techo cuando el ritmo pide suelo: ir y volver
    }
    b.corridor(r(21) - 5, 0, 5, [[2, 0, -1], [6, 0, 0]]);
    b.portal(r(21), 1, 'ball');

    // ---------------------------------------------------------------- D · corte (compás 21): bola a 1x
    const xD = r(21);
    b.color(xD, '#080812', '#040408', { line: '#9a9aff', obj: '#ffffff' });
    b.camzoom(xD, 1.2, 6);
    b.block(xD + 3, 8, r(22) - 7 - (xD + 3), 2);
    b.spike(r(21, 1) + 1);
    b.spike(r(21, 2) - 1, 7, 180);
    embudo(b, r(22) - 7, 5, 8);
    b.portal(r(22) - 1.5, 1, 'unflip');
    b.portal(r(22), 1, 'wave');

    // ---------------------------------------------------------------- E · drop 1 (compases 22-28): onda a 3x
    const xE = r(22);
    b.color(xE, '#3a0618', '#22030e', { line: '#ff3a6a', obj: '#ffffff' });
    b.camzoom(xE, 0.85, 3);
    b.shake(xE, 7, 4);
    pulsos(b, r, 22, 29, '#ff3a6a', '#ff8a3a');
    adornos(b, xE, r(29), '#ff3a6a', { step: 5, lines: 9.5 });
    for (let n = 22; n < 29; n++) b.camrotate(r(n), n % 2 ? 4 : -4, 5);
    b.camrotate(r(29), 0, 4);
    b.inGroup(2, () => { for (let i = 0; i < 7; i++) b.deco(xE + 12 + i * 24, -9, 'pillar', { w: 2, h: 9, color: '#ff3a6a', par: 0.4, alpha: 0.7 }); });
    b.move(xE, 2, 0, 9, 8, 'out');
    {
      const t = [];
      for (let n = 22; n < 24; n++) for (let q = n === 22 ? 1 : 0; q < 8; q++) t.push(r(n, q / 2));
      for (let n = 24; n < 26; n++) for (const q of [0, 1.5, 3]) t.push(r(n, q));
      for (let n = 26; n < 28; n++) for (let q = 0; q < 8; q++) t.push(r(n, q / 2));
      t.push(r(28), r(28, 1.5));
      onda(b, Math.ceil(xE) + 1, r(29) - 3, { f0: 0, dir: 1, turns: t, gap: (x) => (x >= r(26) && x < r(28) ? 3 : 4), tail: 6 });
    }
    b.portal(r(29), 1, 'ufo');

    // ---------------------------------------------------------------- F · ruptura (compases 29-31): ovni a 1x
    const xF = r(29);
    b.color(xF, '#100a2a', '#080518', { line: '#c0a8ff', obj: '#ffffff' });
    b.camzoom(xF, 1.15, 8);
    pulsos(b, r, 29, 32, '#c0a8ff');
    adornos(b, xF, r(32), '#c0a8ff', { step: 8 });
    {
      const G = [[29, 2, 1, 4], [30, 0, 4, 4], [30, 2, 2, 4], [31, 0, 4, 4]];
      // las columnas caen del cielo al empezar la ruptura (trigger move de verdad: llegan antes que el jugador)
      b.inGroup(10, () => puertas(b, G.map(([n, q, lo, s]) => [r(n, q) - 1, lo, s]), 10));
      b.move(xF, 10, 0, -10, 6, 'bounce');
      b.shake(xF + 6, 4, 2);
      // relámpagos: destellos que se encienden a contratiempo
      b.inGroup(3, () => { for (let n = 29; n < 32; n++) b.deco(r(n, 1), 8, 'glow', { r: 3, color: '#ffffff', alpha: 0.8 }); });
      for (let n = 29; n < 32; n++) { b.toggle(r(n), 3, false); b.toggle(r(n, 1), 3, true); b.toggle(r(n, 1.5), 3, false); }
    }
    embudo(b, r(32) - 10, 6);
    b.portal(r(32), 1, 'ball');

    // ---------------------------------------------------------------- G1 · bola a 2x (compases 32-36)
    const xG = r(32);
    b.color(xG, '#2a1406', '#180b03', { line: '#ffa040', obj: '#ffffff' });
    b.camzoom(xG, 1, 4);
    b.shake(xG, 5, 3);
    pulsos(b, r, 32, 37, '#ffa040', '#ff6020');
    adornos(b, xG, r(37), '#ffa040', { step: 6 });
    b.block(xG + 3, 8, r(37) - 8 - (xG + 3), 2);
    {
      const P = [[32, 2, 'F', 3], [32, 3, 'C', 3], [33, 0, 'F', 2], [33, 2, 'C', 3], [34, 0, 'F', 3], [34, 1, 'C', 2], [34, 2, 'F', 2],
        [35, 0, 'C', 3], [35, 2, 'F', 3], [35, 3, 'C', 2], [36, 0, 'F', 3]];
      for (const [n, q, side, w] of P) {
        if (side === 'F') b.spikes(r(n, q) + 1.5, w);
        else b.spikes(r(n, q) + 1.5, w, 7, 180);
      }
      b.saw(r(33, 1) + 1, 4, 1.5);
      b.saw(r(35, 1) + 1, 4, 1.5);
    }
    embudo(b, r(37) - 8, 6, 8);
    b.portal(r(37) - 2, 1, 'unflip');
    b.portal(r(37), 1, 'cube');
    b.portal(r(37) + 1.5, 1, 'mini');

    // ---------------------------------------------------------------- G2 · cubo mini a 2x (compases 37-41)
    const xG2 = r(37);
    b.color(xG2, '#0a2a1a', '#05180e', { line: '#5aff9a', obj: '#ffffff' });
    pulsos(b, r, 37, 42, '#5aff9a', '#2aa05a');
    adornos(b, xG2, r(42), '#5aff9a', { step: 6 });
    b.spike(r(37, 2) + 2);
    b.smalls(r(37, 3) + 2, 2);
    b.spike(r(38) + 2);
    b.block(r(38, 1) + 2, 0, 3, 1);
    b.smalls(r(38, 1) + 5, 3);
    b.spike(r(38, 2) + 4.5);
    b.block(r(38, 3) + 2, 1.2, 10, 1);                  // túnel bajo: sólo cabe el mini
    b.small(r(39) + 1.5, 2.2);
    b.spikes(r(39, 1) + 3.5, 2);
    b.spike(r(39, 2) + 2);
    b.smalls(r(39, 3) + 2, 3);
    b.block(r(40) + 2, 0, 2, 1);
    b.spike(r(40) + 4);
    b.block(r(40) + 5, 0, 2, 1);
    b.spike(r(40, 2) + 2);
    b.spikes(r(40, 3) + 2, 2);
    b.spike(r(41) + 2);
    b.smalls(r(41, 1) + 2, 2);
    b.block(r(42) - 1.5, 7, r(44) - 1 - (r(42) - 1.5), 3);      // techo del dual
    b.portal(r(42) - 3, 1, 'big');
    b.portal(r(42), 1, 'dual');

    // ---------------------------------------------------------------- H · pico (compases 42-43): dual a 3x
    const xH = r(42);
    b.color(xH, '#3a0a3a', '#220622', { line: '#ff5aff', obj: '#ffffff' });
    b.shake(xH, 8, 4);
    b.camzoom(xH, 0.9, 3);
    pulsos(b, r, 42, 44, '#ff5aff', '#ff2aaa');
    adornos(b, xH, r(44), '#ff5aff', { step: 5 });
    b.hint(xH + 2, 3.6, 'Dual: los dos saltan a la vez');
    b.spike(r(42, 1) + 3);
    b.spike(r(42, 2) + 3, 6, 180);
    b.spike(r(42, 3) + 3);
    b.spike(r(42, 3) + 3, 6, 180);
    b.block(r(43) + 3, 0, 3, 1);
    b.block(r(43) + 3, 6, 3, 1);
    b.spikes(r(43, 1) + 4, 2);
    b.spikes(r(43, 2) + 4, 2, 6, 180);
    b.portal(r(44) - 1.5, 1, 'single');
    b.portal(r(44), 1, 'swing', { floor: 0 });

    // ---------------------------------------------------------------- I · columpio a 2x (compases 44-49)
    const xI = r(44);
    b.color(xI, '#14104a', '#0a082e', { line: '#8a8aff', obj: '#ffffff' });
    b.camzoom(xI, 1, 4);
    pulsos(b, r, 44, 50, '#8a8aff', '#5a5aff');
    adornos(b, xI, r(50), '#8a8aff', { step: 6 });
    corona(b, 4, xI + 50, 6, 3.5, '#8a8aff', 10);
    b.rotate(xI, 4, -540, r(50) - xI, 'linear');
    {
      const G = [[44, 2, 4, 4], [45, 0, 0, 4], [45, 2, 5, 4], [46, 0, 1, 4], [46, 2, 5.5, 3.5], [47, 0, 1.5, 3.5], [47, 2, 6, 3.5],
        [48, 0, 2, 3.5], [48, 2, 5, 3.5], [49, 0, 1, 4]];
      puertas(b, G.map(([n, q, lo, s]) => [r(n, q) - 1, lo, s]));
      b.saw(r(46, 1), 8.5, 1.2);
      b.saw(r(47, 1), 0.6, 1.2);
      b.saw(r(48, 1), 8.6, 1.2);
    }
    embudo(b, r(50) - 10, 6);
    b.portal(r(50) - 2.5, 1, 'unflip');
    b.portal(r(50) - 1.2, 1, 'mini');
    b.portal(r(50), 1, 'ship');

    // ---------------------------------------------------------------- J · subida (compases 50-53): nave mini a 3x
    const xJ = r(50);
    b.color(xJ, '#30200a', '#1c1205', { line: '#ffd040', obj: '#ffffff' });
    b.shake(xJ, 4, 3);
    pulsos(b, r, 50, 54, '#ffd040', '#ffa020');
    adornos(b, xJ, r(54), '#ffd040', { step: 5 });
    b.camzoom(xJ, 1.1, r(54) - xJ, 'in');
    {
      const t0 = Math.ceil(xJ) + 4, t1 = Math.floor(r(54) - 11);
      const per = (r(52) - r(50)) / 2;
      // empieza abajo (sale del canal del embudo) y sube poco a poco hasta ondular en el centro
      const e = (x) => Math.min(1, (x - t0) / 14);
      b.tunnel(t0, t1, (x) => 1.5 + 3 * e(x) + 2.6 * Math.sin(((x - t0) / per) * Math.PI * 2) * e(x), 3);
    }
    embudo(b, r(54) - 10, 6);
    b.portal(r(54) - 1.5, 1, 'big');
    b.portal(r(54), 1, 'cube');

    // ---------------------------------------------------------------- K · silencio (compases 54-55): cubo a 0,5x
    const xK = r(54);
    b.color(xK, '#030306', '#010103', { line: '#5a5a7a', obj: '#c0c0d0' });
    b.camzoom(xK, 1.35, r(56) - xK, 'inout');
    b.camrotate(xK, -8, r(56) - xK, 'inout');
    b.small(r(54, 2) + 1.5);
    b.spike(r(55) + 1.5);
    b.spike(r(55, 2) + 1.5);
    b.deco(r(55), 4, 'ring', { r: 4, color: '#ff2a6d', alpha: 0.5 });
    b.portal(r(56), 1, 'wave');
    b.portal(r(56) + 1, 1, 'dual');

    // ---------------------------------------------------------------- L · drop final (compases 56-62): onda dual a 3x
    const xL = r(56);
    b.color(xL, '#40061e', '#260310', { line: '#ff2a6d', obj: '#ffffff' });
    b.camzoom(xL, 0.8, 2);
    b.camrotate(xL, 0, 2);
    b.shake(xL, 10, 5);
    pulsos(b, r, 56, 63, '#ff2a6d', '#ffb02a');
    adornos(b, xL, r(63), '#ff2a6d', { step: 5 });
    corona(b, 5, xL + 30, 5, 4.5, '#ffb02a', 12);
    b.rotate(xL, 5, 1080, r(63) - xL, 'linear');
    b.inGroup(6, () => { for (let i = 0; i < 7; i++) b.deco(xL + 8 + i * 25, 12, 'diamond', { r: 1, color: '#ff2a6d', par: 0.3 }); });
    for (let n = 56; n < 63; n++) b.move(r(n), 6, 0, n % 2 ? 2 : -2, 6, 'bounce');
    b.hint(xL + 4, 5, 'Onda dual: tu reflejo hace lo contrario');
    {
      // un estrecho cada dos tiempos y, entre medias, un obstáculo central
      const P = [];
      for (let n = 56; n < 63; n++) for (const q of [0, 2]) {
        if (n === 56 && q === 0) continue;
        if (n === 62 && q === 2) break;
        P.push([r(n, q), 'e', 3]);
        const mid = r(n, q + 1);
        if ((n + q / 2) % 3 === 0) P.push([mid, 's', 2]);
        else P.push([mid, 'c', n >= 60 ? 1.5 : 1]);
      }
      dualOnda(b, P);
      b.coin(r(58, 1) - 0.5, 0.15);                    // pegada al suelo bajo un obstáculo central
    }
    // canal central para el portal de vuelta a uno solo
    b.corridor(r(63) - 7, 0, 10, [[3, 1, -1], [1, 0.5, -0.5], [6, 0, 0]]);
    b.portal(r(63) - 1.5, 4.2, 'single');
    b.portal(r(63), 4.2, 'ufo');

    // ---------------------------------------------------------------- M · respiro corto (compás 63): ovni a 2x
    const xM = r(63);
    b.color(xM, '#120a2a', '#0a0518', { line: '#c0a8ff', obj: '#ffffff' });
    b.camzoom(xM, 1, 3);
    puertas(b, [[r(63, 2) - 1, 2, 4.5]]);
    embudo(b, r(64) - 10, 6);
    b.portal(r(64), 1, 'ship');
    b.portal(r(64) + 4, 1, 'dual');

    // ---------------------------------------------------------------- N1 · drop final 2 (compases 64-67): nave dual a 3x
    const xN = r(64);
    b.color(xN, '#3a1406', '#220b03', { line: '#ff8a2a', obj: '#ffffff' });
    b.shake(xN, 8, 4);
    b.camzoom(xN, 0.85, 3);
    pulsos(b, r, 64, 68, '#ff8a2a', '#ff2a6d');
    adornos(b, xN, r(68), '#ff8a2a', { step: 5 });
    for (let n = 64; n < 68; n++) b.camrotate(r(n), n % 2 ? 6 : -6, 4);
    {
      const P = [];
      for (let n = 64; n < 68; n++) for (const q of [0, 2]) {
        if (n === 64 && q === 0) continue;
        P.push([r(n, q), 'c', n >= 66 ? 1.5 : 1]);
        if (!(n === 67 && q === 2)) P.push([r(n, q + 1), 'e', 2]);
      }
      dualNave(b, P);
    }
    b.block(r(68) - 6, 0, 10, 3.5);
    b.block(r(68) - 6, 6.5, 10, 3.5);
    b.portal(r(68) - 1.5, 4.2, 'single');
    b.portal(r(68), 4.2, 'wave');

    // ---------------------------------------------------------------- N2 · onda a 4x (compases 68-70)
    const xN2 = r(68);
    b.color(xN2, '#400616', '#26030c', { line: '#ff5a7a', obj: '#ffffff' });
    b.camrotate(xN2, 0, 3);
    b.camzoom(xN2, 0.8, 3);
    b.shake(xN2, 6, 3);
    pulsos(b, r, 68, 71, '#ff5a7a', '#ffffff');
    adornos(b, xN2, r(71), '#ff5a7a', { step: 5, lines: 9.5 });
    {
      const t = [];
      for (let n = 68; n < 71; n++) for (let q = 0; q < 8; q++) if (!(n === 68 && q < 2)) t.push(r(n, q / 2));
      onda(b, Math.round(r(68) + 4), r(71) - 3, { f0: 3, dir: -1, turns: t, gap: () => 4, tail: 6 });
    }
    b.portal(r(71), 1, 'cube');

    // ---------------------------------------------------------------- O · respiro (compases 71-73): cubo a 1x
    const xO = r(71);
    b.color(xO, '#140a24', '#0a0514', { line: '#ff6a9a', obj: '#ffe0ea' });
    b.camzoom(xO, 1.1, 6);
    b.camrotate(xO, 0, 4);
    pulsos(b, r, 71, 74, '#ff6a9a');
    adornos(b, xO, r(74), '#ff6a9a');
    b.spike(r(71, 2) + 2);
    b.spikes(r(72) + 2, 2);
    b.block(r(72, 2) + 2, 0, 3, 1);
    b.spike(r(73) + 2);
    b.spikes(r(73, 2) + 2, 2);

    // ---------------------------------------------------------------- P · último golpe (compás 74): nave a 3x
    const xP = r(74);
    b.portal(xP, 1, 'ship');
    b.color(xP, '#ff2a6d', '#40061e', { line: '#ffffff', obj: '#ffffff' });
    b.color(xP + 3, '#3a0618', '#22030e', { line: '#ff2a6d', obj: '#ffffff' });
    b.shake(xP, 10, 5);
    b.camzoom(xP, 0.8, 3);
    pulsos(b, r, 74, 75, '#ffffff', '#ff2a6d');
    puertas(b, [[r(74, 1) - 1, 2, 4.5]]);
    embudo(b, r(75) - 10, 6);
    b.portal(r(75), 1, 'cube');

    // ---------------------------------------------------------------- Q · final (compás 75): cubo a 1x
    const xQ = r(75);
    b.color(xQ, '#140a24', '#0a0514', { line: '#ff6a9a', obj: '#ffe0ea' });
    b.camzoom(xQ, 1, 6);
    b.pulse(xQ, '#ff6a9a', 6);
    b.deco(r.end - 3, 3.5, 'diamond', { r: 1.4, color: '#ff2a6d', beat: true });
    corona(b, 7, r.end - 3, 3.5, 3, '#ff2a6d');
    b.rotate(xQ, 7, 180, r.end - xQ, 'out');
    return b.build(r.end);
  }

  function build(H) {
    ({ Builder, rejilla, ritmo, adornos, UPS } = H);
    return apex();
  }
  let Builder, rejilla, ritmo, adornos, UPS; // eslint-disable-line no-unused-vars
  if (typeof module !== 'undefined' && module.exports) module.exports = build;
  else (root.NIVELES = root.NIVELES || {})['apex'] = build;
})(typeof globalThis !== 'undefined' ? globalThis : this);
