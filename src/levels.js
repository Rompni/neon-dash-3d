/*
 * NEON DASH — niveles.
 * Coordenadas en bloques: x hacia la derecha desde la salida, y = fila sobre el suelo.
 */
(function (root) {
  'use strict';

  function Builder(meta) {
    this.meta = meta;
    this.objects = [];
    this.colors = [];
  }

  Builder.prototype = {
    block(x, y, w, h) { this.objects.push({ t: 'block', x, y, w: w || 1, h: h || 1 }); return this; },
    spike(x, y, r) { this.objects.push({ t: 'spike', x, y: y || 0, r: r || 0 }); return this; },
    spikes(x, n, y, r) { for (let i = 0; i < n; i++) this.spike(x + i, y, r); return this; },
    small(x, y, r) { this.objects.push({ t: 'spike', x, y: y || 0, r: r || 0, size: 0.5 }); return this; },
    smalls(x, n, y, r) { for (let i = 0; i < n; i++) this.small(x + i, y, r); return this; },
    pad(x, y, kind, r) { this.objects.push({ t: 'pad', x, y: y || 0, kind: kind || 'yellow', r: r || 0 }); return this; },
    orb(x, y, kind) { this.objects.push({ t: 'orb', x, y, kind: kind || 'yellow' }); return this; },
    coin(x, y) { this.objects.push({ t: 'coin', x, y }); return this; },
    slope(x, y, w, h, dir) { this.objects.push({ t: 'slope', x, y, w: w || 1, h: h || 1, dir: dir || 1 }); return this; },
    saw(x, y, size) { this.objects.push({ t: 'saw', x, y, size: size || 1 }); return this; },
    portal(x, y, kind, extra) { this.objects.push(Object.assign({ t: 'portal', x, y, kind }, extra || {})); return this; },
    speed(x, y, value) { return this.portal(x, y, 'speed', { value }); },
    // Color de fondo/suelo (y opcionalmente de la línea del suelo y de los bloques), con fundido en bloques.
    color(x, bg, ground, opts) { this.colors.push(Object.assign({ x, bg, ground }, opts || {})); return this; },
    // Triggers visuales: no afectan a la física, dependen sólo de la x del jugador.
    pulse(x, color, dur) { return this.trig({ kind: 'pulse', x, color: color || '#ffffff', dur: dur || 4 }); },
    shake(x, power, dur) { return this.trig({ kind: 'shake', x, power: power || 4, dur: dur || 3 }); },
    move(x, group, dx, dy, dur, ease) { return this.trig({ kind: 'move', x, group, dx, dy, dur: dur || 4, ease: ease || 'inout' }); },
    fade(x, group, alpha, dur) { return this.trig({ kind: 'fade', x, group, alpha, dur: dur || 4 }); },
    trig(t) { (this.triggers || (this.triggers = [])).push(t); return this; },
    // Asigna a cada cambio de color, en orden, un color de bloques ('obj') o de línea ('line').
    palette(key, values) { this.colors.forEach((c, i) => { if (values[i]) c[key] = values[i]; }); return this; },
    // Decorado sin colisión: glow, pillar, ring, arrow, diamond, line.
    deco(x, y, kind, opts) { (this.decos || (this.decos = [])).push(Object.assign({ x, y, kind }, opts || {})); return this; },
    hint(x, y, text) { (this.hints || (this.hints = [])).push({ x, y, text }); return this; },

    // Túnel para modos voladores: centro(x) en filas, hueco en filas.
    // Pasillo de onda con bloques triangulares, como en el original: suelo y techo en diente de sierra.
    // El centro sube o baja k bloques por cada bloque de avance (k = 1 para la onda, 2 para la onda mini,
    // que va exactamente a 2:1). segs = [[columnas, +1 | -1], ...]; gap = hueco vertical.
    // Devuelve el centro de cada columna para colocar monedas y portales.
    waveCorridor(x0, y0, segs, gap, k, top) {
      top = top == null ? 10 : top;
      let x = x0, c = y0;
      const path = [];
      for (const [len, dir] of segs) {
        for (let i = 0; i < len; i++) {
          const fLow = c - gap / 2 - (dir > 0 ? 0 : k);
          const cLow = c + gap / 2 - (dir > 0 ? 0 : k);
          if (fLow < 0 || cLow + k > top) throw new Error(`pasillo de onda fuera de límites en x=${x}`);
          if (fLow > 0) this.block(x, 0, 1, fLow);
          this.objects.push({ t: 'slope', x, y: fLow, w: 1, h: k, dir });
          this.objects.push({ t: 'slope', x, y: cLow, w: 1, h: k, dir, ceil: true });
          if (cLow + k < top) this.block(x, cLow + k, 1, top - cLow - k);
          path.push({ x, c: c + dir * k / 2 });
          c += dir * k;
          x++;
        }
      }
      return { x, c, path };
    },

    // Pasillo general columna a columna: suelo y techo planos o con rampas (bloques triangulares).
    // segs = [[columnas, subida del suelo, subida del techo], ...] por columna; ceil0 = null → sin techo.
    // Sirve para colinas, túneles de nave con paredes inclinadas y embudos que llevan a un portal.
    corridor(x0, floor0, ceil0, segs, top) {
      top = top == null ? 10 : top;
      let x = x0, f = floor0, c = ceil0;
      for (const [n, fd, cd] of segs) {
        for (let i = 0; i < n; i++) {
          if (fd === 0) { if (f > 0) this.block(x, 0, 1, f); }
          else {
            const lo = Math.min(f, f + fd);
            if (lo < 0) throw new Error(`suelo bajo cero en x=${x}`);
            if (lo > 0) this.block(x, 0, 1, lo);
            this.objects.push({ t: 'slope', x, y: lo, w: 1, h: Math.abs(fd), dir: fd > 0 ? 1 : -1 });
          }
          f += fd;
          if (c != null) {
            if (cd === 0) { if (c < top) this.block(x, c, 1, top - c); }
            else {
              const lo = Math.min(c, c + cd), hi = Math.max(c, c + cd);
              if (hi > top) throw new Error(`techo por encima del límite en x=${x}`);
              this.objects.push({ t: 'slope', x, y: lo, w: 1, h: Math.abs(cd), dir: cd > 0 ? 1 : -1, ceil: true });
              if (hi < top) this.block(x, hi, 1, top - hi);
            }
            c += cd;
            if (c - f < 1) throw new Error(`pasillo cerrado en x=${x}`);
          }
          x++;
        }
      }
      return { x, f, c };
    },

    // Salida de un pasillo de onda: el techo baja con rampas desde `ceil` hasta `low` y sigue plano 6 bloques.
    // step = lo que baja cada rampa (2 para la onda mini, 1 para la normal, que va a 45°).
    waveExit(x, ceil, low, top, step) {
      top = top == null ? 10 : top;
      step = step || 2;
      let c = ceil;
      while (c > low) {
        const h = Math.min(step, c - low);
        this.objects.push({ t: 'slope', x, y: c - h, w: 1, h, dir: -1, ceil: true });
        this.block(x, c, 1, top - c);
        c -= h;
        x++;
      }
      this.block(x, low, 6, top - low);
      return this;
    },

    tunnel(x0, x1, center, gap, top) {
      top = top || 10;
      for (let x = x0; x <= x1; x++) {
        const lo = Math.round(center(x) - gap / 2);
        const hi = lo + gap;
        if (lo > 0) this.block(x, 0, 1, lo);
        if (hi < top) this.block(x, hi, 1, top - hi);
      }
      return this;
    },

    build(length) {
      return Object.assign({}, this.meta, {
        objects: this.objects,
        hints: this.hints || [],
        triggers: (this.triggers || []).sort((a, b) => a.x - b.x),
        decos: this.decos || [],
        colors: this.colors.sort((a, b) => a.x - b.x),
        length,
      });
    },
  };

  // ------------------------------------------------------------------ 1
  function primerPulso() {
    const b = new Builder({
      id: 'primer-pulso',
      card: '#ff7a3d',
      theme: 'original',
      name: 'Primer Pulso',
      difficulty: 'Fácil',
      stars: 2,
      song: 'pulso',
      bpm: 155.79,     // 1 pulso = 4 bloques a velocidad 1x
    });

    // A · calentamiento
    b.color(0, '#2a53d6', '#1c3aa8');
    b.spike(20);
    b.spike(28);
    b.spikes(36, 2);
    b.hint(104, 4.5, 'Mantén pulsado para encadenar saltos');
    b.block(45, 0, 2, 2);
    b.spikes(58, 2);

    // B · escalera, salto de fe y pad
    b.color(62, '#5b37d4', '#3d239e');
    b.block(66, 0, 4, 1);
    b.block(70, 0, 5, 2);
    b.spikes(75, 4);
    b.spike(84);
    b.pad(88, 0, 'yellow');
    b.spikes(90, 10);
    b.block(92, 3, 7, 1);
    b.coin(95, 6);
    b.spikes(106, 2);
    b.block(111, 0, 2, 1);
    b.spikes(113, 2);
    b.smalls(120, 3);

    // C · orbes
    b.color(126, '#9a2fc9', '#6a1e8c');
    b.spikes(134, 5);
    b.orb(136, 2);
    b.spike(147);
    b.block(152, 0, 2, 1);
    b.spikes(154, 6);
    b.orb(157, 2, 'pink');
    b.spikes(167, 4);
    b.orb(168, 2);
    b.block(176, 0, 4, 1);
    b.spikes(180, 3);

    // D · nave: túnel ondulado y embudo hacia el portal de cubo
    b.color(188, '#0f8f9e', '#0a6470');
    b.portal(192, 1, 'ship');
    b.hint(196, 5.5, 'Nave: mantén para subir');
    b.tunnel(200, 246, (x) => 4.5 + 2.4 * Math.sin((x - 200) / 7.5), 5);
    b.coin(226, 5);
    b.block(247, 0, 3, 1);
    b.block(247, 6, 3, 4);
    b.block(250, 4, 12, 6);
    b.portal(256, 1, 'cube');

    // E · gravedad
    b.color(256, '#d9711c', '#a14d0c');
    b.block(262, 5, 34, 1);
    b.spike(265);
    b.portal(270, 1, 'flip');
    b.hint(268, 3.2, 'Gravedad invertida');
    b.spike(279, 4, 180);
    b.coin(282, 3);
    b.spikes(285, 2, 4, 180);
    b.smalls(274, 14);
    b.portal(292, 3, 'unflip');
    b.spike(302);
    b.spikes(307, 2);

    // F · final
    b.color(314, '#d42d6a', '#9c1448');
    b.block(318, 0, 2, 1);
    b.block(320, 0, 2, 2);
    b.block(322, 2, 10, 1);
    b.spikes(322, 10);
    b.pad(331, 3, 'pink');
    b.spikes(334, 5);
    b.orb(334, 4);
    b.spikes(347, 2);
    b.pad(353, 0, 'yellow');
    b.spikes(355, 8);
    b.block(357, 3, 3, 1);
    b.orb(363, 4);
    b.spikes(370, 2);
    b.color(380, '#2a53d6', '#1c3aa8');

    b.palette('obj', ['#ff9f3b', '#3bd8ff', '#ffd23a', '#a6ff5c', '#5d8bff', '#7dff5a', '#ff9f3b']);
    return b.build(392);
  }

  // ------------------------------------------------------------------ 2
  function orbita() {
    const b = new Builder({
      id: 'orbita',
      card: '#2e8bff',
      theme: 'original',
      name: 'Órbita',
      difficulty: 'Normal',
      stars: 4,
      song: 'orbita',
      bpm: 150,
    });

    // A · cubo y pads azules
    b.color(0, '#0f7f9e', '#0a5870');
    b.spikes(18, 2);
    b.block(26, 0, 3, 1);
    b.spikes(29, 2);
    b.block(36, 5, 23, 1);
    b.pad(39, 0, 'blue');
    b.spike(45, 4, 180);
    b.spikes(50, 2, 4, 180);
    b.smalls(42, 14);
    b.pad(56, 4, 'blue', 180);
    b.spikes(63, 2);
    b.spike(68);

    // B · bola
    b.color(72, '#d9711c', '#a14d0c');
    b.portal(74, 1, 'ball');
    b.hint(79, 4, 'Bola: toca para cambiar de lado');
    b.spikes(84, 3);
    b.spikes(92, 3, 7, 180);
    b.spikes(100, 3);
    b.coin(104, 3);
    b.spikes(108, 3, 7, 180);
    b.spikes(116, 2);
    b.spikes(121, 2, 7, 180);
    b.smalls(128, 4);
    b.smalls(134, 4, 7, 180);
    b.spikes(140, 7, 7, 180);

    // C · ovni entre columnas
    b.color(143, '#7a2fd0', '#52199a');
    b.portal(146, 1, 'ufo');
    b.hint(150, 7, 'Ovni: cada toque es un impulso');
    // [x, fila inferior del hueco, alto del hueco]
    const gaps = [[158, 0, 5], [165, 1, 5], [172, 3, 4], [180, 1, 4], [188, 4, 4], [196, 2, 4]];
    for (const [x, lo, size] of gaps) {
      if (lo > 0) b.block(x, 0, 2, lo);
      b.block(x, lo + size, 2, 10 - (lo + size));
    }
    b.coin(186, 6);
    b.block(204, 4, 8, 6);
    b.portal(208, 1, 'cube');

    // D · orbes, orbes azules y techo
    b.color(208, '#2c9a3e', '#1b6e2a');
    b.spike(218);
    b.spikes(223, 2);
    b.spikes(231, 6);
    b.orb(233, 2);
    b.block(244, 6, 26, 1);
    b.spikes(242, 4);
    b.orb(244, 2, 'blue');
    b.hint(239, 4.2, 'Orbe azul: invierte la gravedad');
    b.smalls(246, 20);
    b.spike(254, 5, 180);
    b.orb(264, 3, 'blue');
    b.spikes(275, 2);
    b.block(281, 0, 3, 2);
    b.speed(287, 1, 2);

    // E · final a 2x
    b.color(284, '#d42d4a', '#9c1430');
    b.spike(294);
    b.spikes(301, 2);
    b.block(308, 0, 4, 1);
    b.spikes(312, 2);
    b.portal(320, 1, 'ball');
    b.spikes(330, 3);
    b.spikes(339, 3, 7, 180);
    b.spikes(348, 3);
    b.spikes(354, 8, 7, 180);
    b.portal(360, 1, 'cube');
    b.spike(372);
    b.pad(379, 0, 'yellow');
    b.spikes(381, 9);
    b.block(384, 3, 4, 1);
    b.coin(386, 6);
    b.spikes(396, 2);
    b.spike(404);
    b.color(410, '#0f7f9e', '#0a5870');

    b.palette('line', ['#27e3ff', '#ffb13b', '#c77dff', '#7dff5a', '#ffe23b', '#27e3ff']);
    return b.build(420);
  }

  // ------------------------------------------------------------------ 3
  function faseDoble() {
    const b = new Builder({
      id: 'fase-doble',
      card: '#e8334f',
      theme: 'original',
      name: 'Fase Doble',
      difficulty: 'Difícil',
      stars: 6,
      song: 'fase',
      bpm: 170,
    });

    // A · cubo a 2x
    b.color(0, '#c2185b', '#880e4f');
    b.speed(10, 1, 2);
    b.spike(30);
    b.spikes(36, 2);
    b.spikes(44, 3);
    b.block(53, 0, 5, 1);
    b.spikes(58, 2);
    b.spikes(66, 10);
    b.orb(68, 2);
    b.orb(72, 2);
    b.portal(84, 1, 'wave');
    b.hint(89, 8.3, 'Onda: mantén para subir, suelta para bajar');

    // B · onda por un pasillo de bloques triangulares a 45°
    b.color(84, '#1565c0', '#0d47a1');
    const fw = b.waveCorridor(92, 3, [[3, 1], [2, -1], [3, 1], [3, -1], [2, 1], [4, -1], [5, 1], [2, -1], [3, 1], [4, -1],
      [2, 1], [3, -1], [4, 1], [2, -1], [3, 1], [5, -1], [4, 1], [2, -1], [3, 1], [3, -1], [2, 1]], 4, 1);
    const fwCoin = fw.path.find((p) => p.x === 123);
    b.coin(fwCoin.x, fwCoin.c - 0.5);
    const fwEnd = fw.path[fw.path.length - 1];
    b.portal(fwEnd.x, fwEnd.c - 0.5, 'ship', { floor: 0 });

    // C · nave a 2x
    b.color(160, '#00897b', '#00695c');
    b.tunnel(166, 224, (x) => 4.5 + 2.5 * Math.sin((x - 166) / 6), 4);
    b.coin(200, 1);
    b.block(225, 0, 3, 1);
    b.block(225, 5, 3, 5);
    b.block(228, 4, 8, 6);
    b.portal(232, 1, 'cube');

    // D · cubo, pads y bola
    b.color(232, '#ef6c00', '#bf360c');
    b.spike(242);
    // Pad sobre suelo llano: funciona sin pulsar, y la plataforma baja también se alcanza saltando.
    b.hint(254, 3.3, 'No saltes: el pad te lanza');
    b.pad(254, 0, 'yellow');
    b.pad(255, 0, 'yellow');
    b.pad(256, 0, 'yellow');
    b.spikes(257, 10);
    b.block(258, 1, 9, 1);
    b.block(271, 6, 24, 1);
    b.pad(274, 0, 'blue');
    b.smalls(276, 18);
    b.spike(282, 5, 180);
    b.spikes(288, 2, 5, 180);
    b.pad(293, 5, 'blue', 180);
    b.portal(302, 1, 'ball');
    b.spikes(310, 3);
    b.spikes(317, 3, 7, 180);
    b.spikes(324, 3);
    b.spikes(330, 7, 7, 180);
    b.portal(336, 1, 'cube');

    // E · final a 3x
    b.color(336, '#6a1b9a', '#4a148c');
    b.speed(338, 1, 3);
    b.spike(350);
    b.spikes(358, 2);
    b.spikes(367, 3);
    b.coin(368, 3);
    b.block(376, 0, 6, 1);
    b.spikes(382, 2);
    b.color(392, '#c2185b', '#880e4f');

    b.palette('obj', ['#ffd23a', '#ff9f3b', '#3bd8ff', '#5d8bff', '#7dff5a', '#ffd23a']);
    return b.build(404);
  }

  // ------------------------------------------------------------------ 4
  function ladera() {
    const b = new Builder({
      id: 'ladera',
      card: '#36b562',
      theme: 'original',
      name: 'Ladera',
      difficulty: 'Normal',
      stars: 4,
      song: 'ladera',
      bpm: 140,
    });

    // A · rampas y sierras
    b.color(0, '#1f8a70', '#125c4a', { line: '#bfffe9' });
    b.deco(4, 0, 'pillar', { w: 1, h: 7, color: '#bfffe9', par: 0.35, alpha: 0.6 });
    b.deco(24, 0, 'pillar', { w: 1, h: 9, color: '#bfffe9', par: 0.35, alpha: 0.6 });
    b.deco(18, 6, 'glow', { r: 3, color: '#7dffcf' });
    b.hint(9, 4, 'Las rampas se suben solas');
    b.slope(14, 0, 1, 1, 1);
    b.block(15, 0, 6, 1);
    b.slope(21, 0, 1, 1, -1);
    b.saw(27, 0);
    b.slope(32, 0, 2, 1, 1);
    b.block(34, 0, 7, 1);
    b.spike(38, 1);
    b.slope(41, 0, 2, 1, -1);
    b.saw(49, 0, 1.5);
    b.slope(54, 0, 2, 2, 1);
    b.block(56, 0, 5, 2);
    b.spikes(61, 4);
    b.coin(62, 5);
    b.block(65, 0, 5, 1);

    // B · mini: túnel bajo y saltos cortos
    b.color(70, '#7a3fd1', '#4f2290', { line: '#f1d9ff' });
    b.pulse(72, '#f1d9ff', 3);
    b.portal(72, 1, 'mini');
    b.hint(76, 3, 'Mini: cabes por huecos bajos');
    b.block(80, 0.6, 8, 1);
    b.deco(80, 2.2, 'arrow', { color: '#f1d9ff' });
    b.smalls(93, 2);
    b.spike(99);
    b.block(104, 0, 5, 1);
    b.smalls(110, 2);
    b.orb(119, 1);
    b.coin(122, 2.5);
    b.spikes(120, 3);
    b.portal(129, 1, 'big');

    // C · nave entre sierras
    b.color(128, '#0f5e9c', '#08406b', { line: '#9fd6ff' });
    b.pulse(131, '#9fd6ff', 3);
    b.portal(131, 1, 'ship');
    // Sierras alternando suelo, techo y centro: hay que zigzaguear.
    b.saw(141, 0.5, 2);
    b.saw(148, 8.5, 2);
    b.saw(155, 0.5, 2);
    b.saw(155, 5, 1.5);
    b.saw(162, 0.5, 2);
    b.saw(162, 8.5, 2);
    b.saw(170, 4.5, 2.5);
    b.saw(170, 0.5, 1.5);
    b.coin(174, 8);
    b.saw(178, 0.5, 2);
    b.saw(178, 6.5, 1.5);
    b.saw(186, 8.5, 2);
    b.saw(186, 2.5, 1.5);
    b.deco(150, 5, 'ring', { r: 3, color: '#9fd6ff', group: 1, alpha: 0.5 });
    b.move(140, 1, 30, 0, 40, 'linear');
    b.block(194, 4, 10, 6);
    b.portal(199, 1, 'cube');

    // D · orbes verdes y negro
    b.color(202, '#b03a5b', '#7a1f3b', { line: '#ffd0dc' });
    b.pulse(203, '#ffd0dc', 3);
    b.spike(210);
    b.block(214, 6, 36, 1);
    b.hint(215, 4.3, 'Orbe verde: salta y pulsa en el aire');
    b.orb(219, 2.5, 'green');
    b.smalls(224, 20);
    b.spike(231, 5, 180);
    b.spikes(239, 2, 5, 180);
    b.portal(247, 4, 'unflip');
    b.hint(254, 5.4, 'Orbe negro: te hunde');
    b.pad(255, 0, 'yellow');
    b.spikes(256, 3);
    b.orb(258, 4, 'black');
    b.block(260, 3, 8, 1);
    b.spikes(260, 8, 4);

    // E · final a 2x con rampas
    b.color(276, '#d9831f', '#9c5a0c', { line: '#fff0c9' });
    b.speed(278, 1, 2);
    b.pulse(278, '#fff0c9', 4);
    b.slope(290, 0, 1, 1, 1);
    b.block(291, 0, 4, 1);
    b.slope(295, 0, 1, 1, -1);
    b.saw(301, 0);
    b.spike(308);
    b.slope(314, 0, 2, 2, 1);
    b.block(316, 0, 4, 2);
    b.spikes(320, 2);
    b.spike(332);
    b.spikes(338, 2);
    b.deco(345, 3, 'diamond', { r: 1.4, color: '#fff0c9', beat: true });
    b.color(350, '#1f8a70', '#125c4a', { line: '#bfffe9' });

    b.palette('obj', ['#ffd23a', '#7dff5a', '#ff9f3b', '#3bd8ff', '#5d8bff', '#ffd23a']);
    return b.build(356);
  }

  // ------------------------------------------------------------------ 5
  function espejo() {
    const b = new Builder({
      id: 'espejo',
      card: '#8a5cff',
      theme: 'original',
      name: 'Espejo',
      difficulty: 'Difícil',
      stars: 6,
      song: 'espejo',
      bpm: 160,
    });

    // A · cubo a 2x, orbe verde y techo
    b.color(0, '#3a2c8f', '#221a5e', { line: '#d6ccff' });
    b.deco(10, 4, 'glow', { r: 4, color: '#8f7dff' });
    b.speed(6, 1, 2);
    b.spike(24);
    b.slope(30, 0, 2, 1, 1);
    b.block(32, 0, 7, 1);
    b.saw(35, 1);
    b.slope(39, 0, 2, 1, -1);
    b.spikes(47, 2);
    b.block(52, 6, 34, 1);
    b.hint(52, 4.4, 'Salta y vuelve a pulsar sobre el orbe');
    b.orb(56, 2.5, 'green');
    b.smalls(63, 21);
    b.spike(70, 5, 180);
    b.spikes(78, 2, 5, 180);
    b.pad(84, 5, 'blue', 180);

    // B · bola entre sierras
    b.color(86, '#8f2c6a', '#5e1a45', { line: '#ffd6ef' });
    b.pulse(88, '#ffd6ef', 3);
    b.portal(90, 1, 'ball');
    b.spikes(98, 3);
    b.spikes(106, 3, 7, 180);
    b.saw(114, 3.5, 1.5);
    b.spikes(118, 3);
    b.coin(122, 3.5);
    b.spikes(126, 3, 7, 180);
    b.saw(134, 3.5, 1.5);
    b.spikes(138, 3);
    b.spikes(146, 3, 7, 180);
    b.spikes(152, 8, 7, 180);
    b.portal(158, 1, 'cube');

    // C · onda mini
    b.color(160, '#1c7f8f', '#0f525e', { line: '#ccf6ff' });
    b.pulse(162, '#ccf6ff', 3);
    b.portal(161, 1, 'mini');
    b.portal(164, 1, 'wave');
    b.hint(166, 8.4, 'Onda mini: el doble de empinada');
    // pasillo ancho en diente de sierra con rampas empinadas (1×2): la onda mini sube 2 por cada 1
    const ew = b.waveCorridor(170, 3, [[1, 1], [1, -1], [1, 1], [1, -1], [1, 1], [1, -1], [2, 1], [1, -1], [1, 1], [1, -1],
      [1, 1], [2, -1], [1, 1], [1, -1], [1, 1], [1, -1], [2, 1], [1, -1], [1, 1], [2, -1], [1, 1], [1, -1],
      [1, 1], [1, -1], [1, 1], [1, -1], [1, 1], [1, -1], [1, 1], [1, -1]], 6, 2);
    const ewCoin = ew.path.find((p) => p.x === 186);
    b.coin(ewCoin.x, ewCoin.c + 1.5);
    b.waveExit(ew.x, 6, 3);
    b.portal(ew.x + 3, 1, 'big');
    b.portal(ew.x + 6, 1, 'cube');

    // D · rampas y mini cubo
    b.color(220, '#2c8f4a', '#1a5e30', { line: '#d6ffe2' });
    b.slope(230, 0, 2, 2, 1);
    b.block(232, 0, 5, 2);
    b.slope(237, 0, 2, 2, -1);
    b.saw(244, 0);
    b.spike(250);
    b.portal(256, 1, 'mini');
    b.block(262, 0.6, 8, 1);
    b.smalls(273, 2);
    b.spike(279);
    b.block(284, 0, 4, 1);
    b.smalls(290, 2);
    b.portal(296, 1, 'big');
    b.spikes(304, 2);

    // E · nave a 3x
    b.color(310, '#8f6a1c', '#5e440f', { line: '#fff0cc' });
    b.speed(312, 1, 3);
    b.pulse(314, '#fff0cc', 4);
    b.portal(316, 1, 'ship');
    b.tunnel(326, 400, (x) => 4.5 + 2.2 * Math.sin((x - 326) / 9), 5);
    b.coin(340, 7);
    b.block(401, 0, 4, 1);
    b.block(401, 5, 4, 5);
    b.block(405, 4, 8, 6);
    b.portal(410, 1, 'cube');
    b.spike(422);
    b.color(428, '#3a2c8f', '#221a5e', { line: '#d6ccff' });

    b.palette('line', ['#8f7dff', '#ff9b3b', '#27e3ff', '#5dff7a', '#ffd23a', '#8f7dff']);
    return b.build(436);
  }

  // ------------------------------------------------------------------ 6
  function abismo() {
    const b = new Builder({
      id: 'abismo',
      card: '#8c1a4a',
      theme: 'original',
      name: 'Abismo',
      difficulty: 'Demonio',
      stars: 10,
      song: 'abismo',
      bpm: 175,
    });

    // A · cubo a 3x
    b.color(0, '#1a0b2e', '#0d0519', { line: '#ff3b5c', obj: '#ffd08f' });
    b.deco(12, 4, 'glow', { r: 5, color: '#ff3b5c', alpha: 0.6 });
    b.speed(6, 1, 3);
    b.pulse(6, '#ff3b5c', 3);
    b.spike(26);
    b.spikes(36, 3);
    b.slope(46, 0, 1, 1, 1);
    b.block(47, 0, 7, 1);
    b.saw(51, 1);
    b.slope(54, 0, 1, 1, -1);
    b.spikes(62, 2);
    b.pad(70, 0, 'yellow');
    b.spikes(71, 14);
    b.block(74, 3, 11, 1);
    b.spike(92);
    b.block(98, 6, 40, 1);
    b.orb(101, 2.5, 'green');
    b.smalls(110, 27);
    b.spike(112, 5, 180);
    b.spikes(121, 2, 5, 180);
    b.saw(129, 5.2);
    b.portal(135, 4, 'unflip');

    // B · ovni a 3x
    b.color(142, '#2e0b1f', '#190510', { line: '#ffb13b', obj: '#ffd08f' });
    b.pulse(144, '#ffb13b', 3);
    b.portal(144, 1, 'ufo');
    const ufo = [[154, 0, 5], [161, 2, 4], [168, 4, 4], [175, 2, 4], [182, 4, 4], [189, 2, 4], [196, 4, 4]];
    for (const [x, lo, size] of ufo) {
      if (lo > 0) b.block(x, 0, 2, lo);
      b.block(x, lo + size, 2, 10 - (lo + size));
    }
    b.coin(186, 7);
    b.block(203, 4, 6, 6);
    b.speed(204, 1, 2);
    b.portal(207, 1, 'mini');

    // C · onda mini a 2x
    b.color(209, '#0b2e2a', '#051915', { line: '#3bd8ff', obj: '#9ff0ff' });
    b.pulse(210, '#3bd8ff', 3);
    b.portal(210, 1, 'wave');
    // pasillo de onda mini con rampas empinadas (1×2), más estrecho y con giros seguidos
    const aw = b.waveCorridor(216, 3, [[2, 1], [2, -1], [2, 1], [1, -1], [1, 1], [2, -1], [2, 1], [2, -1], [1, 1], [1, -1],
      [2, 1], [2, -1], [2, 1], [1, -1], [1, 1], [2, -1], [2, 1], [2, -1], [2, 1], [2, -1]], 6, 2);
    const awCoin = aw.path.find((p) => p.x === 233);
    b.coin(awCoin.x, awCoin.c + 1);
    b.waveExit(aw.x, 6, 3);
    b.portal(aw.x + 3, 1, 'big');
    b.portal(aw.x + 6, 1, 'ball');
    b.speed(aw.x + 7, 1, 3); // dentro de la salida baja: no se puede esquivar

    // D · bola a 3x entre sierras
    b.color(270, '#2e1a0b', '#190d05', { line: '#ff6b3d', obj: '#ffb08f' });
    b.pulse(271, '#ff6b3d', 3);
    b.spikes(282, 3);
    b.saw(290, 3.5, 1.5);
    b.spikes(296, 3, 7, 180);
    b.spikes(305, 3);
    b.saw(313, 3.5, 1.5);
    b.spikes(319, 3, 7, 180);
    b.spikes(328, 3);
    b.spikes(336, 8, 7, 180);
    b.portal(343, 1, 'ship');

    // E · nave a 4x y final
    b.color(346, '#0b0b2e', '#050519', { line: '#7a5cff', obj: '#c0b0ff' });
    b.speed(346, 1, 4);
    b.pulse(347, '#7a5cff', 4);
    b.tunnel(356, 420, (x) => 4.5 + 2.4 * Math.sin((x - 356) / 10), 4);
    b.coin(392, 2);
    // Embudo escalonado hasta el portal de cubo (a 4x no se puede bajar de golpe).
    b.block(421, 0, 4, 2);
    b.block(421, 6, 4, 4);
    b.block(425, 0, 6, 1);
    b.block(425, 5, 6, 5);
    b.block(431, 4, 9, 6);
    b.portal(436, 1, 'cube');
    b.spike(452);
    b.spikes(464, 2);
    b.color(472, '#1a0b2e', '#0d0519', { line: '#ff3b5c', obj: '#ffd08f' });

    b.palette('line', ['#3bffb1', '#ffb13b', '#3bd8ff', '#ffe23b', '#7a9cff', '#3bffb1']);
    return b.build(482);
  }

  // ------------------------------------------------------------------ 7
  // Demonio extremo original: rojo y negro, todo a 3x-4x, con secciones que no salen en ningún otro nivel
  // (colinas de rampas, andar por el techo con rampas de techo, nave por un túnel inclinado, bola sobre
  // raíles con huecos, ovni entre sierras) y transiciones con embudos de rampas que llevan a cada portal.
  function banoDeSangre() {
    const b = new Builder({
      id: 'bano-de-sangre',
      card: '#b3121f',
      theme: 'original',
      name: 'Baño de Sangre',
      difficulty: 'Demonio',
      stars: 10,
      song: 'sangre',
      bpm: 186,
    });

    // A · cubo a 3x por colinas de rampas y una cadena de orbes sobre pinchos
    b.color(0, '#24040a', '#120205', { line: '#ff2a3a', obj: '#ffb08f' });
    b.deco(12, 4, 'glow', { r: 5, color: '#ff2a3a', alpha: 0.6 });
    b.speed(5, 1, 3);
    b.pulse(5, '#ff2a3a', 3);
    b.corridor(16, 0, null, [[4, 0.5, 0], [6, 0, 0], [4, -0.5, 0], [8, 0, 0], [2, 1, 0], [4, 0, 0], [2, -1, 0]]);
    b.spike(23, 2);            // en lo alto de la primera colina
    b.spike(33);               // en el valle
    b.spike(41, 2);            // en lo alto de la colina empinada
    b.spikes(52, 17);          // foso de pinchos con orbes
    b.orb(55, 2.5, 'yellow');
    b.orb(61, 3, 'pink');
    b.orb(66, 2.5, 'yellow');
    b.block(69, 0, 5, 1);

    // B · al techo: pad azul, se anda por debajo de un techo con jorobas de rampas y pinchos colgando
    b.color(74, '#2a0614', '#14030a', { line: '#ff3b8f', obj: '#ffd08f' });
    b.block(78, 6, 58, 4);
    b.pad(80, 0, 'blue');
    b.hint(80, 3.2, 'Ahora el suelo es el techo');
    b.objects.push({ t: 'slope', x: 90, y: 5, w: 1, h: 1, dir: -1, ceil: true });
    b.block(91, 5, 3, 1);
    b.objects.push({ t: 'slope', x: 94, y: 5, w: 1, h: 1, dir: 1, ceil: true });
    b.spike(101, 5, 180);
    b.spikes(110, 2, 5, 180);
    b.objects.push({ t: 'slope', x: 117, y: 5, w: 1, h: 1, dir: -1, ceil: true });
    b.block(118, 5, 3, 1);
    b.spike(119, 4, 180);      // pincho sobre la joroba
    b.objects.push({ t: 'slope', x: 121, y: 5, w: 1, h: 1, dir: 1, ceil: true });
    b.orb(129, 4, 'blue');     // de vuelta al suelo
    b.smalls(84, 40);          // el suelo de abajo no perdona

    // C · nave a 3x por un túnel de paredes inclinadas, con sierras en las zonas anchas
    b.color(138, '#1a0410', '#0d0208', { line: '#ff3b8f', obj: '#ffd08f' });
    b.pulse(142, '#ff3b8f', 3);
    b.portal(144, 1, 'ship', { floor: 0 });
    const t = b.corridor(150, 0, 6, [[4, 0, 0], [6, 0.5, 0.5], [4, 0, 0], [6, -0.5, -0.5], [4, 0, 0.5], [4, 0, 0],
      [6, 0.5, 0], [4, 0, 0], [6, -0.5, -0.5], [4, 0, 0], [6, 0.5, 0.5], [4, 0, 0], [4, 0, -0.5], [5, 0, 0]]);
    b.saw(174, 3.5, 1.5);      // zona ancha: pasar por arriba o por abajo
    b.saw(185, 5, 1.5);
    b.coin(186, 7);            // arriba del todo, entre la sierra y el techo
    // el embudo final deja un hueco de 3 (y 3..6) y el portal de onda ocupa todo el hueco
    b.portal(t.x - 3, 4, 'wave', { floor: 0 });

    // D · onda a 3x: el pasillo sigue al embudo sin escalones
    b.color(t.x - 3, '#2a0505', '#150202', { line: '#ff5a2a', obj: '#ffd08f' });
    b.pulse(t.x - 3, '#ff5a2a', 3);
    const w = b.corridor(t.x, t.f, t.c, [[1, 0, 1], [2, 1, 1], [4, -1, -1], [3, 1, 1], [2, -1, -1], [4, 1, 1], [3, -1, -1],
      [2, 1, 1], [5, -1, -1], [3, 1, 1], [2, -1, -1], [2, -0.5, -1], [7, 0, 0]]);
    b.coin(t.x + 18, 5);
    b.portal(w.x - 5, 1, 'ball');

    // E · bola a 3x sobre raíles con huecos arriba y abajo (en cada hueco, pinchos)
    const e = w.x;
    b.color(e, '#2e0b0b', '#190505', { line: '#ff6b3d', obj: '#ffb08f' });
    b.pulse(e + 1, '#ff6b3d', 3);
    // abajo el suelo con fosos de pinchos; arriba un raíl con huecos (y pinchos colgando en cada hueco)
    // entre un hueco de abajo y uno de arriba hay al menos 8 bloques: lo que tarda la bola en cambiar de lado
    const holes = [[8, 'f', 3], [19, 'c', 3], [30, 'f', 3], [41, 'c', 3], [52, 'f', 3]];
    let cx = e;
    for (const [dx, side, len] of holes) {
      const hx = e + dx;
      if (side === 'f') b.spikes(hx, len);
      else { if (hx > cx) b.block(cx, 7, hx - cx, 1); b.spikes(hx, len, 7, 180); cx = hx + len; }
    }
    b.block(cx, 7, e + 72 - cx, 1);
    // pinchos colgando al final: obliga a ir por abajo hasta el portal de ovni
    b.spikes(e + 65, 6, 6, 180);
    b.portal(e + 68, 1, 'unflip');   // la bola puede llegar a medio cambio: el ovni empieza siempre normal
    b.portal(e + 70, 1, 'ufo', { floor: 0 });

    // F · ovni a 3x entre sierras que flotan, con pinchos abajo y arriba
    const f = e + 72;
    b.color(f, '#2e0b1f', '#190510', { line: '#ffb13b', obj: '#ffd08f' });
    b.pulse(f, '#ffb13b', 3);
    b.spikes(f + 4, 48);
    b.spikes(f + 4, 48, 9, 180);
    for (const [dx, y, size] of [[8, 2, 1.5], [15, 6, 1.5], [22, 3, 2], [29, 7, 1], [35, 4, 1.5], [42, 2, 1], [48, 6, 1.5]]) b.saw(f + dx, y, size);
    b.coin(f + 32, 6.5);
    // embudo suave de rampas de techo (2×1) hasta el portal de cubo, a ras de suelo
    b.corridor(f + 56, 0, 10, [[14, 0, -0.5], [8, 0, 0]]);
    b.speed(f + 72, 1, 4);
    b.portal(f + 73, 1, 'unflip');
    b.portal(f + 75, 1, 'cube');

    // G · cubo a 4x: colinas finales y meta
    const g = f + 81;
    b.color(g, '#140208', '#0a0104', { line: '#ff2a3a', obj: '#ffb08f' });
    b.pulse(g + 1, '#ff2a3a', 4);
    b.corridor(g + 6, 0, null, [[3, 0.5, 0], [10, 0, 0], [3, -0.5, 0]]);
    b.spike(g + 14, 1.5);
    b.spikes(g + 24, 2);
    b.saw(g + 33, 0, 1.5);
    b.spike(g + 42);
    b.color(g + 52, '#24040a', '#120205', { line: '#ff2a3a', obj: '#ffb08f' });
    return b.build(g + 60);
  }

  // ------------------------------------------------------------------ 8
  // Los modos que faltaban: robot (salto de altura variable), araña (teletransporte al otro lado),
  // columpio (cada toque invierte la gravedad) y una sección dual con un gemelo en el techo.
  function telarana() {
    const b = new Builder({
      id: 'telarana',
      card: '#2fd6b5',
      theme: 'original',
      name: 'Telaraña',
      difficulty: 'Difícil',
      stars: 6,
      song: 'espejo',
      bpm: 160,
    });

    // A · cubo de calentamiento
    b.color(0, '#14324a', '#0b1f30', { line: '#9ff7e6' });
    b.deco(10, 4, 'glow', { r: 4, color: '#2fd6b5' });
    b.spike(12);
    b.spikes(17, 2);

    // B · robot: saltitos bajo techos bajos y saltos largos manteniendo
    b.color(22, '#1d4a3a', '#112e24', { line: '#c9ffe9' });
    b.pulse(24, '#c9ffe9', 3);
    b.portal(24, 1, 'robot');
    b.hint(27, 4.5, 'Robot: cuanto más mantienes, más alto saltas');
    b.spikes(32, 2);
    b.block(39, 0, 3, 2);          // sólo se sube manteniendo
    b.block(47, 3, 8, 1);          // techo bajo: aquí basta un toque corto
    b.spike(50);
    b.spikes(59, 3);               // foso largo: salto completo
    b.block(66, 0, 2, 1);
    b.block(68, 0, 2, 2);
    b.block(70, 0, 3, 3);
    b.spikes(73, 2);

    // C · araña entre suelo y techo
    b.color(84, '#3a1d4a', '#22102e', { line: '#f0c9ff' });
    b.pulse(88, '#f0c9ff', 3);
    b.block(84, 5, 66, 1);         // techo de la sección
    b.portal(88, 1, 'spider');
    b.hint(90, 3.4, 'Araña: toca para saltar al otro lado');
    b.spikes(96, 2);
    b.spikes(104, 2, 4, 180);
    b.spikes(111, 3);
    b.coin(113, 4);                // por el techo
    b.spikes(118, 2, 4, 180);
    b.block(124, 3, 6, 2);         // el techo baja: hay que pegarse a él
    b.spikes(126, 3);
    b.spikes(136, 2, 4, 180);
    b.spikes(142, 2);
    // embudo: el techo baja a 3 y el portal de columpio ocupa todo el hueco
    b.corridor(150, 0, 5, [[2, 0, -1], [3, 0, 0]], 6);
    b.portal(153, 1, 'swing', { floor: 0 });

    // D · columpio entre columnas
    b.color(153, '#4a3a14', '#2e240b', { line: '#fff0b0' });
    b.pulse(154, '#fff0b0', 3);
    b.hint(157, 1.6, 'Columpio: cada toque invierte la gravedad');
    b.corridor(155, 0, 3, [[6, 0, 1]], 10);
    // [x, fila inferior del hueco, alto del hueco]
    for (const [x, lo, size] of [[166, 1, 4], [173, 5, 4], [180, 2, 4], [187, 5, 4], [194, 1, 4], [201, 4, 4], [208, 2, 4]]) {
      if (lo > 0) b.block(x, 0, 2, lo);
      b.block(x, lo + size, 2, 10 - (lo + size));
    }
    b.coin(190, 7);
    // embudo hasta el portal de cubo, a ras de suelo; el gravedad normal va detrás (el cubo no la cambia solo)
    b.corridor(214, 0, 10, [[7, 0, -1], [6, 0, 0]], 10);
    b.portal(222, 1, 'cube');
    b.portal(224, 1, 'unflip');

    // E · dual: un gemelo en el techo salta a la vez, en espejo
    b.color(227, '#4a1424', '#2e0b16', { line: '#ffc9d8' });
    b.corridor(227, 0, 3, [[4, 0, 1]], 10);
    b.block(231, 7, 60, 3);
    b.pulse(234, '#ffc9d8', 4);
    b.portal(234, 1, 'dual');
    b.hint(237, 3.6, 'Dual: los dos saltan a la vez');
    b.spike(244);
    b.spike(250, 6, 180);
    b.spikes(256, 2);
    b.spikes(256, 2, 6, 180);
    b.block(263, 0, 3, 1);
    b.spikes(270, 2, 6, 180);
    b.spike(276);
    b.spike(281, 6, 180);
    b.portal(288, 1, 'single');

    // F · final
    b.color(291, '#14324a', '#0b1f30', { line: '#9ff7e6' });
    b.spikes(298, 2);
    b.spike(305);

    b.palette('obj', ['#ffd23a', '#7dff5a', '#ff9f3b', '#3bd8ff', '#ff5d8f', '#ffd23a']);
    return b.build(314);
  }

  const list = [primerPulso(), orbita(), faseDoble(), ladera(), espejo(), abismo(), banoDeSangre(), telarana()];

  const api = { Builder, list };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Levels = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
