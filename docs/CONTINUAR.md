# Neon Dash 3D — estado y cómo continuar

Última actualización: 15 de octubre de 2026 (rama `main`, en GitHub: git@github.com:Rompni/neon-dash-3d.git).

## Qué es

Plataformas rítmico 2.5D en Three.js, juego nuevo y propio (solo *inspirado* en juegos del género:
no mencionar otros juegos en código ni textos). Usa la física de Neon Dash (repo hermano
`C:\Users\rompni\neon-dash`, juego 2D de referencia) a 240 Hz fija.

## Estado actual

- **Vite + PWA:** `src/main.js` es la entrada; ya no hay build.js ni models.js. Íconos de la app en public/icons.

- **12 niveles** con canciones reales de Flow Music (IA), sincronizados por compases:
  Primer Pulso, Órbita, Fase Doble, Ladera, Espejo, Abismo, Baño de Sangre, Telaraña (los 8 originales, ≤ 1:30),
  Engranaje (1:30), Vértigo (2:05), ZigZag (1:50), Apex (2:01, final demonio). Todos los pasa el bot a K=4 y K=12.
- **14 fondos** (theme3d por nivel, elegibles en el editor): ciudad, montañas, atardecer, cristales, espacio, vacío,
  volcán, bosque, desierto, glaciar, circuito, océano, ruinas, tormenta.
- **Triggers de grupo** (move, rotate, alpha, toggle, spawn, follow, camzoom/camoffset/camrotate) con colisión,
  editor con pestaña Triggers y campo Grupo.
- **Garaje** 96 modelos Blender (12 estilos × 8 modos). El cubo Clásico tiene emblema propio (visor con ">>").
- **Progreso** (src/meta.js): orbes, diamantes, tienda de cosméticos, logros, misiones, cofres.
- **Música del menú** en bucle (Neon Menu Loop); canciones en `public/music/*.mp3`.
- **Render:** MSAA x4 en el posproceso (se apaga en calidad Baja), neón solo en el contorno exterior de bloques
  y rampas, ventanas de ciudad sin ruido, línea del suelo de 0,1.
- **Independiente de los Hz:** física fija + pulsaciones con `e.timeStamp`; partículas por dt (`spawnN`);
  `test/framerate.test.js` lo comprueba a 30/60/144/240 fps.
- Tarjeta de nivel con duración (⏱) y nombre de la canción. Créditos de la música en Ajustes.

- **Modo mod (dueño):** en `npm run dev`, el editor muestra "Niveles principales · Mod": abre un nivel oficial,
  edítalo y "Guardar en el juego" lo escribe en `src/niveles/datos/<id>.json` (levels.js lo usa en lugar del
  archivo del nivel). "Original" lo borra. En la versión publicada no aparece.
- **Idiomas:** inglés por defecto, español opcional (`src/i18n.js`, claves en/es).

## Cómo trabajar

```
npm run dev                        # Vite en http://localhost:8792 (preview "neon-dash-3d" en .claude/launch.json)
npm run build && npm run preview   # versión final (PWA) en dist/ (preview "neon-dash-3d-build")
npm test                           # física, modos, demos, triggers, framerate
node test/bot.js 12 <id>           # bot sobre un nivel (los largos tardan 10-25 min)
node tools/solve-demos.js 6 <ids>  # rutas del menú (lanzar UNA sola tanda a la vez: escriben src/demos.js)
```

- **Niveles:** un archivo por nivel en `src/niveles/<id>.js`; `src/levels.js` tiene Builder, `ritmo()`, `adornos`,
  el orden (ORDER) y `recortar` (quita lo que queda tras la meta). `ritmo('<canción>', [[compás, vel], …])`
  devuelve r(compás, tiempo) → x; r.end = final de la canción.
- **Canciones:** WAV originales en `music/` (fuera de git). Análisis con librosa en un venv del scratchpad;
  recorte/normalización con ffmpeg (−13 LUFS, MP3 128k, fundido al final de una sección). Datos en `src/tracks.js`
  (bpm, first, bar0, dur, energy por compás). Tempos medidos: 120/144/150/136/120/173/140/160/126/140/160/150.
- **Blender:** instalado desde Microsoft Store (5.2.2). Sin ventana con
  `%LOCALAPPDATA%\Microsoft\WindowsApps\blender-launcher.exe -b [archivo.blend] --python script.py`
  (el blender.exe del paquete da "acceso denegado"). `tools/blender/models.py`: `build()` y guardar el .blend en una
  llamada; `export_glb()` y `preview_sheet()` en otra abriendo `assets/modelos.blend`. Luego
  el juego usa `assets/modelos.glb` directamente (src/modelos-url.js). Hoja de íconos: `assets/iconos_todos.png`.

## Pendiente / ideas acordadas

1. **Íconos parecidos a otro juego:** rediseñar caras de Tecno (cubo verde) y Blindado (cubo azul, también su robot
   y araña) — ojos cuadrados + boca recta —, y quizá Pinchos. Propuesto, esperando el visto bueno del usuario.
2. **Para publicar:** HECHO el paso a Vite + PWA (Three.js y fuentes locales, .glb aparte, instalable y sin conexión).
   Falta: ajuste de retraso de audio; pantalla de créditos y licencias (Three.js MIT, fuentes OFL);
   exportar/importar partida; calidad automática según FPS; .zip para itch.io; inglés; tutorial corto.
   Recomendación dada: seguir en web (no Unity/Godot); Steam con Electron/Tauri y móvil con Capacitor más adelante.
3. Pruebas con personas (el bot solo prueba que se puede pasar). Tramos más exigentes según los agentes: onda 4x de
   Abismo, araña 3x de Telaraña y Baño de Sangre, onda mini 3x de Fase Doble, saltos del robot en Engranaje.
4. Los nuevos (Vértigo, ZigZag, Apex) duran más de 1:30; el usuario solo pidió recortar los originales.
5. "Neon Rush" (2 versiones) solo está en el editor; sin nivel asignado.
6. Repo `C:\Users\rompni\neon-dash` tiene cambios sin commit (sprites Blender, acorde de audio); nunca se confirmó.
