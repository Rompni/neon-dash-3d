"""
Neon Dash 3D: iconos 3D de la interfaz (monedas, cofres y medallas) renderizados con EEVEE.

Salida en public/ui/ (WebP con alfa sin pérdida, ver public/ui/README.txt):
    coin, diamond, orb, star        24 fotogramas de 128x128 (giro completo sobre el eje vertical)
    chest_small, chest_big          12 fotogramas de 192x192 (cerrado -> tapa abriéndose -> abierto con luz)
    medal_bronze/silver/gold/locked 160x160, estáticas
    coin_big, diamond_big, orb_big  256x256, estáticas (pantallas de recompensa)

Cada icono se renderiza dos veces por fotograma, al doble de tamaño:
    f_XX.png  render normal (EEVEE, fondo transparente, luz de tres puntos y materiales emisivos)
    g_XX.png  pase de brillo: solo las partes de neón emiten, todo lo demás es negro mate
El paso "pack" (Python del sistema con Pillow y numpy) desenfoca el pase de brillo para crear un halo
tipo bloom, lo compone con el render, reduce a tamaño final, junta los fotogramas en una tira
horizontal y la guarda en WebP.

Uso sin interfaz (renderiza y luego llama a "python ... pack" automáticamente):
    blender-launcher.exe -b --python tools/blender/ui_icons.py -- [nombres...]
Solo empaquetar fotogramas ya renderizados:
    python tools/blender/ui_icons.py pack [nombres...]
Los fotogramas intermedios van a %TEMP%/neon_ui_frames (o a la carpeta de NEON_UI_FRAMES).
"""
import math, os, sys, json, tempfile, traceback, subprocess

try:
    import bpy, bmesh
    from mathutils import Vector, Euler
except ImportError:          # modo "pack" desde Python del sistema
    bpy = None

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'public', 'ui')
FRAMES = os.environ.get('NEON_UI_FRAMES') or os.path.join(tempfile.gettempdir(), 'neon_ui_frames')
LOG = os.path.join(FRAMES, 'log.txt')
SS = 2                       # supermuestreo: se renderiza al doble y se reduce al empaquetar

# paleta del juego (sRGB) -> lineal para Blender
def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)

CYAN, MAGENTA, GOLD, VIOLET = lin('27e3ff'), lin('ff3bd4'), lin('ffd23a'), lin('a98bff')

# trabajos: nombre -> (tipo, fotogramas, tamaño final, parámetros)
JOBS = {
    'coin':         dict(build='coin', frames=24, size=128, spin=True, fit=1.22, elev=12, glow=0.9),
    'diamond':      dict(build='diamond', frames=24, size=128, spin=True, fit=1.24, elev=16, glow=1.0, cz=0.04),
    'orb':          dict(build='orb', frames=24, size=128, spin=True, fit=1.2, elev=14, glow=1.0),
    'star':         dict(build='star', frames=24, size=128, spin=True, fit=1.2, elev=10, glow=0.8, cz=-0.03),
    'chest_small':  dict(build='chest_small', frames=12, size=192, chest=True, fit=1.36, elev=20, glow=0.9, cz=0.98),
    'chest_big':    dict(build='chest_big', frames=12, size=192, chest=True, fit=1.46, elev=20, glow=0.9, cz=1.02),
    'medal_bronze': dict(build='medal', tier='bronze', frames=1, size=160, fit=1.45, elev=6, glow=0.8, cz=-0.06, yaw=-16),
    'medal_silver': dict(build='medal', tier='silver', frames=1, size=160, fit=1.45, elev=6, glow=0.8, cz=-0.06, yaw=-16),
    'medal_gold':   dict(build='medal', tier='gold', frames=1, size=160, fit=1.45, elev=6, glow=0.8, cz=-0.06, yaw=-16),
    'medal_locked': dict(build='medal', tier='locked', frames=1, size=160, fit=1.45, elev=6, glow=0.6, cz=-0.06, yaw=-16),
    'coin_big':     dict(build='coin', frames=1, size=256, fit=1.2, elev=12, glow=0.9, yaw=-28),
    'diamond_big':  dict(build='diamond', frames=1, size=256, fit=1.22, elev=16, glow=1.0, cz=0.04, yaw=-10),
    'orb_big':      dict(build='orb', frames=1, size=256, fit=1.18, elev=14, glow=1.0, yaw=0),
}


def log(*a):
    os.makedirs(FRAMES, exist_ok=True)
    with open(LOG, 'a', encoding='utf-8') as f:
        f.write(' '.join(str(x) for x in a) + '\n')


# =====================================================================================================
#                                          PARTE BLENDER
# =====================================================================================================
GLOW = {}   # nombre de material -> color de brillo (tupla), None (negro) o 'self' (se usa tal cual)


def mat(name, color, rough=0.3, metal=0.0, emit=0.0, coat=0.0, glow=None, emit_color=None, spec=0.5):
    """Material Principled; 'glow' es el color con el que aparece en el pase de brillo."""
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Specular IOR Level'].default_value = spec
    if emit:
        b.inputs['Emission Color'].default_value = (*(emit_color or color), 1)
        b.inputs['Emission Strength'].default_value = emit
    GLOW[m.name] = glow
    return m


def neon(name, color, strength=1.8, glow_k=1.0):
    """Tubo de neón: color saturado y emisión fuerte (con Standard no se quema a blanco)."""
    return mat(name, color, 0.25, 0.0, emit=strength, glow=tuple(c * glow_k for c in color))


def principled(m):
    return m.node_tree.nodes['Principled BSDF']


def facing_emission(m, inner, outer, strength, blend=0.35, noise=None):
    """Emisión según el ángulo de visión: 'inner' al mirar de frente, 'outer' en los bordes.
    Sirve para el brillo interior de la gema y el halo del orbe. 'noise' añade vetas que giran con el objeto."""
    nt = m.node_tree
    b = principled(m)
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = blend
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*inner, 1)
    ramp.color_ramp.elements[1].color = (*outer, 1)
    nt.links.new(lw.outputs['Facing'], ramp.inputs['Fac'])
    col = ramp.outputs['Color']
    if noise:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        nz = nt.nodes.new('ShaderNodeTexNoise')
        nz.inputs['Scale'].default_value = noise[0]
        nz.inputs['Detail'].default_value = 3.0
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
        r2 = nt.nodes.new('ShaderNodeValToRGB')
        r2.color_ramp.elements[0].position = 0.45
        r2.color_ramp.elements[1].position = 0.75
        r2.color_ramp.elements[0].color = (0, 0, 0, 1)
        r2.color_ramp.elements[1].color = (*noise[1], 1)
        nt.links.new(nz.outputs['Fac'], r2.inputs['Fac'])
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'ADD'
        mix.inputs['Factor'].default_value = 1.0
        nt.links.new(col, mix.inputs['A']); nt.links.new(r2.outputs['Color'], mix.inputs['B'])
        col = mix.outputs['Result']
    nt.links.new(col, b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = strength
    return m


def beam_material(name, color, strength=2.5):
    """Rayo de luz: emisión con transparencia que se desvanece hacia arriba y hacia los lados.
    Devuelve el material y el nodo Value que controla la intensidad (para animarla)."""
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1); em.inputs['Strength'].default_value = strength
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])

    def op(kind, a, b=None, v=None):
        n = nt.nodes.new('ShaderNodeMath'); n.operation = kind
        if isinstance(a, float):
            n.inputs[0].default_value = a
        else:
            nt.links.new(a, n.inputs[0])
        if b is not None:
            if isinstance(b, float):
                n.inputs[1].default_value = b
            else:
                nt.links.new(b, n.inputs[1])
        return n.outputs[0]
    # vertical: 1 abajo, 0 arriba (curva suave)
    up = op('POWER', op('SUBTRACT', 1.0, sep.outputs['Z']), 1.6)
    # horizontal: 1 en el centro del rayo, 0 en los bordes
    xs = op('ABSOLUTE', op('SUBTRACT', op('MULTIPLY', sep.outputs['X'], 2.0), 1.0))
    side = op('POWER', op('SUBTRACT', 1.0, xs), 1.8)
    val = nt.nodes.new('ShaderNodeValue'); val.outputs[0].default_value = 0.0
    fac = op('MINIMUM', op('MULTIPLY', op('MULTIPLY', up, side), val.outputs[0]), 1.0)
    nt.links.new(fac, mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    try:
        m.surface_render_method = 'BLENDED'
    except Exception:
        pass
    GLOW[m.name] = 'self'
    return m, val


# ---------------------------------------------------------------- geometría
def link(o, parent, m):
    bpy.context.scene.collection.objects.link(o)
    o.parent = parent
    if m:
        o.data.materials.append(m)
    return o


def from_bm(name, bm, parent, m, smooth=False):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    return link(bpy.data.objects.new(name, me), parent, m)


def bevel(o, w, seg=3, harden=True, angle=40):
    md = o.modifiers.new('Bisel', 'BEVEL')
    md.width = w; md.segments = seg; md.limit_method = 'ANGLE'
    md.angle_limit = math.radians(angle)
    md.harden_normals = harden
    if harden:
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def empty(name, parent=None, loc=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(o)
    o.parent = parent; o.location = loc
    return o


def poly(n, R, a0=90.0):
    return [(R * math.cos(math.radians(a0 + i * 360 / n)), R * math.sin(math.radians(a0 + i * 360 / n))) for i in range(n)]


def star_pts(Ro, Ri, n=5):
    pts = []
    for i in range(2 * n):
        a = math.radians(90 + i * 180 / n)
        r = Ro if i % 2 == 0 else Ri
        pts.append((r * math.cos(a), r * math.sin(a)))
    return pts


def prism(name, pts, y0, y1, parent, m, bev=0.0, seg=3, loc=(0, 0, 0), rot=(0, 0, 0)):
    """Polígono en el plano XZ extruido a lo largo de Y (de y0 a y1). La cara frontal mira a -Y."""
    bm = bmesh.new()
    f = [bm.verts.new((x, y0, z)) for x, z in pts]
    b = [bm.verts.new((x, y1, z)) for x, z in pts]
    bm.faces.new(f); bm.faces.new(b[::-1])
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((f[i], f[j], b[j], b[i]))
    o = from_bm(name, bm, parent, m)
    o.location = loc; o.rotation_euler = rot
    if bev:
        bevel(o, bev, seg)
    return o


def ring_prism(name, outer, inner, y0, y1, parent, m, bev=0.0, seg=2, loc=(0, 0, 0)):
    """Marco: anillo entre dos polígonos (mismo número de vértices) extruido en Y."""
    bm = bmesh.new()
    of = [bm.verts.new((x, y0, z)) for x, z in outer]
    ob = [bm.verts.new((x, y1, z)) for x, z in outer]
    inf = [bm.verts.new((x, y0, z)) for x, z in inner]
    ib = [bm.verts.new((x, y1, z)) for x, z in inner]
    n = len(outer)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((of[i], of[j], inf[j], inf[i]))
        bm.faces.new((ob[i], ib[i], ib[j], ob[j]))
        bm.faces.new((of[i], ob[i], ob[j], of[j]))
        bm.faces.new((inf[i], inf[j], ib[j], ib[i]))
    o = from_bm(name, bm, parent, m)
    o.location = loc
    if bev:
        bevel(o, bev, seg)
    return o


def faceted_star(name, Ro, Ri, rim0, rim1, apex0, apex1, parent, m, bev=0.02, loc=(0, 0, 0)):
    """Estrella de 5 puntas facetada: aristas en relieve desde el centro (apex) hasta cada punta."""
    pts = star_pts(Ro, Ri)
    bm = bmesh.new()
    a = bm.verts.new((0, apex0, 0)); z = bm.verts.new((0, apex1, 0))
    f = [bm.verts.new((x, rim0, y)) for x, y in pts]
    b = [bm.verts.new((x, rim1, y)) for x, y in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a, f[i], f[j]))
        bm.faces.new((z, b[j], b[i]))
        bm.faces.new((f[i], b[i], b[j], f[j]))
    o = from_bm(name, bm, parent, m)
    o.location = loc
    if bev:
        bevel(o, bev, 2, harden=False, angle=10)
        for p in o.data.polygons:
            p.use_smooth = False
    return o


def box(name, size, loc, parent, m, bev=0.0, seg=3, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    o = from_bm(name, bm, parent, m)
    o.location = loc; o.rotation_euler = rot
    if bev:
        bevel(o, bev, seg)
    return o


def uvsphere(name, r, loc, parent, m, scale=(1, 1, 1), seg=48, rings=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    o = from_bm(name, bm, parent, m, smooth=True)
    o.location = loc; o.scale = scale
    return o


def cylinder(name, r, depth, loc, parent, m, axis='Z', seg=32, bev=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=depth)
    o = from_bm(name, bm, parent, m, smooth=True)
    o.location = loc
    if axis == 'X':
        o.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'Y':
        o.rotation_euler = (math.pi / 2, 0, 0)
    if bev:
        bevel(o, bev, 2)
    return o


def torus(name, R, r, parent, m, seg=96, rseg=12, arc=2 * math.pi, loc=(0, 0, 0), rot=(0, 0, 0)):
    """Toro en el plano XY (eje Z). Con arc < 2*pi queda un arco abierto."""
    closed = arc >= 2 * math.pi - 1e-6
    bm = bmesh.new()
    nu = seg if closed else seg + 1
    rows = []
    for i in range(nu):
        u = arc * i / seg
        c, s = math.cos(u), math.sin(u)
        row = []
        for j in range(rseg):
            v = 2 * math.pi * j / rseg
            rr = R + r * math.cos(v)
            row.append(bm.verts.new((rr * c, rr * s, r * math.sin(v))))
        rows.append(row)
    for i in range(seg if closed else seg):
        i2 = (i + 1) % nu
        for j in range(rseg):
            j2 = (j + 1) % rseg
            bm.faces.new((rows[i][j], rows[i2][j], rows[i2][j2], rows[i][j2]))
    o = from_bm(name, bm, parent, m, smooth=True)
    o.location = loc; o.rotation_euler = rot
    return o


def chevron(c, h, s):
    """Contorno de un chevrón '>' con la punta en x = c (brazos a 45 grados, grosor horizontal s)."""
    return [(c - h, h), (c, 0), (c - h, -h), (c - h - s, -h), (c - s, 0), (c - h - s, h)]


def logo_pts(scale=1.0, mirror=False):
    """El logo del juego, '>>': dos chevrones centrados en el origen.
    Con mirror=True se refleja en X (para la cara trasera, que se ve girada 180 grados)."""
    h, s, gap = 0.30 * scale, 0.17 * scale, 0.32 * scale
    shift = -(gap - (h + s)) / 2
    out = []
    for c in (0.0, gap):
        pts = [(x + shift, z) for x, z in chevron(c, h, s)]
        if mirror:
            pts = [(-x, z) for x, z in pts][::-1]
        out.append(pts)
    return out


# ---------------------------------------------------------------- escena: luces, cámara, mundo
def setup_scene(size, fit, elev, cz=0.0):
    bpy.ops.wm.read_homefile(use_empty=True)
    GLOW.clear()
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x = sc.render.resolution_y = size * SS
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.color_depth = '8'
    sc.view_settings.view_transform = 'Standard'
    try:
        sc.view_settings.look = 'None'
    except Exception:
        pass
    sc.view_settings.exposure = 0.0
    ee = sc.eevee
    ee.taa_render_samples = 64
    try:
        ee.use_raytracing = True
        ee.ray_tracing_options.resolution_scale = '1'
    except Exception:
        pass
    try:
        ee.use_fast_gi = True
    except Exception:
        pass

    # mundo: degradado oscuro abajo y claro arriba, solo para que los metales tengan algo que reflejar
    w = bpy.data.worlds.new('Mundo'); sc.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    bg = nt.nodes['Background']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = -1.0; mr.inputs['From Max'].default_value = 1.0
    nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
    els = ramp.color_ramp.elements
    els[0].position = 0.1; els[0].color = (0.025, 0.018, 0.055, 1)
    els[1].position = 0.95; els[1].color = (0.7, 0.7, 0.8, 1)
    mid = els.new(0.5); mid.color = (0.11, 0.08, 0.2, 1)
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 1.0

    target = Vector((0, 0, cz))

    def aim(o, frm):
        o.location = frm
        o.rotation_euler = (target - Vector(frm)).to_track_quat('-Z', 'Y').to_euler()

    def area(name, frm, energy, color, sz):
        L = bpy.data.lights.new(name, 'AREA')
        L.energy = energy; L.color = color; L.size = sz
        o = bpy.data.objects.new(name, L); sc.collection.objects.link(o)
        aim(o, frm)
        return o

    # tres puntos: principal cálida arriba a la izquierda, relleno frío a la derecha,
    # y dos contraluces de neón (magenta y cian) para recortar la silueta sobre el fondo oscuro
    area('Principal', (-4.5, -7.0, 6.0), 1400, (1.0, 0.96, 0.9), 4.0)
    area('Relleno', (6.5, -5.0, 1.0), 450, (0.75, 0.88, 1.0), 5.0)
    area('Contra_magenta', (5.0, 6.0, 3.5), 1600, (1.0, 0.35, 0.85), 3.0)
    area('Contra_cian', (-5.5, 5.5, 2.0), 1200, (0.3, 0.85, 1.0), 3.0)

    cam = bpy.data.objects.new('Camara', bpy.data.cameras.new('Camara'))
    sc.collection.objects.link(cam)
    cam.data.lens = 85; cam.data.sensor_width = 36
    half = math.atan(18 / 85)
    d = fit / math.tan(half)
    e = math.radians(elev)
    aim(cam, (0, -d * math.cos(e), cz + d * math.sin(e)))
    cam.data.clip_end = 100
    sc.camera = cam
    return sc


# ---------------------------------------------------------------- modelos
def build_coin(root, jd):
    gold = mat('oro', (1.0, 0.66, 0.14), 0.24, 0.8, coat=0.7, emit=0.18, emit_color=(1.0, 0.6, 0.12))
    deep = mat('oro_oscuro', (0.36, 0.10, 0.006), 0.38, 1.0, coat=0.5)
    shine = mat('oro_logo', (1.0, 0.78, 0.25), 0.16, 1.0, coat=0.8, emit=0.55, emit_color=(1.0, 0.7, 0.2),
                glow=(0.35, 0.22, 0.04))
    rim = neon('neon_cian', CYAN, 1.8)
    R = 1.0
    prism('moneda_cuerpo', poly(6, R), -0.12, 0.12, root, deep, bev=0.05)
    ring_prism('moneda_marco', poly(6, R * 0.985), poly(6, 0.77), -0.165, 0.165, root, gold, bev=0.03)
    ring_prism('moneda_neon', poly(6, 0.77), poly(6, 0.71), -0.138, 0.138, root, rim)
    for side, (y0, y1, mir) in enumerate(((-0.19, -0.11, False), (0.11, 0.19, True))):
        for k, pts in enumerate(logo_pts(1.06, mir)):
            prism(f'moneda_logo{side}{k}', pts, y0, y1, root, shine, bev=0.022, seg=2)
    return None


def build_diamond(root, jd):
    """Gema talla brillante estilizada: las facetas alternan tonos (claro / medio / oscuro) como en los
    iconos de gemas de juegos, y una emisión según el ángulo de visión da el brillo interior."""
    def gem(name, base, inner, outer, k):
        m = mat(name, base, 0.04, 0.55, coat=1.0, spec=1.0)
        facing_emission(m, inner, outer, k, blend=0.55)
        GLOW[m.name] = tuple(c * 0.5 for c in CYAN)
        return m
    mats = [
        gem('gema_mesa', (0.10, 0.65, 1.0), (0.25, 0.95, 1.0), (0.02, 0.35, 0.8), 0.55),
        gem('gema_corona_a', (0.05, 0.55, 1.0), (0.12, 0.85, 1.0), (0.0, 0.2, 0.6), 0.55),
        gem('gema_corona_b', (0.0, 0.32, 0.85), (0.02, 0.55, 1.0), (0.0, 0.08, 0.35), 0.45),
        gem('gema_filetin', (0.0, 0.25, 0.7), (0.0, 0.45, 0.9), (0.0, 0.05, 0.25), 0.4),
        gem('gema_pab_a', (0.0, 0.28, 0.8), (0.02, 0.6, 1.0), (0.0, 0.06, 0.3), 0.5),
        gem('gema_pab_b', (0.0, 0.12, 0.45), (0.0, 0.3, 0.75), (0.0, 0.02, 0.15), 0.4),
    ]
    bm = bmesh.new()

    def ring(n, r, z, a0):
        return [bm.verts.new((r * math.cos(math.radians(a0 + i * 360 / n)),
                              r * math.sin(math.radians(a0 + i * 360 / n)), z)) for i in range(n)]

    def face(vs, mi):
        bm.faces.new(vs).material_index = mi
    T = ring(8, 0.56, 0.52, 0)           # mesa
    G1 = ring(16, 1.0, 0.16, 0)          # filetín arriba
    G0 = ring(16, 1.0, 0.06, 0)          # filetín abajo
    P = ring(8, 0.52, -0.42, 22.5)       # pabellón intermedio
    apex = bm.verts.new((0, 0, -1.02))
    face(T, 0)
    for i in range(8):
        t0, t1 = T[i], T[(i + 1) % 8]
        g0, g1, g2 = G1[2 * i], G1[2 * i + 1], G1[(2 * i + 2) % 16]
        face((t0, g0, g1), 2); face((t0, g1, t1), 1); face((t1, g1, g2), 2)
    for i in range(16):
        j = (i + 1) % 16
        face((G1[i], G0[i], G0[j], G1[j]), 3)
    for i in range(8):
        p0, p1 = P[(i - 1) % 8], P[i]
        a, b, c = G0[2 * i], G0[2 * i + 1], G0[(2 * i + 2) % 16]
        face((a, p0, b), 5); face((b, p0, p1), 4); face((b, p1, c), 5)
        face((p0, apex, p1), 4 if i % 2 else 5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new('diamante')
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('diamante', me)
    bpy.context.scene.collection.objects.link(o)
    o.parent = root
    for m in mats:
        me.materials.append(m)
    o.location = (0, 0, 0.18)
    return None


def build_orb(root, jd):
    core = mat('orbe', (0.05, 0.01, 0.26), 0.35, 0.0, coat=0.6, spec=0.3)
    facing_emission(core, (0.07, 0.01, 0.36), (0.42, 0.14, 1.0), 1.0, blend=0.22,
                    noise=(2.6, (0.18, 0.04, 0.6)))
    GLOW[core.name] = tuple(c * 0.1 for c in VIOLET)
    ringm = neon('anillo', (0.36, 0.18, 1.0), 1.5)
    bead_m = neon('cuenta_magenta', MAGENTA, 1.8)
    bead_c = neon('cuenta_cian', CYAN, 1.8)
    uvsphere('orbe', 0.70, (0, 0, 0), root, core)
    tilt = empty('orbe_inclinacion', root)
    tilt.rotation_euler = (math.radians(-24), math.radians(16), 0)
    torus('orbe_anillo', 1.06, 0.03, tilt, ringm, seg=128, rseg=10)
    spin = empty('orbe_cuentas', tilt)
    uvsphere('cuenta_a', 0.075, (1.06, 0, 0), spin, bead_m, seg=16, rings=8)
    uvsphere('cuenta_b', 0.06, (-1.06, 0, 0), spin, bead_c, seg=16, rings=8)
    return spin


def build_star(root, jd):
    gold = mat('oro', (1.0, 0.62, 0.10), 0.2, 1.0, coat=0.7)
    rim = neon('neon_magenta', MAGENTA, 1.8)
    faceted_star('estrella', 1.0, 0.47, -0.12, 0.12, -0.36, 0.36, root, gold, bev=0.025)
    po = [(x * 1.03, z * 1.03) for x, z in star_pts(1.0, 0.47)]
    pi = [(x * 0.97, z * 0.97) for x, z in star_pts(1.0, 0.47)]
    ring_prism('estrella_neon', po, pi, -0.035, 0.035, root, rim)
    return None


# --------------------------------------------- cofres
def lid_profile(D, Hl, delta=0.0, n=18):
    """Perfil (y, z) de la tapa curva relativo a la bisagra (borde trasero superior del cuerpo)."""
    a, b = D / 2 + delta, Hl + delta
    pts = [(-D / 2 - a * math.cos(math.pi * i / n), b * math.sin(math.pi * i / n)) for i in range(n + 1)]
    return pts


def extrude_x(name, prof, x0, x1, parent, m, bev=0.0, smooth=True, bottom=None):
    """Extruye el perfil a lo largo de X. 'bottom' es el material de la cara plana inferior
    (la que cierra el perfil): en la tapa es el interior del cofre."""
    bm = bmesh.new()
    L = [bm.verts.new((x0, y, z)) for y, z in prof]
    R = [bm.verts.new((x1, y, z)) for y, z in prof]
    bm.faces.new(L); bm.faces.new(R[::-1])
    n = len(prof)
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((L[i], L[j], R[j], R[i]))
        f.smooth = smooth
        if bottom is not None and i == n - 1:
            f.material_index = 1
    o = from_bm(name, bm, parent, m)
    if bottom is not None:
        o.data.materials.append(bottom)
    for p in o.data.polygons:
        p.use_smooth = smooth and p.normal.x * p.normal.x < 0.5
    if bev:
        bevel(o, bev, 3)
    return o


def build_chest(root, jd, big):
    if big:
        W, D, H, Hl = 1.8, 1.08, 0.92, 0.46
        panel = mat('cofre_panel', (1.0, 0.56, 0.08), 0.28, 0.65, coat=0.7)
        trim = mat('cofre_borde', (0.035, 0.05, 0.13), 0.22, 0.7, coat=0.8)
        stud = mat('cofre_remache', (1.0, 0.75, 0.3), 0.18, 1.0)
        ncol, lcol = CYAN, (0.25, 0.85, 1.0)
        treas = mat('tesoro', (1.0, 0.6, 0.1), 0.3, 1.0, emit=1.0, emit_color=(1.0, 0.62, 0.12), glow=(0.45, 0.32, 0.06))
    else:
        W, D, H, Hl = 1.5, 0.95, 0.82, 0.40
        panel = mat('cofre_panel', (0.34, 0.36, 0.45), 0.3, 0.6, coat=0.6)
        trim = mat('cofre_borde', (0.07, 0.065, 0.11), 0.28, 0.8, coat=0.5)
        stud = mat('cofre_remache', (0.75, 0.76, 0.82), 0.2, 1.0)
        ncol, lcol = (0.2, 0.07, 1.0), (0.32, 0.18, 1.0)
        treas = mat('tesoro', (0.25, 0.1, 1.0), 0.3, 0.2, emit=1.0, emit_color=(0.3, 0.14, 1.0), glow=(0.16, 0.07, 0.5))
    nm = neon('cofre_neon', ncol, 1.8)
    inside = mat('cofre_interior', (0.02, 0.02, 0.04), 0.6, 0.0, emit=0.0, emit_color=lcol, glow=None)

    # cuerpo hueco (caja sin tapa con grosor hacia dentro)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(W, D, H), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0, 0, H / 2), verts=bm.verts)
    top = [f for f in bm.faces if f.normal.z > 0.9]
    bmesh.ops.delete(bm, geom=top, context='FACES')
    body = from_bm('cofre_cuerpo', bm, root, panel)
    body.data.materials.append(inside)
    sol = body.modifiers.new('Grosor', 'SOLIDIFY'); sol.thickness = 0.08; sol.offset = -1
    sol.material_offset = 1          # la cara interior usa el material del interior
    bevel(body, 0.025, 3)

    # tesoro brillante dentro y luz puntual que se enciende al abrir
    uvsphere('cofre_tesoro', 0.5, (0, 0, H * 0.62), root, treas, scale=(W * 0.82, D * 0.75, 0.42))
    PL = bpy.data.lights.new('luz_cofre', 'POINT'); PL.energy = 0; PL.color = lcol; PL.shadow_soft_size = 0.3
    pl = bpy.data.objects.new('luz_cofre', PL); bpy.context.scene.collection.objects.link(pl)
    pl.parent = root; pl.location = (0, -0.1, H * 0.78)
    # monedas y gemas asomando del montón (posiciones fijas, pseudoaleatorias)
    import random
    rnd = random.Random(7 if big else 3)
    coin_m = mat('tesoro_moneda', (1.0, 0.62, 0.1) if big else (0.8, 0.82, 0.9), 0.2, 1.0, coat=0.6,
                 emit=0.25, emit_color=(1.0, 0.6, 0.1) if big else (0.5, 0.4, 1.0))
    gem_m = mat('tesoro_gema', CYAN if big else (0.3, 0.1, 1.0), 0.1, 0.3, coat=1.0, emit=0.8)
    for k in range(9 if big else 6):
        x = rnd.uniform(-0.36, 0.36) * W; y = rnd.uniform(-0.28, 0.28) * D
        r2 = (x / (W * 0.41)) ** 2 + (y / (D * 0.375)) ** 2
        z = H * 0.62 + 0.21 * math.sqrt(max(0.0, 1 - r2)) - 0.01
        c = cylinder(f'tesoro_moneda{k}', 0.1, 0.03, (x, y, z), root, coin_m, seg=6)
        c.rotation_euler = (rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), rnd.uniform(0, 1))
    for k in range(3 if big else 2):
        x = rnd.uniform(-0.3, 0.3) * W; y = rnd.uniform(-0.2, 0.2) * D
        g = uvsphere(f'tesoro_gema{k}', 0.09, (x, y, H * 0.62 + 0.17), root, gem_m, seg=6, rings=3)
        for p in g.data.polygons:
            p.use_smooth = False
        g.rotation_euler = (rnd.uniform(0, 1), rnd.uniform(0, 1), 0)

    # bordes: marco superior, esquinas, bandas verticales, remaches, cerradura
    t = 0.07
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(f'esquina{sx}{sy}', (0.13, 0.13, H + 0.02), (sx * (W / 2 - 0.045), sy * (D / 2 - 0.045), H / 2), root, trim, bev=0.025)
            box(f'pie{sx}{sy}', (0.17, 0.17, 0.06), (sx * (W / 2 - 0.05), sy * (D / 2 - 0.05), 0.02), root, trim, bev=0.02)
    for sy in (-1, 1):
        box(f'borde_y{sy}', (W + 0.02, t, t), (0, sy * (D / 2 - t / 2 + 0.01), H - t / 2), root, trim, bev=0.02)
    for sx in (-1, 1):
        box(f'borde_x{sx}', (t, D + 0.02, t), (sx * (W / 2 - t / 2 + 0.01), 0, H - t / 2), root, trim, bev=0.02)
    bx = W * 0.3
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(f'banda{sx}{sy}', (0.14, 0.035, H), (sx * bx, sy * (D / 2 + 0.012), H / 2), root, trim, bev=0.012)
            for zz in (H * 0.25, H * 0.62):
                cylinder(f'remache{sx}{sy}{zz:.2f}', 0.03, 0.03, (sx * bx, sy * (D / 2 + 0.032), zz), root, stud, axis='Y', seg=16)
    # tira de neón bajo el borde delantero y en las bandas
    box('neon_frente', (W - 0.2, 0.02, 0.03), (0, -D / 2 - 0.012, H - 0.11), root, nm)
    for sx in (-1, 1):
        box(f'neon_banda{sx}', (0.028, 0.02, H * 0.72), (sx * bx, -D / 2 - 0.03, H * 0.42), root, nm)
    # cerradura
    box('cerradura', (0.32, 0.05, 0.34), (0, -D / 2 - 0.03, H - 0.24), root, trim, bev=0.03)
    box('cerradura_marco', (0.36, 0.04, 0.38), (0, -D / 2 - 0.018, H - 0.24), root, stud, bev=0.02)
    cylinder('ojo_cerradura', 0.045, 0.03, (0, -D / 2 - 0.058, H - 0.2), root, nm, axis='Y', seg=20)
    box('ojo_cerradura_b', (0.035, 0.03, 0.09), (0, -D / 2 - 0.058, H - 0.26), root, nm)

    # tapa (pivota sobre la bisagra trasera)
    hinge = empty('cofre_bisagra', root, (0, D / 2, H))
    prof = lid_profile(D, Hl, 0.015)
    extrude_x('tapa', prof, -W / 2 - 0.015, W / 2 + 0.015, hinge, panel, bev=0.02, bottom=inside)
    profb = lid_profile(D, Hl, 0.045)
    for sx in (-1, 1):
        extrude_x(f'tapa_banda{sx}', profb, sx * bx - 0.07, sx * bx + 0.07, hinge, trim, bev=0.012)
        extrude_x(f'tapa_borde{sx}', profb, sx * (W / 2 + 0.03) - 0.05, sx * (W / 2 + 0.03) + 0.05, hinge, trim, bev=0.015)
    # tiras de neón en el arco de la tapa, sobre las bandas (siguen a las del cuerpo)
    profn = lid_profile(D, Hl, 0.058)
    for sx in (-1, 1):
        extrude_x(f'tapa_neon{sx}', profn, sx * bx - 0.014, sx * bx + 0.014, hinge, nm, smooth=True)
    box('tapa_labio', (W + 0.04, 0.05, 0.06), (0, -D - 0.025, 0.03), hinge, trim, bev=0.02)
    box('tapa_neon_frente', (W - 0.2, 0.02, 0.026), (0, -D - 0.055, 0.03), hinge, nm)

    # rayos de luz saliendo del cofre (planos de cara a la cámara)
    bmat, bval = beam_material('rayo', lcol, 1.3)
    beams = empty('rayos', root, (0, 0, H - 0.05))
    rays = [(-0.5, 1.1, -18, 0.16), (-0.3, 1.45, -9, 0.13), (-0.1, 1.6, -3, 0.15), (0.1, 1.5, 4, 0.12),
            (0.3, 1.35, 10, 0.15), (0.5, 1.05, 17, 0.13), (0.0, 1.25, 0, 0.6)]
    for k, (x, hgt, ang, wb) in enumerate(rays):
        bm = bmesh.new()
        wt = wb * 2.2
        vs = [bm.verts.new(p) for p in ((-wb / 2, 0, 0), (wb / 2, 0, 0), (wt / 2, 0, hgt), (-wt / 2, 0, hgt))]
        bm.faces.new(vs)
        o = from_bm(f'rayo{k}', bm, beams, bmat)
        o.location = (x * W / 1.6, -0.05 * k, 0); o.rotation_euler = (0, math.radians(ang), 0)

    em_nodes = [principled(treas)]
    lid_angles = [0, 0, -6, 14, 38, 64, 88, 108, 101, 104, 104, 104]
    light = [0, 0, 0.12, 0.3, 0.5, 0.7, 0.9, 1.0, 1.0, 1.1, 1.0, 1.05]
    beam = [0, 0, 0.0, 0.05, 0.2, 0.45, 0.7, 0.9, 1.0, 1.05, 0.95, 1.0]
    # el cofre cerrado "salta" un poco antes de abrirse
    hop = [0, 0.04, 0.02, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    def anim(i):
        hinge.rotation_euler = (math.radians(-lid_angles[i]), 0, 0)
        for b in em_nodes:
            b.inputs['Emission Strength'].default_value = 0.3 + 1.3 * light[i]
        PL.energy = 30 * light[i]
        bval.outputs[0].default_value = 0.75 * beam[i]
        beams.hide_render = beam[i] <= 0
        root.location.z = hop[i]
    return anim


# --------------------------------------------- medallas
TIERS = {
    #           metal                        neón     cinta (lados)          cinta (centro)
    'bronze': ((0.62, 0.22, 0.07), 0.28, VIOLET, (0.22, 0.10, 0.55), (0.75, 0.62, 1.0)),
    'silver': ((0.82, 0.85, 0.92), 0.18, CYAN, (0.02, 0.22, 0.45), (0.5, 0.95, 1.0)),
    'gold':   ((1.00, 0.72, 0.16), 0.2, MAGENTA, (0.45, 0.02, 0.28), (1.0, 0.45, 0.85)),
    'locked': ((0.055, 0.055, 0.07), 0.4, None, (0.035, 0.035, 0.045), (0.08, 0.08, 0.1)),
}


def build_medal(root, jd):
    tier = jd['tier']
    mcol, rough, ncol, rside, rmid = TIERS[tier]
    locked = tier == 'locked'
    metal = mat('medalla', mcol, rough, 1.0 if not locked else 0.6, coat=0.6)
    deep = mat('medalla_fondo', tuple(c * 0.45 for c in mcol), rough + 0.1, 1.0 if not locked else 0.5, coat=0.4)
    nm = neon('medalla_neon', ncol, 1.8) if ncol else mat('medalla_neon', (0.09, 0.09, 0.11), 0.4, 0.3)
    rs = mat('cinta', rside, 0.55, 0.0, coat=0.3)
    rm = mat('cinta_centro', rmid, 0.5, 0.0, coat=0.3, emit=0.0 if locked else 0.35, emit_color=rmid)

    med = empty('medalla', root, (0, 0, -0.42))
    R = 1.0
    prism('medalla_cuerpo', poly(6, R, 0), -0.1, 0.1, med, deep, bev=0.05)
    ring_prism('medalla_marco', poly(6, R * 0.985, 0), poly(6, 0.78, 0), -0.15, 0.15, med, metal, bev=0.03)
    ring_prism('medalla_linea', poly(6, 0.78, 0), poly(6, 0.73, 0), -0.123, 0.123, med, nm)
    faceted_star('medalla_estrella', 0.56, 0.25, -0.13, 0.0, -0.3, 0.0, med, metal, bev=0.018)
    # remaches en las esquinas del marco
    for k, (x, z) in enumerate(poly(6, 0.885, 0)):
        cylinder(f'remache{k}', 0.035, 0.03, (x, -0.165, z), med, deep if not locked else metal, axis='Y', seg=16)

    # cinta en V detrás de la medalla
    top = R * math.sin(math.radians(60))
    rib = empty('cinta', med, (0, 0.14, top - 0.12))
    L, Wd = 1.08, 0.46
    for s in (-1, 1):
        st = empty(f'cinta{s}', rib)
        a = math.radians(21 * s)
        st.rotation_euler = (math.radians(-8), a, 0)
        for k, (dx, w, m) in enumerate(((-Wd / 3, Wd / 3, rs), (0, Wd / 3, rm), (Wd / 3, Wd / 3, rs))):
            box(f'cinta{s}_{k}', (w + 0.002, 0.03, L), (dx, 0.02 * s, L / 2), st, m, bev=0.004, seg=1)
    # pasador entre la cinta y la medalla
    cylinder('pasador', 0.06, 0.52, (0, 0.02, top + 0.02), med, metal, axis='X', seg=24, bev=0.015)

    if locked:
        steel = mat('candado', (0.46, 0.48, 0.55), 0.28, 1.0, coat=0.5)
        dark = mat('candado_ojo', (0.01, 0.01, 0.015), 0.5, 0.0)
        lk = empty('candado', med, (0, -0.42, -0.12))
        box('candado_cuerpo', (0.74, 0.24, 0.58), (0, 0, 0), lk, steel, bev=0.07)
        torus('candado_arco', 0.22, 0.06, lk, steel, seg=48, rseg=12, arc=math.pi,
              loc=(0, 0.0, 0.29), rot=(math.pi / 2, 0, 0))
        cylinder('candado_pata_a', 0.06, 0.12, (-0.22, 0, 0.30), lk, steel, seg=16)
        cylinder('candado_pata_b', 0.06, 0.12, (0.22, 0, 0.30), lk, steel, seg=16)
        cylinder('candado_ojo', 0.065, 0.03, (0, -0.125, 0.06), lk, dark, axis='Y', seg=24)
        box('candado_ranura', (0.05, 0.03, 0.16), (0, -0.125, -0.04), lk, dark)
    return None


BUILDERS = {
    'coin': build_coin, 'diamond': build_diamond, 'orb': build_orb, 'star': build_star,
    'chest_small': lambda r, j: build_chest(r, j, False), 'chest_big': lambda r, j: build_chest(r, j, True),
    'medal': build_medal,
}


# ---------------------------------------------------------------- render
def glow_materials():
    """Copia de cada material para el pase de brillo: neón emite su color, el resto es negro mate."""
    cache = {}
    for m in list(bpy.data.materials):
        g = GLOW.get(m.name)
        if g == 'self':
            cache[m.name] = m; continue
        gm = bpy.data.materials.new('brillo_' + m.name)
        try:
            gm.use_nodes = True
        except Exception:
            pass
        b = gm.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (0, 0, 0, 1)
        b.inputs['Roughness'].default_value = 1.0
        b.inputs['Specular IOR Level'].default_value = 0.0
        b.inputs['Coat Weight'].default_value = 0.0
        if g:
            b.inputs['Emission Color'].default_value = (*g, 1)
            b.inputs['Emission Strength'].default_value = 1.0
        cache[m.name] = gm
    return cache


def set_materials(mapping):
    """Cambia los materiales de todos los objetos (y del offset del solidify) según mapping."""
    for o in bpy.context.scene.objects:
        if o.type != 'MESH':
            continue
        for i, m in enumerate(o.data.materials):
            if m and m.name in mapping:
                o.data.materials[i] = mapping[m.name]


def render_job(name):
    jd = JOBS[name]
    size, frames = jd['size'], jd['frames']
    sc = setup_scene(size, jd['fit'], jd['elev'], jd.get('cz', 0.0))
    root = empty('raiz')
    yaw = empty('giro', root)
    extra = BUILDERS[jd['build']](yaw, jd)
    if not jd.get('chest') and jd.get('yaw') is not None:
        yaw.rotation_euler.z = math.radians(jd['yaw'])
    if jd.get('chest'):
        yaw.rotation_euler.z = math.radians(-24)

    def pose(i):
        if jd.get('spin'):
            yaw.rotation_euler.z = 2 * math.pi * i / frames
            if extra is not None:
                # cuentas del orbe: una vuelta extra sobre el anillo en cada bucle
                extra.rotation_euler.z = 2 * math.pi * i / frames
        elif callable(extra):
            extra(i)

    d = os.path.join(FRAMES, name)
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        os.remove(os.path.join(d, f))
    for i in range(frames):
        pose(i)
        sc.render.filepath = os.path.join(d, f'f_{i:02d}.png')
        bpy.ops.render.render(write_still=True)
    # pase de brillo: sin luces ni mundo, solo emisión del neón
    gm = glow_materials()
    originals = {v.name: bpy.data.materials[k] for k, v in gm.items()}
    set_materials(gm)
    for o in sc.objects:
        if o.type == 'LIGHT':
            o.hide_render = True
    sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0
    for i in range(frames):
        pose(i)
        sc.render.filepath = os.path.join(d, f'g_{i:02d}.png')
        bpy.ops.render.render(write_still=True)
    with open(os.path.join(d, 'info.json'), 'w') as f:
        json.dump(dict(frames=frames, size=size, glow=jd.get('glow', 1.0)), f)
    log('ok', name, frames, 'fotogramas')


def blender_main(names):
    os.makedirs(FRAMES, exist_ok=True)
    open(LOG, 'w').close()
    log('Blender', bpy.app.version_string, '->', FRAMES)
    for n in names:
        try:
            render_job(n)
        except Exception:
            log('ERROR', n, traceback.format_exc())
    try:
        r = subprocess.run(['python', os.path.abspath(__file__), 'pack'] + names, capture_output=True, text=True)
        log('pack:', r.returncode, r.stdout, r.stderr)
    except Exception as e:
        log('no se pudo lanzar el empaquetado (ejecuta "python tools/blender/ui_icons.py pack"):', e)


# =====================================================================================================
#                                  PARTE EMPAQUETADO (Pillow + numpy)
# =====================================================================================================
def compose(fpath, gpath, strength):
    """Render + halo: el pase de brillo desenfocado se pone detrás (halo fuera de la silueta)
    y se suma un poco encima (bloom sobre las partes de neón). Trabaja con alfa premultiplicado."""
    import numpy as np
    from PIL import Image, ImageFilter
    base = np.asarray(Image.open(fpath).convert('RGBA'), dtype=np.float32) / 255
    gimg = Image.open(gpath).convert('RGBA')
    g = np.asarray(gimg, dtype=np.float32) / 255
    gp = g[..., :3] * g[..., 3:4]
    W = base.shape[1]
    src = Image.fromarray((np.clip(gp, 0, 1) * 255).astype(np.uint8), 'RGB')
    b1 = np.asarray(src.filter(ImageFilter.GaussianBlur(W * 0.012)), dtype=np.float32) / 255
    b2 = np.asarray(src.filter(ImageFilter.GaussianBlur(W * 0.04)), dtype=np.float32) / 255
    halo = (b1 * 1.1 + b2 * 1.6) * strength
    ha = np.clip(halo.max(axis=2, keepdims=True), 0, 1)
    hc = np.clip(halo, 0, 1)
    a = base[..., 3:4]
    cb = base[..., :3] * a
    c = cb + hc * (1 - a)
    out_a = a + ha * (1 - a)
    # bloom encima (modo trama), solo un toque
    over = np.clip(b1 * 0.35 * strength, 0, 1) * a
    c = 1 - (1 - c) * (1 - over)
    c = np.minimum(c, out_a)
    rgb = np.where(out_a > 1e-4, c / np.maximum(out_a, 1e-4), 0)
    arr = np.concatenate([rgb, out_a], axis=2)
    img = Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
    return img


def pack(names):
    from PIL import Image
    os.makedirs(OUT, exist_ok=True)
    for n in names:
        d = os.path.join(FRAMES, n)
        info = json.load(open(os.path.join(d, 'info.json')))
        fr, size = info['frames'], info['size']
        strip = Image.new('RGBA', (size * fr, size), (0, 0, 0, 0))
        for i in range(fr):
            img = compose(os.path.join(d, f'f_{i:02d}.png'), os.path.join(d, f'g_{i:02d}.png'), info['glow'])
            img = img.convert('RGBa').resize((size, size), Image.LANCZOS).convert('RGBA')
            strip.paste(img, (i * size, 0))
        strip.save(os.path.join(d, 'strip.png'))
        path = os.path.join(OUT, n + '.webp')
        strip.save(path, 'WEBP', quality=90, alpha_quality=100, method=6, exact=False)
        print(n, fr, size, os.path.getsize(path))


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    if bpy is None:
        names = [a for a in argv if a != 'pack'] or list(JOBS)
        pack(names)
    else:
        names = [a for a in argv if a in JOBS] or list(JOBS)
        blender_main(names)
