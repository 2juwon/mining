// 자동 플레이로 진행 곡선 재기: node test/sim.js [판수=5] [실력=good|ok]
const MG = require('../src/engine.js');
const RUNS = +process.argv[2] || 5;
const SKILL = process.argv[3] || 'good';
const MENU = SKILL === 'good' ? 8 : 15; // 판 사이에 메뉴에서 보내는 초
const DT = 1 / 30;

function botCursor(sess, cur, dt, tgt) {
  // 0.2초마다 가장 값진 자리로 목표를 바꾸고 그쪽으로 마우스를 옮김
  if (!tgt.t || sess.t - tgt.t > 0.2) {
    tgt.t = sess.t;
    const rocks = MG.liveRocks(sess);
    let best = null, bv = -1;
    const rad = sess.st.rad;
    for (const c of rocks) {
      let v = 0;
      for (const k of rocks) {
        const dx = k.x - c.x, dy = k.y - c.y, rr = rad + k.r * 0.6;
        if (dx * dx + dy * dy <= rr * rr) v += k.heart ? 30 : (1 + k.tier * 0.5);
      }
      if (SKILL !== 'good') v *= 0.6 + Math.random() * 0.8;
      if (v > bv) { bv = v; best = c; }
    }
    if (best) { tgt.x = best.x; tgt.y = best.y; }
  }
  if (tgt.x == null) return cur;
  const sp = (SKILL === 'good' ? 1600 : 900) * dt;
  const dx = tgt.x - cur.x, dy = tgt.y - cur.y, d = Math.hypot(dx, dy);
  if (d <= sp) return { x: tgt.x, y: tgt.y };
  return { x: cur.x + dx / d * sp, y: cur.y + dy / d * sp };
}

const CARD_PREF = ['dmg', 'spd', 'rad', 'time', 'rocks', 'ore', 'critD', 'crit', 'boom', 'chain', 'sand', 'gem'];
function shop(s) {
  // 카드
  while (s.pts > 0) {
    const o = MG.openOffer(s);
    let bi = 0, bs = -1;
    o.forEach((id, i) => { const c = MG.cardInfo(id); const sc = (20 - CARD_PREF.indexOf(c.id)) * (1 + c.rar); if (sc > bs) { bs = sc; bi = i; } });
    MG.pickCard(s, bi);
  }
  let bought = true, guard = 0;
  while (bought && guard++ < 500) {
    bought = false;
    // 깊이·심장
    for (const n of MG.NODES) if ((n.k === 'depth' || n.k === 'heart') && MG.nodeState(s, n.id) === 'buy') { MG.buyNode(s, n.id); bought = true; }
    for (const p of MG.PICKS) if (MG.pickState(s, p.id) === 'buy') { MG.craft(s, p.id); bought = true; }
    if (MG.upgradePick(s, s.picks.eq)) bought = true;
    // 가장 싼(광석 가치 기준) 노드
    let best = null, bc = Infinity;
    for (const n of MG.NODES) {
      if (MG.nodeState(s, n.id) !== 'buy') continue;
      const c = MG.nodeCost(n, MG.lvOf(s, n.id));
      let v = 0; for (const t in c) v += c[t] * MG.TIERS[t].val;
      if (n.k === 'gem' || n.k === 'xp') v *= 3;
      if (v < bc) { bc = v; best = n; }
    }
    if (best) {
      // 다음 깊이를 위해 아껴 두기: 기둥 값의 70%가 모였으면 옆 가지를 안 삼
      const d = MG.depthOf(s), spine = MG.NODE['d' + (d + 1)] || (s.heartOpen ? null : MG.NODE.heart);
      let save = false;
      if (spine && MG.nodeState(s, spine.id) === 'open') {
        const c = MG.nodeCost(spine, 0);
        for (const t in c) if (+t === best.ct && s.ores[t] - MG.nodeCost(best, MG.lvOf(s, best.id))[t] < c[t] && s.ores[t] >= c[t] * 0.7) save = true;
      }
      if (!save) { MG.buyNode(s, best.id); bought = true; }
    }
  }
}

function play(seed) {
  const s = MG.newState(0);
  const r = MG.rng(seed);
  let clock = 0; const marks = [];
  let lastDepth = 0;
  for (let i = 0; i < 2000 && !s.cleared; i++) {
    const sess = MG.newSession(s, r);
    let cur = { x: 500, y: 300 }, tgt = {};
    while (!sess.over) {
      cur = botCursor(sess, cur, DT, tgt);
      MG.step(s, sess, DT, cur);
      sess.ev.length = 0;
      if (s.cleared) break;
    }
    MG.endSession(s, sess);
    MG.idle(s, sess.t + MENU);
    clock += sess.t + MENU;
    shop(s);
    const d = MG.depthOf(s);
    if (d !== lastDepth) { marks.push(`${d}:${(clock / 60).toFixed(0)}m`); lastDepth = d; }
    if (s.heartOpen && !marks.some((m) => m.startsWith('H'))) marks.push(`H:${(clock / 60).toFixed(0)}m`);
  }
  const st = MG.stats(s);
  return { min: clock / 60, sessions: s.sessions, level: s.level, cards: s.cards, pick: s.picks.eq, mast: MG.NODES.filter((n) => n.k === "mast").map((n) => MG.lvOf(s, n.id)).join("/"), dmg: st.dmg, time: st.time.toFixed(1), marks: marks.join(' ') , cleared: s.cleared};
}

const res = [];
for (let i = 0; i < RUNS; i++) { const r = play(1000 + i); res.push(r); console.log(JSON.stringify(r)); }
const avg = res.reduce((a, b) => a + b.min, 0) / res.length;
console.log('평균', avg.toFixed(1), '분, 최소', Math.min(...res.map((r) => r.min)).toFixed(1));
