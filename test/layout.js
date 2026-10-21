// 스킬 트리 지도 자리 구하기: node test/layout.js 0.6 130 0.5 0.5 → pos.json (src/engine.js의 MAP에 붙여 넣음). 교차선 0, 최소 간격 130 이상이면 통과
const MG = require('../src/engine.js');
const N = MG.NODES, idx = Object.fromEntries(N.map((n, i) => [n.id, i]));
// 처음 자리: 나선 기둥 + 바깥쪽 가지
const P = N.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
const a0 = -Math.PI / 2, step = +process.argv[2];
const dirOf = (t) => a0 + t * step;
for (const n of N) if (n.col === 0) {
  const t = n.row, r = t === 0 ? 0 : 230 + (t - 1) * (+process.argv[3]);
  P[idx[n.id]].x = Math.cos(dirOf(t)) * r; P[idx[n.id]].y = Math.sin(dirOf(t)) * r;
}
for (const n of N) if (n.k === 'mast') {
  const base = P[idx['d' + n.row]], ang = dirOf(n.row) + Math.PI;
  P[idx[n.id]].x = base.x + Math.cos(ang) * 120; P[idx[n.id]].y = base.y + Math.sin(ang) * 120;
}
for (const n of N) if (n.col !== 0 && n.k !== 'mast') {
  const side = Math.sign(n.col), k = Math.abs(n.col);
  let ang = n.row === 0 ? a0 + Math.PI + side * 0.9 : dirOf(n.row) + (side < 0 ? -(+process.argv[4]) : +process.argv[5]);
  const base = P[idx['d' + n.row]];
  P[idx[n.id]].x = base.x + Math.cos(ang) * 130 * k; P[idx[n.id]].y = base.y + Math.sin(ang) * 130 * k;
}
const edges = [];
for (const n of N) for (const r of n.req) edges.push([idx[r], idx[n.id], n.col === 0 ? 175 : n.k === 'mast' ? 115 : 125]);
for (let it = 0; it < 4000; it++) {
  const F = P.map(() => ({ x: 0, y: 0 }));
  for (const [a, b, L] of edges) {
    const dx = P[b].x - P[a].x, dy = P[b].y - P[a].y, d = Math.hypot(dx, dy) || 1, f = (d - L) * 0.05;
    F[a].x += dx / d * f; F[a].y += dy / d * f; F[b].x -= dx / d * f; F[b].y -= dy / d * f;
  }
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const dx = P[j].x - P[i].x, dy = P[j].y - P[i].y, d = Math.hypot(dx, dy) || 1;
    if (d < 260) { const f = 2400 / (d * d) + (d < 140 ? (140 - d) * 0.3 : 0); F[i].x -= dx / d * f; F[i].y -= dy / d * f; F[j].x += dx / d * f; F[j].y += dy / d * f; }
  }
  const cool = Math.max(0.05, 1 - it / 4000);
  for (let i = 0; i < P.length; i++) {
    if (N[i].id === 'd0') continue;
    P[i].x += Math.max(-20, Math.min(20, F[i].x)) * cool; P[i].y += Math.max(-20, Math.min(20, F[i].y)) * cool;
  }
}
let m = 1e9, pr; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const d = Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y); if (d < m) { m = d; pr = [N[i].id, N[j].id]; } }
// 이음선이 서로 겹치는지
function cross(a, b, c, d) { const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; }
let crossings = 0; for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) { const [a, b] = edges[i], [c, d] = edges[j]; if (a === c || a === d || b === c || b === d) continue; if (cross(P[a], P[b], P[c], P[d])) crossings++; }
const xs = P.map((p) => p.x), ys = P.map((p) => p.y);
console.log('min', m.toFixed(0), pr, 'crossings', crossings, 'w', (Math.max(...xs) - Math.min(...xs)).toFixed(0), 'h', (Math.max(...ys) - Math.min(...ys)).toFixed(0));
require('fs').writeFileSync('pos.json', JSON.stringify(Object.fromEntries(N.map((n, i) => [n.id, [Math.round(P[i].x), Math.round(P[i].y)]]))));
