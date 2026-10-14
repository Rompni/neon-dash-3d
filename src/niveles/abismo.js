/* NEON DASH — nivel 'abismo'. Se registra en NIVELES; levels.js lo construye con las utilidades comunes. */
(function (root) {
  'use strict';
  // ------------------------------------------------------------------ 6
  // Demonio sincronizado con 'demon-realm' (drum and bass, 173 BPM, 94 compases). Las frases son de 4 compases
  // y los drops caen en los compases 15, 31 y 79 (el 63 es el breakdown). Usa todos los modos:
  //   A 0-6 cubo 3x · B 7-10 bola · C 11-14 ovni (subida) · D 15-22 nave (drop 1) · E 23-28 onda mini
  //   F 29-30 cubo de gravedad (respiro) · G 31-38 cubo 4x con dual (drop 2) · H 39-46 nave mini 4x
  //   I 47-54 robot 3x · J 55-62 araña · K 63-70 columpio 2x (breakdown) · L 71-78 ovni boca abajo
  //   M 79-86 onda 4x (drop 3) · N 87-93 cubo 4x y final.
  // A 1x un compás son 14,4 bloques; a 2x 17,9; a 3x 21,6; a 4x 26,6 (un tiempo = un cuarto).

  // Pulso fuerte en cada compás y suave a mitad de compás (o en cada tiempo si beats).
  function pulsos(b, r, a, z, c1, c2, beats) {
    for (let n = a; n < z; n++) {
      b.pulse(r(n), c1, 4);
      if (beats) for (let t = 1; t < 4; t++) b.pulse(r(n, t), c2 || c1, 2);
      else if (c2) b.pulse(r(n, 2), c2, 2);
    }
  }

  // Puerta de ovni/nave: columna de 2 de ancho con un hueco [lo, lo + size).
  function puerta(b, x, lo, size, w) {
    w = w || 2;
    if (lo > 0) b.block(x, 0, w, lo);
    if (lo + size < 10) b.block(x, lo + size, w, 10 - (lo + size));
  }

  // Pasillo de onda en zigzag con los giros en las x dadas (enteras): alterna subida y bajada y cambia de
  // sentido si se saldría del pasillo. Devuelve los segmentos para waveCorridor.
  function zigzag(xs, c0, lo, hi, k) {
    const segs = [];
    let c = c0, dir = 1;
    for (let i = 0; i + 1 < xs.length; i++) {
      const len = xs[i + 1] - xs[i];
      if (len <= 0) continue;
      const cabe = (d, n) => (d > 0 ? c + n * k <= hi : c - n * k >= lo);
      if (!cabe(dir, len)) dir = -dir;
      if (!cabe(dir, len)) {
        // no cabe en ningún sentido: sube (o baja) hasta el borde y vuelve
        dir = hi - c >= c - lo ? 1 : -1;
        const a = Math.floor((dir > 0 ? hi - c : c - lo) / k);
        segs.push([a, dir], [len - a, -dir]);
        c += dir * a * k - dir * (len - a) * k;
        continue;
      }
      segs.push([len, dir]);
      c += dir * len * k;
      dir = -dir;
    }
    return { segs, c };
  }

  function abismo() {
    const T = [[0, 3], [31, 4], [47, 3], [63, 2], [79, 4]];
    const r = ritmo('demon-realm', T);
    const b = new Builder({
      id: 'abismo',
      card: '#8c1a4a',
      theme: 'original',
      theme3d: 'vacio',
      name: 'Abismo',
      difficulty: 'Demonio',
      stars: 10,
      song: 'track:demon-realm',
      synth: 'abismo',
      bpm: r.track.bpm,
      startSpeed: T[0][1],
    });
    // Pincho que se salta pulsando justo en el tiempo t del compás n (a 3x el vértice del salto va 3 bloques
    // por delante; a 4x, 4).
    const J = (n, t) => r(n, t) + 3;
    const J4 = (n, t) => r(n, t) + 4;
    const R = (n, t) => Math.round(r(n, t));

    // Decorado que gira: anillos en un grupo que da vueltas (sólo visual).
    let gDeco = 10;
    const anillos = (x, y, color, deg, dur) => {
      const g = gDeco++;
      b.inGroup(g, () => {
        b.deco(x - 2.5, y, 'ring', { r: 1.2, color, alpha: 0.6 });
        b.deco(x + 2.5, y, 'ring', { r: 1.2, color, alpha: 0.6 });
        b.deco(x, y + 2.5, 'diamond', { r: 0.6, color, beat: true });
        b.deco(x, y - 2.5, 'diamond', { r: 0.6, color, beat: true });
      });
      b.rotate(x - 30, g, deg, dur, 'linear', [x + 0.5, y + 0.5]);
    };

    // ------------------------------------------------ A · cubo 3x (compases 0-6): intro
    b.color(0, '#12061f', '#08030f', { line: '#ff3b5c', obj: '#ffd08f' });
    adornos(b, 0, r(7), '#ff3b5c');
    pulsos(b, r, 0, 7, '#ff3b5c');
    b.deco(8, 4, 'glow', { r: 5, color: '#ff3b5c', alpha: 0.6 });
    b.spike(J(1, 0));
    b.spike(J(1, 2));
    b.spikes(J(2, 0) - 0.5, 2);
    b.spikes(J(2, 2) - 1, 3);
    b.block(R(3) + 2, 0, 15, 1);             // escalón: se sube en el tiempo 0
    b.spike(J(3, 2), 1);                     // y se salta desde arriba en el 2
    b.pad(r(4), 0);                          // pad amarillo sobre un foso
    b.spikes(r(4) + 1, 7);
    b.spike(J(4, 3));
    b.spikes(r(5) + 2, 18);                  // foso con dos orbes, uno por tiempo y cuarto
    b.orb(r(5, 1), 1.5);
    b.orb(r(5, 1) + 6.5, 1.5);
    b.spike(J(6, 0));
    b.spikes(J(6, 2) - 0.5, 2);

    // ------------------------------------------------ B · bola 3x (compases 7-10): pinchos alternos
    const xb = r(7);
    b.portal(xb, 1, 'ball');
    b.color(xb, '#1f0613', '#100309', { line: '#ff6b3d', obj: '#ffb08f' });
    adornos(b, xb, r(11), '#ff6b3d');
    pulsos(b, r, 7, 11, '#ff6b3d', '#ff3b5c');
    b.spikes(r(7, 1) + 1, 3);                // suelo → arriba en el tiempo 0
    b.spikes(r(7, 3) + 1, 3, 7, 180);        // techo → abajo en el 2
    b.spikes(r(8, 1) + 1, 3);
    b.saw(r(8, 2) + 2, 3.5, 1.5);            // sierra en medio: no cambiar mientras pasa
    b.spikes(r(9) + 1, 3, 7, 180);
    b.spikes(r(9, 2) + 1, 3);
    b.spikes(r(9, 3) + 2, 2, 7, 180);
    b.spikes(r(10) + 2, 3);
    b.spikes(R(10, 2), R(11) - 7 - R(10, 2), 7, 180); // obliga a ir por abajo al portal
    b.corridor(R(11) - 7, 0, 8, [[5, 0, -1], [4, 0, 0]]);
    b.portal(r(11) + 1.5, 1, 'unflip');

    // ------------------------------------------------ C · ovni 3x (compases 11-14): subida, puertas cada vez más seguidas
    const xc = r(11);
    b.portal(xc, 1, 'ufo');
    b.color(xc, '#200b2e', '#100519', { line: '#ffb13b', obj: '#ffd08f' });
    adornos(b, xc, r(15), '#ffb13b');
    pulsos(b, r, 11, 13, '#ffb13b');
    pulsos(b, r, 13, 15, '#ffb13b', '#ff6b3d', true);
    b.camzoom(xc, 1.15, r(15) - xc, 'in');
    for (const [n, t, lo, size] of [[11, 1, 1, 4], [11, 3, 3, 4], [12, 1, 5, 4], [12, 3, 2, 4],
      [13, 0, 3, 4], [13, 1, 4, 4], [13, 2, 2, 4], [13, 3, 4, 4], [14, 0, 2, 4], [14, 1, 4, 4], [14, 2, 3, 4]]) {
      puerta(b, R(n, t), lo, size);
    }
    b.coin(R(12, 1) + 3, 8);                 // MONEDA 1: pegada al techo tras la puerta alta
    // embudo hasta el portal de nave (hueco 3..6)
    const xd = r(15);
    b.corridor(R(15) - 10, 0, 10, [[6, 0.5, -0.5], [2, 0, -0.5], [4, 0, 0]]);
    b.portal(xd, 4, 'ship');

    // ------------------------------------------------ D · nave 3x (compases 15-22): drop 1
    b.color(xd, '#0b0b2e', '#050519', { line: '#7a5cff', obj: '#c0b0ff' });
    adornos(b, xd, r(23), '#7a5cff', { step: 5 });
    pulsos(b, r, 15, 23, '#7a5cff', '#3bd8ff', true);
    b.camzoom(xd, 1, 8, 'out');
    b.shake(xd, 5, 4);
    // túnel ondulado: sube y baja con cada compás, con sierras en los tramos rectos
    const d0 = R(15) + 2;
    let tun = b.corridor(d0, 3, 6, [[4, -0.5, 0.25]]);
    const P = [[5, 0.5, 0.5], [6, 0, 0], [5, -0.5, -0.5], [5, 0, 0]];
    tun = b.corridor(tun.x, tun.f, tun.c, [].concat(P, P, P, P));
    for (let n = 15; n < 19; n++) {
      b.saw(Math.round(r(n) + 2 + 10.5) + ((n - 15) * -0.5), 3.5 + 2.5, 1);   // en lo alto del tramo subido
    }
    // de túnel a campo abierto
    tun = b.corridor(tun.x, tun.f, tun.c, [[2, -0.5, 0.5], [3, 0, 0.5]]);
    // campo abierto: columnas desde el suelo y desde el techo cada dos tiempos, sierras en medio
    for (let n = 19; n < 23; n++) {
      b.block(R(n), 0, 2, 5);                // abajo: pasar por encima
      b.saw(R(n, 1), 8.5, 1);
      b.block(R(n, 2), 5, 2, 5);             // arriba: pasar por debajo
      if (n < 22) b.saw(R(n, 3), 1.5, 1);
    }
    // embudo hasta la onda mini (hueco 3..6)
    const xe = r(23);
    b.corridor(R(23) - 6, 0, 10, [[3, 1, -1], [1, 0, -1], [5, 0, 0]]);
    b.portal(xe - 2, 4, 'mini');
    b.portal(xe, 4, 'wave');

    // ------------------------------------------------ E · onda mini 3x (compases 23-28)
    b.color(xe, '#061f1c', '#030f0e', { line: '#3bd8ff', obj: '#9ff0ff' });
    adornos(b, xe, r(29), '#3bd8ff', { step: 5 });
    pulsos(b, r, 23, 29, '#3bd8ff', '#3bffb1', true);
    const MW = [[2, 1], [2, -1], [2, 1], [1, -1], [1, 1], [2, -1], [2, 1], [2, -1], [1, 1], [1, -1],
      [2, 1], [2, -1], [2, 1], [1, -1], [1, 1], [2, -1], [2, 1], [2, -1], [2, 1], [2, -1]];
    const e0 = R(23) + 3;
    const nCols = R(29) - 9 - e0;
    const ws = [];
    let tot = 0;
    while (tot + 34 <= nCols) { for (const s of MW) ws.push(s); tot += 34; }
    while (tot + 4 <= nCols) { ws.push([2, 1], [2, -1]); tot += 4; }
    const aw = b.waveCorridor(e0, 3, ws, 6, 2);
    b.waveExit(aw.x, 6, 3);
    b.portal(aw.x + 3, 1, 'big');
    b.portal(aw.x + 5, 1, 'cube');

    // ------------------------------------------------ F · cubo de gravedad 3x (compases 29-30): respiro
    const xf = r(29);
    b.color(xf, '#16061f', '#0b030f', { line: '#ff3bd8', obj: '#ffd08f' });
    adornos(b, xf, r(31), '#ff3bd8');
    pulsos(b, r, 29, 31, '#ff3bd8');
    b.camzoom(xf, 0.9, r(31) - xf, 'inout');
    b.block(R(29) - 2, 6, R(31) - R(29), 4);  // techo para andar boca abajo
    b.pad(R(29, 1), 0, 'blue');              // al techo en el tiempo 1
    b.smalls(R(29, 1) + 1, R(30, 1) - R(29, 1));
    b.spike(J(29, 3), 5, 180);               // salto boca abajo
    b.orb(R(30, 1), 5, 'blue');              // de vuelta al suelo en el tiempo 1
    b.spikes(R(30, 1) + 3, R(31) - 2 - R(30, 1) - 3, 5, 180); // sin el orbe no hay salida
    b.spike(J(30, 2));

    // ------------------------------------------------ G · cubo 4x (compases 31-38): drop 2, con dual
    const xg = r(31);
    b.color(xg, '#2e0614', '#19030a', { line: '#ff2a3a', obj: '#ffd08f' });
    adornos(b, xg, r(39), '#ff2a3a', { step: 5 });
    pulsos(b, r, 31, 39, '#ff2a3a', '#ffb13b', true);
    b.speed(xg, 1, 4);
    b.camzoom(xg, 1, 6, 'out');
    b.shake(xg, 6, 5);
    b.spikes(J4(31, 0) - 1, 3);
    b.spike(J4(31, 2));
    b.block(R(32) + 3, 0, 18, 1);
    b.spike(J4(32, 2), 1);
    b.pad(R(33), 0);
    b.spikes(R(33) + 1, 9);
    b.spikes(J4(34, 0) - 0.5, 2);
    b.spikes(J4(34, 2) - 0.5, 2);
    // dual: techo a 8 y el gemelo andando por él, con los pinchos en espejo
    const xg2 = r(35);
    b.block(R(35) - 8, 8, R(39) - R(35) + 4, 2);
    b.portal(xg2, 1, 'dual');
    b.pulse(xg2, '#ffffff', 4);
    for (let n = 35; n < 39; n++) {
      const both = n !== 37;
      b.spike(J4(n, 0));
      if (both) b.spike(J4(n, 0), 7, 180);
      b.spikes(J4(n, 2) - 0.5, 2, 7, 180);
      if (n !== 36) b.spikes(J4(n, 2) - 0.5, 2);
    }
    b.portal(r(39) - 3, 1, 'single');

    // ------------------------------------------------ H · nave mini 4x (compases 39-46)
    const xh = r(39);
    b.portal(xh - 1, 1, 'mini');
    b.portal(xh, 1, 'ship');
    b.color(xh, '#06142e', '#030a19', { line: '#3b8cff', obj: '#9fc8ff' });
    adornos(b, xh, r(47), '#3b8cff', { step: 5 });
    pulsos(b, r, 39, 47, '#3b8cff', '#3bd8ff', true);
    anillos(R(43), 5, '#3bd8ff', 360, 80);
    // túnel de rampas (2:1) que sube y baja cada medio compás; sierras asomando en los tramos rectos
    let h = b.corridor(R(39) + 3, 0, 10, [[6, 0.5, -0.5]]);    // de abierto a hueco 3..7
    const HP = [[3, 0.5, 0.5], [4, 0, 0], [3, -0.5, -0.5], [3, 0, 0], [3, -0.5, -0.5], [4, 0, 0], [3, 0.5, 0.5], [3, 0, 0]];
    const hx0 = h.x;
    h = b.corridor(h.x, h.f, h.c, [].concat(HP, HP, [[3, 0.5, 0.5], [4, 0, 0], [1, 0, 1.5], [3, 0, 0], [1, 0, -1.5], [4, 0, 0], [3, -0.5, -0.5], [3, 0, 0], [4, 0, 0]], HP, HP, HP, HP));
    // sierras: en el suelo de los tramos rectos altos y en el techo de los bajos
    for (let i = 0; i < 7; i++) {
      if (i === 2) continue;
      const base = hx0 + i * 26;
      b.saw(base + 3 + 1.5, 4.5 - 0.5, 1);    // suelo en lo alto (f = 4.5)
      b.saw(base + 16 + 1.5, 5.5 + 0.5, 1);   // techo en lo bajo (c = 5.5)
    }
    b.coin(hx0 + 52 + 8, 8.6);       // MONEDA 2: en el hueco del techo
    // embudo al suelo para el robot
    h = b.corridor(h.x, h.f, h.c, [[6, -0.5, -0.5], [2, 0, -0.5]]);
    const xi = r(47);
    b.corridor(h.x, h.f, h.c, [[Math.max(4, R(47) + 3 - h.x), 0, 0]]);
    b.portal(xi - 2, 1, 'big');
    b.speed(xi, 1, 3);
    b.portal(xi + 1, 1, 'robot');

    // ------------------------------------------------ I · robot 3x (compases 47-54)
    b.color(xi, '#06261f', '#03130f', { line: '#3bffb1', obj: '#ffd23a' });
    adornos(b, xi, r(55), '#3bffb1');
    pulsos(b, r, 47, 55, '#3bffb1', '#3bd8ff');
    for (let n = 47; n < 55; n++) {
      const x = R(n);
      if (n === 47) { b.spike(x + 12); continue; }
      const v = (n - 48) % 4;
      if (v === 0) {                         // toque, torre de 2 y saltar desde arriba
        b.spike(x + 3);
        b.block(x + 9, 0, 3, 2);
        b.spikes(x + 13, 2);
      } else if (v === 1) {                  // torre de 3 desde un escalón
        b.block(x + 1, 0, 3, 1);
        b.block(x + 6, 0, 4, 3);
        b.spikes(x + 11, 4);
      } else if (v === 2) {                  // techo bajo con pinchitos: sólo toques
        b.block(x + 2, 2.5, 12, 1);
        b.small(x + 5);
        b.small(x + 10);
        if (n < 54) b.spike(x + 17);
      } else {                               // escalera de pistones sobre pinchitos
        b.smalls(x + 1, 18);
        b.block(x + 2, 0, 3, 1);
        b.block(x + 7, 0, 3, 2);
        b.block(x + 12, 0, 3, 1.5);
        b.block(x + 17, 0, 2, 1);
      }
    }
    b.corridor(R(55) - 8, 0, 6, [[3, 0, -1], [8, 0, 0]]);   // techo a 3: el robot no salta el portal

    // ------------------------------------------------ J · araña 3x (compases 55-62)
    const xj = r(55);
    b.portal(xj, 1, 'spider');
    b.color(xj, '#1f1f06', '#0f0f03', { line: '#ffe23b', obj: '#ffd08f' });
    adornos(b, xj, r(63), '#ffe23b', { lines: 8 });
    pulsos(b, r, 55, 63, '#ffe23b', '#ffb13b', true);
    b.block(R(55) + 3, 5, R(63) - R(55) - 3, 1);
    // pinchos alternos en el suelo (F) y en el techo (C): un teletransporte por tiempo
    for (let n = 55; n < 63; n++) {
      const pat = n % 2 ? 'FCFC' : 'FFCF';
      for (let t = 0; t < 4; t++) {
        if (n === 55 && t === 0) continue;
        if (n === 62 && t >= 2) continue;
        const x = R(n, t) + 2;
        if (pat[t] === 'F') b.spikes(x, 2); else b.spikes(x, 2, 4, 180);
      }
    }
    b.portal(R(59) + 1, 2, 'flip');
    b.pulse(R(59), '#ffffff', 4);
    // embudo de techo hasta el columpio
    b.corridor(R(62, 2), 0, 6, [[3, 0, -1], [Math.max(3, R(63) + 3 - R(62, 2) - 3), 0, 0]]);
    b.portal(r(63) - 3, 1, 'unflip');

    // ------------------------------------------------ K · columpio 2x (compases 63-70): breakdown
    const xk = r(63);
    b.speed(xk, 1, 2);
    b.portal(xk + 1, 1, 'swing');
    b.color(xk, '#0b0619', '#05030d', { line: '#b03bff', obj: '#e0b0ff' });
    adornos(b, xk, r(71), '#b03bff', { step: 9 });
    pulsos(b, r, 63, 71, '#b03bff');
    b.camrotate(xk, 8, r(67) - xk, 'inout');
    b.camrotate(r(67), -8, r(71) - r(67), 'inout');
    anillos(R(65), 5, '#b03bff', -360, 120);
    anillos(R(69), 5, '#b03bff', 360, 120);
    for (let n = 64; n < 71; n++) {
      if (n % 2 === 0) { b.block(R(n), 0, 2, 4); b.saw(R(n, 2), 8, 1.5); }
      else { b.block(R(n), 6, 2, 4); b.saw(R(n, 2), 2, 1.5); }
    }

    // ------------------------------------------------ L · ovni boca abajo 2x (compases 71-78)
    const xl = r(71);
    b.camrotate(xl, 0, 8, 'out');
    b.corridor(R(71) - 9, 0, 10, [[6, 0.5, -0.5], [2, 0, -0.5], [5, 0, 0]]);
    b.portal(xl, 4, 'ufo');
    b.portal(xl + 2, 4, 'flip');
    b.color(xl, '#2e0b1f', '#190510', { line: '#ff3b8f', obj: '#ffd08f' });
    adornos(b, xl, r(79), '#ff3b8f', { step: 6 });
    pulsos(b, r, 71, 78, '#ff3b8f');
    pulsos(b, r, 78, 79, '#ffffff', '#ff3b8f', true);
    b.camzoom(r(78), 1.25, r(79) - r(78), 'in');
    for (const [n, t, lo, size] of [[72, 0, 5, 4], [72, 2, 3, 4], [73, 0, 5, 4], [73, 2, 2, 4], [74, 0, 4, 4], [74, 2, 6, 3.5],
      [75, 0, 3, 4], [75, 2, 5, 4], [76, 0, 2, 4], [76, 2, 4, 4], [77, 0, 6, 3.5], [77, 2, 3, 4], [78, 0, 5, 4]]) {
      puerta(b, R(n, t), lo, size);
    }
    b.coin(R(73, 3), 0.8);                   // MONEDA 3: abajo del todo (contra la gravedad)
    // embudo hasta la onda (hueco 3..6)
    const xm = r(79);
    b.corridor(R(78, 2), 0, 10, [[6, 0.5, -0.5], [2, 0, -0.5], [R(79) + 5 - R(78, 2) - 8, 0, 0]]);
    b.portal(xm - 2, 4, 'unflip');
    b.speed(xm, 4, 4);
    b.portal(xm + 1, 4, 'wave');

    // ------------------------------------------------ M · onda 4x (compases 79-86): drop 3
    b.color(xm, '#1f0606', '#0f0303', { line: '#ff3b3b', obj: '#ffb08f' });
    adornos(b, xm, r(87), '#ff3b3b', { step: 5 });
    pulsos(b, r, 79, 87, '#ff3b3b', '#ffb13b', true);
    b.camzoom(xm, 1, 6, 'out');
    b.shake(xm, 7, 5);
    const m0 = R(79) + 6;
    const xs = [m0];
    for (let n = 79; n < 87; n++) for (let q = 0; q < 8; q++) {
      const x = Math.round(r(n, q / 2));
      // compases 83-86: semicorcheas en el segundo tiempo (giros de 2 bloques)
      if (n >= 83 && (q === 2 || q === 3)) {
        const x2 = Math.round(r(n, q / 2 + 0.25));
        if (x > xs[xs.length - 1]) xs.push(x);
        if (x2 > xs[xs.length - 1]) xs.push(x2);
        continue;
      }
      if (x > xs[xs.length - 1] + 1) xs.push(x);
    }
    const mEnd = R(87) - 10;
    while (xs.length && xs[xs.length - 1] > mEnd) xs.pop();
    xs.push(mEnd);
    const zz = zigzag(xs, 5, 2, 8, 1);
    const mw = b.waveCorridor(m0, 5, zz.segs, 4, 1);
    const mTop = 10;
    b.waveExit(mw.x, mTop, 3, 10, 1);
    b.portal(R(87) - 1, 1, 'cube');

    // ------------------------------------------------ N · cubo 4x (compases 87-93): final
    const xn = r(87);
    b.color(xn, '#12061f', '#08030f', { line: '#ff3b5c', obj: '#ffd08f' });
    adornos(b, xn, r.end, '#ff3b5c', { step: 5 });
    pulsos(b, r, 87, 93, '#ff3b5c', '#ffd08f', true);
    b.spikes(J4(87, 1) - 1, 3);
    b.pad(R(88), 0);
    b.spikes(R(88) + 1, 9);
    b.block(R(89) + 3, 0, 10, 1);
    b.block(R(89) + 13, 0, 10, 2);
    b.spike(J4(89, 1) + 1, 1);
    b.spike(R(89) + 19, 2);
    b.spikes(J4(90, 1) - 1, 3);
    b.orb(R(90, 3) + 1, 2, 'pink');
    b.spikes(R(90, 3) - 1, 9);
    b.spikes(J4(91, 1) - 0.5, 2);
    b.spike(J4(91, 3));
    b.spikes(J4(92, 0) - 1, 3);
    b.spike(J4(92, 2));
    b.pulse(r(93), '#ffffff', 6);
    b.shake(r(93), 4, 3);
    b.deco(R(93) + 14, 3, 'diamond', { r: 1.4, color: '#ff3b5c', beat: true });
    return b.build(r.end);
  }

  function build(H) {
    ({ Builder, rejilla, ritmo, adornos, UPS } = H);
    return abismo();
  }
  let Builder, rejilla, ritmo, adornos, UPS; // eslint-disable-line no-unused-vars
  if (typeof module !== 'undefined' && module.exports) module.exports = build;
  else (root.NIVELES = root.NIVELES || {})['abismo'] = build;
})(typeof globalThis !== 'undefined' ? globalThis : this);
