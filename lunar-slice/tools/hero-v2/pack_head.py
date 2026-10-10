import json,struct,os,gzip,sys
P='/workspace/scratch/d69cb29e406b/moonkatty-lunar-slice/lunar-slice/art/hero-v2/'
prefix=sys.argv[1] if len(sys.argv)>1 else 'head'
data=json.load(open('/tmp/hero-v2-full-mesh.json' if prefix=='hero' else '/tmp/hero-v2-head-mesh.json'))
# Weld all same-material geometry inside each independently articulated rig group.
groups={}
for item in data:
 key=(item['material'],item.get('rig','head'))
 if key not in groups:groups[key]={'name':item['material']+' • '+key[1],'material':item['material'],'rig':key[1],'pivot':item.get('pivot',[0,0,0]),'position':[],'normal':[],'color':[],'uv':[]}
 for a in ['position','normal','color','uv']:groups[key][a]+=item[a]
data=list(groups.values());blob=bytearray();meshes=[]
def append(values,code):
 while len(blob)%4:blob.append(0)
 offset=len(blob);blob.extend(struct.pack('<'+str(len(values))+code,*values));return {'offset':offset,'count':len(values)}
for item in data:
 n=len(item['position'])//3;unique={};p=[];norm=[];col=[];uv=[];ix=[]
 minimum=[min(item['position'][k::3])for k in range(3)];maximum=[max(item['position'][k::3])for k in range(3)];center=[(a+b)*.5 for a,b in zip(minimum,maximum)];scale=[max(.000001,(b-a)*.5)for a,b in zip(minimum,maximum)]
 for i in range(n):
  q=item['position'][i*3:i*3+3];no=item['normal'][i*3:i*3+3];c=item['color'][i*3:i*3+3];u=item.get('uv',[])[i*2:i*2+2]or[0,0]
  quantp=[round(max(-1,min(1,(q[k]-center[k])/scale[k]))*32767)for k in range(3)];quantn=[round(max(-1,min(1,x))*127)for x in no];quantc=[round(max(0,min(1,x))*255)for x in c];quantu=[round(max(0,min(1,x))*65535)for x in u]
  key=tuple(quantp+quantn+quantc+quantu)
  if key not in unique:
   unique[key]=len(p)//3;p+=quantp;norm+=quantn;col+=quantc;uv+=quantu
  ix.append(unique[key])
 for i in range(0,len(ix),3):ix[i+1],ix[i+2]=ix[i+2],ix[i+1]
 code='H'if len(p)//3<65536 else'I'
 meshes.append({'name':item['name'],'material':item['material'],'rig':item['rig'],'pivot':item['pivot'],'center':center,'scale':scale,'indexType':code,'position':append(p,'h'),'normal':append(norm,'b'),'color':append(col,'B'),'uv':append(uv,'H'),'index':append(ix,code)})
with gzip.open(P+prefix+'.bin.gz','wb',compresslevel=9)as f:f.write(blob)
json.dump({'version':2,'triangles':sum(x['index']['count']//3 for x in meshes),'meshes':meshes},open(P+prefix+'.json','w'),separators=(',',':'))
print('Packed',len(blob),'bytes;',os.path.getsize(P+prefix+'.bin.gz'),'gzip bytes;',sum(x['index']['count']//3 for x in meshes),'triangles;',len(meshes),'meshes')
