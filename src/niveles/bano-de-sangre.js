/* NEON DASH — nivel 'bano-de-sangre'. Se registra en NIVELES; levels.js lo construye con las utilidades comunes. */
(function (root) {
  'use strict';
  // ------------------------------------------------------------------ 7
  // Demonio extremo: rojo y negro, todo a 3x-4x, sincronizado con 'infernal-chaos' (140 BPM, 77 compases).
  // A 140 BPM un salto de cubo dura justo un tiempo (a 3x y a 4x), así que los saltos encadenados caen en
  // cada negra. Conserva lo que sólo sale aquí: colinas de rampas, andar por el techo con jorobas, nave por un
  // túnel inclinado, bola sobre raíles, ovni entre sierras y embudos de rampas que llevan a cada portal.
  //   A 0-2 intro · B 3-14 cubo, techo y nave · C 15 silencio · D 16-27 drop 1: onda y bola
  //   E 28-29 respiro (robot) · F 30-47 drop 2 a 4x: ovni, araña y cubo dual · G 48-53 columpio 3x
  //   H 54 respiro · I 55-62 colinas a 4x · J 63-70 nave 4x · K 71-76 final.
  // A 3x un compás son 26,7 bloques (un tiempo 6,7); a 4x 32,9 (un tiempo 8,2).

  // Pulso fuerte en cada compás y suave en cada tiempo (o a mitad si !beats).
  function pulsos(b, r, a, z, c1, c2, beats) {
    for (let n = a; n < z; n++) {
      b.pulse(r(n), c1, 4);
      if (beats) for (let t = 1; t < 4; t++) b.pulse(r(n, t), c2 || c1, 2);
      else if (c2) b.pulse(r(n, 2), c2, 2);
    }
  }

  // Colina de rampas con la cima plana (4 bloques) centrada en xs y un pincho encima si spike.
  // empinada: rampas de 1×1; si no, de 2×1 (media altura por columna).
  function colina(b, xs, h, empinada, spike) {
    const k = empinada ? 1 : 0.5, n = Math.round(h / k);
    const x0 = Math.round(xs) - 2 - n;
    b.corridor(x0, 0, null, [[n, k, 0], [5, 0, 0], [n, -k, 0]]);
    if (spike) b.spike(Math.round(xs), h);
    return x0 + 2 * n + 5;
  }

  // Joroba en el techo (andando boca abajo): el techo baja 1 bloque durante w columnas.
  function joroba(b, x, techo, w) {
    b.objects.push({ t: 'slope', x, y: techo - 1, w: 1, h: 1, dir: -1, ceil: true });
    b.block(x + 1, techo - 1, w, 1);
    b.objects.push({ t: 'slope', x: x + 1 + w, y: techo - 1, w: 1, h: 1, dir: 1, ceil: true });
  }

  // Pasillo de onda en zigzag con los giros en las x dadas (enteras); cambia de sentido si se saldría.
  function zigzag(xs, c0, lo, hi, k) {
    const segs = [];
    let c = c0, dir = 1;
    for (let i = 0; i + 1 < xs.length; i++) {
      const len = xs[i + 1] - xs[i];
      if (len <= 0) continue;
      const cabe = (d, n) => (d > 0 ? c + n * k <= hi : c - n * k >= lo);
      if (!cabe(dir, len)) dir = -dir;
      if (!cabe(dir, len)) {
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

  function banoDeSangre() {
    const T = [[0, 3], [30, 4], [48, 3], [55, 4]];
    const r = ritmo('infernal-chaos', T);
    const b = new Builder({
      id: 'bano-de-sangre',
      card: '#b3121f',
      theme: 'original',
      theme3d: 'volcan',
      name: 'Baño de Sangre',
      difficulty: 'Demonio',
      stars: 10,
      song: 'track:infernal-chaos',
      synth: 'sangre',
      bpm: r.track.bpm,
      startSpeed: T[0][1],
    });
    const R = (n, t) => Math.round(r(n, t));
    const J = (n, t) => r(n, t) + 3;          // pincho que se salta pulsando en ese tiempo (3x)
    const J4 = (n, t) => r(n, t) + 4;         // (4x)

    // ------------------------------------------------ A · intro (compases 0-2): cubo 3x
    b.color(0, '#24040a', '#120205', { line: '#ff2a3a', obj: '#ffb08f' });
    adornos(b, 0, r(3), '#ff2a3a');
    b.deco(10, 4, 'glow', { r: 5, color: '#ff2a3a', alpha: 0.6 });
    b.pulse(r(0), '#ff2a3a', 4);
    b.pulse(r(1), '#ffffff', 5);              // el golpe del compás 1
    b.shake(r(1), 4, 3);
    for (let t = 1; t < 4; t++) b.pulse(r(1, t), '#ff2a3a', 2);
    b.pulse(r(2), '#7a0a12', 4);
    b.spike(J(0, 2));
    b.spike(J(1, 0));
    b.spike(J(1, 1));                         // saltos seguidos: uno por tiempo
    b.spikes(J(1, 2) - 0.5, 2);
    colina(b, J(2, 1), 1.5, false, true);
    b.spike(J(2, 3));

    // ------------------------------------------------ B1 · colinas y orbes (compases 3-6)
    const x3 = r(3);
    b.color(x3, '#2e0610', '#170308', { line: '#ff3a2a', obj: '#ffb08f' });
    adornos(b, x3, r(7), '#ff3a2a');
    pulsos(b, r, 3, 7, '#ff3a2a', '#ff7a3a');
    colina(b, J(3, 1), 2, false, true);
    b.spike(J(3, 3));
    colina(b, J(4, 0), 2, true, true);
    b.spike(J(4, 2));
    b.spike(J(4, 3));
    colina(b, J(5, 1), 1.5, false, true);
    b.spikes(J(5, 3) - 0.5, 2);
    // foso de pinchos con tres orbes: uno por tiempo, se aterriza en el compás 7
    b.spikes(R(6) + 2, 21);
    b.orb(r(6) + 5.5, 1.4);
    b.orb(r(6) + 12.2, 1.4, 'pink');
    b.orb(r(6) + 18.4, 1.4);

    // ------------------------------------------------ B2 · al techo (compases 7-10)
    const x7 = r(7);
    b.color(x7, '#2a0614', '#14030a', { line: '#ff3b8f', obj: '#ffd08f' });
    adornos(b, x7, r(11), '#ff3b8f');
    pulsos(b, r, 7, 11, '#ff3b8f', '#ff2a5a');
    b.block(R(7) - 2, 6, R(11) - R(7), 4);
    b.pad(R(7) + 1, 0, 'blue');
    b.hint(R(7) + 1, 3.2, 'Ahora el suelo es el techo');
    b.smalls(R(7) + 3, R(10, 2) - R(7) - 3);  // el suelo de abajo no perdona
    b.spike(J(7, 2), 5, 180);
    b.spike(J(7, 3), 5, 180);
    joroba(b, R(8) + 2, 6, 4);
    b.spikes(J(8, 2) - 0.5, 2, 5, 180);
    b.spike(J(8, 3) + 0.5, 5, 180);
    joroba(b, R(9) + 6, 6, 4);
    b.spike(R(9) + 9, 4, 180);                // pincho sobre la joroba
    b.spike(J(9, 3), 5, 180);
    b.spikes(J(10, 0) - 0.5, 2, 5, 180);
    b.orb(R(10, 2) + 1, 5, 'blue');           // de vuelta al suelo
    b.spikes(R(10, 2) + 4, R(11) - 2 - R(10, 2) - 4, 5, 180);

    // ------------------------------------------------ B3 · nave 3x por un túnel inclinado (compases 11-14)
    const x11 = r(11);
    b.portal(x11, 1, 'ship', { floor: 0 });
    b.color(x11, '#1a0410', '#0d0208', { line: '#ff3b8f', obj: '#ffd08f' });
    adornos(b, x11, r(15), '#ff3b8f', { step: 5 });
    pulsos(b, r, 11, 15, '#ff3b8f', '#ff2a3a', true);
    const tun = b.corridor(R(11) + 2, 0, 6, [
      [7, 0.5, 0.5], [6, 0, 0], [7, -0.5, -0.5], [7, 0, 0],
      [7, 0, 0.5], [6, 0, 0], [7, 0, -0.5], [7, 0.25, 0.25],
      [7, 0.25, 0.25], [6, 0, 0], [7, -0.5, -0.5], [7, 0, 0.25],
      [7, 0.5, 0.25], [6, 0, 0], [6, -0.5, -0.5], [3, 0, 0]]);
    const wide = R(11) + 2 + 27 + 7;          // tramo ancho del compás 12 (suelo 0, techo 9,5)
    b.saw(wide, 2.5, 1.5);                    // pasar por arriba o por abajo
    b.saw(wide + 5, 6.5, 1.5);
    b.coin(wide + 5, 8.6);                    // MONEDA 1: entre la sierra y el techo
    b.saw(R(13, 2), 1.75 + 0.75, 1);
    b.saw(R(14, 1) + 2, 8, 1);

    // ------------------------------------------------ C · silencio (compás 15): la nave sale al vacío
    const x15 = r(15);
    b.color(tun.x, '#050102', '#020001', { line: '#4a0a10', obj: '#7a3a3a' });
    b.camzoom(x15, 0.85, r(16) - x15, 'inout');
    b.deco(R(15) + 13, 5, 'ring', { r: 3, color: '#ff2a3a', alpha: 0.4 });
    // embudo hasta la onda (hueco 3..6)
    const x16 = r(16);
    b.corridor(R(16) - 7, 0, 10, [[3, 1, -1], [1, 0, -1], [5, 0, 0]]);
    b.portal(x16, 4, 'wave', { floor: 0 });

    // ------------------------------------------------ D1 · drop 1: onda 3x (compases 16-21)
    b.color(x16, '#2a0505', '#150202', { line: '#ff5a2a', obj: '#ffd08f' });
    adornos(b, x16, r(22), '#ff5a2a', { step: 5 });
    pulsos(b, r, 16, 22, '#ff5a2a', '#ff2a3a', true);
    b.shake(x16, 6, 4);
    b.camzoom(x16, 1, 4, 'out');
    const w0 = R(16) + 3;
    const wx = [w0];
    for (let n = 16; n < 22; n++) for (let q = 0; q < 8; q++) {
      // compases pares: corcheas; impares: negras con dos corcheas al final
      if (n % 2 === 1 && q < 4 && q % 2 === 1) continue;
      const x = R(n, q / 2);
      if (x > wx[wx.length - 1] + 1) wx.push(x);
    }
    const wEnd = R(22) - 9;
    while (wx[wx.length - 1] > wEnd) wx.pop();
    wx.push(wEnd);
    const zw = zigzag(wx, 5, 2, 8, 1);
    const wc = b.waveCorridor(w0, 5, zw.segs, 4, 1);
    const pico = wc.path.reduce((a, p) => (p.x > w0 + 40 && p.x < w0 + 80 && p.c > a.c ? p : a), { c: -1 });
    b.coin(pico.x, pico.c + 0.9);             // MONEDA 2: pegada al techo en el pico más alto
    b.waveExit(wc.x, Math.min(10, Math.ceil(wc.c + 2)), 3, 10, 1);
    b.portal(R(22) - 1, 1, 'ball');

    // ------------------------------------------------ D2 · bola 3x sobre raíles (compases 22-27)
    const x22 = r(22);
    b.color(x22, '#2e0b0b', '#190505', { line: '#ff6b3d', obj: '#ffb08f' });
    adornos(b, x22, r(28), '#ff6b3d');
    pulsos(b, r, 22, 28, '#ff6b3d', '#ff2a3a', true);
    b.block(R(22) + 2, 7, R(28) - 8 - R(22) - 2, 1);   // raíl de arriba
    // un peligro cada tiempo y medio, alternando suelo (f) y techo (c); sierras en medio en los compases 25-27
    let side = 'f';
    for (let k = 0; k < 15; k++) {
      const beat = 1 + k * 1.5;
      const n = 22 + Math.floor(beat / 4), t = beat % 4;
      if (R(n, t) + 4 > R(27, 2)) break;
      const x = R(n, t) + 1;
      if (side === 'f') b.spikes(x, 3); else b.spikes(x, 3, 6, 180);
      if (n >= 25 && k % 2 === 0 && x + 8 < R(27, 2)) b.saw(x + 6, 3.5, 1);
      side = side === 'f' ? 'c' : 'f';
    }
    // embudo al suelo: unflip y robot
    b.spikes(R(27, 2), R(28) - 8 - R(27, 2), 6, 180);
    b.corridor(R(28) - 8, 0, 8, [[5, 0, -1], [6, 0, 0]]);

    // ------------------------------------------------ E · respiro (compases 28-29): robot
    const x28 = r(28);
    b.portal(x28, 1, 'robot');
    b.portal(x28 + 1.5, 1, 'unflip');   // después del portal: la bola ya no puede darse la vuelta
    b.color(x28, '#1a0a04', '#0d0502', { line: '#ffa23a', obj: '#ffd08f' });
    adornos(b, x28, r(30), '#ffa23a');
    pulsos(b, r, 28, 30, '#ffa23a');
    b.camrotate(x28, -5, r(30) - x28, 'inout');
    b.spike(R(28, 1) + 3);
    b.block(R(28, 2) + 3, 0, 3, 2);
    b.spikes(R(28, 2) + 7, 2);
    b.block(R(29) + 2, 2.5, 10, 1);           // techo bajo: sólo toques
    b.small(R(29) + 5);
    b.small(R(29) + 9);
    b.block(R(30) - 4, 3, 8, 7);              // techo sobre los portales: no se pueden saltar

    // ------------------------------------------------ F1 · drop 2: ovni 4x entre sierras (compases 30-35)
    const x30 = r(30);
    b.speed(x30, 1, 4);
    b.portal(x30 + 1, 1, 'ufo', { floor: 0 });
    b.color(x30, '#2e0b1f', '#190510', { line: '#ffb13b', obj: '#ffd08f' });
    adornos(b, x30, r(36), '#ffb13b', { step: 5 });
    pulsos(b, r, 30, 36, '#ffb13b', '#ff3b3b', true);
    b.camrotate(x30, 0, 6, 'out');
    b.shake(x30, 7, 5);
    b.pulse(x30, '#ffffff', 6);
    b.spikes(R(30) + 6, R(36) - 10 - R(30) - 6);
    b.spikes(R(30) + 6, R(36) - 10 - R(30) - 6, 9, 180);
    const sierras = [2.5, 6.5, 3, 7, 4.5, 2, 6, 3.5, 7, 5, 2.5, 6.5, 4, 2, 6, 7, 3, 5.5, 2.5, 6.5, 4];
    let si = 0;
    for (let n = 30; n < 36; n++) for (let t = 0; t < 4; t++) {
      if (n === 30 && t === 0) continue;
      if (n === 35 && t >= 2) continue;
      b.saw(R(n, t) + 2, sierras[si++ % sierras.length], t % 2 ? 1.5 : 2);
    }
    // embudo de techo hasta la araña, a ras de suelo
    b.corridor(R(36) - 10, 0, 10, [[7, 0, -1], [6, 0, 0]]);
    const x36 = r(36);
    b.portal(x36, 1, 'spider');

    // ------------------------------------------------ F2 · araña 4x (compases 36-41)
    b.color(x36, '#1f0a06', '#0f0503', { line: '#ff7a2a', obj: '#ffd08f' });
    adornos(b, x36, r(42), '#ff7a2a', { lines: 8 });
    pulsos(b, r, 36, 42, '#ff7a2a', '#ffb13b', true);
    b.block(R(36) + 3, 5, R(42) - 4 - R(36) - 3, 1);
    // un teletransporte por tiempo y, en los compases 39-41, también a contratiempo
    for (let n = 36; n < 42; n++) {
      const pat = n < 39 ? ['F', 'C', 'F', 'C'] : ['F', 'C', 'C', 'F', 'C', 'F', 'F', 'C'];
      const step = n < 39 ? 1 : 0.5;
      pat.forEach((p, i) => {
        const t = i * step;
        if (n === 36 && t < 1) return;
        if (n === 41 && t >= 2.5) return;
        const x = R(n, t) + 2;
        if (p === 'F') b.spikes(x, 2); else b.spikes(x, 2, 4, 180);
      });
    }
    b.spikes(R(41, 3) - 1, R(42) - 4 - R(41, 3) + 1, 4, 180);   // obliga a acabar abajo
    b.block(R(42) - 4, 3, 6, 5);                // techo bajo sobre los portales: nada se esquiva

    // ------------------------------------------------ F3 · cubo dual 4x (compases 42-47)
    const x42 = r(42);
    b.portal(x42, 1, 'cube');
    b.portal(x42 + 1.5, 1, 'unflip');
    b.color(x42, '#2e0606', '#190303', { line: '#ff2a3a', obj: '#ffb08f' });
    adornos(b, x42, r(48), '#ff2a3a', { step: 5 });
    pulsos(b, r, 42, 48, '#ff2a3a', '#ffffff', true);
    b.block(R(42) + 2, 8, R(48) - 4 - R(42) - 2, 2);
    b.portal(x42 + 3, 1, 'dual');
    b.pulse(x42 + 3, '#ffffff', 5);
    for (let n = 42; n < 48; n++) {
      if (n === 42) { b.spike(J4(42, 2)); b.spike(J4(42, 2), 7, 180); b.spike(J4(42, 3)); continue; }
      const v = (n - 43) % 3;
      if (v === 0) {                          // espejo, saltos encadenados
        for (const t of [0, 1, 2]) { b.spike(J4(n, t)); b.spike(J4(n, t), 7, 180); }
      } else if (v === 1) {                   // colina abajo y joroba arriba a la vez
        colina(b, J4(n, 1), 1, true, true);
        b.spike(J4(n, 1), 7, 180);
        b.spikes(J4(n, 3) - 0.5, 2, 7, 180);
      } else {                                // pinchos alternos: uno abajo, uno arriba
        b.spike(J4(n, 0));
        b.spike(J4(n, 1), 7, 180);
        b.spikes(J4(n, 2) - 0.5, 2);
        if (n < 47) b.spike(J4(n, 3), 7, 180);
      }
    }
    b.portal(R(48) - 3, 1, 'single');

    // ------------------------------------------------ G · columpio 3x (compases 48-53)
    const x48 = r(48);
    b.speed(x48, 1, 3);
    b.portal(x48 + 1, 1, 'swing', { floor: 0 });
    b.color(x48, '#14020a', '#0a0105', { line: '#ff3b8f', obj: '#ffd08f' });
    adornos(b, x48, r(54), '#ff3b8f', { step: 6 });
    b.pulse(x48, '#7a0a2a', 4);
    pulsos(b, r, 49, 54, '#ff3b8f', '#ff2a3a', true);
    b.shake(r(49), 4, 3);
    b.camzoom(x48, 0.9, r(49) - x48, 'inout');
    b.camzoom(r(49), 1, 4, 'out');
    for (let n = 49; n < 54; n++) {
      if (n % 2) { b.block(R(n), 0, 2, 4); b.saw(R(n, 1) + 1, 7.5, 1.5); b.block(R(n, 2), 6, 2, 4); b.saw(R(n, 3) + 1, 2.5, 1.5); }
      else { b.block(R(n), 6, 2, 4); b.saw(R(n, 1) + 1, 2.5, 1.5); b.block(R(n, 2), 0, 2, 4); b.saw(R(n, 3) + 1, 7.5, 1.5); }
    }
    b.corridor(R(54) - 8, 0, 10, [[7, 0, -1], [5, 0, 0]]);
    b.portal(R(54) - 1, 1, 'unflip');
    const x54 = r(54);
    b.portal(x54, 1, 'cube');

    // ------------------------------------------------ H · respiro (compás 54): cubo 3x
    b.color(x54, '#1a0206', '#0d0103', { line: '#ff2a3a', obj: '#ffb08f' });
    b.pulse(x54, '#7a0a12', 4);
    b.camzoom(x54, 0.92, r(55) - x54, 'inout');
    b.spike(J(54, 1) + 1);
    b.spike(J(54, 2) + 1);

    // ------------------------------------------------ I · colinas a 4x (compases 55-62)
    const x55 = r(55);
    b.speed(x55, 1, 4);
    b.color(x55, '#2e040a', '#170205', { line: '#ff2a3a', obj: '#ffb08f' });
    adornos(b, x55, r(63), '#ff2a3a', { step: 5 });
    pulsos(b, r, 55, 63, '#ff2a3a', '#ff7a3a', true);
    b.camzoom(x55, 1, 6, 'out');
    b.shake(x55, 6, 4);
    for (let n = 55; n < 63; n++) {
      const v = (n - 55) % 4;
      if (v === 0) {                          // colina con pincho y dos saltos seguidos
        colina(b, J4(n, 0), 2, false, true);
        b.spike(J4(n, 2));
        b.spike(J4(n, 3));
      } else if (v === 1) {                   // pad y orbe sobre un foso
        b.pad(R(n), 0);
        b.spikes(R(n) + 1, 18);
        b.orb(R(n) + 9.5, 2);
      } else if (v === 2) {                   // colina empinada y triple pincho
        colina(b, J4(n, 1), 2, true, true);
        b.spikes(J4(n, 3) - 1, 3);
      } else {                                // escalones con pinchos encima
        b.block(R(n) + 4, 0, 9, 1);
        b.block(R(n) + 13, 0, 9, 2);
        b.spike(J4(n, 1) + 1, 1);
        b.spike(J4(n, 2) + 2, 2);
      }
    }
    // embudo para la nave (techo a 3 sobre el portal)
    b.block(R(63) - 3, 3, 6, 7);

    // ------------------------------------------------ J · nave 4x (compases 63-70)
    const x63 = r(63);
    b.portal(x63, 1, 'ship', { floor: 0 });
    b.color(x63, '#1a0410', '#0d0208', { line: '#ff3b8f', obj: '#ffd08f' });
    adornos(b, x63, r(71), '#ff3b8f', { step: 5 });
    pulsos(b, r, 63, 71, '#ff3b8f', '#ffb13b', true);
    let jt = b.corridor(R(63) + 4, 0, 10, [[8, 0, -0.5]]);          // techo a 6
    const JP = [[8, 0.5, 0.5], [8, 0, 0], [8, -0.5, -0.5], [9, 0, 0]];
    const JQ = [[8, 0, 0.5], [8, 0, 0], [8, 0, -0.5], [9, 0, 0]];
    const j0 = jt.x;
    jt = b.corridor(jt.x, jt.f, jt.c, [].concat(JP, JQ, JP, JP, JQ, JP, JP));
    for (let i = 0; i < 7; i++) {
      const x = j0 + i * 33;
      if (i === 1 || i === 4) {               // tramo ancho (techo a 10): dos sierras
        b.saw(x + 8, 2.5, 1.5);
        b.saw(x + 13, 7, 1.5);
        if (i === 4) b.coin(x + 13, 9);       // MONEDA 3: sobre la sierra, contra el techo
      } else {
        b.saw(x + 10, 4 + 0.25, 1);          // en lo alto: sierra en el suelo
        b.saw(x + 27, 5.75, 1);              // en lo bajo: sierra en el techo
      }
    }
    // de vuelta al suelo
    jt = b.corridor(jt.x, jt.f, jt.c, [[6, 0, -0.5], [Math.max(3, R(71) + 2 - jt.x - 6), 0, 0]]);
    const x71 = r(71);
    b.portal(x71, 1, 'cube');

    // ------------------------------------------------ K · final (compases 71-76)
    b.color(x71, '#24040a', '#120205', { line: '#ff2a3a', obj: '#ffb08f' });
    adornos(b, x71, r.end, '#ff2a3a', { step: 5 });
    pulsos(b, r, 71, 76, '#ff2a3a', '#ffffff', true);
    b.shake(x71, 5, 3);
    colina(b, J4(71, 1) + 1, 1.5, false, true);
    b.spike(J4(71, 3));
    b.spikes(J4(72, 0) - 1, 3);
    b.pad(R(72, 2), 0);
    b.spikes(R(72, 2) + 1, 10);
    b.spikes(J4(73, 0) - 1, 3);
    colina(b, J4(73, 2), 2, true, true);
    b.spike(J4(74, 0));
    b.spike(J4(74, 1));
    b.spike(J4(74, 2));
    b.spikes(J4(75, 0) - 1, 3);
    colina(b, J4(75, 2), 1.5, false, true);
    b.pulse(r(76), '#ffffff', 6);
    b.shake(r(76), 4, 3);
    b.color(R(76), '#120205', '#090102', { line: '#ff2a3a', obj: '#ffb08f' });
    b.deco(R(76) + 12, 3, 'diamond', { r: 1.4, color: '#ff2a3a', beat: true });
    return b.build(r.end);
  }

  function build(H) {
    ({ Builder, rejilla, ritmo, adornos, UPS } = H);
    return banoDeSangre();
  }
  let Builder, rejilla, ritmo, adornos, UPS; // eslint-disable-line no-unused-vars
  if (typeof module !== 'undefined' && module.exports) module.exports = build;
  else (root.NIVELES = root.NIVELES || {})['bano-de-sangre'] = build;
})(typeof globalThis !== 'undefined' ? globalThis : this);
