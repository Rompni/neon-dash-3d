/*
 * NEON DASH — música y efectos sintetizados con Web Audio.
 * Todo se genera en tiempo real: no hay archivos de audio.
 */
(function (root) {
  'use strict';

  const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function midi(name) {
    const m = /^([A-G]#?)(-?\d)$/.exec(name);
    return 12 * (Number(m[2]) + 1) + NOTE[m[1]];
  }
  function freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // Frase: 16 pasos por compás. "." silencio, "-" prolonga la nota anterior.
  function phrase(str) {
    const toks = str.trim().split(/\s+/);
    const out = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t === '.' || t === '-') continue;
      let len = 1;
      while (toks[i + len] === '-') len++;
      out.push({ step: i, midi: midi(t), len });
    }
    return out;
  }

  const CHORDS = {
    Am: { root: 45, tones: [57, 60, 64] },
    F: { root: 41, tones: [53, 57, 60] },
    C: { root: 48, tones: [55, 60, 64] },
    G: { root: 43, tones: [55, 59, 62] },
    Dm: { root: 50, tones: [53, 57, 62] },
    Em: { root: 52, tones: [55, 59, 64] },
    E: { root: 40, tones: [56, 59, 64] },
    Bb: { root: 46, tones: [53, 58, 62] },
    D: { root: 50, tones: [54, 57, 62] },
    A: { root: 45, tones: [57, 61, 64] },
    B: { root: 47, tones: [59, 63, 66] },
  };

  // Melodías (16 pasos por compás). Cada canción tiene las suyas.
  const MEL = {
    pulsoA: ['A4 . C5 . E5 . A5 . G5 . E5 . C5 . D5 E5', 'F5 - - . E5 . C5 . A4 - - . C5 . E5 .', 'G5 . E5 . C5 . G4 . C5 . E5 . G5 . A5 G5', 'B4 - - . D5 - - . G5 - . D5 . B4 . .'],
    pulsoB: ['E5 E5 . E5 . C5 . A4 . C5 . E5 . A5 . G5', 'F5 . . C5 . F5 . A5 - - . G5 . F5 . E5', 'E5 . . G5 . C6 - - . B5 . G5 . E5 . .', 'D5 . G5 . B5 . D6 - - - . B5 . G5 D5 .'],
    orbita: ['E5 - - - . . A5 - - - . . G5 - E5 -', 'F5 - - - - - . . C6 - - - A5 - - -', 'G5 - - - . . E5 - - - . . C5 - D5 -', 'B4 - - - D5 - - - G5 - - - - - . .'],
    orbitaB: ['A5 - . C6 - . E6 - - - D6 - C6 - B5 -', 'A5 - - - - - . . F5 - A5 - C6 - - -', 'G5 - . C6 - . E6 - - - D6 - C6 - G5 -', 'B5 - - - - - - - D6 - - - B5 - . .'],
    fase: ['A5 . . A5 . . C6 . . . B5 . A5 . . .', 'F5 . . F5 . . A5 . . . G5 . F5 . E5 .', 'G5 . . G5 . . C6 . . . B5 . G5 . . .', 'D5 . . D5 . . G5 . . . F#5 . D5 . B4 .'],
    ladera: ['E5 . G5 . C6 . G5 . E5 . C5 . D5 . E5 .', 'D5 . G5 . B5 . D6 - - . B5 . G5 . D5 .', 'C6 . B5 . A5 . E5 . A5 . C6 . E6 - - .', 'F5 - . A5 . C6 - . A5 . F5 . G5 . A5 B5'],
    laderaB: ['C6 C6 . G5 . E5 . G5 . C6 . E6 . D6 C6 .', 'B5 B5 . G5 . D5 . G5 . B5 . D6 . C6 B5 .', 'A5 A5 . E5 . C5 . E5 . A5 . C6 . B5 A5 .', 'F5 . A5 . C6 . F6 - - . E6 . D6 . C6 .'],
    espejo: ['A4 . A4 . C5 . A4 . E5 . D5 . C5 . B4 .', 'A4 . A4 . C5 . A4 . F5 . E5 . C5 . A4 .', 'G4 . G4 . C5 . G4 . E5 . D5 . C5 . G4 .', 'B4 . B4 . D5 . B4 . G5 . F5 . D5 . B4 .'],
    sangreA: ['E5 . G5 . B5 . E6 . D#6 . B5 . G5 . F#5 G5', 'C6 - - . B5 . G5 . E5 - - . G5 . C6 .', 'A5 . C6 . E6 - . D6 . C6 . A5 . B5 C6', 'B5 - - . F#5 - - . D#5 - . F#5 . B5 . .'],
    sangreB: ['E6 E6 . B5 . G5 . E5 . G5 . B5 . E6 . D#6', 'C6 . . G5 . C6 . E6 - - . D6 . C6 . B5', 'A5 A5 . E5 . A5 . C6 . E6 . A6 - - . .', 'B5 . D#6 . F#6 . B6 - - . F#6 . D#6 . B5 .'],
    abismo: ['D5 . F5 . A5 . D6 . C6 . A5 . F5 . G5 A5', 'A#5 - - . A5 . F5 . D5 - - . F5 . A5 .', 'C6 . A5 . F5 . C5 . F5 . A5 . C6 . D6 C6', 'A5 - - . E5 - - . A5 - . E5 . C#5 . .'],
  };
  for (const k in MEL) MEL[k] = MEL[k].map(phrase);

  /*
   * Canciones. Cada una define su sonido (`sound`) y sus secciones.
   * Patrones de 16 pasos: batería con "x"; bajo con R (raíz), O (octava), 5 (quinta), "-" (mantener) y "." (silencio).
   * `prog` está en la tonalidad de referencia de su melodía; `transpose` mueve acordes y melodía a la vez.
   */
  const SONGS = {
    // Electro-pop luminoso: bombo a negras, bajo de sierra en corcheas, lead cuadrado.
    pulso: {
      gain: 1.0, bpm: 155.79, prog: ['Am', 'F', 'C', 'G'],
      sound: {
        kick: { f0: 150, f1: 42, dec: 0.32 }, snare: 'snare', hat: { hp: 8000, dec: 0.045 },
        bass: { wave: 'sawtooth', cutoff: 520, sweep: 0.6, q: 4, v: 0.22, d: 0.08, s: 0.5, detune: [-6, 6] },
        lead: { wave: 'square', cutoff: 3200, sweep: 0.5, q: 2, v: 0.085, d: 0.1, s: 0.55, r: 0.06, detune: [-5, 5] },
        lead2: { wave: 'triangle', cutoff: 5000, v: 0.05, d: 0.1, s: 0.5, r: 0.06, oct: 12 },
        arp: { wave: 'square', cutoff: 2600, sweep: 0.4, v: 0.05, d: 0.06, s: 0.2, r: 0.04, oct: 12, mode: 'updown', rate: 1 },
        pad: { wave: 'sawtooth', cutoff: 1100, q: 0.5, v: 0.035, a: 0.12, d: 0.4, s: 0.7, r: 0.3, detune: [-12, 9] },
      },
      sections: [
        { bars: 4, kick: 'x.......x.......', hat: '..x...x...x...x.', bass: 'R...............', pad: 1 },
        { bars: 8, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'R.R.O.R.R.R.O.R.', lead: 'pulsoA', pad: 1 },
        { bars: 4, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', bass: 'R.R.O.R.R.R.O.R.', arp: 1, lead: 'pulsoB' },
        { bars: 4, kick: 'x..x..x...x..x..', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.', bass: '..O...O...O...O.', arp: 1, pad: 1 },
        { bars: 4, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', bass: 'R.R.O.R.R.R.O.R.', lead: 'pulsoB', lead2: 1, pad: 1 },
        { bars: 2, kick: 'x...............', pad: 1 },
      ],
    },
    // Synthwave espacial: batería a medio tiempo, sub-bajo, lead triangular con eco largo.
    orbita: {
      gain: 0.8, bpm: 150, prog: ['Am', 'F', 'C', 'G'], transpose: 5,
      sound: {
        delay: { time: 0.75, fb: 0.45, mix: 0.4, tone: 2200 },
        kick: { f0: 120, f1: 38, dec: 0.45 }, snare: 'clap', hat: { hp: 9000, dec: 0.03 },
        bass: { wave: 'sine', cutoff: 900, v: 0.34, a: 0.01, d: 0.3, s: 0.8, r: 0.2 },
        lead: { wave: 'triangle', cutoff: 4000, v: 0.13, a: 0.04, d: 0.3, s: 0.7, r: 0.35, send: 0.6, vib: 5 },
        lead2: { wave: 'sine', cutoff: 6000, v: 0.05, a: 0.05, d: 0.3, s: 0.6, r: 0.3, oct: 12, send: 0.5 },
        arp: { wave: 'triangle', cutoff: 3000, v: 0.05, d: 0.12, s: 0.2, r: 0.1, oct: 12, mode: 'up', rate: 2, send: 0.7 },
        pad: { wave: 'sawtooth', cutoff: 900, q: 0.3, v: 0.05, a: 0.6, d: 0.8, s: 0.8, r: 1.2, detune: [-18, -6, 7, 16], send: 0.3 },
      },
      sections: [
        { bars: 2, hat: '....x.......x...', bass: 'R---------------', pad: 1, arp: 1 },
        { bars: 8, kick: 'x.........x.....', snare: '........x.......', hat: '..x...x...x...x.', bass: 'R-------R---O---', lead: 'orbita', pad: 1 },
        { bars: 8, kick: 'x.........x.....', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.', bass: 'R---R---O---R-5-', arp: 1, lead: 'orbitaB', pad: 1 },
        { bars: 8, kick: 'x...x.....x.....', snare: '........x.......', hat: 'x.xxx.x.x.xxx.x.', bass: 'R-------R---O---', arp: 1, pad: 1, lead: 'orbita', lead2: 1 },
        { bars: 2, pad: 1 },
      ],
    },
    // Drum & bass: break sincopado, bajo "reese" desafinado, stabs de acordes.
    fase: {
      gain: 0.8, bpm: 170, prog: ['Am', 'F', 'C', 'G'], transpose: -5, swing: 0.08,
      sound: {
        kick: { f0: 160, f1: 45, dec: 0.25, click: 1 }, snare: 'snare', snareTone: 210, hat: { hp: 7000, dec: 0.03 },
        bass: { wave: 'sawtooth', cutoff: 280, q: 2, v: 0.26, a: 0.01, d: 0.4, s: 0.85, r: 0.1, detune: [-28, 0, 26], oct: -12 },
        stab: { wave: 'sawtooth', cutoff: 2400, sweep: 0.3, q: 3, v: 0.06, d: 0.08, s: 0.1, r: 0.05, detune: [-8, 8] },
        lead: { wave: 'square', cutoff: 2800, sweep: 0.4, q: 3, v: 0.07, d: 0.09, s: 0.25, r: 0.05 },
        arp: { wave: 'square', cutoff: 3600, sweep: 0.3, v: 0.04, d: 0.04, s: 0.1, r: 0.03, oct: 24, mode: 'down', rate: 1 },
      },
      sections: [
        { bars: 2, hat: 'x.x.x.x.x.x.x.x.', bass: 'R---------------', arp: 1 },
        { bars: 8, kick: 'x.........x.....', snare: '....x..x....x...', hat: 'x.xxx.x.x.xxx.xx', bass: 'R-------R-----O-', stab: '..x.....x.....x.', lead: 'fase' },
        { bars: 8, kick: 'x.........xx....', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', bass: 'R---R-------O---', stab: '..x...x...x.....', arp: 1 },
        { bars: 8, kick: 'x.........x.....', snare: '....x..x....x...', hat: 'x.xxx.x.x.xxx.xx', bass: 'R-------R-----O-', stab: '..x.....x.....x.', lead: 'fase', arp: 1 },
        { bars: 2, kick: 'x...............', bass: 'R---------------' },
      ],
    },
    // Chiptune saltarín: bajo triangular de 8 bits, percusión de ruido corto, arpegios rápidos.
    ladera: {
      gain: 1.5, bpm: 140, prog: ['C', 'G', 'Am', 'F'], transpose: -5, swing: 0.12,
      sound: {
        kick: { f0: 220, f1: 60, dec: 0.12 }, snare: 'chip', hat: { hp: 10000, dec: 0.02 },
        bass: { wave: 'triangle', cutoff: 8000, v: 0.3, a: 0.002, d: 0.05, s: 0.9, r: 0.02, oct: -12 },
        lead: { wave: 'square', cutoff: 9000, v: 0.075, a: 0.002, d: 0.05, s: 0.75, r: 0.02, vib: 6 },
        lead2: { wave: 'square', cutoff: 9000, v: 0.035, a: 0.002, d: 0.05, s: 0.75, r: 0.02, oct: -12 },
        arp: { wave: 'square', cutoff: 9000, v: 0.035, a: 0.002, d: 0.03, s: 0.5, r: 0.01, oct: 24, mode: 'up', rate: 1 },
      },
      sections: [
        { bars: 2, hat: 'x.x.x.x.x.x.x.x.', bass: 'R.O.R.O.R.O.R.O.', arp: 1 },
        { bars: 8, kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'R.O.R.O.R.O.R.O.', lead: 'ladera' },
        { bars: 8, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', bass: 'R.O.5.O.R.O.5.O.', lead: 'laderaB', lead2: 1, arp: 1 },
        { bars: 6, kick: 'x.......x.......', snare: '....x.......x.x.', hat: 'x.x.x.x.x.x.x.x.', bass: 'R.O.R.O.R.O.R.O.', lead: 'ladera', arp: 1 },
        { bars: 2, kick: 'x...............', bass: 'R...............' },
      ],
    },
    // Electro oscuro: bajo ácido resonante en semicorcheas, palmas y charles abiertos a contratiempo.
    espejo: {
      gain: 0.82, bpm: 160, prog: ['Am', 'F', 'C', 'G'], transpose: 2,
      sound: {
        delay: { time: 0.375, fb: 0.3, mix: 0.25, tone: 1800 },
        kick: { f0: 140, f1: 40, dec: 0.3, drive: 2 }, snare: 'clap', hat: { hp: 9000, dec: 0.035 }, ohat: { hp: 7000, dec: 0.18 },
        bass: { wave: 'sawtooth', cutoff: 300, envAmt: 7, q: 13, v: 0.17, a: 0.003, d: 0.12, s: 0.2, r: 0.04, oct: -12 },
        lead: { wave: 'sawtooth', cutoff: 1800, sweep: 0.6, q: 4, v: 0.07, d: 0.15, s: 0.5, r: 0.1, detune: [-10, 10], send: 0.3 },
        pad: { wave: 'square', cutoff: 700, q: 0.5, v: 0.03, a: 0.3, d: 0.6, s: 0.7, r: 0.6, detune: [-9, 9] },
      },
      sections: [
        { bars: 2, kick: 'x...x...x...x...', ohat: '..x...x...x...x.', bass: '.RR.R.ORR.R.5.R.' },
        { bars: 8, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', ohat: '..x...x...x...x.', bass: '.RR.R.ORR.R.5.R.', lead: 'espejo', pad: 1 },
        { bars: 8, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', ohat: '..x...x...x...x.', bass: 'RRO.RR5.RRO.R5O.', lead: 'espejo' },
        { bars: 8, kick: 'x...x...x..xx...', snare: '....x.......x.x.', hat: 'x.x.x.x.x.x.x.x.', ohat: '..x...x...x...x.', bass: '.RR.R.ORR.R.5.R.', pad: 1, lead: 'espejo' },
        { bars: 2, kick: 'x...............', pad: 1 },
      ],
    },
    // Duro: bombo saturado, bajo "wobble" con LFO, lead supersierra y arpegios a semicorcheas.
    // Baño de Sangre: metal electrónico muy rápido, bombo doble y saw distorsionada.
    sangre: {
      gain: 0.4, bpm: 186, prog: ['Em', 'C', 'Am', 'B'],
      sound: {
        kick: { f0: 200, f1: 42, dec: 0.22, drive: 8, click: 1 }, snare: 'snare', snare2: 'clap', hat: { hp: 9000, dec: 0.025 },
        bass: { wave: 'sawtooth', cutoff: 650, q: 10, v: 0.18, a: 0.004, d: 0.15, s: 0.85, r: 0.04, oct: -12, lfo: { steps: 4, depth: 6 }, drive: 5, detune: [-9, 9] },
        lead: { wave: 'sawtooth', cutoff: 5200, sweep: 0.8, q: 1.4, v: 0.045, d: 0.12, s: 0.55, r: 0.06, detune: [-24, -12, 0, 12], drive: 2 },
        lead2: { wave: 'square', cutoff: 3600, sweep: 0.5, v: 0.04, d: 0.08, s: 0.4, r: 0.05, detune: [-7, 7] },
        arp: { wave: 'square', cutoff: 3200, sweep: 0.3, v: 0.035, d: 0.035, s: 0.2, r: 0.03, oct: 12, mode: 'down', rate: 1 },
        pad: { wave: 'sawtooth', cutoff: 1200, q: 0.5, v: 0.03, a: 0.08, d: 0.5, s: 0.8, r: 0.3, detune: [-16, 16] },
        delay: { time: 0.75, fb: 0.25, mix: 0.18, tone: 2000 },
      },
      sections: [
        { bars: 2, kick: 'x.x.x.x.x.x.x.x.', hat: 'xxxxxxxxxxxxxxxx', bass: 'R.R.R.R.R.R.R.R.', arp: 1 },
        { bars: 8, kick: 'xxx.xxx.xxx.xxx.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'R-R-R-R-O-O-R---', lead: 'sangreA', pad: 1 },
        { bars: 8, kick: 'x.xxx.xxx.xxx.xx', snare: '....x..x....x..x', hat: 'xxxxxxxxxxxxxxxx', bass: 'RRRRRRRROOOOR-R-', arp: 1, lead: 'sangreB', lead2: 1 },
        { bars: 8, kick: 'xxxxxxxxxxxxxxxx', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'R-R-R-R-O-O-5-5-', arp: 1, pad: 1, lead: 'sangreA' },
        { bars: 2, kick: 'x...............', pad: 1 },
      ],
    },
    abismo: {
      gain: 0.42, bpm: 175, prog: ['Dm', 'Bb', 'F', 'A'],
      sound: {
        kick: { f0: 180, f1: 45, dec: 0.28, drive: 6, click: 1 }, snare: 'clap', snare2: 'snare', hat: { hp: 8000, dec: 0.03 },
        bass: { wave: 'sawtooth', cutoff: 500, q: 8, v: 0.18, a: 0.005, d: 0.2, s: 0.9, r: 0.05, oct: -12, lfo: { steps: 2, depth: 5 }, drive: 3, detune: [-7, 7] },
        lead: { wave: 'sawtooth', cutoff: 4200, sweep: 0.7, q: 1, v: 0.045, d: 0.15, s: 0.6, r: 0.08, detune: [-24, -12, 0, 12, 24] },
        arp: { wave: 'square', cutoff: 3000, sweep: 0.3, v: 0.04, d: 0.04, s: 0.2, r: 0.03, oct: 12, mode: 'updown', rate: 1 },
        pad: { wave: 'sawtooth', cutoff: 1400, q: 0.4, v: 0.03, a: 0.1, d: 0.5, s: 0.8, r: 0.3, detune: [-14, 14] },
      },
      sections: [
        { bars: 2, kick: 'x...x...x...x...', hat: 'xxxxxxxxxxxxxxxx', bass: '..O...O...O...O.', arp: 1 },
        { bars: 8, kick: 'x..x..x...x..x..', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', bass: 'R-------R---O---', lead: 'abismo', pad: 1 },
        { bars: 8, kick: 'x.x.x.x.x.x.x.x.', snare: '....x..x....x..x', hat: 'x.x.x.x.x.x.x.x.', bass: 'R---R---O-------', arp: 1, lead: 'abismo' },
        { bars: 8, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', bass: 'R-------R---O---', arp: 1, pad: 1, lead: 'abismo' },
        { bars: 2, kick: 'x...............', pad: 1 },
      ],
    },
  };

  // ----------------------------------------------------------- motor

  let ctx = null, master, musicBus, sfxBus, noise;
  let musicVol = 0.8, sfxVol = 0.8;
  let play = null; // reproducción en curso
  const curves = new Map();

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp);
    comp.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = musicVol;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxVol;
    sfxBus.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function resume() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }

  // Curva de saturación (tanh) cacheada por intensidad.
  function driveCurve(k) {
    if (curves.has(k)) return curves.get(k);
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); }
    curves.set(k, c);
    return c;
  }

  function env(g, t, a, peak, dec, sus, rel, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + dec);
    g.gain.setValueAtTime(Math.max(0.0001, peak * sus), Math.max(end, t + a + dec));
    g.gain.exponentialRampToValueAtTime(0.0001, Math.max(end, t + a + dec) + rel);
  }

  function kick(out, t, v, k) {
    k = k || {};
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(k.f0 || 150, t);
    o.frequency.exponentialRampToValueAtTime(k.f1 || 42, t + 0.12);
    const dec = k.dec || 0.32;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dec);
    o.connect(g);
    if (k.drive) {
      const ws = ctx.createWaveShaper();
      ws.curve = driveCurve(k.drive);
      g.connect(ws); ws.connect(out);
    } else g.connect(out);
    o.start(t); o.stop(t + dec + 0.02);
    if (k.click) noiseHit(out, t, v * 0.25, 'highpass', 3000, 0.7, 0.012);
  }

  function noiseHit(out, t, v, type, f, q, dur) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  function snare(out, t, v, kind, tone) {
    if (kind === 'clap') {
      for (let i = 0; i < 3; i++) noiseHit(out, t + i * 0.011, v * 0.55, 'bandpass', 1300, 1.2, 0.02);
      noiseHit(out, t + 0.033, v * 0.6, 'bandpass', 1200, 0.9, 0.18);
      return;
    }
    if (kind === 'chip') { noiseHit(out, t, v * 0.7, 'highpass', 1500, 0.5, 0.09); return; }
    noiseHit(out, t, v * 0.7, 'bandpass', 1900, 0.8, 0.16);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(tone || 240, t);
    o.frequency.exponentialRampToValueAtTime((tone || 240) * 0.66, t + 0.08);
    g.gain.setValueAtTime(v * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.12);
  }

  // Voz de sintetizador con filtro, envolventes, desafinado, vibrato, LFO de filtro, saturación y envío al eco.
  function synth(out, t, m, dur, o, p) {
    const g = ctx.createGain(), fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    const cut = o.cutoff || 2000;
    if (o.envAmt) {
      fl.frequency.setValueAtTime(cut * o.envAmt, t);
      fl.frequency.exponentialRampToValueAtTime(cut, t + Math.min(dur, 0.18));
    } else {
      fl.frequency.setValueAtTime(cut, t);
      if (o.sweep) fl.frequency.exponentialRampToValueAtTime(cut * o.sweep, t + dur);
    }
    fl.Q.value = o.q || 1;
    let last = fl;
    if (o.drive) {
      const ws = ctx.createWaveShaper();
      ws.curve = driveCurve(o.drive);
      fl.connect(ws);
      last = ws;
    }
    last.connect(g);
    g.connect(out);
    if (o.send && p && p.delayIn) {
      const sg = ctx.createGain();
      sg.gain.value = o.send;
      g.connect(sg);
      sg.connect(p.delayIn);
    }
    const end = t + dur;
    const rel = o.r || 0.08;
    env(g, t, o.a || 0.005, o.v, o.d || 0.12, o.s == null ? 0.6 : o.s, rel, end);
    const stopAt = end + rel + 0.05;
    if (o.lfo && p) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 1 / (o.lfo.steps * p.stepDur);
      lg.gain.value = cut * o.lfo.depth;
      lfo.connect(lg); lg.connect(fl.frequency);
      lfo.start(t); lfo.stop(stopAt);
    }
    const f0 = freq(m + (o.oct || 0));
    for (const det of o.detune || [0]) {
      const osc = ctx.createOscillator();
      osc.type = o.wave;
      osc.frequency.value = f0;
      osc.detune.value = det;
      if (o.vib) {
        const v = ctx.createOscillator(), vg = ctx.createGain();
        v.frequency.value = o.vib;
        vg.gain.setValueAtTime(0, t);
        vg.gain.linearRampToValueAtTime(f0 * 0.006, t + Math.min(0.25, dur));
        v.connect(vg); vg.connect(osc.frequency);
        v.start(t); v.stop(stopAt);
      }
      osc.connect(fl);
      osc.start(t); osc.stop(stopAt);
    }
  }

  // ------------------------------------------------------- secuenciador

  function songBars(song) {
    let n = 0;
    for (const s of song.sections) n += s.bars;
    return n;
  }

  function sectionAt(song, bar) {
    let b = bar;
    for (const s of song.sections) {
      if (b < s.bars) return { sec: s, inBar: b };
      b -= s.bars;
    }
    return null;
  }

  function scheduleStep(p, stepIdx, tBase) {
    const song = p.song, snd = song.sound;
    const bar = Math.floor(stepIdx / 16), st = stepIdx % 16;
    const found = sectionAt(song, bar);
    if (!found) { p.done = true; return; }
    const { sec, inBar } = found;
    const out = p.bus;
    const tr = song.transpose || 0;
    const chord = CHORDS[song.prog[bar % song.prog.length]];
    const stepDur = p.stepDur;
    // Swing: retrasa las semicorcheas pares.
    const t = tBase + (st % 2 === 1 ? (song.swing || 0) * stepDur * 2 : 0);

    if (sec.kick && sec.kick[st] === 'x') kick(out, t, 0.9, snd.kick);
    if (sec.snare && sec.snare[st] === 'x') {
      snare(out, t, 0.55, snd.snare, snd.snareTone);
      if (snd.snare2) snare(out, t, 0.35, snd.snare2, snd.snareTone);
    }
    if (sec.hat && sec.hat[st] === 'x') noiseHit(out, t, st % 4 === 2 ? 0.15 : 0.08, 'highpass', snd.hat.hp, 0.7, snd.hat.dec);
    if (sec.ohat && sec.ohat[st] === 'x' && snd.ohat) noiseHit(out, t, 0.11, 'highpass', snd.ohat.hp, 0.7, snd.ohat.dec);
    if (st === 0 && inBar === 0 && bar > 0) noiseHit(out, t, 0.16, 'highpass', 5000, 0.5, 0.9);

    // Bajo según patrón (R raíz, O octava, 5 quinta, "-" mantener).
    if (sec.bass && snd.bass) {
      const c = sec.bass[st];
      if (c && c !== '.' && c !== '-') {
        let len = 1;
        while (sec.bass[st + len] === '-') len++;
        const r = chord.root + tr;
        const note = c === 'O' ? r + 12 : c === '5' ? r + 7 : r;
        synth(out, t, note, stepDur * (len - 0.15), snd.bass, p);
      }
    }

    if (sec.pad && snd.pad && st === 0) {
      for (const m of chord.tones) synth(out, t, m + tr, stepDur * 15, snd.pad, p);
    }

    if (sec.stab && snd.stab && sec.stab[st] === 'x') {
      for (const m of chord.tones) synth(out, t, m + tr, stepDur * 1.2, snd.stab, p);
    }

    if (sec.arp && snd.arp) {
      const a = snd.arp;
      if (st % (a.rate || 1) === 0) {
        const tones = [chord.tones[0], chord.tones[1], chord.tones[2], chord.tones[0] + 12];
        const seq = a.mode === 'down' ? [3, 2, 1, 0] : a.mode === 'up' ? [0, 1, 2, 3] : [0, 1, 2, 3, 2, 1];
        const k = seq[Math.floor(st / (a.rate || 1)) % seq.length];
        synth(out, t, tones[k] + tr, stepDur * (a.rate || 1) * 0.9, a, p);
      }
    }

    if (sec.lead && snd.lead) {
      const ph = MEL[sec.lead][bar % MEL[sec.lead].length];
      for (const n of ph) {
        if (n.step !== st) continue;
        const dur = n.len * stepDur * 0.95;
        synth(out, t, n.midi + tr, dur, snd.lead, p);
        if (sec.lead2 && snd.lead2) synth(out, t, n.midi + tr, dur, snd.lead2, p);
      }
    }
  }

  function tick() {
    const p = play;
    if (!p || p.done || p.custom) return;
    while (p.nextTime < ctx.currentTime + 0.12) {
      scheduleStep(p, p.step, p.nextTime);
      p.step++;
      p.nextTime = p.t0 + p.step * p.stepDur - p.offset;
      if (p.done) break;
    }
  }

  // Empieza la canción en `offset` segundos. Devuelve el retardo (ms) hasta el primer tiempo.
  // Empieza la canción en `offset` segundos. Devuelve el retardo (ms) hasta el primer tiempo.
  // songId puede ser una canción sintetizada ('pulso'…) o una propia ('file:…', ya preparada con prepare()).
  function start(songId, offset) {
    if (!ensure()) return 0;
    stop();
    offset = offset || 0;
    const lead = 0.06;
    const bus = ctx.createGain();
    bus.connect(musicBus);
    if (typeof songId === 'string' && songId.startsWith('file:')) {
      const buf = buffers.get(songId);
      if (!buf) { bus.disconnect(); return 0; }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(bus);
      const when = ctx.currentTime + lead;
      // Desfase negativo: la canción empieza más tarde que el nivel.
      if (offset >= 0) src.start(when, Math.min(offset, buf.duration));
      else src.start(when - offset, 0);
      play = { custom: true, src, bus, done: false, timer: null };
      return lead * 1000;
    }
    const song = SONGS[songId];
    if (!song) { bus.disconnect(); return 0; }
    offset = Math.max(0, offset);
    const t0 = ctx.currentTime + lead;
    const stepDur = 60 / song.bpm / 4;
    const first = Math.ceil(offset / stepDur - 1e-6);
    bus.gain.value = song.gain || 1; // nivel igualado entre canciones
    play = { song, bus, t0, offset, stepDur, step: first, nextTime: t0 + first * stepDur - offset, done: false, timer: null };
    // Eco (delay con realimentación filtrada) si la canción lo usa.
    const dl = song.sound.delay;
    if (dl) {
      const din = ctx.createGain(), d = ctx.createDelay(2), fb = ctx.createGain(), lp = ctx.createBiquadFilter(), wet = ctx.createGain();
      d.delayTime.value = dl.time * (60 / song.bpm);
      fb.gain.value = dl.fb;
      lp.type = 'lowpass'; lp.frequency.value = dl.tone;
      wet.gain.value = dl.mix;
      din.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(bus);
      play.delayIn = din;
    }
    tick();
    play.timer = setInterval(tick, 25);
    return lead * 1000;
  }

  function stop(fade) {
    if (!play) return;
    const p = play;
    play = null;
    clearInterval(p.timer);
    const t = ctx.currentTime;
    p.bus.gain.setValueAtTime(p.bus.gain.value, t);
    p.bus.gain.linearRampToValueAtTime(0, t + (fade || 0.05));
    if (p.src) { try { p.src.stop(t + (fade || 0.05) + 0.02); } catch (e) { /* ya parada */ } }
    setTimeout(() => p.bus.disconnect(), ((fade || 0.05) + 0.5) * 1000);
  }

  // ------------------------------------------------- canciones propias
  // Se guardan en IndexedDB (no caben en localStorage) y se decodifican una vez.
  const buffers = new Map();
  const DB_NAME = 'neondash', STORE = 'songs';
  function db() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error('Este navegador no permite guardar canciones.')); return; }
      const req = root.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function dbDo(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, mode);
      const r = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(r && r.result);
      tx.onerror = () => reject(tx.error);
    });
  }
  function decode(data) {
    return new Promise((resolve, reject) => {
      const p = ctx.decodeAudioData(data, resolve, reject);
      if (p && p.then) p.then(resolve, reject);
    });
  }
  async function importSong(file) {
    if (!ensure()) throw new Error('El audio no está disponible en este navegador.');
    const data = await file.arrayBuffer();
    let buf;
    try { buf = await decode(data.slice(0)); } catch (e) { throw new Error('No se pudo leer el audio. Prueba con un MP3, OGG o WAV.'); }
    let h = 0;
    const id = file.name + ':' + file.size;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    const key = 'file:' + h.toString(36);
    buffers.set(key, buf);
    try { await dbDo('readwrite', (st) => st.put({ name: file.name, data }, key)); } catch (e) { /* se usa sólo en esta sesión */ }
    return { key, name: file.name, duration: buf.duration };
  }
  async function prepare(key) {
    if (!key || buffers.has(key)) return !!key;
    if (!ensure()) return false;
    try {
      const rec = await dbDo('readonly', (st) => st.get(key));
      if (!rec) return false;
      buffers.set(key, await decode(rec.data.slice(0)));
      return true;
    } catch (e) { return false; }
  }
  function isReady(key) { return buffers.has(key); }

  function setVolumes(m, s) {
    musicVol = m; sfxVol = s;
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(m, ctx.currentTime, 0.02);
    sfxBus.gain.setTargetAtTime(s, ctx.currentTime, 0.02);
  }

  function sfx(name) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.005;
    const out = sfxBus;
    if (name === 'death') {
      noiseHit(out, t, 0.7, 'lowpass', 1800, 0.7, 0.45);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(35, t + 0.4);
      g.gain.setValueAtTime(0.8, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + 0.5);
    } else if (name === 'checkpoint') {
      synth(out, t, 84, 0.06, { wave: 'triangle', cutoff: 6000, v: 0.18, d: 0.05, s: 0.4, r: 0.05 });
      synth(out, t + 0.06, 91, 0.08, { wave: 'triangle', cutoff: 6000, v: 0.18, d: 0.05, s: 0.4, r: 0.08 });
    } else if (name === 'complete') {
      [69, 72, 76, 81, 84, 88].forEach((m, i) => {
        synth(out, t + i * 0.07, m, 0.5, { wave: 'square', cutoff: 4000, sweep: 0.5, v: 0.08, d: 0.2, s: 0.5, r: 0.4 });
      });
    } else if (name === 'coin') {
      synth(out, t, 88, 0.08, { wave: 'square', cutoff: 6000, v: 0.09, d: 0.05, s: 0.5, r: 0.06 });
      synth(out, t + 0.07, 95, 0.18, { wave: 'square', cutoff: 6000, v: 0.09, d: 0.08, s: 0.5, r: 0.15 });
    } else if (name === 'click') {
      synth(out, t, 76, 0.03, { wave: 'square', cutoff: 3000, v: 0.06, d: 0.03, s: 0.2, r: 0.03 });
    }
  }

  function songLength(songId) {
    const s = SONGS[songId];
    return s ? songBars(s) * 4 * 60 / s.bpm : 0;
  }

  // Prueba: renderiza `secs` segundos de una canción sin sonar y mide nivel RMS y pico.
  async function renderTest(songId, secs, fromBar) {
    const song = SONGS[songId];
    const saved = ctx, savedNoise = noise;
    const off = new OfflineAudioContext(1, Math.round(44100 * secs), 44100);
    ctx = off;
    noise = off.createBuffer(1, off.sampleRate, off.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const bus = off.createGain();
    bus.gain.value = song.gain || 1;
    bus.connect(off.destination);
    const stepDur = 60 / song.bpm / 4;
    const p = { song, bus, stepDur, done: false };
    const first = (fromBar || 0) * 16;
    for (let k = 0; k * stepDur < secs - 0.05 && !p.done; k++) scheduleStep(p, first + k, k * stepDur);
    try {
      const buf = await off.startRendering();
      const x = buf.getChannelData(0);
      let sum = 0, peak = 0;
      for (let i = 0; i < x.length; i++) { sum += x[i] * x[i]; peak = Math.max(peak, Math.abs(x[i])); }
      return { rms: Math.sqrt(sum / x.length), peak };
    } finally {
      ctx = saved;
      noise = savedNoise;
    }
  }

  root.Sound = { resume, start, stop, sfx, setVolumes, songLength, importSong, prepare, isReady, renderTest, get ctx() { return ctx; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
