/* NEON DASH — nivel 'orbita'. Se registra en NIVELES; levels.js lo construye con las utilidades comunes. */
(function (root) {
  'use strict';
  // ------------------------------------------------------------------ 2
  // Bola y ovni por el espacio, al ritmo de 'Starlight Journey' (144 BPM, 80 compases).
  // Estructura de la canción (energy, frases de 16 compases desplazadas uno: 15, 31, 47, 63):
  //   0-2 intro suave · 3-14 subida · 15 DROP 1 (+7 dB) · 31 segunda frase, algo más fuerte (2x)
  //   47 tercera frase (1x, plataformas) · 63-64 respiro (-3 dB) · 65 DROP FINAL (2x) · 79 cierre (-5 dB)
  function orbita() {
    const TRAMOS = [[0, 1], [31, 2], [47, 1], [65, 2]];
    const r = ritmo('starlight-journey', TRAMOS);
    const b = new Builder({
      id: 'orbita',
      card: '#2e8bff',
      theme: 'original',
      theme3d: 'espacio',
      name: 'Órbita',
      difficulty: 'Normal',
      stars: 4,
      song: 'track:starlight-journey',
      synth: 'orbita',
      bpm: r.track.bpm,
      startSpeed: TRAMOS[0][1],
    });
    for (const [c, v] of TRAMOS.slice(1)) b.speed(r(c), 1, v);

    // ---------------------------------------------------------- utilidades del nivel
    // Sección: color, decorado y pulsos (en los drops a cada tiempo y una sacudida al empezar; si no, a cada compás).
    function seccion(c0, c1, bg, ground, line, obj, drop, adorn) {
      b.color(r(c0), bg, ground, { line, obj });
      adornos(b, r(c0), r(c1), line, adorn);
      for (let k = c0; k < c1; k++) {
        b.pulse(r(k), line, drop ? 4 : 3);
        if (drop) for (let q = 1; q < 4; q++) b.pulse(r(k, q), obj, 2);
      }
      if (drop) b.shake(r(c0), 4, 3);
    }
    // Embudo hacia un portal en x: el techo baja con rampas desde `ceil` hasta 3 y sigue plano hasta x + 2,
    // para que ningún modo pueda pasar por encima del portal.
    function embudo(x, ceil) {
      x = Math.floor(x);
      b.corridor(x - (ceil - 3) - 2, 0, ceil, [[ceil - 3, 0, -1], [4, 0, 0]]);
      b.portal(x + 1, 1, 'unflip');        // y siempre con la gravedad normal (la bola puede llegar pegada al techo)
    }
    // Pinchos de cubo para saltar justo en el tiempo (c, t). dx: cuánto avanza el salto hasta el centro (1x ≈ 2,3).
    // y: fila de pinchos colgados (cubo boca abajo).
    function pinchos(c, t, n, y, dx) {
      const x0 = Math.round((r(c, t) + (dx || 2.3) - n / 2) * 2) / 2;
      if (y) b.spikes(x0, n, y, 180);
      else b.spikes(x0, n);
    }
    // Bola: cambios de lado en los tiempos de `flips` ([compás, tiempo, pinchos?]), empezando en el suelo. Tras
    // cada cambio, una fila de pinchos en el lado que deja (suelo o techo), que empieza `d` bloques después del
    // toque y nunca llega hasta donde la bola vuelve a ese lado. fl = bloques que tarda en cruzar (1x 3,5; 2x 4,4).
    function bola(flips, fl, d, maxN, top) {
      top = top || 8;
      let up = true;
      for (let i = 0; i < flips.length; i++) {
        const x0 = r(flips[i][0], flips[i][1]);
        const x1 = i + 1 < flips.length ? r(flips[i + 1][0], flips[i + 1][1]) : x0 + 12;
        const n = Math.max(1, Math.min(flips[i][2] || maxN, Math.floor(x1 + fl - 1.5 - (x0 + d))));
        if (up) b.spikes(x0 + d, n); else b.spikes(x0 + d, n, top - 1, 180);
        up = !up;
      }
    }
    // Columna de ovni en x con un hueco de `size` filas desde la fila `lo`.
    function puerta(x, lo, size, w) {
      w = w || 2;
      if (lo > 0) b.block(x, 0, w, lo);
      b.block(x, lo + size, w, 10 - (lo + size));
    }

    // Luna decorativa (grupo g, sin choque): un anillo con dos satélites que gira `deg` grados entre x0 y x1.
    function luna(x, y, rad, color, g, x0, x1, deg) {
      b.deco(x, y, 'ring', { r: rad, color, alpha: 0.55, par: 0.25 });
      b.inGroup(g, () => {
        b.deco(x + rad, y, 'diamond', { r: 0.55, color, alpha: 0.85 });
        b.deco(x - rad, y, 'diamond', { r: 0.4, color, alpha: 0.7 });
        b.deco(x, y + rad, 'glow', { r: 1.2, color, alpha: 0.5 });
      });
      b.rotate(x0, g, deg, x1 - x0, 'inout', [x, y]);
    }

    // ---------------------------------------------------------- A · intro (compases 0-2): cubo tranquilo
    seccion(0, 3, '#0a0f2e', '#060a1e', '#7ab8ff', '#9ad0ff', false);
    b.deco(10, 6, 'ring', { r: 3, color: '#7ab8ff', alpha: 0.5, par: 0.3 });
    b.deco(r(1, 2), 7, 'glow', { r: 4, color: '#2e8bff', alpha: 0.5 });
    pinchos(1, 0, 1);
    pinchos(1, 2, 1);
    pinchos(2, 0, 2);
    b.block(r(2, 2) + 2, 0, 3, 1);

    // ---------------------------------------------------------- B · subida (compases 3-8): cubo y pads azules
    seccion(3, 9, '#0c1640', '#070d28', '#27e3ff', '#ffd23a', false, { lines: 8.5 });
    pinchos(3, 0, 1);
    pinchos(3, 2, 2);
    // escalón y bajada sobre dos pinchos
    b.block(r(4) + 2, 0, 4, 1);
    b.spikes(r(4) + 6, 2);
    pinchos(4, 3, 1);
    // pad azul: el cubo cae hacia arriba y corre boca abajo bajo una plataforma; abajo, pinchos pequeños
    b.pad(r(5), 0, 'blue');
    b.hint(r(5) - 6, 4.2, 'Pad azul: invierte la gravedad');
    b.block(r(5) - 2, 5, r(7) - r(5) + 4, 1);
    b.smalls(r(5) + 1, Math.floor(r(7) - r(5)) - 2);
    pinchos(5, 2, 1, 4);
    pinchos(6, 0, 2, 4);
    pinchos(6, 2, 1, 4);
    b.pad(r(7), 4, 'blue', 180);
    pinchos(7, 2, 2);
    // escalera de dos bloques y salto sobre dos pinchos
    b.block(r(8) + 2, 0, 3, 1);
    b.block(r(8, 1) + 2, 0, 3, 2);
    b.spikes(r(8, 2) + 2, 2);

    // ---------------------------------------------------------- C · subida 2 (compases 9-14): bola a 1x
    seccion(9, 15, '#1c0c46', '#10062a', '#c77dff', '#ffd23a', false);
    b.portal(r(9), 1, 'ball');
    b.hint(r(9) + 2, 4, 'Bola: toca para cambiar de lado');
    bola([[9, 2], [10, 0], [10, 2], [11, 0], [11, 2, 6], [12, 0], [12, 2], [13, 0], [13, 2, 4], [14, 0, 4]], 3.5, 2, 3);
    // moneda 1: pegada al suelo tras la tanda del compás 12; hay que bajar en cuanto se toca el techo
    b.coin(r(12, 2) + 7.5, 0.2);
    b.deco(r(12), 4, 'ring', { r: 2.5, color: '#c77dff', alpha: 0.5 });
    embudo(r(15), 8);

    // ---------------------------------------------------------- D · DROP 1 (compases 15-22): ovni entre columnas
    seccion(15, 23, '#2a0a3e', '#180624', '#ff7ad8', '#ffd23a', true, { step: 5 });
    b.portal(r(15), 1, 'ufo');
    b.hint(r(15) + 3, 6, 'Ovni: cada toque es un impulso');
    b.camzoom(r(15), 0.85, 10);
    // [compás, tiempo, fila inferior del hueco, alto del hueco]
    const gatesD = [[15, 2, 1, 5], [16, 0, 2, 5], [16, 2, 3, 4], [17, 0, 2, 4], [17, 2, 3, 4], [18, 0, 4, 4], [18, 2, 3, 4],
      [19, 0, 1, 4], [20, 0, 4, 4], [20, 2, 3, 4], [21, 0, 1, 4], [21, 2, 2, 4], [22, 0, 2, 4]];
    for (const [c, t, lo, size] of gatesD) puerta(r(c, t), lo, size);
    // columna que sube mientras te acercas (grupo 1), con dos luces que marcan su hueco: de la fila 1 a la 3.
    // Termina de moverse unos 9 bloques antes de llegar.
    b.inGroup(1, () => {
      puerta(r(19, 2), 1, 4);
      b.deco(r(19, 2) - 1, 3, 'diamond', { r: 0.5, color: '#ff7ad8' });
      b.deco(r(19, 2) + 3, 3, 'diamond', { r: 0.5, color: '#ff7ad8' });
    });
    b.move(r(19) - 6, 1, 0, 2, 6);
    // moneda 2: abajo del todo entre dos huecos altos: hay que dejarse caer y remontar
    b.coin(r(19, 3) + 1, 0.6);
    b.saw(r(17, 1) + 1, 9, 1.2);
    b.saw(r(21, 1) + 1, -0.3, 1.2);
    embudo(r(23), 10);
    b.camzoom(r(23), 1, 8);

    // ---------------------------------------------------------- E · compases 23-30: cubo con orbes
    seccion(23, 31, '#06283a', '#031822', '#7affea', '#ffd23a', false);
    b.portal(r(23), 1, 'cube');
    pinchos(23, 2, 1);
    pinchos(24, 0, 2);
    // orbe amarillo en mitad de una fila de seis pinchos
    b.spikes(r(24, 2) + 1, 6);
    b.orb(r(24, 2) + 3, 2);
    pinchos(25, 0, 1);
    // orbe azul: al techo, paseo boca abajo y otro orbe azul para volver
    const s2 = r(25, 2) + 1;
    b.spikes(s2, 4);
    b.orb(s2 + 2, 2, 'blue');
    b.hint(s2 - 6, 4.2, 'Orbe azul: invierte la gravedad');
    b.block(s2 + 2, 6, 26, 1);
    b.smalls(s2 + 4, 20);
    pinchos(26, 1, 1, 5);
    b.orb(r(26, 3) + 1.5, 3, 'blue');
    pinchos(27, 2, 2);
    // pad amarillo sobre una fila de pinchos con una plataforma en medio
    b.pad(r(28), 0, 'yellow');
    b.spikes(r(28) + 2, 9);
    b.block(r(28) + 6, 3, 4, 1);
    pinchos(29, 1, 1);
    b.block(r(29, 2) + 2, 0, 3, 1);
    b.block(r(29, 3) + 2, 0, 4, 2);
    b.spikes(r(30) + 3.5, 2);
    pinchos(30, 2, 1);

    // ---------------------------------------------------------- F · compases 31-38: bola a 2x
    seccion(31, 39, '#3a0c1e', '#220612', '#ff9c5a', '#ffe23b', true, { step: 5 });
    b.portal(r(31), 1, 'ball');
    bola([[31, 2], [32, 0], [32, 2], [33, 0], [33, 2], [34, 0], [34, 2], [35, 0, 3], [35, 2], [36, 1], [37, 0], [37, 2], [38, 0]], 4.4, 2.5, 4);
    luna(r(34), 4, 2.5, '#ff9c5a', 2, r(33), r(37), 360);
    embudo(r(39), 8);

    // ---------------------------------------------------------- G · compases 39-46: ovni a 2x
    seccion(39, 47, '#0a2a46', '#06182a', '#5ac8ff', '#ffd23a', true, { step: 5 });
    b.portal(r(39), 1, 'ufo');
    const gatesG = [[39, 2, 2, 5], [40, 0, 4, 5], [40, 2, 2, 5], [41, 0, 4, 4], [41, 2, 2, 4], [42, 0, 4, 4],
      [43, 0, 3, 5], [43, 2, 1, 4], [44, 0, 3, 4], [44, 2, 4, 4], [45, 0, 3, 4], [45, 2, 1, 4], [46, 0, 2, 4]];
    for (const [c, t, lo, size] of gatesG) puerta(r(c, t), lo, size);
    puerta(r(42, 2), 2, 4);
    // compuerta (grupo 3) que tapa el hueco, se desvanece y se apaga cuando aún faltan 18 bloques
    b.inGroup(3, () => { b.block(r(42, 2), 2, 2, 4); b.deco(r(42, 2) + 1, 4, 'ring', { r: 2, color: '#5ac8ff', alpha: 0.8 }); });
    b.alpha(r(42, 2) - 32, 3, 0, 14);
    b.toggle(r(42, 2) - 18, 3, false);
    luna(r(44), 6, 2, '#5ac8ff', 7, r(43), r(46), -360);
    b.saw(r(41, 1) + 1, 9.2, 1.4);
    b.saw(r(44, 1) + 1, -0.4, 1.4);
    b.camoffset(r(39), 0, 1, 8);
    embudo(r(47), 10);
    b.camoffset(r(47), 0, 0, 8);

    // ---------------------------------------------------------- H · compases 47-54: cubo y planetas que llegan
    seccion(47, 55, '#101040', '#080826', '#a8a8ff', '#ffd23a', false, { lines: 9 });
    b.portal(r(47), 1, 'cube');
    pinchos(47, 2, 1);
    // escalera de plataformas (grupo 4) que bajan del cielo, cada una con su estrella, y están en su sitio
    // antes de que el cubo llegue a la primera
    const plat = [[48, 0, 1], [48, 2, 2], [49, 0, 3], [49, 2, 2]];
    b.inGroup(4, () => plat.forEach(([c, t, h], i) => {
      const x0 = r(c, t) + 2;
      const x1 = i + 1 < plat.length ? r(plat[i + 1][0], plat[i + 1][1]) + 1 : r(50) + 1;
      b.block(x0, h + 6, x1 - x0, 1);
      b.deco((x0 + x1) / 2, h + 9, 'diamond', { r: 0.6, color: '#a8a8ff', beat: true });
    }));
    b.move(r(47) - 6, 4, 0, -6, 14, 'out');
    b.smalls(r(48) + 1, Math.floor(r(50) - r(48)) + 1);
    // moneda 3: orbe opcional sobre la plataforma más alta
    b.orb(r(49, 1) + 1, 6.2);
    b.coin(r(49, 1) + 4, 8.6);
    pinchos(50, 2, 2);
    // pad amarillo sobre cuatro pinchos
    b.pad(r(51), 0, 'yellow');
    b.spikes(r(51) + 2, 4);
    pinchos(51, 2, 1);
    pinchos(52, 0, 2);
    b.block(r(52, 2) + 2, 0, 3, 1);
    b.spikes(r(52, 2) + 5, 2);
    b.spikes(r(53, 1) + 1, 6);
    b.orb(r(53, 1) + 3, 2);
    pinchos(54, 0, 2);
    pinchos(54, 2, 1);

    // ---------------------------------------------------------- I · compases 55-62: bola a 1x con sierras
    seccion(55, 63, '#2a0a30', '#18061c', '#ffa0e8', '#ffd23a', false);
    b.portal(r(55), 1, 'ball');
    bola([[55, 2], [56, 0], [56, 2], [57, 0], [57, 2], [58, 0], [59, 0], [59, 2], [60, 0], [60, 2], [61, 0], [61, 2], [62, 0]], 3.5, 2, 3);
    b.saw(r(58, 2), 4, 1.2);                 // en medio del pasillo, cuando la bola espera en el techo
    luna(r(60), 4, 2.5, '#ffa0e8', 5, r(59), r(62), -360);
    embudo(r(63), 8);

    // ---------------------------------------------------------- J · respiro (compases 63-64): ovni flotando
    b.color(r(63), '#05051a', '#03030e', { line: '#8a8aff', obj: '#9ad0ff' });
    b.pulse(r(63), '#8a8aff', 4);
    b.pulse(r(64), '#8a8aff', 4);
    b.portal(r(63), 1, 'ufo');
    b.camzoom(r(63), 0.75, 12);
    puerta(r(63, 2), 2, 6);
    puerta(r(64, 0) + 2, 3, 5);
    for (let k = 0; k < 4; k++) b.deco(r(63) + 6 + k * 7, 4 + (k % 2) * 3, 'ring', { r: 1.5 + k * 0.6, color: '#8a8aff', alpha: 0.45, par: 0.35 });
    b.deco(r(64), 6, 'glow', { r: 6, color: '#5a5aff', alpha: 0.5 });
    embudo(r(65), 10);

    // ---------------------------------------------------------- K · DROP FINAL (compases 65-71): bola a 2x
    seccion(65, 72, '#40081e', '#260410', '#ff4a6a', '#ffe23b', true, { step: 5 });
    b.camzoom(r(65), 1, 4);
    b.portal(r(65), 1, 'ball');
    bola([[65, 2], [66, 0], [66, 2], [67, 0], [67, 2], [68, 0], [68, 1], [68, 2], [69, 0], [69, 2], [70, 0], [70, 1], [70, 2], [71, 0]], 4.4, 2.5, 4);
    b.saw(r(66, 3), 4, 1.2);
    b.saw(r(69, 1), 4, 1.2);
    embudo(r(72), 8);

    // ---------------------------------------------------------- L · compases 72-78: ovni a 2x
    seccion(72, 79, '#2a1046', '#180828', '#ffb13b', '#ffe23b', true, { step: 5 });
    b.portal(r(72), 1, 'ufo');
    const gatesL = [[72, 2, 2, 5], [73, 0, 4, 4], [73, 2, 2, 4], [74, 0, 4, 4], [74, 2, 3, 4], [75, 0, 1, 4],
      [75, 2, 3, 4], [76, 0, 4, 4], [76, 2, 3, 4], [77, 0, 1, 4], [77, 2, 3, 4], [78, 0, 2, 4]];
    for (const [c, t, lo, size] of gatesL) puerta(r(c, t), lo, size);
    luna(r(75), 6, 3, '#ffb13b', 6, r(73), r(78), 540);
    // dos sierras (grupo 8) dentro de la columna del compás 76 que dan media vuelta alrededor del hueco y
    // vuelven a quedar dentro de los bloques 14 bloques antes de llegar
    {
      const cx = r(76) + 1, cy = 6;
      b.inGroup(8, () => { b.saw(cx - 0.5, cy - 0.5 + 3, 1); b.saw(cx - 0.5, cy - 0.5 - 3, 1); });
      b.rotate(cx - 40, 8, 180, 26, 'inout', [cx, cy]);
    }
    embudo(r(79), 10);

    // ---------------------------------------------------------- M · cierre (compás 79): cubo
    b.color(r(79), '#0a0f2e', '#060a1e', { line: '#7ab8ff', obj: '#9ad0ff' });
    b.pulse(r(79), '#7ab8ff', 6);
    b.portal(r(79), 1, 'cube');
    b.deco(r(79) + 8, 4, 'ring', { r: 3, color: '#7ab8ff', alpha: 0.6, beat: true });
    b.deco(r.end - 3, 3, 'diamond', { r: 1.4, color: '#7ab8ff', beat: true });
    return b.build(r.end);
  }

  function build(H) {
    ({ Builder, rejilla, ritmo, adornos, UPS } = H);
    return orbita();
  }
  let Builder, rejilla, ritmo, adornos, UPS; // eslint-disable-line no-unused-vars
  if (typeof module !== 'undefined' && module.exports) module.exports = build;
  else (root.NIVELES = root.NIVELES || {})['orbita'] = build;
})(typeof globalThis !== 'undefined' ? globalThis : this);
