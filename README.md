# Neon Dash 3D

Plataformas rítmico en 3D para navegador, hecho con Three.js. Usa la física y los niveles de Neon Dash
(determinista a 240 Hz y probada con el bot), así que lo jugable es idéntico. Lo nuevo son los gráficos:
mundo 3D con cámara en perspectiva, bloom, ciudad nocturna, partículas y modelos para cada modo.

## Qué tiene

- **12 niveles con canciones reales** (generadas con Flow Music, IA): los 8 originales duran como mucho 1:30 y los nuevos
  (Engranaje, Vértigo, ZigZag, Apex) entre 1:30 y 2:05. La duración sale en la tarjeta de cada nivel. Cada nivel sigue las secciones
  de su canción: cambios de modo y portales al empezar los drops, saltos y orbes en los tiempos, destellos por compás, colores por
  sección y triggers que mueven obstáculos y la cámara. Primer Pulso, Órbita, Fase Doble, Ladera, Espejo, Abismo, Baño de Sangre,
  Telaraña, Engranaje, Vértigo, ZigZag y Apex (el final demonio).
- **14 fondos:** ciudad, montañas, atardecer, cristales, espacio, vacío, volcán, bosque, desierto, glaciar (con aurora), circuito,
  océano, ruinas y tormenta (con relámpagos). Cada nivel tiene el suyo y en el editor se puede elegir cualquiera.
- **Triggers de grupo:** mover, girar, apagar/encender, desvanecer, spawn y follow sobre objetos reales (con su
  colisión), y triggers de cámara (zoom, desplazamiento, giro).
- **Modos:** cubo, nave, bola, ovni, onda, robot, araña, swing y dual (gemelo con la gravedad contraria).
- **Garaje:** 96 modelos de Blender: 12 estilos por modo (Clásico, Demonio, Tecno, Sonrisa, Pinchos, Núcleo, Cristal, Cuernos, Blindado, Runa, Ojos y Equis). Cada estilo se desbloquea para todos los modos al recoger cierto número de monedas y trae sus colores (o se usan las 6 paletas del jugador).
- **Editor de niveles** (botón Crear): ver la sección Editor más abajo.
- **Detalles de partida:** entrada de cámara al empezar, salida volando por la meta, diamantes de checkpoint en práctica, aviso de nuevo récord, estela y aplastamiento al aterrizar.
- **Menú** con el jugador jugando solo (rutas del bot), su música en bucle y bloom selectivo (el neón brilla, el jugador conserva sus colores).
- **Progreso:** orbes, diamantes, tienda de estelas, muertes, llamas y brillos, logros, misiones diarias y cofres.

## Jugar

```
npm install          # la primera vez
npm run dev          # servidor de desarrollo con recarga: http://localhost:8792
npm run build        # versión para publicar en dist/ (subir la carpeta entera)
npm run preview      # sirve dist/ en http://localhost:8792 para probar la versión final
```

Hecho con Vite. Todo va dentro del juego (Three.js 0.170.0 y la fuente Chakra Petch), sin depender de
servicios externos. Es una PWA: se puede instalar como app y, una vez abierto, funciona sin conexión (las canciones
se guardan la primera vez que suenan). `dist/` usa rutas relativas, así que sirve en cualquier carpeta (itch.io,
GitHub Pages, Electron, Capacitor).

- **Saltar:** `Espacio` / `↑` / `W` / clic / toque. **Pausa:** `Esc`. **Reiniciar:** `R`.
- **Práctica:** puntos de control automáticos; `Z` marca uno y `X` lo quita.
- **Ajustes:** volumen, resolución (Nativa, Alta, Media, Baja), calidad (con o sin bloom) y colores del jugador.

## Editor

Menú → **✎ Crear** abre "Mis niveles" (nuevo, importar, editar, jugar, duplicar, compartir, borrar).
Los niveles se guardan en este navegador (localStorage `neondash3d.levels.v1`) y se comparten con un código
`ND1.` compatible con el editor de Neon Dash.

- **Apilar:** en la vista 3D, al hacer clic sobre la cara de arriba o de un lado de un objeto, el nuevo se coloca pegado a ella.
- **Herramientas:** `1` Poner · `2` Mover (elegir y arrastrar) · `3` Borrar · `4` Vista. Clic derecho borra.
- **Teclas:** `R` gira (pinchos, portales, pads, rampas; también lo que se va a colocar) · `Supr` borra · `Ctrl+Z` / `Ctrl+Y` ·
  `Ctrl+D` duplica · `G` rejilla de medio bloque · `V` vista plana/3D · `P` probar · `Inicio` vuelve al principio.
- **Vista:** rueda o flechas/WASD desplazan, `Ctrl+rueda` o `+`/`−` hacen zoom, `Espacio`+arrastrar mueve la vista.
  En móvil: tocar coloca, arrastrar pinta, dos dedos desplazan y hacen zoom.
- **Ajustes del nivel (⚙):** nombre, música (las canciones reales o las sintetizadas), BPM, modo y velocidad iniciales, largo (0 = último objeto + 12), paisaje de fondo y colores.
- **Triggers** (pestaña Triggers) y campo **Grupo** en cada objeto; `T` previsualiza el efecto de los triggers donde estás mirando.
  "Cambio de color" (pestaña Extra) cambia los colores a partir de una x.
- **Probar / Práctica** juegan el nivel; **Desde aquí** (`Mayús+P`) empieza donde estás mirando, con el modo y la velocidad
  de los portales anteriores. Al salir (pausa → Editor) se vuelve al editor en el mismo sitio.
- **Verificar:** el bot busca una ruta ganadora en segundo plano; si no la hay, te lleva al punto donde se atasca.

`src/editor.js` dibuja con `World.buildLevel` / `World.frame` y pone su propia cámara (y la rejilla, el fantasma y las
selecciones, en un grupo propio de la escena) sólo mientras la pantalla es `editor`.

## Estructura

```
src/sim.js      física (la de Neon Dash más robot, araña, swing y dual; no cambiar sin pasar el bot)
src/solver.js   el bot que busca rutas (lo usan los tests, las demos y el botón Verificar del editor)
src/editor.js   editor de niveles
src/levels.js   Builder y utilidades de los niveles (ritmo, adornos) y el orden del menú
src/niveles/    un archivo por nivel
src/tracks.js   datos medidos de cada canción: BPM, primer compás, duración, energía por compás
public/music/   las canciones en MP3 (recortadas al final de una sección, volumen igualado a −13 LUFS); lo que queda
                tras la meta de un nivel (r.end) se quita solo (levels.js, recortar)
public/icons/   íconos de la app (PWA), favicon y garaje.webp (miniaturas de los 96 modelos, de Blender)
src/audio.js    reproducción de las canciones, música sintetizada de respaldo y efectos
src/meta.js     progreso: orbes, diamantes, tienda, logros, misiones, cofres y música propia por nivel
src/demos.js    rutas ganadoras del bot para la demo del menú (generado por tools/solve-demos.js)
src/main.js     punto de entrada: carga los scripts en orden y arranca el juego
assets/modelos.glb  modelos del jugador (exportados de Blender; Vite lo copia a dist/assets)
src/world.js    todo lo 3D: escena, materiales, construcción del nivel, jugador, partículas, posproceso y cámara
src/game.js     bucle de paso fijo, entrada, cámara vertical, menús y guardado (localStorage neondash3d.v1)
src/index.html  interfaz (pantallas y sprite de íconos SVG)
src/ui.css      estilos: arcade neón (paneles con esquinas cortadas, botones en paralelogramo, Chakra Petch)
vite.config.js  Vite + PWA; sirve world.js, game.js y meta.js juntos como un módulo (comparten ámbito)
```

Escala: 1 bloque = 30 unidades de la física = 1 unidad 3D. El plano de juego es z = 0.

## Música y sincronización

La música empieza a la vez que el nivel (x = 0). En cada nivel, `ritmo('<canción>', [[compás, velocidad], …])` da la x
de cada compás y tiempo según el BPM, el primer compás medido (`bar0`) y los portales de velocidad, así que las secciones se
escriben por compases: `b.portal(r(15), …)` cae justo en el drop del compás 15. `r.end` es el final de la canción.
Los WAV originales están en `music/` (fuera de git); `src/tracks.js` se generó midiendo tempo (librosa), fase del bombo y
energía por compás. Créditos: "Música: generada con Flow Music (IA)" (se muestra en Ajustes).

## Herramientas

```
node tools/solve-demos.js        # recalcula las rutas de la demo del menú (unos 10 min; o sólo algunos: … 6 telarana)
```

Modelos en Blender: `tools/blender/models.py` crea la escena (`assets/modelos.blend`) con los 96 modelos (12 estilos para cada uno de los 8 modos),
y `export_glb()` exporta `assets/modelos.glb`. Desde la consola de Python de Blender:
`import sys; sys.path.insert(0, r'<repo>/tools/blender'); import models; models.build()` y, en otra llamada, `models.export_glb()`.
Los materiales `color1` (cuerpo) y `neon` (brillo) los recolorea el juego con los colores del diseño o del jugador. Escala: 1 unidad = 1 bloque, mirando a +X.

## Tests

`npm test` corre los tests de física, de los modos nuevos y de los triggers, y comprueba que las rutas de la demo completan cada nivel.
`npm run bot` comprueba con el bot que los 12 niveles se pueden completar cambiando la entrada cada 4 y cada 12 ticks, sin esquivar portales
(los niveles largos tardan: varias horas en total; para uno solo, `node test/bot.js 12 <id>`).
Las pruebas de margen por toque (fair, wavefair) siguen sólo en el repo de Neon Dash.
