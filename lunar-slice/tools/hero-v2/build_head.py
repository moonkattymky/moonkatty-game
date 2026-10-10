import bpy, math, random, json, os
from mathutils import Vector
from math import sin,cos,pi,sqrt,exp
random.seed(26)
OUT='/workspace/scratch/d69cb29e406b/moonkatty-lunar-slice/lunar-slice/art/hero-v2'
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,c,rough=.6,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal;return m
fur=mat('Warm tabby • groomed velvet',(.38,.19,.08),.83)
nt=fur.node_tree;b=nt.nodes.get('Principled BSDF');vc=nt.nodes.new('ShaderNodeVertexColor');vc.layer_name='Coat';nt.links.new(vc.outputs['Color'],b.inputs['Base Color']);noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=220;noise.inputs['Detail'].default_value=2;bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.11;bump.inputs['Distance'].default_value=.02;nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],b.inputs['Normal']);b.inputs['Sheen Weight'].default_value=.24
cream=mat('Muzzle warm ivory',(.83,.76,.62),.82)
dark=mat('Warm dark lid',(.065,.032,.020),.83)
black=mat('Pupil obsidian',(.006,.010,.013),.23)
pink=mat('Rose nose',(.49,.205,.22),.43)
inner=mat('Soft ear pink',(.42,.21,.18),.90)
mouthmat=mat('Mouth cavity',(.085,.020,.025),.83)
tongue=mat('Tongue',(.69,.265,.30),.48)
white=mat('Catchlight',(.94,.91,.80),.23)
def uvball(name,loc,scale,material=None,segments=48,rings=32):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if material:o.data.materials.append(material)
 for p in o.data.polygons:p.use_smooth=True
 return o
# Joined and voxel blended facial masses become one continuous sculpt, not floating spheres.
parts=[]
for name,loc,scale in [
 ('Cranium',(0,0,.02),(.80,.60,.71)),
 ('Cheek.L',(-.50,.22,-.22),(.34,.40,.35)),('Cheek.R',(.50,.22,-.22),(.34,.40,.35)),
 ('Brow.L',(-.34,.29,.28),(.35,.35,.31)),('Brow.R',(.34,.29,.28),(.35,.35,.31)),
 ('Bridge',(0,.49,.005),(.16,.22,.31)),
 ('Muzzle.L',(-.19,.60,-.235),(.275,.28,.176)),('Muzzle.R',(.19,.60,-.235),(.275,.28,.176)),
 ('Chin',(0,.405,-.465),(.35,.29,.17))]:parts.append(uvball(name,loc,scale))
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();head=bpy.context.object;head.name='Unified tabby facial sculpt'
rem=head.modifiers.new('Blend pressure and facial volumes','REMESH');rem.mode='VOXEL';rem.voxel_size=.020;rem.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=rem.name)
sm=head.modifiers.new('Soft sculpt transitions','SMOOTH');sm.factor=.70;sm.iterations=8;bpy.ops.object.modifier_apply(modifier=sm.name)
# Carved orbital recesses allow lenses to sit in the face rather than on top of it.
for side in [-1,1]:
 cutter=uvball('Orbital recess',(side*.348,.554,.085),(.292,.205,.210),segments=40,rings=24)
 bo=head.modifiers.new('Inset almond orbit','BOOLEAN');bo.operation='DIFFERENCE';bo.object=cutter;bpy.context.view_layer.objects.active=head;bpy.ops.object.modifier_apply(modifier=bo.name);bpy.data.objects.remove(cutter,do_unlink=True)
# The little open smile is a true recess with softly joined cheek volumes above it.
cutter=uvball('Smile recess',(0,.649,-.398),(.170,.190,.156),segments=32,rings=24)
bo=head.modifiers.new('Open smile','BOOLEAN');bo.operation='DIFFERENCE';bo.object=cutter;bpy.context.view_layer.objects.active=head;bpy.ops.object.modifier_apply(modifier=bo.name);bpy.data.objects.remove(cutter,do_unlink=True)
sm=head.modifiers.new('Soften orbital cut','SMOOTH');sm.factor=.32;sm.iterations=3;bpy.ops.object.modifier_apply(modifier=sm.name)
dec=head.modifiers.new('Realtime sculpt topology','DECIMATE');dec.ratio=.33;bpy.ops.object.modifier_apply(modifier=dec.name)
head.data.materials.append(fur)
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def color_at(p):
 x,y,z=p;ax=abs(x);front=smooth(.05,.48,y)
 c=[.255,.115,.037]
 # pale eye-brow and cheek transitions are broad fur color, not separate rings.
 warm=exp(-((z-.05)/.35)**2)*front
 c=[c[0]+.090*warm,c[1]+.078*warm,c[2]+.048*warm]
 stripe=0
 if y>.0:
  # Forehead M, with tapered crown branches and asymmetric natural edges.
  q=ax+.013*sin(z*37+x*5)
  stripe=max(stripe,(1-smooth(.022,.060,q))*smooth(.17,.43,z))
  stripe=max(stripe,(1-smooth(.027,.073,abs(q-(.18+.1*(.65-z)))))*smooth(.27,.46,z))
  stripe=max(stripe,(1-smooth(.027,.062,abs(q-(.37+.035*sin(z*8)))))*smooth(.37,.58,z))
  stripe=max(stripe,(1-smooth(.018,.047,abs(z-(.17+ax*.68))))*smooth(.07,.16,ax)*(1-smooth(.37,.46,ax)))
  for k in range(3):
   stripe=max(stripe,(1-smooth(.025,.05,abs(z-(.01-k*.15-.45*(ax-.52)))))*smooth(.48,.68,ax))
 rear=1-front
 stripe=max(stripe,rear*(1-smooth(.3,.55,abs(sin(math.atan2(y,x)*5+z*7)))))
 c=[c[k]*(1-stripe*.9)+[.020,.010,.006][k]*stripe*.9 for k in range(3)]
 muzzle=front*(1-smooth(-.22,-.085,z))*(1-smooth(.40,.66,ax))
 chin=front*(1-smooth(-.35,-.19,z))
 blaze=front*(1-smooth(.04,.105,ax))*(1-smooth(.025,.26,z))
 wh=max(muzzle,chin*.97,blaze*.9)
 c=[c[k]*(1-wh)+[.89,.815,.65][k]*wh for k in range(3)]
 return (*c,1)
coat=head.data.color_attributes.new(name='Coat',type='FLOAT_COLOR',domain='POINT')
for v in head.data.vertices:coat.data[v.index].color=color_at(v.co+head.location)
# Real thickness, curved silhouette and bowed inner surfaces for each ear.
def ear(side):
 verts=[];faces=[];N=26;R=8
 # Bilateral cross sections taper along a gently bent triangular ear.
 for j in range(R+1):
  t=j/R;z=.43+t*.52;xc=side*(.49+.28*t);width=.267*(1-t)**.78+.018
  for i in range(N):
   a=i/N*2*pi;verts.append((xc+width*cos(a),-.015+.15*(1-t)+sin(a)*(.115*(1-t)+.02),z-.065*abs(cos(a))*(1-t)))
 for j in range(R):
  for i in range(N):faces.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
 faces.append(tuple(range((R)*N,(R+1)*N)))
 me=bpy.data.meshes.new('Ear volume');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Sculpted ear '+str(side),me);bpy.context.collection.objects.link(o);me.materials.append(fur)
 for p in me.polygons:p.use_smooth=True
 ca=me.color_attributes.new(name='Coat',type='FLOAT_COLOR',domain='POINT')
 for v in me.vertices:ca.data[v.index].color=color_at(v.co)
 # Deep inset concha, sculpted as a curved triangular surface with multiple rows.
 vs=[];fs=[];rows=18;cols=16
 for j in range(rows+1):
  t=j/rows;z=.49+t*.393;xc=side*(.50+.245*t);width=.175*(1-t)**.8+.004
  for i in range(cols+1):
   u=i/cols*2-1;vs.append((xc+u*width,.154-.028*t-.068*(1-u*u)*sin(pi*t),z-.025*abs(u)))
 for j in range(rows):
  for i in range(cols):a=j*(cols+1)+i;fs.append((a,a+cols+1,a+cols+2,a+1))
 me=bpy.data.meshes.new('Ear concha');me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new('Inset pink concha '+str(side),me);bpy.context.collection.objects.link(ob);me.materials.append(inner)
 for p in me.polygons:p.use_smooth=True
 return o
for s in [-1,1]:ear(s)
def curve(name,points,radius,material,res=3):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=res;cu.bevel_depth=radius;cu.bevel_resolution=1
 sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for b,p in zip(sp.bezier_points,points):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 ob=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(ob);cu.materials.append(material);return ob
# One continuous almond aperture and iris surface, shaded using physical mesh colors.
eyeMat=mat('Amber iris radial fibers',(.63,.26,.035),.34);nt=eyeMat.node_tree;v=nt.nodes.new('ShaderNodeVertexColor');v.layer_name='Iris';nt.links.new(v.outputs['Color'],nt.nodes.get('Principled BSDF').inputs['Base Color'])
eyeMat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.24
eyeMat.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.24
tex=eyeMat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(OUT+'/iris.png');eyeMat.node_tree.links.new(tex.outputs['Color'],eyeMat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
for side in [-1,1]:
 center=Vector((side*.348,.566,.085));vs=[];cols=[];faces=[];R=12;N=64
 for j in range(R+1):
  r=j/R
  for i in range(N+1):
   a=i/N*2*pi;xx=.301*r*cos(a);zz=(.219 if sin(a)>0 else .189)*r*sin(a);zz+=side*xx*.075
   # Orbital shape follows skull curvature and rises into a polished corneal dome.
   yy=.143*(1-r*r)-side*xx*.34
   vs.append(tuple(center+Vector((xx,yy,zz))))
   # Large amber iris, oversized pupil, irregular radial fibers and dark outer limbus.
   ir=sqrt((xx/.245)**2+((zz-side*xx*.075)/.243)**2)
   pup=sqrt((xx/.106)**2+((zz-side*xx*.075)/.171)**2)
   if pup<1:color=(.007,.011,.014,1)
   elif ir<1:
    ray=.5+.5*sin(a*147+sin(a*17)*4);rays=.80+.20*ray
    g=.31+.16*(1-ir);color=(.83*rays,g*rays,.027+ray*.018,1)
    if ir>.93:color=(.12,.061,.015,1)
   else:color=(.70,.66,.52,1)
   cols.append(color)
 for j in range(R):
  for i in range(N):
   a=j*(N+1)+i;b=a+N+1;faces.append((a,a+1,b+1,b))
 me=bpy.data.meshes.new('Almond eye surface');me.from_pydata(vs,[],faces);me.update();o=bpy.data.objects.new('Organic amber eye '+str(side),me);bpy.context.collection.objects.link(o);me.materials.append(eyeMat)
 uvl=me.uv_layers.new(name='Iris UV')
 for poly in me.polygons:
  for li in poly.loop_indices:
   q=me.vertices[me.loops[li].vertex_index].co-center;uvl.data[li].uv=(q.x/.68+.5,(q.z-side*q.x*.075)/.54+.5)
 for p in me.polygons:p.use_smooth=True
 ca=me.color_attributes.new(name='Iris',type='FLOAT_COLOR',domain='POINT')
 for i,c in enumerate(cols):ca.data[i].color=c
 # The lid contours are embedded in fur, with only a thin dark waterline visible.
 top=[];bottom=[]
 for i in range(17):
  a=pi*i/16;xx=.302*cos(a);zz=.220*sin(a)+side*xx*.075;top.append(tuple(center+Vector((xx,-side*xx*.34+.004,zz))))
  zz=-.190*sin(a)+side*xx*.075;bottom.append(tuple(center+Vector((xx,-side*xx*.34+.005,zz))))
 curve('Upper organic lid '+str(side),top,.008,dark);curve('Lower organic lid '+str(side),bottom,.005,dark)
 # Subtle elliptical catchlights sit on the true curved front, not a glossy shell.
 uvball('Main glint '+str(side),(side*.348-.069,.701+.023*side,.154),(.020,.010,.027),white,24,16)
 uvball('Secondary glint '+str(side),(side*.348+.067,.710-.023*side,.043),(.012,.008,.013),white,16,10)
# Heart shaped nose, shallow philtrum, actual smile cavity and tongue.
verts=[(-.115,.833,-.181),(-.074,.869,-.143),(0,.887,-.161),(.074,.869,-.143),(.115,.833,-.181),(.058,.866,-.243),(0,.882,-.267),(-.058,.866,-.243),(0,.914,-.197)]
faces=[(i,(i+1)%8,8) for i in range(8)]+[tuple(reversed(range(8)))]
me=bpy.data.meshes.new('Heart nose');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Soft heart nose',me);bpy.context.collection.objects.link(o);me.materials.append(pink);o.scale=(1.25,1,1.15);sub=o.modifiers.new('Soft nose skin','SUBSURF');sub.levels=2;sub.render_levels=2
for p in me.polygons:p.use_smooth=True
uvball('Inset mouth',(0,.62,-.399),(.144,.138,.145),mouthmat,24,16)
uvball('Smiling tongue',(0,.719,-.447),(.095,.030,.05),tongue,24,16)
curve('Philtrum',[(0,.884,-.247),(0,.852,-.300),(0,.812,-.333)],.010,dark)
for side in [-1,1]:
 curve('Smile edge '+str(side),[(0,.812,-.333),(side*.079,.826,-.333),(side*.17,.788,-.302)],.009,dark)
 for i in range(3):
  uvball('Whisker pore',(side*(.15+i*.047),.86-i*.020,-.216-(i%2)*.045),(.009,.005,.007),dark,12,8)
 for i in range(5):
  start=(side*.18,.86,-.24+i*.022);mid=(side*.43,.87,-.26+i*.058);end=(side*(.77+i*.047),.68,-.30+i*.080)
  ob=curve('Swept whisker '+str(side)+' '+str(i),[start,mid,end],.0028,cream);ob.data.splines[0].bezier_points[-1].radius=.08
# Groom as narrow, tapered triangle ribbons: visible fur silhouette, realtime-exportable.
verts=[];faces=[];colors=[]
for poly in head.data.polygons:
 if random.random()>.34:continue
 p=poly.center+head.location;n=poly.normal
 if p.y<-.25 or n.length<.1:continue
 # Keep the central muzzle and lid margin tidy. Long guard hairs at the cheek edge.
 if .25<abs(p.x)<.60 and -.12<p.z<.29 and p.y>.38:continue
 for rep in range(1):
  tangent=Vector((p.x*.5,-.10,-.35 if p.z<.1 else .25));tangent-=n*tangent.dot(n)
  if tangent.length<.001:tangent=Vector((1,0,0))
  tangent.normalize();root=p+n*.003;length=random.uniform(.025,.045)*(1.6 if abs(p.x)>.56 else 1)
  end=root+n*length*.28+tangent*length*1.12;across=n.cross(tangent).normalized()*random.uniform(.0014,.0023)
  k=len(verts);verts.extend([tuple(root-across),tuple(root+across),tuple(end)]);faces.append((k,k+1,k+2));c=color_at(root);br=random.uniform(.94,1.04);colors.extend([tuple(v*br for v in c[:3])+(1,)]*3)
me=bpy.data.meshes.new('Groomed tabby guard hairs');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Short directional groom',me);bpy.context.collection.objects.link(o);me.materials.append(fur);ca=me.color_attributes.new(name='Coat',type='FLOAT_COLOR',domain='POINT')
for i,c in enumerate(colors):ca.data[i].color=c
# Ear furnishings, the tiny cream wisps that make triangular ears feel organic.
for side in [-1,1]:
 for i in range(15):
  z=.51+random.random()*.26;x=side*(.40+random.random()*.18)
  ob=curve('Ear furnishing',[(x,.170,z),(x+side*.055,.188,z+.035),(x+side*.12,.172,z+.12)],.0016,cream,2);ob.data.splines[0].bezier_points[-1].radius=.05
# Neutral studio presentation; proof contains only an actual mesh, never generated character art.
world=bpy.context.scene.world or bpy.data.worlds.new('Studio');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.055,.071,.10,1);world.node_tree.nodes['Background'].inputs[1].default_value=.30
floor=mat('Studio ground',(.08,.105,.14),.8);bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.78));bpy.context.object.data.materials.append(floor)
def area(name,loc,power,size,color):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,.1))-o.location).to_track_quat('-Z','Y').to_euler()
area('Large soft key',(-3,4,4),430,4,(1,.85,.67));area('Cool face fill',(3,2,1.4),180,3,(.72,.84,1));area('Fur rim',(1,-2,3),420,2,(1,.77,.42))
bpy.ops.object.camera_add(location=(2.85,5.8,1.7));cam=bpy.context.object;cam.rotation_euler=(Vector((0,.1,.15))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.95;bpy.context.scene.camera=cam
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=72;scene.cycles.use_denoising=False;scene.render.resolution_x=1024;scene.render.resolution_y=1024;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.render.filepath=OUT+'/head-proof-quarter.png';scene.render.film_transparent=False
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/head-proof.blend');
if not os.environ.get('HERO_ASSEMBLY'):bpy.ops.render.render(write_still=True)
cam.location=(0,6.6,.9);cam.rotation_euler=(Vector((0,.1,.15))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=OUT+'/head-proof-front.png';
if not os.environ.get('HERO_ASSEMBLY'):bpy.ops.render.render(write_still=True)
# Mesh export is independent of renderer: applied modifiers, positions, normals, colors.
result=[];dg=bpy.context.evaluated_depsgraph_get()
for o in bpy.context.scene.objects:
 if o.type not in ['MESH','CURVE'] or o.name.startswith('Plane'):continue
 ob=o.evaluated_get(dg);me=ob.to_mesh();me.calc_loop_triangles();me.transform(o.matrix_world)
 attr=me.color_attributes.active_color
 positions=[];normals=[];cols=[];uvs=[]
 for tri in me.loop_triangles:
  for li in tri.loops:
   vi=me.loops[li].vertex_index;p=me.vertices[vi].co;n=me.vertices[vi].normal
   positions.extend((p.x,p.z,p.y));normals.extend((n.x,n.z,n.y))
   c=attr.data[vi if attr.domain=='POINT' else li].color if attr else o.active_material.diffuse_color
   cols.extend(c[:3]);uvs.extend(me.uv_layers.active.data[li].uv[:] if me.uv_layers.active else (0,0))
 # Swapping axes changes winding; Three can reverse the triangles once on import.
 result.append({'name':o.name,'position':positions,'normal':normals,'color':cols,'uv':uvs,'material':o.active_material.name if o.active_material else 'fur'})
 ob.to_mesh_clear()
with open('/tmp/hero-v2-head-mesh.json','w')as f:json.dump(result,f,separators=(',',':'))
print('HEAD_PROOF_COMPLETE',sum(len(x['position'])//9 for x in result),'triangles')
