// Punto de entrada (Vite). El orden importa: los scripts clásicos dejan sus globales (Sim, Tracks, Levels, Solver,
// Sound, Demos) antes de que arranque el juego, y el editor va al final.
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import './ui.css';

import './sim.js';
import './tracks.js';
import.meta.glob('./niveles/*.js', { eager: true }); // registran sus constructores en NIVELES
import './levels.js';
import './solver.js';
import './audio.js';
import './demos.js';

import './modelos-url.js';

import 'virtual:juego'; // world.js + game.js + meta.js
import './editor.js';
