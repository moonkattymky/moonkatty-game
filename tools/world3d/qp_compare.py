# side-by-side at identical CSS scale: concept phone (1eb41bee right panel, ~1 img px = 1 CSS px) vs our phone (dpr2) + desktop crop
from PIL import Image, ImageDraw
C = '/cursor/stores/store-aec859c9-8de3-4a87-9ebb-d27a70ea91ac/grok-bot/agents/2e137442-742f-420a-bc0f-9f91777db88f/attachments/1eb41bee5da8c5142dc9e9b4c708bed2bc7d7542460ad37a90978e938d558b14.jpg'
im = Image.open(C).convert('RGB'); c = im.crop((861, 10, 861 + 200, 10 + 260)).resize((400, 520), Image.LANCZOS)
q = Image.open('renders/qp_phone.png').convert('RGB').crop((0, 0, 400, 520))
d = Image.open('renders/qp_desktop.png').convert('RGB').crop((0, 0, 260, 300)).resize((451, 520), Image.LANCZOS)
full_c = im.crop((861, 10, 1256, 710)).resize((300, 532)); full_q = Image.open('renders/qp_phone.png').convert('RGB').resize((300, 649)).crop((0, 0, 300, 532))
W = Image.new('RGB', (400 + 400 + 451 + 300 + 300 + 50, 560), (10, 14, 28)); g = ImageDraw.Draw(W)
x = 0
for img, lab in [(c, 'CONCEPT (2x crop)'), (q, 'OURS phone 390x844 (2x crop)'), (d, 'OURS desktop 1280x720'), (full_c, 'concept full'), (full_q, 'ours full')]:
    W.paste(img, (x, 28)); g.text((x + 6, 8), lab, fill=(230, 230, 230)); x += img.width + 10
W.save('renders/quest_panel_vs_concept.png'); print(W.size)
