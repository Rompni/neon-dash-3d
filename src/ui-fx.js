// Movimiento de la interfaz: entradas de pantalla, botones que reaccionan (sonido, destello, rebote), tarjetas
// que se inclinan hacia el ratón, títulos de neón que se encienden y respiran al ritmo de la música, textos que se
// "descifran", contadores que suben y vistas previas animadas de la tienda. Todo es decorativo: no toca el juego.
const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const ND = () => window.ND3D;
const reduce = () => (ND() && ND().save && ND().save.reduceFlash) || matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ entrada de pantallas
// Cada vez que una pantalla se muestra recibe la clase .enter (las animaciones están en ui.css) y suena un
// barrido; la cámara 3D se acerca o se aleja según la pantalla.
const CAM = { menu: { z: 0, y: 0 }, levels: { z: -2.4, y: 0.35 }, rewards: { z: 1.6, y: 0.6 }, settings: { z: 1.2, y: 0.3 }, pause: { z: -1, y: 0 }, complete: { z: -1.4, y: 0.2 } };
const QUIET = new Set(['hud', 'editor', 'pause', 'complete']);
function onScreen(sec) {
  sec.classList.remove('enter');
  void sec.offsetWidth;
  sec.classList.add('enter');
  clearTimeout(sec._enterT);
  sec._enterT = setTimeout(() => sec.classList.remove('enter'), 900);
  if (!QUIET.has(sec.id) && window.Sound) Sound.sfx('whoosh');
  const W = ND() && ND().World && ND().World.W;
  if (W) W.uiCamTarget = CAM[sec.id] || { z: 0, y: 0 };
  if (sec.id === 'menu') neonOn();
}
const mo = new MutationObserver((list) => {
  for (const m of list) if (m.attributeName === 'hidden' && !m.target.hidden && m.target.classList.contains('screen')) onScreen(m.target);
});
document.querySelectorAll('.screen').forEach((s) => mo.observe(s, { attributes: true, attributeFilter: ['hidden'] }));

// ------------------------------------------------------------------ botones: sonido al pasar, rebote al pulsar
const HOVER = '.btn, .icon-btn, .arrow, .design, .shop-item, .tabs button, .seg button, .swatch, .chest .btn';
let lastHover = 0, hoverEl = null;
document.addEventListener('pointerover', (e) => {
  if (e.pointerType !== 'mouse') return;
  const el = e.target.closest(HOVER);
  if (!el || el === hoverEl) return;
  hoverEl = el;
  const now = performance.now();
  if (now - lastHover > 45 && window.Sound) { Sound.sfx('hover'); lastHover = now; }
});
document.addEventListener('pointerout', (e) => { if (hoverEl && !hoverEl.contains(e.relatedTarget)) hoverEl = null; });
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest(HOVER);
  if (!el) return;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
  setTimeout(() => el.classList.remove('pop'), 420);
});

// ------------------------------------------------------------------ tarjetas que se inclinan hacia el ratón
const TILT = '.design, .shop-item, .chest, .stat';
document.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || reduce()) return;
  const el = e.target.closest(TILT);
  if (!el) return;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
  el.style.setProperty('--rx', (-y * 10).toFixed(2) + 'deg');
  el.style.setProperty('--ry', (x * 12).toFixed(2) + 'deg');
  el.style.setProperty('--mx', ((x + 0.5) * 100).toFixed(1) + '%');
  el.style.setProperty('--my', ((y + 0.5) * 100).toFixed(1) + '%');
});
document.addEventListener('pointerout', (e) => {
  const el = e.target.closest && e.target.closest(TILT);
  if (el && !el.contains(e.relatedTarget)) { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); }
});

// ------------------------------------------------------------------ letras
// Parte un texto en <span class="ch"> con su índice (para ondas y apariciones letra a letra).
function splitChars(el, text) {
  el.textContent = '';
  [...text].forEach((c, i) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.style.setProperty('--i', i);
    s.textContent = c === ' ' ? ' ' : c;
    el.appendChild(s);
  });
}
// Título: cada letra respira con el ritmo; al entrar al menú, el tubo de neón "se enciende" parpadeando.
const title = document.querySelector('.title h1');
if (title) {
  const tag = title.querySelector('span');
  const main = document.createElement('b');
  main.className = 'neon-word';
  title.insertBefore(main, title.firstChild);
  splitChars(main, title.firstChild.nextSibling && title.firstChild.nextSibling.nodeType === 3 ? title.firstChild.nextSibling.textContent.trim() : 'Neon Dash');
  for (const n of [...title.childNodes]) if (n.nodeType === 3) n.remove();
  if (tag) title.appendChild(tag);
}
function neonOn() {
  if (!title) return;
  title.classList.remove('power');
  void title.offsetWidth;
  title.classList.add('power');
}
// parpadeo suelto de alguna letra de vez en cuando
setInterval(() => {
  if (!title || reduce() || $('menu').hidden) return;
  const chs = title.querySelectorAll('.ch');
  const c = chs[Math.floor(Math.random() * chs.length)];
  if (!c) return;
  c.classList.add('flick');
  setTimeout(() => c.classList.remove('flick'), 700);
}, 4200);

// Texto que se "descifra": caracteres al azar que se van fijando de izquierda a derecha.
const GLYPHS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ0123456789#%&<>/\\=+';
function scramble(el, text) {
  if (!el) return;
  cancelAnimationFrame(el._scr);
  if (reduce()) { el.textContent = text; return; }
  const t0 = performance.now(), dur = 380 + text.length * 22;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const fixed = Math.floor(k * text.length);
    let out = text.slice(0, fixed);
    for (let i = fixed; i < text.length; i++) out += text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    el.textContent = out;
    if (k < 1) el._scr = requestAnimationFrame(tick);
  };
  el._scr = requestAnimationFrame(tick);
}
// Número que sube (o baja) hasta su valor en vez de saltar.
function countTo(el, value) {
  if (!el) return;
  const from = Number(el.dataset.v != null ? el.dataset.v : value);
  el.dataset.v = value;
  if (from === value || reduce()) { el.textContent = value; return; }
  cancelAnimationFrame(el._cnt);
  const t0 = performance.now(), dur = Math.min(900, 300 + Math.abs(value - from) * 4);
  el.classList.add('counting');
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (value - from) * e);
    if (k < 1) el._cnt = requestAnimationFrame(tick); else el.classList.remove('counting');
  };
  el._cnt = requestAnimationFrame(tick);
}
// Mensaje grande que entra con rebote (intento, récord, nivel completado).
function popText(el, text, wave) {
  if (!el) return;
  if (wave) splitChars(el, text); else el.textContent = text;
  el.classList.remove('pop-in');
  void el.offsetWidth;
  el.classList.add('pop-in');
}

// ------------------------------------------------------------------ ritmo
// --beat (0..1, salta en cada tiempo de la canción que suena y decae) para que el título, los bordes y los
// botones principales laten con la música. Sin canción real: un pulso suave a 120 BPM.
function beatLoop() {
  let b = 0;
  const p = window.Sound && Sound.position && Sound.position();
  if (p) {
    const ph = ((((p.t - p.track.first) * p.track.bpm) / 60) % 1 + 1) % 1;
    b = Math.exp(-ph * 6);
  } else {
    const ph = (performance.now() / 500) % 1;
    b = Math.exp(-ph * 6) * 0.35;
  }
  root.style.setProperty('--beat', reduce() ? 0 : b.toFixed(3));
  drawPreviews();
  requestAnimationFrame(beatLoop);
}
requestAnimationFrame(beatLoop);

// ------------------------------------------------------------------ vistas previas de la tienda
// Cada artículo lleva un <canvas data-pv="tipo:valor"> que se anima mientras la tienda está abierta.
const FLAME = { naranja: '#ffb13b', azul: '#3bc6ff', verde: '#5dff7a', rosa: '#ff4fd8', pixeles: '#ffd23a' };
const hsl = (h) => `hsl(${(h * 360) % 360},100%,60%)`;
function drawPreviews() {
  const body = $('rwBody');
  if (!body || $('rewards').hidden) return;
  const t = performance.now() / 1000;
  body.querySelectorAll('canvas[data-pv]').forEach((cv) => {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    const [kind, val] = cv.dataset.pv.split(':');
    if (kind === 'trail') drawTrail(g, W, H, t, val);
    else if (kind === 'death') drawDeath(g, W, H, t, val);
    else if (kind === 'flame') drawFlame(g, W, H, t, val);
    else if (kind === 'glow') drawGlow(g, W, H, t, val);
    g.globalCompositeOperation = 'source-over';
  });
}
function playerSquare(g, x, y, s, c) {
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#10142a'; g.fillRect(x - s / 2, y - s / 2, s, s);
  g.strokeStyle = c; g.lineWidth = 2; g.strokeRect(x - s / 2 + 1, y - s / 2 + 1, s - 2, s - 2);
  g.globalCompositeOperation = 'lighter';
}
function drawTrail(g, W, H, t, v) {
  const px = W * 0.72, py = H * 0.5 + Math.sin(t * 4) * H * 0.18;
  const pts = [];
  for (let i = 0; i < 26; i++) { const tt = t - i * 0.02; pts.push([px - i * 3.2, H * 0.5 + Math.sin(tt * 4) * H * 0.18]); }
  if (v === 'clasica' || v === 'arcoiris') {
    for (let i = 1; i < pts.length; i++) {
      const a = 1 - i / pts.length;
      g.strokeStyle = v === 'arcoiris' ? hsl(t * 0.6 + i * 0.03) : '#27e3ff';
      g.globalAlpha = a; g.lineWidth = 7 * a + 1;
      g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke();
    }
  } else if (v === 'pixeles') {
    for (let i = 2; i < pts.length; i += 2) { const a = 1 - i / pts.length; g.globalAlpha = a; g.fillStyle = i % 4 ? '#ff4fd8' : '#27e3ff'; const s = 4; g.fillRect(pts[i][0] + Math.sin(i * 7) * 3, pts[i][1] + Math.cos(i * 5) * 4, s, s); }
  } else if (v === 'chispas') {
    for (let i = 0; i < 14; i++) { const k = ((t * 1.6 + i / 14) % 1); g.globalAlpha = 1 - k; g.fillStyle = i % 2 ? '#ffffff' : '#27e3ff'; g.beginPath(); g.arc(px - k * 50, py + Math.sin(i * 9) * k * 14, 1.6, 0, 7); g.fill(); }
  } else if (v === 'fuego') {
    for (let i = 0; i < 18; i++) { const k = ((t * 1.4 + i / 18) % 1); g.globalAlpha = (1 - k) * 0.9; g.fillStyle = i % 2 ? '#ff6b1c' : '#ffd23a'; g.beginPath(); g.arc(px - 8 - k * 40, py - k * 10 + Math.sin(i * 3) * 4, 5 * (1 - k) + 1, 0, 7); g.fill(); }
  }
  g.globalAlpha = 1;
  playerSquare(g, px, py, 14, '#27e3ff');
}
function drawDeath(g, W, H, t, v) {
  const k = (t % 1.6) / 1.6, cx = W / 2, cy = H / 2;
  if (k < 0.18) { playerSquare(g, cx, cy, 14, '#27e3ff'); return; }
  const e = (k - 0.18) / 0.82, a = 1 - e;
  g.globalAlpha = a;
  if (v === 'cubitos' || v === 'pixeles') {
    const n = v === 'pixeles' ? 16 : 8;
    for (let i = 0; i < n; i++) { const an = i / n * 6.283 + i; const d = e * (v === 'pixeles' ? 26 : 32); g.fillStyle = i % 2 ? '#27e3ff' : '#ff4fd8'; const s = v === 'pixeles' ? 3 : 5; g.fillRect(cx + Math.cos(an) * d, cy + Math.sin(an) * d + e * e * 12, s, s); }
  } else if (v === 'explosion') {
    const r = e * 30; const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r + 1); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, '#ffd23a'); gr.addColorStop(1, 'rgba(255,80,40,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r + 1, 0, 7); g.fill();
  } else if (v === 'anillo') {
    for (let j = 0; j < 3; j++) { const ee = Math.max(0, e - j * 0.15); g.strokeStyle = j % 2 ? '#ff4fd8' : '#27e3ff'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, ee * 30, 0, 7); g.stroke(); }
  } else if (v === 'chispas') {
    for (let i = 0; i < 18; i++) { const an = -1.57 + (i / 18 - 0.5) * 2.4; const d = e * 30; g.fillStyle = i % 3 ? '#ffd23a' : '#ffffff'; g.beginPath(); g.arc(cx + Math.cos(an) * d, cy + Math.sin(an) * d + e * e * 26, 1.6, 0, 7); g.fill(); }
  }
  g.globalAlpha = 1;
}
function drawFlame(g, W, H, t, v) {
  const x = W * 0.66, y = H / 2;
  for (let i = 0; i < 16; i++) {
    const k = ((t * 2.2 + i / 16) % 1);
    const c = v === 'arcoiris' ? hsl(t * 0.5 + i * 0.05) : FLAME[v] || FLAME.naranja;
    g.globalAlpha = (1 - k) * 0.85; g.fillStyle = c;
    const s = (1 - k) * 6 + 1;
    if (v === 'pixeles') g.fillRect(x - 10 - k * 34, y - s / 2 + Math.sin(i * 4) * 3, s, s);
    else { g.beginPath(); g.arc(x - 10 - k * 34, y + Math.sin(i * 4) * 3 * k, s, 0, 7); g.fill(); }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#10142a'; g.beginPath(); g.moveTo(x + 14, y); g.lineTo(x - 8, y - 7); g.lineTo(x - 8, y + 7); g.closePath(); g.fill();
  g.strokeStyle = '#27e3ff'; g.lineWidth = 1.5; g.stroke();
}
function drawGlow(g, W, H, t, v) {
  const cx = W / 2, cy = H / 2;
  if (v && v !== 'none') {
    const r = 22 + Math.sin(t * 3) * 3;
    const gr = g.createRadialGradient(cx, cy, 4, cx, cy, r);
    gr.addColorStop(0, v); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  }
  playerSquare(g, cx, cy, 14, v && v !== 'none' ? v : '#8f9cc4');
}

window.UIFX = { scramble, countTo, popText, splitChars, neonOn };
// la pantalla inicial ya está visible al cargar: se anima una vez
if (!$('menu').hidden) onScreen($('menu'));
