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
      gain: 0.72, bpm: 155.79, prog: ['Am', 'F', 'C', 'G'],
      sound: {
        pump: 0.55, delay: { time: 0.75, fb: 0.3, mix: 0.25, tone: 3000 },
        kick: { f0: 150, f1: 44, dec: 0.32, sub: 0.2 }, snare: 'snare', snare2: 'clap', hat: { hp: 8000, dec: 0.045 }, ohat: { hp: 7000, dec: 0.16 },
        bass: { wave: 'sawtooth', cutoff: 520, envAmt: 3, fdec: 0.1, q: 4, v: 0.15, d: 0.08, s: 0.5, detune: [-6, 6], sub: 0.16 },
        lead: { wave: 'sawtooth', saw: 7, spread: 38, width: 0.7, cutoff: 3600, envAmt: 2, fdec: 0.15, q: 1.5, v: 0.04, d: 0.12, s: 0.6, r: 0.12, send: 0.25, rev: 0.25 },
        lead2: { wave: 'square', cutoff: 5000, v: 0.035, d: 0.1, s: 0.5, r: 0.08, oct: 12, detune: [-8, 8], width: 0.6 },
        arp: { wave: 'sawtooth', cutoff: 2400, envAmt: 3, fdec: 0.08, q: 2, v: 0.045, d: 0.08, s: 0.15, r: 0.06, oct: 12, mode: 'updown', rate: 1, send: 0.3, detune: [-7, 7], width: 0.5 },
        pad: { wave: 'sawtooth', saw: 5, spread: 30, cutoff: 1400, q: 0.5, v: 0.022, a: 0.15, d: 0.4, s: 0.75, r: 0.4 },
        pluck: { wave: 'sawtooth', cutoff: 1200, envAmt: 5, fdec: 0.12, q: 3, v: 0.05, d: 0.15, s: 0.05, r: 0.15, oct: 12, send: 0.35, detune: [-6, 6], width: 0.6 },
      },
      sections: [
        { bars: 4, kick: 'x.......x.......', hat: '..x...x...x...x.', bass: 'R...............', pad: 1, pluck: 'x..x..x...x..x..', filter: [350, 6000], build: 1 },
        { bars: 8, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', ohat: '..x...x...x...x.', bass: 'R.R.O.R.R.R.O.R.', lead: 'pulsoA', pad: 1, build: 2 },
        { bars: 4, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', ohat: '..x...x...x...x.', bass: 'R.R.O.R.R.R.O.R.', arp: 1, lead: 'pulsoB', pluck: 'x..x..x...x..x..' },
        { bars: 4, kick: 'x..x..x...x..x..', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.', bass: '..O...O...O...O.', arp: 1, pad: 1, filter: [900, 20000], build: 2 },
        { bars: 4, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', ohat: '..x...x...x...x.', bass: 'R.R.O.R.R.R.O.R.', lead: 'pulsoB', lead2: 1, pad: 1, pluck: 'x..x..x...x..x..', fill: 'roll' },
        { bars: 2, kick: 'x...............', pad: 1, filter: [8000, 600] },
      ],
    },
    // Synthwave espacial: batería a medio tiempo, sub-bajo, lead triangular con eco largo.
    orbita: {
      gain: 0.8, bpm: 150, prog: ['Am', 'F', 'C', 'G'], transpose: 5,
      sound: {
        pump: 0.4, pumpRel: 0.8, delay: { time: 0.75, fb: 0.45, mix: 0.35, tone: 2200 },
        kick: { f0: 120, f1: 38, dec: 0.45, sub: 0.25 }, snare: 'clap', snare2: 'snare', snareTone: 180, hat: { hp: 9000, dec: 0.03 },
        bass: { wave: 'sawtooth', cutoff: 380, q: 1.5, v: 0.07, a: 0.01, d: 0.3, s: 0.8, r: 0.2, detune: [-8, 8], sub: 0.17 },
        lead: { wave: 'sawtooth', saw: 5, spread: 22, width: 0.6, cutoff: 2600, q: 1, v: 0.05, a: 0.03, d: 0.3, s: 0.7, r: 0.35, send: 0.5, rev: 0.35, vib: 5 },
        lead2: { wave: 'triangle', cutoff: 6000, v: 0.05, a: 0.05, d: 0.3, s: 0.6, r: 0.3, oct: 12, send: 0.5, rev: 0.4 },
        arp: { wave: 'triangle', cutoff: 3000, v: 0.05, d: 0.12, s: 0.2, r: 0.1, oct: 12, mode: 'up', rate: 2, send: 0.7, range: 2 },
        pad: { wave: 'sawtooth', saw: 6, spread: 34, cutoff: 1000, q: 0.3, v: 0.024, a: 0.6, d: 0.8, s: 0.8, r: 1.2, send: 0.2, rev: 0.5 },
      },
      sections: [
        { bars: 2, hat: '....x.......x...', bass: 'R---------------', pad: 1, arp: 1, filter: [300, 5000], riser: 2 },
        { bars: 8, kick: 'x.........x.....', snare: '........x.......', hat: '..x...x...x...x.', bass: 'R-------R---O---', lead: 'orbita', pad: 1, drop: 1, fill: 'roll' },
        { bars: 8, kick: 'x.........x.....', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.', bass: 'R---R---O---R-5-', arp: 1, lead: 'orbitaB', pad: 1, build: 2, buildHp: 350 },
        { bars: 8, kick: 'x...x.....x.....', snare: '........x.......', hat: 'x.xxx.x.x.xxx.x.', bass: 'R-------R---O---', arp: 1, pad: 1, lead: 'orbita', lead2: 1 },
        { bars: 2, pad: 1, filter: [6000, 400] },
      ],
    },
    // Drum & bass: break sincopado, bajo "reese" desafinado, stabs de acordes.
    fase: {
      gain: 0.86, bpm: 170, prog: ['Am', 'F', 'C', 'G'], transpose: -5, swing: 0.08,
      sound: {
        pump: 0.4, delay: { time: 0.75, fb: 0.35, mix: 0.25, tone: 2500 },
        kick: { f0: 160, f1: 46, dec: 0.25, punch: 2 }, snare: 'snare', snareTone: 210, hat: { hp: 7000, dec: 0.03 }, ohat: { hp: 6500, dec: 0.12 },
        bass: { wave: 'sawtooth', cutoff: 320, q: 2.5, v: 0.08, a: 0.01, d: 0.4, s: 0.85, r: 0.1, detune: [-28, -10, 10, 26], width: 0.5, oct: -12, sub: 0.16, lfo: { steps: 16, depth: 0.8 }, drive: 1.5 },
        stab: { wave: 'sawtooth', saw: 4, spread: 26, cutoff: 1800, envAmt: 3, fdec: 0.12, q: 3, v: 0.035, d: 0.1, s: 0.1, r: 0.12, send: 0.4, rev: 0.3 },
        lead: { wave: 'square', cutoff: 2600, envAmt: 2, fdec: 0.1, q: 3, v: 0.055, d: 0.09, s: 0.3, r: 0.08, detune: [-6, 6], width: 0.5, send: 0.3 },
        arp: { wave: 'square', cutoff: 3600, sweep: 0.3, v: 0.03, d: 0.04, s: 0.1, r: 0.03, oct: 24, mode: 'down', rate: 1, send: 0.35 },
      },
      sections: [
        { bars: 2, hat: 'x.x.x.x.x.x.x.x.', bass: 'R---------------', arp: 1, filter: [500, 9000], build: 2 },
        { bars: 8, kick: 'x.........x.....', snare: '....x..x....x...', hat: 'x.xxx.x.x.xxx.xx', ohat: '......x.......x.', bass: 'R-------R-----O-', stab: '..x.....x.....x.', lead: 'fase', fill: 'roll' },
        { bars: 8, kick: 'x.........xx....', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', bass: 'R---R-------O---', stab: '..x...x...x.....', arp: 1, wobble: [8, 8, 4, 2], build: 2 },
        { bars: 8, kick: 'x.........x.....', snare: '....x..x....x...', hat: 'x.xxx.x.x.xxx.xx', ohat: '......x.......x.', bass: 'R-------R-----O-', stab: '..x.....x.....x.', lead: 'fase', arp: 1 },
        { bars: 2, kick: 'x...............', bass: 'R---------------', filter: [5000, 300] },
      ],
    },
    // Chiptune saltarín: bajo triangular de 8 bits, percusión de ruido corto, arpegios rápidos.
    ladera: {
      gain: 0.85, bpm: 140, prog: ['C', 'G', 'Am', 'F'], transpose: -5, swing: 0.12,
      sound: {
        pump: 0.25, delay: { time: 0.5, fb: 0.25, mix: 0.2, tone: 4000 },
        kick: { f0: 200, f1: 55, dec: 0.16, sub: 0.2 }, snare: 'chip', snare2: 'snare', snareTone: 260, hat: { hp: 10000, dec: 0.02 },
        bass: { wave: 'triangle', cutoff: 8000, v: 0.24, a: 0.002, d: 0.05, s: 0.9, r: 0.02, oct: -12, sub: 0.08 },
        lead: { wave: 'square', cutoff: 7000, v: 0.06, a: 0.002, d: 0.05, s: 0.75, r: 0.04, vib: 6, detune: [-5, 5], width: 0.4, send: 0.25, rev: 0.15 },
        lead2: { wave: 'square', cutoff: 7000, v: 0.03, a: 0.002, d: 0.05, s: 0.75, r: 0.02, oct: -12 },
        arp: { wave: 'square', cutoff: 8000, v: 0.03, a: 0.002, d: 0.03, s: 0.5, r: 0.01, oct: 24, mode: 'up', rate: 1, send: 0.3 },
        pad: { wave: 'triangle', saw: 4, spread: 24, cutoff: 3000, v: 0.035, a: 0.2, d: 0.5, s: 0.7, r: 0.5 },
      },
      sections: [
        { bars: 2, hat: 'x.x.x.x.x.x.x.x.', bass: 'R.O.R.O.R.O.R.O.', arp: 1, filter: [600, 12000], riser: 1, fill: 'roll' },
        { bars: 8, kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'R.O.R.O.R.O.R.O.', lead: 'ladera', fill: 'roll' },
        { bars: 8, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', bass: 'R.O.5.O.R.O.5.O.', lead: 'laderaB', lead2: 1, arp: 1, pad: 1, build: 1, buildHp: 300 },
        { bars: 6, kick: 'x.......x.......', snare: '....x.......x.x.', hat: 'x.x.x.x.x.x.x.x.', bass: 'R.O.R.O.R.O.R.O.', lead: 'ladera', arp: 1, pad: 1 },
        { bars: 2, kick: 'x...............', bass: 'R...............', pad: 1, filter: [8000, 500] },
      ],
    },
    // Electro oscuro: bajo ácido resonante en semicorcheas, palmas y charles abiertos a contratiempo.
    espejo: {
      gain: 0.7, bpm: 160, prog: ['Am', 'F', 'C', 'G'], transpose: 2,
      sound: {
        pump: 0.5, delay: { time: 0.375, fb: 0.3, mix: 0.25, tone: 1800 },
        kick: { f0: 140, f1: 40, dec: 0.3, drive: 2, sub: 0.25 }, snare: 'clap', snare2: 'snare', snareTone: 190, hat: { hp: 9000, dec: 0.035 }, ohat: { hp: 7000, dec: 0.18 },
        bass: { wave: 'sawtooth', cutoff: 300, envAmt: 7, q: 13, v: 0.14, a: 0.003, d: 0.12, s: 0.2, r: 0.04, oct: -12, sub: 0.12, drive: 1.5 },
        lead: { wave: 'sawtooth', saw: 5, spread: 30, width: 0.6, cutoff: 1900, envAmt: 2.5, fdec: 0.15, q: 4, v: 0.04, d: 0.15, s: 0.5, r: 0.12, send: 0.35, rev: 0.25 },
        pad: { wave: 'square', saw: 4, spread: 24, cutoff: 800, q: 0.5, v: 0.02, a: 0.3, d: 0.6, s: 0.7, r: 0.6 },
        stab: { wave: 'sawtooth', saw: 3, spread: 20, cutoff: 900, envAmt: 6, fdec: 0.1, q: 6, v: 0.05, d: 0.1, s: 0.05, r: 0.1, send: 0.5 },
      },
      sections: [
        { bars: 2, kick: 'x...x...x...x...', ohat: '..x...x...x...x.', bass: '.RR.R.ORR.R.5.R.', filter: [400, 4000], build: 2, buildHp: 250 },
        { bars: 8, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', ohat: '..x...x...x...x.', bass: '.RR.R.ORR.R.5.R.', lead: 'espejo', pad: 1, fill: 'roll' },
        { bars: 8, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', ohat: '..x...x...x...x.', bass: 'RRO.RR5.RRO.R5O.', lead: 'espejo', stab: '...x.....x....x.', build: 2 },
        { bars: 8, kick: 'x...x...x..xx...', snare: '....x.......x.x.', hat: 'x.x.x.x.x.x.x.x.', ohat: '..x...x...x...x.', bass: '.RR.R.ORR.R.5.R.', pad: 1, lead: 'espejo', stab: '...x.....x....x.' },
        { bars: 2, kick: 'x...............', pad: 1, filter: [5000, 400] },
      ],
    },
    // Duro: bombo saturado, bajo "wobble" con LFO, lead supersierra y arpegios a semicorcheas.
    // Baño de Sangre: metal electrónico muy rápido, bombo doble y saw distorsionada.
    sangre: {
      gain: 0.44, bpm: 186, prog: ['Em', 'C', 'Am', 'B'],
      sound: {
        pump: 0.35, pumpRel: 0.4, delay: { time: 0.75, fb: 0.25, mix: 0.18, tone: 2000 },
        kick: { f0: 200, f1: 42, dec: 0.22, drive: 8 }, snare: 'snare', snare2: 'clap', hat: { hp: 9000, dec: 0.035 }, ohat: { hp: 7000, dec: 0.12 },
        bass: { wave: 'sawtooth', cutoff: 650, q: 10, v: 0.15, a: 0.004, d: 0.15, s: 0.85, r: 0.04, oct: -12, lfo: { steps: 4, depth: 6 }, drive: 5, detune: [-9, 9], sub: 0.14 },
        lead: { wave: 'sawtooth', saw: 7, spread: 40, width: 0.75, cutoff: 5200, sweep: 0.8, q: 1.4, v: 0.08, d: 0.12, s: 0.55, r: 0.08, drive: 2, rev: 0.2, send: 0.2 },
        lead2: { wave: 'square', cutoff: 3600, sweep: 0.5, v: 0.045, d: 0.08, s: 0.4, r: 0.05, detune: [-7, 7], width: 0.6 },
        arp: { wave: 'square', cutoff: 3200, envAmt: 2, fdec: 0.05, v: 0.05, d: 0.035, s: 0.2, r: 0.03, oct: 12, mode: 'down', rate: 1, send: 0.25 },
        pad: { wave: 'sawtooth', saw: 5, spread: 32, cutoff: 1300, q: 0.5, v: 0.02, a: 0.08, d: 0.5, s: 0.8, r: 0.3 },
      },
      sections: [
        { bars: 2, kick: 'x.x.x.x.x.x.x.x.', hat: 'xxxxxxxxxxxxxxxx', bass: 'R.R.R.R.R.R.R.R.', arp: 1, filter: [700, 12000], build: 2 },
        { bars: 8, kick: 'xxx.xxx.xxx.xxx.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', ohat: '..x...x...x...x.', bass: 'R-R-R-R-O-O-R---', lead: 'sangreA', pad: 1, fill: 'roll' },
        { bars: 8, kick: 'x.xxx.xxx.xxx.xx', snare: '....x..x....x..x', hat: 'xxxxxxxxxxxxxxxx', bass: 'RRRRRRRROOOOR-R-', arp: 1, lead: 'sangreB', lead2: 1, wobble: [4, 4, 2, 8], build: 2 },
        { bars: 8, kick: 'xxxxxxxxxxxxxxxx', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', ohat: '..x...x...x...x.', bass: 'R-R-R-R-O-O-5-5-', arp: 1, pad: 1, lead: 'sangreA' },
        { bars: 2, kick: 'x...............', pad: 1, filter: [6000, 400] },
      ],
    },
    abismo: {
      gain: 0.56, bpm: 175, prog: ['Dm', 'Bb', 'F', 'A'],
      sound: {
        pump: 0.5, delay: { time: 0.75, fb: 0.3, mix: 0.22, tone: 2200 },
        kick: { f0: 180, f1: 45, dec: 0.28, drive: 6 }, snare: 'clap', snare2: 'snare', hat: { hp: 8000, dec: 0.03 }, ohat: { hp: 7000, dec: 0.14 },
        bass: { wave: 'sawtooth', cutoff: 500, q: 8, v: 0.15, a: 0.005, d: 0.2, s: 0.9, r: 0.05, oct: -12, lfo: { steps: 2, depth: 5 }, drive: 3, detune: [-7, 7], width: 0.4, sub: 0.15 },
        lead: { wave: 'sawtooth', saw: 7, spread: 44, width: 0.75, cutoff: 4200, sweep: 0.7, q: 1, v: 0.06, d: 0.15, s: 0.6, r: 0.1, send: 0.25, rev: 0.25 },
        arp: { wave: 'square', cutoff: 3000, envAmt: 2, fdec: 0.06, v: 0.05, d: 0.04, s: 0.2, r: 0.03, oct: 12, mode: 'updown', rate: 1, send: 0.3 },
        pad: { wave: 'sawtooth', saw: 5, spread: 28, cutoff: 1500, q: 0.4, v: 0.02, a: 0.1, d: 0.5, s: 0.8, r: 0.3 },
      },
      sections: [
        { bars: 2, kick: 'x...x...x...x...', hat: 'xxxxxxxxxxxxxxxx', bass: '..O...O...O...O.', arp: 1, filter: [500, 10000], build: 2 },
        { bars: 8, kick: 'x..x..x...x..x..', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', bass: 'R-------R---O---', lead: 'abismo', pad: 1, build: 1 },
        { bars: 8, kick: 'x.x.x.x.x.x.x.x.', snare: '....x..x....x..x', hat: 'x.x.x.x.x.x.x.x.', ohat: '..x...x...x...x.', bass: 'R---R---O-------', arp: 1, lead: 'abismo', wobble: [2, 2, 1, 4, 2, 2, 1.5, 0.5], fill: 'roll' },
        { bars: 8, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', ohat: '..x...x...x...x.', bass: 'R-------R---O---', arp: 1, pad: 1, lead: 'abismo' },
        { bars: 2, kick: 'x...............', pad: 1, filter: [6000, 400] },
      ],
    },
  };

  // ----------------------------------------------------------- motor
  /*
   * Cadena de mezcla (por contexto):
   *   instrumentos melódicos → duck (sidechain) → paso alto/bajo de sección → bus de canción ┐
   *   batería → drums ────────────────────────────────────────────────────────────────────────┤→ musicBus ┐
   *   envíos: eco ping-pong a tempo (por canción) y reverb de convolución (global) ────────────┘           ├→ master → EQ → compresor → limitador → recorte suave → salida
   *   efectos → sfxBus ─────────────────────────────────────────────────────────────────────────────────────┘
   *
   * Campos opcionales nuevos (las canciones antiguas siguen funcionando sin ellos):
   *   sound.pump: 0..1 profundidad del bombeo (sidechain) al sonar el bombo (0.45 por defecto). sound.pumpRel: fracción de negra que tarda en recuperarse.
   *   instrumento: saw (nº de sierras del supersaw), spread (cents totales), width (0..1 estéreo), sub (nivel de la capa sub senoidal),
   *     subOct (octavas por debajo), envAmt + fdec (envolvente de filtro), rev (envío a reverb), send (envío al eco), mix (ganancia del bus),
   *     lfo: { steps, depth, shape } (wobble del filtro), filter ('lowpass' | 'bandpass' | 'highpass'); arp: range: 2 (dos octavas).
   *   kick: f0, f1, dec, drive, click (0 lo quita), sub (cola grave), punch.
   *   sección: build: n (últimos n compases: paso alto que adelgaza, riser y redoble; la siguiente sección entra con impacto; buildHp: Hz finales, 500),
   *     drop: 1 (impacto al empezar), filter: [desdeHz, hastaHz] (barrido de paso bajo en toda la sección), riser: n,
   *     fill: 'roll' | patrón de 16 (redoble en el último compás), wobble: pasos | [pasos por compás…] (0 = sin wobble),
   *     pump: profundidad, crash: 0 (sin platillo al empezar), pluck: patrón 'x' (notas del acorde en orden; instrumento sound.pluck).
   *   Comprobar niveles en el navegador: await Sound.renderAll(6) → pico/RMS por canción en tres puntos (render offline).
   */

  let ctx = null, master, musicBus, sfxBus, noise, revIn;
  let musicVol = 0.8, sfxVol = 0.8;
  let play = null; // reproducción en curso
  const curves = new Map();
  const stats = { nodes: 0 };

  // Valores por defecto según el papel del instrumento (se mezclan con los de la canción).
  // `mix`: ganancia del bus del instrumento (equilibrio frente a la batería).
  const ROLE = {
    bass: { width: 0, mix: 1 },
    pad: { rev: 0.35, width: 0.7, mix: 1.6 },
    lead: { rev: 0.2, width: 0.45, mix: 1.8 },
    lead2: { rev: 0.25, width: 0.5, mix: 1.6 },
    arp: { rev: 0.18, width: 0.3, mix: 1.6 },
    stab: { rev: 0.22, width: 0.5, mix: 1.6 },
    pluck: { rev: 0.25, width: 0.35, mix: 1.6 },
  };

  function makeNoise(c) {
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // Respuesta al impulso sintética: ruido estéreo con caída exponencial que se oscurece con el tiempo.
  function impulse(c, secs) {
    const n = Math.round(c.sampleRate * secs), b = c.createBuffer(2, n, c.sampleRate);
    const pre = Math.round(c.sampleRate * 0.012);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      for (let i = pre; i < n; i++) {
        const u = (i - pre) / (n - pre);
        lp += (Math.random() * 2 - 1 - lp) * (0.15 + 0.7 * (1 - u));
        d[i] = lp * Math.exp(-5.5 * u) * (1 - u);
      }
    }
    return b;
  }

  // Recorte suave final: lineal hasta 0.7 y curva tanh hasta ~0.93. Garantiza que nada pase de 1.
  function softClip() {
    if (curves.has('clip')) return curves.get('clip');
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
      c[i] = a < 0.7 ? x : Math.sign(x) * (0.7 + 0.3 * Math.tanh((a - 0.7) / 0.3));
    }
    curves.set('clip', c);
    return c;
  }

  function buildGraph(c) {
    const g = { noise: makeNoise(c) };
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 24; hp.Q.value = 0.7;
    const lo = c.createBiquadFilter(); lo.type = 'lowshelf'; lo.frequency.value = 110; lo.gain.value = 1.5;
    const hi = c.createBiquadFilter(); hi.type = 'highshelf'; hi.frequency.value = 9000; hi.gain.value = 2;
    const glue = c.createDynamicsCompressor();
    glue.threshold.value = -16; glue.knee.value = 8; glue.ratio.value = 3; glue.attack.value = 0.008; glue.release.value = 0.2;
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    const out = c.createGain(); out.gain.value = 0.85;
    const clip = c.createWaveShaper(); clip.curve = softClip();
    g.master = c.createGain();
    g.master.connect(hp); hp.connect(lo); lo.connect(hi); hi.connect(glue); glue.connect(lim); lim.connect(out); out.connect(clip); clip.connect(c.destination);
    g.clip = clip;
    g.musicBus = c.createGain(); g.musicBus.connect(g.master);
    g.sfxBus = c.createGain(); g.sfxBus.connect(g.master);
    // Reverb global de la música (su retorno pasa por el volumen de música).
    g.revIn = c.createGain();
    const rhp = c.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 280;
    const rlp = c.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 7000;
    const conv = c.createConvolver(); conv.buffer = impulse(c, 2.4);
    const ret = c.createGain(); ret.gain.value = 0.55;
    g.revIn.connect(rhp); rhp.connect(rlp); rlp.connect(conv); conv.connect(ret); ret.connect(g.musicBus);
    return g;
  }

  function install(g) { master = g.master; musicBus = g.musicBus; sfxBus = g.sfxBus; noise = g.noise; revIn = g.revIn; }

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    install(buildGraph(ctx));
    musicBus.gain.value = musicVol;
    sfxBus.gain.value = sfxVol;
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

  function osc(type, f) {
    stats.nodes++;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    if (f) o.frequency.value = f;
    return o;
  }

  // Envío (gain) de un nodo a otro; se desconecta con la fuente.
  function sendTo(from, to, amt) {
    if (!to || !amt) return;
    const s = ctx.createGain();
    s.gain.value = amt;
    from.connect(s); s.connect(to);
    return s;
  }

  function env(g, t, a, peak, dec, sus, rel, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + dec);
    g.gain.setValueAtTime(Math.max(0.0001, peak * sus), Math.max(end, t + a + dec));
    g.gain.exponentialRampToValueAtTime(0.0001, Math.max(end, t + a + dec) + rel);
  }

  // Golpe de ruido filtrado (charles, cajas, platillos). La reverb la pone el bus de salida.
  function noiseHit(out, t, v, type, f, q, dur) {
    stats.nodes++;
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    if (dur > 1.2) s.loop = true;
    fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out);
    s.onended = () => g.disconnect();
    s.start(t, Math.random() * 0.9); s.stop(t + dur + 0.02);
  }

  // Bombo en capas: cuerpo senoidal con barrido de tono + clic de ataque (+ cola sub opcional).
  function kick(out, t, v, k) {
    k = k || {};
    const f0 = k.f0 || 150, f1 = k.f1 || 42, dec = k.dec || 0.32;
    const o = osc('sine'), g = ctx.createGain();
    o.frequency.setValueAtTime(f0 * (k.punch || 1.6), t);
    o.frequency.exponentialRampToValueAtTime(f0, t + 0.008);
    o.frequency.exponentialRampToValueAtTime(f1 * 1.15, t + 0.07);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.18);
    // Con saturación, la envolvente entra al máximo en el tanh y el nivel se pone después (si no, el tanh lo subiría todo).
    const pk = k.drive ? 1 : v;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pk, t + 0.002);
    g.gain.setValueAtTime(pk, t + dec * 0.22);
    g.gain.exponentialRampToValueAtTime(0.001 * pk, t + dec);
    o.connect(g);
    let last = g;
    if (k.drive) {
      const ws = ctx.createWaveShaper(), post = ctx.createGain();
      ws.curve = driveCurve(k.drive);
      post.gain.value = v;
      g.connect(ws); ws.connect(post); last = post;
    }
    last.connect(out);
    o.onended = () => last.disconnect();
    o.start(t); o.stop(t + dec + 0.02);
    if (k.click !== 0) {
      noiseHit(out, t, v * 0.3, 'highpass', 4500, 0.7, 0.01);
      const c = osc('triangle'), cg = ctx.createGain();
      c.frequency.setValueAtTime(1800, t);
      c.frequency.exponentialRampToValueAtTime(400, t + 0.012);
      cg.gain.setValueAtTime(v * 0.25, t);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
      c.connect(cg); cg.connect(out);
      c.onended = () => cg.disconnect();
      c.start(t); c.stop(t + 0.02);
    }
    if (k.sub) {
      const s = osc('sine', f1), sg = ctx.createGain();
      sg.gain.setValueAtTime(0.0001, t);
      sg.gain.linearRampToValueAtTime(v * k.sub, t + 0.03);
      sg.gain.exponentialRampToValueAtTime(0.001, t + dec * 1.6);
      s.connect(sg); sg.connect(out);
      s.onended = () => sg.disconnect();
      s.start(t); s.stop(t + dec * 1.6 + 0.02);
    }
  }

  // Caja en capas: cuerpo tonal + ruido de banda media + chisporroteo agudo. Palmada: ráfagas + cola.
  // `wet`: bus con reverb para la cola (por defecto, el mismo).
  function snare(out, t, v, kind, tone, wet) {
    wet = wet || out;
    if (kind === 'clap') {
      for (let i = 0; i < 3; i++) noiseHit(out, t + i * 0.009, v * 0.8, 'bandpass', 1250 + i * 120, 1.4, 0.018);
      noiseHit(wet, t + 0.027, v * 0.95, 'bandpass', 1150, 0.9, 0.22);
      noiseHit(out, t, v * 0.35, 'highpass', 6000, 0.6, 0.06);
      return;
    }
    if (kind === 'chip') { noiseHit(out, t, v * 0.7, 'highpass', 1500, 0.5, 0.09); return; }
    tone = tone || 220;
    noiseHit(wet, t, v * 0.9, 'bandpass', 2000, 0.7, 0.18);
    noiseHit(out, t, v * 0.5, 'highpass', 6500, 0.6, 0.09);
    const o = osc('triangle'), g = ctx.createGain();
    o.frequency.setValueAtTime(tone * 1.4, t);
    o.frequency.exponentialRampToValueAtTime(tone, t + 0.02);
    o.frequency.exponentialRampToValueAtTime(tone * 0.7, t + 0.1);
    g.gain.setValueAtTime(v * 0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(out);
    o.onended = () => g.disconnect();
    o.start(t); o.stop(t + 0.14);
  }

  // Voz de sintetizador: supersaw/desafinado, filtro con envolvente o barrido, wobble (LFO), saturación y capa sub.
  // `m` puede ser una nota o un acorde (lista): todas las osciladoras comparten filtro y envolvente (más barato).
  // El estéreo y los envíos a eco/reverb están en el bus del instrumento (roleOut), no en cada nota.
  // `x.wobble` sustituye los pasos del LFO para esta nota.
  function synth(out, t, m, dur, o, p, x) {
    const g = ctx.createGain(), fl = ctx.createBiquadFilter();
    fl.type = o.filter || 'lowpass';
    const cut = o.cutoff || 2000;
    if (o.envAmt) {
      fl.frequency.setValueAtTime(Math.min(18000, cut * o.envAmt), t);
      fl.frequency.exponentialRampToValueAtTime(cut, t + (o.fdec || Math.min(dur, 0.18)));
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
    const end = t + dur;
    const rel = o.r || 0.08;
    const a = o.a || 0.005, d = o.d || 0.12, s = o.s == null ? 0.6 : o.s;
    env(g, t, a, o.v, d, s, rel, end);
    const stopAt = end + rel + 0.05;
    const steps = x && x.wobble != null ? x.wobble : o.lfo && o.lfo.steps;
    if (o.lfo && steps && p) {
      const lfo = osc(o.lfo.shape || 'sine', 1 / (steps * p.stepDur)), lg = ctx.createGain();
      lg.gain.value = cut * o.lfo.depth;
      lfo.connect(lg); lg.connect(fl.frequency);
      lfo.start(t); lfo.stop(stopAt);
    }
    let dets = o.detune || [0];
    if (o.saw) {
      const n = o.saw, w = o.spread || 36;
      dets = [];
      for (let i = 0; i < n; i++) dets.push(n === 1 ? 0 : -w / 2 + (w * i) / (n - 1));
    }
    let vg = null;
    if (o.vib) {
      // Vibrato compartido (en cents), entra suavemente.
      const vo = osc('sine', o.vib);
      vg = ctx.createGain();
      vg.gain.setValueAtTime(0, t);
      vg.gain.linearRampToValueAtTime(10, t + Math.min(0.25, dur));
      vo.connect(vg);
      vo.start(t); vo.stop(stopAt);
    }
    const notes = Array.isArray(m) ? m : [m];
    const scale = notes.length > 1 ? 1 / Math.sqrt(notes.length) : 1;
    let first = null;
    const inp = scale !== 1 ? ctx.createGain() : fl;
    if (inp !== fl) { inp.gain.value = scale; inp.connect(fl); }
    for (const n of notes) {
      const f0 = freq(n + (o.oct || 0));
      for (const det of dets) {
        const v = osc(o.wave, f0);
        v.detune.value = det;
        if (vg) vg.connect(v.detune);
        v.connect(inp);
        v.start(t); v.stop(stopAt);
        if (!first) first = v;
      }
    }
    first.onended = () => g.disconnect();
    if (o.sub && notes.length === 1) {
      const so = osc('sine', freq(m + (o.oct || 0) - 12 * (o.subOct || 0))), sg = ctx.createGain();
      env(sg, t, Math.max(a, 0.004), o.sub, d, Math.max(s, 0.7), rel, end);
      so.connect(sg); sg.connect(p ? p.duck : out); // el sub va en mono, sin ensanchar
      so.onended = () => sg.disconnect();
      so.start(t); so.stop(stopAt);
    }
  }

  // Platillo: ruido agudo largo con envío a reverb.
  function crash(p, t, v) {
    noiseHit(p.fx, t, v, 'highpass', 5200, 0.5, 1.6);
    noiseHit(p.drums, t, v * 0.5, 'bandpass', 9000, 0.8, 0.9);
  }

  // Impacto de entrada al drop: golpe grave descendente + platillo.
  function impact(p, t) {
    const o = osc('sine'), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    o.connect(g); g.connect(p.fx);
    o.onended = () => g.disconnect();
    o.start(t); o.stop(t + 1.15);
    crash(p, t, 0.34);
  }

  // ------------------------------------------------------- secuenciador

  function songBars(song) {
    let n = 0;
    for (const s of song.sections) n += s.bars;
    return n;
  }

  function sectionAt(song, bar) {
    let b = bar;
    for (let i = 0; i < song.sections.length; i++) {
      const s = song.sections[i];
      if (b < s.bars) return { sec: s, inBar: b, prev: song.sections[i - 1] || null };
      b -= s.bars;
    }
    return null;
  }

  function inst(p, role) {
    if (role in p.inst) return p.inst[role];
    const o = p.song.sound[role];
    return (p.inst[role] = o ? Object.assign({}, ROLE[role], o) : null);
  }

  // Bus de un instrumento (se crea una vez por reproducción): ensanchador estéreo y envíos a eco y reverb.
  // Ensanchador: L = x + k·x(t−12 ms), R = x − k·x(t−12 ms); en mono se anula la parte añadida.
  function roleOut(p, role) {
    if (p.outs[role]) return p.outs[role];
    const o = inst(p, role) || {};
    const inp = ctx.createGain();
    inp.gain.value = o.mix || 1;
    p.nodes.push(inp);
    if (o.width) {
      const d = ctx.createDelay(0.05), kp = ctx.createGain(), kn = ctx.createGain(), mg = ctx.createChannelMerger(2);
      d.delayTime.value = 0.012;
      kp.gain.value = o.width * 0.5; kn.gain.value = -o.width * 0.5;
      inp.connect(mg, 0, 0); inp.connect(mg, 0, 1);
      inp.connect(d); d.connect(kp); d.connect(kn);
      kp.connect(mg, 0, 0); kn.connect(mg, 0, 1);
      mg.connect(p.duck);
      p.nodes.push(d, kp, kn, mg);
    } else inp.connect(p.duck);
    const a = sendTo(inp, p.delayIn, o.send), b = sendTo(inp, p.rev, o.rev);
    if (a) p.nodes.push(a);
    if (b) p.nodes.push(b);
    return (p.outs[role] = inp);
  }

  function lerpExp(a, b, u) { return a * Math.pow(b / a, Math.max(0, Math.min(1, u))); }

  // Filtros de sección (paso bajo y paso alto del bus melódico) en el paso `stepIdx` + `frac` (0 inicio, 1 final).
  function filterAt(song, stepIdx, frac) {
    const f = sectionAt(song, Math.floor(stepIdx / 16));
    const r = { lp: 20000, hp: 10 };
    if (!f) return r;
    const sec = f.sec, pos = f.inBar * 16 + (stepIdx % 16) + frac, len = sec.bars * 16;
    if (sec.filter) r.lp = lerpExp(sec.filter[0], sec.filter[1], pos / len);
    if (sec.build) {
      const b = Math.min(sec.build, sec.bars) * 16, u = (pos - (len - b)) / b;
      if (u > 0) r.hp = lerpExp(10, sec.buildHp || 500, u);
    }
    return r;
  }

  function automate(p, stepIdx, t) {
    const A = filterAt(p.song, stepIdx, 0), B = filterAt(p.song, stepIdx, 1);
    const ka = A.lp + ',' + A.hp;
    if (ka === p.fKey && A.lp === B.lp && A.hp === B.hp) return;
    p.lp.frequency.setValueAtTime(A.lp, t);
    p.lp.frequency.exponentialRampToValueAtTime(B.lp, t + p.stepDur);
    p.hp.frequency.setValueAtTime(A.hp, t);
    p.hp.frequency.exponentialRampToValueAtTime(B.hp, t + p.stepDur);
    p.fKey = B.lp + ',' + B.hp;
  }

  // Redoble: velocidad de la caja en este paso (-1 = no hay redoble, se usa el patrón normal).
  function rollVel(sec, inBar, st) {
    const fromEnd = sec.bars - inBar;
    let n = sec.build ? Math.min(sec.build, 2) : 0;
    if (sec.fill && fromEnd === 1) {
      if (typeof sec.fill === 'string' && sec.fill.length >= 16) return sec.fill[st] === 'x' ? 0.3 + 0.35 * (st / 15) : 0;
      n = Math.max(n, 1);
    }
    if (fromEnd > n) return -1;
    if (fromEnd === 1) return 0.22 + 0.45 * (st / 15);
    return st % 2 === 0 ? 0.15 + 0.15 * (st / 15) : 0;
  }

  // Riser de ruido sobre los últimos compases: se programa compás a compás (sirve al empezar a mitad).
  function riser(p, sec, inBar, st, t) {
    const n = Math.min(sec.riser || sec.build || 0, sec.bars);
    if (!n) return;
    const startBar = sec.bars - n;
    if (inBar < startBar) return;
    const total = n * 16, u0 = ((inBar - startBar) * 16 + st) / total, u1 = ((inBar - startBar) * 16 + 16) / total;
    const tEnd = t + (16 - st) * p.stepDur;
    const fr = (u) => 250 * Math.pow(36, u), vol = (u) => 0.01 + 0.15 * u * u;
    stats.nodes++;
    const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; s.loop = true;
    bp.type = 'bandpass'; bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(fr(u0), t);
    bp.frequency.exponentialRampToValueAtTime(fr(u1), tEnd);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol(u0), t + 0.01);
    g.gain.linearRampToValueAtTime(vol(u1), tEnd);
    g.gain.linearRampToValueAtTime(0, tEnd + 0.012);
    s.connect(bp); bp.connect(g); g.connect(p.fx);
    s.onended = () => g.disconnect();
    s.start(t, Math.random()); s.stop(tEnd + 0.03);
  }

  function pump(p, t, depth) {
    const g = p.duck.gain, rel = (p.song.sound.pumpRel || 0.5) * p.stepDur * 4;
    g.setTargetAtTime(1 - depth, t, 0.004);
    g.setTargetAtTime(1, t + 0.03, rel / 3.5);
  }

  function scheduleStep(p, stepIdx, tBase) {
    const song = p.song, snd = song.sound;
    const bar = Math.floor(stepIdx / 16), st = stepIdx % 16;
    const found = sectionAt(song, bar);
    if (!found) { p.done = true; return; }
    const { sec, inBar, prev } = found;
    const tr = song.transpose || 0;
    const chord = CHORDS[song.prog[bar % song.prog.length]];
    const stepDur = p.stepDur;
    const fresh = stepIdx === p.first;
    // Swing: retrasa las semicorcheas pares.
    const t = tBase + (st % 2 === 1 ? (song.swing || 0) * stepDur * 2 : 0);

    automate(p, stepIdx, tBase);

    // ---- batería
    if (sec.kick && sec.kick[st] === 'x') {
      // Bombos seguidos (dobles, semicorcheas) más suaves para que no se amontonen.
      kick(p.drums, t, stepIdx - p.lastKick <= 2 ? 0.36 : 0.55, snd.kick);
      p.lastKick = stepIdx;
      const depth = sec.pump != null ? sec.pump : snd.pump != null ? snd.pump : 0.45;
      // Bombeo en el bombo, como mucho una vez por negra (con bombos en semicorcheas, en cada tiempo).
      const gap = stepIdx - p.lastPump;
      if (depth > 0 && ((st % 4 === 0 && gap >= 2) || gap >= 4)) { pump(p, t, depth); p.lastPump = stepIdx; }
    }
    const roll = rollVel(sec, inBar, st);
    if (roll >= 0) {
      if (roll > 0) snare(p.drums, t, roll * 1.4, snd.snare === 'chip' ? 'chip' : 'snare', (snd.snareTone || 220) * (1 + 0.3 * st / 15), p.snareWet);
    } else if (sec.snare && sec.snare[st] === 'x') {
      snare(p.drums, t, 0.85, snd.snare, snd.snareTone, p.snareWet);
      if (snd.snare2) snare(p.drums, t, 0.5, snd.snare2, snd.snareTone, p.snareWet);
    }
    const hat = snd.hat || { hp: 8000, dec: 0.04 };
    if (sec.hat && sec.hat[st] === 'x') noiseHit(p.hats, t, st % 4 === 2 ? 0.55 : 0.34, 'highpass', hat.hp, 0.7, hat.dec);
    if (sec.ohat && sec.ohat[st] === 'x' && snd.ohat) noiseHit(p.hats, t, 0.4, 'highpass', snd.ohat.hp, 0.7, snd.ohat.dec);
    if (st === 0 && inBar === 0 && bar > 0) {
      if (sec.drop || (prev && prev.build)) impact(p, t);
      else if (sec.crash !== 0) crash(p, t, 0.2);
    }
    if (st === 0 || fresh) riser(p, sec, inBar, st, tBase);

    // ---- bajo según patrón (R raíz, O octava, 5 quinta, "-" mantener)
    const bass = inst(p, 'bass');
    if (sec.bass && bass) {
      const c = sec.bass[st];
      if (c && c !== '.' && c !== '-') {
        let len = 1;
        while (sec.bass[st + len] === '-') len++;
        const r = chord.root + tr;
        const note = c === 'O' ? r + 12 : c === '5' ? r + 7 : r;
        let wob = sec.wobble;
        if (Array.isArray(wob)) wob = wob[inBar % wob.length];
        synth(roleOut(p, 'bass'), t, note, stepDur * (len - 0.15), bass, p, wob != null ? { wobble: wob } : null);
      }
    }

    const pad = inst(p, 'pad');
    if (sec.pad && pad && (st === 0 || fresh)) {
      synth(roleOut(p, 'pad'), t, chord.tones.map((m) => m + tr), stepDur * (15 - st), pad, p);
    }

    const stab = inst(p, 'stab');
    if (sec.stab && stab && sec.stab[st] === 'x') {
      synth(roleOut(p, 'stab'), t, chord.tones.map((m) => m + tr), stepDur * 1.2, stab, p);
    }

    const pluck = inst(p, 'pluck');
    if (sec.pluck && pluck && sec.pluck[st] === 'x') {
      let k = 0;
      for (let i = 0; i < st; i++) if (sec.pluck[i] === 'x') k++;
      const tones = chord.tones.concat(chord.tones.map((m) => m + 12));
      synth(roleOut(p, 'pluck'), t, tones[k % tones.length] + tr, stepDur * 1.5, pluck, p);
    }

    const arp = inst(p, 'arp');
    if (sec.arp && arp) {
      const rate = arp.rate || 1;
      if (st % rate === 0) {
        const tones = [chord.tones[0], chord.tones[1], chord.tones[2], chord.tones[0] + 12];
        if (arp.range === 2) tones.push(chord.tones[1] + 12, chord.tones[2] + 12, chord.tones[0] + 24);
        const n = tones.length, up = tones.map((_, i) => i);
        const seq = arp.mode === 'down' ? up.slice().reverse() : arp.mode === 'up' ? up : up.concat(up.slice(1, -1).reverse());
        const k = seq[Math.floor(st / rate) % seq.length];
        synth(roleOut(p, 'arp'), t, tones[Math.min(k, n - 1)] + tr, stepDur * rate * 0.9, arp, p);
      }
    }

    const lead = inst(p, 'lead'), lead2 = inst(p, 'lead2');
    if (sec.lead && lead) {
      const ph = MEL[sec.lead][bar % MEL[sec.lead].length];
      for (const n of ph) {
        if (n.step !== st) continue;
        const dur = n.len * stepDur * 0.95;
        synth(roleOut(p, 'lead'), t, n.midi + tr, dur, lead, p);
        if (sec.lead2 && lead2) synth(roleOut(p, 'lead2'), t, n.midi + tr, dur, lead2, p);
      }
    }
  }

  // Crea los nodos de una reproducción sintetizada que empieza en t0 (tiempo del contexto) desde `offset` segundos.
  function makePlay(song, t0, offset) {
    const snd = song.sound;
    const bus = ctx.createGain();
    bus.gain.value = song.gain || 1; // nivel igualado entre canciones
    bus.connect(musicBus);
    const drums = ctx.createGain(); drums.connect(bus);
    const hats = ctx.createStereoPanner(); hats.pan.value = 0.18; hats.connect(drums);
    const duck = ctx.createGain();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 10; hp.Q.value = 0.8;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 1.2;
    duck.connect(hp); hp.connect(lp); lp.connect(bus);
    const rev = ctx.createGain(); rev.gain.value = song.gain || 1; rev.connect(revIn);
    const stepDur = 60 / song.bpm / 4;
    const first = Math.ceil(offset / stepDur - 1e-6);
    const p = {
      song, bus, drums, hats, duck, hp, lp, rev, t0, offset, stepDur, step: first, first,
      nextTime: Math.max(t0, t0 + first * stepDur - offset), done: false, timer: null, lastPump: -99, lastKick: -99, inst: {}, fKey: '20000,10',
      nodes: [bus, drums, hats, duck, hp, lp, rev],
    };
    // Eco ping-pong a tempo (izquierda, derecha, izquierda…), con realimentación filtrada y bombeado.
    const dl = Object.assign({ time: 0.75, fb: 0.3, mix: 0.3, tone: 2600 }, snd.delay);
    const din = ctx.createGain(), dL = ctx.createDelay(2), dR = ctx.createDelay(2), tone = ctx.createBiquadFilter();
    const fb = ctx.createGain(), fb2 = ctx.createGain(), mg = ctx.createChannelMerger(2), wet = ctx.createGain();
    dL.delayTime.value = dR.delayTime.value = Math.min(2, dl.time * (60 / song.bpm));
    tone.type = 'lowpass'; tone.frequency.value = dl.tone;
    fb.gain.value = Math.sqrt(dl.fb); fb2.gain.value = Math.sqrt(dl.fb);
    wet.gain.value = dl.mix;
    din.connect(tone); tone.connect(dL);
    dL.connect(mg, 0, 0); dL.connect(fb); fb.connect(dR);
    dR.connect(mg, 0, 1); dR.connect(fb2); fb2.connect(dL);
    mg.connect(wet); wet.connect(duck);
    p.delayIn = din;
    p.nodes.push(din, dL, dR, tone, fb, fb2, mg, wet);
    // Buses de batería con reverb: cola de caja/palmada y efectos (platillo, riser, impacto).
    p.snareWet = ctx.createGain(); p.snareWet.connect(drums);
    p.fx = ctx.createGain(); p.fx.connect(bus);
    p.nodes.push(p.snareWet, p.fx, sendTo(p.snareWet, rev, 0.3), sendTo(p.fx, rev, 0.4));
    p.outs = {};
    return p;
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
  // songId puede ser una canción sintetizada ('pulso'…) o una propia ('file:…', ya preparada con prepare()).
  function start(songId, offset) {
    if (!ensure()) return 0;
    stop();
    offset = offset || 0;
    const lead = 0.06;
    if (typeof songId === 'string' && (songId.startsWith('file:') || songId.startsWith('track:'))) {
      const buf = buffers.get(songId);
      if (!buf) { if (songId.startsWith('track:')) loadTrack(songId); return 0; }
      const info = songId.startsWith('track:') && root.Tracks ? root.Tracks.TRACKS[songId.slice(6)] : null;
      const bus = ctx.createGain();
      bus.connect(musicBus);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(bus);
      if (info && info.loop) { src.loop = true; src.loopStart = info.bar0; src.loopEnd = Math.min(buf.duration, info.dur); }
      const when = ctx.currentTime + lead;
      // Desfase negativo: la canción empieza más tarde que el nivel.
      if (offset >= 0) src.start(when, Math.min(offset, buf.duration));
      else src.start(when - offset, 0);
      play = { custom: true, id: songId, src, bus, done: false, timer: null, nodes: [bus], when, offset, info, dur: buf.duration };
      return lead * 1000;
    }
    const song = SONGS[songId];
    if (!song) return 0;
    play = makePlay(song, ctx.currentTime + lead, Math.max(0, offset));
    tick();
    play.timer = setInterval(tick, 25);
    return lead * 1000;
  }

  function stop(fade) {
    if (!play) return;
    const p = play;
    play = null;
    clearInterval(p.timer);
    const t = ctx.currentTime, f = fade || 0.05;
    for (const n of [p.bus, p.rev]) {
      if (!n) continue;
      n.gain.cancelScheduledValues(t);
      n.gain.setValueAtTime(n.gain.value, t);
      n.gain.linearRampToValueAtTime(0, t + f);
    }
    if (p.src) { try { p.src.stop(t + f + 0.02); } catch (e) { /* ya parada */ } }
    setTimeout(() => { for (const n of p.nodes) n.disconnect(); }, (f + 0.5) * 1000);
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

  // ------------------------------------------------- canciones del juego (src/music/<id>.mp3, ver tracks.js)
  // 'track:<id>': se descargan y decodifican una vez. Si no están (HTML suelto, sin la carpeta music) se
  // resuelve a false y el juego usa la música sintetizada.
  const loading = new Map();
  function loadTrack(key) {
    if (!key.startsWith('track:')) key = 'track:' + key;
    if (buffers.has(key)) return Promise.resolve(true);
    if (!ensure() || !root.fetch) return Promise.resolve(false);
    if (!loading.has(key)) {
      loading.set(key, fetch('music/' + key.slice(6) + '.mp3')
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(decode)
        .then((buf) => { buffers.set(key, buf); return true; })
        .catch(() => { loading.delete(key); return false; }));
    }
    return loading.get(key);
  }
  // Música del menú: suena en bucle mientras no haya otra canción; no se reinicia si ya está sonando.
  // stillWanted(): se vuelve a preguntar tras la descarga, por si el jugador ya salió del menú.
  async function menu(key, stillWanted) {
    if (play && play.id === key) return;
    if (!(await loadTrack(key))) return;
    if ((play && play.id === key) || (stillWanted && !stillWanted())) return;
    start(key, 0);
  }
  // Segundo de la canción real que suena ahora (con su bucle), y su ficha de tracks.js; null si no hay.
  function position() {
    if (!play || !play.custom || !play.info || !ctx) return null;
    let p = ctx.currentTime - play.when + Math.max(0, play.offset);
    if (p < 0) return null;
    const inf = play.info;
    if (inf.loop && p > inf.dur) p = inf.bar0 + ((p - inf.bar0) % (inf.dur - inf.bar0));
    return { t: p, track: inf };
  }
  function playing() { return play ? (play.id || 'synth') : null; }

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
      // Golpe grave saturado + ruido que se cierra + chisporroteo digital.
      const o = osc('sine'), g = ctx.createGain(), ws = ctx.createWaveShaper();
      ws.curve = driveCurve(4);
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(32, t + 0.45);
      g.gain.setValueAtTime(0.7, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g); g.connect(ws); ws.connect(out);
      o.onended = () => ws.disconnect();
      o.start(t); o.stop(t + 0.55);
      stats.nodes++;
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), ng = ctx.createGain();
      s.buffer = noise;
      fl.type = 'lowpass'; fl.Q.value = 2;
      fl.frequency.setValueAtTime(6000, t);
      fl.frequency.exponentialRampToValueAtTime(250, t + 0.5);
      ng.gain.setValueAtTime(0.55, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      s.connect(fl); fl.connect(ng); ng.connect(out);
      s.onended = () => ng.disconnect();
      s.start(t, Math.random()); s.stop(t + 0.6);
      for (let i = 0; i < 4; i++) {
        synth(out, t + i * 0.035, 84 - i * 7, 0.025, { wave: 'square', cutoff: 5000, v: 0.05, d: 0.02, s: 0.3, r: 0.02 });
      }
    } else if (name === 'checkpoint') {
      // Campanita: fundamental + parcial inarmónico, dos notas.
      [[84, 0], [91, 0.07]].forEach(([m, d]) => {
        synth(out, t + d, m, 0.05, { wave: 'sine', cutoff: 9000, v: 0.2, d: 0.25, s: 0.05, r: 0.3 });
        synth(out, t + d, m + 19, 0.03, { wave: 'sine', cutoff: 9000, v: 0.06, d: 0.12, s: 0.05, r: 0.15 });
        synth(out, t + d, m, 0.04, { wave: 'triangle', cutoff: 6000, v: 0.06, d: 0.05, s: 0.3, r: 0.08, oct: 12 });
      });
    } else if (name === 'complete') {
      // Arpegio de supersierra hacia arriba y acorde final abierto con platillo.
      [69, 72, 76, 81, 84, 88].forEach((m, i) => {
        synth(out, t + i * 0.07, m, 0.12, { wave: 'sawtooth', saw: 3, spread: 24, width: 0.5, cutoff: 4500, envAmt: 2, fdec: 0.1, v: 0.05, d: 0.15, s: 0.3, r: 0.25 });
      });
      for (const m of [69, 76, 81, 85, 88]) {
        synth(out, t + 0.45, m, 0.9, { wave: 'sawtooth', saw: 3, spread: 30, width: 0.7, cutoff: 3500, sweep: 0.4, v: 0.035, a: 0.01, d: 0.4, s: 0.6, r: 0.8 });
      }
      noiseHit(out, t + 0.45, 0.12, 'highpass', 6000, 0.5, 1.4);
    } else if (name === 'coin') {
      // Moneda: dos notas brillantes con brillo de octava y un eco corto.
      [[0, 88, 0.07], [0.07, 95, 0.2]].forEach(([d, m, len]) => {
        synth(out, t + d, m, len, { wave: 'square', cutoff: 7000, v: 0.075, d: 0.06, s: 0.5, r: 0.12 });
        synth(out, t + d, m, len, { wave: 'triangle', cutoff: 9000, v: 0.04, d: 0.06, s: 0.4, r: 0.12, oct: 12 });
      });
      synth(out, t + 0.22, 95, 0.12, { wave: 'triangle', cutoff: 6000, v: 0.025, d: 0.06, s: 0.4, r: 0.12 });
    } else if (name === 'hover') {
      // al pasar por encima de un botón: un tic muy suave y agudo
      synth(out, t, 91, 0.012, { wave: 'sine', cutoff: 8000, v: 0.03, d: 0.02, s: 0.05, r: 0.03 });
    } else if (name === 'whoosh') {
      // cambio de pantalla: barrido de ruido que sube
      const s2 = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      s2.buffer = noise; fl.type = 'bandpass'; fl.Q.value = 1.4;
      fl.frequency.setValueAtTime(500, t); fl.frequency.exponentialRampToValueAtTime(4500, t + 0.22);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      s2.connect(fl); fl.connect(g); g.connect(out); s2.onended = () => g.disconnect();
      s2.start(t, Math.random()); s2.stop(t + 0.3);
    } else if (name === 'click') {
      synth(out, t, 79, 0.02, { wave: 'triangle', cutoff: 5000, v: 0.08, d: 0.02, s: 0.1, r: 0.03 });
      noiseHit(out, t, 0.03, 'highpass', 7000, 0.7, 0.012);
    }
  }

  function songLength(songId) {
    const s = SONGS[songId];
    return s ? songBars(s) * 4 * 60 / s.bpm : 0;
  }

  // Prueba: renderiza `secs` segundos de una canción sin sonar (OfflineAudioContext), con la misma cadena de
  // mezcla que en vivo, empezando en el compás `fromBar` (o en `offset` segundos si se da). Mide RMS y pico
  // a la salida y antes del máster (para ver cuánto trabaja el limitador), nodos creados y velocidad de render.
  async function renderTest(songId, secs, fromBar, offset) {
    const song = SONGS[songId];
    if (!song) throw new Error('Canción desconocida: ' + songId);
    const saved = [ctx, master, musicBus, sfxBus, noise, revIn];
    const sr = 44100, off = new OfflineAudioContext(4, Math.round(sr * secs), sr);
    const now = () => (root.performance ? root.performance.now() : Date.now());
    ctx = off;
    const n0 = stats.nodes;
    try {
      const g = buildGraph(off);
      install(g);
      // Canales 0-1: salida final; 2-3: suma antes del máster.
      g.clip.disconnect();
      const mg = off.createChannelMerger(4), s1 = off.createChannelSplitter(2), s2 = off.createChannelSplitter(2);
      g.clip.connect(s1); s1.connect(mg, 0, 0); s1.connect(mg, 1, 1);
      g.master.connect(s2); s2.connect(mg, 0, 2); s2.connect(mg, 1, 3);
      off.destination.channelCount = 4; off.destination.channelCountMode = 'explicit'; off.destination.channelInterpretation = 'discrete';
      mg.connect(off.destination);
      const stepDur = 60 / song.bpm / 4;
      const p = makePlay(song, 0, offset != null ? Math.max(0, offset) : (fromBar || 0) * 16 * stepDur);
      // Como en vivo: se programa por tramos (cada 0.25 s, con 0.12 s de margen) y se deja correr el hilo
      // principal entre tramos para que los onended desconecten las voces terminadas.
      let sched = 0;
      const fill = (until) => {
        const ta = now();
        while (!p.done && p.nextTime < Math.min(until, secs - 0.02)) {
          scheduleStep(p, p.step, p.nextTime);
          p.step++;
          p.nextTime = p.t0 + p.step * p.stepDur - p.offset;
        }
        sched += now() - ta;
      };
      const chunk = 0.25;
      fill(chunk + 0.12);
      for (let tq = chunk; tq < secs - 0.01; tq += chunk) {
        off.suspend(tq).then(() => { fill(tq + chunk + 0.12); setTimeout(() => off.resume(), 0); });
      }
      const tB = now();
      const buf = await off.startRendering();
      const tC = now();
      const tA = tB - sched;
      const meas = (chs) => {
        let sum = 0, peak = 0, clip = 0, n = 0;
        for (const c of chs) {
          const x = buf.getChannelData(c);
          for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); sum += a * a; if (a > peak) peak = a; if (a > 0.99) clip++; }
          n += x.length;
        }
        return { rms: Math.sqrt(sum / n), peak, clip };
      };
      const o = meas([0, 1]), pre = meas([2, 3]);
      // Reparto aproximado por bandas (filtros de un polo sobre el canal izquierdo): graves < 150 Hz, agudos > 4 kHz.
      const xl = buf.getChannelData(0), kl = 1 - Math.exp(-2 * Math.PI * 150 / sr), kh = 1 - Math.exp(-2 * Math.PI * 4000 / sr);
      let lo = 0, hi = 0, yl = 0, yh = 0;
      for (let i = 0; i < xl.length; i++) { yl += (xl[i] - yl) * kl; yh += (xl[i] - yh) * kh; lo += yl * yl; hi += (xl[i] - yh) * (xl[i] - yh); }
      const db = (v) => Math.round(200 * Math.log10(Math.max(v, 1e-9))) / 10;
      return {
        rms: o.rms, peak: o.peak, rmsDb: db(o.rms), peakDb: db(o.peak), clipped: o.clip,
        prePeakDb: db(pre.peak), preRmsDb: db(pre.rms), lowDb: db(Math.sqrt(lo / xl.length)), highDb: db(Math.sqrt(hi / xl.length)),
        nodes: stats.nodes - n0, nodesPerSec: Math.round((stats.nodes - n0) / secs),
        scheduleMs: Math.round(tB - tA), renderMs: Math.round(tC - tB), speed: Math.round((secs * 1000) / Math.max(1, tC - tB) * 10) / 10,
      };
    } finally {
      [ctx, master, musicBus, sfxBus, noise, revIn] = saved;
    }
  }

  // Prueba todas las canciones en varios puntos (inicio, mitad, final). Devuelve una fila por render.
  async function renderAll(secs) {
    secs = secs || 8;
    const rows = [];
    for (const id of Object.keys(SONGS)) {
      const len = songLength(id);
      for (const at of [0, len * 0.45, Math.max(0, len - secs - 0.5)]) {
        const r = await renderTest(id, secs, 0, at);
        rows.push(Object.assign({ song: id, at: Math.round(at * 10) / 10 }, r));
      }
    }
    return rows;
  }

  root.Sound = { loadTrack, menu, playing, position, resume, start, stop, sfx, setVolumes, songLength, importSong, prepare, isReady, renderTest, renderAll, songIds: () => Object.keys(SONGS), songs: SONGS, get ctx() { return ctx; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
