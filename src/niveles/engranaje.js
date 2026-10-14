/* NEON DASH — nivel 'engranaje'. Se registra en NIVELES; levels.js lo construye con las utilidades comunes. */
(function (root) {
  'use strict';
  // ------------------------------------------------------------------ 9
  // Robot y bola en una fábrica de cobre, al ritmo de 'Funky Bot Groove' (126 BPM, 47 compases).
  // Estructura de la canción (energy): 0-6 intro suave · 7 subida (+5 dB) · 8 DROP 1 · 22 respiro (-3,5 dB)
  //   23 DROP 2 (+4,7 dB) · 30-31 respiro · 32 DROP FINAL (+3,6 dB, 2x) · 38-45 salida · 46 final.
  // Robot justo: ningún techo obliga a un toque cortísimo (el techo más bajo sobre el robot está a 3 filas)
  // y las torres miden como mucho 2 más que el suelo desde el que se salta, con sitio de sobra para aterrizar.
  function engranaje() {
    const TRAMOS = [[0, 1], [32, 2], [38, 1]];
    const r = ritmo('funky-bot-groove', TRAMOS);
    const b = new Builder({
      id: 'engranaje',
      card: '#e08a2e',
      theme: 'original',
      theme3d: 'desierto',
      name: 'Engranaje',
      difficulty: 'Normal',
      stars: 4,
      song: 'track:funky-bot-groove',
      synth: 'pulso',
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
    // Embudo hacia un portal en x: el techo baja con rampas desde `ceil` hasta 3 y sigue plano hasta x + 2.
    function embudo(x, ceil) {
      x = Math.floor(x);
      b.corridor(x - (ceil - 3) - 2, 0, ceil, [[ceil - 3, 0, -1], [4, 0, 0]]);
      b.portal(x + 1, 1, 'unflip');        // y siempre con la gravedad normal (la bola puede llegar pegada al techo)
    }
    // Pinchos para saltar justo en el tiempo (c, t): dx = bloques desde el toque hasta el centro de la fila.
    function pinchos(c, t, n, dx, y) {
      const x0 = Math.round((r(c, t) + dx - n / 2) * 2) / 2;
      if (y) b.spikes(x0, n, y, 180);
      else b.spikes(x0, n);
    }
    // Bola: cambios de lado en los tiempos de `flips` ([compás, tiempo, pinchos?]), empezando en el suelo. Tras
    // cada cambio, una fila de pinchos en el lado que deja, desde `d` bloques después del toque y sin llegar a
    // donde la bola vuelve a ese lado. fl = bloques que tarda en cruzar (1x 3,5; 2x 4,4).
    function bola(flips, fl, d, maxN) {
      let up = true;
      for (let i = 0; i < flips.length; i++) {
        const x0 = r(flips[i][0], flips[i][1]);
        const x1 = i + 1 < flips.length ? r(flips[i + 1][0], flips[i + 1][1]) : x0 + 12;
        const n = Math.max(1, Math.min(flips[i][2] || maxN, Math.floor(x1 + fl - 1.5 - (x0 + d))));
        if (up) b.spikes(x0 + d, n); else b.spikes(x0 + d, n, 7, 180);
        up = !up;
      }
    }
    // Torre del robot para subir en el tiempo (c, t): empieza 4 bloques después y acaba 1 después de (c2, t2),
    // el tiempo en que se salta para bajar.
    function torre(c, t, h, c2, t2, y) {
      const x0 = r(c, t) + 4, x1 = r(c2, t2) + 1;
      b.block(x0, y || 0, x1 - x0, h);
      return x1;
    }
    // Engranaje decorativo: anillo que gira (grupo g) entre x0 y x1.
    function engrane(x, y, rad, color, g, x0, x1, deg) {
      b.inGroup(g, () => {
        b.deco(x, y, 'ring', { r: rad, color, alpha: 0.55, par: 0.25 });
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2;
          b.deco(x + Math.cos(a) * rad, y + Math.sin(a) * rad, 'diamond', { r: 0.45, color, alpha: 0.7 });
        }
      });
      b.rotate(x0, g, deg || 360, x1 - x0, 'linear', [x, y]);
    }

    // ---------------------------------------------------------- A · intro (compases 0-3): cubo tranquilo
    seccion(0, 4, '#2b1a0e', '#1a0f07', '#ffc27a', '#ffb347', false);
    b.deco(8, 5, 'ring', { r: 2.5, color: '#ffc27a', alpha: 0.6 });
    engrane(r(1, 2), 6.5, 2, '#ffc27a', 1, 0, r(4));
    pinchos(1, 0, 1, 2.3);
    pinchos(1, 2, 1, 2.3);
    pinchos(2, 0, 2, 2.3);
    b.block(r(2, 2) + 2, 0, 3, 1);
    pinchos(3, 0, 1, 2.3);
    pinchos(3, 2, 2, 2.3);

    // ---------------------------------------------------------- B · robot (compases 4-7)
    seccion(4, 8, '#0f3236', '#081e21', '#7affea', '#ffd23a', false, { lines: 8.5 });
    b.portal(r(4), 1, 'robot');
    b.hint(r(4) + 3, 4.5, 'Robot: cuanto más mantienes, más alto saltas');
    pinchos(4, 2, 1, 2);                     // toque
    // torre de 2: salto medio para subir y salto desde arriba sobre dos pinchos
    const t5 = torre(5, 0, 2, 5, 2);
    b.spikes(t5, 2);
    // techo bajo (fila 3) con pinchos pequeños: saltitos, sin miedo a mantener un poco
    b.block(r(6) + 1, 3, Math.round(r(6, 3) - r(6)), 1);
    b.small(r(6) + 2.5);
    b.small(r(6, 1) + 2.5);
    b.small(r(6, 2) + 2.5);
    // subida (compás 7): escalón, torre de 3 desde el escalón y bajada sobre tres pinchos
    b.block(r(7) + 2.5, 0, 3, 1);
    const t7 = torre(7, 1, 3, 7, 2);
    b.block(r(7) + 5.5, 0, r(7, 1) - r(7) + 4 - 5.5, 1);  // relleno: el hueco entre escalón y torre no es una trampa
    b.spikes(t7, 2);
    b.pulse(r(7, 2), '#ffffff', 2);

    // ---------------------------------------------------------- C · DROP 1 (compases 8-13): pistones
    seccion(8, 14, '#0e2448', '#08162c', '#7ac8ff', '#ffb347', true, { step: 5 });
    b.camzoom(r(8), 0.9, 6);
    // pistones: un salto a cada tiempo, sobre pinchos pequeños; encima de cada uno, un vástago de luz
    // (grupo 2) que baja a golpearlo mientras llegas
    const pist = [[8, 2, 1], [8, 3, 2], [9, 0, 3], [9, 1, 2], [9, 2, 1]];
    // Los pistones (grupo 9) salen del suelo y quedan quietos 10 bloques antes del primer salto.
    for (const [c, t, h] of pist) {
      b.inGroup(9, () => b.block(r(c, t) - 2, -3, 4, h));
      b.inGroup(2, () => b.deco(r(c, t) - 0.5, h + 9, 'pillar', { w: 1, h: 3, color: '#7ac8ff', alpha: 0.6 }));
    }
    b.move(r(8) - 30, 9, 0, 3, 20, 'out');
    b.move(r(8) - 30, 2, 0, -4, 20, 'bounce');
    b.smalls(r(8, 2) + 2, Math.floor(r(9, 2) - r(8, 2)));
    // orbe amarillo sobre tres pinchos
    pinchos(10, 0, 3, 2.5);
    b.orb(r(10, 0) + 3, 2.3);
    // pad azul: el robot corre boca abajo bajo una viga; abajo, pinchos pequeños
    b.pad(r(10, 2), 0, 'blue');
    b.block(r(10, 2) - 1, 6, r(12, 1) - r(10, 2) + 3, 1);
    b.smalls(r(10, 2) + 2, Math.floor(r(12, 1) - r(10, 2)) - 4);
    pinchos(11, 1, 1, 2, 5);
    pinchos(11, 3, 2, 2.5, 5);
    b.pad(r(12, 1), 5, 'blue', 180);
    // dos saltos más antes de la bola
    pinchos(12, 3, 2, 2.5);
    pinchos(13, 2, 1, 2);

    // ---------------------------------------------------------- D · compases 14-21: bola por la cadena
    seccion(14, 22, '#341040', '#1f0826', '#ff9cf0', '#ffd23a', false);
    b.block(Math.floor(r(14)) - 1, 4, 3, 6);  // tapa: el robot no puede saltar por encima del portal
    b.portal(r(14), 1, 'ball');
    bola([[14, 2], [15, 0], [15, 2], [16, 0], [16, 2], [17, 0], [17, 2, 6], [18, 0], [18, 2], [19, 0], [19, 2], [20, 0], [20, 2], [21, 0]], 3.5, 2, 4);
    // moneda 1: pegada al suelo; hay que bajar en cuanto se toca el techo
    b.coin(r(16, 2) + 7.5, 0.2);
    // engranaje gigante girando al fondo
    engrane(r(19), 4, 3, '#ff9cf0', 3, r(18), r(21), 360);
    b.saw(r(17, 3) + 0.5, 3.5, 1.2);         // en medio, mientras la bola espera en el techo
    embudo(r(22), 8);

    // ---------------------------------------------------------- E · respiro (compás 22): robot
    b.color(r(22), '#1a120c', '#0e0a06', { line: '#c89a6a', obj: '#ffb347' });
    b.pulse(r(22), '#c89a6a', 4);
    b.portal(r(22), 1, 'robot');
    b.camzoom(r(22), 0.8, 8);
    engrane(r(22) + 9, 6, 3, '#c89a6a', 4, r(22) - 10, r(23) + 10, 180);
    torre(22, 2, 1, 23, 0);

    // ---------------------------------------------------------- F · DROP 2 (compases 23-29): robot
    seccion(23, 30, '#12301a', '#0a1c0f', '#9aff7a', '#ffd23a', true, { step: 5 });
    b.camzoom(r(23), 1, 4);
    pinchos(23, 0, 1, 2);
    const t23 = torre(23, 2, 2, 24, 0);
    // moneda 2: sobre la torre, sólo con un salto largo desde arriba
    b.coin(r(23, 3), 5.2);
    b.spikes(t23, 2);
    // fila corta de pinchos pequeños
    b.smalls(r(24, 2) + 1.5, 3);
    // dos pistones (grupo 10) que bajan del techo hasta el suelo y quedan quietos 10 bloques antes de
    // llegar; un vástago de luz (grupo 5) los sigue
    b.inGroup(10, () => { b.block(r(25, 1) - 2, 6, 4, 2); b.block(r(25, 2) - 2, 6, 4, 1); });
    b.move(r(25) - 30, 10, 0, -6, 20, 'out');
    b.inGroup(5, () => { b.deco(r(25, 1) - 0.5, 11, 'pillar', { w: 1, h: 3, color: '#9aff7a', alpha: 0.6 }); b.deco(r(25, 2) - 0.5, 10, 'pillar', { w: 1, h: 3, color: '#9aff7a', alpha: 0.6 }); });
    b.move(r(25) - 30, 5, 0, -6, 20, 'bounce');
    b.smalls(r(25, 1) - 3, Math.floor(r(25, 3) - r(25, 1)) + 1);
    // techo a 4 filas con pinchos sueltos
    b.block(r(26) + 1, 4, Math.round(r(26, 3) - r(26)), 1);
    pinchos(26, 0, 1, 2);
    pinchos(26, 2, 1, 2);
    // pad azul: paseo boca abajo
    b.pad(r(27), 0, 'blue');
    b.block(r(27) - 1, 6, r(28, 2) - r(27) + 3, 1);
    b.smalls(r(27) + 2, Math.floor(r(28, 2) - r(27)) - 3);
    pinchos(27, 2, 1, 2, 5);
    pinchos(28, 0, 2, 2.5, 5);
    b.pad(r(28, 2), 5, 'blue', 180);
    // compuerta de engranajes (grupo 6) que se desvanece y se apaga cuando aún faltan 16 bloques
    b.inGroup(6, () => { b.block(r(29, 1), 0, 1, 4); b.deco(r(29, 1) + 0.5, 3, 'ring', { r: 2, color: '#9aff7a', alpha: 0.8 }); });
    b.alpha(r(29, 1) - 30, 6, 0, 14);
    b.toggle(r(29, 1) - 16, 6, false);
    pinchos(29, 2, 2, 2.5);

    // ---------------------------------------------------------- G · respiro (compases 30-31): cubo
    seccion(30, 32, '#2b1a0e', '#1a0f07', '#ffc27a', '#ffb347', false);
    b.portal(r(30), 1, 'cube');
    b.camoffset(r(30), 0, 1, 8);
    engrane(r(30, 2), 6, 2.5, '#ffc27a', 7, r(30) - 10, r(32), 270);
    b.pad(r(30, 2), 0, 'yellow');
    b.spikes(r(30, 2) + 2, 4);
    pinchos(31, 1, 1, 2.3);
    b.camoffset(r(31, 3), 0, 0, 6);

    // ---------------------------------------------------------- H · DROP FINAL (compases 32-37): bola a 2x
    seccion(32, 38, '#4a1a10', '#2c0f08', '#ffb07a', '#ffd23a', true, { step: 5 });
    b.portal(r(32), 1, 'ball');
    bola([[32, 2], [33, 0], [33, 2], [34, 0], [34, 2], [35, 0], [35, 1], [35, 2], [36, 0], [36, 2], [37, 0]], 4.4, 2.5, 4);
    // moneda 3: pegada al techo; hay que volver a subir en cuanto se toca el suelo
    b.coin(r(34, 0) + 9.5, 7.2);
    b.saw(r(33, 3), 4, 1.2);
    b.saw(r(36, 1), 4, 1.2);
    embudo(r(38), 8);

    // ---------------------------------------------------------- I · salida (compases 38-43): robot
    seccion(38, 44, '#0f3236', '#081e21', '#7affea', '#ffd23a', false);
    b.portal(r(38), 1, 'robot');
    pinchos(38, 2, 1, 2);
    torre(39, 0, 2, 39, 2);
    pinchos(40, 0, 1, 2);
    pinchos(40, 2, 2, 2.5);
    b.block(r(41) + 2.5, 0, 3, 1);
    const t41 = torre(41, 1, 3, 41, 3);
    b.block(r(41, 1) + 4, 0, 1, 1);
    b.spikes(t41, 3);
    b.block(r(42, 2) + 1, 3, Math.round(r(43) - r(42, 2)), 1);
    b.small(r(42, 2) + 2.5);
    b.small(r(42, 3) + 2.5);
    pinchos(43, 2, 1, 2);

    // ---------------------------------------------------------- J · final (compases 44-46): cubo
    seccion(44, 47, '#2b1a0e', '#1a0f07', '#ffc27a', '#ffb347', false);
    b.portal(r(44), 1, 'cube');
    pinchos(44, 2, 1, 2.3);
    pinchos(45, 0, 2, 2.3);
    engrane(r(46) - 2, 4, 2, '#ffc27a', 8, r(44), r.end, 360);
    b.deco(r.end - 3, 3, 'diamond', { r: 1.4, color: '#ffc27a', beat: true });
    return b.build(r.end);
  }

  function build(H) {
    ({ Builder, rejilla, ritmo, adornos, UPS } = H);
    return engranaje();
  }
  let Builder, rejilla, ritmo, adornos, UPS; // eslint-disable-line no-unused-vars
  if (typeof module !== 'undefined' && module.exports) module.exports = build;
  else (root.NIVELES = root.NIVELES || {})['engranaje'] = build;
})(typeof globalThis !== 'undefined' ? globalThis : this);
