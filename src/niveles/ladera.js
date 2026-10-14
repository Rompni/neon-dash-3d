/* NEON DASH — nivel 'ladera'. Se registra en NIVELES; levels.js lo construye con las utilidades comunes. */
(function (root) {
  'use strict';
  // ------------------------------------------------------------------ 4
  // Rampas, colinas y sierras sobre 'Alpine Velocity' (136 BPM, 64 compases). Frases de 8 compases:
  //   0-6   intro          cubo 1x por colinas suaves y sierras
  //   7-14  estrofa        cubo mini 1x: túneles bajos, crestas y la moneda 1
  //   15-22 DROP 1         cubo 2x por rampas, sierras y un molino de sierras que gira
  //   23-30 drop 1 (2ª)    nave 2x sobre montañas y sierras que se encienden (moneda 2 sobre una)
  //   31-38 respiro        1x: orbe verde, techo, orbe negro; la cámara se aleja
  //   39-46 DROP FINAL     onda 2x por una cordillera en diente de sierra, cambiando a cada tiempo
  //   47-54 drop final (2ª) cubo 2x: escalada, bajada, molino y la moneda 3
  //   55-63 salida         nave 1x sobre colinas tranquilas y aterrizaje
  // A 1x un tiempo son ~4,6 bloques y un salto 4,5; a 2x un tiempo ~5,7 y un salto 5,65: los saltos
  // encadenados (mantener pulsado) caen solos sobre los tiempos.
  function ladera() {
    const r = ritmo('alpine-velocity', [[0, 1], [15, 2], [31, 1], [39, 2], [55, 1]]);
    const b = new Builder({
      id: 'ladera',
      card: '#36b562',
      theme: 'original',
      theme3d: 'montanas',
      name: 'Ladera',
      difficulty: 'Normal',
      stars: 4,
      song: 'track:alpine-velocity',
      synth: 'ladera',
      bpm: r.track.bpm,
      startSpeed: 1,
    });

    // --- utilidades del nivel
    let S = 4.5; // largo del salto en la sección actual (1x: 4,5; 2x: 5,65; mini 1x: 3,6)
    const off = (n) => Math.round((S / 2 - n / 2) * 2) / 2;
    // n pinchos que se saltan pulsando en ese tiempo (sobre una superficie a altura y)
    const pinchos = (bar, beat, n, y) => b.spikes(r(bar, beat) + off(n || 1), n || 1, y || 0);
    const pinchitos = (bar, beat, n, y) => b.smalls(r(bar, beat) + off(n || 1), n || 1, y || 0);
    const sierra = (bar, beat, y, size) => b.saw(r(bar, beat) + off(1), y || 0, size || 1);
    // Colina: rampa de subida (ancho w por bloque de alto), meseta y rampa de bajada.
    const colina = (x0, x1, h, w) => {
      w = w || 2;
      b.slope(x0, 0, w * h, h, 1);
      b.block(x0 + w * h, 0, x1 - x0 - 2 * w * h, h);
      b.slope(x1 - w * h, 0, w * h, h, -1);
    };
    // Foso con orbe: se salta medio tiempo antes y el orbe se toca en el tiempo.
    const pozoOrbe = (bar, beat, kind, n) => {
      const x0 = r(bar, beat - 0.5);
      b.spikes(x0 + 1.5, n || 5);
      b.orb(r(bar, beat), 2, kind || 'yellow');
    };
    const pulsos = (b0, b1, color, cadaTiempo) => {
      for (let k = b0; k < b1; k++) {
        b.pulse(r(k), color, cadaTiempo ? 4 : 3);
        if (cadaTiempo) for (let t = 1; t < 4; t++) b.pulse(r(k, t), color, 2);
      }
    };
    // Molino: dos sierras de verdad en las puntas de un brazo de luz que gira alrededor de (cx, cy).
    // Con cy = 6,5 y brazo 2,5 la sierra más baja queda a 3,57 y el salto más alto llega a 3,22: por
    // debajo se pasa (saltando o no) en cualquier momento del giro.
    let grupo = 1;
    const molino = (cx, cy, brazo, x0, dur, vueltas, color) => {
      const g = grupo++;
      b.inGroup(g, () => {
        b.saw(cx - brazo - 0.5, cy - 0.5, 1);
        b.saw(cx + brazo - 0.5, cy - 0.5, 1);
        for (let k = 1; k <= 2; k++) {
          b.deco(cx - 0.5 - brazo * k / 3, cy - 0.5, 'diamond', { r: 0.25 + 0.15 * k, color });
          b.deco(cx - 0.5 + brazo * k / 3, cy - 0.5, 'diamond', { r: 0.25 + 0.15 * k, color });
        }
      });
      b.deco(cx - 0.5, cy - 0.5, 'glow', { r: 2, color, alpha: 0.5 });
      b.deco(cx - 0.5, cy - 0.5, 'ring', { r: brazo + 0.6, color, alpha: 0.35 });
      b.deco(cx - 0.5, 0, 'pillar', { w: 1, h: cy, color, alpha: 0.4 });
      b.rotate(x0, g, 360 * vueltas, dur, 'linear', [cx, cy]);
    };
    // Perfil de un pasillo (corridor) columna a columna, para colocar sierras y monedas dentro del hueco.
    const perfil = (x0, f0, c0, segs) => {
      const out = [];
      let f = f0, c = c0, x = x0;
      for (const [n, fd, cd] of segs) for (let i = 0; i < n; i++) { f += fd; c += cd; out.push({ x: x++, f, c }); }
      return { at: (xx) => out[Math.max(0, Math.min(out.length - 1, Math.round(xx) - x0))], end: x };
    };

    // Cierra un pasillo de nave: llano hasta xEnd y embudo final (techo hasta 4, suelo a 0, 6 columnas llanas).
    const cerrar = (x0, xEnd, segs) => {
      let f = 0, c = 10, n = 0;
      for (const [k, fd, cd] of segs) { f += k * fd; c += k * cd; n += k; }
      if (f !== 0) throw new Error('el pasillo de nave debe acabar con el suelo a 0');
      segs.push([xEnd - x0 - n - (c - 4) - 6, 0, 0], [c - 4, 0, -1], [6, 0, 0]);
      return segs;
    };

    // ---------------------------------------------------------------- 0-6 · intro (1x)
    S = 4.5;
    b.color(0, '#1f8a70', '#125c4a', { line: '#bfffe9', obj: '#ffd23a' });
    adornos(b, 0, r(7), '#bfffe9');
    pulsos(0, 7, '#bfffe9');
    b.hint(6, 4, 'Las rampas se suben solas');
    colina(r(0, 2), r(1) - 1, 1);
    sierra(1, 0);
    colina(r(1, 2) - 1, r(2, 2) + 3, 1);
    pinchos(2, 0, 1, 1);
    sierra(2, 3, 0, 1.5);
    // colina de 2 con pinchos dobles arriba
    colina(r(3) + 1, r(3, 3) + 6, 2);
    pinchos(3, 2, 2, 2);
    sierra(4, 1);
    sierra(4, 3);
    // meseta que acaba en un foso: se salta al suelo
    b.slope(r(5) + 1, 0, 2, 1, 1);
    b.block(r(5) + 3, 0, r(5, 2) - r(5) - 2.5, 1);
    b.spikes(r(5, 2) + 0.5, 3);
    pinchos(6, 0);
    pinchos(6, 2);
    pinchos(6, 3);

    // ---------------------------------------------------------------- 7-14 · estrofa: mini (1x)
    S = 3.6;
    const xb = r(7);
    b.color(xb, '#7a3fd1', '#4f2290', { line: '#f1d9ff', obj: '#7dff5a' });
    adornos(b, xb, r(15), '#f1d9ff', { lines: 8.5 });
    pulsos(7, 15, '#f1d9ff');
    b.portal(xb - 0.5, 1, 'mini');
    b.hint(xb + 2, 3, 'Mini: cabes por huecos bajos');
    // túnel bajo: sólo cabe el cubo mini por debajo
    b.block(r(7, 1), 0.6, r(7, 3) - r(7, 1), 1);
    b.smalls(r(7, 1), 2, 1.6);
    b.deco(r(7, 1) - 2, 2.2, 'arrow', { color: '#f1d9ff' });
    pinchitos(8, 0);
    pinchitos(8, 2, 2);
    pinchos(8, 3);
    colina(r(9) + 1, r(9, 3) + 4, 1);
    pinchitos(9, 2, 1, 1);
    pinchos(10, 0);
    b.block(r(10, 1) + 2, 0.6, r(10, 3) - r(10, 1) - 3.5, 1);
    pinchos(10, 3);
    // Moneda 1: salto sobre pinchitos; un orbe opcional en lo alto del salto lleva hasta ella.
    pinchitos(11, 0, 2);
    b.orb(r(11) + 1.5, 1.3);
    b.coin(r(11) + 3.5, 2.4);
    pinchos(11, 2);
    pinchitos(11, 3);
    // cresta: sube con rampas suaves hasta 2, pinchitos en la cima, y baja
    {
      const x0 = r(12) + 1, x1 = r(13, 3);
      b.corridor(x0, 0, null, [[4, 0.5, 0], [Math.round(x1 - x0) - 8, 0, 0], [4, -0.5, 0]]);
      pinchitos(12, 2, 1, 2);
      pinchitos(13, 0, 2, 2);
    }
    for (let t = 0; t < 4; t++) pinchitos(14, t);

    // ---------------------------------------------------------------- 15-22 · DROP 1: cubo 2x
    S = 5.65;
    const xc = r(15);
    b.portal(xc - 1.5, 1, 'big');
    b.speed(xc, 1, 2);
    b.color(xc, '#d9831f', '#9c5a0c', { line: '#fff0c9', obj: '#3bd8ff' });
    adornos(b, xc, r(23), '#fff0c9', { step: 5 });
    pulsos(15, 23, '#fff0c9', true);
    b.shake(xc, 4, 3);
    colina(r(15, 1), r(15, 3) + 4, 1);
    sierra(15, 2, 1);
    b.spikes(r(16) + 2, 3);                 // triple: medio bloque más tarde, tras la bajada de la colina
    // rampa a 45° hasta una meseta de 2; pinchos arriba; salto al suelo sobre sierras
    b.slope(r(16, 2) + 1, 0, 2, 2, 1);
    b.block(r(16, 2) + 3, 0, r(17, 2) - r(16, 2) - 1.5, 2);
    pinchos(17, 0, 2, 2);
    b.saw(r(17, 2) + 2.5, 0, 1.5);
    b.saw(r(17, 2) + 4.5, 0, 1.5);
    // pad sobre un foso largo
    b.pad(r(18) - 0.5, 0, 'yellow');
    b.spikes(r(18) + 1, 5);
    pinchos(18, 3);
    // molino de sierras: por debajo se pasa sin saltar
    pinchos(19, 0);
    molino(r(19, 2), 6.5, 2.5, r(18, 2), 70, 1.5, '#fff0c9');
    pozoOrbe(20, 1, 'yellow', 6);
    pinchos(20, 3, 2);
    // montaña rusa: sube, sierra en la cima, baja
    b.corridor(r(21), 0, null, [[4, 0.5, 0], [6, 0, 0], [4, -0.5, 0]]);
    sierra(21, 1, 2);
    pinchos(21, 3, 2);
    for (let t = 0; t < 4; t++) pinchos(22, t);

    // ---------------------------------------------------------------- 23-30 · drop 1: nave 2x sobre montañas
    const xd = r(23);
    b.color(xd, '#0f5e9c', '#08406b', { line: '#9fd6ff', obj: '#ffd23a' });
    adornos(b, xd, r(31), '#9fd6ff', { step: 5 });
    pulsos(23, 31, '#9fd6ff', true);
    b.portal(xd - 0.5, 1, 'ship');
    b.shake(xd, 2, 2);
    b.hint(xd + 2, 6, 'Nave: mantén para subir');
    {
      const x0 = Math.round(xd + 3);
      const xEnd = Math.round(r(31)) + 3;
      // [columnas, subida del suelo, subida del techo]: el hueco nunca baja de 4
      const segs = cerrar(x0, xEnd, [[6, 0, 0], [4, 0.5, -0.5], [6, 0, 0], [4, 0.5, 0.5], [8, 0, 0], [8, -0.5, -0.5],
        [6, 0, 0], [6, 0.5, 0.5], [6, 0, 0], [6, -0.5, -0.5], [6, 0, 0], [4, 0.5, 0], [6, 0, 0], [4, -0.5, 0],
        [6, 0, 0], [8, 0.5, 0.5], [8, 0, 0], [8, -0.5, -0.5], [6, 0, 0], [4, 0.5, 0], [8, 0, 0], [4, -0.5, 0]]);
      const P = perfil(x0, 0, 10, segs);
      b.corridor(x0, 0, 10, segs);
      // sierras en los tiempos, alternando arriba y abajo del hueco
      const sitios = [[24, 2, 0.3], [25, 0, 0.75], [25, 2, 0.25], [26, 0, 0.5], [26, 2, 0.8], [27, 1, 0.25],
        [27, 3, 0.7], [28, 2, 0.3], [29, 0, 0.75], [29, 2, 0.3]];
      for (const [bar, beat, k] of sitios) {
        const x = r(bar, beat), p = P.at(x);
        b.saw(x - 0.5, p.f + (p.c - p.f) * k - 0.5, 1.4);
      }
      // dos sierras que se encienden (fundido) mientras un anillo baja del techo hasta ellas; se ven del
      // todo más de un compás antes de llegar
      const gS = grupo++, gA = grupo++;
      b.inGroup(gS, () => {
        for (const x of [r(28), r(30)]) b.saw(x - 0.5, P.at(x).c - 2.5 - 0.5, 1.4);
      });
      b.inGroup(gA, () => {
        for (const x of [r(28), r(30)]) b.deco(x - 0.5, P.at(x).c + 3, 'ring', { r: 1.2, color: '#ffd23a', alpha: 0.7 });
      });
      b.alpha(0, gS, 0, 0);
      b.alpha(r(26), gS, 1, 16);
      b.move(r(26), gA, 0, -5.5, 16, 'out');
      b.alpha(r(26) + 16, gA, 0, 8);
      // Moneda 2: justo encima de la sierra que aparece en el compás 30; por debajo hay sitio de sobra, por
      // encima el paso es estrecho, pegado al techo.
      const xm = r(30), pm = P.at(xm);
      b.coin(xm - 0.5, pm.c - 1.2);
    }
    b.portal(r(31) - 0.5, 1.5, 'cube');   // a 1,5 cubre todo el embudo (de 0 a 4)

    // ---------------------------------------------------------------- 31-38 · respiro (1x)
    S = 4.5;
    const xe = r(31);
    b.speed(xe, 1, 1);
    b.color(xe, '#b03a5b', '#7a1f3b', { line: '#ffd0dc', obj: '#7dff5a' });
    adornos(b, xe, r(39), '#ffd0dc');
    pulsos(31, 39, '#ffd0dc');
    b.camzoom(xe, 0.82, 14);
    b.camzoom(r(39) - 4, 1, 6);
    colina(xe + 6, r(31, 3) + 2, 1);
    // orbe verde: salta y pulsa en el aire, la gravedad cambia y corres por el techo
    b.hint(r(32) - 2, 4.3, 'Orbe verde: salta y pulsa en el aire');
    b.block(r(32), 6, r(35) - r(32), 1);
    b.orb(r(32, 2), 2.5, 'green');
    // el orbe verde da un saltito hacia el suelo antes de subir: los pinchitos empiezan después
    b.smalls(r(32, 2) + 4.5, Math.floor(r(34, 3.5) - r(32, 2) - 4.5));
    for (const [bar, beat, n] of [[33, 0, 1], [33, 2, 2], [34, 0, 1], [34, 2, 2]]) {
      b.spikes(r(bar, beat) + off(n), n, 5, 180);
    }
    b.portal(r(34, 3.5), 3.5, 'unflip');
    // pad y orbe negro: el pad te lanza hacia una plataforma con pinchos y el orbe te hunde por debajo
    b.hint(r(35, 1), 5.4, 'Orbe negro: te hunde');
    b.pad(r(35, 2) - 0.5, 0, 'yellow');
    b.spikes(r(35, 2) + 1, 3);
    b.orb(r(35, 2) + 3, 4, 'black');
    b.block(r(35, 2) + 5, 3, 8, 1);
    b.spikes(r(35, 2) + 5, 8, 4);
    // subida hacia el drop final
    colina(r(36, 2), r(37) + 2, 1);
    pinchos(37, 0, 2);
    pinchos(37, 2);
    pinchos(38, 0);
    pinchos(38, 2);
    pinchos(38, 3);

    // ---------------------------------------------------------------- 39-46 · DROP FINAL: onda 2x
    const xf = r(39);
    b.speed(xf, 1, 2);
    b.portal(xf + 0.5, 1, 'wave');       // detrás del de velocidad: la onda no puede esquivarlo
    b.color(xf, '#3a0c5a', '#22063a', { line: '#ff9cf0', obj: '#ff9cf0' });
    adornos(b, xf, r(47), '#ff9cf0', { step: 5 });
    pulsos(39, 47, '#ff9cf0', true);
    b.shake(xf, 5, 3);
    b.camzoom(xf, 0.9, 10);
    b.camzoom(r(47) - 6, 1, 6);
    {
      // Cordillera: cada tramo dura n medios tiempos y alterna subida y bajada (a 45°), así que la onda
      // cambia de dirección justo en los tiempos y medios tiempos. Hueco vertical de 4.
      const X = (h) => Math.round(r(Math.floor(h / 8), (h % 8) / 2));
      // Compás 39: empieza un tiempo después del portal. Cada compás suma 8 medios tiempos y vuelve abajo.
      const A = [2, 2, 1, 1, 1, 1], B = [2, 1, 1, 2, 1, 1], C = [1, 1, 1, 1, 2, 2];
      const pat = [].concat([2, 2, 1, 1], A, B, C, A, B, C, [2, 2, 1, 1]);
      let h = 39 * 8 + 2;
      const x0 = X(h);
      const segs = [];
      let c = 2, dir = 1, carry = 0;
      for (const n of pat) {
        // el redondeo de la rejilla puede dejar un bloque de más: se recorta y pasa al tramo siguiente
        const len = X(h + n) - X(h) + carry;
        const L = dir > 0 ? Math.min(len, 8 - c) : Math.min(len, c - 2);
        carry = len - L;
        if (L > 0) segs.push([L, dir]);
        c += dir * L;
        h += n;
        dir = -dir;
      }
      if (c > 2) segs.push([c - 2, -1]);
      const res = b.waveCorridor(x0, 2, segs, 4, 1, 10);
      b.waveExit(res.x, 4, 3, 10, 1);
      b.hint(xf + 1, 6.5, 'Onda: mantén para subir');
    }

    // ---------------------------------------------------------------- 47-54 · drop final: cubo 2x
    S = 5.65;
    const xg = r(47);
    b.portal(xg - 0.5, 1, 'cube');
    b.color(xg, '#c2401f', '#86280e', { line: '#ffe0b0', obj: '#3bd8ff' });
    adornos(b, xg, r(55), '#ffe0b0', { step: 5 });
    pulsos(47, 55, '#ffe0b0', true);
    b.shake(xg, 3, 2);
    pinchos(47, 2);
    // escalada: escalones de 1, 2 y 3 a cada tiempo
    b.block(r(48) + 2, 0, r(48, 1) - r(48), 1);
    b.block(r(48, 1) + 2, 0, r(48, 2) - r(48, 1), 2);
    b.block(r(48, 2) + 2, 0, r(49) - r(48, 2) - 2, 3);
    b.small(r(48, 2) + 2, 3);
    b.spikes(r(48, 3) + 2.5, 1, 3);
    // bajada en rampa suave desde 3 con sierras en los tiempos
    b.corridor(r(49), 3, null, [[Math.round(r(49, 3) - r(49)), -3 / Math.round(r(49, 3) - r(49)), 0]]);
    {
      // sierra apoyada en la rampa (que baja 3 bloques en n columnas)
      const n = Math.round(r(49, 3) - r(49)), x = r(49, 1) + off(1);
      b.saw(x, 3 - 3 * (x + 0.5 - r(49)) / n - 0.3, 1);
    }
    sierra(49, 3, 0, 1.5);
    // molino sobre un llano
    pinchos(50, 0);
    molino(r(50, 2), 6.5, 2.5, r(49, 2), 70, -1.5, '#ffe0b0');
    pinchos(50, 3, 2);
    // Moneda 3: tras los pinchos del tiempo 0, un orbe opcional en lo alto lleva hasta ella.
    pinchos(51, 0, 2);
    b.orb(r(51) + 3, 2.6);
    b.coin(r(51) + 6, 4.6);
    pozoOrbe(51, 3, 'yellow', 6);
    pinchos(52, 2, 3);
    b.pad(r(53) - 0.5, 0, 'yellow');
    b.spikes(r(53) + 1, 5);
    b.corridor(r(53, 2), 0, null, [[4, 0.5, 0], [4, 0, 0], [4, -0.5, 0]]);
    sierra(53, 3, 2, 1);
    for (let t = 0; t < 4; t++) pinchos(54, t);

    // ---------------------------------------------------------------- 55-63 · salida: nave 1x
    const xh = r(55);
    b.speed(xh, 1, 1);
    b.portal(xh + 0.5, 1, 'ship');       // detrás del de velocidad
    b.color(xh, '#1f8a70', '#125c4a', { line: '#bfffe9', obj: '#ffd23a' });
    adornos(b, xh, r(63), '#bfffe9');
    pulsos(55, 63, '#bfffe9');
    b.camoffset(xh, 0, 1, 10);
    b.camoffset(r(61) - 6, 0, 0, 6);
    {
      const x0 = Math.round(xh + 3), xEnd = Math.round(r(61)) + 3;
      const segs = cerrar(x0, xEnd, [[6, 0, 0], [6, 0.5, 0], [6, 0, 0], [6, -0.5, -0.5], [8, 0, 0], [6, 0.5, 0.5],
        [8, 0, 0], [6, -0.5, 0], [6, 0, 0], [6, 0.5, -0.5], [8, 0, 0], [6, -0.5, 0.5]]);
      const P = perfil(x0, 0, 10, segs);
      b.corridor(x0, 0, 10, segs);
      for (const [bar, beat, k] of [[57, 0, 0.3], [58, 0, 0.7], [59, 0, 0.3], [60, 0, 0.6]]) {
        const x = r(bar, beat), p = P.at(x);
        b.saw(x - 0.5, p.f + (p.c - p.f) * k - 0.5, 1.2);
      }
    }
    b.portal(r(61) - 0.5, 1.5, 'cube');   // a 1,5 cubre todo el embudo (de 0 a 4)
    S = 4.5;
    pinchos(61, 2);
    pinchos(62, 0);
    colina(r(62, 1) + 2, r(62, 3) + 4, 1);
    b.color(r(63), '#125c4a', '#0a3a2e', { line: '#bfffe9', obj: '#ffd23a' });
    b.pulse(r(63), '#bfffe9', 6);
    b.deco(r(63) + 4, 3, 'diamond', { r: 1.4, color: '#bfffe9', beat: true });
    // moneda que sustituye a la que quedó fuera al recortar la canción a 1:30 (comprobada con el bot)
    b.coin(554, 3.5);
    return b.build(r.end);
  }

  function build(H) {
    ({ Builder, rejilla, ritmo, adornos, UPS } = H);
    return ladera();
  }
  let Builder, rejilla, ritmo, adornos, UPS; // eslint-disable-line no-unused-vars
  if (typeof module !== 'undefined' && module.exports) module.exports = build;
  else (root.NIVELES = root.NIVELES || {})['ladera'] = build;
})(typeof globalThis !== 'undefined' ? globalThis : this);
