/* 한판 광산 — 규칙 엔진 (화면과 무관, 브라우저·Node 모두에서 동작)
 * 저장 상태(s)는 JSON 그대로 저장 가능. 채굴 한 판(sess)은 저장하지 않음.
 * 좌표: 채굴장 1000 × 600 (화면이 알아서 늘이고 줄임)
 */
(function (root) {
  'use strict';
  const VERSION = 1;
  const W = 1000, H = 600;

  // ── 광석 ─────────────────────────────────────────
  const TIERS = [
    { id: 'stone', name: '돌', hp: 3, val: 1, rock: '#48423c', vein: '#8d8578', r: 21 },
    { id: 'copper', name: '구리', hp: 12, val: 3, rock: '#5f4c42', vein: '#e0814a', r: 22 },
    { id: 'iron', name: '철', hp: 60, val: 10, rock: '#4d4b4c', vein: '#c9cfd6', r: 23 },
    { id: 'silver', name: '은', hp: 240, val: 30, rock: '#4b5059', vein: '#eef4ff', r: 24 },
    { id: 'gold', name: '금', hp: 960, val: 100, rock: '#544636', vein: '#ffc94a', r: 25 },
    { id: 'crystal', name: '수정', hp: 3800, val: 300, rock: '#3c4a5e', vein: '#8fe0ff', r: 26 },
    { id: 'mithril', name: '미스릴', hp: 15000, val: 1000, rock: '#334a47', vein: '#7cf2cf', r: 27 },
    { id: 'adamant', name: '아다만트', hp: 60000, val: 3000, rock: '#4a2f36', vein: '#ff5f7e', r: 28 },
    { id: 'obsidian', name: '흑요석', hp: 280000, val: 10000, rock: '#241d33', vein: '#b28cff', r: 29 },
    { id: 'star', name: '별철', hp: 1200000, val: 30000, rock: '#2a2c3d', vein: '#fff3b0', r: 30 },
  ];
  const HEART = { name: '광산의 심장', hp: 60000000000, r: 64 };

  // ── 스킬 트리 ─────────────────────────────────────
  // row = 깊이(그 줄 광석으로 값을 냄), col = 가로 자리(0이 가운데 기둥)
  // k: 효과 종류, v: 레벨당 값, max: 최대 레벨, b: 첫 값, g: 레벨마다 몇 배
  const NODES = [];
  const MAST_V = 0.015;
  const SPINE_NAMES = ['광부의 첫걸음', '구리 광맥', '철 광맥', '은 광맥', '금 광맥', '수정 동굴', '미스릴 광맥', '아다만트 광맥', '흑요석 지대', '별철 낙하지'];
  for (let t = 0; t < TIERS.length; t++) {
    NODES.push({ id: 'd' + t, row: t, col: 0, k: 'depth', v: t, max: 1, name: SPINE_NAMES[t],
      desc: t ? `${TIERS[t].name} 바위가 나오기 시작해요` : '돌을 캘 수 있어요', ct: Math.max(0, t - 1), b: t ? 40 + t * 8 : 0, g: 1 });
  }
  NODES.push({ id: 'heart', row: 10, col: 0, k: 'heart', v: 1, max: 1, name: '광산의 심장', desc: '가장 깊은 곳의 심장이 드러나요. 깨면 클리어!', ct: 9, b: 160, g: 1, extra: { 8: 600, 7: 2000 } });

  const fam = {
    dmg: ['날 세우기', '공격력 +{p}%'],
    spd: ['손목 단련', '휘두르는 간격 −{p}%'],
    rad: ['큰 휘두르기', '채굴 범위 +{n}'],
    time: ['도시락', '채굴 시간 +{n}초'],
    rocks: ['빽빽한 광맥', '바위 최대 수 +{n}'],
    spawn: ['솟아나는 바위', '바위 생기는 속도 +{p}%'],
    ore: ['꼼꼼한 줍기', '광석 +{p}%'],
    crit: ['급소 찾기', '치명타 확률 +{p}%'],
    critD: ['한 방의 무게', '치명타 피해 +{p}%'],
    gem: ['보석 눈썰미', '보석 나올 확률 +{p}%p'],
    xp: ['경험 많은 광부', '경험치 +{p}%'],
    chain: ['번개 곡괭이', '때릴 때 {p}% 확률로 번개'],
    boom: ['폭약 상자', '깨질 때 {p}% 확률로 폭발 (폭발로 깨진 바위는 대마다 약해지며 또 터짐)'],
    sand: ['시간의 모래', '깰 때 {p}% 확률로 +0.5초 (한 판에 채굴 시간의 절반까지)'],
    luck: ['광맥 탐지', '깊은 광석이 더 자주'],
    mine: ['자동 광산', '쉬는 동안에도 광석을 캠'],
  };
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
  const famCount = {};
  function side(row, col, k, v, max, b, g) {
    famCount[k] = (famCount[k] || 0) + 1;
    const [nm, d] = fam[k];
    NODES.push({ id: k + famCount[k], row, col, k, v, max, b, g: g || 1.55, ct: row,
      name: nm + ' ' + ROMAN[famCount[k]], desc: d });
  }
  // 줄마다 양옆 가지 (col −3 … 3)
  side(0, -1, 'dmg', 0.2, 5, 6);
  side(0, 1, 'time', 1, 3, 12, 1.8);
  side(0, -2, 'rad', 6, 3, 15);
  side(0, 2, 'ore', 0.12, 3, 18);
  side(1, -1, 'spd', 0.05, 5, 8);
  side(1, 1, 'rocks', 8, 5, 12, 1.55);
  side(1, -2, 'crit', 0.02, 5, 10);
  side(1, 2, 'spawn', 0.15, 3, 14);
  side(1, 3, 'mine', 1, 5, 25, 1.6);
  side(2, -1, 'dmg', 0.25, 5, 9);
  side(2, 1, 'time', 1, 3, 18, 1.8);
  side(2, -2, 'gem', 0.005, 3, 15);
  side(2, 2, 'xp', 0.15, 3, 12);
  side(3, -1, 'critD', 0.25, 5, 10);
  side(3, 1, 'rad', 8, 3, 15);
  side(3, -2, 'sand', 0.03, 3, 16);
  side(3, 2, 'boom', 0.05, 3, 18);
  side(4, -1, 'ore', 0.15, 5, 12);
  side(4, 1, 'spd', 0.04, 5, 12);
  side(4, -2, 'luck', 0.15, 3, 18);
  side(4, 2, 'mine', 1, 5, 20, 1.6);
  side(5, -1, 'dmg', 0.3, 5, 12);
  side(5, 1, 'chain', 0.06, 3, 16);
  side(5, -2, 'rocks', 110, 5, 18, 1.55);
  side(5, 2, 'time', 1, 3, 22, 1.8);
  side(6, -1, 'crit', 0.02, 5, 12);
  side(6, 1, 'critD', 0.3, 5, 12);
  side(6, -2, 'spawn', 0.15, 3, 16);
  side(6, 2, 'boom', 0.05, 3, 18);
  side(7, -1, 'dmg', 0.35, 5, 14);
  side(7, 1, 'rad', 8, 3, 18);
  side(7, -2, 'ore', 0.2, 5, 14);
  side(7, 2, 'mine', 1, 5, 20, 1.6);
  side(8, -1, 'spd', 0.04, 5, 14);
  side(8, 1, 'chain', 0.06, 3, 18);
  side(8, -2, 'rocks', 480, 5, 18, 1.55);
  side(8, 2, 'luck', 0.15, 3, 20);
  side(9, -1, 'dmg', 0.4, 5, 16);
  side(9, 1, 'time', 1, 3, 26, 1.8);
  side(9, -2, 'xp', 0.2, 3, 16);
  side(9, 2, 'critD', 0.35, 5, 16);
  // 광석 숙련: 광석마다 하나, 레벨 끝없음, 그 광석으로만 값을 냄. 한 층 더 내려가야 열림(다 쓴 광석의 쓸 곳)
  for (let t = 0; t < TIERS.length; t++) {
    NODES.push({ id: 'm' + t, row: t, col: 'm', k: 'mast', v: MAST_V, max: Infinity, b: 40, g: 1.3, ct: t,
      after: t < 9 ? 'd' + (t + 1) : 'heart', name: TIERS[t].name + ' 숙련', desc: '공격력 +{p}%' });
  }
  // 지도 위 자리 (가운데에서 나선으로 깊어짐, test/layout.js 힘 배치로 구해 둔 값)
  const MAP = {'d0':[0,0], 'd1':[167,-101], 'd2':[263,75], 'd3':[236,274], 'd4':[74,392], 'd5':[-129,416], 'd6':[-327,345], 'd7':[-502,218], 'd8':[-621,49], 'd9':[-648,-142], 'heart':[-547,-291], 'dmg1':[-33,134], 'time1':[-99,-99], 'rad1':[-167,172], 'ore1':[-237,-99], 'spd1':[133,-237], 'rocks1':[267,-198], 'crit1':[72,-361], 'spawn1':[329,-322], 'mine1':[420,-426], 'dmg2':[323,-51], 'time2':[401,65], 'gem1':[428,-140], 'xp1':[532,20], 'critD1':[358,209], 'rad2':[353,349], 'sand1':[496,204], 'boom1':[484,392], 'ore2':[210,422], 'spd2':[116,525], 'luck1':[316,510], 'mine2':[193,640], 'dmg3':[-23,505], 'chain1':[-153,554], 'rocks2':[0,642], 'time3':[-171,691], 'crit2':[-260,465], 'critD2':[-398,468], 'spawn2':[-317,592], 'boom2':[-501,561], 'dmg4':[-601,321], 'rad3':[-637,188], 'ore3':[-692,426], 'mine3':[-757,257], 'spd3':[-749,106], 'chain2':[-734,-32], 'rocks3':[-885,133], 'luck2':[-872,-38], 'dmg5':[-783,-175], 'time4':[-686,-276], 'xp2':[-909,-233], 'critD3':[-742,-403], 'm0':[-132,36], 'm1':[35,-137], 'm2':[134,32], 'm3':[153,168], 'm4':[49,259], 'm5':[-88,287], 'm6':[-312,209], 'm7':[-466,348], 'm8':[-487,22], 'm9':[-512,-156]};
  for (const n of NODES) { const q = MAP[n.id] || [0, 0]; n.x = q[0]; n.y = q[1]; }
  const NODE = Object.fromEntries(NODES.map((n) => [n.id, n]));
  // 선행 노드: 기둥은 바로 위 기둥, 옆 가지는 안쪽 이웃(없으면 같은 줄 기둥)
  for (const n of NODES) {
    if (n.col === 0) n.req = n.row ? [n.row === 10 ? 'd9' : 'd' + (n.row - 1)] : [];
    else if (n.k === 'mast') n.req = ['d' + n.row];
    else {
      const inner = NODES.find((m) => m.row === n.row && m.col === n.col - Math.sign(n.col));
      n.req = [inner ? inner.id : 'd' + n.row];
    }
  }

  // ── 곡괭이 ───────────────────────────────────────
  const PICKS = [
    { id: 'p0', name: '낡은 나무 곡괭이', dmg: 3, swing: 0.75, cost: {}, fx: null },
    { id: 'p1', name: '돌 곡괭이', dmg: 6, swing: 0.75, cost: { 0: 20 }, fx: null },
    { id: 'p2', name: '구리 곡괭이', dmg: 14, swing: 0.75, cost: { 1: 40, 0: 80 }, fx: null },
    { id: 'p3', name: '철 곡괭이', dmg: 32, swing: 0.75, cost: { 2: 50, 1: 100 }, fx: null },
    { id: 'p4', name: '은 곡괭이', dmg: 75, swing: 0.75, cost: { 3: 55, 2: 120 }, fx: ['crit', 0.05] },
    { id: 'p5', name: '금 곡괭이', dmg: 175, swing: 0.8, cost: { 4: 60, 3: 130 }, fx: ['ore', 0.25] },
    { id: 'p6', name: '수정 곡괭이', dmg: 450, swing: 0.75, cost: { 5: 65, 4: 140 }, fx: ['rad', 10] },
    { id: 'p7', name: '미스릴 곡괭이', dmg: 1150, swing: 0.6, cost: { 6: 70, 5: 150 }, fx: ['spd', 0.1] },
    { id: 'p8', name: '아다만트 곡괭이', dmg: 3000, swing: 0.7, cost: { 7: 75, 6: 160 }, fx: ['critD', 0.5] },
    { id: 'p9', name: '흑요석 곡괭이', dmg: 7800, swing: 0.65, cost: { 8: 80, 7: 170 }, fx: ['boom', 0.15] },
    { id: 'p10', name: '별철 곡괭이', dmg: 20000, swing: 0.55, cost: { 9: 90, 8: 180 }, fx: ['chain', 0.2] },
  ];
  const PICK = Object.fromEntries(PICKS.map((p) => [p.id, p]));
  const pickUpCost = (lv) => Math.round(3 * Math.pow(1.6, lv)); // 보석
  const PICK_UP_MAX = 10, PICK_UP_V = 0.15;

  // ── 재능 카드 ─────────────────────────────────────
  const RAR = [
    { name: '보통', w: 62, mul: 1 },
    { name: '희귀', w: 30, mul: 2 },
    { name: '전설', w: 8, mul: 3.5 },
  ];
  const CARDS = [
    { id: 'dmg', name: '강철 팔뚝', k: 'dmg', v: 0.12, d: '공격력 +{p}%' },
    { id: 'spd', name: '날렵한 손목', k: 'spd', v: 0.04, d: '휘두르는 간격 −{p}%' },
    { id: 'rad', name: '넓은 시야', k: 'rad', v: 4, d: '채굴 범위 +{n}' },
    { id: 'time', name: '두둑한 도시락', k: 'time', v: 0.5, d: '채굴 시간 +{n}초' },
    { id: 'ore', name: '풍년', k: 'ore', v: 0.1, d: '광석 +{p}%' },
    { id: 'crit', name: '매의 눈', k: 'crit', v: 0.025, d: '치명타 확률 +{p}%' },
    { id: 'critD', name: '내려찍기', k: 'critD', v: 0.25, d: '치명타 피해 +{p}%' },
    { id: 'gem', name: '보석상의 감', k: 'gem', v: 0.004, d: '보석 나올 확률 +{p}%p' },
    { id: 'chain', name: '정전기', k: 'chain', v: 0.03, d: '때릴 때 번개 확률 +{p}%' },
    { id: 'boom', name: '불씨', k: 'boom', v: 0.03, d: '깨질 때 폭발 확률 +{p}%' },
    { id: 'sand', name: '모래시계', k: 'sand', v: 0.02, d: '깰 때 +0.5초 확률 +{p}%' },
    { id: 'rocks', name: '광맥 증식', k: 'rocksMul', v: 0.06, d: '바위 최대 수 +{p}%' },
    { id: 'keep', name: '도화선', k: 'keep', v: 0.05, d: '연쇄 이어짐 +{p}%p' },
  ];
  const CARD = Object.fromEntries(CARDS.map((c) => [c.id, c]));
  const CARD_HP = 0.04; // 카드 한 장마다 바위 체력 +4%

  // ── 숫자 표시 ─────────────────────────────────────
  function fmt(n) {
    n = Math.floor(n);
    if (n < 10000) return n.toLocaleString('ko-KR');
    const u = [[1e12, '조'], [1e8, '억'], [1e4, '만']];
    for (const [d, s] of u) if (n >= d) {
      const x = n / d;
      return (x >= 100 ? Math.floor(x) : x >= 10 ? Math.floor(x * 10) / 10 : Math.floor(x * 100) / 100) + s;
    }
    return String(n);
  }
  function fillDesc(d, v) {
    return d.replace('{p}', +(v * 100).toFixed(1)).replace('{n}', +v.toFixed(1));
  }
  function fmtTime(ms) {
    const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
    const p = (n) => String(n).padStart(2, '0');
    return (h ? h + ':' + p(m) : m) + ':' + p(x);
  }

  // ── 난수 ─────────────────────────────────────────
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── 상태 ─────────────────────────────────────────
  function newState(now) {
    return {
      v: VERSION,
      ores: TIERS.map(() => 0), gems: 0,
      xp: 0, level: 1, pts: 0, cards: 0, talents: {}, offer: null, offerLock: -1, rerolls: 0,
      skills: { d0: 1 },
      picks: { own: ['p0'], eq: 'p0', up: {} },
      heartHp: HEART.hp, heartOpen: false, cleared: false,
      startAt: now || Date.now(), clearAt: null, lastSeen: now || Date.now(),
      sessions: 0, best: 0, broken: 0, total: TIERS.map(() => 0),
      run: null, // 랭킹용 {id, token}
    };
  }
  const lvOf = (s, id) => (s.skills[id] | 0);
  const depthOf = (s) => { let d = 0; for (let t = 0; t < TIERS.length; t++) if (lvOf(s, 'd' + t)) d = t; return d; };

  function stats(s) {
    const st = { dmgMul: 1, spdMul: 1, rad: 58, time: 12, rocks: 16, spawn: 3, oreMul: 1, crit: 0.03, critD: 2,
      gem: 0.008, xpMul: 1, chain: 0, boom: 0, sand: 0, luck: 0, mine: 0, mast: 0, rocksMul: 1, keep: 0.45 };
    function add(k, x) {
      switch (k) {
        case 'dmg': st.dmgMul *= 1 + x; break;
        case 'spd': st.spdMul *= 1 - x; break;
        case 'rad': st.rad += x; break;
        case 'time': st.time += x; break;
        case 'rocks': st.rocks += x; break;
        case 'rocksMul': st.rocksMul *= 1 + x; break;
        case 'keep': st.keep += x; break;
        case 'spawn': st.spawn *= 1 + x; break;
        case 'ore': st.oreMul *= 1 + x; break;
        case 'crit': st.crit += x; break;
        case 'critD': st.critD += x; break;
        case 'gem': st.gem += x; break;
        case 'xp': st.xpMul *= 1 + x; break;
        case 'chain': st.chain += x; break;
        case 'boom': st.boom += x; break;
        case 'sand': st.sand += x; break;
        case 'luck': st.luck += x; break;
        case 'mine': st.mine += x; break;
        case 'mast': st.mast += x; break;
      }
    }
    for (const n of NODES) {
      const l = lvOf(s, n.id);
      if (l && n.k !== 'depth' && n.k !== 'heart') add(n.k, n.v * l);
    }
    for (const id in s.talents) {
      const c = CARD[id.split(':')[0]]; if (!c) continue;
      const mul = RAR[+id.split(':')[1] || 0].mul;
      add(c.k, c.v * mul * s.talents[id]);
    }
    const p = PICK[s.picks.eq] || PICKS[0];
    if (p.fx) add(p.fx[0], p.fx[1]);
    st.dmgMul *= 1 + st.mast;
    const up = s.picks.up[p.id] | 0;
    st.pick = p;
    st.dmg = p.dmg * st.dmgMul * (1 + PICK_UP_V * up);
    st.swing = Math.max(0.12, p.swing * st.spdMul);
    st.crit = Math.min(0.9, st.crit);
    st.chain = Math.min(0.8, st.chain);
    st.boom = Math.min(0.8, st.boom);
    st.sand = Math.min(0.5, st.sand);
    st.depth = depthOf(s);
    // 바위가 많아질수록 채굴장이 넓어짐(화면에선 멀리서 보게 돼 바위가 작아 보임). 90개쯤부터는 바위 간격이 거의 일정
    st.rocks = Math.min(5000, Math.round(st.rocks * st.rocksMul));
    st.field = Math.max(1, Math.sqrt(st.rocks / 70));
    st.W = Math.round(W * st.field); st.H = Math.round(H * st.field);
    st.radE = st.rad * Math.pow(st.field, 0.9);           // 고리도 채굴장과 함께 넓어짐
    st.refill = 4 / st.spawn * 3;                           // 다 깼을 때 꽉 차기까지 초 (처음 4초)
    st.keep = Math.min(0.85, st.keep);
    // 바위가 많을수록 바위 하나당 경험치·보석·시간의 모래는 줄어듦 (전체로는 비슷하게)
    const per = Math.min(1, Math.pow(24 / st.rocks, 0.5));
    st.xpEach = per; st.gemEach = st.gem * per; st.sandEach = per;
    st.hpMul = 1 + CARD_HP * s.cards;
    st.weights = TIERS.map((_, t) => (t <= st.depth ? Math.pow(1.6 + st.luck, t - st.depth) : 0));
    st.wsum = st.weights.reduce((a, b) => a + b, 0);
    return st;
  }

  // ── 값과 살 수 있는지 ─────────────────────────────
  // 깊을수록 바위가 수천 개로 늘어 광석이 많이 들어오므로 값도 깊이에 따라 키움
  const ROWMUL = [1, 1, 1.4, 2.6, 4.8, 11, 28, 62, 125, 220, 70];
  for (const p of PICKS) { const mt = Math.max(0, ...Object.keys(p.cost).map(Number)); for (const t in p.cost) p.cost[t] = Math.round(p.cost[t] * ROWMUL[mt]); }
  function nodeCost(n, lv) { // lv = 지금 레벨 (다음 레벨을 살 때의 값)
    const c = {};
    const m = n.k === 'mast' ? 1 : ROWMUL[n.row];
    c[n.ct] = Math.round(n.b * Math.pow(n.g, lv) * m);
    if (n.extra) for (const t in n.extra) c[t] = Math.round(n.extra[t] * m);
    return c;
  }
  function canPay(s, cost) { for (const t in cost) if ((s.ores[t] || 0) < cost[t]) return false; return true; }
  function pay(s, cost) { for (const t in cost) s.ores[t] -= cost[t]; }
  function nodeState(s, id) {
    const n = NODE[id], lv = lvOf(s, id);
    if (lv >= n.max) return 'max';
    if (!n.req.every((r) => lvOf(s, r) > 0) || (n.after && !lvOf(s, n.after))) return 'locked';
    return canPay(s, nodeCost(n, lv)) ? 'buy' : 'open';
  }
  function buyNode(s, id) {
    if (nodeState(s, id) !== 'buy') return false;
    const n = NODE[id];
    pay(s, nodeCost(n, lvOf(s, id)));
    s.skills[id] = lvOf(s, id) + 1;
    if (n.k === 'heart') s.heartOpen = true;
    return true;
  }
  function pickState(s, id) {
    if (s.picks.own.includes(id)) return 'own';
    const p = PICK[id], i = PICKS.indexOf(p);
    if (i > 0 && !s.picks.own.includes(PICKS[i - 1].id)) return 'locked';
    const maxTier = Math.max(...Object.keys(p.cost).map(Number), 0);
    if (maxTier > depthOf(s)) return 'locked';
    return canPay(s, p.cost) ? 'buy' : 'open';
  }
  function craft(s, id) {
    if (pickState(s, id) !== 'buy') return false;
    pay(s, PICK[id].cost);
    s.picks.own.push(id);
    s.picks.eq = id;
    return true;
  }
  function upgradePick(s, id) {
    if (!s.picks.own.includes(id)) return false;
    const lv = s.picks.up[id] | 0;
    if (lv >= PICK_UP_MAX) return false;
    const c = pickUpCost(lv);
    if (s.gems < c) return false;
    s.gems -= c;
    s.picks.up[id] = lv + 1;
    return true;
  }

  // ── 레벨과 재능 카드 ─────────────────────────────
  const xpNeed = (lv) => Math.round(25 * Math.pow(1.38, lv - 1));
  function addXp(s, x) {
    s.xp += x;
    let ups = 0;
    while (s.xp >= xpNeed(s.level)) { s.xp -= xpNeed(s.level); s.level += 1; s.pts += 1; ups++; }
    return ups;
  }
  const REROLLS = 2; // 카드 한 장 고를 때마다 다시 뽑기 횟수
  function rollCard(pool, r) {
    const c = pool.splice(Math.floor(r() * pool.length), 1)[0];
    let x = r() * 100, rar = 0;
    for (let i = 0; i < RAR.length; i++) { if (x < RAR[i].w) { rar = i; break; } x -= RAR[i].w; }
    return c.id + ':' + rar;
  }
  function drawOffer(s, r) {
    r = r || Math.random;
    const pool = CARDS.slice();
    const out = [];
    while (out.length < 3 && pool.length) out.push(rollCard(pool, r));
    return out;
  }
  function openOffer(s, r) {
    if (s.pts <= 0) return null;
    if (!s.offer) { s.offer = drawOffer(s, r); s.rerolls = REROLLS; s.offerLock = -1; }
    return s.offer;
  }
  // 한 장을 고정(같은 칸을 다시 누르면 풀림). 고정은 한 장만
  function lockCard(s, i) {
    if (!s.offer || !s.offer[i]) return false;
    s.offerLock = s.offerLock === i ? -1 : i;
    return true;
  }
  // 다시 뽑기: 고정한 카드는 그대로, 나머지는 지금 보이는 카드와 다른 카드로
  function reroll(s, r) {
    r = r || Math.random;
    if (!s.offer || s.pts <= 0 || (s.rerolls | 0) <= 0) return false;
    const shown = s.offer.map((id) => id.split(':')[0]);
    let pool = CARDS.filter((c) => !shown.includes(c.id));
    const keep = s.offerLock >= 0 ? shown[s.offerLock] : null;
    s.offer = s.offer.map((id, i) => {
      if (i === s.offerLock) return id;
      if (!pool.length) pool = CARDS.filter((c) => c.id !== keep);
      return rollCard(pool, r);
    });
    s.rerolls -= 1;
    return true;
  }
  function pickCard(s, i) {
    if (!s.offer || !s.offer[i] || s.pts <= 0) return false;
    const id = s.offer[i];
    s.talents[id] = (s.talents[id] | 0) + 1;
    s.cards += 1; s.pts -= 1; s.offer = null; s.offerLock = -1; s.rerolls = 0;
    return true;
  }
  function cardInfo(id) {
    const [cid, ri] = id.split(':');
    const c = CARD[cid], rar = +ri || 0;
    return { ...c, rar, rarName: RAR[rar].name, text: fillDesc(c.d, c.v * RAR[rar].mul) };
  }

  // ── 자동 광산 ────────────────────────────────────
  // 내 공격력의 일부로 보이지 않는 곳에서 캠 (화면에 있을 때와 꺼 둔 동안 모두, 꺼 둔 동안은 8시간까지)
  function mineRates(s, st) {
    st = st || stats(s);
    if (!st.mine) return TIERS.map(() => 0);
    const dps = (st.dmg / st.swing) * 2.2 * 0.035 * st.mine;
    const wsum = st.weights.reduce((a, b) => a + b, 0);
    return TIERS.map((T, t) => (st.weights[t] ? (dps * st.weights[t] / wsum) / (T.hp * st.hpMul) * st.oreMul : 0));
  }
  function idle(s, sec, carry) {
    const rates = mineRates(s);
    carry = carry || (s._carry = s._carry || TIERS.map(() => 0));
    const got = TIERS.map(() => 0);
    for (let t = 0; t < TIERS.length; t++) {
      carry[t] = (carry[t] || 0) + rates[t] * sec;
      const n = Math.floor(carry[t]);
      if (n > 0) { carry[t] -= n; s.ores[t] += n; s.total[t] += n; got[t] = n; }
    }
    return got;
  }

  // ── 채굴 한 판 ───────────────────────────────────
  // 바위가 수천 개까지 늘어나므로 채굴장을 칸으로 나눠 근처 바위만 찾음 (칸은 매 걸음 다시 담음)
  const BOOM_R = 150;      // 폭발 범위 (바위 간격의 약 두 배)
  const ZAP_R = 320;       // 번개가 튀는 거리
  function newSession(s, r) {
    r = r || Math.random;
    const st = stats(s);
    const sess = { st, r, t: 0, timeLeft: st.time, rocks: [], nid: 1, spawnAcc: 0, swingT: st.swing * 0.5, alive: 0,
      gain: TIERS.map(() => 0), gems: 0, xp: 0, score: 0, broken: 0, crits: 0, over: false, ev: [], sandBonus: 0, heartHit: 0,
      booms: [], gen: 0, genMax: 0, grid: null };
    if (s.heartOpen && !s.cleared) {
      sess.rocks.push({ id: sess.nid++, heart: true, x: st.W / 2, y: st.H / 2, r: HEART.r * Math.pow(st.field, 0.8), tier: 9, hp: s.heartHp, max: HEART.hp, born: 0 });
    }
    buildGrid(sess);
    // 처음엔 꽉 채워서 시작 (0.8초 동안 차례로 솟아남)
    const n0 = st.rocks;
    for (let i = 0; i < n0 * 3 && sess.alive < n0; i++) spawnRock(s, sess, r() * Math.min(0.8, n0 * 0.035), true);
    return sess;
  }
  function pickTier(st, r) {
    const w = st.weights, sum = st.wsum;
    let x = r() * sum;
    for (let t = 0; t < w.length; t++) { if (x < w[t]) return t; x -= w[t]; }
    return st.depth;
  }
  function buildGrid(sess) {
    const st = sess.st, rocks = sess.rocks;
    let g = sess.grid;
    if (!g) {
      const size = 90;
      g = sess.grid = { size, cols: Math.ceil(st.W / size) + 1, rows: Math.ceil(st.H / size) + 1, start: null, items: new Int32Array(64), fill: null };
      g.start = new Int32Array(g.cols * g.rows + 1); g.fill = new Int32Array(g.cols * g.rows);
    }
    if (g.items.length < rocks.length) g.items = new Int32Array(rocks.length * 2);
    const nc = g.cols * g.rows, start = g.start, fill = g.fill;
    fill.fill(0);
    const cell = (k) => Math.min(g.cols - 1, Math.max(0, (k.x / g.size) | 0)) + Math.min(g.rows - 1, Math.max(0, (k.y / g.size) | 0)) * g.cols;
    for (let i = 0; i < rocks.length; i++) { const k = rocks[i]; if (!k.dead) fill[k.c = cell(k)]++; }
    let sum = 0;
    for (let c = 0; c < nc; c++) { start[c] = sum; sum += fill[c]; }
    start[nc] = sum;
    fill.fill(0);
    for (let i = 0; i < rocks.length; i++) { const k = rocks[i]; if (!k.dead) g.items[start[k.c] + fill[k.c]++] = i; }
  }
  // (x, y) 둘레 rad 안의 살아 있는(솟아난) 바위마다 fn(바위). 바위 반지름의 extra배만큼 더 넓게 봄
  function near(sess, x, y, rad, fn, extra) {
    const g = sess.grid, rocks = sess.rocks, pad = 32 * (extra || 0);
    const R0 = rad + pad;
    const c0 = Math.max(0, ((x - R0) / g.size) | 0), c1 = Math.min(g.cols - 1, ((x + R0) / g.size) | 0);
    const r0 = Math.max(0, ((y - R0) / g.size) | 0), r1 = Math.min(g.rows - 1, ((y + R0) / g.size) | 0);
    for (let ry = r0; ry <= r1; ry++) for (let cx = c0; cx <= c1; cx++) {
      const c = cx + ry * g.cols;
      for (let q = g.start[c], e = g.start[c + 1]; q < e; q++) {
        const k = rocks[g.items[q]];
        if (!k || k.dead || k.born > sess.t) continue;
        const dx = k.x - x, dy = k.y - y, rr = rad + k.r * (extra || 0);
        if (dx * dx + dy * dy <= rr * rr) fn(k);
      }
    }
  }
  function spawnRock(s, sess, delay, initial) {
    const st = sess.st, r = sess.r;
    const tier = pickTier(st, r), T = TIERS[tier];
    const rad = T.r * (0.9 + r() * 0.25);
    const x = 50 + r() * (st.W - 100), y = 50 + r() * (st.H - 100);
    // 겹치면 이번엔 안 놓음 (빽빽할 땐 다음 걸음에 다른 자리)
    let clash = false;
    near(sess, x, y, rad * 0.8, () => { clash = true; }, 0.8); // 살짝 겹치는 건 괜찮음 (빽빽할 때도 잘 채워지게)
    if (!clash) for (let i = sess.rocks.length - 1, m = 0; i >= 0 && m < 60; i--, m++) { // 칸에 아직 안 담긴 이번 걸음 바위
      const o = sess.rocks[i]; if (o.c !== undefined || o.dead) continue;
      const dx = o.x - x, dy = o.y - y, md = (o.r + rad) * 0.8; if (dx * dx + dy * dy < md * md) { clash = true; break; }
    }
    if (sess.rocks.length && sess.rocks[0].heart) { const h = sess.rocks[0], dx = h.x - x, dy = h.y - y, md = h.r + rad + 10; if (dx * dx + dy * dy < md * md) clash = true; }
    if (clash) return null;
    const hp = T.hp * st.hpMul;
    const rock = { id: sess.nid++, x, y, r: rad, tier, hp, max: hp, born: sess.t + (delay || 0), seed: Math.floor(r() * 1e9) };
    sess.rocks.push(rock); sess.alive++;
    return rock;
  }
  function liveRocks(sess) { return sess.rocks.filter((k) => !k.dead && k.born <= sess.t); }
  function hit(s, sess, rock, dmg, kind, gen) {
    if (rock.dead) return;
    const st = sess.st, r = sess.r;
    let crit = false;
    if (kind === 'swing' && r() < st.crit) { dmg *= st.critD; crit = true; sess.crits++; }
    rock.hp -= dmg;
    sess.ev.push({ e: 'hit', id: rock.id, k: rock, x: rock.x, y: rock.y, dmg, crit, kind });
    if (rock.heart) {
      sess.heartHit += dmg;
      s.heartHp = Math.max(0, rock.hp);
      if (rock.hp <= 0) {
        rock.dead = true;
        s.cleared = true; s.clearAt = s.clearAt || Date.now();
        sess.ev.push({ e: 'heart', x: rock.x, y: rock.y });
        sess.score += 1000000;
      }
      return;
    }
    if (rock.hp <= 0) breakRock(s, sess, rock, gen || 0);
  }
  function breakRock(s, sess, rock, gen) {
    const st = sess.st, r = sess.r, T = TIERS[rock.tier];
    rock.dead = true; sess.alive--;
    let n = Math.floor(st.oreMul);
    if (r() < st.oreMul - n) n++;
    s.ores[rock.tier] += n; s.total[rock.tier] += n; sess.gain[rock.tier] += n;
    sess.score += n * T.val;
    sess.broken++; s.broken++;
    const xp = (rock.tier + 1) * st.xpMul * st.xpEach;
    sess.xp += xp;
    const ups = addXp(s, xp);
    let gem = false;
    if (r() < st.gemEach) { s.gems++; sess.gems++; gem = true; }
    sess.ev.push({ e: 'break', id: rock.id, k: rock, x: rock.x, y: rock.y, r: rock.r, tier: rock.tier, n, gem, up: ups, gen });
    if (st.sand && sess.sandBonus < st.time * 0.5 && r() < st.sand * st.sandEach) { sess.timeLeft += 0.5; sess.sandBonus += 0.5; sess.ev.push({ e: 'sand', x: rock.x, y: rock.y }); }
    // 폭발: 폭발로 깨진 바위가 또 터질 확률은 대(gen)마다 '연쇄 이어짐'을 곱해 줄어듦. 조금씩 늦게 터져 물결처럼 번짐
    if (st.boom && gen < 30 && r() < st.boom * Math.pow(st.keep, gen)) {
      sess.booms.push({ x: rock.x, y: rock.y, t: sess.t + 0.06 + r() * 0.05, gen: gen + 1 });
    }
  }
  function doBooms(s, sess) {
    const st = sess.st, bs = sess.booms;
    if (!bs.length) return;
    let n = 0;
    for (let i = 0; i < bs.length && n < 800; i++) {
      const b = bs[i];
      if (b.t > sess.t) continue;
      bs[i] = bs[bs.length - 1]; bs.pop(); i--; n++;
      sess.genMax = Math.max(sess.genMax, b.gen);
      sess.ev.push({ e: 'boom', x: b.x, y: b.y, gen: b.gen, r: BOOM_R });
      const list = [];
      near(sess, b.x, b.y, BOOM_R, (k) => list.push(k), 0.6);
      for (const k of list) if (!k.heart) hit(s, sess, k, st.dmg * 2.5, 'boom', b.gen); // 심장은 곡괭이로만
    }
  }
  // cursor: {x, y} 채굴장 좌표, 없으면 null(채굴장 밖)
  function step(s, sess, dt, cursor) {
    if (sess.over) return;
    sess.t += dt;
    sess.timeLeft -= dt;
    const st = sess.st;
    buildGrid(sess);
    // 바위 다시 생기기 (꽉 차기까지 st.refill초)
    if (sess.alive < st.rocks) {
      sess.spawnAcc += dt * st.rocks / st.refill;
      let tries = 0;
      while (sess.spawnAcc >= 1 && sess.alive < st.rocks && tries++ < 2000) { if (spawnRock(s, sess, 0)) sess.spawnAcc -= 1; else sess.spawnAcc -= 0.5; }
    } else sess.spawnAcc = 0;
    // 휘두르기
    sess.swingT -= dt;
    if (sess.swingT <= 0) {
      sess.swingT += st.swing;
      if (sess.swingT <= 0) sess.swingT = st.swing;
      if (cursor) {
        const hits = [];
        near(sess, cursor.x, cursor.y, st.radE, (k) => hits.push(k), 0.6);
        sess.ev.push({ e: 'swing', x: cursor.x, y: cursor.y, n: hits.length });
        for (const k of hits) {
          hit(s, sess, k, st.dmg, 'swing');
          if (st.chain && sess.r() < st.chain) {
            let pick = null, seen = 0;
            near(sess, k.x, k.y, ZAP_R, (o) => { if (o !== k && !o.heart && !o.dead && sess.r() < 1 / ++seen) pick = o; });
            if (pick) {
              sess.ev.push({ e: 'zap', x1: k.x, y1: k.y, x2: pick.x, y2: pick.y });
              hit(s, sess, pick, st.dmg * 1.5, 'zap');
            }
          }
        }
      }
    }
    doBooms(s, sess);
    if (sess.rocks.length > sess.alive * 1.3 + 50) sess.rocks = sess.rocks.filter((k) => !k.dead);
    if (sess.timeLeft <= 0) { sess.timeLeft = 0; sess.over = true; }
  }
  function endSession(s, sess) {
    s.sessions += 1;
    if (sess.score > s.best) s.best = sess.score;
    return { gain: sess.gain, gems: sess.gems, xp: sess.xp, score: sess.score, broken: sess.broken, crits: sess.crits, heartHit: sess.heartHit, best: s.best === sess.score, genMax: sess.genMax };
  }

  // 저장한 상태 고치기(예전 버전·빠진 칸)
  function fix(s) {
    const d = newState();
    if (!s || typeof s !== 'object') return d;
    if (s.offer && s.rerolls === undefined) s.rerolls = REROLLS; // 다시 뽑기 생기기 전 저장
    for (const k in d) if (s[k] === undefined) s[k] = d[k];
    while (s.ores.length < TIERS.length) s.ores.push(0);
    while (s.total.length < TIERS.length) s.total.push(0);
    if (!s.skills.d0) s.skills.d0 = 1;
    return s;
  }

  const MG = { VERSION, W, H, TIERS, HEART, NODES, NODE, PICKS, PICK, PICK_UP_MAX, PICK_UP_V, pickUpCost, CARDS, RAR, CARD_HP,
    fmt, fmtTime, fillDesc, rng, newState, fix, stats, depthOf, lvOf, nodeCost, nodeState, buyNode, canPay,
    pickState, craft, upgradePick, xpNeed, addXp, openOffer, pickCard, lockCard, reroll, REROLLS, cardInfo, mineRates, idle,
    newSession, step, endSession, liveRocks, near, BOOM_R };
  if (typeof module !== 'undefined' && module.exports) module.exports = MG;
  else root.MG = MG;
})(typeof self !== 'undefined' ? self : this);
