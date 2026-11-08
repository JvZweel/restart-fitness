import sys,glob,os
from PIL import Image, ImageDraw
files=sorted(glob.glob('/tmp/anim/*.png'))
ids=sorted(set(os.path.basename(f).rsplit('-',1)[0] for f in files))
if len(sys.argv)>1: ids=[i for i in ids if i in sys.argv[1].split(',')]
W,H=270,240; per=8
for b in range(0,len(ids),per):
    chunk=ids[b:b+per]
    sheet=Image.new('RGB',(W*4,H*((len(chunk)+1)//2)),'white')
    for n,i in enumerate(chunk):
        for k in range(2):
            im=Image.open(f'/tmp/anim/{i}-{k}.png').convert('RGB').resize((W,H))
            d=ImageDraw.Draw(im); d.text((4,4),f'{i} k{k}',fill='black')
            sheet.paste(im,((n%2)*2*W+k*W,(n//2)*H))
    sheet.save(f'/tmp/anim/sheet{b//per}.png')
    print(f'/tmp/anim/sheet{b//per}.png')
