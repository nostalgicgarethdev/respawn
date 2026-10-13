from playwright.sync_api import sync_playwright
C,I,L="#e6e1d4","#16150f","#d6ff3f"
S=lambda body,bg:f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect class="bg" width="1024" height="1024" fill="{bg}"/>{body}</svg>'
# A: exploded isometric cube, one corner block pulled out in lime
def iso(x,y,s,top,left,right,sw=14):
    h=s*0.577
    return (f'<g stroke="{I}" stroke-width="{sw}" stroke-linejoin="round">'
      f'<path d="M{x} {y-h*2} L{x+s} {y-h} L{x} {y} L{x-s} {y-h} Z" fill="{top}"/>'
      f'<path d="M{x-s} {y-h} L{x} {y} L{x} {y+s*1.155} L{x-s} {y+s*1.155-h} Z" fill="{left}"/>'
      f'<path d="M{x+s} {y-h} L{x} {y} L{x} {y+s*1.155} L{x+s} {y+s*1.155-h} Z" fill="{right}"/></g>')
s=110
a=""
cells=[(0,0,0),(1,0,0),(0,1,0),(1,1,0),(0,0,1),(0,1,1),(1,0,1)]
oy0=620
def pos(i,j,k,ox=430,oy=600):
    return ox+(i-j)*s, oy+(i+j)*s*0.577-k*s*1.155
for (i,j,k) in sorted(cells,key=lambda c:(c[2],c[0]+c[1])):
    x,y=pos(i,j,k); a+=iso(x,y,s,C,I,"#5c584e")
x,y=pos(1,1,1); gx,gy=x,y; x+=200; y-=240
h=s*0.577
a+=f'<path d="M{gx} {gy-h*2} L{gx+s} {gy-h} L{gx} {gy} L{gx-s} {gy-h} Z M{gx-s} {gy-h} L{gx-s} {gy+s*1.155-h} M{gx+s} {gy-h} L{gx+s} {gy+s*1.155-h} M{gx} {gy} L{gx} {gy+s*1.155}" fill="none" stroke="{I}" stroke-width="10" stroke-dasharray="18 16" stroke-linecap="round"/>'
a+=iso(x,y,s,L,I,"#5c584e")
# B: heavy wordmark with mirrored R
b=(f'<rect x="72" y="332" width="880" height="360" fill="{I}"/>'
   f'<g font-family="IBM Plex Mono" font-weight="700" font-size="190" fill="{C}" text-anchor="middle">'
   f'<text transform="translate(176 585) scale(-1 1)" fill="{L}">R</text>'
   + "".join(f'<text x="{176+112*(n+1)}" y="585">{ch}</text>' for n,ch in enumerate("ESPAWN")) +
   f'</g><text x="512" y="300" text-anchor="middle" font-family="IBM Plex Mono" font-weight="500" font-size="34" letter-spacing="10" fill="{I}">REVERSE ANYTHING</text>'
   f'<text x="512" y="760" text-anchor="middle" font-family="Instrument Serif" font-style="italic" font-size="64" fill="{I}">take it apart. put it back.</text>')
# C: icon: lime square, serif R sliced in three, middle slice shifted
clip=lambda n,y0,y1:f'<clipPath id="{n}"><rect x="0" y="{y0}" width="1024" height="{y1-y0}"/></clipPath>'
R=lambda dx:f'<text x="{512+dx}" y="790" text-anchor="middle" font-family="Instrument Serif" font-size="800" font-weight="400" stroke="#16150f" stroke-width="14" fill="{I}">R</text>'
c=(f'<rect x="112" y="112" width="800" height="800" rx="40" fill="{L}" stroke="{I}" stroke-width="28"/>'
   f'<defs>{clip("c1",0,400)}{clip("c2",430,600)}{clip("c3",630,1024)}</defs>'
   f'<g clip-path="url(#c1)">{R(-30)}</g><g clip-path="url(#c2)">{R(56)}</g><g clip-path="url(#c3)">{R(-30)}</g>')
css='<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;700&family=Instrument+Serif:ital@0;1&display=block" rel="stylesheet"><style>html,body{margin:0}</style>'
with sync_playwright() as p:
    br=p.chromium.launch(); pg=br.new_page(viewport={"width":1024,"height":1024})
    for k,body in zip("abc",[a,b,c]):
        for suf,bg in [("",C),("-transparent","none")]:
            pg.set_content(css+S(body,bg),wait_until="networkidle"); pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(300)
            pg.locator("svg").screenshot(path=f"concept-{k}{suf}.png",omit_background=True)
    pg.set_viewport_size({"width":1500,"height":640})
    cells="".join(f'<div style="text-align:center"><img src="file:///workspace/respawn/brand/v2/concept-{k}.png" width="440" style="border:2px solid {I}"><div style="margin-top:16px;display:flex;gap:16px;justify-content:center;align-items:center"><img src="file:///workspace/respawn/brand/v2/concept-{k}.png" width="64"><img src="file:///workspace/respawn/brand/v2/concept-{k}.png" width="64" style="border-radius:50%"><span style="font:500 20px IBM Plex Mono">{k.upper()}</span></div></div>' for k in "abc")
    pg.goto("file:///workspace/respawn/brand/v2/")
    pg.set_content(css+f'<body style="background:{C};padding:30px;display:flex;gap:30px">{cells}</body>'); pg.wait_for_timeout(800)
    pg.screenshot(path="sheet.png"); br.close()
