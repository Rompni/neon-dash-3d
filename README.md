# Neon Dash 3D

Plataformas rítmico en 3D para navegador, hecho con Three.js. Usa la física y los niveles de Neon Dash
(determinista a 240 Hz y probada con el bot), así que lo jugable es idéntico. Lo nuevo son los gráficos:
mundo 3D con cámara en perspectiva, bloom, ciudad nocturna, partículas y modelos para cada modo.

## Qué tiene

- **8 niveles**, uno por fondo (ciudad, espacio, cristales, montañas, atardecer, vacío, volcán), con los destellos y movimientos que trae cada nivel.
- **Modos:** cubo, nave, bola, ovni, onda, robot, araña, swing y dual (gemelo con la gravedad contraria). El nivel 8, Telaraña, usa los nuevos.
- **Garaje:** 96 modelos de Blender: 12 estilos por modo (Clásico, Demonio, Tecno, Sonrisa, Pinchos, Núcleo, Cristal, Cuernos, Blindado, Runa, Ojos y Equis). Cada estilo se desbloquea para todos los modos al recoger cierto número de monedas y trae sus colores (o se usan las 6 paletas del jugador).
- **Editor de niveles** (botón Crear): ver la sección Editor más abajo.
- **Detalles de partida:** entrada de cámara al empezar, salida volando por la meta, diamantes de checkpoint en práctica, aviso de nuevo récord, estela y aplastamiento al aterrizar.
- **Menú** con el jugador jugando solo (rutas del bot) y bloom selectivo (el neón brilla, el jugador conserva sus colores).

## Jugar

```
node build.js        # genera dist/index.html (página completa) y dist/neon-dash-3d.html (fragmento para publicar)
npm run serve        # http://localhost:8792
```

Three.js se carga desde jsdelivr (versión 0.170.0), así que la primera vez hace falta conexión.

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
- **Ajustes del nivel (⚙):** nombre, música, BPM, modo y velocidad iniciales, largo (0 = último objeto + 12) y colores.
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
src/levels.js   los 8 niveles (7 de Neon Dash y Telaraña, con los modos nuevos)
src/audio.js    música y efectos sintetizados (copiados de Neon Dash)
src/demos.js    rutas ganadoras del bot para la demo del menú (generado por tools/solve-demos.js)
src/models.js   modelos del jugador en GLB, en base64 (generado por tools/import-models.js)
src/world.js    todo lo 3D: escena, materiales, construcción del nivel, jugador, partículas, posproceso y cámara
src/game.js     bucle de paso fijo, entrada, cámara vertical, menús y guardado (localStorage neondash3d.v1)
src/index.html  interfaz y estilos
build.js        junta todo en un HTML; <script src="a.js+b.js"> concatena módulos en un solo <script>
```

Escala: 1 bloque = 30 unidades de la física = 1 unidad 3D. El plano de juego es z = 0.

## Herramientas

```
node tools/solve-demos.js        # recalcula las rutas de la demo del menú (unos 10 min; o sólo algunos: … 6 telarana)
node tools/import-models.js      # mete assets/modelos.glb en src/models.js
```

Modelos en Blender: `tools/blender/models.py` crea la escena (`assets/modelos.blend`) con los 96 modelos (12 estilos para cada uno de los 8 modos),
y `export_glb()` exporta `assets/modelos.glb`. Desde la consola de Python de Blender:
`import sys; sys.path.insert(0, r'<repo>/tools/blender'); import models; models.build()` y, en otra llamada, `models.export_glb()`.
Los materiales `color1` (cuerpo) y `neon` (brillo) los recolorea el juego con los colores del diseño o del jugador. Escala: 1 unidad = 1 bloque, mirando a +X.

## Tests

`npm test` corre los tests de física y de los modos nuevos, y comprueba que las rutas de la demo completan cada nivel.
`npm run bot` comprueba con el bot que los 8 niveles se pueden completar cambiando la entrada cada 4 y cada 12 ticks, sin esquivar portales (unos 20 min).
Las pruebas de margen por toque (fair, wavefair) siguen sólo en el repo de Neon Dash.
