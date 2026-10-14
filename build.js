// Empaqueta el juego en un único HTML: node build.js
// dist/index.html         → documento completo para abrir en local
// dist/neon-dash-3d.html  → fragmento para publicar como artifact
// <script src="a.js+b.js"> junta varios archivos en un solo <script> (los módulos comparten ámbito).
'use strict';
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src');
const dist = path.join(__dirname, 'dist');
fs.mkdirSync(dist, { recursive: true });

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
// data-worker: el editor junta el texto de esos scripts (física y bot) para verificar niveles en un Web Worker.
html = html.replace(/<script( type="module")?( data-worker)? src="([\w.+/-]+)"><\/script>/g, (_, mod, worker, files) => {
  const code = files.split('+').map((f) => `/* ${f} */\n` + fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
  return `<script${mod || ''}${worker || ''}>\n${code.replace(/<\/script/gi, '<\\/script')}\n</script>`;
});

fs.writeFileSync(path.join(dist, 'neon-dash-3d.html'), html);
const head = '<!doctype html>\n<html lang="es">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n';
fs.writeFileSync(path.join(dist, 'index.html'), head + html + '\n</html>\n');
console.log('dist/index.html y dist/neon-dash-3d.html (' + (html.length / 1024).toFixed(0) + ' KB)');

// Canciones (MP3) junto al HTML, en dist/music: pesan demasiado para ir dentro del archivo.
// Sin ellas (p. ej. el HTML suelto) el juego usa la música sintetizada.
const musicSrc = path.join(src, 'music'), musicDist = path.join(dist, 'music');
if (fs.existsSync(musicSrc)) {
  fs.mkdirSync(musicDist, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(musicSrc)) {
    const a = path.join(musicSrc, f), b = path.join(musicDist, f);
    if (!fs.existsSync(b) || fs.statSync(b).mtimeMs < fs.statSync(a).mtimeMs) { fs.copyFileSync(a, b); n++; }
  }
  console.log('dist/music: ' + fs.readdirSync(musicDist).length + ' canciones (' + n + ' copiadas)');
}
