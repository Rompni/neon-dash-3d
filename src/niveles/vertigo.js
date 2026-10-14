/* NEON DASH — nivel 'vertigo'. Se registra en NIVELES; levels.js lo construye con las utilidades comunes. */
(function (root) {
  'use strict';
  // ------------------------------------------------------------------ 10
  // Araña y ovni jugando con la gravedad, al ritmo de 'Arachnid Grid' (140 BPM): una telaraña de plataformas,
  // ovnis que se dan la vuelta a mitad de camino y pads azules traicioneros que lanzan a la araña al techo
  // justo antes de los pinchos.
  //
  //   compás  0-3   cubo 1x      intro
  //           4-7   araña 1x
  //           8-14  ovni 2x      en el 12 se da la vuelta
  //          15     cubo 2x      silencio: respiro
  //          16-19  araña 2x     DROP 1, pads azules
  //          20-23  ovni 2x      boca abajo entre sierras
  //          24-30  cubo 2x      gravedad: pads, orbes y portales
  //          31-35  ovni 2x/1x   pausa con un molino de sierras
  //          36-45  araña 3x     DROP 2: la telaraña
  //          46-53  ovni 3x      columnas que se mueven
  //          54-55  cubo 1x      pausa
  //          56-63  araña 2x     final
  //          64-71  ovni 2x
  //          72     la canción se apaga

  // Araña: entradas [compás, tiempo] (toque) o [compás, tiempo, 'pad'] (pad azul en el lado donde está, que la
  // lanza al otro sin tocar). Tras cada una, pinchos en el lado que deja, desde 1,5 bloques después hasta 1,5
  // antes de la siguiente (como mucho maxLen). ceil: fila del techo. floor0: empieza en el suelo.
  // last: x hasta la que llegan los pinchos de la última entrada. Devuelve si acaba en el suelo.
  function aranaRun(b, r, taps, ceil, maxLen, floor0, last) {
    let onFloor = floor0 !== false;
    for (let i = 0; i < taps.length; i++) {
      const x = r(taps[i][0], taps[i][1]);
      if (taps[i][2] === 'pad') {
        if (onFloor) b.pad(Math.round(x - 0.5), 0, 'blue');
        else b.pad(Math.round(x - 0.5), ceil - 1, 'blue', 180);
      }
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

  // Columnas del ovni: [x, fila inferior del hueco, alto del hueco], 2 de ancho, hasta la fila 10.
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

  function vertigo() {
    const tramos = [[0, 1], [8, 2], [33, 1], [36, 3], [54, 1], [56, 2]];
    const r = ritmo('arachnid-grid', tramos);
    const xr = (bar, beat) => Math.round(r(bar, beat));
    const b = new Builder({
      id: 'vertigo',
      card: '#b04cff',
      theme: 'original',
      theme3d: 'bosque',
      name: 'Vértigo',
      difficulty: 'Difícil',
      stars: 7,
      song: 'track:arachnid-grid',
      synth: 'espejo',
      bpm: r.track.bpm,
      startSpeed: tramos[0][1],
    });
    for (const [bar, v] of tramos.slice(1)) b.speed(r(bar), 1, v);

    // Embudo de un modo volador a otro modo: el techo baja de 10 a 3 en las 7 columnas antes de xa y queda
    // plano n columnas desde xa (ahí van los portales); ceilTo: fila a la que sube después (si no, se acaba).
    const embudo = (xa, n, ceilTo) => {
      const segs = [[7, 0, -1], [n, 0, 0]];
      if (ceilTo) segs.push([ceilTo - 3, 0, 1]);
      b.corridor(xa - 7, 0, 10, segs, 10);
    };

    // A · intro (compases 0-3): cubo a 1x
    b.color(0, '#160c30', '#0c061c', { line: '#c8a8ff', obj: '#ffd23a' });
    seccion(b, r, 0, 4, '#160c30', '#0c061c', '#c8a8ff');
    b.deco(10, 5, 'glow', { r: 4, color: '#b04cff' });
    b.spike(r(1) + 1.5);
    b.spike(r(1, 2) + 1.5);
    b.spikes(r(2) + 1, 2);
    b.block(xr(2, 2) + 1, 0, 3, 1);
    b.spike(xr(2, 2) + 4);
    b.spikes(r(3) + 1, 2);
    b.spike(r(3, 2) + 1.5);

    // B · araña (compases 4-7) a 1x: pinchos arriba y abajo
    const xb = r(4);
    seccion(b, r, 4, 8, '#280c46', '#16062a', '#e0b0ff', { lines: 9 });
    b.block(xr(4) - 4, 5, xr(8) - 3 - (xr(4) - 4), 1);
    b.portal(xb, 1, 'spider');
    b.hint(xb + 2, 3.4, 'Araña: toca para saltar al otro lado');
    aranaRun(b, r, [[4, 2], [5, 0], [5, 2], [5, 3], [6, 1], [6, 2], [6, 3], [7, 1]], 5, 6, true, xr(8) - 3);
    b.corridor(xr(8) - 3, 0, 5, [[2, 0, -1], [3, 0, 0]], 6);

    // C · ovni (compases 8-14) a 2x entre columnas; en el compás 12 un portal de gravedad le da la vuelta
    const xc = r(8);
    seccion(b, r, 8, 15, '#0c2446', '#06142a', '#7ad8ff', { fuerte: '#3a9aff' });
    b.portal(xc, 1, 'ufo');
    b.shake(xc, 2, 2);
    const lowsC = [2, 4, 1, 3, 5, 2, 4, 3, 5, 2, 4, 1];
    const gatesC = lowsC.map((lo, i) => [xr(8, 2 + 2 * i) + 1, lo, i < 3 ? 5 : 4]);
    columnas(b, gatesC);
    // moneda 1: arriba, justo antes de una columna; hay que subir pegado a su techo y meterse en el hueco
    b.coin(gatesC[3][0] - 2.5, 6.5);
    b.portal(gatesC[7][0] + 0.5, gatesC[7][1] + 1.5, 'flip');
    b.pulse(r(12), '#ffffff', 4);
    b.camrotate(r(12), 4, 6);
    embudo(xr(15) - 3, 5);
    b.portal(xr(15) - 2, 1, 'unflip');
    b.portal(r(15), 1, 'cube');

    // D · silencio (compás 15): respiro a ras de suelo, la cámara se acerca
    seccion(b, r, 15, 16, '#0c0618', '#06030c', '#8a6aff', { step: 4 });
    b.camzoom(r(15), 1.25, 6);
    b.camrotate(r(15), 0, 6);
    for (let k = 0; k < 4; k++) b.deco(xr(15, k) + 2, 3 + (k % 2), 'diamond', { r: 0.7, color: '#c8a8ff', beat: true });
    b.block(xr(16) - 4, 5, xr(20) - 3 - (xr(16) - 4), 1);

    // E · DROP 1 (compases 16-19): araña a 2x, un toque por tiempo y pads azules traicioneros
    const xe = r(16);
    seccion(b, r, 16, 20, '#3a0c2a', '#220618', '#ff7ad8', { fuerte: '#ff3a9a', step: 5 });
    b.portal(xe, 1, 'spider');
    b.shake(xe, 5, 3);
    b.camzoom(xe, 1, 3);
    aranaRun(b, r, [[16, 1], [16, 2], [16, 3, 'pad'], [17, 0], [17, 2], [17, 3], [18, 0, 'pad'], [18, 1], [18, 2], [18, 3],
      [19, 0], [19, 1, 'pad'], [19, 2], [19, 3]], 5, 7, true, xr(20) - 3);
    b.corridor(xr(20) - 3, 0, 5, [[2, 0, -1], [3, 0, 0]], 6);

    // F · ovni boca abajo entre sierras (compases 20-23)
    const xf = r(20);
    seccion(b, r, 20, 24, '#0c3a30', '#06221c', '#7affc8', { fuerte: '#3affa0', step: 5 });
    b.portal(xf, 1, 'ufo');
    b.portal(xr(20) + 1, 1, 'flip');
    const sierras = [[20, 2, 7.5, 2], [21, 0, 3, 2], [21, 2, 6.5, 2], [22, 0, 2.5, 1.5], [22, 0, 8.5, 1.5], [22, 2, 5, 2],
      [23, 0, 7.5, 2], [23, 1, 2.5, 1.5]];
    for (const [bar, beat, y, size] of sierras) b.saw(xr(bar, beat) + 3, y, size);
    // moneda 2: abajo del todo, contra la gravedad
    b.coin(xr(21, 1) + 3, 0.2);
    b.pulse(r(23), '#ffffff', 4);
    b.shake(r(23), 3, 2);
    embudo(xr(24) - 3, 5);
    b.portal(xr(24) - 2, 1, 'unflip');
    b.portal(r(24), 1, 'cube');

    // G · gravedad (compases 24-30): cubo a 2x con pads y portales azules, orbes y techos
    const xg = r(24);
    seccion(b, r, 24, 31, '#2a0c46', '#18062a', '#d0a0ff', { fuerte: '#9a4aff' });
    b.spike(r(24, 1) + 1.5);
    b.spikes(r(24, 3) + 1, 2);
    // compás 25: un pad azul la sube al techo; pinchos colgando y otro pad para volver
    b.pad(xr(25), 0, 'blue');
    b.block(xr(25) - 1, 6, xr(26, 3) - xr(25) + 1, 4);
    b.spikes(xr(25) + 3, xr(26, 2) - xr(25) - 4);
    b.spike(r(25, 2) + 1.5, 5, 180);
    b.spikes(r(26) + 1, 2, 5, 180);
    b.pad(xr(26, 2), 5, 'blue', 180);
    // compás 27: foso con un orbe amarillo a medio salto
    b.spikes(xr(27) + 1, 9);
    b.orb(xr(27) + 4, 2);
    b.spike(r(27, 3) + 1.5);
    // compases 28-30: portal de gravedad, paseo por el techo y vuelta con otro portal
    b.portal(r(28), 1, 'flip');
    b.pulse(r(28), '#ffffff', 4);
    b.block(xr(28) - 1, 6, xr(30) + 3 - (xr(28) - 1), 4);
    b.spikes(xr(28) + 3, xr(30) - xr(28) - 2);
    b.spike(r(28, 2) + 1.5, 5, 180);
    b.spikes(r(29) + 1, 2, 5, 180);
    b.spike(r(29, 2) + 1.5, 5, 180);
    b.portal(r(30), 4.5, 'unflip');
    b.spike(r(30, 2) + 1.5);
    b.spike(r(30, 3) + 1.5);

    // H · pausa (compases 31-35): ovni a 2x y luego a 1x, con un molino de sierras girando (grupo 5)
    const xh = r(31);
    seccion(b, r, 31, 36, '#0c1c30', '#060e1c', '#8ab8ff', { step: 9 });
    b.portal(xh, 1, 'ufo');
    b.camzoom(r(33), 0.8, 10);
    b.camrotate(r(33), -3, 16);
    columnas(b, [[xr(31, 2) + 1, 3, 5], [xr(32) + 1, 5, 4], [xr(32, 2) + 1, 2, 5], [xr(33) + 1, 4, 5]]);
    const mx = xr(34, 2);
    // molino (decorado, grupo 5): aspas de diamantes alrededor de un anillo
    b.inGroup(5, () => {
      for (const d of [-3.5, -2, 2, 3.5]) b.deco(mx + 0.5 + d, 5, 'diamond', { r: Math.abs(d) > 3 ? 1 : 0.6, color: '#8ab8ff' });
      b.deco(mx + 0.5, 5, 'ring', { r: 1, color: '#8ab8ff' });
    });
    b.rotate(r(33, 2), 5, 270, r(35, 2) - r(33, 2), 'linear', [mx + 0.5, 5]);
    embudo(xr(36) - 3, 4, 5);
    b.camzoom(r(36), 1.1, 4);
    b.camrotate(r(36), 0, 4);

    // I · DROP 2 (compases 36-45): araña a 3x; en el 40 la telaraña de plataformas y en el 44 el techo cae
    const xi = r(36);
    seccion(b, r, 36, 46, '#3a0c46', '#22062a', '#f0a0ff', { fuerte: '#c040ff', step: 5 });
    b.portal(xi, 1, 'spider');
    b.shake(xi, 6, 4);
    b.block(xr(36) + 3, 5, xr(40) - 1 - (xr(36) + 3), 1);
    aranaRun(b, r, [[36, 2], [36, 3], [37, 0, 'pad'], [37, 1], [37, 2], [37, 3], [38, 1], [38, 2, 'pad'], [38, 3], [39, 0],
      [39, 1], [39, 2]], 5, 9, true, xr(40) - 1);
    // telaraña: techo en la fila 8 y plataformas en medio (la araña salta a la superficie más cercana)
    const xw = xr(40) - 1, xw1 = xr(42);
    b.block(xw, 8, xw1 - xw, 2);
    const X = xr(40);
    b.spikes(X + 8, 35);                         // el suelo, prohibido durante toda la telaraña
    // 1 (tiempo 40.1): desde el suelo se cuelga de la cara inferior de la plataforma; al acabarse ésta, la
    // gravedad invertida la sube sola al techo
    b.block(X + 5, 3, 15, 1);
    b.spikes(X + 8, 6, 7, 180);
    // moneda 3: encima de la plataforma 1. Se llega tocando antes (al techo) y bajando enseguida sobre ella;
    // al final de la plataforma se vuelve a subir al techo y se junta con la ruta normal
    b.coin(X + 11, 4);
    // 2 (tiempo 41.0): desde el techo se aterriza encima de la segunda plataforma; al acabarse, cae al suelo
    b.block(X + 24, 4, 16, 1);
    b.spikes(X + 30, 10, 7, 180);
    for (let k = 0; k < 3; k++) b.deco(X + 8 + k * 14, 6, 'diamond', { r: 0.6, color: '#f0a0ff', beat: true });
    // compases 42-45: araña con pads; en el 44 el techo baja una fila (grupo 6, move) medio compás antes.
    // Techo macizo: quien siga por el techo de la telaraña choca con él
    b.block(xw1, 5, xr(44) - xw1, 5);
    b.inGroup(6, () => b.block(xr(44), 5, xr(46) - 3 - xr(44), 5));
    b.move(r(43, 2), 6, 0, -1, 4, 'inout');
    b.pulse(r(43, 2), '#ffffff', 2);
    b.shake(r(43, 2) + 4, 2, 1);
    aranaRun(b, r, [[42, 1], [42, 2], [42, 3, 'pad'], [43, 0], [43, 1], [43, 2]], 5, 9, true, xr(44) - 1);
    aranaRun(b, r, [[44, 1], [44, 2], [44, 3], [45, 0, 'pad'], [45, 1], [45, 2]], 4, 9, true, xr(46) - 3);
    b.camrotate(r(42), 3, 8);
    b.camrotate(r(44), -3, 8);
    b.corridor(xr(46) - 3, 0, 4, [[1, 0, -1], [4, 0, 0]], 6);

    // J · ovni a 3x (compases 46-53): columnas fantasma que se encienden al acercarse (grupos 7 y 8, alpha)
    const xj = r(46);
    seccion(b, r, 46, 54, '#0c2a3a', '#061822', '#7ae0ff', { fuerte: '#20b0ff' });
    b.portal(xj, 1, 'ufo');
    b.camrotate(xj, 0, 6);
    b.shake(xj, 3, 2);
    columnas(b, [[xr(46, 2) + 1, 2, 5], [xr(47) + 1, 4, 5]]);
    b.inGroup(7, () => columnas(b, [[xr(47, 2) + 1, 2, 5], [xr(48, 2) + 1, 2, 5]]));
    b.alpha(0, 7, 0.1, 0);
    b.alpha(r(47), 7, 1, 6);
    columnas(b, [[xr(48) + 1, 5, 4], [xr(49) + 1, 1, 5], [xr(49, 2) + 1, 4, 4]]);
    // compás 50: se da la vuelta
    b.portal(xr(50) + 0.5, 5, 'flip');
    columnas(b, [[xr(50), 3, 5]]);
    b.pulse(r(50), '#ffffff', 4);
    b.inGroup(8, () => columnas(b, [[xr(50, 2) + 1, 5, 5], [xr(51, 2) + 1, 5, 5]]));
    b.alpha(0, 8, 0.1, 0);
    b.alpha(r(49, 3), 8, 1, 6);
    columnas(b, [[xr(51) + 1, 3, 5], [xr(52) + 1, 4, 5], [xr(52, 2) + 1, 2, 5], [xr(53) + 1, 3, 5]]);
    embudo(xr(54) - 3, 5);
    b.portal(xr(54) - 2, 1, 'unflip');
    b.portal(r(54), 1, 'cube');

    // K · pausa (compases 54-55): cubo a 1x; el 55 vuelve a subir
    seccion(b, r, 54, 56, '#160c30', '#0c061c', '#c8a8ff', { step: 9 });
    b.camzoom(r(54), 0.85, 6);
    b.spike(r(55) + 1.5);
    b.spikes(r(55, 2) + 1, 2);
    b.block(xr(56) - 4, 5, xr(64) - 3 - (xr(56) - 4), 1);

    // L · final (compases 56-63): araña a 2x con pads, cada vez más seguida
    const xl = r(56);
    seccion(b, r, 56, 64, '#3a0c2a', '#220618', '#ff8ad8', { fuerte: '#ff3a9a', step: 5 });
    b.portal(xl, 1, 'spider');
    b.camzoom(xl, 1.1, 4);
    b.shake(xl, 5, 3);
    aranaRun(b, r, [[56, 1], [56, 3], [57, 0, 'pad'], [57, 2], [57, 3], [58, 1], [58, 2, 'pad'], [58, 3], [59, 0], [59, 2],
      [60, 0], [60, 1], [60, 2, 'pad'], [60, 3], [61, 0], [61, 1], [61, 2], [61, 3, 'pad'], [62, 0], [62, 1], [62, 2], [62, 3],
      [63, 0, 'pad'], [63, 1]], 5, 7, true, xr(64) - 3);
    b.saw(r(59) + 0.5, 2, 1.2);
    b.saw(r(61) + 0.5, 2, 1.2);
    b.corridor(xr(64) - 3, 0, 5, [[2, 0, -1], [3, 0, 0]], 6);

    // M · ovni final (compases 64-71): columnas a cada medio compás, vuelta en el 68 y sierras
    const xm = r(64);
    seccion(b, r, 64, 72, '#0c3a30', '#06221c', '#7affc8', { fuerte: '#3affa0', step: 5 });
    b.portal(xm, 1, 'ufo');
    b.shake(xm, 4, 2);
    b.camzoom(xm, 1, 4);
    columnas(b, [2, 5, 3, 1, 4, 2, 5].map((lo, i) => [xr(64, 2 + 2 * i) + 1, lo, 4]));
    b.portal(xr(68) + 0.5, 5, 'flip');
    columnas(b, [[xr(68), 3, 5]]);
    b.pulse(r(68), '#ffffff', 4);
    columnas(b, [5, 2, 4, 6, 3].map((lo, i) => [xr(68, 2 + 2 * i) + 1, lo, 4]));
    b.saw(xr(69) + 3.5, 5, 1.5);
    b.saw(xr(70, 2) + 3.5, 8, 1.5);
    embudo(xr(72) - 3, 5);
    b.portal(xr(72) - 2, 1, 'unflip');
    b.portal(r(72), 1, 'cube');

    // fin (compás 72): la canción se apaga
    const xz = r(72);
    b.color(xz, '#160c30', '#0c061c', { line: '#c8a8ff', obj: '#ffd23a' });
    b.pulse(xz, '#c8a8ff', 6);
    b.camzoom(xz, 0.9, 8);
    b.deco(xz + 8, 3, 'diamond', { r: 1.4, color: '#c8a8ff', beat: true });
    return b.build(r.end);
  }

  function build(H) {
    ({ Builder, rejilla, ritmo, adornos, UPS } = H);
    return vertigo();
  }
  let Builder, rejilla, ritmo, adornos, UPS; // eslint-disable-line no-unused-vars
  if (typeof module !== 'undefined' && module.exports) module.exports = build;
  else (root.NIVELES = root.NIVELES || {})['vertigo'] = build;
})(typeof globalThis !== 'undefined' ? globalThis : this);
