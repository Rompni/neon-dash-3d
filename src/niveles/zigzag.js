/* NEON DASH — nivel 'zigzag'. Se registra en NIVELES; levels.js lo construye con las utilidades comunes. */
(function (root) {
  'use strict';
  // ------------------------------------------------------------------ 11
  // ZigZag (ZigZag Velocity, 160 BPM): columpio y onda sobre el hielo, con cambios de velocidad en cada drop.
  // Intro de cubo → un compás a 0,5x → drop 1 en onda a 2x → columpio a 2x → cubo a 2x → ruptura en ovni a 1x →
  // drop 2 en onda a 3x → columpio a 3x → onda mini a 2x → columpio a 4x → onda a 2x → final en cubo.
  // Todo cae en la rejilla de la canción: r(compás, tiempo) da la x en que suena cada tiempo.

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

  // Puertas (columnas con un hueco) para el columpio y el ovni: [x, fila baja del hueco, alto, ancho].
  // dy: las construye desplazadas (para que un trigger move las traiga a su sitio antes de que llegue el jugador).
  function puertas(b, list, dy) {
    dy = dy || 0;
    for (const [x, lo, size, w] of list) {
      if (lo > 0) b.block(x, dy, w || 2, lo);
      if (lo + size < 10) b.block(x, lo + size + dy, w || 2, 10 - lo - size);
    }
  }

  // Embudo para salir de un modo volador: el techo baja de 10 a 3 en 7 columnas y sigue plano `len` columnas.
  function embudo(b, x, len) { return b.corridor(x, 0, 10, [[7, 0, -1], [len, 0, 0]]); }

  // Pulsos en cada compás (fuerte) y en cada tiempo (suave) entre los compases a y z.
  function pulsos(b, r, a, z, c1, c2) {
    for (let n = a; n < z; n++) {
      b.pulse(r(n), c1, 4);
      if (c2) for (let t = 1; t < 4; t++) b.pulse(r(n, t), c2, 2);
    }
  }

  // Corona de cristales (decorados con grupo): un anillo grande con diamantes alrededor que el nivel gira.
  function corona(b, g, x, y, rad, color) {
    b.inGroup(g, () => {
      b.deco(x, y, 'ring', { r: rad, color, alpha: 0.7, par: 0.2 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        b.deco(x + Math.cos(a) * rad, y + Math.sin(a) * rad, 'diamond', { r: 0.5, color, par: 0.2 });
      }
    });
  }

  function zigzag() {
    const tramos = [[0, 1], [6, 0.5], [7, 2], [14, 1], [15, 2], [32, 1], [39, 3], [56, 2], [64, 4], [68, 2], [71, 1]];
    const r = ritmo('zigzag-velocity', tramos);
    const b = new Builder({
      id: 'zigzag', card: '#38d4ff', theme: 'original', theme3d: 'glaciar', name: 'ZigZag', difficulty: 'Muy difícil', stars: 8,
      song: 'track:zigzag-velocity', synth: 'espejo', bpm: r.track.bpm, startSpeed: tramos[0][1],
    });
    // Portales de velocidad justo al empezar cada compás de cambio (y = 1: a ras de suelo o dentro del canal).
    for (const [bar, v] of tramos.slice(1)) b.speed(r(bar), 1, v);

    // ---------------------------------------------------------------- A · intro (compases 0-5): cubo a 1x
    b.color(0, '#0b2240', '#06152a', { line: '#9fe8ff', obj: '#e8fbff' });
    adornos(b, 0, r(6), '#9fe8ff');
    b.deco(8, 5, 'glow', { r: 5, color: '#38d4ff', alpha: 0.6 });
    pulsos(b, r, 0, 6, '#9fe8ff');
    b.spike(r(0, 2) + 2);
    b.spike(r(1) + 2);
    b.spikes(r(1, 2) + 2, 2);
    // escalera de hielo: un salto por tiempo
    b.block(r(2) + 2, 0, 3, 1);
    b.block(r(2, 1) + 2.5, 0, 3, 2);
    b.small(r(2) + 5, 0);
    b.spikes(r(2, 2) + 3.5, 2);
    b.spike(r(3) + 2);
    b.spikes(r(3, 2) + 2, 2);
    // pad amarillo sobre una fila de pinchos y dos saltos sueltos
    b.pad(r(4) + 0.5, 0, 'yellow');
    b.spikes(r(4) + 1.5, 4);
    b.spike(r(4, 2) + 2.5);
    b.spike(r(4, 3) + 2.5);
    // foso con orbe
    b.spike(r(5) + 2);
    b.spikes(r(5, 2) + 1.5, 6);
    b.orb(r(5, 2) + 3.5, 2);

    // ---------------------------------------------------------------- B · respiro (compás 6): 0,5x
    b.color(r(6), '#050c18', '#02060e', { line: '#5a7cff', obj: '#cfe0ff' });
    b.camzoom(r(6), 0.8, 8);
    b.small(r(6, 2) + 1.5);
    b.deco(r(6) + 6, 5, 'glow', { r: 6, color: '#5a7cff', alpha: 0.7 });
    b.hint(r(6) + 2, 4.5, 'Onda: mantén para subir, suelta para bajar');

    // ---------------------------------------------------------------- C · drop 1 (compases 7-13): onda a 2x
    const xC = r(7);
    b.portal(xC, 1, 'wave');
    b.color(xC, '#0a3358', '#05203a', { line: '#38d4ff', obj: '#ffffff' });
    b.camzoom(xC, 1, 4);
    b.shake(xC, 5, 3);
    pulsos(b, r, 7, 14, '#38d4ff', '#1a7aff');
    adornos(b, xC, r(14), '#38d4ff', { step: 5, lines: 9.5 });
    corona(b, 1, xC + 40, 6, 3, '#9fe8ff');
    b.rotate(xC, 1, 720, r(14) - xC, 'linear');
    {
      const t = [];
      for (let n = 7; n < 9; n++) for (let q = n === 7 ? 1 : 0; q < 4; q++) t.push(r(n, q));     // negras
      for (let n = 9; n < 11; n++) for (let q = 0; q < 8; q++) t.push(r(n, q / 2));              // corcheas
      for (let n = 11; n < 13; n++) for (const q of [0, 1.5, 3]) t.push(r(n, q));               // 3-3-2
      t.push(r(13), r(13, 1));
      onda(b, Math.ceil(xC) + 1, r(14) - 3, { f0: 0, dir: 1, turns: t, gap: (x) => (x >= r(11) && x < r(13) ? 3 : 4), tail: 6 });
    }

    // ---------------------------------------------------------------- D · corte (compás 14): cubo a 1x
    const xD = r(14);
    b.portal(xD, 1, 'cube');
    b.color(xD, '#050c18', '#02060e', { line: '#5a7cff', obj: '#cfe0ff' });
    b.spike(r(14, 2) + 2);
    b.coin(r(14, 1) + 2, 2.6);                    // en el aire, donde no hace falta saltar: un salto de más

    // ---------------------------------------------------------------- E · columpio a 2x (compases 15-22)
    const xE = r(15);
    b.portal(xE, 1, 'swing', { floor: 0 });
    b.color(xE, '#16204e', '#0b1232', { line: '#b8a8ff', obj: '#ffffff' });
    b.hint(xE + 2, 6, 'Columpio: cada toque invierte la gravedad');
    b.shake(xE, 4, 3);
    pulsos(b, r, 15, 23, '#b8a8ff', '#6a5aff');
    adornos(b, xE, r(23), '#b8a8ff', { step: 6 });
    {
      // [compás, tiempo, fila baja, alto]
      const G = [[15, 2, 3, 4], [16, 0, 0, 4], [16, 2, 5, 4], [17, 0, 1, 4], [17, 2, 5, 4], [18, 0, 2, 4], [18, 2, 6, 4],
        [19, 0, 2, 3.5], [19, 2, 5, 3.5], [20, 0, 1, 3.5], [20, 2, 5.5, 3.5], [21, 0, 2, 3.5], [21, 2, 6, 3.5], [22, 0, 1, 4]];
      puertas(b, G.map(([n, q, lo, s]) => [r(n, q) - 1, lo, s]));
      // sierras entre puertas en la segunda mitad
      b.saw(r(19, 1), 8.5, 1.2);
      b.saw(r(20, 1), 0.6, 1.2);
      b.saw(r(21, 1), 8.6, 1.2);
    }
    embudo(b, r(23) - 10, 6);
    b.portal(r(23), 1, 'cube');
    b.portal(r(23) + 1.5, 1, 'unflip');

    // ---------------------------------------------------------------- F · cubo a 2x (compases 23-31)
    const xF = r(23);
    b.color(xF, '#0c3a4a', '#062430', { line: '#7affea', obj: '#ffffff' });
    pulsos(b, r, 23, 32, '#7affea', '#2ab8a8');
    adornos(b, xF, r(32), '#7affea', { step: 6 });
    b.spike(r(23, 2) + 2.5);
    b.spikes(r(24) + 2, 2);
    b.block(r(24, 2) + 2.5, 0, 3, 1);
    b.spikes(r(24, 3) + 1.5, 2);
    b.pad(r(25) + 0.5, 0, 'yellow');
    b.spikes(r(25) + 1.5, 5);
    b.spike(r(25, 2) + 2.5);
    b.spikes(r(26) + 1.5, 9);
    b.orb(r(26) + 3, 2);
    // escalera: un escalón por tiempo
    b.block(r(27) + 2.5, 0, 2, 1);
    b.small(r(27) + 4.5);
    b.block(r(27, 1) + 2.5, 0, 2, 2);
    b.small(r(27, 1) + 4.5);
    b.block(r(27, 2) + 2.5, 0, 3, 3);
    b.spikes(r(27, 3) + 2, 3);
    b.spikes(r(28) + 2.5, 2);
    b.spike(r(28, 2) + 2.5);
    b.spike(r(28, 3) + 2.5);
    b.spikes(r(29) + 2, 3);
    b.spikes(r(29, 2) + 2, 3);
    b.block(r(30) + 2.5, 0, 3, 2);
    b.spikes(r(30) + 5.5, 3);
    b.spike(r(30, 2) + 4);
    for (let q = 0; q < 4; q++) b.spike(r(31, q) + 2.5);

    // ---------------------------------------------------------------- G · ruptura (compases 32-38): ovni a 1x
    const xG = r(32);
    b.portal(xG, 1, 'ufo');
    b.color(xG, '#1a1440', '#0e0b28', { line: '#d8c8ff', obj: '#ffffff' });
    b.camzoom(xG, 1.12, 8);
    pulsos(b, r, 32, 39, '#d8c8ff');
    adornos(b, xG, r(39), '#d8c8ff', { step: 8 });
    {
      const G = [[32, 2, 1, 4], [33, 0, 4, 4], [33, 2, 2, 4], [34, 0, 5, 4], [34, 2, 3, 4], [35, 0, 3, 4], [35, 2, 5, 4],
        [36, 0, 2, 4], [36, 2, 4, 4], [37, 0, 1, 4], [37, 2, 4, 4], [38, 0, 2, 4]];
      puertas(b, G.map(([n, q, lo, s]) => [r(n, q) - 1, lo, s]));
      b.coin(r(35, 1), 0.2);                      // abajo entre dos puertas altas: dejarse caer y remontar
      // cristales que se encienden y apagan a cada tiempo
      b.inGroup(2, () => { for (let n = 32; n < 39; n++) b.deco(r(n, 1), 8.5, 'diamond', { r: 0.6, color: '#d8c8ff' }); });
      b.inGroup(3, () => { for (let n = 32; n < 39; n++) b.deco(r(n, 3), 8.5, 'diamond', { r: 0.6, color: '#38d4ff' }); });
      for (let n = 32; n < 39; n++) for (let q = 0; q < 4; q++) { b.toggle(r(n, q), q % 2 ? 2 : 3, false); b.toggle(r(n, q), q % 2 ? 3 : 2, true); }
    }
    embudo(b, r(39) - 10, 6);
    b.portal(r(39), 1, 'wave');

    // ---------------------------------------------------------------- H · drop 2 (compases 39-47): onda a 3x
    const xH = r(39);
    b.color(xH, '#082a5a', '#041838', { line: '#5af0ff', obj: '#ffffff' });
    b.camzoom(xH, 0.85, 4);
    b.shake(xH, 6, 4);
    pulsos(b, r, 39, 48, '#5af0ff', '#1a9aff');
    adornos(b, xH, r(48), '#5af0ff', { step: 5, lines: 9.5 });
    // la cámara se inclina a un lado y al otro en cada compás: zigzag
    for (let n = 39; n < 48; n++) b.camrotate(r(n), n % 2 ? 5 : -5, 6);
    b.camrotate(r(48), 0, 4);
    // pilares de hielo que suben del suelo al empezar el drop
    b.inGroup(4, () => { for (let i = 0; i < 8; i++) b.deco(xH + 10 + i * 24, -8, 'pillar', { w: 2, h: 8, color: '#5af0ff', par: 0.4, alpha: 0.7 }); });
    b.move(xH, 4, 0, 8, 10, 'out');
    {
      const t = [];
      for (let n = 39; n < 41; n++) for (let q = n === 39 ? 1 : 0; q < 4; q++) t.push(r(n, q));
      for (let n = 41; n < 43; n++) for (let q = 0; q < 8; q++) t.push(r(n, q / 2));
      for (let n = 43; n < 45; n++) for (const q of [0, 1.5, 3]) t.push(r(n, q));
      for (let n = 45; n < 47; n++) for (let q = 0; q < 4; q++) t.push(r(n, q));
      t.push(r(47), r(47, 2));
      const w = onda(b, Math.ceil(xH) + 1, r(48) - 3, { f0: 0, dir: 1, turns: t, gap: (x) => (x >= r(45) && x < r(47) ? 3 : 4), tail: 6 });
      // moneda pegada al techo en la cresta de un tramo largo: hay que apurar la subida
      const top = w.path.filter((p) => p.x > r(40, 1) && p.x < r(40, 3)).reduce((a, p) => (p.c > a.c ? p : a));
      b.coin(top.x - 0.5, top.c + 0.4);
    }

    // ---------------------------------------------------------------- I · columpio a 3x (compases 48-55)
    const xI = r(48);
    b.portal(xI, 1, 'swing', { floor: 0 });
    b.color(xI, '#2a1450', '#180b32', { line: '#ff9cf0', obj: '#ffffff' });
    b.camzoom(xI, 0.9, 4);
    b.shake(xI, 4, 3);
    pulsos(b, r, 48, 56, '#ff9cf0', '#b04cff');
    adornos(b, xI, r(56), '#ff9cf0', { step: 6 });
    corona(b, 5, xI + 60, 6, 3.5, '#ff9cf0');
    b.rotate(xI, 5, -720, r(56) - xI, 'linear');
    {
      const G = [[48, 2, 4, 4], [49, 0, 0, 4], [49, 2, 5, 4], [50, 0, 1, 4], [50, 2, 6, 4], [51, 0, 2, 3.5], [51, 2, 5.5, 3.5],
        [52, 0, 1, 3.5], [52, 2, 5, 3.5], [53, 0, 1.5, 3.5], [53, 2, 6, 3.5], [54, 0, 2, 3.5], [54, 2, 5, 4], [55, 0, 1, 4]];
      // las puertas salen del suelo al empezar la sección (trigger move de verdad: llegan antes que el jugador)
      b.inGroup(10, () => puertas(b, G.map(([n, q, lo, s]) => [r(n, q) - 1, lo, s]), -10));
      b.move(xI, 10, 0, 10, 6, 'out');
      b.saw(r(51, 1), 8.6, 1.2);
      b.saw(r(52, 1), 0.5, 1.2);
      b.saw(r(53, 1), 8.6, 1.2);
    }
    embudo(b, r(56) - 10, 6);
    b.portal(r(56) - 2.5, 1, 'unflip');
    b.portal(r(56) - 1.2, 1, 'mini');
    b.portal(r(56), 1, 'wave');

    // ---------------------------------------------------------------- J · onda mini a 2x (compases 56-63)
    const xJ = r(56);
    b.color(xJ, '#0a3a3a', '#052424', { line: '#7affc8', obj: '#ffffff' });
    b.camzoom(xJ, 1, 4);
    b.shake(xJ, 5, 3);
    pulsos(b, r, 56, 64, '#7affc8', '#2affa0');
    adornos(b, xJ, r(64), '#7affc8', { step: 5, lines: 9.5 });
    b.hint(xJ + 3, 8.4, 'Onda mini: el doble de empinada');
    {
      const t = [];
      for (let n = 56; n < 63; n++) for (let q = n === 56 ? 1 : 0; q < 8; q++) t.push(r(n, q / 2));
      onda(b, Math.ceil(xJ) + 1, r(64) - 3, { f0: 0, dir: 1, k: 2, turns: t, gap: (x) => (x >= r(60) ? 4 : 5), tail: 6 });
    }
    b.portal(r(64) - 1.5, 1, 'big');
    b.portal(r(64), 1, 'swing', { floor: 0 });

    // ---------------------------------------------------------------- K · columpio a 4x (compases 64-67)
    const xK = r(64);
    b.color(xK, '#4a1030', '#2e081c', { line: '#ff7ab0', obj: '#ffffff' });
    b.camzoom(xK, 0.8, 4);
    b.shake(xK, 7, 4);
    pulsos(b, r, 64, 68, '#ff7ab0', '#ff3a7a');
    adornos(b, xK, r(68), '#ff7ab0', { step: 6 });
    {
      const G = [[64, 2, 4, 4], [65, 0, 0.5, 4], [65, 2, 5, 4], [66, 0, 1, 4], [66, 2, 5.5, 4], [67, 0, 1, 4]];
      puertas(b, G.map(([n, q, lo, s]) => [r(n, q) - 1, lo, s]));
    }
    embudo(b, r(68) - 10, 6);
    b.portal(r(68) - 1.5, 1, 'unflip');
    b.portal(r(68), 1, 'wave');

    // ---------------------------------------------------------------- L · onda a 2x (compases 68-70)
    const xL = r(68);
    b.color(xL, '#0b2a50', '#061a34', { line: '#9fe8ff', obj: '#ffffff' });
    b.camzoom(xL, 1, 6);
    pulsos(b, r, 68, 71, '#9fe8ff');
    adornos(b, xL, r(71), '#9fe8ff', { step: 6 });
    {
      const t = [];
      for (let n = 68; n < 71; n++) for (let q = n === 68 ? 1 : 0; q < 4; q++) t.push(r(n, q));
      onda(b, Math.ceil(xL) + 1, r(71) - 3, { f0: 0, dir: 1, turns: t, gap: () => 4, tail: 6 });
    }
    b.portal(r(71), 1, 'cube');

    // ---------------------------------------------------------------- M · final (compases 71-72): cubo a 1x
    const xM = r(71);
    b.color(xM, '#0b2240', '#06152a', { line: '#9fe8ff', obj: '#e8fbff' });
    pulsos(b, r, 71, 73, '#9fe8ff');
    b.spike(r(71, 2) + 2);
    b.spikes(r(72) + 2, 2);
    b.deco(r.end - 4, 3, 'diamond', { r: 1.4, color: '#38d4ff', beat: true });
    return b.build(r.end);
  }

  function build(H) {
    ({ Builder, rejilla, ritmo, adornos, UPS } = H);
    return zigzag();
  }
  let Builder, rejilla, ritmo, adornos, UPS; // eslint-disable-line no-unused-vars
  if (typeof module !== 'undefined' && module.exports) module.exports = build;
  else (root.NIVELES = root.NIVELES || {})['zigzag'] = build;
})(typeof globalThis !== 'undefined' ? globalThis : this);
