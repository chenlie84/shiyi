/**
 * 经脉：人形十二穴 + 技能链接
 *
 * 经脉点来自破阵升级与拾遗录。二阶「大成」效果 ×1.8。
 * 链接是"辅助技挂在主动技上"，不占回合、按六成强度同步施放。
 */

import { G, S } from './state.js';
import { MER } from '../data/meridian.js';
import { log, refresh } from '../render/presenter.js';
import { calcStats } from './stats.js';
import { buildSkills, isRune, runeTakenBy, toggleLink, linkCount } from './skills.js';

/** 节点状态：deep 大成 / on 已通 / lock 未解锁 / ready 可点 */
export function merState(nd) {
  const lv = G.mer[nd.id] || 0;
  if (lv >= 2) return 'deep';
  if (lv === 1) return 'on';
  if (nd.req && !G.mer[nd.req]) return 'lock';
  return 'ready';
}

/** 点一个穴位（可点两次，第二次是"淬"成大成的） */
export function onNode(id) {
  const nd = MER.find((n) => n.id === id);
  if (!nd) return { ok: false };
  const lv = G.mer[id] || 0;
  if (lv >= 2) return { ok: false, reason: 'maxed' };

  if (lv === 0 && nd.req && !G.mer[nd.req]) {
    log('先通「' + MER.find((n) => n.id === nd.req).n + '」。', '#a83b2c');
    return { ok: false, reason: 'locked' };
  }
  if (G.pts <= 0) {
    log('经脉点不够。破阵涨修为，升级给 1 点。', '#a83b2c');
    return { ok: false, reason: 'no-point' };
  }

  G.pts--;
  G.mer[id] = lv + 1;
  // 气血上限可能变，别让当前血超上限
  S.php = Math.min(S.php, calcStats().s.hp);

  log((lv === 0 ? '通' : '淬') + nd.n + '：' + nd.d + (lv === 0 ? '' : '（大成 ×1.8）'), '#8a5a1f');
  refresh();
  return { ok: true, node: nd };
}

/**
 * 挂/拆一道符。n 为 null 则清空这一式所有符。
 * 同一个符只能挂一式，一式最多挂两道（RUNE_MAX）。
 */
export function setLink(m, n) {
  if (n == null) {
    delete G.links[m];
    refresh();
    return { ok: true };
  }
  const r = toggleLink(m, n);
  if (!r.ok) {
    log(r.reason === 'full' ? '这一式已挂满两道符。' : '这道符已挂在别的法术上。', '#a83b2c');
  }
  refresh();
  return r;
}

/**
 * 某一式法术挂符时的候选表（供 ui 渲染）
 * @returns {Array<{idx:number, star:string, rune:object, current:boolean, takenBy:number|null}>}
 */
export function linkCandidates(mainIdx) {
  const sk = buildSkills();
  const main = sk[mainIdx];
  if (!main) return [];
  const cur = G.links[mainIdx];
  const list = Array.isArray(cur) ? cur : cur == null ? [] : [cur];
  const out = [];
  sk.forEach((s, j) => {
    if (!s || !isRune(s)) return;
    const taker = runeTakenBy(j);
    out.push({
      idx: j,
      star: s.pos,
      rune: s.rune,
      skill: s,
      lv: s.lv,
      current: list.includes(j),
      takenBy: taker != null && taker !== mainIdx ? taker : null,
      slots: linkCount(mainIdx),
    });
  });
  return out;
}
