import bpy, math, json, base64, struct, os, random, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
random.seed(37)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=os.path.join(ROOT,'art/authored');os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}; export=[]
def mat(k,c,metal,rough,emission=0,alpha=1):
 m=bpy.data.materials.new(k);m.diffuse_color=(*c,alpha);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if emission:p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=emission
 if alpha<1:p.inputs['Transmission Weight'].default_value=.65;p.inputs['Alpha'].default_value=alpha;m.surface_render_method='DITHERED'
 M[k]={'obj':m,'color':c,'metalness':metal,'roughness':rough,'emission':emission,'alpha':alpha};return m
mat('porcelain',(.76,.745,.705),.16,.31);mat('edge',(.93,.91,.845),.12,.24);mat('gold',(.71,.43,.135),.94,.23);mat('brass',(.42,.24,.07),.87,.3);mat('gasket',(.025,.036,.045),.20,.78);mat('navy',(.025,.055,.078),.58,.33);mat('steel',(.26,.31,.32),.83,.27);mat('glass',(.07,.16,.20),.35,.09,alpha=.26);mat('light',(1,.48,.10),.10,.2,4.5);mat('cyan',(.11,.70,.87),.18,.2,1.6);mat('inside',(.37,.36,.31),.12,.62)
def finish(o,name,m,bevel=0,smooth=False):
 o.name=name;o.data.materials.append(M[m]['obj']);o['mat']=m;export.append(o)
 if bevel:
  mod=o.modifiers.new('Manufactured edge radius','BEVEL');mod.width=bevel;mod.segments=3
  mod=o.modifiers.new('Area weighted corner normals','WEIGHTED_NORMAL');mod.keep_sharp=True
 if smooth:
  for p in o.data.polygons:p.use_smooth=True
 return o
def cube(name,m,loc,scale,bev=.035):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,m,bev)
def cyl(name,m,loc,r,depth,n=64,bev=.035):
 bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=depth,location=loc);return finish(bpy.context.object,name,m,bev,True)
def uvball(name,m,loc,scale):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=loc);o=bpy.context.object;o.scale=scale;return finish(o,name,m,0,True)
def custom(name,m,v,f,bev=.035,smooth=False):
 g=bpy.data.meshes.new(name);g.from_pydata(v,[],f);g.update();o=bpy.data.objects.new(name,g);bpy.context.collection.objects.link(o);return finish(o,name,m,bev,smooth)
def rail(name,m,points,r=.04):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=12;cu.bevel_depth=r;cu.bevel_resolution=2;s=cu.splines.new('POLY');s.points.add(len(points)-1)
 for p,co in zip(s.points,points):p.co=(*co,1)
 o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return finish(o,name,m)
def polar(a,r,z):return (math.sin(a)*r,-math.cos(a)*r,z)
def sector(name,m,r1,r2,z1,z2,a1,a2,segments=12,bev=.035):
 v=[]
 for z in [z1,z2]:
  for r in [r1,r2]:
   for i in range(segments+1):v.append(polar(a1+(a2-a1)*i/segments,r,z))
 n=segments+1;f=[]
 for i in range(segments):f.extend([(i,i+1,n+i+1,n+i),(2*n+i,3*n+i,3*n+i+1,2*n+i+1),(i,2*n+i,2*n+i+1,i+1),(n+i,n+i+1,3*n+i+1,3*n+i)])
 f.extend([(0,n,3*n,2*n),(n-1,3*n-1,4*n-1,2*n-1)]);return custom(name,m,v,f,bev,True)
def panel(name,m,center,ang,width,height,depth,bev=.06):
 o=cube(name,m,center,(width,depth,height),bev);o.rotation_euler.z=ang;return o
# Multi-layer plinth and undercut foundation: real reveal shadows.
cyl('Basalt foundation','gasket',(0,0,.15),10.4,.3)
cyl('Inset structural base','navy',(0,0,.50),9.8,.65)
sector('Floating ceramic plinth','porcelain',9.3,10.18,.57,1.20,-math.pi,math.pi,96,.10)
sector('Base brass reveal','brass',9.93,10.14,1.21,1.32,-math.pi,math.pi,96,.025)
# Lower rotunda is panelled, thick and interrupted by real windows and entrance.
for i in range(16):
 a=i*2*math.pi/16
 if min(a,2*math.pi-a)<.60:continue
 a1=a-.183;a2=a+.183
 sector('Wall panel lower %02d'%i,'porcelain',8.70,9.25,1.35,2.25,a1,a2,8,.045)
 sector('Wall panel upper %02d'%i,'porcelain',8.70,9.25,5.88,7.5,a1,a2,8,.055)
 for s in [-1,1]:sector('Load pillar %02d %d'%(i,s),'porcelain',8.68,9.29,2.23,5.90,a+s*.147-.030,a+s*.147+.030,4,.045)
 sector('Recess shadow %02d'%i,'gasket',8.62,8.72,2.20,5.95,a1,a2,8,.025)
 sector('Dark observation window %02d'%i,'glass',8.74,8.77,2.51,5.58,a-.122,a+.122,8,0)
 for z in [2.43,5.65]:sector('Window brass sill','gold',8.74,8.98,z,z+.075,a-.128,a+.128,8,.02)
 # Narrow main frame and hardware, flat cut machined forms.
 for s in [-1,1]:
  p=polar(a+s*.127,8.91,4.04);o=cube('Window vertical golden bead','gold',p,(.066,.11,3.24),.016);o.rotation_euler.z=a+s*.127
 p=polar(a,9.29,6.60);o=cube('Service recess dark','gasket',p,(1.08,.035,.22),.025);o.rotation_euler.z=a
 for j in range(5):
  p=polar(a,9.33,6.53+j*.036);o=cube('Machined vent slots','steel',p,(.91,.045,.016),.006);o.rotation_euler.z=a
 p=polar(a+.08,9.32,1.72);o=cube('Inset corner fastener plate','brass',p,(.34,.06,.22),.025);o.rotation_euler.z=a
# Deep upper cornice: underside, layered ceramic belt and inset brushed metal lip.
for j,(r1,r2,z1,z2,m) in enumerate([(8.8,9.65,7.35,7.55,'gasket'),(8.6,9.8,7.55,8.12,'porcelain'),(9.50,9.82,8.12,8.26,'gold'),(8.7,9.25,8.26,8.44,'navy')]):sector('Upper cornice '+str(j),m,r1,r2,z1,z2,-math.pi,math.pi,96,.06)
# Broad compound shell ribs, not tubes. Thickness and tapered width vary along arch.
R=8.92;CZ=8.35
for rib in range(6):
 a=(rib+.5)*math.pi/3
 for part in range(5):
  t0=.06+part*.282;t1=t0+.272;v=[];steps=7
  for offset in [0,.28]:
   for s in [-1,1]:
    for j in range(steps+1):
     t=t0+(t1-t0)*j/steps;width=1.23+.44*math.sin(t)**2;aa=a+s*width/(2*max(2.7,R*math.sin(t)));v.append(polar(aa,(R+offset)*math.sin(t),CZ+(R+offset)*math.cos(t)))
  n=steps+1;f=[]
  for j in range(steps):f.extend([(j,j+1,n+j+1,n+j),(2*n+j,3*n+j,3*n+j+1,2*n+j+1),(j,2*n+j,2*n+j+1,j+1),(n+j,n+j+1,3*n+j+1,3*n+j)])
  f.extend([(0,n,3*n,2*n),(n-1,3*n-1,4*n-1,2*n-1)])
  custom('Ceramic shell rib %d segment %d'%(rib,part),'porcelain',v,f,.055,True)
 # recessed gold flanks following the rib edge, substantial squared cross-section.
 for side in [-1,1]:
  points=[]
  for j in range(49):
   t=.065+1.40*j/48;width=1.23+.44*math.sin(t)**2;aa=a+side*(width/2+.11)/max(2.7,R*math.sin(t));points.append(polar(aa,(R+.07)*math.sin(t),CZ+(R+.07)*math.cos(t)))
  rail('Shell structural gold flange','gold',points,.095)
# Glazed dome: segmented shell, interior dark volume and mullions.
for i in range(24):
 a1=i*math.pi/12+.004;a2=(i+1)*math.pi/12-.004;v=[];f=[];N=16
 for j in range(N+1):
  t=.09+1.45*j/N
  for k in range(4):v.append(polar(a1+(a2-a1)*k/3,8.86*math.sin(t),CZ+8.86*math.cos(t)))
 for j in range(N):
  for k in range(3):n=j*4+k;f.append((n,n+4,n+5,n+1))
 custom('Individual curved glazing pane '+str(i),'glass',v,f,0,True)
 if i%2==0:rail('Fine glazing mullion','brass',[polar(a1,8.91*math.sin(.08+1.47*j/32),CZ+8.91*math.cos(.08+1.47*j/32)) for j in range(33)],.036)
for z in [10.8,13.5,15.7]:
 rr=(R*R-(z-CZ)**2)**.5;rail('Glazing latitude seam','brass',[polar(j*math.pi/64,rr,z) for j in range(129)],.03)
# Roof crown and communication mast, layered rather than a single disk.
cyl('Crown dark shadow','navy',(0,0,17.02),2.35,.38)
cyl('Crown ceramic cap','porcelain',(0,0,17.33),2.20,.5)
sector('Crown edge trim','gold',2.10,2.24,17.53,17.63,-math.pi,math.pi,48,.018)
for a in [j*math.pi/4 for j in range(8)]:panel('Crown dark recess','navy',polar(a,2.206,17.33),a,.48,.27,.05,.018)
for x,h in [(-.60,3.35),(.6,2.6)]:
 cyl('Mast gold foot','gold',(x,0,17.86),.24,.35,24)
 cyl('Tapered antenna','steel',(x,0,18.1+h/2),.045,h,16,.006)
 for z in [18.25,18.7]:cyl('Antenna collar','gold',(x,0,z),.13,.10,24,.012)
 uvball('Antenna beacon','light',(x,0,18.1+h),(.055,.055,.10))
# Telescope hall with real floor, perimeter illumination and machine.
cyl('Telescope hall floor','inside',(0,0,8.19),8.68,.13)
for r,z in [(6.6,8.53),(5.8,11.40),(4.6,13.0)]:rail('Interior luminous ring','light',[polar(j*math.pi/64,r,z) for j in range(129)],.045)
for i in range(32):
 a=i*math.pi/16;rail('Interior balcony post','gold',[polar(a,8.4,8.38),polar(a,8.4,9.25)],.025)
rail('Interior balcony top','gold',[polar(j*math.pi/64,8.4,9.25) for j in range(129)],.033)
cyl('Telescope foot','navy',(0,0,8.50),1.50,.5);cyl('Telescope foot gold','gold',(0,0,8.79),1.32,.11)
cube('Telescope square pedestal','porcelain',(0,0,9.5),(1.25,1.45,1.45),.16)
for x in [-1.02,1.02]:cube('Optical mount support','gold',(x,0,10.5),(.28,1.00,2.3),.10)
# Whole optical barrel tilted toward an actual sky viewing segment.
axis=Vector((.73,0,.68));center=Vector((0,0,11.45))
for name,m,pos,r,dep in [('Optical barrel','porcelain',0,.73,4.4),('Front gold collar','gold',2.06,.80,.24),('Back gold collar','gold',-1.98,.78,.25),('Hollow optical mouth','navy',2.20,.69,.08),('Lens','cyan',2.251,.52,.016)]:
 o=cyl(name,m,center+axis*pos,r,dep,48,.035);o.rotation_euler=axis.to_track_quat('Z','Y').to_euler()
# Arched entry: extruded shaped panels with broad shoulders, a genuine open recess.
def arch_band(name,m,width,height,zbase,yfront,depth,thick):
 # Semicircular arch with vertical lower walls, rectangular section.
 r=width/2;spring=height-r+zbase;pts=[(-r,zbase),(-r,spring)]+[(math.cos(math.pi-j*math.pi/32)*r,spring+math.sin(math.pi-j*math.pi/32)*r) for j in range(33)]+[(r,zbase)]
 outer=[]
 for x,z in pts:
  if z<=spring+.0001:outer.append((x+(-thick if x<0 else thick),z))
  else:
   a=math.atan2(z-spring,x);outer.append((math.cos(a)*(r+thick),spring+math.sin(a)*(r+thick)))
 v=[]
 for y in [yfront,yfront+depth]:
  v.extend([(x,y,z) for x,z in pts]);v.extend([(x,y,z) for x,z in outer])
 n=len(pts);f=[]
 for j in range(n-1):f.extend([(j,j+1,n+j+1,n+j),(2*n+j,3*n+j,3*n+j+1,2*n+j+1),(j,2*n+j,2*n+j+1,j+1),(n+j,n+j+1,3*n+j+1,3*n+j)])
 f.extend([(0,n,3*n,2*n),(n-1,3*n-1,4*n-1,2*n-1)]);return custom(name,m,v,f,.075,True)
arch_band('Architectural entry ceramic arch','porcelain',5.70,6.50,1.27,-10.08,2.2,.66)
arch_band('Machined golden portal surround','gold',5.64,6.46,1.27,-10.21,.27,.17)
arch_band('Recessed warm light gasket','light',5.56,6.42,1.28,-10.01,.055,.045)
arch_band('Portal deep dark inner frame','navy',5.40,6.35,1.28,-9.91,1.75,.10)
# Tall central crest above entrance, beveled shoulders.
cube('Entry upper crest','porcelain',(0,-9.55,7.05),(5.10,1.75,2.07),.27)
cube('Entry crest brass top edge','gold',(0,-10.44,8.00),(4.75,.13,.13),.038)
cube('Entry crest inset ivory plaque','edge',(0,-10.47,7.14),(3.25,.06,1.38),.11)
for s in [-1,1]:
 rail('MOONKATTY M emblem','gold',[(s*.85,-10.52,6.77),(s*.85,-10.52,7.56),(0,-10.52,6.91)],.048)
 rail('MOONKATTY inner M emblem','gold',[(s*.52,-10.52,7.54),(0,-10.52,7.13)],.040)
 # Side buttress: curved structural sweep from low outer footing to crest.
 points=[]
 for j in range(25):
  t=j/24;points.append((s*(3.1+1.6*math.sin(t*math.pi/2)),-8.9+1.0*t,6.60-4.70*t))
 # beveled rectangular cross section swept along curve.
 vv=[]
 for x,y,z in points:vv.extend([(x-s*.20,y-.45,z),(x+s*.20,y-.45,z),(x+s*.20,y+.45,z),(x-s*.20,y+.45,z)])
 ff=[]
 for j in range(24):
  for k in range(4):ff.append((j*4+k,j*4+(k+1)%4,(j+1)*4+(k+1)%4,(j+1)*4+k))
 ff.extend([(0,3,2,1),(96,97,98,99)]);custom('Swept entry shoulder','porcelain',vv,ff,.09,True)
# Warm vestibule with floor, deep walls, entrance framing and control consoles.
cube('Vestibule actual floor','inside',(0,-7.5,1.24),(5.40,5.5,.2),.025)
cube('Vestibule back wall','navy',(0,-4.64,3.75),(5.6,.20,5.2),.04)
for s in [-1,1]:
 cube('Vestibule side wall','inside',(s*2.83,-7.4,3.65),(.35,5.4,4.8),.06)
 for y in [-8.7,-6.7]:
  cube('Vertical vestibule light','light',(s*2.59,y,3.80),(.06,.09,3.65),.025)
 cube('Airlock console','porcelain',(s*2.1,-7.7,2.12),(1.0,1.0,1.7),.12)
 o=cube('Console glass panel','navy',(s*2.1,-8.22,2.49),(.78,.04,.74),.035)
 cube('Console status display','cyan',(s*2.1,-8.25,2.51),(.58,.012,.42),.018)
for y in [-5.0,-7.0]:arch_band('Interior rib','gold',5.14,5.50,1.3,y,.12,.045)
cube('Back airlock door','steel',(0,-4.77,3.39),(2.30,.06,4.08),.07)
for s in [-1,1]:cube('Back door strip','light',(s*1.12,-4.83,3.44),(.045,.03,3.90),.01)
cube('Back door seam','gasket',(0,-4.83,3.39),(.022,.03,4.01),.008)
# Steps and broad solid balustrades, flush inlays.
for i in range(7):cube('Entry step '+str(i),'porcelain',(0,-12.0+i*.38,.12+i*.18),(7.3,5.7-i*.72,.22),.035)
for s in [-1,1]:
 for i in range(3):cube('Entrance flank block','porcelain',(s*4.03,-11.7+i*.77,.53+i*.25),(.52,1.20,1.06+i*.4),.08)
 rail('Short supported entrance guard','gold',[(s*4.03,-12.85,.85),(s*4.03,-10.15,2.16)],.052)
 for y in [-12.45,-11.6,-10.75]:cube('Recessed stair light','light',(s*4.31,y,.50),(.02,.22,.16),.02)
# Bolts only at logical joints; pattern breaks add scale, not ornament everywhere.
for s in [-1,1]:
 for z in [2.0,5.4]:
  o=cyl('Portal radial bolt','gold',(s*3.42,-10.18,z),.08,.045,12,.012);o.rotation_euler.x=math.pi/2
# Convert all modifiers to actual geometry for identical geometry in Blender and WebGL.
bpy.ops.object.select_all(action='DESELECT')
for o in export:
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
# Preview studio: physically grounded, no photographic plate.
def area(name,loc,power,color,size,target):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Warm lunar sun', (18,-14,25),26000,(1,.79,.52),5,(0,0,7));area('Cool fill',(-17,-8,14),9500,(.38,.64,1),13,(0,0,7));area('Upper glint',(-1,14,24),15000,(.60,.80,1),9,(0,0,9));area('Entry warm bounce',(0,-6,5),450,(1,.49,.14),2,(0,-11,3))
world=bpy.data.worlds.new('Space with cool bounce');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.015,.028,.045,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35
floor=cube('Preview ground','inside',(0,0,-.15),(200,200,.1),0);export.remove(floor)
# Export merged material groups, with baked vertex contact occlusion by raycasting actual asset.
print('Baking vertex contact AO...',flush=True)
verts=[];faces=[]
for o in export:
 if o['mat'] in ['glass','light','cyan']:continue
 off=len(verts);verts.extend([o.matrix_world@v.co for v in o.data.vertices]);faces.extend([tuple(off+i for i in p.vertices) for p in o.data.polygons])
bvh=BVHTree.FromPolygons(verts,faces,all_triangles=False)
groups={};cache={};ao_samples=10
for o in export:
 m=o['mat'];g=groups.setdefault(m,{'p':[],'n':[],'uv':[],'ao':[]});me=o.data;me.calc_loop_triangles();normat=o.matrix_world.to_3x3().inverted().transposed()
 for tri in me.loop_triangles:
  for li in tri.loops:
   vi=me.loops[li].vertex_index;pos=o.matrix_world@me.vertices[vi].co;n=(normat@me.corner_normals[li].vector).normalized();key=(o.name,vi,tuple(round(v,2) for v in n))
   if m in ['glass','light','cyan']:ao=1
   elif key in cache:ao=cache[key]
   else:
    hit=0;tan=n.cross(Vector((0,0,1)))
    if tan.length<.01:tan=n.cross(Vector((0,1,0)))
    tan.normalize();bit=n.cross(tan)
    for k in range(ao_samples):
     u=(k+.5)/ao_samples;a=k*2.399963;r=math.sqrt(u);d=tan*(r*math.cos(a))+bit*(r*math.sin(a))+n*math.sqrt(1-u);h=bvh.ray_cast(pos+n*.025,d,2.4)
     if h[0] is not None:hit+=max(.0,1-h[3]/2.4)
    ao=max(.36,1-hit/ao_samples*.89);cache[key]=ao
   g['p'].extend([round(pos.x*1000),round(pos.z*1000),round(-pos.y*1000)]);g['n'].extend([round(n.x*127),round(n.z*127),round(-n.y*127)]);g['ao'].append(round(ao*255))
   # World-scaled coordinates supply subtle surface microtexture in Three.
   g['uv'].extend([pos.x*.5+pos.y*.3,pos.z*.5+pos.y*.3])
def b64(vals,code):return base64.b64encode(struct.pack('<'+code*len(vals),*vals)).decode()
asset={'format':'moonkatty-authored-mesh-v1','source':'Original authored observatory. Built from modeled thick shells, beveled profiles and baked vertex contact AO. No concept image embedded.','materials':{k:{a:b for a,b in v.items() if a!='obj'} for k,v in M.items()},'meshes':[]}
for m,g in groups.items():asset['meshes'].append({'material':m,'position':b64(g['p'],'h'),'normal':b64(g['n'],'b'),'ao':b64(g['ao'],'B'),'uv':b64(g['uv'],'f'),'vertices':len(g['ao'])})
with open(os.path.join(OUT,'observatory.mesh.json'),'w') as f:json.dump(asset,f,separators=(',',':'))
print('Exported',sum(len(g['ao'])//3 for g in groups.values()),'triangles',flush=True)
# Save reproducible editable source and low-resolution physical-lighting diagnostic.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'observatory.blend'))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=False;scene.render.resolution_x=960;scene.render.resolution_y=720;scene.render.resolution_percentage=100
bpy.ops.object.camera_add(location=(22,-35,17));cam=bpy.context.object;cam.rotation_euler=(Vector((0,-1.2,8.1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=48;scene.camera=cam;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(OUT,'observatory-model-preview.png');bpy.ops.render.render(write_still=True)
