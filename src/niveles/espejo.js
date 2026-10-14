/* NEON DASH — nivel 'espejo'. Se registra en NIVELES; levels.js lo construye con las utilidades comunes. */
(function (root) {
  'use strict';
  // ------------------------------------------------------------------ 5
  // Espejo, sobre "Neon Sunset Drive" (120 BPM, synthwave). Todo se refleja: frases de bola que se repiten
  // en espejo (lo de abajo pasa arriba), un respiro boca abajo bajo el techo, una BOLA DOBLE con un gemelo
  // reflejado y una onda que invierte la gravedad (y los controles) cada dos compases.
  // La canción cambia poco de volumen (energía de tracks.js, umbral de 2-3 dB y frases de 8 compases):
  // intro 0-7 · bola 8-15 · onda mini 16-23 (sube en 22-23) · respiro 24-29 (-4 dB) · subida 30-31 ·
  // estribillo 32-39 · estribillo fuerte 40-47 (46-47 al máximo) · final 48-56.
  function espejo() {
    const r = ritmo('neon-sunset-drive', [[0, 2], [24, 1], [30, 2], [32, 3]]);
    const b = new Builder({
      id: 'espejo',
      card: '#8a5cff',
      theme: 'original',
      theme3d: 'atardecer',
      name: 'Espejo',
      difficulty: 'Difícil',
      stars: 6,
      song: 'track:neon-sunset-drive',
      synth: 'espejo',
      bpm: r.track.bpm,
      startSpeed: 2,
    });

    // Pincho que se salta justo en el tiempo (bar, beat) a la velocidad v.
    const OFF = { 1: 1.5, 2: 2, 3: 2.5 };
    const J = (v, bar, beat) => r(bar, beat) + OFF[v];
    const latir = (b0, b1, c1, c2) => {
      for (let k = b0; k < b1; k++) {
        b.pulse(r(k), c1, 4);
        if (c2) for (let q = 1; q < 4; q++) b.pulse(r(k, q), c2, 2);
      }
    };
    // Onda en diente de sierra que cambia de sentido en las marcas; si un tramo no cabe, rebota en el borde.
    const ondaRitmo = (x0, y0, marks, gap, k, cmin, cmax, dir0) => {
      const segs = [];
      let c = y0, dir = dir0 || 1, prev = x0;
      for (const m of marks) {
        const len = Math.round(m - prev);
        if (len <= 0) continue;
        prev += len;
        const fits = (d, n) => c + d * k * n <= cmax && c + d * k * n >= cmin;
        if (!fits(dir, len)) dir = -dir;
        if (fits(dir, len)) { segs.push([len, dir]); c += dir * k * len; }
        else {
          dir = cmax - c >= c - cmin ? 1 : -1;
          let rest = len;
          while (rest > 0) {
            let room = Math.floor((dir > 0 ? cmax - c : c - cmin) / k);
            if (room <= 0) { dir = -dir; room = Math.floor((dir > 0 ? cmax - c : c - cmin) / k); }
            const n = Math.min(rest, room);
            segs.push([n, dir]);
            c += dir * k * n;
            rest -= n;
            if (rest > 0) dir = -dir;
          }
        }
        dir = -dir;
      }
      return b.waveCorridor(x0, y0, segs, gap, k);
    };
    // Salida de la onda: el techo baja hasta 3 y sigue plano hasta xEnd (el portal siguiente no se esquiva).
    const bajarTecho = (x, ceil, step, xEnd) => {
      let c = ceil;
      while (c > 3) {
        const h = Math.min(step, c - 3);
        b.slope(x, c - h, 1, h, -1);
        b.objects[b.objects.length - 1].ceil = true;
        if (c < 10) b.block(x, c, 1, 10 - c);
        c -= h;
        x++;
      }
      b.block(x, 3, Math.max(1, Math.ceil(xEnd - x)), 7);
    };
    // Bola entre suelo y techo: por tiempo, 'f' = pinchos abajo (ir arriba), 't' = pinchos arriba (ir abajo),
    // 's' = sierra en el lado donde va la bola (hay que cambiar), '.' = nada. techo = fila del techo.
    const bola = (bar0, pat, v, techo) => {
      let up = false;
      for (let i = 0; i < pat.length; i++) {
        const x = r(bar0 + Math.floor(i / 4), i % 4) + OFF[v];
        if (pat[i] === 'f') { b.spikes(x, 3); up = true; }
        else if (pat[i] === 't') { b.spikes(x, 3, techo - 1, 180); up = false; }
        else if (pat[i] === 's') { b.saw(x + 1, up ? techo - 1.5 : 0.5, 1.2); up = !up; }
      }
    };
    // El reflejo de una frase de bola: lo de abajo pasa arriba.
    const reflejo = (pat) => pat.replace(/[ft]/g, (ch) => (ch === 'f' ? 't' : 'f'));

    // ================================================================ A · intro (compases 0-7): cubo a 2x
    b.color(0, '#2a1450', '#180a30', { line: '#ff9ae0', obj: '#ffb36a' });
    adornos(b, 0, r(8), '#ff9ae0', { lines: 8.5 });
    // el sol del atardecer al fondo, que baja despacio durante la intro (grupo 1, sólo decorado)
    b.inGroup(1, () => {
      b.deco(r(1), 7, 'glow', { r: 6, color: '#ff7a5a', alpha: 0.6, par: 0.1 });
      b.deco(r(1), 7, 'ring', { r: 4, color: '#ffd0a0', alpha: 0.5, par: 0.1 });
    });
    b.move(r(0), 1, 0, -2, r(8) - r(0), 'inout');
    b.hint(5, 3.4, 'Salta con el ritmo');
    b.spike(J(2, 0, 2));
    b.spike(J(2, 1, 0));
    b.spikes(J(2, 1, 2) - 0.5, 2);
    // compases 2-3: rampa a la autopista, una sierra encima y bajada
    b.slope(r(2) + 1, 0, 2, 1, 1);
    b.block(r(2) + 3, 0, 14, 1);
    b.saw(J(2, 2, 2) + 0.5, 1);
    b.slope(r(2) + 17, 0, 2, 1, -1);
    b.spikes(J(2, 3, 2) - 0.5, 2);
    // compases 4-7: orbe verde al techo y paseo boca abajo (pinchos colgando a cada tiempo fuerte)
    b.pulse(r(4), '#ffd0a0', 4);
    const t0 = r(4) + 2, t1 = r(7, 3) + 1;
    b.block(t0, 6, t1 - t0, 1);
    b.hint(r(4) + 2, 4.4, 'Salta y vuelve a pulsar sobre el orbe');
    b.spike(J(2, 4, 0));
    b.orb(r(4, 1) + 2.5, 2.5, 'green');
    b.smalls(Math.round(r(4, 1) + 5), Math.round(r(7, 3) + 2 - r(4, 1) - 5));
    b.spike(J(2, 5, 0), 5, 180);
    b.spikes(J(2, 5, 2) - 0.5, 2, 5, 180);
    b.spike(J(2, 6, 0), 5, 180);
    b.spike(J(2, 6, 2), 5, 180);
    b.spikes(J(2, 7, 0) - 0.5, 2, 5, 180);
    b.portal(r(7, 3) - 2, 3.5, 'unflip');     // colgado del techo: no se puede saltar por encima

    // ================================================================ B · bola (compases 8-15), frases en espejo
    const xb = r(8);
    b.portal(xb, 1, 'ball');
    b.color(xb, '#4a1450', '#2c0a30', { line: '#ffd6ef', obj: '#ff7ad8' });
    adornos(b, xb, r(16), '#ffd6ef');
    latir(8, 16, '#ffd6ef');
    b.block(xb + 2, 7, r(16) - xb - 10, 1);  // techo a 7
    const fb1 = '.f.t' + 'f.tf';
    const fb2 = 'ftf.' + 't.fs';
    bola(8, fb1, 2, 7);
    bola(10, reflejo(fb1), 2, 7);
    bola(12, fb2, 2, 7);
    bola(14, reflejo(fb2).slice(0, 6), 2, 7);
    // moneda 1: en el centro, en un tiempo libre (hay que cruzar y volver)
    b.coin(r(9, 1) + 3, 3);
    // embudo hacia la onda mini
    b.corridor(r(16) - 8, 0, 7, [[4, 0, -1], [6, 0, 0]]);
    b.portal(r(16) - 2, 1, 'unflip');          // la bola puede salir por el techo: la onda empieza siempre derecha

    // ================================================================ C · onda mini (compases 16-23)
    const xc = r(16), xd = r(24);
    b.portal(xc, 1, 'wave');
    b.portal(xc + 1, 1, 'mini');
    b.color(xc, '#14365e', '#0a1f3a', { line: '#ccf6ff', obj: '#5ae8ff' });
    adornos(b, xc, xd, '#ccf6ff', { step: 5 });
    latir(16, 24, '#ccf6ff', '#5ab0ff');
    b.hint(xc + 3, 8.4, 'Onda mini: el doble de empinada');
    {
      // a corcheas; en los compases 22-23 (la subida) a semicorcheas
      const mm = [];
      for (let k = 16; k < 24; k++) for (let q = 0.5; q <= 4; q += k >= 22 ? 0.25 : 0.5) mm.push(r(k, q));
      const w = ondaRitmo(Math.round(xc) + 3, 3, mm.filter((m) => m > xc + 4 && m < xd - 8), 4, 2, 2, 8);
      // moneda 2: en un pico, pegada al techo
      const picos = w.path.filter((p, i, a) => i > 30 && i < a.length - 1 && a[i - 1].c < p.c && a[i + 1].c <= p.c && p.c >= 6);
      const pico = picos[Math.floor(picos.length / 3)];
      b.coin(pico.x + 0.5, pico.c + 1.4);
      bajarTecho(w.x, w.c + 2, 2, xd + 3);
    }

    // ================================================================ D · respiro (compases 24-29) a 1x, boca abajo
    // Un espejo de agua: el cubo cruza un portal de gravedad y camina bajo el techo; abajo, su reflejo.
    b.portal(xd - 1, 1, 'big');
    b.portal(xd, 1, 'cube');
    b.speed(xd, 1, 1);
    b.color(xd, '#1e1240', '#120a28', { line: '#b8a8ff', obj: '#b8a8ff' });
    latir(24, 30, '#b8a8ff');
    b.camzoom(xd, 0.8, 10);
    b.camoffset(xd, 0, 1.5, 10);
    b.camzoom(r(29, 2), 1, 8);
    b.camoffset(r(29, 2), 0, 0, 8);
    const xe = r(30);
    const c0 = Math.round(r(24, 2)), c1 = Math.round(r(29, 2));
    b.block(Math.round(xd) + 3, 5, c1 + 2 - Math.round(xd) - 3, 1);
    b.portal(r(24, 1) + 1, 1, 'flip');
    b.smalls(c0 + 2, c1 - c0 - 3);
    // pinchos colgando del techo (para el cubo invertido son pinchos de suelo), pocos y en los tiempos 1
    for (const [bar, beat, n] of [[25, 0, 1], [26, 0, 1], [26, 2, 2], [27, 0, 1], [28, 0, 2], [28, 2, 1]]) b.spikes(J(1, bar, beat) - (n - 1) / 2, n, 4, 180);
    b.portal(c1 - 1, 3.5, 'unflip');
    // reflejos en el agua: anillos y rombos que se encienden al compás (grupo 2)
    b.inGroup(2, () => {
      for (let k = 25; k < 29; k++) b.deco(r(k, 2), 2.5, 'diamond', { r: 0.6, color: '#b8a8ff', beat: true });
    });
    b.alpha(0, 2, 0, 0);
    b.alpha(r(24, 2), 2, 0.8, 10);
    b.alpha(r(29), 2, 0, 6);
    b.deco(r(26), 8, 'glow', { r: 7, color: '#ff7a5a', alpha: 0.45, par: 0.1 });

    // ================================================================ E · subida (compases 30-31) a 2x
    b.speed(xe, 1, 2);
    b.color(xe, '#3a1450', '#220a30', { line: '#ffffff', obj: '#ffd23a' });
    b.pulse(xe, '#ffffff', 5);
    for (let q = 0; q < 8; q++) b.pulse(r(30, q), q % 2 ? '#ff9ae0' : '#ffffff', 2);
    b.spike(J(2, 30, 1));
    b.spikes(r(30, 2) + 1, 10);
    b.orb(r(30, 2) + 2.5, 2.5);
    b.orb(r(30, 3) + 2.5, 2.5);
    b.spike(J(2, 31, 1) + 1);
    b.spikes(J(2, 31, 2) + 1.5, 2);

    // ================================================================ F · estribillo (compases 32-39): BOLA DOBLE
    // El gemelo va en el techo y cambia a la vez, en espejo: pinchos arriba y abajo a la vez = cruzar en ese
    // tiempo; sierra en el centro = no cruzar.
    const xf = r(32), xg = r(40);
    b.speed(xf, 1, 3);
    b.portal(xf, 1, 'ball');
    b.portal(xf, 1, 'dual');
    b.shake(xf, 6, 3);
    b.color(xf, '#5a1440', '#360a26', { line: '#ffb0e0', obj: '#ff5ab0' });
    adornos(b, xf, xg, '#ffb0e0', { step: 5 });
    latir(32, 40, '#ffb0e0', '#ff5a9a');
    b.hint(xf + 4, 4.5, 'Doble: tu reflejo cambia contigo');
    b.camzoom(xf, 0.9, 6);
    {
      const pat = '..x.' + 'x.xs' + 'x..x' + 's.x.' + 'x.x.' + 'xsx.' + 'x.xx' + 's...';
      for (let i = 0; i < pat.length; i++) {
        const x = r(32 + Math.floor(i / 4), i % 4) + 3;
        if (pat[i] === 'x') { b.spikes(x, 2); b.spikes(x, 2, 7, 180); }
        else if (pat[i] === 's') b.saw(x + 0.5, 3.5, 1.6);
      }
    }
    // portal único a ras de suelo, tras un embudo simétrico (los dos a 1,5 bloques del centro)
    b.corridor(Math.round(r(39, 2)), 0, 8, [[2, 1, -1], [Math.round(xg) - Math.round(r(39, 2)) - 2, 0, 0]]);
    b.portal(Math.round(r(39, 3)) + 1, 3.5, 'single');
    b.portal(Math.round(xg) - 2, 3.5, 'unflip');

    // ================================================================ G · estribillo fuerte (compases 40-47): onda a 3x
    // Cada dos compases, una puerta invierte la gravedad: los controles se dan la vuelta.
    b.portal(xg, 3.5, 'wave');
    b.color(xg, '#14284e', '#0a1630', { line: '#9ae0ff', obj: '#9ae0ff' });
    adornos(b, xg, r(48), '#9ae0ff', { step: 5 });
    latir(40, 48, '#9ae0ff', '#5a9aff');
    b.shake(xg, 4, 2);
    b.camrotate(r(42), 3, 6);
    b.camrotate(r(44), -3, 6);
    b.camrotate(r(46), 3, 6);
    b.camrotate(r(48), 0, 6);
    {
      // tramos de onda unidos por puertas estrechas (3 filas) con el portal de gravedad
      const puertas = [[42, 'flip'], [44, 'unflip'], [46, 'flip'], [47, 'unflip']];
      let x = Math.round(xg) + 2, c = 4;
      b.block(x - 2, 0, 2, 2); b.block(x - 2, 6, 2, 4);  // la entrada sigue el embudo
      let desde = 40;
      for (const [bar, kind] of puertas) {
        const xp = Math.round(r(bar));
        // cambios de sentido a corcheas
        const mm = [];
        for (let q = desde * 4 + 0.5; q < bar * 4; q += 0.5) mm.push(r(0, q));
        const w = ondaRitmo(x, c, mm.filter((m) => m > x + 2 && m < xp - 4), 4, 1, 2, 8);
        if (kind === 'unflip' && bar === 44) {
          // moneda 3: en un pico del tramo invertido (controles al revés), pegada al techo
          const picos = w.path.filter((p, i, a) => i > 0 && i < a.length - 1 && a[i - 1].c < p.c && a[i + 1].c <= p.c && p.c >= 6);
          const pico = picos[Math.floor(picos.length / 2)];
          b.coin(pico.x + 0.5, pico.c + 1.4);
        }
        // del final del tramo hasta la puerta: el pasillo vuelve al centro de la puerta
        const cc = Math.round(w.c);
        const back = [];
        let cx = w.c;
        while (Math.abs(cx - cc) > 0.01) { const d = cc > cx ? 1 : -1; back.push([1, d]); cx += d; }
        let xx = w.x;
        if (back.length) xx = b.waveCorridor(w.x, w.c, back, 4, 1).x;
        // puerta: tres columnas de 3 filas centradas en cc (desde xx hasta la x de la puerta)
        const gl = Math.max(3, xp + 2 - xx);
        b.block(xx, 0, gl, cc - 1.5);
        b.block(xx, cc + 1.5, gl, 10 - cc - 1.5);
        b.portal(xx + gl - 2, cc - 0.5, kind);
        b.pulse(xx + gl - 2, '#ffffff', 3);
        x = xx + gl; c = cc; desde = bar;
      }
      // al centro y salida a la bola del compás 48 (techo bajo y portal a ras de suelo)
      const xh0 = Math.round(r(48));
      const fin = b.waveCorridor(x, c, [[Math.round(c - 3), -1]], 4, 1);
      bajarTecho(fin.x, fin.c + 2, 1, xh0 + 2);
    }

    // ================================================================ H · final (compases 48-56)
    // H1 (48-51): bola a 3x, la última frase y su reflejo
    const xh = r(48), xh2 = r(52), xz = r(56);
    b.portal(xh, 1, 'ball');
    b.color(xh, '#5a1430', '#360a1c', { line: '#ffc0a0', obj: '#ff7a5a' });
    adornos(b, xh, xh2, '#ffc0a0', { step: 5 });
    latir(48, 52, '#ffc0a0', '#ff7a3a');
    b.shake(xh, 5, 2);
    b.block(xh + 3, 6, Math.round(xh2) - 8 - xh - 3, 2);
    const fh = '.f.t' + 'fsf.';
    bola(48, fh, 3, 6);
    bola(50, reflejo(fh).slice(0, 7), 3, 6);
    b.corridor(Math.round(xh2) - 8, 0, 6, [[3, 0, -1], [6, 0, 0]]);
    b.portal(Math.round(xh2) - 2, 1, 'unflip');
    // H2 (52-55): onda a 3x, dos compases y su reflejo exacto
    b.portal(xh2, 1, 'wave');
    b.color(xh2, '#24145e', '#140a3a', { line: '#d0b0ff', obj: '#b08aff' });
    adornos(b, xh2, xz, '#d0b0ff', { step: 5 });
    latir(52, 56, '#d0b0ff', '#8a5aff');
    {
      const mm = [];
      for (let k = 52; k < 56; k++) for (let q = 0.5; q <= 4; q += 0.5) mm.push(r(k, q));
      const w = ondaRitmo(Math.round(xh2) + 2, 3, mm.filter((m) => m > xh2 + 3 && m < xz - 8), 4, 1, 2, 8);
      bajarTecho(w.x, w.c + 2, 1, xz + 2);
    }
    // compás 56: cubo y fin, con el sol que se pone
    b.portal(xz, 1, 'cube');
    b.color(xz, '#2a1450', '#180a30', { line: '#ff9ae0', obj: '#ffb36a' });
    b.pulse(xz, '#ffd0a0', 6);
    b.spike(J(3, 56, 1) + 1);
    b.inGroup(3, () => b.deco(xz + 10, 6, 'glow', { r: 6, color: '#ff7a5a', alpha: 0.7, par: 0.1 }));
    b.move(xz, 3, 0, -4, r.end - xz, 'inout');
    return b.build(r.end);
  }

  function build(H) {
    ({ Builder, rejilla, ritmo, adornos, UPS } = H);
    return espejo();
  }
  let Builder, rejilla, ritmo, adornos, UPS; // eslint-disable-line no-unused-vars
  if (typeof module !== 'undefined' && module.exports) module.exports = build;
  else (root.NIVELES = root.NIVELES || {})['espejo'] = build;
})(typeof globalThis !== 'undefined' ? globalThis : this);
