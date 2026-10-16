"""Dựng chu kỳ đi bộ cho Stella bằng cách xoay trực tiếp các xương, render phẳng (Workbench) nhìn từ phía sau chếch nhẹ (3/4 sau).
Dùng: blender -b -P stella_walk.py -- <fbx> <out_dir> [frames]
Xuất walk-00..NN.png, idle.png, wave-00..03.png và walk-meta.txt (kích thước khung, bước chân)."""
import bpy, bmesh, sys, os, math, mathutils

fbx, out_dir = sys.argv[sys.argv.index('--') + 1:][:2]
N = int(sys.argv[sys.argv.index('--') + 3]) if len(sys.argv) > sys.argv.index('--') + 3 else 12
os.makedirs(out_dir, exist_ok=True)
rad = math.radians

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
arm.animation_data_clear()  # bỏ chuyển động có sẵn, bắt đầu từ tư thế gốc

# Texture: FBX tham chiếu đường dẫn máy khác nên tìm lại theo tên trong thư mục textures.
tex_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(fbx))), 'textures')
by_name = {f.lower(): os.path.join(tex_dir, f) for f in os.listdir(tex_dir)}
for img in bpy.data.images:
    name = os.path.basename(img.filepath.replace('\\', '/')).lower()
    if name in by_name and not os.path.exists(bpy.path.abspath(img.filepath)):
        img.filepath = by_name[name]
        img.reload()

# Bỏ lớp viền đen (khe vật liệu 'line', 'shadow'), dao và lớp phản chiếu mắt.
DROP_MATS = {'line', 'shadow'}
for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    if o.name in {'knife', 'eye_specular'}:
        o.hide_render = o.hide_viewport = True
        continue
    drop = {i for i, m in enumerate(o.data.materials) if m and m.name in DROP_MATS}
    if drop:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in drop], context='FACES')
        bm.to_mesh(o.data)
        bm.free()

pose = arm.pose
W3 = arm.matrix_world.to_3x3()
X, Y, Z = (mathutils.Vector(v) for v in ((1, 0, 0), (0, 1, 0), (0, 0, 1)))

def rot_axis(bone_name, world_axis):
    """(chỉ số trục cục bộ, dấu) sao cho euler[chỉ số] = dấu * góc quay quanh world_axis theo quy tắc bàn tay phải."""
    local = W3 @ pose.bones[bone_name].bone.matrix_local.to_3x3()
    best = max(range(3), key=lambda i: abs(local.col[i].normalized().dot(world_axis)))
    return best, 1.0 if local.col[best].normalized().dot(world_axis) > 0 else -1.0

for pb in pose.bones:
    pb.rotation_mode = 'XYZ'

def reset():
    for pb in pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)

def turn(bone_name, world_axis, deg):
    pb = pose.bones[bone_name]
    i, sign = rot_axis(bone_name, world_axis)
    e = list(pb.rotation_euler)
    e[i] += sign * rad(deg)
    pb.rotation_euler = e

def shift(bone_name, world_vec):
    pb = pose.bones[bone_name]
    m = (W3 @ pb.bone.matrix_local.to_3x3()).inverted()
    pb.location = m @ mathutils.Vector(world_vec)

# Quy ước: Stella nhìn về -Y. Xoay quanh +X một góc dương đưa chân ra SAU, nên "tiến" = góc âm.
def forward(bone_name, deg):
    turn(bone_name, X, -deg)

ARM_DOWN = 38  # tay gốc dạng chữ A (chếch 45°), khép vào người cho dáng đi tự nhiên

def apply_arms_down():
    turn('arm_stretch.l', Y, ARM_DOWN)
    turn('arm_stretch.r', Y, -ARM_DOWN)

def apply_walk(phase):
    """phase 0..2π: 0 = chân trái ở giữa, đang vung ra trước."""
    reset()
    apply_arms_down()
    for side, ph in (('l', phase), ('r', phase + math.pi)):
        swing = 28 * math.sin(ph)  # đùi: dương = ra trước
        flex = 10 + 52 * max(0.0, math.cos(ph))  # gối gập mạnh nhất lúc chân vung qua dưới thân
        forward(f'thigh_stretch.{side}', swing)
        turn(f'leg_stretch.{side}', X, flex)
        # Bàn chân giữ gần song song mặt đất; mũi chân hơi nhấc lúc chạm gót, đẩy lúc rời đất.
        turn(f'foot.{side}', X, 0.9 * (swing - flex) - 8 * math.sin(ph - 0.6))
        # Tay đối nghịch chân cùng bên.
        arm_swing = -20 * math.sin(ph)
        forward(f'arm_stretch.{side}', arm_swing)
        forward(f'forearm_stretch.{side}', 14 + 14 * max(0.0, math.sin(ph + math.pi)))
    # Thân nhún hai lần mỗi chu kỳ (mỗi bước một lần), ngả nhẹ về trước.
    # Hông dịch sang phía chân trụ, thân vặn ngược và nghiêng nhẹ để nhìn từ sau thấy nhịp lắc.
    shift('root.x', (-0.024 * math.cos(phase), 0, 0.018 * abs(math.cos(phase)) - 0.009))
    turn('spine_01.x', Y, -3.5 * math.cos(phase))
    turn('spine_02.x', Z, 5 * math.sin(phase))
    turn('head.x', Z, -3 * math.sin(phase))
    forward('spine_01.x', 3)
    forward('spine_03.x', 2)
    # Đuôi, tai, khăn trễ pha so với thân để có chuyển động phụ.
    for i in range(1, 8):
        turn(f'c_tail_{i:02d}.x', X, 5 * math.sin(phase - 0.55 * i) - 2)
        turn(f'c_tail_{i:02d}.x', Z, 11 * math.sin(phase - 0.6 * i + 1.2))
    for side in 'lr':
        for k, name in enumerate(('cc_ear.%s', 'cc_ear.%s.001', 'cc_ear.%s.002')):
            turn(name % side, X, 4 * math.sin(2 * phase - 0.7 - 0.4 * k))
            turn(name % side, Z, (1 if side == 'l' else -1) * 4 * math.sin(phase - 0.5 * k))
    for k, name in enumerate(('cc_bbones_01.x', 'cc_bbones_02.x', 'cc_bbones_03.x')):
        turn(name, X, 5 * math.sin(2 * phase - 0.5 * (k + 1)))

def apply_idle():
    reset()
    apply_arms_down()
    forward('forearm_stretch.l', 10)
    forward('forearm_stretch.r', 10)

def apply_wave(t):
    """Giơ tay phải (bên -x) về phía trước lên cao rồi vẫy cẳng tay."""
    reset()
    apply_arms_down()
    turn('arm_stretch.r', Y, ARM_DOWN)  # bỏ khép tay phải
    forward('arm_stretch.r', 125)
    forward('forearm_stretch.r', 25 + 30 * math.sin(t))
    forward('spine_03.x', 2)

# --- Render ---
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y = 600, 900
scene.render.image_settings.color_mode = 'RGBA'
scene.display.render_aa = '8'
sh = scene.display.shading
sh.light = 'FLAT'
sh.color_type = 'TEXTURE'
sh.show_object_outline = False
sh.show_specular_highlight = False
scene.view_settings.view_transform = 'Standard'

reset()
apply_idle()
bpy.context.view_layer.update()
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and not o.hide_render]
dg = bpy.context.evaluated_depsgraph_get()
lo = mathutils.Vector((1e9,) * 3)
hi = mathutils.Vector((-1e9,) * 3)
for o in meshes:
    eo = o.evaluated_get(dg)
    for c in eo.bound_box:
        w = eo.matrix_world @ mathutils.Vector(c)
        lo = mathutils.Vector(map(min, lo, w))
        hi = mathutils.Vector(map(max, hi, w))
center = (lo + hi) / 2
height = hi.z - lo.z

cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = height * 1.15
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
# Stella nhìn về -Y; camera đặt phía sau (+Y), chếch nhẹ sang +X và hơi cao: thấy lưng, đuôi và nhịp chân.
d = mathutils.Vector((0.40, 1, 0.14)).normalized()
cam.location = mathutils.Vector((center.x, center.y, center.z)) + d * 10
cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()

def shoot(path):
    bpy.context.view_layer.update()
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

shoot(os.path.join(out_dir, 'idle.png'))
for f in range(N):
    apply_walk(2 * math.pi * f / N)
    shoot(os.path.join(out_dir, f'walk-{f:02d}.png'))

with open(os.path.join(out_dir, 'walk-meta.txt'), 'w') as fh:
    fh.write(f'frames={N}\nframe_px=600x900\nworld_height_m={height * 1.15:.4f}\ncharacter_height_m={height:.4f}\n')
print('INSPECT done', N, 'height', round(height, 3))
