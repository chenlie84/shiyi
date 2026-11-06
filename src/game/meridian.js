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
import { buildSkills, isAuxKind } from './skills.js';

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

/** 设/拆链接：把第 m 个主动技挂到第 n 个辅助技上；n 为 null 则拆 */
export function setLink(m, n) {
  if (n == null) delete G.links[m];
  else G.links[m] = n;
  refresh();
  return { ok: true };
}

/** 已被别的主动技占用的辅助星位 */
export function auxTakenBy(auxIdx) {
  for (const k in G.links) if (G.links[k] === auxIdx) return +k;
  return null;
}

/**
 * 某个主动技能挂辅助时的候选表（供 ui 渲染）
 * @returns {Array<{idx:number, star:string, skill:object, current:boolean, takenBy:number|null}>}
 */
export function linkCandidates(mainIdx) {
  const sk = buildSkills();
  const main = sk[mainIdx];
  if (!main) return [];
  const out = [];
  sk.forEach((s, j) => {
    if (!s || !isAuxKind(s.kind)) return;
    const taker = auxTakenBy(j);
    out.push({
      idx: j,
      star: s.pos,
      skill: s,
      current: G.links[mainIdx] === j,
      takenBy: taker != null && taker !== mainIdx ? taker : null,
    });
  });
  return out;
}
