# 랭킹 흐름: cd server && npx wrangler dev --var FAST_TEST:1 → SERVER=http://127.0.0.1:8787 node build.js → python3 test/online_browser.py
import os
from playwright.sync_api import sync_playwright
SHOTS = os.environ.get('SHOTS', '/tmp/claude-0/shots')
url = 'file://' + os.path.abspath('index.html')
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1440, 'height': 860})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(900)
    pg.click('#hOk')
    run = pg.evaluate('() => S.run')
    print('도전 시작', bool(run and run.get('id')))
    pg.click('[data-tab="rank"]'); pg.wait_for_timeout(500)
    pg.screenshot(path=f'{SHOTS}/20-rank-running.png')
    pg.wait_for_timeout(1300)
    # 심장 앞까지 당겨 놓고 깨기
    pg.evaluate('''() => { S.ores = MG.TIERS.map(()=>1e7); for (let t=1;t<10;t++) MG.buyNode(S,'d'+t); MG.buyNode(S,'heart'); for (const p of MG.PICKS.slice(1)) MG.craft(S,p.id); S.heartHp = 2e5; S.sessions = 60; save(); refresh(); }''')
    pg.keyboard.press('Space'); pg.wait_for_timeout(300)
    box = pg.locator('#cv').bounding_box()
    pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + 70 + (box['height'] - 70) / 2)
    pg.wait_for_timeout(500)
    pg.screenshot(path=f'{SHOTS}/21-heart.png')
    pg.wait_for_selector('#cName', timeout=30000)
    pg.screenshot(path=f'{SHOTS}/22-clear-rank.png')
    pg.fill('#cName', '두번째광부')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(800)
    print('결과', pg.evaluate('() => S.runResult'))
    pg.click('#clearOk'); pg.wait_for_timeout(800)
    pg.screenshot(path=f'{SHOTS}/23-rank-board.png')
    print('표', pg.evaluate('() => boardCache && boardCache.list.map(e => e.name + " " + e.ms)'))
    b.close()
print('오류', errs)
