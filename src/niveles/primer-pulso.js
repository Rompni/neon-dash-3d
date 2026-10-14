/* NEON DASH — nivel 'primer-pulso'. Se registra en NIVELES; levels.js lo construye con las utilidades comunes. */
(function (root) {
  'use strict';
  // ------------------------------------------------------------------ 1
  // El nivel de bienvenida, sobre 'Pixel Meadow' (120 BPM, 60 compases, todo a 1x).
  // A 1x un tiempo son ~5,2 bloques y un salto ~4,5: hay casi un tiempo de suelo entre salto y salto, así que
  // todo cae sobre los tiempos sin prisas. Cubo, orbes, pads, gravedad invertida y dos tramos de nave.
  //   0-3   intro          cubo, pinchos sueltos en los tiempos fuertes
  //   4-11  A              escaleras, pad y la primera moneda (orbe opcional)
  //   12-15 B              orbes sobre fosos
  //   16-21 C              gravedad invertida y subida (pinchitos a cada tiempo)
  //   22-23 respiro        un compás vacío con la cámara alejándose y un compás de redoble
  //   24-31 DROP 1         nave por un túnel ondulado (moneda 2 en la cresta más alta)
  //   32-36 drop 1 (2ª)    cubo con pads y orbes a cada tiempo
  //   37-38 respiro        colinas suaves y anillos girando
  //   39-42 D              plataformas que bajan del cielo y se colocan antes de que llegues
  //   43-46 E              gravedad invertida con un orbe
  //   47-50 F              nave entre puertas alternas, a cada medio compás
  //   51-55 G              calma: saltos sueltos y una colina
  //   56-58 FINAL          pads y orbes a cada tiempo (moneda 3)
  //   59    salida
  function primerPulso() {
    const r = ritmo('pixel-meadow', [[0, 1]]);
    const b = new Builder({
      id: 'primer-pulso',
      card: '#ff7a3d',
      theme: 'original',
      theme3d: 'ciudad',
      name: 'Primer Pulso',
      difficulty: 'Fácil',
      stars: 2,
      song: 'track:pixel-meadow',
      synth: 'pulso',
      bpm: r.track.bpm,
      startSpeed: 1,
    });

    // --- utilidades del nivel (x del jugador = r(compás, tiempo); el salto dura ~4,5 bloques a 1x)
    // Pinchos que se saltan pulsando justo en ese tiempo.
    const pinchos = (bar, beat, n) => b.spikes(r(bar, beat) + (n > 1 ? 1.5 : 2), n || 1);
    const pinchitos = (bar, beat) => b.small(r(bar, beat) + 2);
    // Foso con orbe: se salta medio tiempo antes y el orbe se toca justo en el tiempo.
    const pozoOrbe = (bar, beat, kind, n) => {
      const x0 = r(bar, beat - 0.5);
      b.spikes(x0 + 1.5, n || 5);
      b.orb(r(bar, beat), 2, kind || 'yellow');
    };
    // Pad en el tiempo y pinchos detrás (el pad lanza ~6,5 bloques).
    const padPozo = (bar, beat, n) => {
      const x = r(bar, beat);
      b.pad(x - 0.5, 0, 'yellow');
      b.spikes(x + 1, n || 4);
    };
    // Escalera: sube un escalón en el tiempo `beat`, otro en el siguiente y salta al suelo en el tercero.
    const escalera = (bar, beat) => {
      const a = r(bar, beat) + 1.5, c = r(bar, beat + 1) + 1.5, e = r(bar, beat + 2) + 2;
      b.block(a, 0, c - a, 1);
      b.block(c, 0, e - c, 2);
      b.spikes(e, 3);
    };
    // Pulsos de color: cada compás o, en los drops, cada tiempo.
    const pulsos = (b0, b1, color, cadaTiempo) => {
      for (let k = b0; k < b1; k++) {
        b.pulse(r(k), color, cadaTiempo ? 4 : 3);
        if (cadaTiempo) for (let t = 1; t < 4; t++) b.pulse(r(k, t), color, 2);
      }
    };
    // Techo para correr con la gravedad invertida: bloque en la fila `y`, pinchos colgando en los tiempos
    // dados y pinchitos en el suelo por si te caes.
    const techo = (x0, x1, y, golpes) => {
      b.block(x0, y, x1 - x0, 1);
      for (const [bar, beat, n] of golpes) b.spikes(r(bar, beat) + (n > 1 ? 1.5 : 2), n, y - 1, 180);
    };

    // ---------------------------------------------------------------- 0-3 · intro
    b.color(0, '#2a53d6', '#1c3aa8', { line: '#bcd0ff', obj: '#ff9f3b' });
    adornos(b, 0, r(4), '#bcd0ff');
    pulsos(1, 4, '#bcd0ff');
    b.hint(4, 4, 'Toca para saltar');
    pinchos(1, 0);
    pinchos(1, 2);
    pinchos(2, 0);
    pinchos(2, 2, 2);
    // un escalón de un bloque: subir en el tiempo 0, bajar solo
    b.block(r(3) + 1.5, 0, r(3, 2) - r(3) - 1, 1);
    pinchos(3, 3);

    // ---------------------------------------------------------------- 4-11 · A
    b.color(r(4), '#5b37d4', '#3d239e', { line: '#e0d4ff', obj: '#3bd8ff' });
    adornos(b, r(4), r(12), '#e0d4ff');
    pulsos(4, 12, '#e0d4ff');
    b.deco(r(4), 5, 'ring', { r: 2.5, color: '#e0d4ff', alpha: 0.6 });
    pinchos(4, 0);
    pinchos(4, 2, 2);
    escalera(5, 0);
    pinchos(6, 0);
    pinchos(6, 2);
    b.hint(r(7) - 4, 4.5, 'Los pads amarillos te lanzan');
    padPozo(7, 0);
    pinchos(7, 2, 2);
    // plataforma larga de un bloque con un pincho encima
    b.block(r(8) + 1.5, 0, r(8, 3) - r(8) - 1, 1);
    b.spike(r(8, 2) + 2, 1);
    pinchos(9, 0, 2);
    pinchos(9, 2);
    // Moneda 1: tras saltar los pinchos, un orbe opcional en lo alto del salto lleva hasta ella.
    pinchos(10, 0, 2);
    b.orb(r(10) + 3, 2.6);
    b.coin(r(10) + 5.5, 4.6);
    pinchos(10, 3);
    pinchos(11, 0);
    pinchos(11, 2, 2);

    // ---------------------------------------------------------------- 12-15 · B: orbes
    b.color(r(12), '#9a2fc9', '#6a1e8c', { line: '#f3c8ff', obj: '#ffd23a' });
    adornos(b, r(12), r(16), '#f3c8ff');
    pulsos(12, 16, '#f3c8ff');
    b.hint(r(12) - 4, 4.5, 'Toca el orbe en el aire');
    pozoOrbe(12, 1);
    pinchos(12, 3);
    pinchos(13, 0, 2);
    escalera(13, 1);
    pozoOrbe(14, 1);
    pinchos(14, 3, 2);
    pozoOrbe(15, 1, 'pink', 4);            // el orbe rosa salta menos: foso más corto
    pinchos(15, 3);

    // ---------------------------------------------------------------- 16-21 · C: gravedad invertida
    b.color(r(16), '#d9711c', '#a14d0c', { line: '#ffe0b8', obj: '#a6ff5c' });
    adornos(b, r(16), r(22), '#ffe0b8');
    pulsos(16, 22, '#ffe0b8');
    techo(r(16) - 2, r(19, 3), 5, [[17, 0, 1], [17, 2, 1], [18, 0, 2], [18, 2, 1], [19, 0, 1]]);
    b.portal(r(16, 2), 1, 'flip');
    b.hint(r(16, 2), 3.2, 'Gravedad invertida');
    b.smalls(r(16, 3), Math.floor(r(19, 2) - r(16, 3)) + 2);
    b.portal(r(19, 2), 3, 'unflip');
    // subida: pinchitos cada vez más seguidos
    pinchitos(20, 0);
    pinchitos(20, 2);
    for (let t = 0; t < 4; t++) pinchitos(21, t);

    // ---------------------------------------------------------------- 22-23 · respiro y redoble
    b.color(r(22), '#121a3e', '#0a1028', { line: '#7ad8ff', obj: '#7ad8ff' });
    pulsos(22, 24, '#7ad8ff');
    b.camzoom(r(22), 0.82, 16);
    b.camzoom(r(24) - 2, 1, 6, 'out');
    for (let k = 0; k < 4; k++) b.deco(r(22, k) + 2, 4 + (k % 2), 'diamond', { r: 0.6 + 0.2 * k, color: '#7ad8ff', beat: true });
    b.deco(r(22, 2), 5, 'glow', { r: 5, color: '#3a7aff', alpha: 0.5 });
    pinchos(23, 0);
    pinchos(23, 2);
    b.hint(r(23, 3), 5.5, 'Nave: mantén para subir');

    // ---------------------------------------------------------------- 24-31 · DROP 1: nave
    const xd = r(24);
    b.color(xd, '#0f8f9e', '#0a6470', { line: '#b8fff6', obj: '#ffd23a' });
    adornos(b, xd, r(32), '#b8fff6', { step: 5 });
    pulsos(24, 32, '#b8fff6', true);
    b.shake(xd, 4, 3);
    b.portal(xd, 1, 'ship');
    // túnel ondulado con hueco de 6; la onda crece al entrar y se apaga al salir
    const tA = xd + 8, tB = r(31, 2);
    const centro = (x) => 4.5 + 2.2 * Math.sin((x - tA) / 8) * Math.max(0, Math.min(1, (x - tA) / 20, (tB - x) / 12));
    b.tunnel(tA, tB, centro, 6);
    // Moneda 2: en la cresta más alta del túnel, arriba del todo.
    const xc2 = tA + Math.round(8 * 2.5 * Math.PI);
    b.coin(xc2, 8);
    // anillo y diamante que giran sobre el túnel (decorado con grupo + rotate)
    b.inGroup(1, () => {
      b.deco(xd + 40, 5, 'ring', { r: 4, color: '#b8fff6', alpha: 0.4 });
      b.deco(xd + 44, 5, 'diamond', { r: 0.9, color: '#ffd23a' });
    });
    b.rotate(xd + 10, 1, 720, 120, 'linear');
    // embudo hacia el portal de cubo
    b.corridor(tB + 1, 0, 10, [[6, 0, -1], [7, 0, 0]]);
    b.portal(r(32) - 0.5, 1.5, 'cube');   // a 1,5 cubre todo el embudo (de 0 a 4)

    // ---------------------------------------------------------------- 32-36 · drop 1, segunda parte: cubo
    const xe = r(32);
    b.color(xe, '#2a8f2e', '#1a5f1c', { line: '#d6ffb8', obj: '#ffd23a' });
    adornos(b, xe, r(37), '#d6ffb8', { step: 5 });
    pulsos(32, 37, '#d6ffb8', true);
    pinchos(32, 2);
    padPozo(33, 0);
    pinchos(33, 2, 2);
    pozoOrbe(34, 1);
    pinchos(34, 3);
    escalera(35, 0);
    padPozo(36, 0);
    pinchos(36, 2, 2);

    // ---------------------------------------------------------------- 37-38 · respiro: colinas
    b.color(r(37), '#1d1d50', '#121236', { line: '#c8a8ff', obj: '#c8a8ff' });
    pulsos(37, 39, '#c8a8ff');
    b.camzoom(r(37), 0.85, 10);
    b.camzoom(r(39) - 4, 1, 6);
    b.slope(r(37) + 4, 0, 2, 1, 1);
    b.block(r(37) + 6, 0, 10, 1);
    b.slope(r(37) + 16, 0, 2, 1, -1);
    b.slope(r(38), 0, 2, 1, 1);
    b.block(r(38) + 2, 0, 6, 1);
    b.slope(r(38) + 8, 0, 2, 1, -1);
    b.inGroup(2, () => {
      b.deco(r(37, 2), 6, 'ring', { r: 2.5, color: '#c8a8ff', alpha: 0.6 });
      b.deco(r(38, 2), 6.5, 'ring', { r: 2, color: '#ff9cf0', alpha: 0.6 });
    });
    b.rotate(r(37), 2, 360, 40, 'linear');

    // ---------------------------------------------------------------- 39-42 · D: plataformas que bajan del cielo
    const xf = r(39);
    b.color(xf, '#d9711c', '#a14d0c', { line: '#fff0c9', obj: '#5d8bff' });
    adornos(b, xf, r(43), '#fff0c9');
    pulsos(39, 43, '#fff0c9');
    pinchos(39, 0);
    // Compases 40-41: columnas que bajan 6 bloques desde el cielo (con una chispa encima) y quedan quietas
    // casi un compás antes de que llegue el jugador. Entre una y otra, un foso de 2 pinchos; se salta de una
    // a otra cada dos tiempos.
    const plats = [[r(40), 1], [r(40, 2), 2], [r(41), 1], [r(41, 2), 1], [r(42), 0]];
    b.inGroup(3, () => {
      for (let i = 0; i + 1 < plats.length; i++) {
        const [x, h] = plats[i];
        const x0 = x + (i === 0 ? 1.5 : 2.5), x1 = plats[i + 1][0] + 0.5;
        b.block(x0, 6, x1 - x0, h);
        b.deco(x + 3.5, h + 6.5, 'diamond', { r: 0.6, color: '#fff0c9' });
      }
    });
    for (let i = 1; i + 1 < plats.length; i++) b.spikes(plats[i][0] + 0.5, 2);
    b.move(r(39), 3, 0, -6, 14, 'out');
    pinchos(42, 2);

    // ---------------------------------------------------------------- 43-46 · E: gravedad invertida con orbe
    b.color(r(43), '#b02a5a', '#7a143c', { line: '#ffd0e0', obj: '#7dff5a' });
    adornos(b, r(43), r(47), '#ffd0e0');
    pulsos(43, 47, '#ffd0e0');
    techo(r(43) - 2, r(46, 2), 6, [[44, 0, 1], [44, 2, 2], [45, 2, 1], [46, 0, 1]]);
    b.portal(r(43, 1), 1, 'flip');
    b.smalls(r(43, 2), Math.floor(r(46, 1) - r(43, 2)) + 2);
    // foso en el techo con un orbe rosa (con la gravedad invertida empuja hacia abajo)
    const xo = r(45, -0.5);
    b.spikes(xo + 1.5, 4, 5, 180);
    b.orb(r(45), 3, 'pink');
    b.portal(r(46, 1), 3.5, 'unflip');     // alcanza tanto al que corre por el techo como al que va saltando
    pinchos(46, 3);

    // ---------------------------------------------------------------- 47-50 · F: nave entre puertas
    const xg = r(47);
    b.color(xg, '#0f5e9c', '#08406b', { line: '#9fd6ff', obj: '#ffd23a' });
    adornos(b, xg, r(51), '#9fd6ff', { step: 5 });
    pulsos(47, 51, '#9fd6ff', true);
    b.portal(xg, 1, 'ship');
    // puertas cada dos tiempos, alternando abajo y arriba: hay que pasar por encima y luego por debajo de 5
    for (let i = 0; ; i++) {
      const x = r(47, 2 + 2 * i);
      if (x > r(50) + 1) break;
      if (i % 2 === 0) b.block(x, 0, 2, 5);
      else b.block(x, 5, 2, 5);
    }
    // anillos que bajan del cielo y se quedan enmarcando el hueco de dos puertas (decorado)
    b.inGroup(4, () => {
      b.deco(r(48, 1), 13, 'ring', { r: 1.6, color: '#9fd6ff', alpha: 0.6 });
      b.deco(r(49, 1), 13, 'ring', { r: 1.6, color: '#ffd23a', alpha: 0.6 });
    });
    b.move(r(47, 2), 4, 0, -9, 16, 'out');
    b.camoffset(xg, 0, 1, 10);
    b.camoffset(r(51) - 6, 0, 0, 6);
    b.corridor(r(50, 2), 0, 10, [[6, 0, -1], [Math.round(r(51) - r(50, 2)) - 3, 0, 0]]);
    b.portal(r(51) - 0.5, 1.5, 'cube');   // a 1,5 cubre todo el embudo (de 0 a 4)

    // ---------------------------------------------------------------- 51-55 · G: calma
    b.color(r(51), '#3a2a7a', '#241a52', { line: '#d8c8ff', obj: '#ff9f3b' });
    adornos(b, r(51), r(56), '#d8c8ff');
    pulsos(51, 56, '#d8c8ff');
    pinchos(51, 3);
    pinchos(52, 1, 2);
    b.slope(r(53) + 1, 0, 2, 1, 1);
    b.block(r(53) + 3, 0, r(53, 3) - r(53) - 3, 1);
    b.slope(r(53, 3), 0, 2, 1, -1);
    pinchos(54, 0);
    pinchos(54, 2);
    pinchos(55, 0, 2);

    // ---------------------------------------------------------------- 56-58 · FINAL
    const xh = r(56);
    b.color(xh, '#d42d6a', '#9c1448', { line: '#ffd0e4', obj: '#ffd23a' });
    adornos(b, xh, r(59), '#ffd0e4', { step: 5 });
    pulsos(56, 59, '#ffd0e4', true);
    b.shake(xh, 3, 2);
    padPozo(56, 0);
    pinchos(56, 2);
    pozoOrbe(57, 1);
    // Moneda 3: tras los últimos pinchos dobles, un orbe opcional en lo alto del salto.
    pinchos(57, 3, 2);
    b.orb(r(57, 3) + 3, 2.6);
    b.coin(r(57, 3) + 5.5, 4.6);
    padPozo(58, 1);
    pinchos(58, 3);

    // ---------------------------------------------------------------- 59 · salida
    b.color(r(59), '#2a53d6', '#1c3aa8', { line: '#bcd0ff', obj: '#ff9f3b' });
    b.pulse(r(59), '#bcd0ff', 6);
    b.deco(r(59) + 8, 3, 'diamond', { r: 1.4, color: '#bcd0ff', beat: true });
    // moneda que sustituye a la que quedó fuera al recortar la canción a 1:30 (comprobada con el bot)
    b.coin(509, 2);
    return b.build(r.end);
  }

  function build(H) {
    ({ Builder, rejilla, ritmo, adornos, UPS } = H);
    return primerPulso();
  }
  let Builder, rejilla, ritmo, adornos, UPS; // eslint-disable-line no-unused-vars
  if (typeof module !== 'undefined' && module.exports) module.exports = build;
  else (root.NIVELES = root.NIVELES || {})['primer-pulso'] = build;
})(typeof globalThis !== 'undefined' ? globalThis : this);
