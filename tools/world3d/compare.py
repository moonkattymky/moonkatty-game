from PIL import Image, ImageDraw, ImageFont
import sys
concept = Image.open('/cursor/stores/store-aec859c9-8de3-4a87-9ebb-d27a70ea91ac/grok-bot/agents/2e137442-742f-420a-bc0f-9f91777db88f/attachments/cdf26436feec5efae0c8d2db70000af36a1b0859ea5a9cf243ad600acce98cc2.jpg').convert('RGB')
render = Image.open(sys.argv[1] if len(sys.argv) > 1 else 'renders/concept_match.png').convert('RGB')
W, H = 1024, 576
concept = concept.resize((W, H), Image.LANCZOS); render = render.resize((W, H), Image.LANCZOS)
out = Image.new('RGB', (W * 2 + 12, H + 40), (5, 7, 13))
out.paste(concept, (0, 40)); out.paste(render, (W + 12, 40))
d = ImageDraw.Draw(out)
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
except Exception: f = ImageFont.load_default()
d.text((12, 9), 'CONCEPT ART', fill=(233, 189, 88), font=f)
d.text((W + 24, 9), 'REAL-TIME THREE.JS RENDER (headless, SwiftShader)', fill=(233, 189, 88), font=f)
out.save(sys.argv[2] if len(sys.argv) > 2 else 'renders/compare.png')
print('ok')
