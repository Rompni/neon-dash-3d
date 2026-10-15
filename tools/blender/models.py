"""
Neon Dash 3D: modelos del jugador para exportar en GLB.

Doce diseños por modo (8 modos = 96 modelos), en el estilo de la hoja de referencia (formas geométricas con
bisel, líneas de neón en aristas y juntas, ojos y núcleos que brillan). Raíces: <modo> para el diseño 1 y
<modo>_2 … <modo>_12 para el resto, con modo en cubo, nave, bola, ovni, onda, robot, arana, swing.
    1 clásico   2 demonio   3 tecno    4 sonrisa   5 pinchos   6 núcleo
    7 cristal   8 cuernos   9 blindado 10 runa     11 ojos     12 equis
El juego tiñe los materiales, así que cada columna se distingue por la forma y los detalles, no por el color.

Escala: 1 unidad = 1 bloque, cada modelo centrado en su vacío (centro del bloque del jugador).
El jugador mira hacia +X y la cámara del juego lo ve desde -Y (al exportar, el +Z de glTF es el
-Y de Blender), así que la "cara" de cada modelo está en su lado -Y.
Robots y arañas apoyan los pies en z = -0.47 (como la base del cubo).

Materiales:
    color1  cuerpo, el juego lo tiñe con el color 1 del jugador
    color2  detalles sin brillo, se tiñe con el color 2
    neon    líneas, ojos y núcleos que brillan: se tiñe con el color 2 y se hace emisivo
    oscuro  cuerpo de los diseños "demonio" y "pinchos", bocas, cuencas de los ojos
    metal   pinchos, cuernos y remaches
    vidrio, luz, motor   se usan tal cual
Nombres que usa el juego: robot <raiz>_..pata±1 / _..pie±1 / _brazo±1 / _mano±1 (cadera en x ±0.16,
z -0.13; los de cuatro patas repiten la pata con prefijo b_); araña <raiz>_..pata{s}{k}_muslo|rodilla|pierna;
rotor del swing <raiz>_rotor… (barra horizontal sobre la cápsula, centrada en x = y = 0, z = 0.37: el juego la
gira sobre el eje vertical); luces *_luz*.

Uso desde la consola de Python de Blender (o por MCP):
    import sys; sys.path.insert(0, r'<repo>/tools/blender'); import models; models.build()
    models.export_glb()   # en otra llamada
    models.preview_sheet(r'C:/tmp/hoja.png')   # hoja 12 estilos x 8 modos, teñida como la referencia
Sin interfaz:
    blender -b -P tools/blender/models.py
"""
import bpy, bmesh, math, os
from mathutils import Vector, Matrix, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
BLEND = os.path.join(ROOT, 'assets', 'modelos.blend')
GLB = os.path.join(ROOT, 'assets', 'modelos.glb')


# ---------------------------------------------------------------- materiales
def mat(name, color=(0.9, 0.9, 0.9), rough=0.3, metal=0.2, emit=0.0, alpha=1.0, coat=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    if emit:
        b.inputs['Emission Color'].default_value = (*color, 1)
        b.inputs['Emission Strength'].default_value = emit
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    return m


def materials():
    return {
        'c1': mat('color1', (0.92, 0.92, 0.92), 0.3, 0.2, coat=0.5),
        'c2': mat('color2', (0.92, 0.92, 0.92), 0.25, 0.35, coat=0.5),
        'neon': mat('neon', (0.9, 0.9, 0.9), 0.3, 0.0, emit=1.5),
        'dark': mat('oscuro', (0.018, 0.018, 0.026), 0.35, 0.4),
        'metal': mat('metal', (0.78, 0.79, 0.82), 0.28, 0.55),
        'light': mat('luz', (1.0, 1.0, 1.0), 0.3, 0.0, emit=4.0),
        'glass': mat('vidrio', (0.65, 0.85, 1.0), 0.05, 0.1, alpha=0.4),
        'engine': mat('motor', (1.0, 0.55, 0.12), 0.3, 0.0, emit=6.0),
    }


# ---------------------------------------------------------------- piezas básicas
def link(obj, parent, m):
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    if m:
        obj.data.materials.append(m)
    return obj


def from_bm(name, bm, parent, m, smooth=False):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return link(bpy.data.objects.new(name, me), parent, m)


def bevel(o, w, seg=2):
    md = o.modifiers.new('Bisel', 'BEVEL')
    md.width = w; md.segments = seg; md.limit_method = 'ANGLE'
    md.harden_normals = False
    return o


def box(name, size, loc, parent, m, bev=0.0, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    o = from_bm(name, bm, parent, m)
    o.location = loc; o.rotation_euler = rot
    if bev:
        bevel(o, bev)
    return o


def sphere(name, r, loc, parent, m, scale=(1, 1, 1), seg=20, rings=10, half=False, smooth=True):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    if half:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0), plane_no=(0, 0, 1), clear_inner=True)
    bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
    o = from_bm(name, bm, parent, m, smooth=smooth)
    o.location = loc
    return o


def torus(name, R, r, loc, parent, m, axis='Z', seg=32, rseg=8):
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        c = Vector((math.cos(a), math.sin(a), 0))
        rings.append([bm.verts.new(c * R + r * (math.cos(2 * math.pi * j / rseg) * c + math.sin(2 * math.pi * j / rseg) * Vector((0, 0, 1))))
                      for j in range(rseg)])
    for i in range(seg):
        A, B = rings[i], rings[(i + 1) % seg]
        for j in range(rseg):
            bm.faces.new((A[j], A[(j + 1) % rseg], B[(j + 1) % rseg], B[j]))
    if axis == 'X':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    elif axis == 'Y':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
    o = from_bm(name, bm, parent, m, smooth=True)
    o.location = loc
    return o


def cylinder(name, r, depth, loc, parent, m, axis='Z', r2=None, seg=24, smooth=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=depth)
    if axis == 'X':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    elif axis == 'Y':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
    o = from_bm(name, bm, parent, m, smooth=smooth)
    o.location = loc
    return o


def slab(name, pts, thick, plane, parent, m, bev=0.0, offset=0.0):
    """Polígono extruido. plane='XY' (visto desde arriba, grosor en Z) o 'XZ' (visto de frente, grosor en Y)."""
    bm = bmesh.new()
    def P(a, b, t):
        return (a, b, t) if plane == 'XY' else (a, t, b)
    F = [bm.verts.new(P(a, b, offset - thick / 2)) for a, b in pts]
    K = [bm.verts.new(P(a, b, offset + thick / 2)) for a, b in pts]
    bm.faces.new(F); bm.faces.new(list(reversed(K)))
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((F[i], F[j], K[j], K[i]))
    o = from_bm(name, bm, parent, m)
    if bev:
        bevel(o, bev)
    return o


def rod(name, a, b, r, parent, m, r2=None, seg=8):
    """Cilindro (o cono si r2 != r) de a a b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    o = cylinder(name, r, d.length, tuple((a + b) / 2), parent, m, r2=r2, seg=seg)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    return o


def spike(name, base, tip, r, parent, M, seg=8):
    """Pincho de metal (cono) de base a tip."""
    return rod(name, base, tip, r, parent, M['metal'], r2=0.0, seg=seg)


def root(name, x):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = (x, 0, 0)
    e.empty_display_size = 0.6
    return e


# ---------------------------------------------------------------- líneas de neón
def _prism(bm, a, b, t, depth, ext=True):
    """Barra de sección rectangular (t de ancho, depth de fondo) de a a b, alargada t/2 por los extremos."""
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-6:
        return
    d.normalize()
    if ext:
        a = a - d * t / 2; b = b + d * t / 2
    ref = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))
    u = d.cross(ref).normalized() * (t / 2)
    v = d.cross(u).normalized() * (depth / 2)
    cs = [u + v, -u + v, -u - v, u - v]
    A = [bm.verts.new(a + c) for c in cs]
    B = [bm.verts.new(b + c) for c in cs]
    bm.faces.new(A[::-1]); bm.faces.new(B)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((A[i], A[j], B[j], B[i]))


def bars(name, segs, t, parent, m, depth=None, ext=True):
    """Varias barras (pares de puntos) en una sola malla."""
    bm = bmesh.new()
    for a, b in segs:
        _prism(bm, a, b, t, depth or t, ext)
    return from_bm(name, bm, parent, m)


def poly_segs(pts, y, closed=True):
    P = [(a, y, b) for a, b in pts]
    n = len(P) if closed else len(P) - 1
    return [(P[i], P[(i + 1) % len(P)]) for i in range(n)]


def line(name, pts, y, t, parent, m, closed=True, depth=None):
    """Línea de neón por un polígono del plano XZ, pegada al plano y (sobresale hacia -Y)."""
    d = depth or t
    return bars(name, poly_segs(pts, y - d / 2 + 0.006, closed), t, parent, m, depth=d)


def box_edges_segs(size, loc):
    sx, sy, sz = [v / 2 for v in size]
    cx, cy, cz = loc
    segs = []
    for a in (-1, 1):
        for b in (-1, 1):
            segs.append(((cx - sx, cy + a * sy, cz + b * sz), (cx + sx, cy + a * sy, cz + b * sz)))
            segs.append(((cx + a * sx, cy - sy, cz + b * sz), (cx + a * sx, cy + sy, cz + b * sz)))
            segs.append(((cx + a * sx, cy + b * sy, cz - sz), (cx + a * sx, cy + b * sy, cz + sz)))
    return segs


def box_edges(name, size, loc, t, parent, m):
    """Las 12 aristas de una caja como barras de neón."""
    return bars(name, box_edges_segs(size, loc), t, parent, m)


def fbox(name, w, h, cx, cz, y, d, parent, m, bev=0.0, rot=0.0):
    """Caja pegada al plano frontal y (sobresale d hacia -Y). rot gira en el plano de la cara."""
    return box(name, (w, d, h), (cx, y - d / 2 + 0.004, cz), parent, m, bev=bev, rot=(0, rot, 0))


def fpoly(name, pts, y, d, parent, m, bev=0.0):
    """Polígono del plano XZ pegado al plano frontal y."""
    return slab(name, pts, d, 'XZ', parent, m, bev=bev, offset=y - d / 2 + 0.004)


def shrink(pts, k):
    cx = sum(p[0] for p in pts) / len(pts); cz = sum(p[1] for p in pts) / len(pts)
    return [(cx + (a - cx) * k, cz + (b - cz) * k) for a, b in pts]


def mirror_x(pts):
    return [(-a, b) for a, b in reversed(pts)]


def sph(R, th, ph):
    """Punto de una esfera: ph = 0 en el polo -Y (de cara a la cámara), th = ángulo en el plano XZ."""
    return (R * math.cos(th) * math.sin(ph), -R * math.cos(ph), R * math.sin(th) * math.sin(ph))


def meridians(R, ths, ph0, ph1, n=8):
    segs = []
    for th in ths:
        pts = [sph(R, th, ph0 + (ph1 - ph0) * i / n) for i in range(n + 1)]
        segs += list(zip(pts, pts[1:]))
    return segs


def parallel(R, ph, th0, th1, n=8):
    pts = [sph(R, th0 + (th1 - th0) * i / n, ph) for i in range(n + 1)]
    return list(zip(pts, pts[1:]))


def core(p, parent, M, y, r, ring='dark', z=0.0, x=0.0):
    """Núcleo redondo que brilla (ojo de la bola, etc.) en el plano y."""
    cylinder(p + '_nucleo_aro', r, 0.06, (x, y + 0.01, z), parent, M[ring], axis='Y', seg=20)
    torus(p + '_nucleo_neon', r * 0.8, r * 0.09, (x, y - 0.02, z), parent, M['neon'], axis='Y', seg=20, rseg=4)
    cylinder(p + '_nucleo', r * 0.56, 0.04, (x, y - 0.015, z), parent, M['neon'], axis='Y', seg=16)


def eye(p, cx, cz, w, h, y, parent, M, sock=0.06, rot=0.0):
    """Ojo cuadrado: cuenca oscura y pantalla de neón."""
    fbox(p, w + sock, h + sock, cx, cz, y, 0.03, parent, M['dark'], rot=rot)
    fbox(p + '_neon', w, h, cx, cz, y - 0.02, 0.025, parent, M['neon'], rot=rot)


def poly_eye(p, pts, y, parent, M, k=0.62, sock=True):
    """Ojo poligonal: cuenca oscura con el mismo polígono más pequeño en neón."""
    if sock:
        fpoly(p, pts, y, 0.03, parent, M['dark'])
        fpoly(p + '_neon', shrink(pts, k), y - 0.02, 0.025, parent, M['neon'])
    else:
        fpoly(p + '_neon', pts, y, 0.035, parent, M['neon'])


# ---------------------------------------------------------------- patas
def robot_leg(rn, s, parent, M, hip, knee, foot, mt='c1', ms='c1', mf='c1', t=0.11, foot_size=(0.22, 0.3, 0.08),
              pre='', neon=True, knee_m='dark'):
    """Pata de robot doblada. Los nombres terminan en _pata±1 / _pie±1 para que el juego la anime."""
    hip, knee, foot = Vector(hip), Vector(knee), Vector(foot)
    bars(f'{rn}_{pre}pata{s}', [(hip, knee)], t, parent, M[mt], depth=t * 1.25)
    sphere(f'{rn}_{pre}rodilla_pata{s}', t * 0.66, tuple(knee), parent, M[knee_m], seg=12, rings=6)
    top = Vector((foot.x, foot.y, foot.z + foot_size[2] / 2))
    bars(f'{rn}_{pre}canilla_pata{s}', [(knee, top)], t * 0.9, parent, M[ms], depth=t * 1.1)
    box(f'{rn}_{pre}pie{s}', foot_size, tuple(foot), parent, M[mf], bev=0.025)
    if neon:
        off = Vector((0, -t * 0.62 - 0.01, 0))
        d = (knee - hip).normalized()
        bars(f'{rn}_{pre}neon_pata{s}', [(hip + off + d * 0.03, knee + off - d * 0.05),
                                         (knee + off + Vector((0, 0, -0.06)), top + off + Vector((0, 0, 0.03)))],
             0.03, parent, M['neon'], depth=0.02)


def spider_leg(rn, s, k, parent, M, hip, knee, foot, mu='c1', mp='dark', mk='neon', ru=0.045, rl=0.035,
               neon=False, claw=False, square=False):
    """Pata de araña: <raiz>_pata{s}{k}_muslo / _rodilla / _pierna (y piezas extra que acaban igual)."""
    p = f'{rn}_pata{s}{k}'
    hip, knee, foot = Vector(hip), Vector(knee), Vector(foot)
    end = foot + Vector((0, 0, 0.07)) if claw else foot
    if square:
        bars(p + '_muslo', [(hip, knee)], ru * 2, parent, M[mu], depth=ru * 2.2)
        bars(p + '_pierna', [(knee, end)], rl * 2, parent, M[mp], depth=rl * 2.2)
    else:
        rod(p + '_muslo', tuple(hip), tuple(knee), ru, parent, M[mu], r2=ru * 0.85)
        rod(p + '_pierna', tuple(knee), tuple(end), rl, parent, M[mp], r2=rl * (0.8 if claw else 0.5))
    sphere(p + '_rodilla', ru * 1.1, tuple(knee), parent, M[mk], seg=10, rings=6)
    if neon:
        off = Vector((0, -rl - 0.012, 0))
        bars(f'{rn}_n_pata{s}{k}_pierna', [(knee + off + (end - knee) * 0.12, knee + off + (end - knee) * 0.85)],
             0.024, parent, M['neon'], depth=0.02)
    if claw:
        spike(f'{rn}_g_pata{s}{k}_pierna', tuple(end), tuple(foot + Vector((s * 0.03, 0, 0))), rl * 1.1, parent, M, seg=6)


def legs6(rows=3):
    return [(-0.15, 0), (0.0, 1), (0.15, 2)] if rows == 3 else [(-0.13, 0), (0.13, 1)]


# ---------------------------------------------------------------- piezas compuestas (una malla para muchas piezas)
def cones(name, items, parent, m, seg=8, smooth=False):
    """Varios conos/cilindros en una malla. items: (a, b, r1[, r2]) con r2 = 0 por defecto (pincho)."""
    bm = bmesh.new()
    for it in items:
        a, b, r1 = Vector(it[0]), Vector(it[1]), it[2]
        r2 = it[3] if len(it) > 3 else 0.0
        d = b - a
        R = Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=d.length,
                              matrix=Matrix.Translation((a + b) / 2) @ R)
    return from_bm(name, bm, parent, m, smooth=smooth)


def boxes(name, items, parent, m, bev=0.0):
    """Varias cajas en una malla. items: (size, loc[, rot])."""
    bm = bmesh.new()
    for it in items:
        size, loc = it[0], it[1]
        rot = it[2] if len(it) > 2 else (0, 0, 0)
        bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(loc) @ Euler(rot).to_matrix().to_4x4()
                              @ Matrix.Diagonal((*size, 1)))
    o = from_bm(name, bm, parent, m)
    if bev:
        bevel(o, bev)
    return o


def ico(name, r, loc, parent, m, scale=(1, 1, 1), sub=1, jit=0.0, seed=1):
    """Icosfera facetada (cristal), con un poco de desorden opcional."""
    import random
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    if jit:
        rnd = random.Random(seed)
        for v in bm.verts:
            v.co *= 1 + rnd.uniform(-jit, jit)
    bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
    o = from_bm(name, bm, parent, m)
    o.location = loc
    return o


def tube(name, pts, radii, parent, m, seg=8, smooth=True):
    """Tubo por una polilínea con radio variable (radio 0 = punta). seg=4 da una sección cuadrada (cuchilla)."""
    bm = bmesh.new()
    pts = [Vector(p) for p in pts]
    n = len(pts)
    rings, pu = [], None
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        if pu is None:
            ref = Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((1, 0, 0))
            u = t.cross(ref).normalized()
        else:
            u = (pu - t * pu.dot(t)).normalized()
        v = t.cross(u)
        pu = u
        rr = radii[i]
        if rr <= 1e-5:
            rings.append([bm.verts.new(p)])
            continue
        off = math.pi / seg if seg == 4 else 0.0
        rings.append([bm.verts.new(p + rr * (math.cos(2 * math.pi * j / seg + off) * u + math.sin(2 * math.pi * j / seg + off) * v))
                      for j in range(seg)])
    for A, B in zip(rings, rings[1:]):
        if len(A) == 1 and len(B) == 1:
            continue
        if len(A) == 1:
            for j in range(seg):
                bm.faces.new((A[0], B[j], B[(j + 1) % seg]))
        elif len(B) == 1:
            for j in range(seg):
                bm.faces.new((A[j], A[(j + 1) % seg], B[0]))
        else:
            for j in range(seg):
                bm.faces.new((A[j], A[(j + 1) % seg], B[(j + 1) % seg], B[j]))
    if len(rings[0]) > 1:
        bm.faces.new(rings[0][::-1])
    if len(rings[-1]) > 1:
        bm.faces.new(rings[-1])
    return from_bm(name, bm, parent, m, smooth=smooth)


def bez(a, c, b, n=4):
    a, c, b = Vector(a), Vector(c), Vector(b)
    return [a * (1 - t) ** 2 + c * 2 * t * (1 - t) + b * t * t for t in [i / n for i in range(n + 1)]]


def horn(name, a, c, b, r, parent, M, n=5, m='metal'):
    """Cuerno curvo (de a a b pasando cerca de c) que se afila hasta la punta."""
    return tube(name, bez(a, c, b, n), [r * (1 - i / n) ** 0.8 for i in range(n + 1)], parent, M[m], seg=8)


def shard(name, pts, t, parent, m, offset=0.0, apex=None):
    """Polígono del plano XZ convertido en cristal: pirámide hacia delante y hacia atrás (caras planas)."""
    bm = bmesh.new()
    ring = [bm.verts.new((a, offset, b)) for a, b in pts]
    cx, cz = apex or (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
    F = bm.verts.new((cx, offset - t / 2, cz)); B = bm.verts.new((cx, offset + t / 2, cz))
    n = len(ring)
    for i in range(n):
        bm.faces.new((ring[i], ring[(i + 1) % n], F))
        bm.faces.new((ring[(i + 1) % n], ring[i], B))
    return from_bm(name, bm, parent, m)


def facet_face(name, half, depth, parent, m, apex=(0.04, 0.05)):
    """Cara de cristal para el cubo: ocho triángulos que suben hacia un vértice (sobresale hacia -Y)."""
    bm = bmesh.new()
    h = half
    out = [(-h, -h), (0.05, -h), (h, -h), (h, -0.04), (h, h), (-0.06, h), (-h, h), (-h, 0.03)]
    lift = [0, 0.45, 0, 0.3, 0, 0.5, 0, 0.35]
    O = [bm.verts.new((a, -depth * lift[i], b)) for i, (a, b) in enumerate(out)]
    A = bm.verts.new((apex[0], -depth, apex[1]))
    for i in range(8):
        bm.faces.new((O[i], O[(i + 1) % 8], A))
    bm.faces.new(O[::-1])
    return from_bm(name, bm, parent, m)


def fib_dirs(n):
    g = math.pi * (3 - math.sqrt(5))
    out = []
    for i in range(n):
        yv = 1 - 2 * (i + 0.5) / n
        rr = math.sqrt(1 - yv * yv)
        out.append(Vector((rr * math.cos(g * i), yv, rr * math.sin(g * i))))
    return out


def patch_list(rings):
    """rings: (ph0, ph1, n, th0) -> paneles de una esfera (ver sph: ph = 0 en el lado de la cámara)."""
    out = []
    for ph0, ph1, ns, off in rings:
        for i in range(ns):
            out.append((off + 2 * math.pi * i / ns, off + 2 * math.pi * (i + 1) / ns, ph0, ph1))
    return out


def patches(name, R, items, parent, m, thick=0.03, gap=0.05, step=0.11, loc=(0, 0, 0)):
    """Placas en relieve sobre una esfera de radio R separadas por juntas de ancho gap (una malla)."""
    bm = bmesh.new()
    for th0, th1, ph0, ph1 in items:
        sm = max(0.25, math.sin((ph0 + ph1) / 2))
        gt, gp = gap / (R * sm), gap / R
        th0 += gt / 2; th1 -= gt / 2
        ph0 = max(ph0 + gp / 2, 0.03); ph1 = min(ph1 - gp / 2, math.pi - 0.03)
        nt = max(2, int((th1 - th0) * R * sm / step) + 1)
        npp = max(1, int((ph1 - ph0) * R / step) + 1)
        O = [[bm.verts.new(sph(R + thick, th0 + (th1 - th0) * i / nt, ph0 + (ph1 - ph0) * j / npp)) for j in range(npp + 1)]
             for i in range(nt + 1)]
        for i in range(nt):
            for j in range(npp):
                f = bm.faces.new((O[i][j], O[i + 1][j], O[i + 1][j + 1], O[i][j + 1]))
                f.smooth = True
        border = [O[i][0] for i in range(nt + 1)] + [O[nt][j] for j in range(1, npp + 1)] + \
                 [O[i][npp] for i in range(nt - 1, -1, -1)] + [O[0][j] for j in range(npp - 1, 0, -1)]
        inner = [bm.verts.new(v.co * ((R - 0.01) / (R + thick))) for v in border]
        L = len(border)
        for k in range(L):
            bm.faces.new((border[k], border[(k + 1) % L], inner[(k + 1) % L], inner[k]))
            e = bm.edges.get((border[k], border[(k + 1) % L]))
            if e:
                e.smooth = False
    o = from_bm(name, bm, parent, m)
    o.location = loc
    return o


def round_eye(p, cx, cz, y, rad, parent, M, pupil=0.45, px=0.0):
    """Ojo redondo: cuenca oscura, aro de neón y pupila."""
    cylinder(p, rad * 1.18, 0.03, (cx, y - 0.01, cz), parent, M['dark'], axis='Y', seg=20)
    torus(p + '_neon', rad, rad * 0.17, (cx, y - 0.028, cz), parent, M['neon'], axis='Y', seg=16, rseg=4)
    cylinder(p + '_pupila', rad * pupil, 0.03, (cx + px, y - 0.03, cz), parent, M['neon'], axis='Y', seg=14)


def D(w, h, cx=0.0, cz=0.0):
    """Rombo en el plano de la cara."""
    return [(cx, cz + h), (cx + w, cz), (cx, cz - h), (cx - w, cz)]


def xmark(name, cx, cz, y, d0, d1, w, parent, m, depth=0.03):
    """Equis: cuatro brazos en diagonal que no llegan a tocarse en el centro."""
    segs = []
    for dx, dz in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
        u = Vector((dx, 0, dz)).normalized()
        c = Vector((cx, y - depth / 2 + 0.004, cz))
        segs.append((c + u * d0, c + u * d1))
    return bars(name, segs, w, parent, m, depth=depth, ext=False)


def side_marks(rn, r, M, pts, m='neon', d=0.455, top=False):
    """La misma marca en los lados ±X (y arriba) de un cubo."""
    for s in (-1, 1):
        o = fpoly(f'{rn}_marca{s}', pts, 0, 0.03, r, M[m])
        o.rotation_euler = (0, 0, -s * math.pi / 2); o.location = (s * d, 0, 0)
    if top:
        o = fpoly(f'{rn}_marca_arriba', pts, 0, 0.03, r, M[m])
        o.rotation_euler = (math.pi / 2, 0, math.pi / 2); o.location = (0, 0, d)


def mech_leg(rn, s, parent, M, hip, knee, foot, pre='', mt='c1', ms='c1', mf='dark', mk='dark', t=0.12,
             neon=True, claw=False):
    """Pata de mecha blindada: muslo cuadrado, espinilla en cuchilla curva y pie (o garra). Nombres _pata±1 / _pie±1."""
    hip, knee, foot = Vector(hip), Vector(knee), Vector(foot)
    bars(f'{rn}_{pre}pata{s}', [(hip, knee)], t, parent, M[mt], depth=t * 1.3)
    sphere(f'{rn}_{pre}rodilla_pata{s}', t * 0.62, tuple(knee), parent, M[mk], seg=10, rings=5)
    top = foot + Vector((0, 0, 0.05))
    mid = (knee + top) / 2 + Vector((s * 0.05, 0, 0))
    tube(f'{rn}_{pre}canilla_pata{s}', [knee, mid, top], [t * 0.62, t * 0.62, t * 0.4], parent, M[ms], seg=4, smooth=False)
    if claw:
        cones(f'{rn}_{pre}pie{s}', [(tuple(top + Vector((0, 0, 0.02))), tuple(foot + Vector((s * 0.05, 0, -0.035))), t * 0.42)],
              parent, M['metal'], seg=4)
    else:
        box(f'{rn}_{pre}pie{s}', (0.17, 0.2, 0.07), (foot.x + s * 0.02, foot.y, foot.z), parent, M[mf], bev=0.02)
    if neon:
        off = Vector((0, -t * 0.62 - 0.004, 0))
        bars(f'{rn}_{pre}neon_pata{s}', [(knee + off + (mid - knee) * 0.3, mid + off), (mid + off, top + off + Vector((0, 0, 0.04)))],
             0.028, parent, M['neon'], depth=0.02)


def blade_leg(rn, s, k, parent, M, hip, knee, foot, mu='c1', mp='c1', mk='dark', tip='metal', t=0.09, neon=True):
    """Pata de araña en cuchilla: <raiz>_pata{s}{k}_muslo / _rodilla / _pierna (las piezas extra también acaban en _pierna)."""
    p = f'{rn}_pata{s}{k}'
    hip, knee, foot = Vector(hip), Vector(knee), Vector(foot)
    bars(p + '_muslo', [(hip, knee)], t, parent, M[mu], depth=t * 1.2)
    sphere(p + '_rodilla', t * 0.66, tuple(knee), parent, M[mk], seg=10, rings=5)
    mid = knee.lerp(foot, 0.42) + Vector((s * 0.07, 0, 0))
    low = knee.lerp(foot, 0.8) + Vector((s * 0.02, 0, 0))
    tube(p + '_pierna', [knee, mid, low], [t * 0.62, t * 0.66, t * 0.42], parent, M[mp], seg=4, smooth=False)
    cones(f'{rn}_g_pata{s}{k}_pierna', [(tuple(low), tuple(foot), t * 0.42)], parent, M[tip], seg=4)
    if neon:
        off = Vector((0, -t * 0.62 - 0.004, 0))
        bars(f'{rn}_n_pata{s}{k}_pierna', [(knee + off + (mid - knee) * 0.35, mid + off), (mid + off, low + off)],
             0.026, parent, M['neon'], depth=0.02)


def legs4(rn, r, M, z=-0.02, kz=0.14, fx=0.56, **kw):
    """Cuatro patas de araña (dos por lado, filas k = 0 delante y 1 detrás en Y)."""
    for s in (-1, 1):
        for yy, k in legs6(2):
            blade_leg(rn, s, k, r, M, (s * 0.2, yy, z), (s * 0.4, yy * 1.3, kz), (s * fx, yy * 1.6, -0.47), **kw)


# ================================================================ CUBO
def cube_shell(rn, r, M, body='c1', s=0.86, bev=0.06, t=0.05, plates=True):
    box(rn + '_cuerpo', (s, s, s), (0, 0, 0), r, M[body], bev=bev)
    box_edges(rn + '_aristas', (s, s, s), (0, 0, 0), t, r, M['neon'])
    if plates:
        for axis, sign in [(0, 1), (0, -1), (1, 1), (2, 1), (2, -1)]:
            size = [0.6, 0.6, 0.6]; size[axis] = 0.04
            loc = [0, 0, 0]; loc[axis] = sign * (s / 2 + 0.008)
            box(f'{rn}_placa{axis}{sign}', size, loc, r, M[body], bev=0.014)
    return -s / 2


def build_cube(M, x):
    """Clásico: el emblema del juego. Visor oscuro con una doble flecha de neón (">>", el dash) que mira
    hacia delante, una línea de pulso debajo y muescas en las esquinas de la placa."""
    r = root('cubo', x)
    y = cube_shell('cubo', r, M)
    box('cubo_frente', (0.68, 0.04, 0.68), (0, y - 0.012, 0), r, M['c1'], bev=0.016)
    y -= 0.03
    # visor: rombo achatado oscuro
    fpoly('cubo_visor', [(-0.3, 0.0), (-0.2, 0.2), (0.24, 0.2), (0.32, 0.0), (0.24, -0.2), (-0.2, -0.2)], y, 0.03, r, M['dark'], bev=0.01)
    # doble flecha
    def chevron(cx, w=0.17, h=0.28, t=0.075):
        return [(cx - w / 2, h / 2), (cx - w / 2 + t, h / 2), (cx + w / 2, 0.0), (cx - w / 2 + t, -h / 2), (cx - w / 2, -h / 2), (cx + w / 2 - t, 0.0)]
    for i, cx in enumerate((-0.06, 0.12)):
        fpoly(f'cubo_flecha{i}', chevron(cx), y - 0.02, 0.03, r, M['neon'])
    # línea de pulso bajo el visor
    fpoly('cubo_pulso', [(-0.24, -0.27), (-0.08, -0.27), (-0.03, -0.235), (0.02, -0.29), (0.06, -0.27), (0.24, -0.27), (0.24, -0.25), (0.07, -0.25),
                         (0.02, -0.265), (-0.03, -0.21), (-0.09, -0.25), (-0.24, -0.25)], y, 0.025, r, M['neon'])
    # muescas en las esquinas
    for sx in (-1, 1):
        for sz in (-1, 1):
            fbox(f'cubo_muesca{sx}{sz}', 0.07, 0.07, sx * 0.27, sz * 0.27, y, 0.02, r, M['dark'], rot=math.radians(45))
    return r


def build_cube2(M, x):
    """Demonio: cuerpo oscuro, placa roja con ojos furiosos y dientes en zigzag, cuernos y remaches."""
    r = root('cubo_2', x)
    y = cube_shell('cubo_2', r, M, body='dark', bev=0.05, plates=False)
    box('cubo_2_frente', (0.7, 0.04, 0.7), (0, y - 0.012, 0), r, M['c1'], bev=0.018)
    y -= 0.03
    L = [(-0.3, 0.21), (-0.05, 0.05), (-0.3, 0.0)]
    poly_eye('cubo_2_ojo-1', L, y, r, M, k=0.55)
    poly_eye('cubo_2_ojo1', mirror_x(L), y, r, M, k=0.55)
    fbox('cubo_2_boca', 0.6, 0.22, 0, -0.18, y, 0.03, r, M['dark'])
    zz = [(-0.26 + i * 0.087, -0.11 if i % 2 == 0 else -0.25) for i in range(7)]
    line('cubo_2_dientes', zz, y - 0.02, 0.035, r, M['neon'], closed=False, depth=0.025)
    for s in (-1, 1):
        spike(f'cubo_2_cuerno{s}', (s * 0.24, -0.08, 0.4), (s * 0.36, -0.08, 0.66), 0.075, r, M)
        for i, (yy, zz_) in enumerate([(-0.3, 0.3), (-0.3, -0.3), (0.3, 0.3), (0.3, -0.3)]):
            spike(f'cubo_2_remache{s}{i}', (s * 0.42, yy, zz_), (s * 0.5, yy, zz_), 0.045, r, M, seg=4)
    return r


def build_cube3(M, x):
    """Tecno: blindado blanco, triángulos de neón en las esquinas, remaches de metal, ojos cian."""
    r = root('cubo_3', x)
    y = cube_shell('cubo_3', r, M, bev=0.08, t=0.04)
    box('cubo_3_frente', (0.66, 0.04, 0.66), (0, y - 0.012, 0), r, M['c1'], bev=0.016)
    y2 = y - 0.03
    for i, (sx, sz) in enumerate([(-1, 1), (1, 1), (-1, -1), (1, -1)]):
        tri = [(sx * 0.42, sz * 0.42), (sx * 0.24, sz * 0.42), (sx * 0.42, sz * 0.24)]
        fpoly(f'cubo_3_esquina{i}', tri, y - 0.005, 0.03, r, M['neon'])
        for ax in (0, 2):
            p = [sx * 0.3, 0, sz * 0.3]; q = list(p)
            p[ax] = (sx if ax == 0 else sz) * 0.43; q[ax] = (sx if ax == 0 else sz) * 0.5
            p[1] = q[1] = -0.3
            spike(f'cubo_3_remache{i}{ax}', tuple(p), tuple(q), 0.045, r, M, seg=4)
    for s in (-1, 1):
        eye(f'cubo_3_ojo{s}', s * 0.14, 0.08, 0.11, 0.1, y2, r, M, sock=0.07)
    fbox('cubo_3_boca', 0.34, 0.07, 0, -0.14, y2, 0.03, r, M['dark'], bev=0.01)
    return r


def build_cube4(M, x):
    """Sonrisa: morado, ojos inclinados y gran sonrisa de neón, rombos en los lados."""
    r = root('cubo_4', x)
    y = cube_shell('cubo_4', r, M, bev=0.07)
    box('cubo_4_frente', (0.68, 0.04, 0.68), (0, y - 0.012, 0), r, M['c1'], bev=0.016)
    y -= 0.03
    L = [(-0.31, 0.22), (-0.06, 0.1), (-0.06, 0.02), (-0.3, 0.12)]
    poly_eye('cubo_4_ojo-1', L, y, r, M, k=0.6)
    poly_eye('cubo_4_ojo1', mirror_x(L), y, r, M, k=0.6)
    n = 10
    grin = [(-0.32, -0.02), (0.32, -0.02)] + [(0.3 * math.cos(math.pi * i / n), -0.04 - 0.24 * math.sin(math.pi * i / n)) for i in range(1, n)]
    fpoly('cubo_4_boca', shrink(grin, 1.18), y, 0.03, r, M['dark'])
    fpoly('cubo_4_sonrisa', grin, y - 0.02, 0.025, r, M['neon'])
    bars('cubo_4_dientes', [((-0.27, y - 0.05, -0.1), (0.27, y - 0.05, -0.1))] +
         [((dx, y - 0.05, -0.04), (dx, y - 0.05, -0.16)) for dx in (-0.12, 0.0, 0.12)], 0.025, r, M['dark'])
    dia = [(0, 0.12), (0.07, 0), (0, -0.12), (-0.07, 0)]
    for s in (-1, 1):
        o = fpoly(f'cubo_4_rombo{s}', dia, 0, 0.03, r, M['neon'])
        o.rotation_euler = (0, 0, -s * math.pi / 2); o.location = (s * 0.455, 0, 0)
    o = fpoly('cubo_4_rombo_arriba', dia, 0, 0.03, r, M['neon'])
    o.rotation_euler = (math.pi / 2, 0, math.pi / 2); o.location = (0, 0, 0.455)
    return r


def build_cube5(M, x):
    """Pinchos: cuerpo negro con aristas verdes, ojos furiosos de neón y pinchos de metal."""
    r = root('cubo_5', x)
    y = cube_shell('cubo_5', r, M, body='dark', bev=0.05)
    box('cubo_5_frente', (0.66, 0.04, 0.66), (0, y - 0.012, 0), r, M['dark'], bev=0.016)
    line('cubo_5_marco', [(-0.3, 0.3), (0.3, 0.3), (0.3, -0.3), (-0.3, -0.3)], y - 0.03, 0.025, r, M['neon'], depth=0.02)
    y -= 0.03
    L = [(-0.24, 0.17), (-0.05, 0.07), (-0.07, 0.0), (-0.24, 0.06)]
    poly_eye('cubo_5_ojo-1', L, y, r, M, sock=False)
    poly_eye('cubo_5_ojo1', mirror_x(L), y, r, M, sock=False)
    fbox('cubo_5_boca', 0.34, 0.08, 0, -0.14, y, 0.03, r, M['neon'])
    fbox('cubo_5_boca_raja', 0.24, 0.025, 0, -0.14, y - 0.03, 0.02, r, M['dark'])
    for i, (sx, sz) in enumerate([(-1, 1), (1, 1)]):
        spike(f'cubo_5_pincho{i}', (sx * 0.36, 0, 0.36), (sx * 0.56, 0, 0.6), 0.09, r, M)
    for i, (sx, sz) in enumerate([(-1, 0.18), (-1, -0.22), (1, 0.18), (1, -0.22)]):
        spike(f'cubo_5_lateral{i}', (sx * 0.42, -0.1, sz), (sx * 0.62, -0.1, sz), 0.07, r, M)
    return r


# ================================================================ NAVE
def engine(rn, r, M, x=-0.5, z=0.0, rad=0.12):
    cylinder(rn + '_tobera', rad, 0.12, (x, 0, z), r, M['dark'], axis='X', r2=rad * 1.2, seg=20)
    cylinder(rn + '_fuego', rad * 0.85, 0.03, (x - 0.065, 0, z), r, M['engine'], axis='X', seg=20)


def build_ship(M, x):
    """Clásico: flecha amarilla con morro, ventana cuadrada y aletas, todo perfilado de neón."""
    r = root('nave', x)
    th = 0.36; y = -th / 2
    body = [(0.22, 0.17), (-0.36, 0.2), (-0.48, 0.1), (-0.48, -0.1), (-0.36, -0.18), (0.22, -0.15)]
    nose = [(0.22, 0.17), (0.6, 0.0), (0.22, -0.15)]
    slab('nave_casco', body, th, 'XZ', r, M['c1'], bev=0.04)
    slab('nave_morro', nose, th * 0.72, 'XZ', r, M['c1'], bev=0.03)
    fin_t = [(-0.1, 0.18), (-0.34, 0.36), (-0.46, 0.36), (-0.42, 0.18)]
    fin_b = [(-0.14, -0.16), (-0.36, -0.32), (-0.46, -0.32), (-0.42, -0.16)]
    slab('nave_aleta', fin_t, 0.12, 'XZ', r, M['c1'], bev=0.02)
    slab('nave_aleta_baja', fin_b, 0.12, 'XZ', r, M['c1'], bev=0.02)
    segs = poly_segs(body, y - 0.012) + poly_segs(nose, -th * 0.36 - 0.012, closed=False)
    segs += poly_segs(fin_t[:3], -0.07, closed=False)[0:2] + poly_segs(fin_b[:3], -0.07, closed=False)[0:2]
    bars('nave_neon', segs, 0.04, r, M['neon'], depth=0.03)
    eye('nave_ventana', -0.14, 0.06, 0.14, 0.11, y - 0.02, r, M, sock=0.07)
    wing = [(0.1, 0.0), (-0.28, 0.17), (-0.4, 0.17), (-0.34, 0.0)]
    for s in (-1, 1):
        o = slab(f'nave_ala{s}', [(a, s * b) for a, b in wing], 0.05, 'XY', r, M['c1'], bev=0.015, offset=-0.09)
        o.location = (0, s * th / 2, 0)
    bars('nave_ala_neon', [((0.1, -th / 2 - 0.01, -0.06), (-0.28, -th / 2 - 0.17, -0.06)),
                           ((-0.28, -th / 2 - 0.17, -0.06), (-0.4, -th / 2 - 0.17, -0.06))], 0.035, r, M['neon'])
    engine('nave', r, M, x=-0.52, z=0.0)
    return r


def build_ship2(M, x):
    """Demonio: flecha oscura con galones rojos, morro con perfil de neón y pinchos."""
    r = root('nave_2', x)
    th = 0.32; y = -th / 2
    body = [(0.3, 0.12), (-0.3, 0.18), (-0.5, 0.09), (-0.42, 0.0), (-0.5, -0.09), (-0.3, -0.16), (0.3, -0.1)]
    nose = [(0.3, 0.12), (0.64, 0.0), (0.3, -0.1)]
    slab('nave_2_casco', body, th, 'XZ', r, M['dark'], bev=0.03)
    slab('nave_2_morro', nose, th * 0.7, 'XZ', r, M['dark'], bev=0.025)
    segs = poly_segs(body, y - 0.012) + poly_segs(nose, -th * 0.35 - 0.012, closed=False)
    for i, cx in enumerate((-0.3, -0.1, 0.1)):
        ch = [(cx + 0.14, 0.0), (cx, 0.15), (cx - 0.08, 0.15), (cx + 0.06, 0.0), (cx - 0.08, -0.14), (cx, -0.14)]
        fpoly(f'nave_2_galon{i}', ch, y, 0.035, r, M['c1'])
        segs += poly_segs([(cx, 0.15), (cx + 0.14, 0.0), (cx, -0.14)], y - 0.04, closed=False)
    bars('nave_2_neon', segs, 0.03, r, M['neon'], depth=0.025)
    fins = [[(0.0, 0.15), (-0.36, 0.38), (-0.28, 0.17)], [(0.0, -0.13), (-0.36, -0.34), (-0.28, -0.15)]]
    for i, f in enumerate(fins):
        slab(f'nave_2_aleta{i}', f, 0.1, 'XZ', r, M['dark'], bev=0.015)
        bars(f'nave_2_aleta_neon{i}', poly_segs(f[:2], -0.06, closed=False), 0.03, r, M['neon'])
    for i, px in enumerate((0.15, -0.05)):
        spike(f'nave_2_pincho{i}', (px, 0, 0.1), (px - 0.06, 0, 0.27), 0.05, r, M)
    spike('nave_2_punta', (0.58, 0, 0), (0.74, 0, 0), 0.05, r, M)
    engine('nave_2', r, M, x=-0.52, z=0.0, rad=0.1)
    return r


def build_ship3(M, x):
    """Tecno: caza blanco estilizado, alas en flecha con bordes de neón y cabina redonda cian."""
    r = root('nave_3', x)
    body = sphere('nave_3_fuselaje', 1.0, (0, 0, 0), r, M['c1'], scale=(0.48, 0.19, 0.15), seg=20, rings=10)
    for v in body.data.vertices:
        if v.co.x > 0:
            v.co.x *= 1.0 + 0.45 * (v.co.x / 0.48)
    wing = [(0.12, 0.0), (-0.3, 0.5), (-0.42, 0.5), (-0.34, 0.0)]
    for s in (-1, 1):
        slab(f'nave_3_ala{s}', [(a, s * b) for a, b in wing], 0.04, 'XY', r, M['c1'], bev=0.014, offset=-0.03)
    fin = [(-0.18, 0.08), (-0.42, 0.34), (-0.52, 0.34), (-0.48, 0.06)]
    slab('nave_3_deriva', fin, 0.04, 'XZ', r, M['c1'], bev=0.012)
    can = [(0.38, 0.0), (0.22, 0.2), (0.17, 0.2), (0.2, 0.0)]
    for s in (-1, 1):
        slab(f'nave_3_canard{s}', [(a, s * b) for a, b in can], 0.025, 'XY', r, M['c1'], bev=0.008, offset=-0.02)
    segs = [((0.12, -0.0, -0.005), (-0.3, -0.5, -0.005)), ((-0.3, -0.5, -0.005), (-0.42, -0.5, -0.005)),
            ((0.12, 0.0, -0.005), (-0.3, 0.5, -0.005)),
            ((-0.18, -0.03, 0.08), (-0.42, -0.03, 0.34)), ((-0.42, -0.03, 0.34), (-0.52, -0.03, 0.34)),
            ((0.38, -0.01, 0.0), (0.22, -0.2, 0.0))]
    bars('nave_3_neon', segs, 0.03, r, M['neon'], depth=0.04)
    core('nave_3_cabina', r, M, -0.17, 0.085, ring='metal', x=0.14, z=0.02)
    cylinder('nave_3_toma', 0.1, 0.1, (-0.47, 0, 0), r, M['metal'], axis='X', r2=0.12, seg=20)
    cylinder('nave_3_fuego', 0.08, 0.03, (-0.53, 0, 0), r, M['engine'], axis='X', seg=20)
    return r


def build_ship4(M, x):
    """Sonrisa: flecha morada redondeada con aletas en flecha y ventana triangular de neón."""
    r = root('nave_4', x)
    th = 0.34; y = -th / 2
    body = [(0.15, 0.14), (-0.3, 0.19), (-0.46, 0.1), (-0.38, 0.0), (-0.46, -0.1), (-0.3, -0.17), (0.15, -0.12)]
    nose = [(0.15, 0.14), (0.6, 0.0), (0.15, -0.12)]
    slab('nave_4_casco', body, th, 'XZ', r, M['c1'], bev=0.06)
    slab('nave_4_morro', nose, th * 0.76, 'XZ', r, M['c1'], bev=0.04)
    fpoly('nave_4_ventana', [(0.21, 0.07), (0.45, 0.0), (0.21, -0.05)], -th * 0.38 - 0.01, 0.03, r, M['neon'])
    fins = [[(0.06, 0.16), (-0.42, 0.42), (-0.3, 0.17)], [(0.04, -0.14), (-0.42, -0.38), (-0.3, -0.15)]]
    segs = poly_segs(body, y - 0.012)
    for i, f in enumerate(fins):
        slab(f'nave_4_aleta{i}', f, 0.12, 'XZ', r, M['c1'], bev=0.03)
        segs += poly_segs(f[:2], -0.07, closed=False)
    segs += [((-0.24, y - 0.04, 0.0), (0.06, y - 0.04, 0.0))]
    bars('nave_4_neon', segs, 0.035, r, M['neon'], depth=0.03)
    engine('nave_4', r, M, x=-0.47, z=0.0, rad=0.1)
    return r


def build_ship5(M, x):
    """Pinchos: casco negro de cuchillas superpuestas, rombos verdes y pinchos arriba y abajo."""
    r = root('nave_5', x)
    th = 0.32; y = -th / 2
    body = [(0.25, 0.12), (-0.32, 0.16), (-0.48, 0.06), (-0.48, -0.06), (-0.32, -0.15), (0.25, -0.11)]
    nose = [(0.25, 0.12), (0.62, 0.0), (0.25, -0.11)]
    slab('nave_5_casco', body, th, 'XZ', r, M['dark'], bev=0.03)
    slab('nave_5_morro', nose, th * 0.7, 'XZ', r, M['dark'], bev=0.02)
    segs = poly_segs(nose, -th * 0.35 - 0.012, closed=False) + poly_segs(body[:3], y - 0.012, closed=False) + poly_segs(body[3:], y - 0.012, closed=False)
    segs += poly_segs([(0.32, 0.06), (0.5, 0.0), (0.32, -0.05)], -th * 0.35 - 0.03, closed=False)
    for i, cx in enumerate((-0.38, -0.14)):
        bl = [(cx + 0.3, 0.03), (cx, 0.26), (cx + 0.08, 0.04), (cx, -0.24), (cx + 0.3, -0.02)]
        fpoly(f'nave_5_cuchilla{i}', bl, y - 0.01 * i, 0.06, r, M['dark'], bev=0.01)
        segs += poly_segs(bl[:2], y - 0.07 - 0.01 * i, closed=False) + poly_segs(bl[3:], y - 0.07 - 0.01 * i, closed=False)
    bars('nave_5_neon', segs, 0.03, r, M['neon'], depth=0.025)
    dia = [(0, 0.06), (0.06, 0), (0, -0.06), (-0.06, 0)]
    for i, cx in enumerate((0.12, -0.02)):
        fpoly(f'nave_5_rombo{i}', [(a + cx, b) for a, b in dia], y - 0.01, 0.03, r, M['neon'])
    for i, (px, sz) in enumerate([(0.05, 1), (-0.22, 1), (0.05, -1), (-0.22, -1)]):
        spike(f'nave_5_pincho{i}', (px, 0, sz * 0.11), (px - 0.07, 0, sz * 0.3), 0.055, r, M)
    engine('nave_5', r, M, x=-0.52, z=0.0, rad=0.09)
    return r


# ================================================================ BOLA
R_BALL = 0.43


def build_ball(M, x):
    """Clásico: esfera amarilla con un gran ojo-núcleo y juntas de neón que dejan ver el giro."""
    r = root('bola', x)
    R = R_BALL
    sphere('bola_cuerpo', R, (0, 0, 0), r, M['c1'], seg=24, rings=12)
    core('bola', r, M, -R + 0.03, 0.2)
    ph0 = math.asin(0.21 / R)
    segs = meridians(R + 0.008, [math.radians(a) for a in (90, 210, 330)], ph0, math.radians(125))
    segs += parallel(R + 0.008, math.radians(125), math.radians(90), math.radians(210))
    bars('bola_juntas', segs, 0.035, r, M['neon'])
    return r


def build_ball2(M, x):
    """Demonio: esfera negra con pinchos de metal, núcleo rojo y grietas de neón."""
    r = root('bola_2', x)
    R = R_BALL - 0.03
    sphere('bola_2_cuerpo', R, (0, 0, 0), r, M['dark'], seg=24, rings=12)
    core('bola_2', r, M, -R + 0.03, 0.18, ring='c1')
    dirs = [Vector((math.cos(a), 0.3, math.sin(a))).normalized() for a in [i / 7 * 2 * math.pi + 0.3 for i in range(7)]]
    dirs += [Vector((math.cos(a), 0.9, math.sin(a))).normalized() for a in (0.0, 2.1, 4.2)]
    for i, d in enumerate(dirs):
        spike(f'bola_2_pincho{i}', tuple(d * (R - 0.03)), tuple(d * (R + 0.17)), 0.065, r, M)
    ph0 = math.asin(0.19 / R)
    segs = []
    for th in (math.radians(55), math.radians(180), math.radians(290)):
        pts = [sph(R + 0.006, th + (0.12 if i % 2 else -0.12) * (i > 0), ph0 + (math.radians(100) - ph0) * i / 4) for i in range(5)]
        segs += list(zip(pts, pts[1:]))
    bars('bola_2_grietas', segs, 0.03, r, M['neon'])
    return r


def build_ball3(M, x):
    """Tecno: esfera blanca de paneles con juntas oscuras, aro de metal y núcleo cian."""
    r = root('bola_3', x)
    R = R_BALL
    sphere('bola_3_cuerpo', R, (0, 0, 0), r, M['c1'], seg=24, rings=12)
    core('bola_3', r, M, -R + 0.03, 0.2, ring='metal')
    ph0 = math.asin(0.21 / R)
    segs = meridians(R + 0.004, [math.radians(a) for a in (30, 150, 270)], ph0, math.radians(170))
    segs += parallel(R + 0.004, math.radians(95), math.radians(30), math.radians(150))
    segs += parallel(R + 0.004, math.radians(95), math.radians(270), math.radians(390))
    bars('bola_3_juntas', segs, 0.03, r, M['dark'])
    segs = parallel(R + 0.01, math.radians(60), math.radians(160), math.radians(260), n=6)
    bars('bola_3_neon', segs, 0.028, r, M['neon'])
    return r


def build_ball4(M, x):
    """Sonrisa: esfera morada con núcleo de neón, juntas oscuras curvas y una media luna brillante."""
    r = root('bola_4', x)
    R = R_BALL
    sphere('bola_4_cuerpo', R, (0, 0, 0), r, M['c1'], seg=24, rings=12)
    core('bola_4', r, M, -R + 0.03, 0.18)
    ph0 = math.asin(0.19 / R)
    segs = []
    for th in (60, 190, 310):
        pts = [sph(R + 0.004, math.radians(th + 25 * i / 6), ph0 + (math.radians(150) - ph0) * i / 6) for i in range(7)]
        segs += list(zip(pts, pts[1:]))
    bars('bola_4_juntas', segs, 0.035, r, M['dark'])
    bars('bola_4_luna', parallel(R + 0.01, math.radians(62), math.radians(100), math.radians(175), n=7), 0.04, r, M['neon'])
    return r


def build_ball5(M, x):
    """Pinchos: esfera facetada negra con esquirlas de neón, núcleo verde y pinchos cortos."""
    r = root('bola_5', x)
    R = R_BALL - 0.02
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=R)
    shards = []
    for f in bm.faces:
        c = f.calc_center_median()
        if c.y < -0.3 and abs(c.x) < 0.1 and abs(c.z) < 0.1:
            continue
        shards.append([v.co.copy() for v in f.verts])
    from_bm('bola_5_cuerpo', bm, r, M['dark'])
    core('bola_5', r, M, -R + 0.02, 0.17, ring='dark')
    bm = bmesh.new()
    for i, tri in enumerate(shards):
        if i % 3:
            continue
        c = sum(tri, Vector()) / 3
        n = c.normalized()
        vs = [bm.verts.new(c + (v - c) * 0.55 + n * 0.012) for v in tri]
        vb = [bm.verts.new(c + (v - c) * 0.55 - n * 0.01) for v in tri]
        bm.faces.new(vs); bm.faces.new(vb[::-1])
        for j in range(3):
            k = (j + 1) % 3
            bm.faces.new((vs[j], vb[j], vb[k], vs[k]))
    from_bm('bola_5_esquirlas', bm, r, M['neon'])
    for i, a in enumerate((0.8, 2.4, 4.0, 5.6)):
        d = Vector((math.cos(a), 0.45, math.sin(a))).normalized()
        spike(f'bola_5_pincho{i}', tuple(d * (R - 0.02)), tuple(d * (R + 0.12)), 0.06, r, M, seg=6)
    return r


# ================================================================ OVNI
def saucer(rn, r, M, body='c1', rad=0.56, h=0.14, z=-0.06, lights=8, lr=0.4, dome=0.26, dk=0.9):
    sphere(rn + '_plato', 1.0, (0, 0, z), r, M[body], scale=(rad, rad, h), seg=28, rings=10)
    torus(rn + '_borde', rad - 0.005, 0.028, (0, 0, z), r, M['neon'], axis='Z', seg=32, rseg=5)
    top = z + h * math.sqrt(max(0.0, 1 - (lr / rad) ** 2))
    cylinder(rn + '_fondo', 0.3, 0.06, (0, 0, z - h + 0.02), r, M['dark'], r2=0.24, seg=24)
    for i in range(lights):
        a = (i + 0.5) / lights * 2 * math.pi
        sphere(f'{rn}_luz{i}', 0.06, (math.cos(a) * 0.43, math.sin(a) * 0.43, z - h * 0.55), r, M['neon'],
               scale=(1.5, 1.5, 0.7), seg=8, rings=4)
    if dome:
        sphere(rn + '_cupula', dome, (0, 0, top - 0.03), r, M['glass'], scale=(1, 1, dk), half=True, seg=20, rings=10)
        torus(rn + '_aro', dome, 0.025, (0, 0, top - 0.025), r, M[body], axis='Z', seg=24, rseg=4)
    return top


def build_ufo(M, x):
    """Clásico: platillo amarillo con borde de neón, cúpula de cristal y luces abajo."""
    r = root('ovni', x)
    top = saucer('ovni', r, M)
    torus('ovni_franja', 0.43, 0.014, (0, 0, -0.06 + 0.14 * math.sqrt(1 - (0.43 / 0.56) ** 2)), r, M['neon'], axis='Z', seg=36, rseg=4)
    return r


def build_ufo2(M, x):
    """Demonio: platillo negro con aro rojo, pinchos de metal alrededor y luces rojas."""
    r = root('ovni_2', x)
    top = saucer('ovni_2', r, M, body='dark')
    torus('ovni_2_banda', 0.4, 0.03, (0, 0, -0.06 + 0.14 * math.sqrt(1 - (0.4 / 0.56) ** 2) - 0.005), r, M['c1'], axis='Z', seg=32, rseg=6)
    for i in range(6):
        a = (i + 0.25) / 6 * 2 * math.pi
        c, s = math.cos(a), math.sin(a)
        spike(f'ovni_2_pincho{i}', (c * 0.42, s * 0.42, 0.0), (c * 0.6, s * 0.6, 0.1), 0.05, r, M)
    return r


def build_ufo3(M, x):
    """Tecno: platillo blanco ancho con paneles oscuros, luces cian rectangulares y base de metal."""
    r = root('ovni_3', x)
    sphere('ovni_3_plato', 1.0, (0, 0, -0.06), r, M['c1'], scale=(0.58, 0.58, 0.12), seg=32, rings=12)
    torus('ovni_3_borde', 0.575, 0.025, (0, 0, -0.06), r, M['neon'], axis='Z', seg=40, rseg=6)
    torus('ovni_3_junta', 0.46, 0.022, (0, 0, -0.06 + 0.12 * math.sqrt(1 - (0.46 / 0.58) ** 2)), r, M['dark'], axis='Z', seg=36, rseg=4)
    for i in range(10):
        a = (i + 0.5) / 10 * 2 * math.pi
        box(f'ovni_3_luz{i}', (0.05, 0.11, 0.03), (math.cos(a) * 0.5, math.sin(a) * 0.5, -0.08), r, M['neon'], rot=(0, 0, a))
    for i in range(8):
        a = i / 8 * 2 * math.pi
        box(f'ovni_3_panel{i}', (0.13, 0.025, 0.03), (math.cos(a) * 0.36, math.sin(a) * 0.36, 0.035), r, M['dark'], rot=(0, 0, a))
    cylinder('ovni_3_fondo', 0.26, 0.07, (0, 0, -0.17), r, M['metal'], r2=0.18, seg=24)
    cylinder('ovni_3_brillo', 0.15, 0.02, (0, 0, -0.21), r, M['neon'], seg=20)
    sphere('ovni_3_cupula', 0.25, (0, 0, 0.03), r, M['glass'], scale=(1, 1, 0.85), half=True, seg=24, rings=12)
    torus('ovni_3_aro', 0.25, 0.025, (0, 0, 0.035), r, M['metal'], axis='Z', seg=28, rseg=6)
    return r


def build_ufo4(M, x):
    """Sonrisa: platillo morado de dos pisos con luces ovaladas de neón en el borde."""
    r = root('ovni_4', x)
    sphere('ovni_4_plato', 1.0, (0, 0, -0.08), r, M['c1'], scale=(0.57, 0.57, 0.11), seg=32, rings=12)
    sphere('ovni_4_piso', 1.0, (0, 0, -0.02), r, M['c1'], scale=(0.4, 0.4, 0.1), seg=28, rings=10)
    torus('ovni_4_borde', 0.4, 0.022, (0, 0, -0.02), r, M['neon'], axis='Z', seg=32, rseg=6)
    for i in range(12):
        a = (i + 0.5) / 12 * 2 * math.pi
        o = sphere(f'ovni_4_luz{i}', 0.05, (math.cos(a) * 0.54, math.sin(a) * 0.54, -0.085), r, M['neon'],
                   scale=(0.6, 1.5, 0.7), seg=10, rings=6)
        o.rotation_euler = (0, 0, a)
    cylinder('ovni_4_fondo', 0.24, 0.05, (0, 0, -0.18), r, M['dark'], r2=0.18, seg=24)
    sphere('ovni_4_cupula', 0.24, (0, 0, 0.05), r, M['glass'], scale=(1, 1, 0.95), half=True, seg=24, rings=12)
    torus('ovni_4_aro', 0.24, 0.025, (0, 0, 0.055), r, M['c1'], axis='Z', seg=28, rseg=6)
    return r


def build_ufo5(M, x):
    """Pinchos: platillo negro con borde verde, ventanas de neón y pinchos hacia arriba."""
    r = root('ovni_5', x)
    top = saucer('ovni_5', r, M, body='dark', lights=6)
    for i in range(8):
        a = i / 8 * 2 * math.pi
        box(f'ovni_5_ventana{i}', (0.09, 0.03, 0.03), (math.cos(a) * 0.42, math.sin(a) * 0.42, 0.015), r, M['neon'], rot=(0, 0, a + math.pi / 2))
    for i in range(5):
        a = (i + 0.5) / 5 * 2 * math.pi
        c, s = math.cos(a), math.sin(a)
        spike(f'ovni_5_pincho{i}', (c * 0.47, s * 0.47, -0.04), (c * 0.62, s * 0.62, 0.12), 0.05, r, M)
    return r


# ================================================================ ONDA
DART = [(0.44, 0.0), (-0.3, 0.3), (-0.16, 0.0), (-0.3, -0.3)]


def build_wave(M, x):
    """Clásico: punta de flecha amarilla con perfil de neón."""
    r = root('onda', x)
    slab('onda_cuerpo', DART, 0.2, 'XZ', r, M['c1'], bev=0.03)
    line('onda_neon', DART, -0.1, 0.045, r, M['neon'], depth=0.03)
    fpoly('onda_nucleo', [(0.2, 0.0), (-0.08, 0.1), (-0.03, 0.0), (-0.08, -0.1)], -0.1, 0.03, r, M['c1'])
    return r


def build_wave2(M, x):
    """Demonio: flecha negra con perfil rojo, triángulo interior y punta de metal."""
    r = root('onda_2', x)
    slab('onda_2_cuerpo', DART, 0.2, 'XZ', r, M['dark'], bev=0.025)
    line('onda_2_neon', DART, -0.1, 0.04, r, M['neon'], depth=0.03)
    fpoly('onda_2_interior', [(0.24, 0.0), (-0.12, 0.15), (-0.04, 0.0), (-0.12, -0.15)], -0.1, 0.03, r, M['c1'])
    spike('onda_2_punta', (0.4, 0, 0), (0.58, 0, 0), 0.05, r, M)
    for s in (-1, 1):
        spike(f'onda_2_pua{s}', (-0.26, 0, s * 0.26), (-0.4, 0, s * 0.36), 0.04, r, M, seg=6)
    return r


def build_wave3(M, x):
    """Tecno: flecha blanca con un triángulo de neón dentro."""
    r = root('onda_3', x)
    slab('onda_3_cuerpo', DART, 0.2, 'XZ', r, M['c1'], bev=0.03)
    tri = [(0.22, 0.0), (-0.1, 0.15), (-0.1, -0.15)]
    fpoly('onda_3_hueco', shrink(tri, 1.25), -0.1, 0.02, r, M['dark'])
    line('onda_3_neon', tri, -0.12, 0.035, r, M['neon'], depth=0.025)
    line('onda_3_borde', DART, -0.1, 0.025, r, M['metal'], depth=0.02)
    return r


def build_wave4(M, x):
    """Sonrisa: triángulo morado macizo con perfil y centro de neón."""
    r = root('onda_4', x)
    tri = [(0.46, 0.0), (-0.3, 0.29), (-0.24, 0.0), (-0.3, -0.29)]
    slab('onda_4_cuerpo', tri, 0.22, 'XZ', r, M['c1'], bev=0.05)
    line('onda_4_neon', tri, -0.11, 0.04, r, M['neon'], depth=0.03)
    fpoly('onda_4_nucleo', [(0.24, 0.0), (-0.1, 0.12), (-0.1, -0.12)], -0.11, 0.03, r, M['neon'])
    return r


def build_wave5(M, x):
    """Pinchos: flecha negra con perfil verde, triángulo de neón y pinchos en los bordes."""
    r = root('onda_5', x)
    slab('onda_5_cuerpo', DART, 0.2, 'XZ', r, M['dark'], bev=0.025)
    line('onda_5_neon', DART, -0.1, 0.035, r, M['neon'], depth=0.03)
    tri = [(0.22, 0.0), (-0.08, 0.14), (-0.08, -0.14)]
    line('onda_5_tri', tri, -0.12, 0.03, r, M['neon'], depth=0.025)
    for i, t in enumerate((0.3, 0.62)):
        for s in (-1, 1):
            p = Vector((0.44, 0, 0)).lerp(Vector((-0.3, 0, s * 0.3)), t)
            n = Vector((0.3, 0, 0.74 * s)).normalized()
            spike(f'onda_5_pincho{i}{s}', tuple(p - n * 0.02), tuple(p + n * 0.13), 0.04, r, M, seg=6)
    return r


# ================================================================ ROBOT
def build_robot(M, x):
    """Clásico: cuerpo cuadrado amarillo con pantalla de neón y dos patas dobladas. Pies en z = -0.47."""
    r = root('robot', x)
    size = (0.62, 0.52, 0.5)
    box('robot_cuerpo', size, (0, 0, 0.13), r, M['c1'], bev=0.06)
    box_edges('robot_aristas', size, (0, 0, 0.13), 0.045, r, M['neon'])
    eye('robot_pantalla', 0.05, 0.16, 0.24, 0.2, -0.27, r, M, sock=0.09)
    box('robot_cadera', (0.46, 0.36, 0.08), (0, 0, -0.14), r, M['dark'], bev=0.02)
    for s in (-1, 1):
        robot_leg('robot', s, r, M, (s * 0.16, 0, -0.15), (s * 0.36, 0, -0.21), (s * 0.38, 0, -0.43), t=0.13)
    return r


def build_robot2(M, x):
    """Demonio: caja negra con ojo rojo, cuernos de metal y cuatro patas de araña."""
    r = root('robot_2', x)
    size = (0.56, 0.48, 0.42)
    box('robot_2_cuerpo', size, (0, 0, 0.12), r, M['dark'], bev=0.05)
    box_edges('robot_2_aristas', size, (0, 0, 0.12), 0.04, r, M['neon'])
    fbox('robot_2_marco', 0.27, 0.25, 0.07, 0.14, -0.24, 0.03, r, M['c1'], bev=0.01)
    fbox('robot_2_ojo', 0.17, 0.15, 0.07, 0.14, -0.27, 0.03, r, M['neon'])
    for s in (-1, 1):
        spike(f'robot_2_cuerno{s}', (s * 0.18, -0.05, 0.31), (s * 0.3, -0.05, 0.52), 0.06, r, M)
        for pre, yy in (('', -0.12), ('b_', 0.12)):
            hip = Vector((s * 0.16, yy, -0.06)); knee = Vector((s * 0.36, yy * 1.3, 0.02)); foot = Vector((s * 0.46, yy * 1.5, -0.47))
            rod(f'robot_2_{pre}pata{s}', tuple(hip), tuple(knee), 0.04, r, M['dark'])
            sphere(f'robot_2_{pre}rodilla_pata{s}', 0.05, tuple(knee), r, M['neon'], seg=10, rings=6)
            rod(f'robot_2_{pre}canilla_pata{s}', tuple(knee), tuple(foot + Vector((0, 0, 0.06))), 0.035, r, M['c1'], r2=0.025)
            spike(f'robot_2_{pre}pie{s}', tuple(foot + Vector((0, 0, 0.07))), tuple(foot), 0.03, r, M, seg=6)
    return r


def build_robot3(M, x):
    """Tecno: mecha blanco redondeado, visor oscuro con ojo cian, franja de neón y brazos cortos."""
    r = root('robot_3', x)
    box('robot_3_cuerpo', (0.6, 0.5, 0.46), (0, 0, 0.14), r, M['c1'], bev=0.12)
    fbox('robot_3_visor', 0.44, 0.22, 0.04, 0.2, -0.25, 0.04, r, M['dark'], bev=0.03)
    core('robot_3_ojo', r, M, -0.285, 0.085, ring='metal', x=0.1, z=0.2)
    fbox('robot_3_franja', 0.36, 0.04, 0, -0.01, -0.25, 0.03, r, M['neon'])
    box('robot_3_cadera', (0.4, 0.34, 0.08), (0, 0, -0.12), r, M['dark'], bev=0.02)
    for s in (-1, 1):
        robot_leg('robot_3', s, r, M, (s * 0.16, 0, -0.14), (s * 0.24, 0, -0.29), (s * 0.27, 0, -0.43),
                  t=0.13, foot_size=(0.24, 0.3, 0.08), knee_m='metal')
        rod(f'robot_3_brazo{s}', (s * 0.3, 0, 0.06), (s * 0.4, 0, -0.06), 0.045, r, M['dark'])
        sphere(f'robot_3_mano{s}', 0.07, (s * 0.41, 0, -0.08), r, M['c1'], seg=12, rings=6)
    return r


def build_robot4(M, x):
    """Sonrisa: casco morado redondo con ojo de neón y sonrisa, patas gruesas."""
    r = root('robot_4', x)
    box('robot_4_cuerpo', (0.56, 0.5, 0.46), (0, 0, 0.13), r, M['c1'], bev=0.17)
    sphere('robot_4_cresta', 1.0, (0, 0, 0.33), r, M['c1'], scale=(0.18, 0.22, 0.1), seg=16, rings=8)
    core('robot_4_ojo', r, M, -0.245, 0.11, x=0.06, z=0.19)
    n = 6
    grin = [(0.06 + 0.13 * math.cos(math.pi * i / n), 0.0 - 0.06 * math.sin(math.pi * i / n)) for i in range(n + 1)]
    line('robot_4_boca', grin, -0.255, 0.03, r, M['neon'], closed=False, depth=0.025)
    bars('robot_4_trim', [((s * 0.27, -0.24, -0.02), (s * 0.27, -0.24, 0.26)) for s in (-1, 1)], 0.03, r, M['neon'])
    box('robot_4_cadera', (0.4, 0.34, 0.08), (0, 0, -0.12), r, M['dark'], bev=0.02)
    for s in (-1, 1):
        robot_leg('robot_4', s, r, M, (s * 0.16, 0, -0.14), (s * 0.27, 0, -0.27), (s * 0.29, 0, -0.43),
                  t=0.14, foot_size=(0.26, 0.3, 0.08))
    return r


def build_robot5(M, x):
    """Pinchos: caja negra con ojo cuadrado concéntrico verde, pinchos arriba y patas con garras."""
    r = root('robot_5', x)
    size = (0.56, 0.5, 0.46)
    box('robot_5_cuerpo', size, (0, 0, 0.13), r, M['dark'], bev=0.04)
    box_edges('robot_5_aristas', size, (0, 0, 0.13), 0.04, r, M['neon'])
    line('robot_5_ojo_marco', [(-0.08, 0.28), (0.2, 0.28), (0.2, 0.02), (-0.08, 0.02)], -0.25, 0.035, r, M['neon'], depth=0.025)
    fbox('robot_5_ojo', 0.1, 0.1, 0.06, 0.15, -0.25, 0.03, r, M['neon'])
    for i, px in enumerate((-0.18, 0.0, 0.18)):
        spike(f'robot_5_pincho{i}', (px, 0, 0.34), (px - 0.04, 0, 0.52), 0.06, r, M)
    box('robot_5_cadera', (0.4, 0.34, 0.08), (0, 0, -0.12), r, M['dark'], bev=0.02)
    for s in (-1, 1):
        robot_leg('robot_5', s, r, M, (s * 0.16, 0, -0.14), (s * 0.32, 0, -0.26), (s * 0.33, 0, -0.43),
                  mt='dark', ms='dark', mf='metal', t=0.1, foot_size=(0.2, 0.28, 0.08), knee_m='metal')
    return r


# ================================================================ ARAÑA
def build_spider(M, x):
    """Clásico: cabeza cuadrada amarilla con pantalla y cuatro patas dobladas. Pies en z = -0.47."""
    r = root('arana', x)
    size = (0.56, 0.5, 0.4)
    box('arana_cuerpo', size, (0, 0, 0.06), r, M['c1'], bev=0.06)
    box_edges('arana_aristas', size, (0, 0, 0.06), 0.04, r, M['neon'])
    eye('arana_pantalla', 0.04, 0.07, 0.22, 0.16, -0.25, r, M, sock=0.08)
    for s in (-1, 1):
        for yy, k in legs6(2):
            spider_leg('arana', s, k, r, M, (s * 0.24, yy, -0.02), (s * 0.44, yy * 1.3, 0.2), (s * 0.62, yy * 1.6, -0.46),
                       mu='c1', mp='c1', mk='neon', ru=0.045, rl=0.04, square=True, neon=True)
    return r


def build_spider2(M, x):
    """Demonio: cuerpo negro redondo con cuernos, tres ojos rojos y seis patas."""
    r = root('arana_2', x)
    sphere('arana_2_cuerpo', 1.0, (0, 0, 0.02), r, M['dark'], scale=(0.34, 0.3, 0.25), seg=20, rings=10)
    sphere('arana_2_lomo', 1.0, (-0.04, 0.02, 0.1), r, M['c1'], scale=(0.24, 0.22, 0.15), seg=16, rings=8)
    core('arana_2_ojo', r, M, -0.27, 0.08, ring='c1', z=0.05)
    for s in (-1, 1):
        sphere(f'arana_2_ojito{s}', 0.035, (s * 0.13, -0.25, 0.13), r, M['neon'], seg=10, rings=6)
        spike(f'arana_2_cuerno{s}', (s * 0.12, -0.12, 0.2), (s * 0.2, -0.14, 0.38), 0.05, r, M)
        rod(f'arana_2_colmillo{s}', (s * 0.05, -0.26, -0.1), (s * 0.03, -0.27, -0.18), 0.022, r, M['metal'], r2=0.003)
        for yy, k in legs6(3):
            spider_leg('arana_2', s, k, r, M, (s * 0.24, yy, 0.02), (s * 0.42, yy * 1.5, 0.3), (s * 0.62, yy * 1.9, -0.46),
                       mu='dark', mp='c1', mk='neon', ru=0.04, rl=0.03, neon=False)
    return r


def build_spider3(M, x):
    """Tecno: cuerpo blanco ovalado con visor y ojo cian, cuatro patas blancas con rodillas de metal."""
    r = root('arana_3', x)
    sphere('arana_3_cuerpo', 1.0, (0, 0, 0.04), r, M['c1'], scale=(0.34, 0.3, 0.24), seg=24, rings=12)
    fbox('arana_3_visor', 0.34, 0.12, 0.03, 0.05, -0.27, 0.06, r, M['dark'], bev=0.025)
    fbox('arana_3_raja', 0.24, 0.035, 0.03, 0.05, -0.3, 0.02, r, M['neon'])
    torus('arana_3_cinto', 0.32, 0.018, (0, 0, -0.04), r, M['neon'], axis='Z', seg=28, rseg=4).scale = (1.03, 0.92, 1)
    for s in (-1, 1):
        for yy, k in legs6(2):
            spider_leg('arana_3', s, k, r, M, (s * 0.24, yy, 0.0), (s * 0.44, yy * 1.4, 0.28), (s * 0.62, yy * 1.8, -0.46),
                       mu='c1', mp='c1', mk='metal', ru=0.05, rl=0.04, neon=True)
    return r


def build_spider4(M, x):
    """Sonrisa: cuerpo morado redondo con ojos y sonrisa de neón, seis patas."""
    r = root('arana_4', x)
    sphere('arana_4_cuerpo', 1.0, (0, 0, 0.03), r, M['c1'], scale=(0.34, 0.3, 0.27), seg=24, rings=12)
    for s in (-1, 1):
        sphere(f'arana_4_ojo{s}', 0.05, (s * 0.1, -0.27, 0.11), r, M['neon'], scale=(1, 0.6, 1.2), seg=10, rings=6)
    n = 6
    grin = [(0.17 * math.cos(math.pi * i / n), -0.02 - 0.09 * math.sin(math.pi * i / n)) for i in range(n + 1)]
    fpoly('arana_4_sonrisa', grin, -0.27, 0.06, r, M['neon'])
    for s in (-1, 1):
        for yy, k in legs6(3):
            spider_leg('arana_4', s, k, r, M, (s * 0.24, yy, 0.02), (s * 0.42, yy * 1.5, 0.3), (s * 0.62, yy * 1.9, -0.46),
                       mu='c1', mp='dark', mk='neon', ru=0.045, rl=0.033)
    return r


def build_spider5(M, x):
    """Pinchos: caja negra con ojo cuadrado verde y seis patas angulosas con garras de metal."""
    r = root('arana_5', x)
    size = (0.5, 0.46, 0.42)
    box('arana_5_cuerpo', size, (0, 0, 0.08), r, M['dark'], bev=0.04)
    box_edges('arana_5_aristas', size, (0, 0, 0.08), 0.035, r, M['neon'])
    line('arana_5_ojo_marco', [(-0.11, 0.21), (0.13, 0.21), (0.13, -0.03), (-0.11, -0.03)], -0.23, 0.035, r, M['neon'], depth=0.025)
    fbox('arana_5_ojo', 0.09, 0.09, 0.01, 0.09, -0.23, 0.03, r, M['neon'])
    for s in (-1, 1):
        for yy, k in legs6(3):
            spider_leg('arana_5', s, k, r, M, (s * 0.22, yy, 0.02), (s * 0.42, yy * 1.5, 0.26), (s * 0.62, yy * 1.9, -0.47),
                       mu='dark', mp='dark', mk='metal', ru=0.04, rl=0.035, neon=True, claw=True, square=True)
    return r


# ================================================================ CUBO 6-12
def build_cube6(M, x):
    """Núcleo: esquinas de metal, gran núcleo redondo en la cara y pernos en los lados."""
    rn = 'cubo_6'; r = root(rn, x)
    y = cube_shell(rn, r, M, bev=0.07, plates=False)
    boxes(rn + '_esquinas', [((0.2, 0.2, 0.2), (sx * 0.355, sy * 0.355, sz * 0.355))
                             for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)], r, M['metal'], bev=0.03)
    box(rn + '_frente', (0.52, 0.04, 0.52), (0, y - 0.012, 0), r, M['c1'], bev=0.02)
    yy = y - 0.035
    bars(rn + '_juntas', [((sx * 0.22, yy, sz * 0.22), (sx * 0.3, yy, sz * 0.3)) for sx in (-1, 1) for sz in (-1, 1)],
         0.035, r, M['dark'])
    core(rn, r, M, y - 0.035, 0.2)
    torus(rn + '_aro', 0.205, 0.028, (0, y - 0.045, 0), r, M['metal'], axis='Y', seg=24, rseg=6)
    for s in (-1, 1):
        cylinder(f'{rn}_perno{s}', 0.12, 0.05, (s * 0.45, 0, 0), r, M['metal'], axis='X', seg=16)
        cylinder(f'{rn}_perno_neon{s}', 0.07, 0.03, (s * 0.48, 0, 0), r, M['neon'], axis='X', seg=14)
    cylinder(rn + '_perno_arriba', 0.12, 0.05, (0, 0, 0.45), r, M['metal'], seg=16)
    cylinder(rn + '_perno_arriba_neon', 0.07, 0.03, (0, 0, 0.48), r, M['neon'], seg=14)
    return r


def build_cube7(M, x):
    """Cristal: caras facetadas como hielo, aristas finas de neón, esquirlas en las esquinas y ojos rasgados."""
    rn = 'cubo_7'; r = root(rn, x)
    box(rn + '_cuerpo', (0.84, 0.84, 0.84), (0, 0, 0), r, M['c1'], bev=0.02)
    box_edges(rn + '_aristas', (0.84, 0.84, 0.84), (0, 0, 0), 0.03, r, M['neon'])
    for nm, rot in (('frente', (0, 0, 0)), ('arriba', (-math.pi / 2, 0, 0)), ('lado', (0, 0, math.pi / 2)),
                    ('lado2', (0, 0, -math.pi / 2)), ('atras', (0, 0, math.pi))):
        o = facet_face(f'{rn}_faceta_{nm}', 0.38, 0.1, r, M['c1'])
        o.rotation_euler = rot
        o.location = Euler(rot).to_matrix() @ Vector((0, -0.42, 0))
    A = Vector((0.04, -0.52, 0.05))
    pts = [(-0.38, -0.38), (0.05, -0.38), (0.38, -0.38), (0.38, -0.04), (0.38, 0.38), (-0.06, 0.38), (-0.38, 0.38), (-0.38, 0.03)]
    lift = [0, 0.45, 0, 0.3, 0, 0.5, 0, 0.35]
    bars(rn + '_vetas', [(A, Vector((a, -0.42 - 0.1 * lift[i], b))) for i, (a, b) in enumerate(pts) if i % 2 == 0], 0.016, r, M['neon'])
    L = [(-0.27, 0.17), (-0.06, 0.06), (-0.08, 0.02), (-0.26, 0.1)]
    poly_eye(rn + '_ojo-1', L, -0.5, r, M, k=0.6)
    poly_eye(rn + '_ojo1', [(a + 0.06, b) for a, b in mirror_x(L)], -0.5, r, M, k=0.6)
    cr = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            c = Vector((sx * 0.36, sy * 0.36, 0.36))
            cr.append((tuple(c), tuple(c + Vector((sx * 0.1, sy * 0.1, 0.2))), 0.08))
    cr += [((0.4, -0.2, -0.3), (0.56, -0.24, -0.4), 0.06), ((-0.4, 0.1, -0.32), (-0.56, 0.12, -0.42), 0.06)]
    cones(rn + '_esquirlas', cr, r, M['c1'], seg=4)
    return r


def build_cube8(M, x):
    """Cuernos: cuerpo oscuro, marco de color, ojos rasgados de neón y dos grandes cuernos curvos."""
    rn = 'cubo_8'; r = root(rn, x)
    y = cube_shell(rn, r, M, body='dark', bev=0.05, plates=False)
    box(rn + '_marco', (0.74, 0.04, 0.74), (0, y - 0.012, 0), r, M['c1'], bev=0.018)
    box(rn + '_frente', (0.58, 0.04, 0.58), (0, y - 0.03, 0), r, M['dark'], bev=0.014)
    y2 = y - 0.05
    L = [(-0.26, 0.17), (-0.05, 0.05), (-0.06, 0.0), (-0.25, 0.08)]
    poly_eye(rn + '_ojo-1', L, y2, r, M, k=0.55)
    poly_eye(rn + '_ojo1', mirror_x(L), y2, r, M, k=0.55)
    fbox(rn + '_boca', 0.32, 0.07, 0, -0.15, y2, 0.03, r, M['dark'], bev=0.01)
    fbox(rn + '_boca_neon', 0.24, 0.025, 0, -0.15, y2 - 0.02, 0.02, r, M['neon'])
    for s in (-1, 1):
        horn(f'{rn}_cuerno{s}', (s * 0.27, -0.08, 0.36), (s * 0.56, -0.08, 0.46), (s * 0.44, -0.08, 0.76), 0.1, r, M)
    side_marks(rn, r, M, D(0.07, 0.12), m='c1')
    return r


def build_cube9(M, x):
    """Blindado: escuadras de blindaje en las esquinas, remaches y pantalla con cara cuadrada."""
    rn = 'cubo_9'; r = root(rn, x)
    y = cube_shell(rn, r, M, bev=0.05)
    Lb = [(-0.41, 0.41), (-0.12, 0.41), (-0.12, 0.31), (-0.31, 0.31), (-0.31, 0.12), (-0.41, 0.12)]
    for i, (sx, sz) in enumerate([(-1, 1), (1, 1), (-1, -1), (1, -1)]):
        fpoly(f'{rn}_blindaje{i}', [(-a * sx, b * sz) for a, b in Lb], y, 0.06, r, M['c1'], bev=0.012)
    cones(rn + '_remaches', [((sx * 0.36, y - 0.05, sz * 0.36), (sx * 0.36, y - 0.085, sz * 0.36), 0.03, 0.03)
                             for sx in (-1, 1) for sz in (-1, 1)], r, M['metal'], seg=8)
    fbox(rn + '_pantalla', 0.46, 0.38, 0, 0.0, y, 0.035, r, M['dark'], bev=0.012)
    y2 = y - 0.035
    for s in (-1, 1):
        fbox(f'{rn}_ojo{s}', 0.11, 0.11, s * 0.11, 0.06, y2, 0.025, r, M['neon'])
    fbox(rn + '_boca', 0.26, 0.045, 0, -0.1, y2, 0.025, r, M['neon'])
    side_marks(rn, r, M, D(0.06, 0.11))
    return r


def build_cube10(M, x):
    """Runa: panel oscuro con un gran rombo de neón, cuatro puntos y rombos en los lados."""
    rn = 'cubo_10'; r = root(rn, x)
    y = cube_shell(rn, r, M, bev=0.06)
    fbox(rn + '_panel', 0.62, 0.62, 0, 0, y, 0.03, r, M['dark'], bev=0.02)
    y2 = y - 0.03
    line(rn + '_runa', D(0.17, 0.24), y2, 0.035, r, M['neon'], depth=0.025)
    fpoly(rn + '_gema', D(0.085, 0.13), y2, 0.04, r, M['neon'])
    for i, (cx, cz) in enumerate([(0.24, 0), (-0.24, 0), (0, 0.33), (0, -0.33)]):
        fpoly(f'{rn}_punto{i}', D(0.035, 0.045, cx, cz), y2, 0.03, r, M['neon'])
    side_marks(rn, r, M, D(0.08, 0.13), top=True)
    return r


def build_cube11(M, x):
    """Ojos: panel oscuro con dos ojos redondos de neón y una boca corta."""
    rn = 'cubo_11'; r = root(rn, x)
    y = cube_shell(rn, r, M, bev=0.06)
    fbox(rn + '_panel', 0.64, 0.64, 0, 0, y, 0.03, r, M['dark'], bev=0.03)
    y2 = y - 0.03
    for s in (-1, 1):
        round_eye(f'{rn}_ojo{s}', s * 0.14, 0.08, y2, 0.1, r, M)
    fbox(rn + '_boca', 0.2, 0.045, 0, -0.15, y2, 0.025, r, M['neon'])
    side_marks(rn, r, M, D(0.06, 0.11))
    return r


def build_cube12(M, x):
    """Equis: cuerpo oscuro con esquinas de color y una gran equis de neón."""
    rn = 'cubo_12'; r = root(rn, x)
    y = cube_shell(rn, r, M, body='dark', bev=0.05, plates=False)
    boxes(rn + '_esquinas', [((0.17, 0.17, 0.17), (sx * 0.37, sy * 0.37, sz * 0.37))
                             for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)], r, M['c1'], bev=0.03)
    fbox(rn + '_panel', 0.58, 0.58, 0, 0, y, 0.03, r, M['dark'], bev=0.02)
    xmark(rn + '_equis', 0, 0, y - 0.03, 0.07, 0.3, 0.12, r, M['neon'])
    for s in (-1, 1):
        o = xmark(f'{rn}_marca{s}', 0, 0, 0, 0.04, 0.17, 0.06, r, M['c1'])
        o.rotation_euler = (0, 0, -s * math.pi / 2); o.location = (s * 0.45, 0, 0)
    return r


# ================================================================ NAVE 6-12
def ship_hull(rn, r, M, body, nose, th, m='c1', bev=0.04, nk=0.72):
    slab(rn + '_casco', body, th, 'XZ', r, M[m], bev=bev)
    slab(rn + '_morro', nose, th * nk, 'XZ', r, M[m], bev=bev * 0.7)
    return poly_segs(body, -th / 2 - 0.012) + poly_segs(nose, -th * nk / 2 - 0.012, closed=False)


def build_ship6(M, x):
    """Núcleo: flecha con cabina-núcleo redonda, aletas en flecha arriba y abajo y remaches."""
    rn = 'nave_6'; r = root(rn, x)
    th = 0.34; y = -th / 2
    body = [(0.18, 0.16), (-0.32, 0.2), (-0.47, 0.08), (-0.47, -0.08), (-0.32, -0.18), (0.18, -0.14)]
    nose = [(0.18, 0.16), (0.6, 0.0), (0.18, -0.14)]
    segs = ship_hull(rn, r, M, body, nose, th)
    fins = [[(-0.02, 0.18), (-0.36, 0.42), (-0.5, 0.4), (-0.4, 0.18)], [(-0.02, -0.16), (-0.36, -0.38), (-0.5, -0.36), (-0.4, -0.16)]]
    for i, f in enumerate(fins):
        slab(f'{rn}_aleta{i}', f, 0.12, 'XZ', r, M['c1'], bev=0.02)
        segs += poly_segs(f[:3], -0.07, closed=False)
    bars(rn + '_neon', segs, 0.035, r, M['neon'], depth=0.03)
    core(rn + '_cabina', r, M, y - 0.01, 0.12, ring='metal', x=0.0, z=0.01)
    cones(rn + '_remaches', [((cx, y + 0.01, cz), (cx, y - 0.04, cz), 0.035, 0.035) for cx, cz in [(-0.26, 0.1), (-0.26, -0.1), (-0.38, 0.0)]],
          r, M['metal'], seg=8)
    wing = [(0.0, 0.0), (-0.3, 0.2), (-0.42, 0.2), (-0.36, 0.0)]
    for s in (-1, 1):
        o = slab(f'{rn}_ala{s}', [(a, s * b) for a, b in wing], 0.05, 'XY', r, M['c1'], bev=0.015, offset=-0.1)
        o.location = (0, s * th / 2, 0)
    engine(rn, r, M, x=-0.53)
    return r


def build_ship7(M, x):
    """Cristal: casco de esquirlas facetadas superpuestas con aristas de neón y cabina en rombo."""
    rn = 'nave_7'; r = root(rn, x)
    parts = [('cuerpo', [(0.28, 0.12), (-0.46, 0.15), (-0.5, 0.0), (-0.46, -0.13), (0.28, -0.1)], 0.34, 0.0),
             ('morro', [(0.66, 0.0), (0.12, 0.16), (0.18, -0.13)], 0.26, -0.02),
             ('alta', [(0.25, 0.08), (-0.44, 0.38), (-0.24, 0.06)], 0.16, -0.08),
             ('baja', [(0.25, -0.06), (-0.44, -0.34), (-0.24, -0.05)], 0.16, -0.08),
             ('alta2', [(0.0, 0.1), (-0.52, 0.27), (-0.36, 0.08)], 0.12, 0.08),
             ('baja2', [(0.0, -0.08), (-0.52, -0.23), (-0.36, -0.06)], 0.12, 0.08)]
    segs = []
    for nm, p, t, off in parts:
        shard(f'{rn}_{nm}', p, t, r, M['c1'], offset=off)
        segs += poly_segs(p, off - 0.006)
    bars(rn + '_neon', segs, 0.026, r, M['neon'], depth=0.03)
    fpoly(rn + '_cabina', [(0.3, 0.0), (0.15, 0.06), (0.02, 0.0), (0.15, -0.05)], -0.14, 0.05, r, M['neon'])
    engine(rn, r, M, x=-0.54, rad=0.1)
    return r


def build_ship8(M, x):
    """Cuernos: casco oscuro con dos cuernos curvos hacia delante, ojo rasgado y morro de color."""
    rn = 'nave_8'; r = root(rn, x)
    th = 0.32; y = -th / 2
    body = [(0.26, 0.12), (-0.3, 0.17), (-0.5, 0.08), (-0.42, 0.0), (-0.5, -0.08), (-0.3, -0.15), (0.26, -0.1)]
    nose = [(0.26, 0.12), (0.64, 0.0), (0.26, -0.1)]
    segs = ship_hull(rn, r, M, body, nose, th, m='dark', bev=0.03)
    bars(rn + '_neon', segs, 0.03, r, M['neon'], depth=0.025)
    fpoly(rn + '_morro_color', [(0.3, 0.08), (0.56, 0.0), (0.3, -0.06)], -th * 0.36 - 0.01, 0.03, r, M['c1'])
    poly_eye(rn + '_ojo', [(-0.12, 0.08), (0.18, 0.02), (0.16, -0.03), (-0.1, 0.02)], y - 0.01, r, M, k=0.6)
    for i, cx in enumerate((-0.38, -0.26)):
        fpoly(f'{rn}_galon{i}', [(cx + 0.08, 0.0), (cx, 0.12), (cx - 0.05, 0.12), (cx + 0.03, 0.0), (cx - 0.05, -0.1), (cx, -0.1)],
              y - 0.01, 0.03, r, M['c1'])
    horn(rn + '_cuerno0', (-0.16, 0, 0.14), (-0.14, 0, 0.4), (0.22, 0, 0.42), 0.075, r, M)
    horn(rn + '_cuerno1', (-0.16, 0, -0.12), (-0.14, 0, -0.34), (0.14, 0, -0.36), 0.065, r, M)
    engine(rn, r, M, x=-0.52, rad=0.1)
    return r


def build_ship9(M, x):
    """Blindado: casco grueso con placas superpuestas, visor rectangular, doble deriva y remaches."""
    rn = 'nave_9'; r = root(rn, x)
    th = 0.4; y = -th / 2
    body = [(0.2, 0.17), (-0.34, 0.2), (-0.48, 0.12), (-0.48, -0.12), (-0.34, -0.18), (0.2, -0.15)]
    nose = [(0.2, 0.17), (0.6, 0.0), (0.2, -0.15)]
    segs = ship_hull(rn, r, M, body, nose, th, bev=0.05)
    fbox(rn + '_franja', 0.66, 0.08, -0.12, 0.0, y, 0.03, r, M['dark'])
    for i, p in enumerate([[(0.16, 0.15), (-0.32, 0.18), (-0.32, 0.06), (0.1, 0.05)],
                           [(0.16, -0.13), (-0.32, -0.16), (-0.32, -0.06), (0.1, -0.05)]]):
        fpoly(f'{rn}_placa{i}', p, y, 0.06, r, M['c1'], bev=0.012)
    cones(rn + '_remaches', [((cx, y - 0.05, cz), (cx, y - 0.08, cz), 0.025, 0.025) for cx in (-0.26, -0.08) for cz in (0.12, -0.11)],
          r, M['metal'], seg=8)
    eye(rn + '_visor', 0.33, 0.01, 0.15, 0.06, -th * 0.36 - 0.01, r, M, sock=0.05)
    segs += [((-0.46, y - 0.03, 0.0), (0.16, y - 0.03, 0.0))]
    bars(rn + '_neon', segs, 0.03, r, M['neon'], depth=0.025)
    fin = [(-0.2, 0.18), (-0.4, 0.4), (-0.5, 0.4), (-0.46, 0.18)]
    for s in (-1, 1):
        slab(f'{rn}_deriva{s}', fin, 0.06, 'XZ', r, M['c1'], bev=0.015, offset=s * 0.1)
        slab(f'{rn}_aleta{s}', [(a, -b) for a, b in fin], 0.06, 'XZ', r, M['c1'], bev=0.015, offset=s * 0.1)
    bars(rn + '_deriva_neon', [((-0.2, -0.135, 0.18), (-0.4, -0.135, 0.4)), ((-0.2, -0.135, -0.18), (-0.4, -0.135, -0.4))], 0.025, r, M['neon'])
    engine(rn, r, M, x=-0.54, rad=0.13)
    return r


def build_ship10(M, x):
    """Runa: aguja fina con aletas en cometa, cabina en rombo y rombos de neón en el casco."""
    rn = 'nave_10'; r = root(rn, x)
    th = 0.26; y = -th / 2
    body = [(0.66, 0.0), (0.1, 0.11), (-0.44, 0.08), (-0.5, 0.0), (-0.44, -0.08), (0.1, -0.1)]
    slab(rn + '_casco', body, th, 'XZ', r, M['c1'], bev=0.03)
    segs = poly_segs(body, y - 0.012)
    fins = [[(-0.06, 0.09), (-0.22, 0.26), (-0.46, 0.42), (-0.36, 0.08)], [(-0.06, -0.09), (-0.22, -0.24), (-0.46, -0.38), (-0.36, -0.08)]]
    for i, f in enumerate(fins):
        slab(f'{rn}_aleta{i}', f, 0.08, 'XZ', r, M['c1'], bev=0.015)
        segs += poly_segs(f[:3], -0.05, closed=False)
    bars(rn + '_neon', segs, 0.03, r, M['neon'], depth=0.025)
    line(rn + '_runa', D(0.12, 0.08, 0.2, 0.0), y - 0.01, 0.025, r, M['neon'], depth=0.02)
    fpoly(rn + '_cabina', D(0.06, 0.04, 0.2, 0.0), y - 0.01, 0.035, r, M['neon'])
    for i, cx in enumerate((-0.08, -0.24)):
        fpoly(f'{rn}_rombo{i}', D(0.035, 0.035, cx, 0.0), y - 0.01, 0.03, r, M['neon'])
    engine(rn, r, M, x=-0.53, rad=0.08)
    return r


def build_ship11(M, x):
    """Ojos: fuselaje redondo con dos ojos grandes, alas delta arriba y abajo con borde de neón."""
    rn = 'nave_11'; r = root(rn, x)
    sphere(rn + '_fuselaje', 1.0, (0, 0, 0), r, M['c1'], scale=(0.48, 0.21, 0.19), seg=22, rings=11)
    fins = [[(0.08, 0.12), (-0.4, 0.42), (-0.48, 0.36), (-0.34, 0.08)], [(0.08, -0.12), (-0.4, -0.4), (-0.48, -0.34), (-0.34, -0.08)]]
    segs = []
    for i, f in enumerate(fins):
        slab(f'{rn}_ala{i}', f, 0.1, 'XZ', r, M['c1'], bev=0.03)
        segs += poly_segs(f[:3], -0.062, closed=False)
    bars(rn + '_neon', segs, 0.035, r, M['neon'], depth=0.03)
    round_eye(rn + '_ojo1', 0.2, 0.03, -0.17, 0.065, r, M)
    round_eye(rn + '_ojo2', 0.03, 0.03, -0.19, 0.065, r, M)
    torus(rn + '_cinto', 0.2, 0.018, (-0.25, 0, 0), r, M['neon'], axis='X', seg=24, rseg=4).scale = (1, 0.88, 0.8)
    cylinder(rn + '_tobera', 0.1, 0.12, (-0.48, 0, 0), r, M['dark'], axis='X', r2=0.12, seg=20)
    cylinder(rn + '_fuego', 0.085, 0.03, (-0.545, 0, 0), r, M['engine'], axis='X', seg=20)
    return r


def build_ship12(M, x):
    """Equis: casco oscuro con alas en X detrás (dos pares desplazados) y una equis de neón."""
    rn = 'nave_12'; r = root(rn, x)
    th = 0.3; y = -th / 2
    body = [(0.24, 0.12), (-0.34, 0.15), (-0.46, 0.06), (-0.46, -0.06), (-0.34, -0.13), (0.24, -0.1)]
    nose = [(0.24, 0.12), (0.62, 0.0), (0.24, -0.1)]
    segs = ship_hull(rn, r, M, body, nose, th, m='dark', bev=0.03)
    wt = [(-0.08, 0.12), (-0.42, 0.44), (-0.54, 0.4), (-0.3, 0.1)]
    for s in (-1, 1):
        slab(f'{rn}_ala_alta{s}', [(a + (0.06 if s < 0 else 0), b) for a, b in wt], 0.05, 'XZ', r, M['c1'], bev=0.012, offset=s * 0.09)
        slab(f'{rn}_ala_baja{s}', [(a + (0.06 if s < 0 else 0), -b) for a, b in wt], 0.05, 'XZ', r, M['c1'], bev=0.012, offset=s * 0.09)
    segs += [((-0.02, -0.12, 0.12), (-0.36, -0.12, 0.44)), ((-0.02, -0.12, -0.12), (-0.36, -0.12, -0.44))]
    bars(rn + '_neon', segs, 0.03, r, M['neon'], depth=0.025)
    xmark(rn + '_equis', -0.12, 0.0, y - 0.01, 0.0, 0.11, 0.045, r, M['neon'])
    fpoly(rn + '_cabina', [(0.44, 0.0), (0.26, 0.05), (0.24, -0.03)], -th * 0.36 - 0.01, 0.03, r, M['neon'])
    engine(rn, r, M, x=-0.52, rad=0.09)
    return r


# ================================================================ BOLA 6-12
def build_ball6(M, x):
    """Cristal: bola facetada de hielo con esquirlas que salen y núcleo con aro de metal."""
    rn = 'bola_6'; r = root(rn, x)
    R = 0.36
    ico(rn + '_cuerpo', R, (0, 0, 0), r, M['c1'], sub=1, jit=0.05, seed=6)
    dirs = [d for d in fib_dirs(16) if d.y > -0.55]
    cones(rn + '_esquirlas', [(tuple(d * (R - 0.06)), tuple(d * (R + 0.14 + 0.04 * (i % 2))), 0.1) for i, d in enumerate(dirs)],
          r, M['c1'], seg=4)
    core(rn, r, M, -R + 0.01, 0.17, ring='metal')
    return r


def build_ball7(M, x):
    """Sombra: bola oscura con placas de color, una estela de neón curva y núcleo grande."""
    rn = 'bola_7'; r = root(rn, x)
    R = R_BALL
    sphere(rn + '_cuerpo', R, (0, 0, 0), r, M['dark'], seg=24, rings=12)
    items = patch_list([(0.62, 1.35, 4, 0.5), (1.35, 2.15, 5, 0.1), (2.15, 3.1, 3, 0.4)])
    patches(rn + '_placas', R, items[::2], r, M['c1'], thick=0.02, gap=0.06)
    core(rn, r, M, -R + 0.03, 0.2)
    pts = [sph(R + 0.02, math.radians(200 + 18 * i), 0.62 + 0.13 * i) for i in range(8)]
    bars(rn + '_estela', list(zip(pts, pts[1:])), 0.045, r, M['neon'])
    return r


def build_ball8(M, x):
    """Cuernos: bola oscura erizada de pinchos de metal, placas de color y núcleo rojo."""
    rn = 'bola_8'; r = root(rn, x)
    R = 0.36
    sphere(rn + '_cuerpo', R, (0, 0, 0), r, M['dark'], seg=24, rings=12)
    patches(rn + '_placas', R, patch_list([(0.62, 1.3, 6, 0.0), (1.9, 2.6, 5, 0.3)]), r, M['c1'], thick=0.02, gap=0.13)
    dirs = [d for d in fib_dirs(18) if d.y > -0.72]
    cones(rn + '_pinchos', [(tuple(d * (R - 0.03)), tuple(d * (R + 0.2)), 0.07) for d in dirs], r, M['metal'], seg=8)
    core(rn, r, M, -R + 0.03, 0.17, ring='c1')
    return r


def build_ball9(M, x):
    """Blindado: bola de placas gruesas con juntas oscuras, luces de neón en las juntas y núcleo enorme."""
    rn = 'bola_9'; r = root(rn, x)
    R = 0.41
    sphere(rn + '_cuerpo', R, (0, 0, 0), r, M['dark'], seg=24, rings=12)
    patches(rn + '_placas', R, patch_list([(0.62, 1.35, 4, 0.2), (1.35, 2.1, 5, 0.7), (2.1, 3.0, 4, 0.1)]), r, M['c1'], thick=0.04, gap=0.06)
    dots = [sph(1, 0.2 + i * math.pi / 2, 1.35) for i in range(4)] + [sph(1, 0.7 + i * 2 * math.pi / 5, 2.1) for i in range(0, 5, 2)]
    cones(rn + '_luces', [(tuple(Vector(d) * (R - 0.01)), tuple(Vector(d) * (R + 0.03)), 0.04, 0.04) for d in dots], r, M['neon'], seg=10)
    core(rn, r, M, -R + 0.0, 0.23, ring='metal')
    return r


def build_ball10(M, x):
    """Runa: bola lisa con una banda oscura en el ecuador, dos líneas de neón y un botón-núcleo."""
    rn = 'bola_10'; r = root(rn, x)
    R = R_BALL
    sphere(rn + '_cuerpo', R, (0, 0, 0), r, M['c1'], seg=24, rings=12)
    torus(rn + '_banda', R, 0.05, (0, 0, 0), r, M['dark'], axis='Z', seg=32, rseg=6)
    for s in (-1, 1):
        torus(f'{rn}_neon{s}', R - 0.002, 0.013, (0, 0, s * 0.07), r, M['neon'], axis='Z', seg=32, rseg=4)
    core(rn, r, M, -R + 0.0, 0.14)
    for s in (-1, 1):
        fpoly(f'{rn}_rombo{s}', D(0.04, 0.06), 0, 0.03, r, M['neon']).location = (s * 0.27, -R + 0.08, 0)
    bars(rn + '_brillo', parallel(R + 0.004, 0.95, math.radians(115), math.radians(165), n=5), 0.03, r, M['neon'])
    return r


def build_ball11(M, x):
    """Ojos: bola de placas con juntas que brillan y una cara con dos ojos redondos."""
    rn = 'bola_11'; r = root(rn, x)
    R = 0.42
    sphere(rn + '_cuerpo', R - 0.008, (0, 0, 0), r, M['neon'], seg=22, rings=11)
    patches(rn + '_placas', R, patch_list([(0.72, 1.4, 5, 0.3), (1.4, 2.15, 6, 0.0), (2.15, 3.12, 4, 0.4)]), r, M['c1'], thick=0.025, gap=0.05)
    cylinder(rn + '_cara', 0.27, 0.06, (0, -R + 0.04, 0), r, M['dark'], axis='Y', seg=24)
    torus(rn + '_cara_aro', 0.27, 0.022, (0, -R + 0.015, 0), r, M['c1'], axis='Y', seg=24, rseg=6)
    for s in (-1, 1):
        round_eye(f'{rn}_ojo{s}', s * 0.1, 0.03, -R + 0.005, 0.07, r, M)
    fbox(rn + '_boca', 0.1, 0.03, 0, -0.12, -R + 0.005, 0.02, r, M['neon'])
    return r


def build_ball12(M, x):
    """Equis: bola de placas claras con puntos de neón y una equis oscura sobre el núcleo."""
    rn = 'bola_12'; r = root(rn, x)
    R = 0.41
    sphere(rn + '_cuerpo', R, (0, 0, 0), r, M['dark'], seg=24, rings=12)
    rings = [(0.6, 1.3, 4, 0.785), (1.3, 2.05, 4, 0.0), (2.05, 3.0, 4, 0.785)]
    patches(rn + '_placas', R, patch_list(rings), r, M['c1'], thick=0.035, gap=0.07)
    dots = []
    for ph0, ph1, n, off in rings[:2]:
        for i in range(n):
            dots.append(Vector(sph(1, off + (i + 0.5) * 2 * math.pi / n, (ph0 + ph1) / 2)))
    cones(rn + '_puntos', [(tuple(d * (R + 0.02)), tuple(d * (R + 0.05)), 0.045, 0.045) for d in dots], r, M['neon'], seg=12)
    core(rn, r, M, -R + 0.0, 0.19)
    xmark(rn + '_equis', 0, 0, -R - 0.055, 0.03, 0.12, 0.035, r, M['dark'], depth=0.02)
    return r


# ================================================================ OVNI 6-12
def hull_z(rad, h, z, rr):
    return z + h * math.sqrt(max(0.0, 1 - (rr / rad) ** 2))


def build_ufo6(M, x):
    """Núcleo: platillo con ojos de buey de neón, pernos en el borde y un gran núcleo debajo."""
    rn = 'ovni_6'; r = root(rn, x)
    saucer(rn, r, M, lights=6)
    it = []
    for i in range(8):
        a = (i + 0.5) / 8 * 2 * math.pi; c, s = math.cos(a), math.sin(a)
        it.append(((c * 0.39, s * 0.39, hull_z(0.56, 0.14, -0.06, 0.39) - 0.02), (c * 0.43, s * 0.43, hull_z(0.56, 0.14, -0.06, 0.43) + 0.03), 0.04, 0.04))
    cones(rn + '_ventanas', it, r, M['neon'], seg=10)
    cones(rn + '_pernos', [((math.cos(a) * 0.52, math.sin(a) * 0.52, -0.06), (math.cos(a) * 0.62, math.sin(a) * 0.62, -0.06), 0.045, 0.045)
                           for a in [i * math.pi / 2 + math.pi / 4 for i in range(4)]], r, M['metal'], seg=10)
    torus(rn + '_nucleo_aro', 0.15, 0.03, (0, 0, -0.2), r, M['metal'], seg=24, rseg=6)
    cylinder(rn + '_nucleo', 0.13, 0.04, (0, 0, -0.205), r, M['neon'], seg=20)
    return r


def build_ufo7(M, x):
    """Cristal: platillo facetado de ocho lados, cúpula de cristal tallada y esquirlas en el borde."""
    rn = 'ovni_7'; r = root(rn, x)
    sphere(rn + '_plato', 1.0, (0, 0, -0.06), r, M['c1'], scale=(0.58, 0.58, 0.15), seg=8, rings=4, smooth=False)
    torus(rn + '_borde', 0.575, 0.03, (0, 0, -0.06), r, M['neon'], seg=8, rseg=4)
    cylinder(rn + '_fondo', 0.28, 0.06, (0, 0, -0.19), r, M['dark'], r2=0.2, seg=8, smooth=False)
    ico(rn + '_cupula', 0.25, (0, 0, 0.05), r, M['glass'], scale=(1, 1, 0.9))
    sh = []
    for i in range(8):
        a = (i + 0.5) / 8 * 2 * math.pi; c, s = math.cos(a), math.sin(a)
        sh.append(((c * 0.48, s * 0.48, -0.03), (c * 0.68, s * 0.68, 0.06), 0.06))
    cones(rn + '_esquirlas', sh, r, M['c1'], seg=4)
    for i in range(6):
        a = i / 6 * 2 * math.pi
        sphere(f'{rn}_luz{i}', 0.055, (math.cos(a) * 0.4, math.sin(a) * 0.4, -0.15), r, M['neon'], scale=(1.4, 1.4, 0.7), seg=8, rings=4, smooth=False)
    return r


def build_ufo8(M, x):
    """Cuernos: platillo oscuro con banda de color, dos cuernos curvos, rajas de neón y púas debajo."""
    rn = 'ovni_8'; r = root(rn, x)
    saucer(rn, r, M, body='dark', dome=0.24)
    torus(rn + '_banda', 0.42, 0.03, (0, 0, hull_z(0.56, 0.14, -0.06, 0.42) - 0.005), r, M['c1'], seg=32, rseg=6)
    for s in (-1, 1):
        horn(f'{rn}_cuerno{s}', (s * 0.26, 0, 0.03), (s * 0.48, 0, 0.12), (s * 0.42, 0, 0.36), 0.075, r, M)
    rj = []
    for i in range(6):
        a = (i + 0.5) / 6 * 2 * math.pi
        rj.append(((0.035, 0.12, 0.025), (math.cos(a) * 0.5, math.sin(a) * 0.5, -0.01), (0, 0, a)))
    boxes(rn + '_rajas', rj, r, M['neon'])
    cones(rn + '_puas', [((math.cos(a) * 0.4, math.sin(a) * 0.4, -0.1), (math.cos(a) * 0.46, math.sin(a) * 0.46, -0.26), 0.04)
                         for a in [i / 6 * 2 * math.pi for i in range(6)]], r, M['metal'], seg=8)
    return r


def build_ufo9(M, x):
    """Blindado: platillo con un anillo de placas atornilladas, visor alrededor de la cúpula y aletas laterales."""
    rn = 'ovni_9'; r = root(rn, x)
    top = saucer(rn, r, M, rad=0.55, h=0.15)
    pl, st = [], []
    for i in range(8):
        a = i / 8 * 2 * math.pi; c, s = math.cos(a), math.sin(a)
        pl.append(((0.1, 0.17, 0.05), (c * 0.45, s * 0.45, hull_z(0.55, 0.15, -0.06, 0.45) - 0.005), (0, 0, a)))
        st.append(((c * 0.45, s * 0.45, 0.0), (c * 0.45, s * 0.45, hull_z(0.55, 0.15, -0.06, 0.45) + 0.04), 0.022, 0.022))
    boxes(rn + '_placas', pl, r, M['c1'], bev=0.015)
    cones(rn + '_remaches', st, r, M['metal'], seg=6)
    torus(rn + '_visor', 0.27, 0.04, (0, 0, top + 0.01), r, M['dark'], seg=28, rseg=6)
    torus(rn + '_visor_neon', 0.285, 0.013, (0, 0, top + 0.03), r, M['neon'], seg=28, rseg=4)
    fin = [(0.48, -0.03), (0.66, 0.14), (0.68, 0.05), (0.56, -0.09)]
    for s in (-1, 1):
        slab(f'{rn}_aleta{s}', [(s * a, b) for a, b in fin], 0.05, 'XZ', r, M['c1'], bev=0.012)
    return r


def build_ufo10(M, x):
    """Runa: platillo con luces en rombo en el borde, cúpula alta y una antena con un rombo de neón."""
    rn = 'ovni_10'; r = root(rn, x)
    top = saucer(rn, r, M, dome=0.21, dk=1.3, lights=0)
    for i in range(8):
        a = i / 8 * 2 * math.pi
        o = box(f'{rn}_luz{i}', (0.03, 0.07, 0.07), (math.cos(a) * 0.56, math.sin(a) * 0.56, -0.06), r, M['neon'])
        o.rotation_euler = (math.pi / 4, 0, a)
    tz = top - 0.03 + 0.21 * 1.3
    rod(rn + '_antena', (0, 0, tz - 0.02), (0, 0, tz + 0.06), 0.015, r, M['metal'])
    cones(rn + '_runa', [((0, 0, tz + 0.1), (0, 0, tz + 0.17), 0.045), ((0, 0, tz + 0.1), (0, 0, tz + 0.05), 0.045)], r, M['neon'], seg=4)
    for i in range(4):
        a = i / 4 * 2 * math.pi + math.pi / 4
        o = fpoly(f'{rn}_marca{i}', D(0.04, 0.06), 0, 0.02, r, M['neon'])
        o.location = (math.cos(a) * 0.32, math.sin(a) * 0.32, -0.19)
        o.rotation_euler = (math.pi / 2, 0, a + math.pi / 2)
    return r


def build_ufo11(M, x):
    """Ojos: platillo con dos ojos grandes en la cúpula y dos antenas con bolas de neón."""
    rn = 'ovni_11'; r = root(rn, x)
    top = saucer(rn, r, M, dome=0.27, dk=1.0)
    for s in (-1, 1):
        round_eye(f'{rn}_ojo{s}', s * 0.1, top + 0.08, -0.205, 0.065, r, M)
        rod(f'{rn}_antena{s}', (s * 0.14, 0, top + 0.17), (s * 0.27, 0, top + 0.3), 0.014, r, M['metal'])
        sphere(f'{rn}_antena_luz{s}', 0.04, (s * 0.28, 0, top + 0.31), r, M['neon'], seg=10, rings=6)
    return r


def build_ufo12(M, x):
    """Equis: platillo oscuro con una equis de neón delante, aletas de color y patas cruzadas."""
    rn = 'ovni_12'; r = root(rn, x)
    saucer(rn, r, M, body='dark')
    def P(xx, zz):
        rr = math.sqrt(max(0.0, 0.56 ** 2 * (1 - ((zz + 0.06) / 0.14) ** 2) - xx * xx)) + 0.012
        return (xx, -rr, zz)
    bars(rn + '_equis', [(P(-0.08, -0.03), P(0.08, 0.05)), (P(-0.08, 0.05), P(0.08, -0.03))], 0.035, r, M['neon'])
    fin = [(0.46, 0.0), (0.64, 0.12), (0.64, 0.03), (0.54, -0.06)]
    for s in (-1, 1):
        slab(f'{rn}_aleta{s}', [(s * a, b) for a, b in fin], 0.05, 'XZ', r, M['c1'], bev=0.012)
    lg = []
    for i in range(4):
        a = i / 4 * 2 * math.pi + math.pi / 4; c, s = math.cos(a), math.sin(a)
        lg.append(((c * 0.18, s * 0.18, -0.17), (c * 0.34, s * 0.34, -0.3), 0.022, 0.022))
    cones(rn + '_patas', lg, r, M['c1'], seg=6)
    return r


# ================================================================ ONDA 6-12
def build_wave6(M, x):
    """Núcleo: flecha ancha con un núcleo redondo y remaches en las alas."""
    rn = 'onda_6'; r = root(rn, x)
    P = [(0.46, 0.0), (-0.28, 0.32), (-0.12, 0.0), (-0.28, -0.32)]
    slab(rn + '_cuerpo', P, 0.2, 'XZ', r, M['c1'], bev=0.03)
    line(rn + '_neon', P, -0.1, 0.04, r, M['neon'], depth=0.03)
    core(rn, r, M, -0.12, 0.085, x=0.06)
    cones(rn + '_remaches', [((-0.18, -0.09, s * 0.17), (-0.18, -0.14, s * 0.17), 0.03, 0.03) for s in (-1, 1)], r, M['metal'])
    return r


def build_wave7(M, x):
    """Cristal: punta de flecha tallada con aristas de neón y esquirlas en las alas."""
    rn = 'onda_7'; r = root(rn, x)
    shard(rn + '_cuerpo', DART, 0.26, r, M['c1'], apex=(0.04, 0.0))
    A = Vector((0.04, -0.13, 0.0))
    bars(rn + '_vetas', [(A, Vector((a, 0, b))) for a, b in DART], 0.02, r, M['neon'])
    bars(rn + '_neon', poly_segs(DART, -0.004), 0.03, r, M['neon'])
    cones(rn + '_esquirlas', [((-0.24, 0, s * 0.24), (-0.42, 0, s * 0.4), 0.05) for s in (-1, 1)] + [((-0.14, 0, 0), (-0.32, 0, 0), 0.045)],
          r, M['c1'], seg=4)
    return r


def build_wave8(M, x):
    """Cuernos: flecha oscura con perfil de color, ojo rasgado y dos cuernos hacia atrás."""
    rn = 'onda_8'; r = root(rn, x)
    slab(rn + '_cuerpo', DART, 0.2, 'XZ', r, M['dark'], bev=0.025)
    line(rn + '_perfil', DART, -0.1, 0.045, r, M['c1'], depth=0.03)
    line(rn + '_neon', shrink(DART, 0.62), -0.1, 0.025, r, M['neon'], depth=0.025)
    fpoly(rn + '_ojo', [(0.24, 0.0), (0.02, 0.06), (0.06, 0.0)], -0.11, 0.035, r, M['neon'])
    for s in (-1, 1):
        horn(f'{rn}_cuerno{s}', (-0.26, 0, s * 0.27), (-0.36, 0, s * 0.42), (-0.52, 0, s * 0.42), 0.05, r, M, n=4)
    return r


def build_wave9(M, x):
    """Blindado: flecha gruesa con una placa encima, visor de neón y remaches."""
    rn = 'onda_9'; r = root(rn, x)
    slab(rn + '_cuerpo', DART, 0.26, 'XZ', r, M['c1'], bev=0.04)
    line(rn + '_neon', DART, -0.13, 0.035, r, M['neon'], depth=0.03)
    fpoly(rn + '_placa', shrink(DART, 0.68), -0.13, 0.05, r, M['c1'], bev=0.012)
    fbox(rn + '_visor', 0.16, 0.04, 0.08, 0.0, -0.175, 0.03, r, M['neon'])
    cones(rn + '_remaches', [((-0.12, -0.17, s * 0.13), (-0.12, -0.2, s * 0.13), 0.025, 0.025) for s in (-1, 1)], r, M['metal'])
    return r


def build_wave10(M, x):
    """Runa: rombo alargado con un rombo de neón dentro y aletas pequeñas detrás."""
    rn = 'onda_10'; r = root(rn, x)
    P = [(0.48, 0.0), (0.04, 0.22), (-0.32, 0.0), (0.04, -0.22)]
    slab(rn + '_cuerpo', P, 0.2, 'XZ', r, M['c1'], bev=0.03)
    line(rn + '_neon', P, -0.1, 0.035, r, M['neon'], depth=0.03)
    fpoly(rn + '_gema', D(0.1, 0.08, 0.06, 0.0), -0.1, 0.04, r, M['neon'])
    segs = []
    for s in (-1, 1):
        f = [(-0.18, s * 0.07), (-0.4, s * 0.25), (-0.34, s * 0.07)]
        slab(f'{rn}_aleta{s}', f, 0.08, 'XZ', r, M['c1'], bev=0.012)
        segs += poly_segs(f[:2], -0.05, closed=False)
    bars(rn + '_aleta_neon', segs, 0.025, r, M['neon'])
    return r


def build_wave11(M, x):
    """Ojos: flecha redondeada con dos ojos redondos y una sonrisa corta."""
    rn = 'onda_11'; r = root(rn, x)
    P = [(0.44, 0.0), (-0.3, 0.3), (-0.18, 0.0), (-0.3, -0.3)]
    slab(rn + '_cuerpo', P, 0.22, 'XZ', r, M['c1'], bev=0.07)
    line(rn + '_neon', P, -0.11, 0.035, r, M['neon'], depth=0.03)
    round_eye(rn + '_ojo1', 0.1, 0.03, -0.11, 0.05, r, M)
    round_eye(rn + '_ojo2', -0.06, 0.05, -0.11, 0.05, r, M)
    line(rn + '_boca', [(-0.04, -0.07), (0.02, -0.1), (0.1, -0.06)], -0.11, 0.02, r, M['neon'], closed=False)
    return r


def build_wave12(M, x):
    """Equis: doble galón oscuro (>>) con perfiles de neón."""
    rn = 'onda_12'; r = root(rn, x)
    C = [(0.46, 0.0), (0.08, 0.3), (-0.08, 0.3), (0.26, 0.0), (-0.08, -0.3), (0.08, -0.3)]
    for i, dx in enumerate((0.0, -0.3)):
        p = [(a + dx, b * (1 - 0.15 * i)) for a, b in C]
        slab(f'{rn}_galon{i}', p, 0.2 - 0.04 * i, 'XZ', r, M['dark'], bev=0.02)
        line(f'{rn}_neon{i}', p, -0.1 + 0.02 * i, 0.03, r, M['neon'], depth=0.025)
        fpoly(f'{rn}_color{i}', shrink(p, 0.55), -0.1 + 0.02 * i, 0.03, r, M['c1'])
    return r


# ================================================================ ROBOT 6-12
def hip_box(rn, r, M):
    box(rn + '_cadera', (0.44, 0.36, 0.08), (0, 0, -0.12), r, M['dark'], bev=0.02)


def legs2(rn, r, M, **kw):
    for s in (-1, 1):
        mech_leg(rn, s, r, M, (s * 0.16, 0, -0.13), (s * 0.37, 0, -0.09), (s * 0.37, 0, -0.435), **kw)


def legs_robot4(rn, r, M, **kw):
    for s in (-1, 1):
        for pre, yy in (('', -0.11), ('b_', 0.11)):
            mech_leg(rn, s, r, M, (s * 0.15, yy, -0.12), (s * 0.36, yy * 1.2, -0.07), (s * 0.41, yy * 1.3, -0.435), pre=pre, **kw)


def build_robot6(M, x):
    """Núcleo: mecha redondeado con un gran núcleo en la cara, pernos en los hombros y dos patas gruesas."""
    rn = 'robot_6'; r = root(rn, x)
    box(rn + '_cuerpo', (0.6, 0.52, 0.5), (0, 0, 0.14), r, M['c1'], bev=0.1)
    core(rn + '_nucleo', r, M, -0.27, 0.14, x=0.05, z=0.16)
    torus(rn + '_aro', 0.15, 0.025, (0.05, -0.285, 0.16), r, M['metal'], axis='Y', seg=24, rseg=6)
    fbox(rn + '_franja', 0.4, 0.035, 0.0, -0.04, -0.26, 0.03, r, M['dark'])
    for s in (-1, 1):
        cylinder(f'{rn}_perno{s}', 0.1, 0.06, (s * 0.31, 0, 0.18), r, M['metal'], axis='X', seg=16)
        cylinder(f'{rn}_perno_neon{s}', 0.055, 0.03, (s * 0.345, 0, 0.18), r, M['neon'], axis='X', seg=14)
    hip_box(rn, r, M)
    legs2(rn, r, M, t=0.13)
    return r


def build_robot7(M, x):
    """Cristal: cuerpo facetado de hielo con esquirlas, pantalla cuadrada y cuatro patas con garra."""
    rn = 'robot_7'; r = root(rn, x)
    ico(rn + '_cuerpo', 1.0, (0, 0, 0.15), r, M['c1'], scale=(0.34, 0.28, 0.28), sub=1, jit=0.05, seed=7)
    eye(rn + '_pantalla', 0.06, 0.16, 0.18, 0.15, -0.27, r, M, sock=0.08)
    cones(rn + '_esquirlas', [((-0.1, 0.05, 0.3), (-0.2, 0.08, 0.52), 0.08), ((0.12, 0.0, 0.32), (0.16, 0.0, 0.48), 0.06),
                              ((-0.28, 0, 0.15), (-0.46, 0, 0.26), 0.07), ((0.26, 0.06, 0.22), (0.4, 0.06, 0.34), 0.05)], r, M['c1'], seg=4)
    hip_box(rn, r, M)
    legs_robot4(rn, r, M, t=0.09, mk='neon', claw=True)
    return r


def build_robot8(M, x):
    """Cuernos: caja oscura con marco de color, ojos rasgados, dos cuernos y patas con garra."""
    rn = 'robot_8'; r = root(rn, x)
    size = (0.58, 0.5, 0.46)
    box(rn + '_cuerpo', size, (0, 0, 0.13), r, M['dark'], bev=0.05)
    box_edges(rn + '_aristas', size, (0, 0, 0.13), 0.035, r, M['neon'])
    fbox(rn + '_marco', 0.42, 0.3, 0.04, 0.16, -0.25, 0.03, r, M['c1'], bev=0.01)
    fbox(rn + '_pantalla', 0.35, 0.23, 0.04, 0.16, -0.275, 0.02, r, M['dark'])
    L = [(-0.12, 0.23), (0.02, 0.16), (0.01, 0.12), (-0.12, 0.17)]
    fpoly(rn + '_ojo-1_neon', [(a + 0.0, b) for a, b in L], -0.29, 0.025, r, M['neon'])
    fpoly(rn + '_ojo1_neon', [(0.08 - a, b) for a, b in reversed(L)], -0.29, 0.025, r, M['neon'])
    for s in (-1, 1):
        horn(f'{rn}_cuerno{s}', (s * 0.2, -0.05, 0.34), (s * 0.42, -0.05, 0.42), (s * 0.36, -0.05, 0.62), 0.075, r, M)
    hip_box(rn, r, M)
    legs2(rn, r, M, t=0.11, mt='dark', ms='c1', claw=True)
    return r


def build_robot9(M, x):
    """Blindado: cabeza con hombreras y placa superior, pantalla con cara y cuatro patas gruesas."""
    rn = 'robot_9'; r = root(rn, x)
    box(rn + '_cuerpo', (0.58, 0.5, 0.46), (0, 0, 0.14), r, M['c1'], bev=0.06)
    boxes(rn + '_blindaje', [((0.1, 0.44, 0.3), (s * 0.31, 0, 0.17)) for s in (-1, 1)] + [((0.42, 0.38, 0.06), (0, 0, 0.39))],
          r, M['c1'], bev=0.02)
    cones(rn + '_remaches', [((s * 0.36, yy, 0.24), (s * 0.38, yy, 0.24), 0.025, 0.025) for s in (-1, 1) for yy in (-0.14, 0.14)],
          r, M['metal'], seg=8)
    fbox(rn + '_pantalla', 0.36, 0.28, 0.04, 0.17, -0.25, 0.035, r, M['dark'], bev=0.012)
    for s in (-1, 1):
        fbox(f'{rn}_ojo{s}', 0.08, 0.08, 0.04 + s * 0.08, 0.2, -0.285, 0.025, r, M['neon'])
    fbox(rn + '_boca', 0.18, 0.03, 0.04, 0.09, -0.285, 0.025, r, M['neon'])
    bars(rn + '_neon', [((s * 0.36, -0.2, 0.04), (s * 0.36, -0.2, 0.3)) for s in (-1, 1)], 0.025, r, M['neon'])
    hip_box(rn, r, M)
    legs_robot4(rn, r, M, t=0.11)
    return r


def build_robot10(M, x):
    """Runa: cabeza en rombo con una runa de neón, antena con rombo y dos patas."""
    rn = 'robot_10'; r = root(rn, x)
    box(rn + '_cuerpo', (0.42, 0.46, 0.42), (0, 0, 0.18), r, M['c1'], bev=0.04, rot=(0, math.pi / 4, 0))
    line(rn + '_runa', D(0.19, 0.19, 0.0, 0.18), -0.235, 0.03, r, M['neon'], depth=0.025)
    fpoly(rn + '_gema', D(0.07, 0.1, 0.0, 0.18), -0.235, 0.035, r, M['neon'])
    for i, (cx, cz) in enumerate([(0.12, 0.18), (-0.12, 0.18)]):
        fpoly(f'{rn}_punto{i}', D(0.025, 0.035, cx, cz), -0.235, 0.03, r, M['neon'])
    rod(rn + '_antena', (0, 0, 0.45), (0, 0, 0.53), 0.015, r, M['metal'])
    cones(rn + '_antena_runa', [((0, 0, 0.57), (0, 0, 0.63), 0.04), ((0, 0, 0.57), (0, 0, 0.52), 0.04)], r, M['neon'], seg=4)
    hip_box(rn, r, M)
    legs2(rn, r, M, t=0.12)
    return r


def build_robot11(M, x):
    """Ojos: casco redondeado con cara oscura, dos ojos redondos, antena y bracitos."""
    rn = 'robot_11'; r = root(rn, x)
    box(rn + '_cuerpo', (0.56, 0.5, 0.48), (0, 0, 0.14), r, M['c1'], bev=0.16)
    fbox(rn + '_cara', 0.42, 0.28, 0.04, 0.15, -0.24, 0.03, r, M['dark'], bev=0.04)
    for s in (-1, 1):
        round_eye(f'{rn}_ojo{s}', 0.04 + s * 0.1, 0.16, -0.265, 0.065, r, M)
        rod(f'{rn}_brazo{s}', (s * 0.27, 0, 0.08), (s * 0.38, 0, -0.04), 0.04, r, M['dark'])
        sphere(f'{rn}_mano{s}', 0.06, (s * 0.39, 0, -0.06), r, M['c1'], seg=12, rings=6)
    rod(rn + '_antena', (0, 0, 0.37), (0, 0, 0.49), 0.015, r, M['metal'])
    sphere(rn + '_antena_luz', 0.045, (0, 0, 0.51), r, M['neon'], seg=12, rings=6)
    hip_box(rn, r, M)
    legs2(rn, r, M, t=0.13)
    return r


def build_robot12(M, x):
    """Equis: caja oscura con aristas de neón, visor de color con una equis y cuatro patas."""
    rn = 'robot_12'; r = root(rn, x)
    size = (0.58, 0.5, 0.46)
    box(rn + '_cuerpo', size, (0, 0, 0.14), r, M['dark'], bev=0.05)
    box_edges(rn + '_aristas', size, (0, 0, 0.14), 0.035, r, M['neon'])
    fbox(rn + '_marco', 0.38, 0.32, 0.04, 0.16, -0.25, 0.03, r, M['c1'], bev=0.012)
    fbox(rn + '_pantalla', 0.3, 0.24, 0.04, 0.16, -0.275, 0.02, r, M['dark'])
    xmark(rn + '_equis', 0.04, 0.16, -0.29, 0.02, 0.13, 0.05, r, M['neon'], depth=0.02)
    boxes(rn + '_aletas', [((0.06, 0.3, 0.16), (s * 0.31, 0, 0.3)) for s in (-1, 1)], r, M['c1'], bev=0.015)
    hip_box(rn, r, M)
    legs_robot4(rn, r, M, t=0.1, mt='c1', ms='dark')
    return r


# ================================================================ ARAÑA 6-12
def build_spider6(M, x):
    """Núcleo: cabeza redondeada con un núcleo por cara, pernos laterales y cuatro patas en cuchilla."""
    rn = 'arana_6'; r = root(rn, x)
    box(rn + '_cuerpo', (0.52, 0.46, 0.42), (0, 0, 0.14), r, M['c1'], bev=0.1)
    core(rn + '_nucleo', r, M, -0.25, 0.13, x=0.03, z=0.16)
    torus(rn + '_aro', 0.14, 0.024, (0.03, -0.265, 0.16), r, M['metal'], axis='Y', seg=24, rseg=6)
    for s in (-1, 1):
        cylinder(f'{rn}_perno{s}', 0.08, 0.05, (s * 0.27, 0, 0.18), r, M['metal'], axis='X', seg=14)
    box(rn + '_vientre', (0.36, 0.32, 0.1), (0, 0, -0.09), r, M['dark'], bev=0.02)
    legs4(rn, r, M)
    return r


def build_spider7(M, x):
    """Cristal: cabeza facetada con esquirlas, pantalla y patas de cristal."""
    rn = 'arana_7'; r = root(rn, x)
    ico(rn + '_cuerpo', 1.0, (0, 0, 0.13), r, M['c1'], scale=(0.31, 0.26, 0.26), sub=1, jit=0.05, seed=17)
    eye(rn + '_pantalla', 0.04, 0.14, 0.16, 0.14, -0.25, r, M, sock=0.07)
    cones(rn + '_esquirlas', [((-0.08, 0.04, 0.3), (-0.16, 0.06, 0.5), 0.07), ((0.12, 0.0, 0.3), (0.18, 0.0, 0.44), 0.05),
                              ((-0.24, 0.08, 0.2), (-0.4, 0.1, 0.32), 0.06)], r, M['c1'], seg=4)
    legs4(rn, r, M, mk='neon', tip='c1', t=0.08)
    return r


def build_spider8(M, x):
    """Cuernos: cabeza oscura con cuernos y ojos rasgados, patas de color con puntas de metal."""
    rn = 'arana_8'; r = root(rn, x)
    size = (0.52, 0.46, 0.42)
    box(rn + '_cuerpo', size, (0, 0, 0.13), r, M['dark'], bev=0.05)
    box_edges(rn + '_aristas', size, (0, 0, 0.13), 0.032, r, M['neon'])
    fbox(rn + '_marco', 0.38, 0.26, 0.03, 0.15, -0.23, 0.03, r, M['c1'], bev=0.01)
    fbox(rn + '_pantalla', 0.31, 0.19, 0.03, 0.15, -0.255, 0.02, r, M['dark'])
    L = [(-0.1, 0.21), (0.01, 0.15), (0.0, 0.12), (-0.1, 0.16)]
    fpoly(rn + '_ojo-1_neon', L, -0.27, 0.025, r, M['neon'])
    fpoly(rn + '_ojo1_neon', [(0.06 - a, b) for a, b in reversed(L)], -0.27, 0.025, r, M['neon'])
    for s in (-1, 1):
        horn(f'{rn}_cuerno{s}', (s * 0.17, -0.05, 0.32), (s * 0.36, -0.05, 0.4), (s * 0.3, -0.05, 0.58), 0.065, r, M)
    legs4(rn, r, M, mu='dark', mp='c1', mk='neon')
    return r


def build_spider9(M, x):
    """Blindado: cabeza con hombreras, pantalla con cara y patas gruesas con puntas de metal."""
    rn = 'arana_9'; r = root(rn, x)
    box(rn + '_cuerpo', (0.52, 0.46, 0.42), (0, 0, 0.14), r, M['c1'], bev=0.06)
    boxes(rn + '_blindaje', [((0.09, 0.4, 0.26), (s * 0.28, 0, 0.17)) for s in (-1, 1)] + [((0.38, 0.34, 0.05), (0, 0, 0.37))],
          r, M['c1'], bev=0.018)
    fbox(rn + '_pantalla', 0.32, 0.25, 0.03, 0.16, -0.23, 0.035, r, M['dark'], bev=0.012)
    for s in (-1, 1):
        fbox(f'{rn}_ojo{s}', 0.07, 0.07, 0.03 + s * 0.07, 0.19, -0.265, 0.025, r, M['neon'])
    fbox(rn + '_boca', 0.16, 0.03, 0.03, 0.09, -0.265, 0.025, r, M['neon'])
    legs4(rn, r, M, t=0.1)
    return r


def build_spider10(M, x):
    """Runa: cabeza en rombo con una runa de neón y patas en cuchilla."""
    rn = 'arana_10'; r = root(rn, x)
    box(rn + '_cuerpo', (0.38, 0.44, 0.38), (0, 0, 0.15), r, M['c1'], bev=0.04, rot=(0, math.pi / 4, 0))
    line(rn + '_runa', D(0.17, 0.17, 0.0, 0.15), -0.225, 0.028, r, M['neon'], depth=0.025)
    fpoly(rn + '_gema', D(0.065, 0.09, 0.0, 0.15), -0.225, 0.035, r, M['neon'])
    cones(rn + '_runa_alta', [((0, 0, 0.47), (0, 0, 0.54), 0.035), ((0, 0, 0.47), (0, 0, 0.42), 0.035)], r, M['neon'], seg=4)
    legs4(rn, r, M, mk='neon')
    return r


def build_spider11(M, x):
    """Ojos: cabeza redondeada con dos ojos redondos y una antena."""
    rn = 'arana_11'; r = root(rn, x)
    box(rn + '_cuerpo', (0.52, 0.46, 0.44), (0, 0, 0.14), r, M['c1'], bev=0.15)
    fbox(rn + '_cara', 0.38, 0.24, 0.03, 0.15, -0.22, 0.03, r, M['dark'], bev=0.035)
    for s in (-1, 1):
        round_eye(f'{rn}_ojo{s}', 0.03 + s * 0.09, 0.16, -0.245, 0.06, r, M)
    rod(rn + '_antena', (0, 0, 0.35), (-0.05, 0, 0.46), 0.014, r, M['metal'])
    sphere(rn + '_antena_luz', 0.04, (-0.055, 0, 0.48), r, M['neon'], seg=12, rings=6)
    legs4(rn, r, M)
    return r


def build_spider12(M, x):
    """Equis: cabeza oscura con aristas de neón, visor de color con una equis y patas de color."""
    rn = 'arana_12'; r = root(rn, x)
    size = (0.52, 0.46, 0.42)
    box(rn + '_cuerpo', size, (0, 0, 0.14), r, M['dark'], bev=0.05)
    box_edges(rn + '_aristas', size, (0, 0, 0.14), 0.032, r, M['neon'])
    fbox(rn + '_marco', 0.34, 0.3, 0.03, 0.16, -0.23, 0.03, r, M['c1'], bev=0.012)
    fbox(rn + '_pantalla', 0.27, 0.23, 0.03, 0.16, -0.255, 0.02, r, M['dark'])
    xmark(rn + '_equis', 0.03, 0.16, -0.27, 0.02, 0.12, 0.045, r, M['neon'], depth=0.02)
    legs4(rn, r, M, mu='c1', mp='dark', tip='c1')
    return r


# ================================================================ SWING (cápsula redonda con un rotor encima)
POD_Z, POD_R, ROTOR_Z = -0.12, 0.32, 0.37


def rotor(rn, r, M, kind=0, m='c1', tip='dark', L=0.5, w=0.075, th=0.085):
    """Barra de rotor horizontal centrada en el eje vertical de la cápsula. Todas las piezas se llaman <raiz>_rotor…
    y son simétricas respecto a su propio centro (el juego las gira sobre el eje vertical que pasa por él)."""
    z = ROTOR_Z
    if kind in (0, 4, 5):      # recta con puntas en bisel
        P = [(-L + 0.1, w), (-L, -w), (L - 0.1, -w), (L, w)]
    elif kind == 1:            # en punta
        P = [(-L, 0), (-L + 0.14, -w), (L - 0.14, -w), (L, 0), (L - 0.14, w), (-L + 0.14, w)]
    elif kind == 2:            # remos: estrecha en el centro y ancha en los extremos
        P = [(-L, -w * 1.4), (-L + 0.2, -w * 1.4), (-0.12, -w * 0.6), (0.12, -w * 0.6), (L - 0.2, -w * 1.4), (L, -w * 1.4),
             (L, w * 1.4), (L - 0.2, w * 1.4), (0.12, w * 0.6), (-0.12, w * 0.6), (-L + 0.2, w * 1.4), (-L, w * 1.4)]
    elif kind == 3:            # dos barras paralelas finas
        P = None
    else:                      # 6: rombo alargado
        P = [(-L, 0), (0, -w * 1.7), (L, 0), (0, w * 1.7)]
    if P:
        slab(rn + '_rotor', P, th, 'XY', r, M[m], bev=0.015, offset=z)
    else:
        boxes(rn + '_rotor', [((2 * L - 0.06, 0.05, th), (0, s * 0.055, z)) for s in (-1, 1)], r, M[m], bev=0.015)
    if kind in (0, 4, 5):
        tc = [[(-L + 0.1, w * 1.05), (-L, -w * 1.05), (-L + 0.14, -w * 1.05), (-L + 0.24, w * 1.05)]]
        tc.append([(-a, -b) for a, b in tc[0]])
        bm = bmesh.new()
        for p in tc:
            F = [bm.verts.new((a, b, z - th * 0.6)) for a, b in p]
            K = [bm.verts.new((a, b, z + th * 0.6)) for a, b in p]
            bm.faces.new(F); bm.faces.new(K[::-1])
            for i in range(4):
                j = (i + 1) % 4
                bm.faces.new((F[i], F[j], K[j], K[i]))
        bevel(from_bm(rn + '_rotor_puntas', bm, r, M[tip]), 0.01)
    if kind == 4:
        cones(rn + '_rotor_pinchos', [((s * (L - 0.04), 0, z), (s * (L + 0.14), 0, z), 0.04) for s in (-1, 1)], r, M['metal'], seg=8)
    if kind == 5:
        cones(rn + '_rotor_pesos', [((s * (L - 0.02), 0, z - 0.05), (s * (L - 0.02), 0, z + 0.05), 0.055, 0.055) for s in (-1, 1)],
              r, M['neon'], seg=14, smooth=True)
    if kind == 6:
        cones(rn + '_rotor_puntas', [((s * (L - 0.1), 0, z), (s * (L + 0.08), 0, z), 0.05) for s in (-1, 1)], r, M[tip], seg=4)
    lz = z + th / 2 + 0.006
    if kind == 3:
        bars(rn + '_rotor_neon', [((-L + 0.08, s * 0.055, lz), (L - 0.08, s * 0.055, lz)) for s in (-1, 1)], 0.022, r, M['neon'], depth=0.015)
    else:
        ww = w * (0.6 if kind == 2 else 1.0) + 0.004
        bars(rn + '_rotor_neon', [((-L + 0.26, 0, lz), (L - 0.26, 0, lz))] +
             [((-L + 0.26, s * ww, z), (L - 0.26, s * ww, z)) for s in (-1, 1)], 0.026, r, M['neon'], depth=0.015)
    cylinder(rn + '_rotor_buje', 0.075, th + 0.04, (0, 0, z), r, M['dark'], seg=16)
    cylinder(rn + '_rotor_tapa', 0.04, 0.02, (0, 0, z + th / 2 + 0.025), r, M['light'], seg=12)


def pod_mount(rn, r, M, m='c1'):
    """Cuello fijo entre la cápsula y el rotor."""
    cylinder(rn + '_cuello', 0.045, 0.16, (0, 0, ROTOR_Z - 0.1), r, M['dark'], seg=12)
    box(rn + '_soporte', (0.13, 0.11, 0.07), (0, 0, POD_Z + POD_R + 0.02), r, M[m], bev=0.02)


SEG_RINGS = [(0.62, 1.3, 4, 0.785), (1.3, 2.05, 5, 0.3), (2.05, 3.05, 4, 0.0)]


def pod(rn, r, M, body='c1', base='dark', rings=SEG_RINGS, thick=0.025, gap=0.05, ring='dark', core_r=0.13, sides=False):
    """Cápsula redonda de placas (como las bolas) con núcleo en la cara."""
    sphere(rn + '_cuerpo', POD_R, (0, 0, POD_Z), r, M[base], seg=22, rings=11)
    if rings:
        patches(rn + '_placas', POD_R, patch_list(rings), r, M[body], thick=thick, gap=gap, loc=(0, 0, POD_Z))
    if core_r:
        core(rn, r, M, -POD_R + 0.0, core_r, ring=ring, z=POD_Z)
    if sides:
        for s in (-1, 1):
            o = cylinder(f'{rn}_lado{s}', 0.07, 0.04, (s * (POD_R + 0.005), 0, POD_Z), r, M['neon'], axis='X', seg=14)
            torus(f'{rn}_lado_aro{s}', 0.075, 0.018, (s * (POD_R + 0.015), 0, POD_Z), r, M['dark'], axis='X', seg=16, rseg=4)


def build_swing(M, x):
    """Clásico: cápsula de placas con núcleo y rotor recto con puntas oscuras."""
    rn = 'swing'; r = root(rn, x)
    pod(rn, r, M); pod_mount(rn, r, M)
    rotor(rn, r, M, 0)
    return r


def build_swing2(M, x):
    """Demonio: cápsula oscura con pocas placas de color, núcleo con aro de color, cuernitos y rotor en punta."""
    rn = 'swing_2'; r = root(rn, x)
    pod(rn, r, M, body='c1', rings=[(0.62, 1.4, 4, 0.785), (1.9, 2.6, 4, 0.0)], gap=0.1, ring='c1')
    pod_mount(rn, r, M, m='dark')
    for s in (-1, 1):
        horn(f'{rn}_cuerno{s}', (s * 0.15, -0.05, POD_Z + 0.25), (s * 0.27, -0.05, POD_Z + 0.32), (s * 0.27, -0.05, POD_Z + 0.44), 0.045, r, M, n=4)
    rotor(rn, r, M, 1, m='dark', tip='c1')
    return r


def build_swing3(M, x):
    """Tecno: cápsula lisa con juntas oscuras, aro de metal vertical y rotor de dos barras."""
    rn = 'swing_3'; r = root(rn, x)
    pod(rn, r, M, body='c1', base='c1', rings=None, ring='metal')
    segs = meridians(POD_R + 0.004, [math.radians(a) for a in (45, 135, 225, 315)], math.asin(0.14 / POD_R), math.radians(165), n=6)
    bars(rn + '_juntas', segs, 0.025, r, M['dark']).location = (0, 0, POD_Z)
    torus(rn + '_aro', POD_R + 0.01, 0.022, (0, 0, POD_Z), r, M['metal'], axis='X', seg=28, rseg=6)
    pod_mount(rn, r, M, m='metal')
    rotor(rn, r, M, 3)
    return r


def build_swing4(M, x):
    """Sonrisa: cápsula de placas con núcleo, sonrisa de neón y rotor de remos."""
    rn = 'swing_4'; r = root(rn, x)
    pod(rn, r, M, core_r=0.11)
    pts = [sph(POD_R + 0.03, math.radians(200 + 140 * i / 6), 0.62) for i in range(7)]
    bars(rn + '_sonrisa', list(zip(pts, pts[1:])), 0.03, r, M['neon']).location = (0, 0, POD_Z)
    pod_mount(rn, r, M)
    rotor(rn, r, M, 2)
    return r


def build_swing5(M, x):
    """Pinchos: cápsula oscura con pinchos de metal alrededor y rotor con pinchos en las puntas."""
    rn = 'swing_5'; r = root(rn, x)
    pod(rn, r, M, body='dark', base='neon', gap=0.035)
    dirs = [d for d in fib_dirs(12) if d.y > -0.6 and d.z < 0.7]
    cones(rn + '_pinchos', [(tuple(d * (POD_R - 0.02) + Vector((0, 0, POD_Z))), tuple(d * (POD_R + 0.13) + Vector((0, 0, POD_Z))), 0.05)
                            for d in dirs], r, M['metal'])
    pod_mount(rn, r, M, m='dark')
    rotor(rn, r, M, 4, m='dark', tip='c1')
    return r


def build_swing6(M, x):
    """Núcleo: cápsula de placas con un núcleo grande y dos núcleos pequeños a los lados; rotor con pesos."""
    rn = 'swing_6'; r = root(rn, x)
    pod(rn, r, M, core_r=0.14, sides=True, ring='metal')
    pod_mount(rn, r, M, m='metal')
    rotor(rn, r, M, 5)
    return r


def build_swing7(M, x):
    """Cristal: cápsula facetada con esquirlas y rotor en rombo con puntas de cristal."""
    rn = 'swing_7'; r = root(rn, x)
    ico(rn + '_cuerpo', POD_R - 0.02, (0, 0, POD_Z), r, M['c1'], sub=1, jit=0.05, seed=27)
    core(rn, r, M, -POD_R + 0.04, 0.12, ring='metal', z=POD_Z)
    dirs = [d for d in fib_dirs(12) if d.y > -0.5 and d.z < 0.75]
    cones(rn + '_esquirlas', [(tuple(d * (POD_R - 0.06) + Vector((0, 0, POD_Z))), tuple(d * (POD_R + 0.1) + Vector((0, 0, POD_Z))), 0.08)
                              for d in dirs], r, M['c1'], seg=4)
    pod_mount(rn, r, M)
    rotor(rn, r, M, 6, tip='c1')
    return r


def build_swing8(M, x):
    """Cuernos: cápsula oscura con ojos rasgados, cuernos grandes y rotor en punta con pinchos."""
    rn = 'swing_8'; r = root(rn, x)
    pod(rn, r, M, body='c1', rings=[(1.0, 1.6, 6, 0.0), (2.0, 2.7, 4, 0.785)], gap=0.08, core_r=0)
    yf = -POD_R + 0.02
    fbox(rn + '_visor', 0.34, 0.12, 0, POD_Z + 0.03, yf, 0.05, r, M['dark'], bev=0.02)
    L = [(-0.15, 0.07), (-0.03, 0.02), (-0.04, -0.01), (-0.14, 0.03)]
    for s, p in ((-1, L), (1, mirror_x(L))):
        fpoly(f'{rn}_ojo{s}_neon', [(a, b + POD_Z + 0.02) for a, b in p], yf - 0.04, 0.025, r, M['neon'])
    for s in (-1, 1):
        horn(f'{rn}_cuerno{s}', (s * 0.18, -0.04, POD_Z + 0.2), (s * 0.4, -0.04, POD_Z + 0.26), (s * 0.36, -0.04, POD_Z + 0.44), 0.06, r, M)
    pod_mount(rn, r, M, m='dark')
    rotor(rn, r, M, 4, m='c1', tip='dark')
    return r


def build_swing9(M, x):
    """Blindado: cápsula de placas gruesas con banda-visor y dos ojos cuadrados; rotor ancho."""
    rn = 'swing_9'; r = root(rn, x)
    pod(rn, r, M, thick=0.035, core_r=0, rings=[(0.3, 1.25, 4, 0.785), (1.25, 2.05, 5, 0.3), (2.05, 3.05, 4, 0.0)])
    torus(rn + '_banda', POD_R + 0.02, 0.05, (0, 0, POD_Z), r, M['dark'], axis='Z', seg=28, rseg=6).scale = (1, 1, 0.8)
    for s in (-1, 1):
        fbox(f'{rn}_ojo{s}', 0.07, 0.05, s * 0.08, POD_Z, -POD_R - 0.045, 0.03, r, M['neon'])
    cones(rn + '_remaches', [((s * 0.2, -0.24, POD_Z + 0.12), (s * 0.22, -0.27, POD_Z + 0.13), 0.022, 0.022) for s in (-1, 1)], r, M['metal'])
    pod_mount(rn, r, M)
    rotor(rn, r, M, 0, w=0.085, th=0.08, tip='metal')
    return r


def build_swing10(M, x):
    """Runa: cápsula lisa con una runa de rombos en la cara y rotor en rombo."""
    rn = 'swing_10'; r = root(rn, x)
    pod(rn, r, M, body='c1', base='c1', rings=None, core_r=0)
    yf = -POD_R + 0.02
    fbox(rn + '_placa', 0.3, 0.3, 0, POD_Z, yf + 0.01, 0.04, r, M['dark'], bev=0.03, rot=math.pi / 4)
    line(rn + '_runa', D(0.12, 0.15, 0, POD_Z), yf - 0.03, 0.025, r, M['neon'], depth=0.02)
    fpoly(rn + '_gema', D(0.05, 0.07, 0, POD_Z), yf - 0.03, 0.03, r, M['neon'])
    torus(rn + '_aro', POD_R + 0.005, 0.015, (0, 0, POD_Z), r, M['neon'], axis='Z', seg=28, rseg=4)
    pod_mount(rn, r, M)
    rotor(rn, r, M, 6, tip='neon')
    return r


def build_swing11(M, x):
    """Ojos: cápsula de placas con cara oscura, dos ojos redondos y rotor de remos."""
    rn = 'swing_11'; r = root(rn, x)
    pod(rn, r, M, base='neon', gap=0.04, core_r=0, rings=[(0.75, 1.4, 5, 0.3), (1.4, 2.1, 6, 0.0), (2.1, 3.05, 4, 0.4)])
    cylinder(rn + '_cara', 0.21, 0.05, (0, -POD_R + 0.05, POD_Z), r, M['dark'], axis='Y', seg=22)
    for s in (-1, 1):
        round_eye(f'{rn}_ojo{s}', s * 0.08, POD_Z + 0.02, -POD_R + 0.02, 0.055, r, M)
    pod_mount(rn, r, M)
    rotor(rn, r, M, 2, m='c1', tip='dark')
    return r


def build_swing12(M, x):
    """Equis: cápsula oscura con placas de color, una equis de neón y rotor en punta oscuro."""
    rn = 'swing_12'; r = root(rn, x)
    pod(rn, r, M, body='c1', rings=[(0.95, 1.6, 4, 0.785), (1.6, 2.3, 4, 0.0), (2.3, 3.05, 4, 0.785)], gap=0.07, core_r=0)
    xmark(rn + '_equis', 0, POD_Z, -POD_R + 0.01, 0.03, 0.2, 0.07, r, M['neon'], depth=0.06)
    pod_mount(rn, r, M, m='dark')
    rotor(rn, r, M, 1, m='dark', tip='c1')
    return r


MODELS = (build_cube, build_ship, build_ball, build_ufo, build_wave, build_robot, build_spider, build_swing,
          build_cube2, build_ship2, build_ball2, build_ufo2, build_wave2, build_robot2, build_spider2, build_swing2,
          build_cube3, build_ship3, build_ball3, build_ufo3, build_wave3, build_robot3, build_spider3, build_swing3,
          build_cube4, build_ship4, build_ball4, build_ufo4, build_wave4, build_robot4, build_spider4, build_swing4,
          build_cube5, build_ship5, build_ball5, build_ufo5, build_wave5, build_robot5, build_spider5, build_swing5,
          build_cube6, build_ship6, build_ball6, build_ufo6, build_wave6, build_robot6, build_spider6, build_swing6,
          build_cube7, build_ship7, build_ball7, build_ufo7, build_wave7, build_robot7, build_spider7, build_swing7,
          build_cube8, build_ship8, build_ball8, build_ufo8, build_wave8, build_robot8, build_spider8, build_swing8,
          build_cube9, build_ship9, build_ball9, build_ufo9, build_wave9, build_robot9, build_spider9, build_swing9,
          build_cube10, build_ship10, build_ball10, build_ufo10, build_wave10, build_robot10, build_spider10, build_swing10,
          build_cube11, build_ship11, build_ball11, build_ufo11, build_wave11, build_robot11, build_spider11, build_swing11,
          build_cube12, build_ship12, build_ball12, build_ufo12, build_wave12, build_robot12, build_spider12, build_swing12)


# ---------------------------------------------------------------- escena y exportación
def build():
    bpy.ops.wm.read_homefile(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    M = materials()
    for i, f in enumerate(MODELS):
        f(M, i * 1.8)
    # cámara y luz para revisar en Blender (no se exportan)
    cam = bpy.data.objects.new('Camara', bpy.data.cameras.new('Camara'))
    scene.collection.objects.link(cam)
    cam.location = (3.6, -9, 2.2); cam.rotation_euler = (math.radians(80), 0, 0)
    cam.data.lens = 50
    scene.camera = cam
    sun = bpy.data.objects.new('Sol', bpy.data.lights.new('Sol', 'SUN'))
    sun.data.energy = 3
    sun.rotation_euler = (math.radians(50), math.radians(-20), math.radians(-30))
    scene.collection.objects.link(sun)
    w = bpy.data.worlds.new('Mundo'); scene.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.03, 0.03, 0.06, 1)
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    # justo después de read_homefile el contexto no sirve para exportar: llamar a export_glb() aparte
    return BLEND


def export_glb():
    # cada modelo se exporta en el origen: se mueven un momento a x = 0
    roots = [o for o in bpy.data.objects if o.type == 'EMPTY' and o.parent is None]
    saved = {o.name: o.location.x for o in roots}
    for o in roots:
        o.location.x = 0
    try:
        for o in bpy.data.objects:
            o.select_set(o.type in {'MESH', 'EMPTY'})
        bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_apply=True,
                                  export_yup=True, export_cameras=False, export_lights=False,
                                  export_texcoords=False)  # sin texturas: las UV solo ocuparían sitio
    finally:
        for o in roots:
            o.location.x = saved[o.name]
    return {'glb': GLB, 'kb': os.path.getsize(GLB) // 1024}


MODES = ('cubo', 'nave', 'bola', 'ovni', 'onda', 'robot', 'arana', 'swing')
# (color1, neon) de cada columna de la hoja de referencia; solo para la vista previa
STYLE_TINT = (((0.85, 0.88, 0.95), (0.0, 0.6, 1.0)), ((0.8, 0.03, 0.02), (1.0, 0.08, 0.02)),
              ((0.15, 0.75, 0.1), (0.3, 1.0, 0.1)), ((0.4, 0.08, 0.85), (1.0, 0.15, 0.9)),
              ((1.0, 0.72, 0.02), (0.0, 0.75, 1.0)), ((0.45, 0.75, 1.0), (0.1, 0.8, 1.0)),
              ((0.85, 0.1, 0.75), (1.0, 0.3, 0.9)), ((0.45, 0.02, 0.02), (1.0, 0.05, 0.02)),
              ((0.1, 0.35, 1.0), (0.2, 0.9, 1.0)), ((1.0, 0.45, 0.02), (1.0, 0.8, 0.1)),
              ((0.2, 0.85, 0.15), (0.4, 1.0, 0.2)), ((0.35, 0.1, 0.75), (0.8, 0.3, 1.0)))


PREVIEW_ROT = (math.radians(78), 0, math.radians(-20))


def _slot(name):
    base, _, n = name.rpartition('_')
    if base in MODES and n.isdigit():
        return MODES.index(base), int(n) - 1
    return (MODES.index(name), 0) if name in MODES else (None, None)


def preview_sheet(path, px=240, names=None):
    """Hoja de vista previa: columnas = estilos, filas = modos. Tiñe color1/color2/neon por columna
    (como la referencia) solo para el render y luego lo deja todo como estaba."""
    scene = bpy.context.scene
    roots = [o for o in bpy.data.objects if o.type == 'EMPTY' and o.parent is None]
    saved = {o.name: tuple(o.location) for o in roots}
    copies, swaps = {}, []
    used_rows = sorted({_slot(o.name)[0] for o in roots if _slot(o.name)[0] is not None and (not names or o.name in names)})
    rowmap = {m: i for i, m in enumerate(used_rows)}
    for o in roots:
        row, col = _slot(o.name)
        if row is None or (names and o.name not in names):
            o.location = (0, 0, -100); continue
        cr = Euler(PREVIEW_ROT).to_matrix()
        o.location = cr @ Vector((col * 1.5, -rowmap[row] * 1.5, 0))
        for ch in o.children:
            if ch.type != 'MESH':
                continue
            for s in ch.material_slots:
                m = s.material
                if not m or m.name not in ('color1', 'color2', 'neon'):
                    continue
                key = (m.name, col)
                if key not in copies:
                    c = m.copy(); c.name = f'pv_{m.name}_{col}'
                    b = c.node_tree.nodes['Principled BSDF']
                    c1, ne = STYLE_TINT[col]
                    col_ = c1 if m.name == 'color1' else ne
                    b.inputs['Base Color'].default_value = (*col_, 1)
                    if m.name == 'neon':
                        b.inputs['Emission Color'].default_value = (*ne, 1)
                        b.inputs['Emission Strength'].default_value = 2.2
                    copies[key] = c
                swaps.append((s, m)); s.material = copies[key]
    bg = scene.world.node_tree.nodes['Background'].inputs['Color']
    old_bg = tuple(bg.default_value); bg.default_value = (0.02, 0.022, 0.035, 1)
    vs = scene.view_settings
    old_vt = vs.view_transform; vs.view_transform = 'Standard'
    cam = scene.camera
    old_cam = (tuple(cam.location), tuple(cam.rotation_euler), cam.data.type, cam.data.ortho_scale)
    cols, rows = len(STYLE_TINT), len(used_rows)
    w, h = (cols - 1) * 1.5, (rows - 1) * 1.5
    cam.data.type = 'ORTHO'
    cam.rotation_euler = PREVIEW_ROT
    cr = cam.rotation_euler.to_matrix()
    cam.location = cr @ Vector((w / 2, -h / 2, 12))
    cam.data.ortho_scale = max(w, h) + 1.5
    scene.render.resolution_x = int(px * cols); scene.render.resolution_y = int(px * rows)
    scene.render.filepath = path
    try:
        bpy.ops.render.render(write_still=True)
    finally:
        for o in roots:
            o.location = saved[o.name]
        for s, m in swaps:
            s.material = m
        for c in copies.values():
            bpy.data.materials.remove(c)
        bg.default_value = old_bg
        vs.view_transform = old_vt
        cam.location, cam.rotation_euler, cam.data.type, cam.data.ortho_scale = old_cam
    return path


if __name__ == '__main__':
    build()
    export_glb()
