/* NEON DASH — nivel 'telarana'. Se registra en NIVELES; levels.js lo construye con las utilidades comunes. */
(function (root) {
  'use strict';
  // ------------------------------------------------------------------ 8
  // Los modos que faltaban, en una placa de circuito que falla al ritmo de 'Clockwork Glitch' (160 BPM):
  // robot (salto de altura variable), araña (teletransporte al otro lado), columpio (cada toque invierte la
  // gravedad) y una sección dual con un gemelo en el techo. Dos drops (compases 7 y 41) con araña, columpio
  // entre columnas, bloques que se encienden al ritmo, pistones y engranajes que giran en las pausas.
  //
  //   compás  0-2   cubo 1x      intro
  //           3-6   robot 1x     subida
  //           7-14  araña 2x     DROP 1 (en el 13 el techo falla y baja)
  //          15-22  columpio 2x
  //          23-30  dual 2x      cubo y, desde el 27, robot
  //          31-37  robot 2x     bloques que aparecen y pistones
  //          38-40  cubo 1x      pausa
  //          41-48  araña 3x     DROP 2
  //          49-53  columpio 3x
  //          54-55  cubo 1x      pausa
  //          56-62  robot 1x     subida bajo un brazo de sierras que gira
  //          63-66  araña 2x     final
  //          67-69  robot 2x
  //          70     la canción se apaga

  // Araña: toques en los tiempos `taps` ([compás, tiempo]). Tras cada toque, pinchos en el lado que se deja,
  // desde 1,5 bloques después del toque hasta 1,5 antes del siguiente (como mucho maxLen). ceil: fila del techo.
  // floor0: empieza en el suelo. last: x hasta la que llegan los pinchos del último toque. Devuelve si acaba
  // en el suelo.
  function aranaRun(b, r, taps, ceil, maxLen, floor0, last) {
    let onFloor = floor0 !== false;
    for (let i = 0; i < taps.length; i++) {
      const x = r(taps[i][0], taps[i][1]);
      const nx = i + 1 < taps.length ? r(taps[i + 1][0], taps[i + 1][1]) : (last != null ? last + 1.5 : x + maxLen + 3);
      const s = Math.round(x + 1.5);
      const e = Math.min(Math.round(nx - 1.5), s + maxLen);
      if (e > s) {
        if (onFloor) b.spikes(s, e - s);
        else b.spikes(s, e - s, ceil - 1, 180);
      }
      onFloor = !onFloor;
    }
    return onFloor;
  }

  // Columnas del columpio: [x, fila inferior del hueco, alto del hueco], 2 de ancho, hasta la fila 10.
  function columnas(b, list) {
    for (const [x, lo, size] of list) {
      if (lo > 0) b.block(x, 0, 2, lo);
      if (lo + size < 10) b.block(x, lo + size, 2, 10 - (lo + size));
    }
  }

  // Decorado y ritmo visual de una sección: color, adornos y un pulso por compás (y otro a medio compás
  // en las partes fuertes).
  function seccion(b, r, bar0, bar1, bg, ground, line, opts) {
    opts = opts || {};
    const x0 = r(bar0), x1 = r(bar1);
    b.color(x0, bg, ground, { line, obj: opts.obj || '#ffd23a' });
    adornos(b, x0, x1, line, { step: opts.step || 7, lines: opts.lines });
    for (let k = bar0; k < bar1; k++) {
      b.pulse(r(k), line, opts.fuerte ? 4 : 3);
      if (opts.fuerte) b.pulse(r(k, 2), opts.fuerte, 2);
    }
  }

  function telarana() {
    const tramos = [[0, 1], [7, 2], [38, 1], [41, 3], [54, 1], [63, 2]];
    const r = ritmo('clockwork-glitch', tramos);
    const xr = (bar, beat) => Math.round(r(bar, beat));
    const b = new Builder({
      id: 'telarana',
      card: '#2fd6b5',
      theme: 'original',
      theme3d: 'circuito',
      name: 'Telaraña',
      difficulty: 'Difícil',
      stars: 6,
      song: 'track:clockwork-glitch',
      synth: 'espejo',
      bpm: r.track.bpm,
      startSpeed: tramos[0][1],
    });
    for (const [bar, v] of tramos.slice(1)) b.speed(r(bar), 1, v);

    // Engranaje decorativo (anillo y dientes, sin colisión) en el grupo g, para girarlo con rotate.
    const engranaje = (cx, cy, rad, color, g) => b.inGroup(g, () => {
      b.deco(cx, cy, 'ring', { r: rad, color, alpha: 0.7 });
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        b.deco(cx + Math.cos(a) * (rad + 0.6), cy + Math.sin(a) * (rad + 0.6), 'diamond', { r: 0.5, color });
      }
    });

    // A · intro (compases 0-2): cubo tranquilo, un salto cada medio compás
    b.color(0, '#0a2a2e', '#06181b', { line: '#7affe0', obj: '#ffd23a' });
    seccion(b, r, 0, 3, '#0a2a2e', '#06181b', '#7affe0');
    b.deco(8, 4, 'glow', { r: 4, color: '#2fd6b5' });
    engranaje(r(1, 2), 6.5, 1.6, '#7affe0', 9);
    b.rotate(0, 9, 360, r(3), 'linear');
    b.spike(r(0, 2) + 1.5);
    b.spike(r(1) + 1.5);
    b.spikes(r(1, 2) + 1, 2);
    b.block(xr(2) + 1, 0, 3, 1);
    b.spike(xr(2) + 4);
    b.spikes(r(2, 2) + 1.5, 2);

    // B · robot (compases 3-6): subida; toques, torres, un techo bajo y una escalera
    const xb = r(3);
    seccion(b, r, 3, 7, '#0d3a2a', '#07221a', '#9dffc8', { lines: 8.5 });
    b.portal(xb, 1, 'robot');
    b.hint(xb + 3, 4.5, 'Robot: cuanto más mantienes, más alto saltas');
    b.spike(r(3, 2) + 1.5);                      // toque
    b.block(xr(4) + 1, 0, 3, 2);                 // torre de 2: pulsación media
    b.spikes(xr(4) + 4, 2);
    b.block(xr(5) - 1, 2, 9, 1);                 // techo bajo: sólo saltitos
    b.small(xr(5) + 1);
    b.small(xr(5, 1) + 1);
    b.small(xr(5, 2) + 1, 3);
    b.block(xr(6) - 1, 0, 2, 1);                 // escalera: 1, 2, 3 y salto largo
    b.block(xr(6) + 1, 0, 2, 2);
    b.block(xr(6) + 3, 0, 3, 3);
    b.spikes(xr(6) + 6, 2);

    // C · DROP 1 (compases 7-14): araña a 2x entre suelo y techo, un toque por tiempo
    const xc = r(7), xcEnd = xr(15) - 3;
    seccion(b, r, 7, 15, '#2a0f46', '#18082a', '#e0a8ff', { fuerte: '#b04cff', step: 5 });
    b.shake(xc, 4, 3);
    b.camzoom(xc, 1.1, 6);
    b.portal(xc, 1, 'spider');
    b.hint(xc + 3, 3.4, 'Araña: toca para saltar al otro lado');
    b.block(xr(7) - 3, 5, xr(13) - xr(7) + 3, 1);
    // en el compás 13 el techo "falla" y baja una fila (grupo 1, move): cae medio compás antes de llegar
    b.inGroup(1, () => b.block(xr(13), 5, xcEnd - xr(13), 2));
    b.move(r(12, 2), 1, 0, -1, 4, 'inout');
    b.pulse(r(12, 2), '#ffffff', 2);
    b.shake(r(12, 2) + 4, 2, 1);
    aranaRun(b, r, [[7, 1], [7, 3], [8, 1], [8, 3], [9, 0], [9, 2], [9, 3], [10, 1], [10, 2], [10, 3], [11, 1]],
      5, 6, true, r(11, 1) + 6.5);
    // moneda 1: en un hueco entre dos camas de pinchos del suelo, mientras la ruta va por el techo
    {
      const g0 = Math.round(r(11, 1) + 6.5), g1 = g0 + 8;
      b.coin(g0 + 3.5, 0);
      b.spikes(g1, Math.round(r(12, 2) - 1.5) - g1);
    }
    aranaRun(b, r, [[12, 2]], 5, 6, false, r(13) - 1.5);
    // segunda tanda, con el techo ya en la fila 4; acaba en el suelo para el embudo
    aranaRun(b, r, [[13, 0], [13, 1], [13, 2], [13, 3], [14, 0], [14, 2]], 4, 9, true, xcEnd);
    b.saw(r(10) + 0.5, 2, 1.2);
    b.saw(r(12) + 0.5, 2, 1.2);
    // embudo: el techo baja a 3 y el portal de columpio ocupa todo el hueco
    b.corridor(xcEnd, 0, 4, [[1, 0, -1], [4, 0, 0]], 6);

    // D · columpio (compases 15-22): una columna cada medio compás y, desde el 19, una por tiempo
    const xd = r(15);
    seccion(b, r, 15, 23, '#3a2a0a', '#221806', '#ffe08a', { fuerte: '#ffb020' });
    b.portal(xd, 1, 'swing', { floor: 0 });
    b.hint(xd + 3, 1.6, 'Columpio: cada toque invierte la gravedad');
    b.corridor(xr(15) + 2, 0, 3, [[6, 0, 1]], 10);
    const lowsA = [5, 1, 5, 2, 1, 2, 5];
    const gatesD = lowsA.map((lo, i) => [xr(15, 3 + 2 * i) + 1, lo, i === 5 ? 5 : 4]);
    columnas(b, gatesD);
    // moneda 2: pegada al suelo justo tras una columna baja; hay que bajar del todo y remontar a la siguiente
    b.coin(gatesD[4][0] + 3, 0);
    const lowsB = [3, 5, 3, 1, 3, 5, 3, 5, 2, 4, 2, 2];
    columnas(b, lowsB.map((lo, i) => [xr(19, i) + 1, lo, 4]));
    for (let i = 0; i < lowsB.length; i += 2) b.deco(xr(19, i) + 2, lowsB[i] + 2, 'diamond', { r: 0.5, color: '#ffe08a', beat: true });
    // embudo hasta el suelo: techo de 10 a 3, gravedad normal y cubo; luego el techo sube a 7 para el dual
    const xe = r(23), xei = xr(23);
    b.corridor(xei - 18, 0, 10, [[7, 0, -1], [5, 0, 0], [4, 0, 1]], 10);
    b.portal(xei - 10, 1, 'unflip');
    b.portal(xei - 8, 1, 'cube');

    // E · dual (compases 23-30): el gemelo cuelga del techo (fila 7) y salta a la vez, en espejo
    seccion(b, r, 23, 31, '#46102a', '#2a0818', '#ffa8c8', { fuerte: '#ff3a7a' });
    b.block(xei - 2, 7, xr(31) + 2 - (xei - 2), 3);
    b.pulse(xe, '#ffffff', 5);
    b.camzoom(xe, 0.9, 8);
    b.portal(xe, 1, 'dual');
    b.hint(xe + 3, 3.6, 'Dual: los dos saltan a la vez');
    const F = (bar, beat, n) => b.spikes(Math.round(r(bar, beat) + 1.5), n || 1);
    const C = (bar, beat, n) => b.spikes(Math.round(r(bar, beat) + 1.5), n || 1, 6, 180);
    F(23, 2); C(24, 0); F(24, 2); C(24, 2);
    F(25, 0, 2); C(25, 2, 2); F(26, 0); C(26, 0); F(26, 2, 3);
    // compás 27: los dos se vuelven robots; toques cortos y largos en espejo
    b.portal(r(27), 1, 'robot');
    b.shake(r(27), 3, 2);
    F(27, 1); C(27, 2); F(27, 3); C(28, 0, 3); F(28, 2); C(28, 3); F(29, 0, 3); C(29, 2); F(29, 3);
    C(30, 0); F(30, 1, 2); C(30, 1, 2);
    b.portal(r(31) - 1, 1, 'single');

    // F · robot (compases 31-37): bloques que se encienden al ritmo (grupo 2) y pistones que suben (grupo 3)
    seccion(b, r, 31, 38, '#0a2446', '#06162a', '#8ac8ff', { fuerte: '#3a8aff', lines: 8 });
    b.camzoom(r(31), 1, 4);
    b.spike(r(31, 1) + 1.5);
    b.spike(r(31, 2) + 1.5);
    b.block(xr(31, 3) + 2, 0, 3, 2);
    b.spikes(xr(31, 3) + 5, 3);
    // compases 32-33: foso con piedras fantasma que se encienden dos tiempos antes de pisarlas (grupos 2-5,
    // alpha: sólo visual)
    const pit0 = xr(32, 1) + 1, pit1 = xr(33, 2);
    b.spikes(pit0, pit1 - pit0);
    for (let k = 1; k <= 4; k++) {
      b.inGroup(1 + k, () => b.block(xr(32, k) + 2, 1, 2, 1));
      b.alpha(0, 1 + k, 0.1, 0);
      b.alpha(r(32, k - 2), 1 + k, 1, 2);
    }
    // moneda 3: plataforma alta (fila 2) que sólo se alcanza manteniendo el salto entero
    b.block(xr(33, 3) + 1, 2, 4, 1);
    b.coin(xr(33, 3) + 3, 3.3);
    b.small(xr(33, 3) + 2.5);
    // compás 34: pad amarillo sobre un muro
    b.pad(xr(34, 1), 0, 'yellow');
    b.block(xr(34, 1) + 3, 0, 3, 3);
    b.spikes(xr(34, 1) + 6, 4);
    // compás 35: cama de pinchos con orbe
    b.spikes(xr(35, 1) + 1, 6);
    b.orb(xr(35, 1) + 3, 2.5);
    // compases 36-37: pistones; sus émbolos (decorado, grupo 6) bajan y suben a cada tiempo
    for (let k = 0; k < 4; k++) b.block(xr(36, 1 + k) + 1, 0, 2, 2 + (k % 2));
    b.spikes(xr(36, 1) + 3, xr(37, 1) - xr(36, 1) - 1);
    b.inGroup(6, () => { for (let k = 0; k < 4; k++) b.deco(xr(36, 1 + k) + 2, 6 + (k % 2), 'pillar', { w: 1, h: 3, color: '#8ac8ff', alpha: 0.6 }); });
    for (let k = 0; k < 6; k++) b.move(r(35, 2 + k), 6, 0, k % 2 ? 1.5 : -1.5, 2, 'inout');
    b.spikes(xr(37, 2) + 1, 2);

    // G · pausa (compases 38-40): cubo a 1x, cámara lejos y un engranaje girando
    const xg = r(38);
    seccion(b, r, 38, 41, '#101830', '#080c1c', '#a8b8ff', { step: 9 });
    b.portal(xg, 1, 'cube');
    b.camzoom(xg, 0.8, 8);
    b.camrotate(xg, -4, 12);
    engranaje(r(39), 6, 2.2, '#a8b8ff', 10);
    b.rotate(xg, 10, -360, r(41) - xg, 'linear');
    b.spike(r(38, 2) + 1.5);
    b.spikes(r(39) + 1, 2);
    b.orb(r(39, 2) + 2, 2.5);
    b.spikes(xr(39, 2) + 1, 4);
    b.spike(r(40) + 1.5);
    b.block(xr(40, 2), 5, xr(49) - xr(40, 2) - 3, 1);   // techo de la araña del drop 2

    // H · DROP 2 (compases 41-48): araña a 3x, un toque por tiempo; la cámara se inclina
    const xh = r(41);
    seccion(b, r, 41, 49, '#460a1e', '#2a0612', '#ff8ab0', { fuerte: '#ff2a6a', step: 5 });
    b.portal(xh, 1, 'spider');
    b.shake(xh, 6, 4);
    b.camzoom(xh, 1.15, 4);
    b.camrotate(xh, 3, 8);
    b.camrotate(r(45), -3, 8);
    aranaRun(b, r, [[41, 1], [41, 2], [41, 3], [42, 1], [42, 2], [42, 3], [43, 0], [43, 2], [43, 3], [44, 1], [44, 2], [44, 3],
      [45, 0], [45, 1], [45, 2], [45, 3], [46, 1], [46, 2], [47, 0], [47, 1], [47, 2], [47, 3], [48, 1], [48, 2]],
    5, 7, true, xr(49) - 3);
    b.saw(r(43) + 0.5, 2, 1.2);
    b.saw(r(46) + 0.5, 2, 1.2);
    b.corridor(xr(49) - 3, 0, 5, [[2, 0, -1], [3, 0, 0]], 6);

    // I · columpio a 3x (compases 49-53)
    const xi = r(49);
    seccion(b, r, 49, 54, '#3a1a0a', '#221006', '#ffb88a', { fuerte: '#ff7a20' });
    b.portal(xi, 1, 'swing', { floor: 0 });
    b.shake(xi, 3, 2);
    b.corridor(xr(49) + 2, 0, 3, [[6, 0, 1]], 10);
    const lowsI = [5, 1, 5, 2, 5, 1, 4];
    columnas(b, lowsI.map((lo, i) => [xr(50, i * 2) + 1, lo, 4]));
    const xj = r(54), xji = xr(54);
    b.corridor(xji - 15, 0, 10, [[7, 0, -1], [5, 0, 0]], 10);
    b.portal(xji - 6, 1, 'unflip');
    b.portal(xji - 4, 1, 'cube');

    // J · pausa (compases 54-55) y subida (56-62): cubo y luego robot a 1x, bajo un brazo de sierras que gira
    seccion(b, r, 54, 56, '#0a1a1a', '#040e0e', '#7ad8d8', { step: 9 });
    b.camzoom(xj, 0.85, 8);
    b.camrotate(xj, 0, 6);
    b.spike(r(54, 2) + 1.5);
    b.spikes(r(55) + 1, 2);
    b.spike(r(55, 2) + 1.5);
    const xk = r(56);
    seccion(b, r, 56, 63, '#0f2a1a', '#08180e', '#9affb8', { lines: 9 });
    b.portal(xk, 1, 'robot');
    b.camzoom(xk, 1, 16);
    // brazo de engranaje (decorado, grupo 11) que da vuelta y media sobre el camino
    const bx = xr(57, 2);
    b.inGroup(11, () => {
      for (const d of [-3, -1.5, 1.5, 3]) b.deco(bx + 0.5 + d, 7.5, 'diamond', { r: Math.abs(d) > 2 ? 0.9 : 0.5, color: '#9affb8' });
      b.deco(bx + 0.5, 7.5, 'ring', { r: 0.8, color: '#9affb8' });
    });
    b.rotate(xk, 11, 540, r(59) - xk, 'linear', [bx + 0.5, 7.5]);
    b.spike(r(56, 2) + 1.5);
    b.block(xr(57) + 1, 0, 3, 2);
    b.spikes(xr(57) + 4, 2);
    b.spike(r(58) + 1.5);
    b.spike(r(58, 2) + 1.5);
    b.block(xr(59) - 1, 2, 9, 1);
    b.small(xr(59) + 1);
    b.small(xr(59, 1) + 1);
    b.block(xr(60) + 1, 0, 2, 1);
    b.block(xr(60) + 3, 0, 2, 2);
    b.spikes(xr(60) + 5, 3);
    b.spike(r(61) + 1.5);
    b.spikes(r(61, 2) + 1, 2);
    b.block(xr(62) - 4, 5, xr(67) + 4 - (xr(62) - 4), 1);     // techo de la araña final
    b.spike(r(62) + 1.5);
    b.spike(r(62, 2) + 1.5);

    // K · final (compases 63-69): araña a 2x y robot hasta el último golpe
    const xl = r(63);
    seccion(b, r, 63, 67, '#2a0a46', '#18062a', '#d0a0ff', { fuerte: '#9a4aff', step: 5 });
    b.portal(xl, 1, 'spider');
    b.shake(xl, 5, 3);
    b.pulse(xl, '#ffffff', 5);
    aranaRun(b, r, [[63, 1], [63, 3], [64, 1], [64, 2], [64, 3], [65, 0], [65, 2], [65, 3], [66, 0], [66, 2]],
      5, 7, true, xr(67) + 3);
    const xm = r(67);
    seccion(b, r, 67, 70, '#0a2a2e', '#06181b', '#7affe0', { fuerte: '#2fd6b5', step: 5 });
    b.portal(xm, 1, 'robot');
    b.shake(xm, 4, 2);
    b.spike(r(67, 2) + 1.5);
    b.block(xr(67, 3) + 1, 0, 3, 2);
    b.spikes(xr(67, 3) + 4, 3);
    b.spike(r(68, 2) + 1.5);
    b.spikes(r(68, 3) + 1.5, 2);
    b.pad(xr(69), 0, 'yellow');
    b.spikes(xr(69) + 2, 6);
    b.spike(r(69, 2) + 1.5);

    // fin (compás 70): la canción se apaga
    const xf = r(70);
    b.color(xf, '#0a2a2e', '#06181b', { line: '#7affe0', obj: '#ffd23a' });
    b.pulse(xf, '#7affe0', 6);
    b.camzoom(xf, 0.9, 8);
    b.deco(xf + 6, 3, 'diamond', { r: 1.4, color: '#7affe0', beat: true });
    return b.build(r.end);
  }

  function build(H) {
    ({ Builder, rejilla, ritmo, adornos, UPS } = H);
    return telarana();
  }
  let Builder, rejilla, ritmo, adornos, UPS; // eslint-disable-line no-unused-vars
  if (typeof module !== 'undefined' && module.exports) module.exports = build;
  else (root.NIVELES = root.NIVELES || {})['telarana'] = build;
})(typeof globalThis !== 'undefined' ? globalThis : this);
