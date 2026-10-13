from playwright.sync_api import sync_playwright
C,I,L,G="#e6e1d4","#16150f","#d6ff3f","#5c584e"
def iso(x,y,s,top,sw):
    h=s*0.577
    return (f'<g stroke="{I}" stroke-width="{sw}" stroke-linejoin="round">'
      f'<path d="M{x} {y-h*2} L{x+s} {y-h} L{x} {y} L{x-s} {y-h} Z" fill="{top}"/>'
      f'<path d="M{x-s} {y-h} L{x} {y} L{x} {y+s*1.155} L{x-s} {y+s*1.155-h} Z" fill="{I}"/>'
      f'<path d="M{x+s} {y-h} L{x} {y} L{x} {y+s*1.155} L{x+s} {y+s*1.155-h} Z" fill="{G}"/></g>')
def blocks(ox,oy,s,sw,lift=True):
    cells=[(0,0,0),(1,0,0),(0,1,0),(1,1,0),(0,0,1),(0,1,1),(1,0,1)]
    pos=lambda i,j,k:(ox+(i-j)*s, oy+(i+j)*s*0.577-k*s*1.155)
    out=""
    for c in sorted(cells,key=lambda c:(c[2],c[0]+c[1])): out+=iso(*pos(*c),s,C,sw)
    x,y=pos(1,1,1)
    out+=iso(x+s*1.45,y-s*1.75,s,L,sw)
    return out
svg=lambda body,w,h,bg:f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="{w}" height="{h}" fill="{bg}"/>{body}</svg>'
icon='<g id="m" data-box="80 80 864 864">'+blocks(450,610,112,16)+'</g>'
word=(f'<rect x="0" y="0" width="1040" height="300" fill="{I}"/><g font-family="IBM Plex Mono" font-weight="700" font-size="200" fill="{C}" text-anchor="middle">'
   f'<text transform="translate(110 225) scale(-1 1)" fill="{L}">R</text>'+"".join(f'<text x="{110+120*(n+1)}" y="225">{ch}</text>' for n,ch in enumerate("ESPAWN"))+'</g>')
lock=('<g id="m" data-box="50 70 360 460">'+blocks(250,420,70,11)+'</g>'+f'<g transform="translate(470 150) scale(0.62)">{word}</g>'
      f'<text x="470" y="400" font-family="Instrument Serif" font-style="italic" font-size="52" fill="{I}">take it apart. put it back.</text>'
      f'<text x="470" y="460" font-family="IBM Plex Mono" font-weight="500" font-size="26" letter-spacing="8" fill="{G}">REVERSEANYTHING.BEAUTY</text>')
css='<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;700&family=Instrument+Serif:ital@0;1&display=block" rel="stylesheet"><style>html,body{margin:0}</style>'
jobs=[("respawn-blocks.png",svg(icon,1024,1024,C),1024,1024),("respawn-blocks-transparent.png",svg(icon,1024,1024,"none"),1024,1024),
      ("respawn-lockup.png",svg(lock,1200,600,C),1200,600),("respawn-lockup-transparent.png",svg(lock,1200,600,"none"),1200,600)]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page()
    for n,s,w,h in jobs:
        pg.set_viewport_size({"width":w,"height":h}); pg.set_content(css+s,wait_until="networkidle"); pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(300)
        pg.evaluate("""()=>{const g=document.getElementById('m');const [x,y,w,h]=g.dataset.box.split(' ').map(Number);const b=g.getBBox();const k=Math.min(w/b.width,h/b.height);g.setAttribute('transform',`translate(${x+(w-b.width*k)/2-b.x*k} ${y+(h-b.height*k)/2-b.y*k}) scale(${k})`)}""")
        pg.evaluate("""()=>{const g=document.getElementById('m');const [x,y,w,h]=g.dataset.box.split(' ').map(Number);const b=g.getBBox();const k=Math.min(w/b.width,h/b.height);g.setAttribute('transform',`translate(${x+(w-b.width*k)/2-b.x*k} ${y+(h-b.height*k)/2-b.y*k}) scale(${k})`)}""")
        pg.locator("svg").screenshot(path=n,omit_background=True)
    b.close()
from PIL import Image
im=Image.open("respawn-blocks.png"); sheet=Image.new("RGB",(400,140),C)
for i,(sz) in enumerate([64,32,16]): sheet.paste(im.resize((sz,sz),Image.LANCZOS),(20+i*90,30))
r=Image.open("/workspace/respawn/brand/v2/concept-c.png")
for i,sz in enumerate([64,32]): sheet.paste(r.resize((sz,sz),Image.LANCZOS),(250+i*80,30))
sheet.save("small-test.png")
