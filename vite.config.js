// Vite: servidor de desarrollo (npm run dev) y build para publicar (npm run build → dist/).
// src/ es la raíz de la página; public/ (música e íconos) se copia tal cual. base './' para que funcione en
// cualquier carpeta (itch.io, GitHub Pages, Electron, Capacitor).
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, 'src');

// world.js, game.js y meta.js comparten ámbito (game usa World y meta usa funciones de game): se sirven juntos
// como un solo módulo, igual que hacía el build anterior.
const JUEGO = ['world.js', 'game.js', 'meta.js'];
function juego() {
  const ID = 'virtual:juego', RID = '\0virtual:juego.js';
  return {
    name: 'neon-dash-juego',
    resolveId(id) { return id === ID ? RID : null; },
    load(id) {
      if (id !== RID) return null;
      return JUEGO.map((f) => {
        const file = path.join(SRC, f);
        this.addWatchFile(file);
        return `/* ${f} */\n` + fs.readFileSync(file, 'utf8');
      }).join('\n');
    },
    handleHotUpdate({ file, server }) {
      if (!JUEGO.some((f) => path.join(SRC, f) === path.normalize(file))) return;
      // el módulo virtual no se invalida solo: sin esto se seguiría sirviendo la versión anterior
      const mod = server.moduleGraph.getModuleById(RID);
      if (mod) server.moduleGraph.invalidateModule(mod);
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}

// Modo mod del editor: guarda (POST) o restaura (DELETE) los datos de un nivel principal en
// src/niveles/datos/<id>.json. Sólo existe en el servidor de desarrollo (npm run dev), nunca en la versión publicada.
function modoMod() {
  const DIR = path.join(SRC, 'niveles', 'datos');
  return {
    name: 'neon-dash-mod',
    apply: 'serve',
    configureServer(server) {
      fs.mkdirSync(DIR, { recursive: true });
      server.watcher.unwatch(DIR); // guardar no recarga la página: el dueño recarga cuando quiera probarlo
      server.middlewares.use('/__mod/level', (req, res) => {
        const id = decodeURIComponent((req.url || '').replace(/^\//, '').split('?')[0]);
        const send = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
        if (!/^[a-z0-9-]{1,40}$/.test(id) || !fs.existsSync(path.join(SRC, 'niveles', id + '.js'))) return send(400, { error: 'nivel desconocido' });
        const file = path.join(DIR, id + '.json');
        const invalidate = () => {
          for (const f of [file, path.join(SRC, 'niveles-datos.js'), path.join(SRC, 'levels.js')]) {
            for (const m of server.moduleGraph.getModulesByFile(f) || []) server.moduleGraph.invalidateModule(m);
          }
        };
        if (req.method === 'DELETE') {
          if (fs.existsSync(file)) fs.unlinkSync(file);
          invalidate();
          return send(200, { ok: true, restored: true });
        }
        if (req.method !== 'POST') return send(405, { error: 'usa POST o DELETE' });
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 8e6) req.destroy(); });
        req.on('end', () => {
          try {
            const d = JSON.parse(body);
            if (!Array.isArray(d.objects) || !Array.isArray(d.colors)) throw new Error('faltan objetos o colores');
            fs.writeFileSync(file, JSON.stringify(d, null, 1) + String.fromCharCode(10));
            invalidate();
            send(200, { ok: true, file: path.relative(path.resolve(__dirname), file) });
          } catch (e) { send(400, { error: e.message }); }
        });
      });
    },
  };
}

export default defineConfig({
  root: 'src',
  base: './',
  publicDir: path.resolve(__dirname, 'public'),
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true, chunkSizeWarningLimit: 1500, assetsInlineLimit: 0 },
  server: { port: 8792, strictPort: true },
  preview: { port: 8792, strictPort: true },
  plugins: [
    juego(),
    modoMod(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Neon Dash 3D',
        short_name: 'Neon Dash',
        description: 'A 3D rhythm platformer: jump to the beat of the music.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#07060f',
        theme_color: '#07060f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // la página, el código, las fuentes y los modelos se guardan al instalar (juega sin conexión);
        // las canciones se guardan la primera vez que suenan
        globPatterns: ['**/*.{html,js,css,woff2,png,webp,svg,glb}'],
        globIgnores: ['music/**'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.includes('/music/'),
          handler: 'CacheFirst',
          options: { cacheName: 'canciones', expiration: { maxEntries: 30 }, rangeRequests: true },
        }],
      },
    }),
  ],
});
