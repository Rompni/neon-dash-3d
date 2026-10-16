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

export default defineConfig({
  root: 'src',
  base: './',
  publicDir: path.resolve(__dirname, 'public'),
  build: { outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true, chunkSizeWarningLimit: 1500, assetsInlineLimit: 0 },
  server: { port: 8792, strictPort: true },
  preview: { port: 8792, strictPort: true },
  plugins: [
    juego(),
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
