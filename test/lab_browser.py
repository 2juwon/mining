# 실험실 시험: python3 test/lab_browser.py  (pixi는 로컬 node_modules 파일로 대신 줌)
import os, sys, json
from playwright.sync_api import sync_playwright
PIXI = os.environ.get('PIXI', '/tmp/claude-0/pixi/node_modules/pixi.js-legacy/dist/pixi-legacy.min.js')
SHOTS = os.environ.get('SHOTS', '/tmp/claude-0/out')
url = 'file://' + os.path.abspath('lab/index.html')
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1600, 'height': 900})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and 'fonts' not in m.text and errs.append(m.text))
    pg.route('**/pixi-legacy.min.js', lambda r: r.fulfill(path=PIXI, content_type='application/javascript'))
    pg.goto(url); pg.wait_for_timeout(1500)
    print('엔진', pg.evaluate('() => LAB.glName'))
    for n in [500, 2000, 5000]:
        pg.evaluate(f'() => {{ LAB.P.N = {n}; LAB.P.auto = true; LAB.P.boom = 0.15; LAB.P.rad = 160; LAB.P.swing = 0.15; }}')
        pg.wait_for_timeout(4000)
        st = pg.evaluate('() => ({alive: LAB.alive, fps: Math.round(LAB.fps), calc: +LAB.calcMs.toFixed(2), parts: LAB.particles, broken: LAB.broken})')
        print(n, st)
        pg.screenshot(path=f'{SHOTS}/lab-{n}.png')
    pg.evaluate('() => LAB.bigBoom()'); pg.wait_for_timeout(500)
    pg.screenshot(path=f'{SHOTS}/lab-boom.png')
    print('와르르 뒤', pg.evaluate('() => ({alive: LAB.alive, calc: +LAB.calcMs.toFixed(2), parts: LAB.particles})'))
    b.close()
print('오류', errs)
