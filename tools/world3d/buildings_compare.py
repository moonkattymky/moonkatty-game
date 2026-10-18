import sys
from PIL import Image, ImageDraw, ImageFont
C='/cursor/stores/store-aec859c9-8de3-4a87-9ebb-d27a70ea91ac/grok-bot/agents/2e137442-742f-420a-bc0f-9f91777db88f/attachments/cdf26436feec5efae0c8d2db70000af36a1b0859ea5a9cf243ad600acce98cc2.jpg'
c=Image.open(C).convert('RGB').resize((1024,576),Image.LANCZOS)
r=Image.open(sys.argv[1] if len(sys.argv)>1 else 'renders/concept_match.png').convert('RGB').resize((1024,576))
items=[('Domes (left)',(285,275,415,362),(268,245,400,368)),
('Reactor ring',(505,300,700,398),(455,290,695,392)),
('Dish module',(395,190,500,325),(390,222,500,342)),
('Corridors',(375,305,535,372),(368,300,525,372)),
('Launch complex',(640,150,780,312),(585,132,755,318)),
('Front domes',(655,335,765,418),(665,295,795,400)),
('Beacon pad + beam',(755,215,885,482),(760,165,900,465)),
('Portal (3 beams)',(815,185,985,312),(795,180,965,315))]
H=220; rows=[]
try: f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',20)
except: f=ImageFont.load_default()
for name,bc,br in items:
  a=c.crop(bc); b=r.crop(br)
  a=a.resize((int(a.width*H/a.height),H),Image.LANCZOS); b=b.resize((int(b.width*H/b.height),H),Image.LANCZOS)
  rows.append((name,a,b))
W=max(a.width+b.width for _,a,b in rows)+60
out=Image.new('RGB',(W,len(rows)*(H+40)+40),'#05070d'); d=ImageDraw.Draw(out)
d.text((20,8),'CONCEPT  |  RENDER',fill='#efd295',font=f)
y=40
for name,a,b in rows:
  d.text((20,y),name,fill='#a8dbc9',font=f); y+=28
  out.paste(a,(20,y)); out.paste(b,(40+a.width,y)); y+=H+12
out.save(sys.argv[2] if len(sys.argv)>2 else 'renders/buildings_compare.png')
