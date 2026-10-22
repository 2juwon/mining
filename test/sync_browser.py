# 계정 연동 시험 (로컬 서버 + 브라우저 2개)
#   cd server && npx wrangler dev --var FAST_TEST:1 --var ADMIN_KEY:test
#   SERVER=http://127.0.0.1:8787 node build.js && python3 test/sync_browser.py ; node build.js
import os
from playwright.sync_api import sync_playwright
PIXI = os.environ.get('PIXI', '/tmp/claude-0/pixi/node_modules/pixi.js-legacy/dist/pixi-legacy.min.js')
SHOTS = os.environ.get('SHOTS', '/tmp/claude-0/out')
url = 'file://' + os.path.abspath('index.html')
errs, fails = [], []
def ok(c, m):
    print(('✓ ' if c else '✗ ') + m)
    if not c: fails.append(m)
def page(b):
    ctx = b.new_context(viewport={'width': 1280, 'height': 800})
    pg = ctx.new_page()
    pg.route('**/pixi-legacy.min.js', lambda r: r.fulfill(path=PIXI, content_type='application/javascript'))
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(1500)
    if pg.is_visible('#hOk'): pg.click('#hOk')
    return pg
BUY = """(id) => { S.ores = S.ores.map(() => 1e9); S.gems = 1e6; const ok = MG.buyNode(S, id); save(); refresh(); return ok; }"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    A = page(b); B = page(b)
    A.evaluate(BUY, 'd1')
    A.click('#syncBtn'); A.wait_for_selector('#syNew')
    A.screenshot(path=f'{SHOTS}/sync-new.png')
    A.click('#syNew'); A.wait_for_selector('#syCode', timeout=10000)
    code = A.inner_text('#syCode')
    ok(len(code) == 14 and A.evaluate('() => SY.code') == code, '연동 코드 만들기 ' + code)
    A.wait_for_timeout(500); A.screenshot(path=f'{SHOTS}/sync-code.png')
    A.click('#syX')
    ok(A.evaluate('() => syncState') == 'ok', '구름 아이콘 = 저장됨')
    # B에서 가져오기
    B.click('#syncBtn'); B.fill('#syIn', code.lower().replace('-', '')); B.click('#syFind')
    B.wait_for_selector('#syUse', timeout=10000)
    B.screenshot(path=f'{SHOTS}/sync-find.png')
    ok('구리 광맥까지' in B.inner_text('#syPrev'), '찾은 기록 요약: ' + B.inner_text('#syPrev .sy-sum'))
    B.click('#syUse'); B.wait_for_timeout(600)
    ok(B.evaluate('() => MG.lvOf(S, "d1") === 1 && SY.code') == code, '다른 기기에서 이어 하기 (구리 광맥 열린 채)')
    # B에서 진행 → 4초 뒤 저절로 저장 → A가 다시 볼 때 조용히 받아 옴
    B.evaluate(BUY, 'd2')
    ok(B.evaluate('() => syncState') == 'wait', '바뀌면 곧 저장 표시')
    B.wait_for_timeout(5500)
    ok(B.evaluate('() => syncState === "ok" && !SY.dirty'), '4초 뒤 저절로 저장')
    A.evaluate('() => save(true)')  # A는 자동 광산만
    A.evaluate('() => pullSave()'); A.wait_for_timeout(1200)
    ok(A.evaluate('() => MG.lvOf(S, "d2") === 1') and not A.is_visible('#cfRemote'), '자동 광산만 늘어난 기기는 묻지 않고 다른 기기 기록을 받음')
    # A만 진행, B는 자동 광산만 저장 → A가 B를 덮음 (묻지 않음)
    B.evaluate('() => { S.ores[0] += 5; save(true); return pushSave(); }'); B.wait_for_timeout(800)
    A.evaluate(BUY, 'd3'); A.evaluate('() => pushSave()'); A.wait_for_timeout(1500)
    ok(not A.is_visible('#cfRemote') and A.evaluate('() => syncState') == 'ok', '저쪽이 자동 광산만이면 이 기기 기록으로 덮음')
    B.evaluate('() => pullSave()'); B.wait_for_timeout(1200)
    ok(B.evaluate('() => MG.lvOf(S, "d3") === 1'), 'B도 A 기록을 받음')
    # 둘 다 진행 → 고르기 창
    A.evaluate(BUY, 'd4'); B.evaluate(BUY, 'd1a' if B.evaluate('() => !!MG.NODE.d1a') else 'd4')
    B.evaluate('() => { S.level = 33; save(); return pushSave(); }'); B.wait_for_timeout(800)
    A.evaluate('() => pushSave()'); A.wait_for_timeout(1500)
    ok(A.is_visible('#cfRemote') and A.evaluate('() => syncState') == 'conflict', '두 기기 다 진행했으면 어느 기록으로 할지 물음')
    A.screenshot(path=f'{SHOTS}/sync-conflict.png')
    A.keyboard.press('Escape'); A.wait_for_timeout(200)
    ok(A.is_visible('#cfRemote'), 'Esc로는 안 닫힘')
    A.click('#cfLocal'); A.wait_for_timeout(1500)
    ok(A.evaluate('() => syncState === "ok" && S.level !== 33'), '이 기기 기록으로 맞춤')
    B.evaluate('() => pullSave()'); B.wait_for_timeout(1200)
    ok(B.evaluate('() => S.level !== 33 && MG.lvOf(S, "d4") === 1'), 'B도 그 기록을 받음')
    # 다른 쪽 고르기
    A.evaluate('() => { S.level = 44; save(); }'); B.evaluate('() => { S.level = 55; save(); return pushSave(); }'); B.wait_for_timeout(800)
    A.evaluate('() => pushSave()'); A.wait_for_timeout(1500)
    A.click('#cfRemote'); A.wait_for_timeout(1500)
    ok(A.evaluate('() => S.level === 55 && syncState === "ok"'), '다른 기기 기록 고르기')
    # 채굴 중에는 바꾸지 않고 끝난 뒤에
    B.evaluate('() => { S.level = 66; save(); return pushSave(); }'); B.wait_for_timeout(800)
    A.evaluate('() => { startSession(); }'); A.wait_for_timeout(500)
    A.evaluate('() => pullSave()'); A.wait_for_timeout(1500)
    ok(A.evaluate('() => S.level') != 66, '채굴 중에는 안 바꿈')
    A.evaluate('() => { sess.over = true; endSessionNow(true); }'); A.wait_for_timeout(500)
    A.evaluate('() => toCamp()'); A.wait_for_timeout(3500)
    lv = A.evaluate('() => S.level')
    ok(A.is_visible('#cfRemote') or lv == 66, '채굴이 끝나면 다시 판단 (방금 채굴했으니 고르기 창) lv=' + str(lv))
    if A.is_visible('#cfLocal'): A.click('#cfLocal'); A.wait_for_timeout(1200)
    # 테스트 모드에선 연동 안 함
    A.wait_for_timeout(1000)
    A.evaluate('() => enterTest()')  # 로고 7번 = 이스터 에그 (testmode_browser.py에서 따로 시험)
    A.evaluate('() => { S.level = 99; save(); }')
    ok(A.evaluate('() => TEST.on && !SY.dirty'), '테스트 모드 변경은 연동 저장 안 함')
    A.evaluate('() => exitTest()'); A.wait_for_timeout(1200)
    ok(A.evaluate('() => !TEST.on && S.level !== 99'), '테스트 모드 나와도 진짜 기록 그대로')
    # 연동 끊기
    A.click('#syncBtn'); A.wait_for_selector('#syOff'); A.click('#syOff'); A.click('#syOff'); A.wait_for_timeout(300)
    ok(A.evaluate('() => !SY.code') and A.is_visible('#syNew'), '이 기기에서 연동 끊기 (두 번 눌러)')
    A.click('#syX')
    # 새로고침해도 연동 유지
    B.reload(); B.wait_for_timeout(2500)
    ok(B.evaluate('() => SY.code') == code and B.evaluate('() => syncState') == 'ok', '새로고침해도 연동 유지')
    B.screenshot(path=f'{SHOTS}/sync-top.png', clip={'x': 900, 'y': 0, 'width': 380, 'height': 70})
    b.close()
print('오류', errs)
print('실패' if fails else '모두 통과', len(fails))
