# Tiles per-move contact sheets into overview images: python3 scripts/anim-overview.py <dir> <out-prefix> [per=12]
import sys, glob, os
from PIL import Image
d, out = sys.argv[1], sys.argv[2]
per = int(sys.argv[3]) if len(sys.argv) > 3 else 12
fs = sorted(f for f in glob.glob(os.path.join(d, '*.png')) if not os.path.basename(f).startswith('overview'))
w, h = 600, 180
for b in range(0, len(fs), per):
    chunk = fs[b:b + per]
    rows = (len(chunk) + 1) // 2
    s = Image.new('RGB', (w * 2, h * rows), 'white')
    for i, f in enumerate(chunk):
        s.paste(Image.open(f).convert('RGB').resize((w, h)), ((i % 2) * w, (i // 2) * h))
    p = f'{out}{b // per + 1}.png'
    s.save(p)
    print(p)
