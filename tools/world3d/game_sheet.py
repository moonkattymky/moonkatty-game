# Contact sheet of the phone game screenshots made by tools/game_test.mjs -> renders/game_sheet.png
from PIL import Image, ImageDraw, ImageFont
F = [('hook_start', '0s: reactor out'), ('hook_first_crystal', '<5s: first crystal'), ('hook_reward', 'first reward'), ('hook_power_on', 'base lights back on'),
     ('hud_phone', 'HUD + travel route'), ('gate', 'travel gate'), ('crack', 'crack (JET hop)'), ('mining', 'mining timing bar'), ('mining_crack', 'miss: crystal cracked'), ('parts_compass', 'antenna parts + compass'),
     ('meteor', 'meteor shower / lives'), ('install', 'dish install (hold)'), ('puzzle', 'reactor pipe puzzle'), ('sprint', 'ring sprint'), ('sprint_done', 'sprint stars'), ('quests_panel', 'quests + Secrets 1/6'), ('puzzle_solved', 'puzzle solved'),
     ('secret_cache', 'secret cache'), ('robot_build', 'robot builds depot'), ('chapter_done', 'chapter done'), ('robot_done', 'base grows')]
COLS = 7
W, H, L = 390, 844, 24
rows = (len(F) + COLS - 1) // COLS; sheet = Image.new('RGB', (W * COLS, (H + L) * rows), '#101418'); d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
except Exception: font = ImageFont.load_default()
for i, (f, label) in enumerate(F):
    im = Image.open(f'renders/game_{f}.png').convert('RGB').resize((W, H)); x, y = (i % COLS) * W, (i // COLS) * (H + L)
    d.text((x + 6, y + 5), label, fill='#d8d2c4', font=font); sheet.paste(im, (x, y + L))
sheet.save('renders/game_sheet.png'); print('renders/game_sheet.png', sheet.size)
