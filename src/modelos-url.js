// Ruta del .glb con los modelos del jugador (archivo aparte, no en base64). Va en su propio módulo para que la
// global exista antes de que arranque world.js (los import se evalúan en orden, el código suelto después).
import modelos from '../assets/modelos.glb?url';
globalThis.Models3D = modelos;
