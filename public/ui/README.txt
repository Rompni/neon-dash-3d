Neon Dash 3D - iconos 3D de la interfaz
=======================================

Generados con Blender (EEVEE) por tools/blender/ui_icons.py. No editar a mano: para regenerarlos,
  blender-launcher.exe -b --python tools/blender/ui_icons.py -- [nombres...]
(renderiza y empaqueta; el empaquetado solo es  python tools/blender/ui_icons.py pack [nombres...]).

Todos son WebP con alfa (fondo transparente). Las animaciones son tiras HORIZONTALES:
fotograma i en x = i * ancho_fotograma, y = 0. Ancho total = fotogramas * ancho_fotograma.

Archivo              Fotogramas  Fotograma   Tira        Animación
-------------------  ----------  ----------  ----------  ------------------------------------------------
coin.webp            24          128x128     3072x128    bucle: giro completo de 360 grados (15 por fotograma)
diamond.webp         24          128x128     3072x128    bucle: giro completo de 360 grados
orb.webp             24          128x128     3072x128    bucle: giro completo; las cuentas recorren el anillo
star.webp            24          128x128     3072x128    bucle: giro completo de 360 grados
chest_small.webp     12          192x192     2304x192    una vez: cerrado (0-1), tapa abriéndose (2-8),
chest_big.webp       12          192x192     2304x192      abierto con luz saliendo (9-11); quedarse en el 11
medal_bronze.webp    1           160x160     -           estática
medal_silver.webp    1           160x160     -           estática
medal_gold.webp      1           160x160     -           estática
medal_locked.webp    1           160x160     -           estática (medalla oscura con candado)
coin_big.webp        1           256x256     -           estática, para pantallas de recompensa
diamond_big.webp     1           256x256     -           estática
orb_big.webp         1           256x256     -           estática

Los fotogramas 0 de coin/diamond/orb/star sirven como icono estático (la moneda se lee bien a 24 px).
El halo de neón ya está dentro de la imagen; el objeto ocupa ~75-85 % del fotograma.

Ejemplo con CSS steps() (moneda de 32 px: tira escalada a 24 x 32 = 768 px de ancho):

  .coin {
    width: 32px; height: 32px;
    background: url(/ui/coin.webp) 0 0 / 768px 32px no-repeat;
    animation: coin-spin 1s steps(24) infinite;
  }
  @keyframes coin-spin { to { background-position: -768px 0; } }

  .chest {
    width: 192px; height: 192px;
    background: url(/ui/chest_big.webp) 0 0 / 2304px 192px no-repeat;
    animation: chest-open 0.8s steps(11) forwards;   /* 11 pasos: termina en el fotograma 11 */
  }
  @keyframes chest-open { to { background-position: -2112px 0; } }   /* -11 * 192 */
