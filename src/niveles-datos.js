// Datos de niveles principales editados con el modo mod del editor (src/niveles/datos/<id>.json). Se registran
// antes de levels.js, que los usa en lugar de lo que genera el archivo de cada nivel.
const files = import.meta.glob('./niveles/datos/*.json', { eager: true, import: 'default' });
const datos = {};
for (const [path, data] of Object.entries(files)) datos[path.split('/').pop().replace('.json', '')] = data;
globalThis.NIVEL_DATOS = datos;
