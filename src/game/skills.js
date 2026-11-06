/**
 * 七技：全部从三才长出来
 *
 * 1-3 本源技（每件器一招）· 4-5 合击技（相邻两件）· 6 阵技（三件成阵）· 7 劫技（五行缺几行）
 * 技能等级：装备「技阶」词条 + 经脉百会给的全局技阶。
 */

import { G } from './state.js';
import { effGrade } from './item.js';
import { calcStats, relOf, evaluate } from './stats.js';
import { ELEM_SKILL, REL_SKILL, SK_MAX } from '../data/skills.js';
import { XING } from '../data/elements.js';

export { SK_MAX };

export const STARS = ['天枢', '天璇', '天玑', '天权', '玉衡', '开阳', '摇光'];

export const clampLv = (n) => Math.max(1, Math.min(SK_MAX, n));

/** 辅助类：不打伤害，只能挂在主动技上 */
export const isAuxKind = (k) => k === 'heal' || k === 'shield' || k === 'buff';
/** 可以挂辅助的主动技 */
export const canLink = (k) => k === 'atk' || k === 'aoe';

/** 技能威力：等级每级 +18% */
export function skillPower(s, stats, e) {
  if (!s) return 0;
  const base = isAuxKind(s.kind) ? stats.mag : stats.atk;
  const lvm = 1 + ((s.lv || 1) - 1) * 0.18;
  return Math.round(base * s.pow * e.total * (1 + (s.grade || 1) * 0.12) * lvm);
}

/**
 * 生成七星技能位
 * @returns {Array<object|null>} 长度 7
 */
export function buildSkills() {
  const [a, b, c] = G.slots;
  const st = calcStats();
  const gb = st.q.skMer || 0; // 只取经脉（百会）给的全局技阶
  const skOf = (it) => (it ? it.skLv || 0 : 0);
  const total = skOf(a) + skOf(b) + skOf(c);
  const sk = [];
  const names = STARS;

  // 1-3 本源技：等级看自己那件装备的技阶
  [a, b, c].forEach((it) => {
    if (!it) {
      sk.push(null);
      return;
    }
    const t = ELEM_SKILL[it.x + it.y];
    if (!t) {
      sk.push(null);
      return;
    }
    const dup = sk.some((x) => x && x.name === t.n);
    sk.push({
      pos: names[sk.length],
      name: dup ? t.n + '·贰' : t.n,
      kind: t.kind,
      pow: t.pow,
      desc: t.d,
      elem: it.x,
      grade: effGrade(it),
      from: '本源',
      item: it,
      lv: clampLv(1 + skOf(it) + gb),
    });
  });

  // 4-5 合击技：等级取两边平均
  const pairs = [
    [a, b],
    [b, c],
  ];
  pairs.forEach((p, i) => {
    if (!p[0] || !p[1]) {
      sk.push(null);
      return;
    }
    const r = relOf(p[0], p[1]);
    const t = REL_SKILL[r];
    const boost = r === '生' ? 1.25 : 1;
    sk.push({
      pos: names[3 + i],
      name: t.n,
      kind: t.kind,
      pow: t.pow * boost,
      desc: t.d,
      elem: p[0].x,
      grade: Math.min(effGrade(p[0]), effGrade(p[1])),
      rel: r,
      from: '合击',
      lv: clampLv(1 + Math.floor((skOf(p[0]) + skOf(p[1])) / 2) + gb),
    });
  });

  // 6 阵技 / 7 劫技：等级取三件均值
  const avg = clampLv(1 + Math.floor(total / 3) + gb);
  if (a && b && c) {
    const e = evaluate(G.slots);

    if (e.r1 === '生' && e.r2 === '生')
      sk.push({ pos: names[5], name: '周天璇玑', kind: 'aoe', pow: 1.5, desc: '璇玑玉衡，《尚书·舜典》；全体大伤', elem: a.x, grade: 5, from: '阵', lv: avg });
    else if (e.r1 === '克' && e.r2 === '克')
      sk.push({ pos: names[5], name: '煞气冲斗', kind: 'aoe', pow: 1.3, desc: '剑气冲斗牛，《晋书》；全体伤害，自损一成', elem: b.x, grade: 4, from: '阵', selfHurt: 0.1, lv: avg });
    else if (a.x === b.x && b.x === c.x)
      sk.push({ pos: names[5], name: '抱元守一', kind: 'atk', pow: 2.2, desc: '《道德经》抱元守一；单体巨伤', elem: a.x, grade: 5, from: '阵', lv: avg });
    else
      sk.push({ pos: names[5], name: '乱阵', kind: 'atk', pow: 1.0, desc: '三才不成章法，只此一击', elem: a.x, grade: 2, from: '阵', lv: avg });

    // 劫技：缺的行越多越弱
    const used = new Set([a.x, b.x, c.x]);
    const miss = XING.filter((x) => !used.has(x));
    const p = miss.length === 2 ? 2.0 : miss.length === 3 ? 1.4 : 1.0;
    sk.push({
      pos: names[6],
      name: miss.length ? miss.join('') + '之厄' : '圆满之厄',
      kind: 'atk',
      pow: p,
      desc: '劫位之力，缺 ' + miss.length + ' 行',
      elem: miss[0] || a.x,
      grade: 5,
      from: '劫',
      miss: miss.length,
      lv: clampLv(1 + Math.floor(total / 3) + gb + (miss.length === 0 ? 1 : 0)),
    });
  } else {
    sk.push(null);
    sk.push(null);
  }

  return sk;
}

/* ---------- 技能链接：辅助技挂在主动技上 ---------- */
/** 返回被链接的辅助技（星位会随配装变，取用前都校验类型） */
export function auxOf(idx, list) {
  const ln = G.links[idx];
  if (ln == null || ln === idx) return null;
  const s = (list || buildSkills())[ln];
  if (!s || !isAuxKind(s.kind)) return null;
  return s;
}

/** 已被别的主动技占用的辅助星位 */
export function auxTakenBy(auxIdx) {
  for (const k in G.links) if (G.links[k] === auxIdx) return +k;
  return null;
}
