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
    // Triggers de grupo (ver sim.js): mueven, giran o apagan objetos de verdad (también sus choques).
    // inGroup(g, fn): los objetos y decorados que fn añada llevan el grupo g (b.inGroup(1, () => b.block(...))).
    inGroup(g, fn) {
      const n = this.objects.length, d = (this.decos || []).length;
      fn(this);
      const tag = (o) => { if (o.group == null) o.group = g; else if (o.group !== g) o.groups = Array.from(new Set([].concat(o.groups || [], g))); };
      this.objects.slice(n).forEach(tag);
      (this.decos || []).slice(d).forEach(tag);
      return this;
    },
    rotate(x, group, deg, dur, ease, center) { return this.trig(Object.assign({ kind: 'rotate', x, group, deg, dur: dur || 0, ease: ease || 'inout' }, center ? { cx: center[0], cy: center[1] } : {})); },
    alpha(x, group, alpha, dur) { return this.trig({ kind: 'alpha', x, group, alpha, dur: dur || 0 }); },
    toggle(x, group, on) { return this.trig({ kind: 'toggle', x, group, on: on !== false }); },
    // spawn: dispara los triggers con spawnOnly cuyo id (o grupo) es target, delay bloques después.
    spawn(x, target, delay) { return this.trig({ kind: 'spawn', x, target, delay: delay || 0 }); },
    // Un trigger que sólo se dispara con spawn (t lleva kind, group...; x da igual).
    spawnOnly(id, t) { return this.trig(Object.assign({ x: 0 }, t, { id, spawnOnly: true })); },
    follow(x, group, follower, dur, kx, ky) { return this.trig({ kind: 'follow', x, group, follower, dur: dur || 0, kx: kx == null ? 1 : kx, ky: ky == null ? 1 : ky }); },
    camzoom(x, zoom, dur, ease) { return this.trig({ kind: 'camzoom', x, zoom, dur: dur || 4, ease: ease || 'inout' }); },
    camoffset(x, dx, dy, dur, ease) { return this.trig({ kind: 'camoffset', x, dx, dy, dur: dur || 4, ease: ease || 'inout' }); },
    camrotate(x, deg, dur, ease) { return this.trig({ kind: 'camrotate', x, deg, dur: dur || 4, ease: ease || 'inout' }); },
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









  // ------------------------------------------------------------------ niveles 9-12: utilidades
  // Rejilla musical: x (en bloques) del compás `bar` + `beat` tiempos (4 por compás), sabiendo en qué compases
  // cambia la velocidad: tramos = [[compás, velocidad], ...] empezando por [0, v]. Así cada sección, cada
  // cambio de modo y cada drop caen justo al empezar un compás, y los saltos sobre los tiempos.
  const UPS = { 0.5: 251.16, 1: 311.58, 2: 387.42, 3: 468.0, 4: 576.0 };
  function rejilla(bpm, tramos) {
    const spb = 60 / bpm;
    return function (bar, beat) {
      const t = bar * 4 + (beat || 0);
      let x = 0;
      for (let i = 0; i < tramos.length; i++) {
        const a = tramos[i][0] * 4, e = i + 1 < tramos.length ? tramos[i + 1][0] * 4 : Infinity;
        if (t <= a) break;
        x += (Math.min(t, e) - a) * spb * UPS[tramos[i][1]] / 30;
      }
      return Math.round(x);
    };
  }

  // Rejilla de una canción real (tracks.js): x (bloques) donde suena el compás `bar` + `beat` tiempos.
  // El compás 0 empieza en Tracks.TRACKS[id].bar0 segundos (la música arranca a la vez que el nivel, x = 0).
  // tramos = [[compás, velocidad], ...] empezando por [0, v]: la velocidad cambia justo al empezar ese
  // compás (pon ahí el portal de velocidad, en x = r(compás)). r.bars: compases hasta el final del MP3.
  // r.end: x del final de la canción (pon ahí el final del nivel o muy cerca).
  function ritmo(id, tramos) {
    const T = (typeof module !== 'undefined' && module.exports ? require('./tracks.js') : root.Tracks).TRACKS[id];
    if (!T) throw new Error('canción desconocida: ' + id);
    const spb = 60 / T.bpm;
    const at = (bar) => T.bar0 + bar * 4 * spb;
    const xAt = (t) => {
      let x = 0, t0 = 0;
      for (let i = 0; i < tramos.length; i++) {
        const v = UPS[tramos[i][1]];
        const t1 = i + 1 < tramos.length ? at(tramos[i + 1][0]) : Infinity;
        if (t <= t1) return x + (t - t0) * v / 30;
        x += (t1 - t0) * v / 30; t0 = t1;
      }
      return x;
    };
    const r = (bar, beat) => Math.round(xAt(at(bar + (beat || 0) / 4)) * 2) / 2;
    r.exact = (bar, beat) => xAt(at(bar + (beat || 0) / 4));
    r.bars = Math.floor((T.dur - T.bar0) / (4 * spb));
    r.end = Math.floor(xAt(T.dur - 0.5));
    r.track = T;
    return r;
  }

  // Decorado de una sección: pilares al fondo con parallax, anillos y brillos, sin colisión.
  // Determinista (semilla por sección) para que el nivel sea siempre igual.
  function adornos(b, x0, x1, color, opts) {
    opts = opts || {};
    let seed = Math.floor(x0 * 7919 + 13) % 2147483647 || 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const step = opts.step || 7;
    for (let x = x0 + 2; x < x1 - 1; x += step + Math.floor(rnd() * 4)) {
      const k = rnd();
      if (k < 0.45) b.deco(x, 0, 'pillar', { w: 1 + Math.floor(rnd() * 2), h: 4 + Math.floor(rnd() * 7), color, par: 0.3 + rnd() * 0.3, alpha: 0.55 });
      else if (k < 0.7) b.deco(x, 5 + rnd() * 3, 'ring', { r: 1.5 + rnd() * 1.5, color, par: 0.4, alpha: 0.5 });
      else if (k < 0.85) b.deco(x, 4 + rnd() * 4, 'glow', { r: 3 + rnd() * 2, color, alpha: 0.5 });
      else b.deco(x, 6 + rnd() * 2, 'diamond', { r: 0.6 + rnd() * 0.5, color, beat: true });
    }
    if (opts.lines) for (let x = x0; x < x1 - 4; x += 12) b.deco(x, opts.lines, 'line', { w: 8, color, par: 0.5, alpha: 0.6 });
  }



  // Orden de los niveles en el menú. Cada uno vive en src/niveles/<id>.js.
  const ORDER = ['primer-pulso', 'orbita', 'fase-doble', 'ladera', 'espejo', 'abismo', 'bano-de-sangre', 'telarana', 'engranaje', 'vertigo', 'zigzag', 'apex'];
  const H = { Builder, rejilla, ritmo, adornos, UPS };
  const isNode = typeof module !== 'undefined' && module.exports;
  const list = ORDER.map((id) => (isNode ? require('./niveles/' + id + '.js') : root.NIVELES[id])(H));

  const api = { Builder, list, H, ORDER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Levels = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
