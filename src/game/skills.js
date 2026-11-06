/**
 * 七星：三式本源法术 + 两道符 + 阵技 + 劫技
 *
 *   1-3  本源法术  每件器一式：自己五行为体，下一位五行为性 → 交叉推演
 *   4-5  符位      由相邻两位的关系推出来（相生给量，相克给轨），挂在法术上改造它
 *   6    阵技      三件成阵才有的大术
 *   7    劫技      五行缺得越多越弱
 *
 * 技能等级：装备「技阶」词条 + 经脉百会的全局技阶，上限 Lv7。
 */

import { G } from './state.js';
import { effGrade } from './item.js';
import { calcStats, relOf, evaluate } from './stats.js';
import { ARRAY_SPELL, JIE_SPELL, SPELL_SCALE } from '../data/spells.js';
import { RUNE_MAX } from '../data/runes.js';
import { XING } from '../data/elements.js';
import { deriveSpell, runeFor, composeSpell, spellWeight } from './spells.js';

export const SK_MAX = 7;
export const STARS = ['天枢', '天璇', '天玑', '天权', '玉衡', '开阳', '摇光'];
export const clampLv = (n) => Math.max(1, Math.min(SK_MAX, n));

/** 法术（能挂符） */
export const isSpell = (s) => !!s && s.kind === 'spell';
/** 符（只能挂到法术上） */
export const isRune = (s) => !!s && s.kind === 'rune';

/**
 * 法术威力
 * @param {object} sk 技能
 * @param {object} spec composeSpell 的结果
 * @param {object} stats calcStats().s
 * @param {object} e calcStats().e
 */
export function skillPower(sk, spec, stats, e) {
  if (!sk || !spec) return 0;
  // 法术取攻与法攻的均值，两类词条都吃得进
  const base = (stats.atk + stats.mag) * 0.5;
  const lvm = 1 + ((sk.lv || 1) - 1) * 0.18;
  const g = 1 + (sk.grade || 1) * 0.12;
  return Math.round(base * spellWeight(spec) * e.total * g * lvm * SPELL_SCALE);
}

/**
 * 生成七星
 * @returns {Array<object|null>} 长度 7
 */
export function buildSkills() {
  const [a, b, c] = G.slots;
  const st = calcStats();
  const gb = st.q.skMer || 0; // 经脉（百会）给的全局技阶
  const skOf = (it) => (it ? it.skLv || 0 : 0);
  const total = skOf(a) + skOf(b) + skOf(c);
  const sk = [];

  /* ── 1-3 本源法术：自己为体，下一位为性 ── */
  const trio = [a, b, c];
  trio.forEach((it, i) => {
    if (!it) {
      sk.push(null);
      return;
    }
    const next = trio[(i + 1) % 3] || it; // 地位回头取天位，三才本就是圆的
    const t = deriveSpell(it.x, next.x);
    sk.push({
      i: sk.length,
      pos: STARS[sk.length],
      name: t.name,
      kind: 'spell',
      elem: t.elem,
      sub: t.sub,
      cross: t.cross,
      crossN: t.crossN,
      desc: t.desc || (t.note + ' · 命中' + t.traitN),
      note: t.note,
      traitN: t.traitN,
      grade: effGrade(it),
      from: '本源',
      item: it,
      lv: clampLv(1 + skOf(it) + gb),
      spell: t,
    });
  });

  /* ── 4-5 符位：由相邻两位的关系推出来 ── */
  [
    [a, b],
    [b, c],
  ].forEach((p, i) => {
    if (!p[0] || !p[1]) {
      sk.push(null);
      return;
    }
    const r = relOf(p[0], p[1]);
    const lv = clampLv(1 + Math.floor((skOf(p[0]) + skOf(p[1])) / 2) + gb);
    const rn = runeFor(r, p[0], p[1], lv);
    sk.push({
      i: sk.length,
      pos: STARS[3 + i],
      name: rn.n,
      kind: 'rune',
      rune: rn,
      desc: rn.d,
      elem: p[0].x,
      rel: r,
      grade: Math.min(effGrade(p[0]), effGrade(p[1])),
      from: r === '生' || r === '逆生' ? '相生之符' : r === '克' ? '相克之符' : '同气之符',
      lv,
    });
  });

  /* ── 6 阵技 / 7 劫技 ── */
  const avg = clampLv(1 + Math.floor(total / 3) + gb);
  if (a && b && c) {
    const e = evaluate(G.slots);
    let tpl;
    if (e.r1 === '生' && e.r2 === '生') tpl = ARRAY_SPELL.三生;
    else if (e.r1 === '克' && e.r2 === '克') tpl = ARRAY_SPELL.双克;
    else if (a.x === b.x && b.x === c.x) tpl = ARRAY_SPELL.纯体;
    else tpl = ARRAY_SPELL.乱;

    sk.push({
      i: sk.length,
      pos: STARS[5],
      name: tpl.n,
      kind: 'spell',
      elem: a.x,
      grade: tpl === ARRAY_SPELL.乱 ? 2 : 5,
      from: '阵',
      lv: avg,
      desc: tpl.d,
      selfHurt: tpl.selfHurt || 0,
      spell: { ...tpl, elem: b.x, trait: null, traitN: '', name: tpl.n },
    });

    const used = new Set([a.x, b.x, c.x]);
    const miss = XING.filter((x) => !used.has(x));
    const j = JIE_SPELL[miss.length] || JIE_SPELL[0];
    sk.push({
      i: sk.length,
      pos: STARS[6],
      name: miss.length ? miss.join('') + '之厄' : '圆满之厄',
      kind: 'spell',
      elem: miss[0] || a.x,
      grade: 5,
      from: '劫',
      miss: miss.length,
      lv: clampLv(avg + (miss.length === 0 ? 1 : 0)),
      desc: j.d,
      spell: { ...j, elem: miss[0] || a.x, trait: null, traitN: '', name: '' },
    });
  } else {
    sk.push(null);
    sk.push(null);
  }

  return sk;
}

/* ── 符的挂载 ── */

/** 第 idx 式法术挂着的符（按 G.links 里的顺序） */
export function runesOf(idx, list) {
  const arr = G.links[idx];
  if (!arr) return [];
  const l = list || buildSkills();
  const out = [];
  (Array.isArray(arr) ? arr : [arr]).forEach((j) => {
    const s = l[j];
    if (s && isRune(s)) out.push(s.rune);
  });
  return out;
}

/** 这个符被哪一式占着（一个符只能挂一式） */
export function runeTakenBy(runeIdx) {
  for (const k in G.links) {
    const arr = G.links[k];
    const list = Array.isArray(arr) ? arr : arr == null ? [] : [arr];
    if (list.includes(runeIdx)) return +k;
  }
  return null;
}

/** 已挂几道符 */
export function linkCount(idx) {
  const arr = G.links[idx];
  if (!arr) return 0;
  return (Array.isArray(arr) ? arr : [arr]).length;
}

/** 挂/拆一道符（满 RUNE_MAX 就不再挂） */
export function toggleLink(mainIdx, runeIdx, list) {
  const l = list || buildSkills();
  const cur = G.links[mainIdx];
  let arr = Array.isArray(cur) ? cur.slice() : cur == null ? [] : [cur];

  const at = arr.indexOf(runeIdx);
  if (at >= 0) arr.splice(at, 1);
  else {
    const taker = runeTakenBy(runeIdx);
    if (taker != null && taker !== mainIdx) return { ok: false, reason: 'taken' };
    if (arr.length >= RUNE_MAX) return { ok: false, reason: 'full' };
    arr.push(runeIdx);
  }

  if (arr.length) G.links[mainIdx] = arr;
  else delete G.links[mainIdx];
  return { ok: true };
}

/** 清掉配装变化后失效的链 */
export function pruneLinks(list) {
  const l = list || buildSkills();
  Object.keys(G.links).forEach((k) => {
    const main = l[k];
    const arr = G.links[k];
    const keep = (Array.isArray(arr) ? arr : [arr]).filter((j) => isRune(l[j]));
    if (!isSpell(main) || !keep.length) delete G.links[k];
    else G.links[k] = keep;
  });
}

/**
 * 一式法术的最终规格（法术 × 已挂的符）
 * @param {object} s 技能
 * @param {Array} list buildSkills() 结果（省一次重算）
 */
export function resolve(s, list) {
  if (!s || s.kind !== 'spell') return null;
  const spec = composeSpell(s.spell, runesOf(s.i, list));
  spec.elem = s.elem;
  spec.name = s.name;
  spec.selfHurt = s.selfHurt || 0;
  spec.onCastHeal = spec.castHeal;
  spec.onCastShield = spec.castShield;
  spec.onCastBuff = spec.castBuff;
  return spec;
}
