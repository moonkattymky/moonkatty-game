import json,base64,struct,gzip,os,sys
src=sys.argv[1];a=json.load(open(src))
for m in a['meshes']:
 p=base64.b64decode(m['position']);n=base64.b64decode(m['normal']);ao=base64.b64decode(m['ao']);uv=base64.b64decode(m['uv']);seen={};P=bytearray();N=bytearray();A=bytearray();UV=bytearray();I=[]
 for i in range(m['vertices']):
  k=(p[i*6:i*6+6],n[i*3:i*3+3],ao[i],uv[i*8:i*8+8]);ind=seen.get(k)
  if ind is None:
   ind=len(seen);seen[k]=ind;P.extend(k[0]);N.extend(k[1]);A.append(k[2]);UV.extend(k[3])
  I.append(ind)
 m.update(position=base64.b64encode(P).decode(),normal=base64.b64encode(N).decode(),ao=base64.b64encode(A).decode(),uv=base64.b64encode(UV).decode(),index=base64.b64encode(struct.pack('<'+'I'*len(I),*I)).decode(),vertices=len(A))
b=json.dumps(a,separators=(',',':')).encode();dst=src+'.gz';gzip.open(dst,'wb',compresslevel=9).write(b);print('Packed',len(b),'->',os.path.getsize(dst),'bytes,',sum(x['vertices'] for x in a['meshes']),'unique vertices')
