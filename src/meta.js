/*
 * NEON DASH 3D — progreso y recompensas:
 * estrellas por completar niveles, orbes por avanzar (se gastan en la tienda), diamantes (cofres, misiones y
 * logros), tienda de cosméticos, cofres con tiempo de espera, logros, misiones diarias y monedas de usuario
 * (las de los niveles del editor, aparte de las monedas secretas de los niveles principales).
 * Va concatenado detrás de game.js (comparte su ámbito: save, persist, defs, game, World, Sound, $…).
 */
const META_DEFAULTS = {
  orbs: 0, diamonds: 0, completed: {}, userCoins: 0, levelOrbs: {},
  stats: { jumps: 0, attempts: 0, deaths: 0, wins: 0, practiceWins: 0, orbsEarned: 0, chests: 0, bought: 0, customWins: 0 },
  owned: ['trail:clasica', 'trail:ninguna', 'death:cubitos', 'flame:naranja', 'glow:none'],
  cos: { trail: 'clasica', death: 'cubitos', flame: 'naranja', glow: null },
  ach: {}, quests: null, chests: { small: 0, big: 0 },
  showPct: true, showAttempts: true, hitboxes: false, practiceMusic: true, reduceFlash: false, songs: {},
};
for (const [k, v] of Object.entries(META_DEFAULTS)) if (save[k] == null) save[k] = JSON.parse(JSON.stringify(v));
for (const [k, v] of Object.entries(META_DEFAULTS.stats)) if (save.stats[k] == null) save.stats[k] = v;

// ------------------------------------------------------------------ tienda
// Precio en orbes (●) o en diamantes (◆, con `dia`).
const SHOP = [
  { id: 'trail:clasica', cat: 'Estela', name: 'Clásica', price: 0 },
  { id: 'trail:ninguna', cat: 'Estela', name: 'Ninguna', price: 0 },
  { id: 'trail:pixeles', cat: 'Estela', name: 'Píxeles', price: 250 },
  { id: 'trail:chispas', cat: 'Estela', name: 'Chispas', price: 300 },
  { id: 'trail:arcoiris', cat: 'Estela', name: 'Arcoíris', price: 450 },
  { id: 'trail:fuego', cat: 'Estela', name: 'Fuego', price: 40, dia: true },
  { id: 'death:cubitos', cat: 'Muerte', name: 'Cubitos', price: 0 },
  { id: 'death:explosion', cat: 'Muerte', name: 'Explosión', price: 300 },
  { id: 'death:pixeles', cat: 'Muerte', name: 'Píxeles', price: 350 },
  { id: 'death:anillo', cat: 'Muerte', name: 'Anillos', price: 400 },
  { id: 'death:chispas', cat: 'Muerte', name: 'Fuegos', price: 35, dia: true },
  { id: 'flame:naranja', cat: 'Llama', name: 'Naranja', price: 0 },
  { id: 'flame:azul', cat: 'Llama', name: 'Azul', price: 200 },
  { id: 'flame:verde', cat: 'Llama', name: 'Verde', price: 200 },
  { id: 'flame:rosa', cat: 'Llama', name: 'Rosa', price: 200 },
  { id: 'flame:pixeles', cat: 'Llama', name: 'Píxeles', price: 350 },
  { id: 'flame:arcoiris', cat: 'Llama', name: 'Arcoíris', price: 50, dia: true },
  { id: 'glow:none', cat: 'Brillo', name: 'Sin brillo', price: 0 },
  { id: 'glow:#27e3ff', cat: 'Brillo', name: 'Cian', price: 300 },
  { id: 'glow:#ff4fd8', cat: 'Brillo', name: 'Rosa', price: 300 },
  { id: 'glow:#5dff7a', cat: 'Brillo', name: 'Verde', price: 300 },
  { id: 'glow:#ffd23a', cat: 'Brillo', name: 'Oro', price: 300 },
  { id: 'glow:#ffffff', cat: 'Brillo', name: 'Blanco', price: 30, dia: true },
];
const COS_KEY = { Estela: 'trail', Muerte: 'death', Llama: 'flame', Brillo: 'glow' };
function itemValue(id) { const v = id.split(':')[1]; return v === 'none' ? null : v; }
function isEquipped(it) { const k = COS_KEY[it.cat]; return (save.cos[k] || null) === itemValue(it.id) || (k === 'glow' && !save.cos.glow && it.id === 'glow:none'); }
function applyCosmetics() { World.setCosmetics(save.cos); World.setReduceFlash(save.reduceFlash); }

// ------------------------------------------------------------------ logros
const mainCompleted = () => defs.filter((d) => save.completed[d.id]).length;
const secretCoins = () => Object.values(save.coins).reduce((n, l) => n + l.length, 0);
const allSecret = () => defs.reduce((n, d) => n + d.objects.filter((o) => o.t === 'coin').length, 0);
function starsTotal() { return defs.reduce((n, d) => n + (save.completed[d.id] ? d.stars || 0 : 0), 0); }
function customLevelsMade() { try { const l = JSON.parse(localStorage.getItem('neondash3d.levels.v1')); return Array.isArray(l) ? l.length : (l && l.levels ? l.levels.length : 0); } catch (e) { return 0; } }
const ACH = [
  ['salto1', 'Primer salto', 'Salta por primera vez.', () => save.stats.jumps >= 1, { orbs: 20 }],
  ['saltos500', 'Saltarín', 'Salta 500 veces.', () => save.stats.jumps >= 500, { orbs: 100 }],
  ['saltos5000', 'Muelle humano', 'Salta 5000 veces.', () => save.stats.jumps >= 5000, { diamonds: 10 }],
  ['intentos100', 'Persistente', 'Haz 100 intentos.', () => save.stats.attempts >= 100, { orbs: 100 }],
  ['intentos1000', 'Incansable', 'Haz 1000 intentos.', () => save.stats.attempts >= 1000, { diamonds: 15 }],
  ['muertes500', 'Inmortal… casi', 'Muere 500 veces.', () => save.stats.deaths >= 500, { orbs: 150 }],
  ['nivel1', 'Primera victoria', 'Completa un nivel principal.', () => mainCompleted() >= 1, { orbs: 100 }],
  ['niveles5', 'En racha', 'Completa 5 niveles principales.', () => mainCompleted() >= 5, { diamonds: 10 }],
  ['todos', 'Completista', 'Completa todos los niveles principales.', () => mainCompleted() >= defs.length, { diamonds: 30 }],
  ['demonio', 'Cazademonios', 'Completa un nivel Demonio.', () => defs.some((d) => save.completed[d.id] && /demonio/i.test(d.difficulty || '')), { diamonds: 20 }],
  ['estrellas20', 'Estrellado', 'Consigue 20 estrellas.', () => starsTotal() >= 20, { orbs: 150 }],
  ['monedas10', 'Coleccionista', 'Recoge 10 monedas secretas.', () => secretCoins() >= 10, { orbs: 200 }],
  ['monedasTodas', 'Tesoro completo', 'Recoge todas las monedas secretas.', () => secretCoins() >= allSecret(), { diamonds: 25 }],
  ['practica', 'Ensayo general', 'Completa un nivel en práctica.', () => save.stats.practiceWins >= 1, { orbs: 50 }],
  ['cofres10', 'Buscatesoros', 'Abre 10 cofres.', () => save.stats.chests >= 10, { diamonds: 10 }],
  ['compra', 'Primera compra', 'Compra algo en la tienda.', () => save.stats.bought >= 1, { orbs: 50 }],
  ['creador', 'Creador', 'Guarda un nivel en el editor.', () => customLevelsMade() >= 1, { orbs: 100 }],
  ['comunidad', 'De la comunidad', 'Completa un nivel del editor.', () => save.stats.customWins >= 1, { orbs: 100 }],
];
function giveReward(r, why) {
  const parts = [];
  if (r.orbs) { save.orbs += r.orbs; save.stats.orbsEarned += r.orbs; parts.push(`+${r.orbs} orbes`); }
  if (r.diamonds) { save.diamonds += r.diamonds; parts.push(`+${r.diamonds} diamantes`); }
  if (why) toast(`${why}  ${parts.join('  ')}`);
  return parts.join('  ');
}
function checkAchievements() {
  let any = false;
  for (const [id, name, , test, reward] of ACH) {
    if (save.ach[id] || !test()) continue;
    save.ach[id] = Date.now();
    giveReward(reward, `Logro: ${name}`);
    any = true;
  }
  if (any) persist();
}

// ------------------------------------------------------------------ misiones diarias
const QUEST_TYPES = [
  { type: 'jumps', text: (n) => `Salta ${n} veces`, goals: [100, 200, 400], reward: [8, 12, 18] },
  { type: 'attempts', text: (n) => `Haz ${n} intentos`, goals: [20, 40, 60], reward: [8, 12, 16] },
  { type: 'orbsEarned', text: (n) => `Gana ${n} orbes`, goals: [100, 200, 300], reward: [10, 14, 20] },
  { type: 'reach', text: (n) => `Llega al ${n} % en un nivel (modo normal)`, goals: [30, 50, 70], reward: [10, 14, 20] },
  { type: 'wins', text: (n) => n > 1 ? `Completa ${n} niveles` : 'Completa un nivel', goals: [1, 2], reward: [15, 25] },
];
function today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function refreshQuests() {
  if (save.quests && save.quests.day === today()) return;
  let seed = Date.now() % 9973;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pool = QUEST_TYPES.slice().sort(() => rnd() - 0.5).slice(0, 3);
  save.quests = { day: today(), list: pool.map((q) => {
    const i = Math.floor(rnd() * q.goals.length);
    return { type: q.type, goal: q.goals[i], reward: q.reward[i], base: q.type === 'reach' ? 0 : save.stats[q.type] || 0, best: 0, claimed: false };
  }) };
  persist();
}
function questProgress(q) { return q.type === 'reach' ? q.best : (save.stats[q.type] || 0) - q.base; }

// ------------------------------------------------------------------ cofres
const CHESTS = {
  small: { name: 'Cofre pequeño', wait: 4 * 3600e3, orbs: [50, 150], dia: [0, 4], diaChance: 0.35 },
  big: { name: 'Cofre grande', wait: 24 * 3600e3, orbs: [200, 500], dia: [5, 15], diaChance: 1 },
};
function chestLeft(k) { return Math.max(0, save.chests[k] + CHESTS[k].wait - Date.now()); }
function openChest(k) {
  if (chestLeft(k) > 0) return;
  const c = CHESTS[k];
  const r = { orbs: Math.round(c.orbs[0] + Math.random() * (c.orbs[1] - c.orbs[0])) };
  if (Math.random() < c.diaChance) r.diamonds = Math.round(c.dia[0] + Math.random() * (c.dia[1] - c.dia[0])) || 1;
  save.chests[k] = Date.now();
  save.stats.chests++;
  giveReward(r, `🎁 ${c.name}`);
  Sound.sfx('coin');
  persist(); checkAchievements();
}
function fmtTime(ms) { const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} h ${m} min` : m ? `${m} min ${s % 60} s` : `${s % 60} s`; }

// ------------------------------------------------------------------ eventos de la partida
// Orbes por nivel: estrellas × 30, repartidos según el mejor % en modo normal .
function levelOrbsTotal(def) { return (def.stars || 1) * 30; }
const Meta = {
  jump() { save.stats.jumps++; },
  attempt() { save.stats.attempts++; },
  // se llama antes de guardar el nuevo récord (prev = récord anterior)
  progress(p) {
    if (game.custom || game.practice) return;
    const def = game.L.def, prev = save.levelOrbs[def.id] || 0;
    const due = Math.floor(levelOrbsTotal(def) * p / 100) - prev;
    if (due > 0) { save.levelOrbs[def.id] = prev + due; save.orbs += due; save.stats.orbsEarned += due; game.lastOrbs = (game.lastOrbs || 0) + due; }
    if (save.quests) for (const q of save.quests.list) if (q.type === 'reach') q.best = Math.max(q.best, p);
  },
  death(p) {
    save.stats.deaths++;
    Meta.progress(p);
    persist(); checkAchievements();
  },
  // devuelve el texto de recompensas para la pantalla de nivel completado
  win(s) {
    const L = game.L, def = L.def, out = [];
    game.lastOrbs = 0;
    if (game.custom) {
      save.stats.customWins++;
      const got = L.coins.filter((id) => s.used[id]).length;
      if (got) { save.userCoins += got; out.push(`+${got} monedas de usuario`); }
    } else if (game.practice) {
      save.stats.practiceWins++;
    } else {
      save.stats.wins++;
      Meta.progress(100);
      if (!save.completed[def.id]) {
        save.completed[def.id] = Date.now();
        out.push(`${ico('star')} +${def.stars || 0}`);
        const dia = Math.max(2, def.stars || 0);
        save.diamonds += dia; out.push(`${ico('diamond')} +${dia}`);
      }
      if (game.lastOrbs) out.unshift(`${ico('orb')} +${game.lastOrbs}`);
    }
    persist(); checkAchievements();
    return out.join('   ');
  },
};

// ------------------------------------------------------------------ interfaz
let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
function renderWallet() {
  if (!save.stats || !save.completed) return; // aún sin inicializar (arranque de game.js)
  const vals = [starsTotal(), save.diamonds, save.orbs, totalCoins()];
  const ICONS = [['star', 'Estrellas'], ['diamond', 'Diamantes'], ['orb', 'Orbes'], ['coin', 'Monedas']];
  document.querySelectorAll('[data-wallet]').forEach((el) => {
    // la estructura se crea una vez; luego los números suben animados (UIFX.countTo)
    if (!el.querySelector('b')) el.innerHTML = ICONS.map(([k, n]) => `<span title="${n}" data-cur="${k}">${ico(k)} <b>0</b></span>`).join('');
    el.querySelectorAll('b').forEach((b, i) => { if (window.UIFX) window.UIFX.countTo(b, vals[i]); else b.textContent = vals[i]; });
  });
}
function renderRewards(tab) {
  game.rewardsTab = tab || game.rewardsTab || 'tienda';
  refreshQuests();
  const t = game.rewardsTab;
  $('rwTabs').innerHTML = [['tienda', 'Tienda'], ['cofres', 'Cofres'], ['misiones', 'Misiones'], ['logros', 'Logros']]
    .map(([k, n]) => `<button class="${k === t ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('');
  let html = '';
  if (t === 'tienda') {
    const CAT_ICO = { Estela: 'trail', Muerte: 'burst', Llama: 'flame', Brillo: 'glow' };
    for (const cat of ['Estela', 'Muerte', 'Llama', 'Brillo']) {
      html += `<h3>${ico(CAT_ICO[cat])} ${cat}</h3><div class="shop-grid">` + SHOP.filter((it) => it.cat === cat).map((it) => {
        const owned = save.owned.includes(it.id), eq = owned && isEquipped(it);
        const label = eq ? `${ico('check')} Equipado` : owned ? 'Equipar' : `${ico(it.dia ? 'diamond' : 'orb')} ${it.price}`;
        return `<button class="shop-item${eq ? ' on' : ''}${owned ? '' : ' buy'}" data-item="${it.id}"><canvas class="pv" width="96" height="48" data-pv="${it.id}"></canvas><b>${it.name}</b><span>${label}</span></button>`;
      }).join('') + '</div>';
    }
  } else if (t === 'cofres') {
    html = '<div class="chests">' + Object.entries(CHESTS).map(([k, c]) => {
      const left = chestLeft(k);
      return `<div class="chest${left ? '' : ' ready'}"><div class="chest-ico">${ico(k === 'big' ? 'gift' : 'chest')}</div><b>${c.name}</b>` +
        `<span>${ico('orb')} ${c.orbs[0]}–${c.orbs[1]} ${c.diaChance < 1 ? 'y a veces' : 'y'} ${ico('diamond')} ${c.dia[0] || 1}–${c.dia[1]}</span>` +
        (left ? `<span class="wait" data-wait="${k}">Abre en ${fmtTime(left)}</span>` : `<button class="btn small" data-chest="${k}">Abrir</button>`) + '</div>';
    }).join('') + '</div>';
  } else if (t === 'misiones') {
    html = '<p class="rw-note">Se renuevan cada día.</p>' + save.quests.list.map((q, i) => {
      const qt = QUEST_TYPES.find((x) => x.type === q.type), prog = Math.min(q.goal, questProgress(q)), done = prog >= q.goal;
      return `<div class="quest${done ? ' done' : ''}"><div><b>${qt.text(q.goal)}</b><div class="track"><div class="fill" style="width:${prog / q.goal * 100}%"></div></div><span>${prog} / ${q.goal}</span></div>` +
        (q.claimed ? `<span class="claimed">${ico('check')} Hecha</span>` : done ? `<button class="btn small" data-quest="${i}">+${q.reward} ${ico('diamond')}</button>` : `<span class="reward">${ico('diamond')} ${q.reward}</span>`) + '</div>';
    }).join('');
  } else {
    const n = Object.keys(save.ach).length;
    html = `<p class="rw-note">${n} de ${ACH.length} logros</p><div class="achs">` + ACH.map(([id, name, desc, , r]) => {
      const got = !!save.ach[id];
      return `<div class="ach${got ? ' got' : ''}"><span class="ico">${ico(got ? 'trophy' : 'lock')}</span><div><b>${name}</b><span>${desc}</span></div><span class="reward">${r.orbs ? ico('orb') + ' ' + r.orbs : ico('diamond') + ' ' + r.diamonds}</span></div>`;
    }).join('') + '</div>';
  }
  $('rwBody').innerHTML = html;
  renderWallet();
  $('rwTabs').querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { click(); renderRewards(b.dataset.tab); }));
  $('rwBody').querySelectorAll('[data-item]').forEach((b) => b.addEventListener('click', () => {
    const it = SHOP.find((x) => x.id === b.dataset.item);
    if (!save.owned.includes(it.id)) {
      const have = it.dia ? save.diamonds : save.orbs;
      if (have < it.price) { toast(`Te faltan ${it.price - have} ${it.dia ? 'diamantes' : 'orbes'}`); return; }
      if (it.dia) save.diamonds -= it.price; else save.orbs -= it.price;
      save.owned.push(it.id); save.stats.bought++;
      Sound.sfx('coin'); toast(`Comprado: ${it.name}`);
    } else click();
    save.cos[COS_KEY[it.cat]] = itemValue(it.id);
    persist(); applyCosmetics(); checkAchievements(); renderRewards();
  }));
  $('rwBody').querySelectorAll('[data-chest]').forEach((b) => b.addEventListener('click', () => { openChest(b.dataset.chest); renderRewards(); }));
  $('rwBody').querySelectorAll('[data-quest]').forEach((b) => b.addEventListener('click', () => {
    const q = save.quests.list[Number(b.dataset.quest)];
    if (q.claimed) return;
    q.claimed = true;
    giveReward({ diamonds: q.reward }, 'Misión completada');
    Sound.sfx('coin'); persist(); renderRewards();
  }));
}
// cuenta atrás de los cofres mientras la pantalla está abierta
setInterval(() => {
  if (game.screen !== 'rewards' || game.rewardsTab !== 'cofres') return;
  let ready = false;
  document.querySelectorAll('[data-wait]').forEach((el) => { const left = chestLeft(el.dataset.wait); if (!left) ready = true; else el.textContent = `Abre en ${fmtTime(left)}`; });
  if (ready) renderRewards();
}, 1000);

// ------------------------------------------------------------------ música propia por nivel
// Cualquier MP3/OGG del equipo como música de un nivel, guardado en IndexedDB.
function songFor(def) { const s = save.songs[def.id]; return s && s.key ? s : null; }
async function prepareSong(def) {
  const s = songFor(def);
  if (!s) {
    if (def.song && def.song.startsWith('track:')) return (await Sound.loadTrack(def.song)) ? def.song : (def.synth || 'pulso');
    return def.song;
  }
  try { if (!Sound.isReady(s.key)) await Sound.prepare(s.key); return Sound.isReady(s.key) ? s.key : def.song; } catch (e) { return def.song; }
}
function renderSongRow() {
  const def = defs[game.sel], s = songFor(def);
  const tr = def.song && def.song.startsWith('track:') && window.Tracks ? Tracks.TRACKS[def.song.slice(6)] : null;
  $('lvSong').textContent = s ? s.name : tr ? tr.name : 'Original';
  $('lvSongReset').hidden = !s;
}
$('lvSongBtn').addEventListener('click', () => { click(); $('lvSongFile').click(); });
$('lvSongFile').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  unlockAudio();
  try {
    const r = await Sound.importSong(file);
    save.songs[defs[game.sel].id] = { key: r.key, name: r.name || file.name };
    persist(); renderSongRow(); toast('Música cambiada: ' + (r.name || file.name));
  } catch (err) { toast('No se pudo cargar ese archivo de audio'); }
});
$('lvSongReset').addEventListener('click', () => { click(); delete save.songs[defs[game.sel].id]; persist(); renderSongRow(); });

// ------------------------------------------------------------------ arranque
$('rewardsBtn').addEventListener('click', () => { unlockAudio(); click(); renderRewards('tienda'); showScreen('rewards'); });
$('rewardsBack').addEventListener('click', () => { click(); renderWallet(); showScreen('menu'); });
refreshQuests();
applyCosmetics();
renderWallet();
checkAchievements();
window.ND3D.Meta = Meta;
