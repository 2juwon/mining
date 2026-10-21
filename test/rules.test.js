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
