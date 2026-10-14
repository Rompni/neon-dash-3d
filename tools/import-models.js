// Mete assets/modelos.glb (exportado por tools/blender/models.py) en src/models.js como data URI.
// Uso: node tools/import-models.js
'use strict';
const fs = require('fs');
const path = require('path');
const buf = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modelos.glb'));
const out = `/* Generado por tools/import-models.js. No editar a mano. */
(function (root) {
  'use strict';
  // Modelos del jugador hechos en Blender (los 8 modos y los diseños del garaje), en GLB.
  root.Models3D = 'data:model/gltf-binary;base64,${buf.toString('base64')}';
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'models.js'), out);
console.log(`src/models.js: ${(buf.length / 1024).toFixed(0)} KB de GLB, ${(out.length / 1024).toFixed(0)} KB en base64`);
