// 규칙 시험: node test/rules.test.js
const MG = require('../src/engine.js');
let n = 0, fails = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('✗', m); } };

// 처음 상태
let s = MG.newState(0);
ok(MG.depthOf(s) === 0 && s.picks.eq === 'p0', '처음엔 돌층, 나무 곡괭이');
ok(MG.nodeState(s, 'd1') === 'open', '구리 광맥은 돌이 모자라면 못 삼');
ok(MG.nodeState(s, 'dmg1') === 'open' && MG.nodeState(s, 'spd1') === 'locked', '옆 가지는 그 줄 기둥이 열려야 보임');
ok(!MG.buyNode(s, 'd1'), '돈 없이 못 삼');
s.ores[0] = 1000;
ok(MG.buyNode(s, 'd1') && MG.depthOf(s) === 1, '구리 광맥 열기');
ok(s.ores[0] === 1000 - MG.nodeCost(MG.NODE.d1, 0)[0], '값만큼 돌이 줄어듦');
ok(MG.nodeState(s, 'd1') === 'max', '기둥은 한 번만');
ok(MG.nodeState(s, 'spd1') === 'open', '구리층 가지가 열림');
ok(MG.nodeState(s, 'crit1') === 'locked', '바깥 가지는 안쪽 가지를 먼저');
// 레벨마다 값이 오름
s.ores[0] = 1e6;
const c0 = MG.nodeCost(MG.NODE.dmg1, 0)[0], c1 = MG.nodeCost(MG.NODE.dmg1, 1)[0];
MG.buyNode(s, 'dmg1');
ok(c1 > c0 && MG.lvOf(s, 'dmg1') === 1, '레벨이 오르면 값도 오름');
for (let i = 0; i < 10; i++) MG.buyNode(s, 'dmg1');
ok(MG.lvOf(s, 'dmg1') === MG.NODE.dmg1.max, '최대 레벨까지만');
ok(Math.abs(MG.stats(s).dmgMul - (1 + 0.2 * 5)) < 1e-9, '공격력 배수 반영');

// 곡괭이
ok(MG.pickState(s, 'p2') === 'locked', '앞 곡괭이를 먼저 만들어야 함');
ok(MG.craft(s, 'p1') && s.picks.eq === 'p1', '돌 곡괭이 만들면 바로 듦');
ok(MG.pickState(s, 'p3') === 'locked', '철이 안 나오는 깊이에선 철 곡괭이 못 만듦');
s.gems = 100;
ok(MG.upgradePick(s, 'p1') && s.picks.up.p1 === 1 && s.gems === 100 - MG.pickUpCost(0), '보석으로 강화');
ok(Math.abs(MG.stats(s).dmg - MG.PICK.p1.dmg * 2 * 1.15) < 1e-9, '강화가 공격력에 반영');

// 레벨과 카드
s = MG.newState(0);
const need = MG.xpNeed(1);
ok(MG.addXp(s, need + 1) === 1 && s.level === 2 && s.pts === 1, '경험치로 레벨 업, 카드 1장');
const offer = MG.openOffer(s, MG.rng(3));
ok(offer.length === 3 && new Set(offer.map((x) => x.split(':')[0])).size === 3, '서로 다른 카드 3장');
ok(MG.openOffer(s) === offer, '고르기 전엔 카드가 바뀌지 않음(새로고침해도 같음)');
ok(MG.pickCard(s, 0) && s.pts === 0 && s.cards === 1 && !s.offer, '카드 고르기');
ok(Math.abs(MG.stats(s).hpMul - (1 + MG.CARD_HP)) < 1e-9, '카드 한 장마다 바위 체력 오름');
ok(!MG.pickCard(s, 0), '점수 없으면 못 고름');

// 재능 카드 다시 뽑기·고정
s = MG.newState(0); MG.addXp(s, MG.xpNeed(1) + MG.xpNeed(2) + 1);
ok(s.pts === 2, '카드 2장 고를 수 있음');
const o1 = MG.openOffer(s, MG.rng(11)).slice();
ok(s.rerolls === MG.REROLLS && MG.REROLLS === 2 && s.offerLock === -1, '새 카드 3장마다 다시 뽑기 2번');
ok(MG.lockCard(s, 1) && s.offerLock === 1, '가운데 카드 고정');
ok(MG.lockCard(s, 2) && s.offerLock === 2, '다른 카드를 누르면 고정이 그쪽으로 (한 장만)');
ok(MG.lockCard(s, 2) && s.offerLock === -1, '같은 카드를 다시 누르면 고정 풀림');
MG.lockCard(s, 0);
ok(MG.reroll(s, MG.rng(12)), '다시 뽑기 1번');
ok(s.offer[0] === o1[0], '고정한 카드는 그대로');
const ids = s.offer.map((x) => x.split(':')[0]), oldIds = o1.map((x) => x.split(':')[0]);
ok(ids[1] !== oldIds[1] && ids[2] !== oldIds[2] && !oldIds.includes(ids[1]) && !oldIds.includes(ids[2]), '나머지는 보이던 카드와 다른 카드로');
ok(new Set(ids).size === 3, '세 장은 서로 다름');
ok(s.rerolls === 1, '남은 다시 뽑기 1번');
MG.reroll(s, MG.rng(13));
ok(s.rerolls === 0 && !MG.reroll(s, MG.rng(14)), '2번 쓰면 더는 못 함');
ok(s.offer[0] === o1[0], '두 번째에도 고정 카드 그대로');
MG.pickCard(s, 1);
const o2 = MG.openOffer(s, MG.rng(15));
ok(o2 && s.rerolls === 2 && s.offerLock === -1, '카드를 고르면 다음 카드 3장에 다시 뽑기 2번이 새로 생기고 고정은 풀림');
const oldOffer = MG.fix({ ores: [0], skills: {}, picks: { own: ['p0'], eq: 'p0', up: {} }, pts: 1, offer: ['dmg:0', 'spd:0', 'rad:0'] });
ok(oldOffer.rerolls === 2 && oldOffer.offerLock === -1, '예전 저장(카드가 떠 있던 상태)은 다시 뽑기 2번으로');

// 채굴 한 판
s = MG.newState(0);
const r = MG.rng(9);
let sess = MG.newSession(s, r);
ok(sess.rocks.length === MG.stats(s).rocks, '시작할 때 바위가 꽉 참');
ok(sess.rocks.every((k) => k.tier === 0), '돌층에선 돌만');
let k = sess.rocks[0];
for (let i = 0; i < 400 && !sess.over; i++) MG.step(s, sess, 1 / 30, { x: k.x, y: k.y });
ok(sess.over && sess.timeLeft === 0, '시간이 다 되면 끝');
ok(s.ores[0] > 0 && sess.broken > 0, '마우스 아래 바위를 캠');
const res = MG.endSession(s, sess);
ok(s.sessions === 1 && s.best === res.score, '판 수·최고 점수 기록');
sess = MG.newSession(s, r);
for (let i = 0; i < 400 && !sess.over; i++) MG.step(s, sess, 1 / 30, null);
ok(sess.broken === 0, '마우스가 채굴장 밖이면 안 캠');

// 깊이에 따라 나오는 광석
s = MG.newState(0); s.ores = MG.TIERS.map(() => 1e9);
for (let t = 1; t <= 4; t++) MG.buyNode(s, 'd' + t);
const st = MG.stats(s);
ok(st.weights[4] === 1 && st.weights[5] === 0 && st.weights[0] < st.weights[3], '가장 깊은 광석이 가장 잦고 아직 안 연 광석은 안 나옴');

// 심장
s = MG.newState(0); s.ores = MG.TIERS.map(() => 1e9);
ok(MG.nodeState(s, 'heart') === 'locked', '심장은 별철 광맥 뒤');
for (let t = 1; t < 10; t++) MG.buyNode(s, 'd' + t);
ok(MG.buyNode(s, 'heart') && s.heartOpen, '심장 열기');
sess = MG.newSession(s, MG.rng(1));
const heart = sess.rocks.find((x) => x.heart);
ok(heart && heart.x === MG.W / 2, '심장이 가운데 나옴');
s.heartHp = 5; heart.hp = 5;
for (let i = 0; i < 60 && !s.cleared; i++) MG.step(s, sess, 1 / 30, { x: heart.x, y: heart.y });
ok(s.cleared && s.clearAt, '심장을 깨면 클리어');
sess = MG.newSession(s, MG.rng(2));
ok(!sess.rocks.some((x) => x.heart), '깬 뒤엔 심장이 안 나옴');
// 심장 체력은 판이 바뀌어도 이어짐
s = MG.newState(0); s.ores = MG.TIERS.map(() => 1e9);
for (let t = 1; t < 10; t++) MG.buyNode(s, 'd' + t);
MG.buyNode(s, 'heart');
sess = MG.newSession(s, MG.rng(4));
for (let i = 0; i < 100; i++) MG.step(s, sess, 1 / 30, { x: MG.W / 2, y: MG.H / 2 });
const left = s.heartHp;
ok(left < MG.HEART.hp, '심장에 피해가 쌓임');
sess = MG.newSession(s, MG.rng(5));
ok(sess.rocks.find((x) => x.heart).hp === left, '다음 판에 남은 체력 그대로');

// 자동 광산
s = MG.newState(0); s.ores = MG.TIERS.map(() => 1e6);
MG.buyNode(s, 'd1');
ok(MG.mineRates(s).every((x) => x === 0), '자동 광산을 열기 전엔 0');
MG.buyNode(s, 'rocks1'); MG.buyNode(s, 'spawn1'); ok(MG.buyNode(s, 'mine1'), '자동 광산 열기');
const before = s.ores[1];
MG.idle(s, 3600);
ok(s.ores[1] > before, '자동 광산이 광석을 캠');

// 광석 숙련
s = MG.newState(0); s.ores = MG.TIERS.map(() => 1e9);
ok(MG.nodeState(s, 'm0') === 'locked', '돌 숙련은 구리 광맥 전엔 잠김');
MG.buyNode(s, 'd1');
ok(MG.nodeState(s, 'm0') === 'buy' && MG.nodeState(s, 'm1') === 'locked', '한 층 내려가면 지난 광석 숙련이 열림');
const sc = MG.nodeCost(MG.NODE.m0, 0);
ok(Object.keys(sc).join() === '0', '돌 숙련은 돌로만 값을 냄');
for (let i = 0; i < 30; i++) MG.buyNode(s, 'm0');
ok(MG.lvOf(s, 'm0') === 30 && MG.nodeState(s, 'm0') === 'buy', '숙련은 레벨 끝없음');
MG.buyNode(s, 'd2'); for (let i = 0; i < 10; i++) MG.buyNode(s, 'm1');
const st2 = MG.stats(s);
ok(Math.abs(st2.mast - 0.015 * 40) < 1e-9 && Math.abs(st2.dmgMul - (1 + 0.015 * 40)) < 1e-9, '숙련끼리는 더해서 공격력 배수 하나로');
ok(MG.nodeCost(MG.NODE.m0, 30)[0] > MG.nodeCost(MG.NODE.m0, 29)[0], '숙련 값은 레벨마다 오름');
ok(MG.nodeState(s, 'm9') === 'locked', '별철 숙련은 심장을 연 뒤');

// 바위 수천 개: 칸 나누기·연쇄 이어짐·다시 차기
s = MG.newState(0); s.ores = MG.TIERS.map(() => 1e15);
for (let t = 1; t < 10; t++) MG.buyNode(s, 'd' + t);
for (let k = 0; k < 6; k++) for (const n of MG.NODES) if (n.max !== Infinity && n.k !== 'heart') for (let i = 0; i < 5; i++) MG.buyNode(s, n.id);
for (const p of MG.PICKS) MG.craft(s, p.id);
let stL = MG.stats(s);
ok(stL.rocks >= 2500 && stL.field > 5, '끝 무렵 바위 수천 개, 채굴장 넓어짐 (' + stL.rocks + '개, ' + stL.field.toFixed(1) + '배)');
ok(stL.radE > stL.rad * 4, '고리도 채굴장과 함께 넓어짐');
sess = MG.newSession(s, MG.rng(3));
ok(sess.alive > stL.rocks * 0.9, '시작할 때 거의 꽉 참 (' + sess.alive + ')');
let cnt = 0; MG.near(sess, stL.W / 2, stL.H / 2, 400, () => cnt++);
let brute = 0; for (const k of sess.rocks) { if (k.dead || k.born > sess.t) continue; const dx = k.x - stL.W / 2, dy = k.y - stL.H / 2; if (dx * dx + dy * dy <= 400 * 400) brute++; }
ok(cnt === brute, '칸으로 찾은 바위 수 = 전부 훑은 수 (' + cnt + ')');
function chainRun(keep) {
  const ss = MG.newSession(s, MG.rng(9)); ss.st.boom = 1; ss.st.keep = keep;
  for (let i = 0; i < 150; i++) { MG.step(s, ss, 1 / 30, { x: ss.st.W / 2, y: ss.st.H / 2 }); ss.ev.length = 0; }
  return ss.genMax;
}
const g0 = chainRun(0), g1 = chainRun(1);
ok(g0 <= 1, '연쇄 이어짐 0이면 폭발로 깨진 바위는 다시 안 터짐 (' + g0 + '대)');
ok(g1 > 3, '연쇄 이어짐 100%면 여러 대로 번짐 (' + g1 + '대)');
sess = MG.newSession(s, MG.rng(4));
for (const k of sess.rocks) if (!k.heart) { k.dead = true; } sess.alive = 0;
for (let i = 0; i < Math.ceil((sess.st.refill + 0.5) * 30); i++) MG.step(s, sess, 1 / 30, null);
ok(sess.alive > sess.st.rocks * 0.85, '다 깨도 꽉 차기 시간 안에 다시 참 (' + sess.alive + '/' + sess.st.rocks + ')');
s.skills.heart = 1; s.heartOpen = true; s.heartHp = MG.HEART.hp;
sess = MG.newSession(s, MG.rng(5)); sess.st.boom = 1; sess.st.keep = 1;
const h0 = s.heartHp;
for (let i = 0; i < 60; i++) MG.step(s, sess, 1 / 30, { x: sess.st.W * 0.2, y: sess.st.H * 0.2 });
ok(s.heartHp === h0, '심장은 폭발·번개에 다치지 않고 곡괭이로만');

// 새 능력·갈림길
{
  const base = () => { const q = MG.newState(0); q.ores = MG.TIERS.map(() => 1e15); for (let t = 1; t < 10; t++) MG.buyNode(q, 'd' + t); for (const p of MG.PICKS) MG.craft(q, p.id); return q; };
  let q = base();
  ok(MG.nodeState(q, 'combo1') === 'locked', '새 능력은 가지 끝이라 안쪽 칸을 먼저 열어야 함');
  ok(MG.nodeState(q, 'fA1') === 'buy' && MG.nodeState(q, 'fA2') === 'buy', '갈림길 둘 다 처음엔 열 수 있음');
  ok(MG.buyNode(q, 'fA2') && MG.nodeState(q, 'fA1') === 'blocked' && !MG.buyNode(q, 'fA1'), '하나를 고르면 다른 쪽은 닫힘');
  ok(MG.stats(q).zapN === 2 && MG.stats(q).chain >= 0.1, '번개 광부: 번개 한 번 더 + 확률');
  q = base(); q.skills.helper1 = 2; q.skills.meteor1 = 1;
  let st = MG.stats(q);
  ok(st.helper === 2 && st.meteor === 2, '꼬마 광부 2명, 유성 2개');
  let ss = MG.newSession(q, MG.rng(3));
  ok(ss.helpers.length === 2 && ss.meteors.length === 2, '판에 꼬마 광부·유성 일정이 생김');
  const ev = {};
  while (!ss.over) { MG.step(q, ss, 1 / 30, null); for (const e of ss.ev) ev[e.e] = (ev[e.e] || 0) + 1; ss.ev.length = 0; }
  ok(ev.mimpact === 2 && ss.broken > 0, '마우스가 밖에 있어도 유성·꼬마 광부가 캠 (유성 ' + ev.mimpact + ', 바위 ' + ss.broken + ')');
  q = base(); q.skills.treasure1 = 3; q.skills.vein1 = 3; q.skills.alch1 = 3;
  const empty = (x) => { for (const k of x.rocks) if (!k.heart) k.dead = true; x.alive = 0; }; // 시험용: 비우고 다시 채우게
  ss = MG.newSession(q, MG.rng(5)); ss.st.treasure = 1; ss.st.vein = 0; empty(ss);
  for (let i = 0; i < 40; i++) MG.step(q, ss, 1 / 30, null);
  const tk = ss.rocks.find((x) => x.treasure && !x.dead && x.born <= ss.t);
  ok(tk && tk.max > MG.TIERS[tk.tier].hp * ss.st.hpMul * 4, '보물 바위는 5배 단단함');
  const g0 = q.gems, o0 = q.ores.reduce((a, b) => a + b, 0);
  ss.ev.length = 0; tk.hp = 1; MG.step(q, ss, 1 / 30, { x: tk.x, y: tk.y });
  for (let i = 0; i < 30 && !tk.dead; i++) MG.step(q, ss, 1 / 30, { x: tk.x, y: tk.y });
  ok(tk.dead && q.gems > g0 && q.ores.reduce((a, b) => a + b, 0) - o0 >= 30, '보물 바위를 깨면 보석·광석 왕창');
  ss = MG.newSession(q, MG.rng(6)); ss.st.vein = 10; ss.st.treasure = 0; empty(ss);
  for (let i = 0; i < 60; i++) MG.step(q, ss, 1 / 30, null);
  const ln = Object.values(ss.lineOf || {}).find((m) => m.length >= 3 && m.every((k) => !k.dead && k.born <= ss.t));
  ok(ln && ln.every((k) => k.tier === ln[0].tier), '광맥 줄기는 같은 광석 여러 개 (' + (ln ? ln.length : 0) + '개)');
  MG.hitRock(q, ss, ln[0], ln[0].hp + 1, 'swing', 0);
  ok(ln.slice(1).every((k) => !k.dead), '바로 깨지는 건 맞은 바위 하나뿐');
  for (let i = 0; i < 30; i++) MG.step(q, ss, 1 / 30, null);
  ok(ln.every((k) => k.dead), '줄기 하나를 깨면 줄 전체가 깨짐');
  q = base(); q.skills.lastSec1 = 3;
  ss = MG.newSession(q, MG.rng(7)); let real = 0;
  while (!ss.over) { MG.step(q, ss, 1 / 30, null); real += 1 / 30; }
  ok(real > ss.st.time + 1.5, '마지막 불꽃: 마지막 3초가 더 길게 흐름 (' + real.toFixed(1) + '초 / ' + ss.st.time + '초)');
  q = base(); q.skills.combo1 = 3; q.skills.rocks1 = 5; q.skills.rocks2 = 5;
  ss = MG.newSession(q, MG.rng(8)); ss.st.boom = 1; ss.st.keep = 0.8;
  let maxMul = 1;
  for (let i = 0; i < 120; i++) { const k = MG.liveRocks(ss)[0]; MG.step(q, ss, 1 / 30, k ? { x: k.x, y: k.y } : null); maxMul = Math.max(maxMul, ss.comboMul); }
  ok(maxMul > 1.15 && maxMul <= 1 + ss.st.combo + 1e-9, '콤보: 많이 깰수록 광석 배수 오름 (최대 ×' + maxMul.toFixed(2) + ')');
}

// 저장·불러오기
s = MG.newState(0);
const back = MG.fix(JSON.parse(JSON.stringify(s)));
ok(JSON.stringify(back) === JSON.stringify(s), 'JSON으로 저장해도 그대로');
const old = MG.fix({ ores: [5], skills: {}, picks: { own: ['p0'], eq: 'p0', up: {} } });
ok(old.ores.length === 10 && old.skills.d0 === 1 && old.level === 1, '예전·빠진 저장도 고쳐서 읽음');

// 숫자 표시
ok(MG.fmt(9999) === '9,999' && MG.fmt(12345) === '1.23만' && MG.fmt(250000000) === '2.5억', '숫자 줄여 쓰기');
ok(MG.fmtTime(3725000) === '1:02:05' && MG.fmtTime(65000) === '1:05', '시간 표시');

console.log(`${n - fails}/${n} 통과`);
process.exit(fails ? 1 : 0);
