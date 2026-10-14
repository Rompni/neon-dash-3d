/* NEON DASH — nivel 'fase-doble'. Se registra en NIVELES; levels.js lo construye con las utilidades comunes. */
(function (root) {
  'use strict';
  // ------------------------------------------------------------------ 3
  // Fase Doble, sobre "Crystal Shatter" (150 BPM). Cristales que se parten en dos: intro de cubo, una subida
  // con pads, orbes y bola, el primer drop en onda, una nave corta, el gran drop en ONDA DOBLE (un gemelo en
  // espejo en el techo) y nave a 3x, bola y onda mini en el último drop, y un final tranquilo.
  // Secciones según la energía de tracks.js: intro 0-7 · subida 8-14 · drop 15-23 · respiro 24-26 ·
  // drop 27-29 · respiro 30 · gran drop 31-45 · respiro 46 · drop 47-61 · final 62-69.
  function faseDoble() {
    const r = ritmo('crystal-shatter', [[0, 1], [8, 2], [31, 3], [62, 2]]);
    const b = new Builder({
      id: 'fase-doble',
      card: '#e8334f',
      theme: 'original',
      theme3d: 'cristales',
      name: 'Fase Doble',
      difficulty: 'Difícil',
      stars: 6,
      song: 'track:crystal-shatter',
      synth: 'fase',
      bpm: r.track.bpm,
      startSpeed: 1,
    });

    // Pincho que se salta justo en el tiempo (bar, beat): el cubo pasa por encima a mitad del salto.
    const OFF = { 1: 1.5, 2: 2, 3: 2.5 };
    const J = (v, bar, beat) => r(bar, beat) + OFF[v];
    // Pulsos en cada compás de un tramo y, si se da c2, también en los otros tres tiempos.
    const latir = (b0, b1, c1, c2) => {
      for (let k = b0; k < b1; k++) {
        b.pulse(r(k), c1, 4);
        if (c2) for (let q = 1; q < 4; q++) b.pulse(r(k, q), c2, 2);
      }
    };

    // Onda por un pasillo en diente de sierra que cambia de sentido en las marcas (x de los tiempos).
    // Alterna el sentido sin salirse de [cmin, cmax]; devuelve lo mismo que waveCorridor.
    const ondaRitmo = (x0, y0, marks, gap, k, cmin, cmax) => {
      const segs = [];
      let c = y0, dir = 1, prev = x0;
      for (const m of marks) {
        const len = Math.round(m - prev);
        if (len <= 0) continue;
        prev += len;
        const fits = (d, n) => c + d * k * n <= cmax && c + d * k * n >= cmin;
        if (!fits(dir, len)) dir = -dir;
        if (fits(dir, len)) { segs.push([len, dir]); c += dir * k * len; }
        else {
          // tramo más largo que el pasillo: sube (o baja) hasta el borde y rebota antes del tiempo
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
    // Salida de la onda: el techo baja (step filas por columna) hasta 3 y sigue plano hasta xEnd,
    // para que el portal siguiente (a ras de suelo) no se pueda esquivar.
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
    // Túnel de nave: hueco `gap`, el suelo y el techo se desplazan `d` filas en cada marca con una rampa de
    // 4 columnas. steps = [[x, d], ...]. Al final baja al suelo y estrecha el techo a 3 hasta xEnd.
    const tunelNave = (x0, f0, gap, steps, xEnd) => {
      const segs = [];
      let x = x0, f = f0;
      for (const [m, d] of steps) {
        const flat = Math.round(m) - x;
        if (flat > 0) { segs.push([flat, 0, 0]); x += flat; }
        if (d) { segs.push([4, d / 4, d / 4]); x += 4; f += d; }
      }
      while (f > 0) { const d = Math.min(2, f); segs.push([4, -d / 4, -d / 4]); x += 4; f -= d; }
      const flat = Math.round(xEnd) - x - 8;
      if (flat > 0) segs.push([flat, 0, 0]);
      segs.push([4, 0, (3 - gap) / 4], [4, 0, 0]);
      return b.corridor(x0, f0, f0 + gap, segs);
    };

    // ================================================================ A · intro (compases 0-7), cubo a 1x
    b.color(0, '#1a0f2e', '#100820', { line: '#ff9ad0', obj: '#ff6fb5' });
    adornos(b, 0, r(8), '#ff9ad0', { step: 8 });
    // un gran cristal que gira despacio al fondo (decorado del grupo 1)
    b.inGroup(1, () => {
      b.deco(r(2), 6.5, 'diamond', { r: 2.2, color: '#ff9ad0', alpha: 0.7 });
      b.deco(r(2), 6.5, 'ring', { r: 3.2, color: '#ffd0ea', alpha: 0.5 });
    });
    b.rotate(r(0), 1, 360, r(4) - r(0), 'linear');
    b.rotate(r(4), 1, 360, r(8) - r(4), 'linear');
    b.hint(6, 3.4, 'Salta con la música');
    // compases 0-1: casi en silencio
    b.spike(J(1, 0, 2));
    b.spike(J(1, 1, 0));
    b.spikes(J(1, 1, 2) - 0.5, 2);
    // compases 2-3 (+6 dB): escalones de cristal
    b.pulse(r(2), '#ffd0ea', 4);
    b.block(r(2) + 2, 0, 6, 1);
    b.spikes(r(2, 2) + 2, 2);
    b.block(r(2, 2) + 4, 0, 3, 1);
    b.spike(J(1, 3, 1) + 1);
    b.spikes(J(1, 3, 3) - 0.5, 2);
    // compases 4-5: vuelve la calma
    b.spike(J(1, 4, 0));
    b.small(J(1, 4, 2) + 0.5);
    b.spike(J(1, 5, 0));
    b.spike(J(1, 5, 2));
    // compases 6-7: escalera y la primera moneda (un orbe opcional sobre los pinchos lanza hasta ella)
    b.pulse(r(6), '#ffd0ea', 4);
    b.block(r(6) + 2, 0, 3, 1);
    b.block(r(6, 1) + 2, 0, 3, 2);
    b.spikes(r(6, 1) + 5, 3);
    b.orb(r(6, 1) + 6.5, 4.2);
    b.coin(r(6, 1) + 9.5, 6.4);
    b.spike(J(1, 7, 1) + 1);
    b.spikes(J(1, 7, 3) - 0.5, 2);

    // ================================================================ B · subida (compases 8-14)
    // B1 (8-11): cubo a 2x, pads y orbes sobre los tiempos
    const xb = r(8);
    b.speed(xb, 1, 2);
    b.color(xb, '#2a0f24', '#1a0816', { line: '#ffb36a', obj: '#ffc15a' });
    adornos(b, xb, r(15), '#ffb36a', { lines: 8 });
    latir(8, 15, '#ffb36a');
    b.spike(J(2, 8, 1));
    b.spikes(J(2, 8, 3) - 0.5, 2);
    // pad en el tiempo 1 del compás 9 sobre un foso de pinchos
    b.pad(r(9, 1), 0, 'yellow');
    b.spikes(r(9, 1) + 1, 6);
    b.block(r(9, 1) + 7, 0, 4, 1);
    b.spike(J(2, 9, 3) + 1);
    // compás 10 (+4 dB): orbes encadenados sobre un foso
    b.spikes(r(10) + 1, 10);
    b.orb(r(10, 0) + 3, 2.5);
    b.orb(r(10, 1) + 3, 2.5);
    b.block(r(10, 2) + 2, 0, 8, 1);
    b.spike(J(2, 11, 1) + 1);
    b.spikes(J(2, 11, 2) + 1.5, 2);
    // B2 (12-14): bola a 2x, tensión antes del drop
    const xb2 = r(12);
    b.portal(xb2, 1, 'ball');
    b.color(xb2, '#2e1030', '#1c081e', { line: '#ff8af0', obj: '#ff8af0' });
    b.block(xb2 - 2, 7, r(15) - xb2 - 4, 1);  // techo a 7: la bola cambia más rápido
    b.spikes(J(2, 12, 1), 3);
    b.spikes(J(2, 12, 3), 3, 6, 180);
    b.spikes(J(2, 13, 1), 3);
    b.spikes(J(2, 13, 2) + 1, 2, 6, 180);
    b.spikes(J(2, 13, 3) + 1, 2);
    b.saw(r(14, 1), 3.5, 1.4);
    b.spikes(J(2, 14, 2), 3, 6, 180);
    // embudo hacia el portal de onda (el techo baja a 3)
    b.corridor(r(15) - 6, 0, 7, [[4, 0, -1], [4, 0, 0]]);
    b.portal(r(15) - 1, 1, 'unflip');          // la bola puede salir por el techo: la onda empieza siempre derecha

    // ================================================================ C · drop 1 (compases 15-23): onda a 2x
    const xc = r(15);
    b.portal(xc, 1, 'wave');
    b.shake(xc, 5, 3);
    b.color(xc, '#0b1e3a', '#06122a', { line: '#6ae0ff', obj: '#6ae0ff' });
    adornos(b, xc, r(24), '#6ae0ff', { step: 5 });
    latir(15, 24, '#6ae0ff', '#2a8cff');
    b.hint(xc + 3, 8.6, 'Onda: mantén para subir');
    // cambios de sentido a negras y, en los compases pares, a corcheas al final del compás
    const xd = r(24);
    const mc = [];
    for (let k = 15; k < 24; k++) {
      mc.push(r(k, 1), r(k, 2));
      if (k % 2 === 0) mc.push(r(k, 2.5), r(k, 3), r(k, 3.5));
      else mc.push(r(k, 3));
      mc.push(r(k + 1));
    }
    const wc = ondaRitmo(xc + 3, 3, mc.filter((m) => m > xc + 4 && m < xd - 10), 4, 1, 2, 8);
    // moneda 2: en un pico del pasillo, pegada al techo (hay que apurar la subida)
    const picos = wc.path.filter((p, i, a) => i > 0 && i < a.length - 1 && a[i - 1].c < p.c && a[i + 1].c <= p.c && p.c >= 6);
    const pico = picos[Math.floor(picos.length / 2)];
    b.coin(pico.x + 0.5, pico.c + 1.4);
    bajarTecho(wc.x, wc.c + 2, 1, xd + 2);

    // ================================================================ D · respiro (compases 24-26): cubo
    b.portal(xd, 1, 'cube');
    b.color(xd, '#1e1030', '#120820', { line: '#c8a8ff', obj: '#c8a8ff' });
    latir(24, 27, '#c8a8ff');
    b.camzoom(xd, 0.85, 8);
    b.camzoom(r(26, 2), 1, 6);
    // columnas de cristal que suben del suelo al fondo (grupo 2, sólo decorado)
    b.inGroup(2, () => {
      for (let i = 0; i < 6; i++) b.deco(xd + 6 + i * 9, -6, 'pillar', { w: 2, h: 6 + (i % 3) * 2, color: '#c8a8ff', par: 0.4, alpha: 0.6 });
    });
    b.move(xd, 2, 0, 6, r(25) - xd, 'inout');
    b.spike(J(2, 24, 2));
    b.spike(J(2, 25, 0));
    b.spikes(J(2, 25, 2) - 0.5, 2);
    b.pad(r(26, 1), 0, 'yellow');
    b.spikes(r(26, 1) + 1, 5);
    b.block(r(26, 1) + 6, 0, 3, 1);

    // ================================================================ E · drop 2 (compases 27-29): nave a 2x
    const xe = r(27);
    b.portal(xe, 1, 'ship', { floor: 0 });
    b.shake(xe, 5, 3);
    b.color(xe, '#2a0a14', '#1a050c', { line: '#ff5a7a', obj: '#ff5a7a' });
    adornos(b, xe, r(30), '#ff5a7a', { step: 5 });
    latir(27, 30, '#ff5a7a', '#ff2a5a');
    {
      const st = [];
      const plan = [2, 2, -2, 2, -2, -2, 2, 2, 0, -2];
      for (let i = 0; i < plan.length; i++) st.push([r(27 + Math.floor((i + 1) / 4), (i + 1) % 4), plan[i]]);
      tunelNave(xe + 2, 0, 5, st, r(30) + 2);
      // sierras en el suelo a contratiempo, sólo donde el túnel va pegado al suelo
      b.saw(r(27, 0.5) + 1, 0, 1);
    }

    // ================================================================ F · respiro (compás 30): cubo
    const xf = r(30);
    b.portal(xf, 1, 'cube');
    b.color(xf, '#1a1a34', '#0e0e22', { line: '#ffffff', obj: '#ffffff' });
    b.pulse(xf, '#ffffff', 6);
    b.camzoom(xf, 1.15, r(31) - xf, 'in');
    b.spike(J(2, 30, 1) + 1);
    b.spikes(r(30, 2) + 2, 4);
    b.orb(r(30, 2) + 3.5, 2.5);
    b.spike(J(2, 30, 3) + 2);

    // ================================================================ G · gran drop (compases 31-45) a 3x
    // G1 (31-38): ONDA DOBLE. Un gemelo en espejo en el techo: los obstáculos son simétricos y en cada
    // tiempo toca ir al centro (puertas) o a los bordes (cristales en medio).
    const xg = r(31), xg2 = r(39);
    b.speed(xg, 1, 3);
    b.portal(xg, 1, 'wave');
    b.portal(xg, 1, 'dual');
    b.camzoom(xg, 0.9, 2, 'out');
    b.shake(xg, 7, 4);
    b.color(xg, '#0a2a2e', '#05181c', { line: '#7affea', obj: '#7affea' });
    adornos(b, xg, xg2, '#7affea', { step: 5 });
    latir(31, 39, '#7affea', '#2affc8');
    b.hint(xg + 4, 5, 'Doble: el gemelo va en espejo');
    // cristales que aparecen con el drop (grupo 3)
    b.inGroup(3, () => {
      for (let k = 31; k < 39; k += 2) b.deco(r(k) + 4, 5, 'diamond', { r: 0.7, color: '#7affea', beat: true });
    });
    b.alpha(0, 3, 0, 0);
    b.alpha(xg, 3, 1, 6);
    {
      // patrón por tiempo: 'c' = puerta (sólo se pasa por el centro, filas 3-7), 'e' = cristal en el centro
      // (filas 4-6: hay que ir a los bordes), '.' = nada
      const pat = '.e.c' + 'ecec' + 'e.ce' + 'c.ec' + 'ecce' + '.ece' + 'ceec' + 'e...';
      for (let i = 0; i < pat.length; i++) {
        const x = Math.round(r(31 + Math.floor(i / 4), i % 4)) + 2;
        if (pat[i] === 'c') {
          b.block(x, 0, 2, 2); b.spikes(x, 2, 2);
          b.block(x, 8, 2, 2); b.spikes(x, 2, 7, 180);
        } else if (pat[i] === 'e') {
          b.block(x, 4, 2, 2);
          b.saw(x + 0.5, 4.5, 1.6);
        }
      }
    }
    // embudo simétrico (filas 3.5-6.5): los dos al centro para el portal único y el de nave
    const xs = Math.round(r(38, 2)) + 4;
    b.corridor(xs, 0, 10, [[3, 1, -1], [1, 0.5, -0.5], [Math.round(xg2) - xs - 4, 0, 0], [2, -0.5, 0.5]]);
    b.portal(xs + 6, 4.5, 'single');

    // G2 (39-45): nave a 3x por un túnel que cambia de altura en cada tiempo
    b.portal(xg2, 4.5, 'ship');
    b.color(xg2, '#2e1a06', '#1c0f02', { line: '#ffcf5a', obj: '#ffcf5a' });
    adornos(b, xg2, r(46), '#ffcf5a', { step: 5 });
    latir(39, 46, '#ffcf5a', '#ff9a2a');
    b.camrotate(xg2, -4, 8);
    b.camrotate(r(42), 4, 12);
    b.camrotate(r(45), 0, 8);
    {
      const st = [];
      const plan = [-2, 2, 2, -2, 0, -2, 2, 0, 2, 2, -2, 0, -2, -2, 2, 2, 0, 2, -2, -2, 2, 0, -2, 2];
      let f = 3;
      for (let i = 0; i < plan.length; i++) {
        let d = plan[i];
        if (f + d < 0 || f + d > 5) d = -d;
        f += d;
        st.push([r(39 + Math.floor((i + 1) / 4), (i + 1) % 4), d]);
      }
      tunelNave(Math.round(xg2) + 2, 3, 4, st, r(46) + 2);
      // sierras pegadas al suelo o al techo del túnel en la semicorchea tras cada cambio de altura (ya plano)
      let fa = 3;
      st.forEach(([m, d], i) => {
        fa += d;
        if (i % 2 === 0 || i >= st.length - 1) return;
        const sx = Math.round(m + 4.5);
        b.saw(sx, i % 4 === 1 ? fa : fa + 3, 1);
      });
    }

    // ================================================================ H · respiro (compás 46): cubo
    const xh = r(46);
    b.portal(xh, 1, 'cube');
    b.color(xh, '#1a1a34', '#0e0e22', { line: '#ffffff', obj: '#ffffff' });
    b.pulse(xh, '#ffffff', 6);
    b.camzoom(xh, 1.1, 6);
    b.camzoom(r(47) - 6, 1, 6);
    b.spike(J(3, 46, 1) + 1);
    b.spikes(r(46, 2) + 2, 5);
    b.orb(r(46, 2) + 4, 2.5);

    // ================================================================ I · último drop (compases 47-61)
    // I1 (47-54): bola a 3x con techo a 6
    const xi = r(47), xi2 = r(55);
    b.portal(xi, 1, 'ball');
    b.shake(xi, 6, 3);
    b.color(xi, '#2e0a2a', '#1c0518', { line: '#ff7ae0', obj: '#ff7ae0' });
    adornos(b, xi, xi2, '#ff7ae0', { step: 5 });
    latir(47, 55, '#ff7ae0', '#ff3ac0');
    b.block(xi + 2, 6, xi2 - xi - 10, 2);
    {
      // 'f' = pinchos en el suelo (ir arriba), 't' = en el techo (ir abajo), 's' = sierra donde esté la bola
      const pat = '.f.t' + 'f.t.' + 'f.ts' + '.f.t' + 'f.t.' + 'ftf.' + 't.f.' + 't...';
      let up = false;
      for (let i = 0; i < pat.length; i++) {
        const x = r(47 + Math.floor(i / 4), i % 4) + 2.5;
        if (pat[i] === 'f') { b.spikes(x, 3); up = true; }
        else if (pat[i] === 't') { b.spikes(x, 3, 5, 180); up = false; }
        else if (pat[i] === 's') { b.saw(x + 1, up ? 4.5 : 0.5, 1.2); up = !up; }
      }
      // moneda 3: pegada al suelo justo detrás de los pinchos del compás 50 (hay que bajar antes de tiempo)
      b.coin(r(50) + 6.5, 0);
    }
    // embudo hacia la onda mini: el techo baja a 3 y sigue así hasta pasado el portal mini
    b.corridor(xi2 - 8, 0, 6, [[3, 0, -1], [Math.round(xi2) - Math.round(xi2 - 8) - 1, 0, 0]]);
    b.portal(xi2 - 2, 1, 'unflip');

    // I2 (55-61): onda mini a 3x, el clímax: zigzag a corcheas
    b.portal(xi2, 1, 'wave');
    b.portal(xi2 + 1, 1, 'mini');
    b.color(xi2, '#0a1a3a', '#050f24', { line: '#5affff', obj: '#5affff' });
    adornos(b, xi2, r(62), '#5affff', { step: 4 });
    latir(55, 62, '#5affff', '#2a9aff');
    b.shake(xi2, 4, 2);
    const xj = r(62);
    {
      const mm = [];
      for (let k = 55; k < 62; k++) for (let q = 0.5; q <= 4; q += 0.5) mm.push(r(k, q));
      const wm = ondaRitmo(Math.round(xi2) + 3, 3, mm.filter((m) => m > xi2 + 4 && m < xj - 8), 4, 2, 2, 8);
      bajarTecho(wm.x, wm.c + 2, 2, xj + 2);
    }

    // ================================================================ J · final (compases 62-69): cubo a 2x
    b.portal(xj - 1, 1, 'big');
    b.portal(xj, 1, 'cube');
    b.speed(xj, 1, 2);
    b.color(xj, '#1a0f2e', '#100820', { line: '#ff9ad0', obj: '#ff6fb5' });
    adornos(b, xj, r.end, '#ff9ad0', { step: 9 });
    for (let k = 62; k < 70; k += 2) b.pulse(r(k), '#ff9ad0', 5);
    b.camoffset(xj, 0, 1, 16);
    b.camoffset(r(68), 0, 0, 16);
    b.spike(J(2, 62, 2) + 2);
    b.spikes(J(2, 63, 2) - 0.5, 2);
    b.block(r(64) + 2, 0, 6, 1);
    b.spike(J(2, 65, 0));
    b.spike(J(2, 66, 0));
    b.spikes(J(2, 66, 2) - 0.5, 2);
    // el cristal grande vuelve y se apaga con la canción
    b.inGroup(4, () => b.deco(r(67), 4, 'diamond', { r: 1.8, color: '#ffd0ea', beat: true }));
    b.alpha(r(68), 4, 0, r(70) - r(68));
    return b.build(r.end);
  }

  function build(H) {
    ({ Builder, rejilla, ritmo, adornos, UPS } = H);
    return faseDoble();
  }
  let Builder, rejilla, ritmo, adornos, UPS; // eslint-disable-line no-unused-vars
  if (typeof module !== 'undefined' && module.exports) module.exports = build;
  else (root.NIVELES = root.NIVELES || {})['fase-doble'] = build;
})(typeof globalThis !== 'undefined' ? globalThis : this);
