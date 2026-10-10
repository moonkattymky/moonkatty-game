import os,math,json,random,bpy
from mathutils import Vector,Matrix
from math import sin,cos,pi,exp
os.environ['HERO_ASSEMBLY']='1'
exec(compile(open('/workspace/scratch/d69cb29e406b/moonkatty-lunar-slice/lunar-slice/tools/hero-v2/build_head.py').read(),'build_head.py','exec'))
headObjects=[o for o in list(bpy.context.scene.objects)if o.type in ['MESH','CURVE']and not o.name.startswith('Plane')]
headMatrix=Matrix.Translation(Vector((0,.014,2.82)))@Matrix.Rotation(math.radians(-16),4,'Z')@Matrix.Scale(.77,4)
for o in headObjects:o.matrix_world=headMatrix@o.matrix_world;o['rig']='head'
for o in list(bpy.context.scene.objects):
 if o.type in ['CAMERA','LIGHT']or o.name.startswith('Plane'):bpy.data.objects.remove(o,do_unlink=True)
whiteSuit=mat('Ivory woven pressure fabric',(.73,.77,.74),.78)
nt=whiteSuit.node_tree;bs=nt.nodes.get('Principled BSDF');no=nt.nodes.new('ShaderNodeTexNoise');no.inputs['Scale'].default_value=170;no.inputs['Detail'].default_value=2;bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.14;bump.inputs['Distance'].default_value=.015;nt.links.new(no.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],bs.inputs['Normal']);bs.inputs['Sheen Weight'].default_value=.21
ivory=mat('Ivory enamel armor',(.84,.85,.79),.28,.15)
gold=mat('Brushed champagne gold',(.63,.36,.090),.26,.78)
goldDim=mat('Anodized dark gold',(.27,.15,.044),.35,.65)
graphite=mat('Charcoal pressure seals',(.023,.033,.041),.64,.08)
seamMat=mat('Double-stitched cloth seams',(.42,.48,.48),.82)
lightMat=mat('Warm status lamps',(1,.69,.20),.22);lightMat.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(1,.52,.10,1);lightMat.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=2
blueLamp=mat('Cyan telemetry',(.22,.72,.83),.24);blueLamp.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(.03,.4,.5,1);blueLamp.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=1
bodyObjects=[]
def mark(o,rig='body'):o['rig']=rig;bodyObjects.append(o);return o
def ball(name,loc,scale,m,rig='body',seg=28,rings=18):return mark(uvball(name,loc,scale,m,seg,rings),rig)
def path(name,pts,r,m,rig='body'):
 o=curve(name,pts,r,m,3);o.data.bevel_resolution=1;return mark(o,rig)
def box(name,loc,scale,m,bevel=.05,rig='body'):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);mod=o.modifiers.new('Soft radiused edges','BEVEL');mod.width=bevel;mod.segments=3;mod.affect='EDGES';bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name);norm=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=norm.name)
 for p in o.data.polygons:p.use_smooth=True
 return mark(o,rig)
def torus(name,loc,major,minor,m,axis='Z',rig='body',sx=1,sy=1):
 bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=40,minor_segments=6,location=loc);o=bpy.context.object;o.name=name
 if axis=='Y':o.rotation_euler[0]=pi/2
 if axis=='X':o.rotation_euler[1]=pi/2
 o.scale.x=sx;o.scale.y=sy;o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 return mark(o,rig)
def garment(name,points,r0,r1,m,rig='body',fold=.012):
 vs=[];fs=[];N=28;K=16;points=[Vector(p)for p in points]
 for j in range(N+1):
  t=j/N;p=(1-t)**2*points[0]+2*(1-t)*t*points[1]+t*t*points[2];ta=(2*(1-t)*(points[1]-points[0])+2*t*(points[2]-points[1])).normalized();ref=Vector((0,1,0));u=ta.cross(ref).normalized();v=ta.cross(u).normalized()
  for i in range(K):
   a=i/K*2*pi;rr=r0*(1-t)+r1*t;rr*=.94+.06*sin(pi*t);rr+=fold*sin(t*92+a*.7)*exp(-((t-.64)/.29)**2);vs.append(tuple(p+(u*cos(a)+v*sin(a))*rr))
 for j in range(N):
  for i in range(K):a=j*K+i;b=j*K+(i+1)%K;fs.append((a,b,b+K,a+K))
 fs+=[tuple(reversed(range(K))),tuple(range(N*K,(N+1)*K))]
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);me.materials.append(m)
 uvl=me.uv_layers.new(name='Garment UV')
 for poly in me.polygons:
  for li in poly.loop_indices:
   vi=me.loops[li].vertex_index;uvl.data[li].uv=((vi%K)/K,(vi//K)/N)
 for p in me.polygons:p.use_smooth=True
 return mark(o,rig)
# Tailored torso: soft continuous pressure shell, curved seams and inset chest unit.
torso=ball('Continuous quilted torso',(0,0,1.63),(.52,.315,.60),whiteSuit,seg=40,rings=28)
for v in torso.data.vertices:
 p=v.co;v.co.x*=1+.016*sin(p.z*53+p.y*7)*exp(-((p.z+.21)/.29)**2);v.co.y*=1+.026*sin(p.z*57+p.x*5)*exp(-((p.z+.25)/.24)**2)
ball('Hip pressure garment',(0,-.015,1.14),(.43,.30,.27),whiteSuit)
for side in [-1,1]:
 path('Torso princess stitch',[(side*.22,.278,1.14),(side*.43,.229,1.44),(side*.44,.21,1.88)],.009,seamMat)
 path('Side tailored welt',[(side*.37,-.19,1.15),(side*.50,-.13,1.57),(side*.43,-.06,1.96)],.015,ivory)
 path('Harness shoulder strap',[(side*.32,-.08,2.105),(side*.40,.245,1.91),(side*.30,.325,1.33)],.038,graphite)
 for z in [1.38,1.93]:box('Harness gold slide',(side*.335,.30,z),(.115,.055,.13),gold,.018)
box('Rounded chest computer bezel',(0,.326,1.70),(.57,.09,.55),gold,.095)
box('Ivory chest face',(0,.384,1.70),(.50,.055,.478),ivory,.079)
# Relief emblem, no camera-facing logo plane.
path('MOONKATTY chest M',[(-.13,.423,1.73),(-.13,.423,1.90),(0,.423,1.77),(.13,.423,1.90),(.13,.423,1.73)],.014,gold)
path('MOONKATTY nested V',[(-.085,.427,1.79),(0,.427,1.70),(.085,.427,1.79)],.010,gold)
box('Chest display slot',(0,.417,1.542),(.23,.026,.06),graphite,.013);box('Chest amber readout',(0,.434,1.546),(.15,.012,.017),lightMat,.004)
for side in [-1,1]:
 for z in [1.506,1.894]:ball('Flush armor fastener',(side*.205,.423,z),(.017,.009,.017),gold,seg=12,rings=8)
# Belt conforms to garment; one small rounded buckle, no stacked block waist.
be=torus('Pressure belt',(0,0,1.178),.44,.041,graphite,sx=1,sy=.68);torus('Gold belt welt',(0,0,1.18),.457,.014,gold,sx=1,sy=.67)
box('Belt clasp',(0,.321,1.19),(.24,.073,.17),gold,.035);box('Belt dark center',(0,.365,1.19),(.168,.024,.114),graphite,.028)
path('Buckle M',[(-.047,.382,1.153),(-.047,.382,1.22),(0,.382,1.171),(.047,.382,1.22),(.047,.382,1.153)],.005,gold)
# A frozen passing stride, authored in actual geometry and later animated around hip pivots.
for side in [-1,1]:
 rig='legL'if side<0 else'legR';hip=(side*.245,-.01,1.16);forward=.40 if side<0 else-.33;lift=0 if side<0 else.16;knee=(side*.272,forward*.62,.67+lift*.35);ankle=(side*.285,forward,.28+lift)
 garment('Folded trouser '+rig,[hip,(side*.265,forward*.23,.86),ankle],.227,.202,whiteSuit,rig,.016)
 ball('Soft oval knee guard '+rig,(side*.27,forward*.62+.172,.668+lift*.35),(.169,.060,.157),ivory,rig)
 path('Knee gold piping '+rig,[(side*.27-.14,forward*.62+.208,.63+lift*.35),(side*.27,forward*.62+.229,.542+lift*.35),(side*.27+.14,forward*.62+.208,.63+lift*.35)],.014,gold,rig)
 for dz in [0,.075]:torus('Ankle pressure seal '+rig,(side*.285,forward,.29+lift+dz),.207,.018,gold if dz else graphite,rig=rig)
 ball('Sculpted boot upper '+rig,(side*.285,forward+.105,.174+lift),(.246,.346,.165),ivory,rig)
 sole=ball('Curved sole '+rig,(side*.285,forward+.10,.071+lift),(.245,.342,.068),graphite,rig)
 for v in sole.data.vertices:v.co.z=max(v.co.z,-.048)
 path('Boot gold contour '+rig,[(side*.285-.223,forward+.01,.127+lift),(side*.285-.17,forward+.36,.13+lift),(side*.285+.15,forward+.37,.13+lift),(side*.285+.223,forward+.01,.127+lift)],.011,gold,rig)
 path('Boot vamp seam '+rig,[(side*.285-.17,forward+.205,.263+lift),(side*.285,forward+.24,.282+lift),(side*.285+.17,forward+.205,.263+lift)],.009,seamMat,rig)
 for j in range(5):path('Boot tread '+rig,[(side*.285-.19,forward-.10+j*.09,.028+lift),(side*.285+.19,forward-.10+j*.09,.028+lift)],.013,graphite,rig)
# Sleeves merge softly into rounded shoulder seams; glove fingers have curved volumes.
for side in [-1,1]:
 rig='armL'if side<0 else'armR';swing=-.25 if side<0 else .25;shoulder=(side*.51,0,1.97);elbow=(side*.66,swing*.55,1.58);wrist=(side*.70,swing,1.24)
 ball('Soft shoulder '+rig,shoulder,(.235,.242,.237),whiteSuit,rig)
 garment('Tailored sleeve '+rig,[shoulder,elbow,wrist],.193,.151,whiteSuit,rig,.013)
 guard=ball('Curved shoulder badge '+rig,(side*.69,.063,1.904),(.05,.154,.165),graphite,rig);guard.rotation_euler[1]=side*.25
 path('Shoulder badge gold edge '+rig,[(side*.735,.016,2.022),(side*.754,.181,1.932),(side*.726,.019,1.802)],.010,gold,rig)
 for dz in [0,.076]:torus('Machined cuff '+rig,(side*.7,swing,1.258+dz),.163,.027,gold,rig=rig)
 ball('Glove palm '+rig,(side*.704,swing+.02,1.088),(.153,.128,.154),ivory,rig)
 ball('Glove soft palm pad '+rig,(side*.704,swing+.121,1.085),(.111,.034,.091),graphite,rig)
 for i in range(3):ball('Glove finger '+rig,(side*.70+(i-1)*.072,swing+.026,1.013),(.044,.088,.079),ivory,rig,20,12)
 ball('Glove thumb '+rig,(side*.589,swing+.067,1.123),(.067,.084,.102),ivory,rig,20,12)
 box('Wrist telemetry '+rig,(side*.7,swing+.166,1.294),(.137,.035,.058),graphite,.016,rig);box('Wrist cyan screen '+rig,(side*.7,swing+.188,1.294),(.090,.012,.027),blueLamp,.008,rig)
# Framed ivory life-support pack with rounded sides and recessed mechanisms.
box('Life support backing',(0,-.348,1.65),(.77,.29,.95),graphite,.12)
box('Life support gold perimeter',(0,-.468,1.69),(.81,.21,.87),gold,.105)
box('Ivory life support shell',(0,-.568,1.72),(.713,.12,.736),ivory,.090)
for side in [-1,1]:
 for z in [1.43,1.98]:box('Backpack latch',(side*.275,-.65,z),(.08,.033,.10),gold,.022)
 ball('Backpack tank',(side*.431,-.40,1.66),(.098,.112,.38),gold)
 for z in [1.49,1.84]:torus('Tank retaining band',(side*.431,-.40,z),.106,.018,graphite)
 box('Tank cooling channel',(side*.431,-.511,1.674),(.071,.023,.21),ivory,.028)
 box('Tank amber cell',(side*.431,-.529,1.674),(.026,.012,.13),lightMat,.01)
path('Backpack raised M',[(-.135,-.642,1.77),(-.135,-.642,1.95),(0,-.642,1.805),(.135,-.642,1.95),(.135,-.642,1.77)],.016,gold)
box('Pack ventilation inset',(0,-.64,1.456),(.27,.034,.09),graphite,.025)
for x in [-.10,-.05,0,.05,.10]:path('Pack ventilation fin',[(x,-.669,1.427),(x,-.669,1.489)],.007,gold)
path('Pack gold hose',[(-.38,-.40,1.55),(-.59,-.40,1.28),(-.48,-.13,1.20)],.033,goldDim)
path('Antenna',[(.29,-.42,2.08),(.32,-.42,2.57)],.012,graphite);path('Antenna gold tip',[(.32,-.42,2.40),(.326,-.42,2.68)],.008,gold);ball('Antenna lamp',(.326,-.42,2.68),(.017,.017,.017),lightMat,seg=12,rings=8)
# Broad striped tail, groomed with coherent tufts rather than a smooth sausage.
pts=[Vector((0,-.24,1.14)),Vector((-.47,-.26,.94)),Vector((-.92,-.03,1.06)),Vector((-1.16,.22,1.42)),Vector((-1.06,.40,1.85))]
def tail_point(t):
 # Piecewise Catmull-Rom, clamped ends.
 u=t*(len(pts)-1);i=min(len(pts)-2,int(u));v=u-i;p0=pts[max(0,i-1)];p1=pts[i];p2=pts[i+1];p3=pts[min(len(pts)-1,i+2)]
 return .5*((2*p1)+(-p0+p2)*v+(2*p0-5*p1+4*p2-p3)*v*v+(-p0+3*p1-3*p2+p3)*v*v*v)
vs=[];fs=[];cs=[];N=64;K=24
for j in range(N+1):
 t=j/N;p=tail_point(t);ta=(tail_point(min(1,t+.005))-tail_point(max(0,t-.005))).normalized();u=ta.cross(Vector((0,1,0))).normalized();v=ta.cross(u).normalized();rad=(.115+.10*sin(pi*t*.92))*(1-.7*smooth(.87,1,t))
 for i in range(K):
  a=i/K*2*pi;vs.append(tuple(p+(u*cos(a)+v*sin(a))*rad));stripe=1-smooth(.29,.49,abs(sin(t*pi*5.2)));cs.append((.35*(1-stripe)+.036*stripe,.17*(1-stripe)+.021*stripe,.055*(1-stripe)+.011*stripe,1))
for j in range(N):
 for i in range(K):a=j*K+i;b=j*K+(i+1)%K;fs.append((a,b,b+K,a+K))
me=bpy.data.meshes.new('Fluffy striped tail');me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new('Ringed fluffy tail',me);bpy.context.collection.objects.link(ob);me.materials.append(fur);ca=me.color_attributes.new(name='Coat',type='FLOAT_COLOR',domain='POINT')
for i,c in enumerate(cs):ca.data[i].color=c
for p in me.polygons:p.use_smooth=True
mark(ob,'tail')
vs=[];fs=[];cs=[]
for j in range(2600):
 t=random.random()*.98;a=random.random()*2*pi;p=tail_point(t);ta=(tail_point(min(1,t+.005))-tail_point(max(0,t-.005))).normalized();u=ta.cross(Vector((0,1,0))).normalized();v=ta.cross(u).normalized();n=(u*cos(a)+v*sin(a));rad=(.115+.10*sin(pi*t*.92))*(1-.7*smooth(.87,1,t));start=p+n*rad;end=start+n*random.uniform(.025,.054)+ta*.01;ac=ta.cross(n)*.0024;k=len(vs);vs.extend([tuple(start-ac),tuple(start+ac),tuple(end)]);fs.append((k,k+1,k+2));stripe=1-smooth(.29,.49,abs(sin(t*pi*5.2)));c=(.35*(1-stripe)+.036*stripe,.17*(1-stripe)+.021*stripe,.055*(1-stripe)+.011*stripe,1);cs.extend([c]*3)
me=bpy.data.meshes.new('Tail tuft groom');me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new('Long tail guard tufts',me);bpy.context.collection.objects.link(ob);me.materials.append(fur);ca=me.color_attributes.new(name='Coat',type='FLOAT_COLOR',domain='POINT')
for i,c in enumerate(cs):ca.data[i].color=c
mark(ob,'tail')
# Closed plush tail tip: the silhouette never reveals the tube's end opening.
tip=tail_point(1);ball('Rounded plush tail tip',tuple(tip),(.055,.052,.060),mat('Dark tabby tail tip',(.055,.029,.015),.94),'tail',20,12)
# Neck and clear helmet retain lightness; narrow warm trim never covers the eyes.
for z,m in [(2.177,graphite),(2.235,gold),(2.275,ivory)]:torus('Neck pressure collar',(0,0,z),.382,.030,m)
# Helmet belongs to the head turn, authored in world head orientation.
helmetParts=[]
def helmet_mark(o):o['rig']='head';helmetParts.append(o);return o
# A shallow open-front shell, behind the cat, and one visor perimeter.
verts=[];faces=[];N=48;R=18
for j in range(R+1):
 theta=pi*j/R
 for i in range(N+1):
  phi=pi+pi*i/N;verts.append((.707*sin(theta)*cos(phi),.03+.62*sin(theta)*sin(phi),2.835+.742*cos(theta)))
for j in range(R):
 for i in range(N):a=j*(N+1)+i;faces.append((a,a+N+1,a+N+2,a+1))
me=bpy.data.meshes.new('Helmet rear shell');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Ivory helmet rear shell',me);bpy.context.collection.objects.link(o);me.materials.append(ivory)
for p in me.polygons:p.use_smooth=True
helmet_mark(o)
for r,m,t in [(.712,graphite,.036),(.744,gold,.018),(.765,ivory,.015)]:helmet_mark(torus('Fine visor perimeter',(0,.142,2.835),r,t,m,'Y',rig='head'))
# Lower jaw fittings and compact ear modules.
for side in [-1,1]:
 helmet_mark(ball('Ear module',(side*.741,-.023,2.836),(.076,.164,.169),gold,'head'))
 helmet_mark(ball('Ear module ivory',(side*.791,-.023,2.836),(.037,.136,.141),ivory,'head'))
 helmet_mark(ball('Ear module glow',(side*.822,-.023,2.836),(.010,.071,.079),lightMat,'head'))
helmet_mark(box('Helmet brow plate',(0,.140,3.565),(.30,.145,.103),ivory,.033,'head'))
helmet_mark(box('Helmet chin release',(0,.156,2.122),(.16,.092,.075),gold,.027,'head'))
# Low-opacity visor is exported separately so real-time renderer can keep it clear.
glass=mat('Clear helmet visor',(.72,.88,.96),.10,.12);gbs=glass.node_tree.nodes.get('Principled BSDF');gbs.inputs['Transmission Weight'].default_value=.90;gbs.inputs['IOR'].default_value=1.08;gbs.inputs['Alpha'].default_value=.13
verts=[];faces=[];N=48;R=24
for j in range(R+1):
 t=pi*j/R
 for i in range(N+1):
  a=pi*i/N;verts.append((.765*sin(t)*cos(a),.05+.765*sin(t)*sin(a),2.835+.78*cos(t)))
for j in range(R):
 for i in range(N):a=j*(N+1)+i;faces.append((a,a+N+1,a+1,a+N+1,a+N+2,a+1))
# Flatten the two triangles in each six-vertex item.
faces=[f[:3]for f in faces]+[f[3:]for f in faces]
me=bpy.data.meshes.new('Convex visor');me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new('Clear convex visor',me);bpy.context.collection.objects.link(ob);me.materials.append(glass)
for p in me.polygons:p.use_smooth=True
helmet_mark(ob)
# Three-quarter walking silhouette: body turns independently from the friendly head.
bodyRot=Matrix.Rotation(math.radians(30),4,'Z')
for o in set(bodyObjects):
 if o in helmetParts:continue
 o.matrix_world=bodyRot@o.matrix_world
headRot=Matrix.Translation(Vector((0,.014,2.82)))@Matrix.Rotation(math.radians(-16),4,'Z')@Matrix.Translation(Vector((0,-.014,-2.82)))
for o in helmetParts:o.matrix_world=headRot@o.matrix_world
# Studio proof with true cast shadows; all parts remain 3D and orbitable.
floor=mat('Studio ground',(.09,.115,.15),.86);bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.023));bpy.context.object.data.materials.append(floor)
area('Large portrait key',(-4,5,7),720,4,(1,.88,.72));area('Sky fill',(4,2,5),330,4,(.68,.83,1));area('Gold fur rim',(0,-4,5),630,3,(1,.77,.45))
bpy.ops.object.camera_add(location=(4.1,6.8,3.50));cam=bpy.context.object;cam.rotation_euler=(Vector((-.10,0,1.86))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=4.28;scene=bpy.context.scene;scene.camera=cam;scene.cycles.samples=64;scene.render.resolution_x=1000;scene.render.resolution_y=1200;scene.render.filepath=OUT+'/hero-proof-quarter.png';bpy.ops.wm.save_as_mainfile(filepath=OUT+'/hero-proof.blend');bpy.ops.render.render(write_still=True)
cam.location=(0,7.8,3.05);cam.rotation_euler=(Vector((0,0,1.8))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=OUT+'/hero-proof-front.png';
if not os.environ.get('HERO_SINGLE'):bpy.ops.render.render(write_still=True)
# Read-only transport proof: material and rig-aware evaluated geometry export.
result=[];dg=bpy.context.evaluated_depsgraph_get()
pivots={'head':(0,2.82,.014),'body':(0,0,0),'tail':tuple(bodyRot@Vector((0,-.24,1.14))),'legL':tuple(bodyRot@Vector((-.245,-.01,1.16))),'legR':tuple(bodyRot@Vector((.245,-.01,1.16))),'armL':tuple(bodyRot@Vector((-.51,0,1.97))),'armR':tuple(bodyRot@Vector((.51,0,1.97)))}
for o in bpy.context.scene.objects:
 if o.type not in ['MESH','CURVE']or o.name.startswith('Plane'):continue
 ob=o.evaluated_get(dg);me=ob.to_mesh();me.calc_loop_triangles();me.transform(o.matrix_world);attr=me.color_attributes.active_color;positions=[];normals=[];cols=[];uvs=[]
 for tri in me.loop_triangles:
  for li in tri.loops:
   vi=me.loops[li].vertex_index;p=me.vertices[vi].co;n=me.vertices[vi].normal;positions.extend((p.x,p.z,p.y));normals.extend((n.x,n.z,n.y));c=attr.data[vi if attr.domain=='POINT'else li].color if attr else o.active_material.diffuse_color;cols.extend(c[:3]);uvs.extend(me.uv_layers.active.data[li].uv[:]if me.uv_layers.active else(0,0))
 rig=o.get('rig','body');p=pivots.get(rig,(0,0,0));pivot=list(p)if rig=='head'else[p[0],p[2],p[1]]
 result.append({'name':o.name,'position':positions,'normal':normals,'color':cols,'uv':uvs,'material':o.active_material.name,'rig':rig,'pivot':pivot});ob.to_mesh_clear()
with open('/tmp/hero-v2-full-mesh.json','w')as f:json.dump(result,f,separators=(',',':'))
print('HERO_PROOF_COMPLETE',sum(len(x['position'])//9 for x in result),'triangles')
