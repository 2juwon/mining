# 브라우저 자동 플레이: python3 test/browser.py [페이지 경로]  (스크린샷은 SHOTS 폴더)
import sys, os, json, time
from playwright.sync_api import sync_playwright
page_path = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
SHOTS = os.environ.get('SHOTS', '/tmp/claude-0/shots')
url = 'file://' + os.path.abspath(page_path)
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1440, 'height': 860})
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(700)
    pg.screenshot(path=f'{SHOTS}/01-help.png')
    pg.click('#hOk'); pg.wait_for_timeout(200)
    pg.screenshot(path=f'{SHOTS}/02-camp.png')
    def play(n, shot=None):
        pg.keyboard.press('Space'); pg.wait_for_timeout(300)
        box = pg.locator('#cv').bounding_box()
        t0 = time.time(); k = 0
        while time.time() - t0 < 40:
            if pg.locator('#result').is_visible() or pg.locator('#clearBox').is_visible(): break
            # 가장 많은 바위가 모인 곳으로 마우스 옮기기
            pos = pg.evaluate('''() => { const rs = MG.liveRocks(sess); if (!rs.length) return null; let best=null,bv=-1; for (const c of rs){let v=0; for(const k of rs){const dx=k.x-c.x,dy=k.y-c.y; if(dx*dx+dy*dy<(sess.st.rad+20)**2) v+=1+k.tier+(k.heart?50:0);} if(v>bv){bv=v;best=c}} return {x: best.x*view.s+view.ox, y: best.y*view.s+view.oy}; }''')
            if pos: pg.mouse.move(box['x'] + pos['x'], box['y'] + pos['y'], steps=3)
            pg.wait_for_timeout(120); k += 1
            if shot and k == 25: pg.screenshot(path=f'{SHOTS}/{shot}')
        pg.wait_for_timeout(700)
    play(1, '03-mining.png')
    pg.screenshot(path=f'{SHOTS}/04-result.png')
    r = pg.evaluate('() => ({ores: S.ores, sessions: S.sessions, level: S.level})')
    print('첫 판 뒤', r)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # 스킬 트리에서 살 수 있는 것 사기
    for _ in range(3):
        for el in pg.locator('.node.buy').all()[:3]:
            try: el.click()
            except Exception: pass
    pg.mouse.move(700, 300)
    pg.screenshot(path=f'{SHOTS}/05-tree.png')
    # 진행을 당겨서 깊은 화면 보기: 상태를 직접 만들어 넣음
    pg.evaluate('''() => { S.ores = MG.TIERS.map(()=>5000); S.gems=40; for (let t=0;t<7;t++) MG.buyNode(S,'d'+t); for (const p of MG.PICKS.slice(1,8)) MG.craft(S,p.id); S.ores = MG.TIERS.map(()=>800); S.pts=2; S.level=9; save(); refresh(); }''')
    pg.click('[data-tab="picks"]'); pg.wait_for_timeout(200)
    pg.screenshot(path=f'{SHOTS}/06-picks.png')
    pg.click('[data-tab="talent"]'); pg.wait_for_timeout(200)
    pg.screenshot(path=f'{SHOTS}/07-talent.png')
    pg.keyboard.press('1'); pg.wait_for_timeout(200)
    pg.click('[data-tab="tree"]'); pg.wait_for_timeout(200)
    pg.screenshot(path=f'{SHOTS}/08-tree-deep.png')
    play(2, '09-mining-deep.png')
    # 심장
    pg.evaluate('''() => { toCamp(); S.ores = MG.TIERS.map(()=>1e6); for (let t=7;t<10;t++) MG.buyNode(S,'d'+t); MG.buyNode(S,'heart'); for (const p of MG.PICKS.slice(8)) MG.craft(S,p.id); S.heartHp = 3; save(); refresh(); }''')
    play(3, '10-heart.png')
    pg.screenshot(path=f'{SHOTS}/11-clear.png')
    print('클리어', pg.evaluate('() => ({cleared: S.cleared, ms: runMs()})'))
    pg.click('#clearOk'); pg.wait_for_timeout(400)
    pg.screenshot(path=f'{SHOTS}/12-rank.png')
    # 새로고침해도 이어짐
    pg.reload(); pg.wait_for_timeout(600)
    print('새로고침 뒤', pg.evaluate('() => ({cleared: S.cleared, sessions: S.sessions, depth: MG.depthOf(S)})'))
    m = b.new_page(viewport={'width': 390, 'height': 844})
    m.goto(url); m.wait_for_timeout(500)
    m.screenshot(path=f'{SHOTS}/13-phone.png')
    print('가로 넘침', m.evaluate('() => document.documentElement.scrollWidth > innerWidth'))
    b.close()
print('오류', errs)
