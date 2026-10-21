/* 랭킹: '새 게임 → 광산의 심장 깨기'까지 걸린 실제 시간 (짧을수록 위)
 * - 새 게임을 시작할 때 서버가 도전 번호와 열쇠를 주고 시작 시각을 적어 둠
 * - 심장을 깨면 화면이 바로 알리고, 서버가 자기 시계로 걸린 시간을 잼 (화면이 보낸 시간은 믿지 않음)
 * - 이름은 그 뒤에 따로 올림 (7일 안에, 한 번만)
 * 한계: 게임 진행은 브라우저에서 돌아가서 저장 내용을 고친 기록까지는 막지 못함 → 너무 빠른 기록은 거절, 이상한 기록은 관리 페이지에서 지움
 */
import { DurableObject } from 'cloudflare:workers';

const KEEP = 100;
const RUN_TTL = 40 * 24 * 3600 * 1000;   // 시작하고 40일 지나면 도전 정보 정리
const NAME_TTL = 7 * 24 * 3600 * 1000;   // 클리어하고 7일 안에 이름을 올려야 함
const STARTS_PER_HOUR = 20;
// 판(버전)마다 랭킹 표가 따로: 1 = 클래식(바위 수십 개), 2 = 바위 수천 개 버전
export const VERS = [1, 2];
export const MIN_MS = { 1: 20 * 60 * 1000, 2: 20 * 60 * 1000 };   // 이보다 빠른 기록은 받지 않음
export const MIN_SESSIONS = { 1: 40, 2: 30 };
const verOf = (v) => (VERS.includes(+v) ? +v : 1);
const bk = (v) => (v === 1 ? 'b:clear' : 'b:clear' + v);
const sk = (v) => (v === 1 ? 'stats' : 'stats' + v);

const hex = (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
export function cleanRankName(s) {
  s = String(s || '').replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, 8).join('');
}
const num = (x, lo, hi) => { x = Math.floor(+x || 0); return Math.max(lo, Math.min(hi, x)); };

export class Rank extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.fast = !!(env && env.FAST_TEST);
  }
  async tidy() {
    const now = Date.now();
    if (now - (this.lastTidy || 0) < 3600 * 1000) return;
    this.lastTidy = now;
    const old = await this.ctx.storage.list({ prefix: 'r:', end: 'r:' + (now - RUN_TTL).toString(36), limit: 500 });
    if (old.size) await this.ctx.storage.delete([...old.keys()]);
  }
  minMs(v) { return this.fast ? 1000 : MIN_MS[v]; }
  minSessions(v) { return this.fast ? 1 : MIN_SESSIONS[v]; }
  async start(who, ver) {
    ver = verOf(ver);
    await this.tidy();
    const hour = Math.floor(Date.now() / 3600000);
    const lk = 'l:' + who;
    const l = (await this.ctx.storage.get(lk)) || { hour, n: 0 };
    if (l.hour !== hour) { l.hour = hour; l.n = 0; }
    if (l.n >= STARTS_PER_HOUR) return { error: '새 게임을 너무 자주 시작했어요. 잠시 뒤에 다시 해 주세요' };
    l.n += 1;
    await this.ctx.storage.put(lk, l);
    const at = Date.now();
    const id = at.toString(36) + hex(6);
    const token = hex(16);
    await this.ctx.storage.put('r:' + id, { token, at, ver });
    const b = await this.ctx.storage.get(sk(ver));
    await this.ctx.storage.put(sk(ver), { starts: ((b && b.starts) || 0) + 1, clears: (b && b.clears) || 0 });
    return { run: id, token, at, ver };
  }
  async getRun(id, token) {
    if (!/^[a-z0-9]{6,12}[a-f0-9]{12}$/.test(String(id || ''))) return null;
    const r = await this.ctx.storage.get('r:' + id);
    if (!r || r.token !== String(token || '')) return null;
    return r;
  }
  // 심장을 깼을 때 (같은 도전으로 여러 번 불러도 처음 잰 시간 그대로)
  async clear(body) {
    const r = await this.getRun(body.run, body.token);
    if (!r) return { error: '이 게임은 랭킹 도전으로 시작하지 않았어요' };
    const v = verOf(r.ver);
    if (!r.clearAt) {
      const now = Date.now();
      const info = { sessions: num(body.sessions, 0, 1e6), level: num(body.level, 0, 9999), broken: num(body.broken, 0, 1e9), clientMs: num(body.clientMs, 0, 1e11) };
      const ms = now - r.at;
      r.clearAt = now; r.ms = ms; r.info = info;
      if (ms < this.minMs(v) || info.sessions < this.minSessions(v)) {
        r.rejected = true;
        await this.report(`너무 빠른 클리어 (${Math.round(ms / 1000)}초, ${info.sessions}판)`, body.run, r);
      }
      await this.ctx.storage.put('r:' + body.run, r);
      if (!r.rejected) {
        const b = (await this.ctx.storage.get(sk(v))) || { starts: 0, clears: 0 };
        b.clears += 1;
        await this.ctx.storage.put(sk(v), b);
      }
    }
    if (r.rejected) return { error: '기록이 너무 빨라서 확인할 수 없어요. 관리자에게 자동으로 알렸어요', ms: r.ms };
    return { ok: true, ms: r.ms, place: await this.placeFor(r.ms, v), named: !!r.named, ver: v };
  }
  async placeFor(ms, v) {
    const b = (await this.ctx.storage.get(bk(v))) || { list: [] };
    return b.list.filter((e) => e.ms <= ms).length + 1;
  }
  async setName(body) {
    const r = await this.getRun(body.run, body.token);
    if (!r) return { error: '이 게임은 랭킹 도전으로 시작하지 않았어요' };
    if (!r.clearAt) return { error: '아직 광산의 심장을 깨지 않았어요' };
    if (r.rejected) return { error: '확인하지 못한 기록이라 올릴 수 없어요' };
    if (r.named) return { error: '이미 이름을 올렸어요' };
    if (Date.now() - r.clearAt > NAME_TTL) return { error: '클리어하고 7일이 지나서 올릴 수 없어요' };
    const name = cleanRankName(body.name);
    if (!name) return { error: '이름을 넣어 주세요' };
    const v = verOf(r.ver);
    const b = (await this.ctx.storage.get(bk(v))) || { list: [], total: 0 };
    const entry = { id: hex(6), name, ms: r.ms, sessions: r.info.sessions, level: r.info.level, at: r.clearAt };
    b.list.push(entry);
    b.list.sort((x, y) => x.ms - y.ms || x.at - y.at);
    const place = b.list.indexOf(entry) + 1;
    b.list = b.list.slice(0, KEEP);
    b.total = (b.total || 0) + 1;
    await this.ctx.storage.put(bk(v), b);
    r.named = true;
    await this.ctx.storage.put('r:' + body.run, r);
    return { ok: true, place: place <= KEEP ? place : null, id: entry.id, total: b.total };
  }
  async board(ver) {
    const v = verOf(ver);
    const b = (await this.ctx.storage.get(bk(v))) || { list: [], total: 0 };
    const st = (await this.ctx.storage.get(sk(v))) || { starts: 0, clears: 0 };
    return { ver: v, list: b.list, total: b.total || 0, starts: st.starts, clears: st.clears };
  }
  async remove(id, ver) {
    const v = verOf(ver);
    const b = await this.ctx.storage.get(bk(v));
    if (!b) return false;
    const before = b.list.length;
    b.list = b.list.filter((e) => e.id !== id);
    await this.ctx.storage.put(bk(v), b);
    return b.list.length < before;
  }
  async report(why, id, r) {
    try {
      const inbox = this.env.INBOX.get(this.env.INBOX.idFromName('main'));
      await inbox.add({ kind: 'bug', text: '[자동] 랭킹 — ' + why, context: { auto: 'rank', run: id, at: r.at, ms: r.ms, info: r.info } }, 'rank-auto-' + id);
    } catch (e) { console.error('report', e); }
  }
}
