/**
 * 器物：词条 roll、品级、估价、器魂
 *
 * 这里只产出"数据"。要 HTML 片段请去 ui/format.js。
 */

import { G } from './state.js';
import { rand } from '../core/rng.js';
import { XING, ELEM_PREF } from '../data/elements.js';
import { PRE, SUF, RARE, PREK, SUFK } from '../data/affixes.js';
import { RAR_AFFIX, RAR_NEED_IDENT } from '../data/rarity.js';
import { INSCR, SPIRIT, CURSE } from '../data/inscriptions.js';
import { ITEM_NAMES } from '../data/items.js';

/* ---------- 品级 ---------- */
/** 残器的实际品级：掉一档，但不低于凡品 */
export function effGrade(it) {
  return it.broken ? Math.max(1, it.grade - 1) : it.grade;
}

/**
 * T 级 roll：1 最强。
 * 稀有度越高越容易出高 T —— 凡品最高 T5，道品落在 T1/T2 之间。
 */
export function rollTier(grade) {
  const best = Math.max(1, Math.min(5, 7 - grade));
  const t = rand() < 0.5 ? best : best - 1;
  return Math.max(1, Math.min(5, t));
}

/* ---------- 词条 ---------- */
export function rollAffix(grade, kind, elem) {
  if (!kind) kind = rand() < 0.45 ? 'pre' : 'suf';
  const t = rollTier(grade);

  // 稀有通道：16% 直接出「技阶」，不看五行倾向
  if (kind === 'suf' && rand() < 0.16) {
    return { kind: 'suf', k: 'sk', t, v: RARE.sk.v[5 - t] };
  }

  const P = ELEM_PREF[elem];
  let key;
  if (P && rand() < 0.8) {
    // 八成顺着五行长，两成完全随机
    const pool = kind === 'pre' ? P.pre : P.suf;
    key = pool[Math.floor(rand() * pool.length)];
  } else {
    const pool = kind === 'pre' ? PREK : SUFK;
    key = pool[Math.floor(rand() * pool.length)];
  }
  const def = kind === 'pre' ? PRE[key] : SUF[key];
  return { kind, k: key, t, v: def.v[5 - t] };
}

export const cntPre = (it) => it.affixes.filter((a) => a.kind === 'pre').length;
export const cntSuf = (it) => it.affixes.filter((a) => a.kind === 'suf').length;
export const afDef = (a) => (a.kind === 'pre' ? PRE[a.k] : SUF[a.k]);
export const afUnit = (a) => (a.kind === 'pre' ? '' : afDef(a).u || '');

/** 纯文本版词条串，给战报和 control 台看 */
export function afText(it) {
  return it.affixes
    .map((a) => {
      const d = afDef(a);
      return d.n + '+' + a.v + afUnit(a) + ' T' + a.t;
    })
    .join(' / ');
}

/** 该装备还能长哪类词条：前后缀各自上限 3 条，合计 6 */
export function freeKind(it) {
  const p = cntPre(it) < 3;
  const s = cntSuf(it) < 3;
  if (p && s) return rand() < 0.5 ? 'pre' : 'suf';
  return p ? 'pre' : s ? 'suf' : null;
}

/** 改写词条档位，数值跟着重算 */
export function reTier(a, t) {
  a.t = Math.max(1, Math.min(5, t));
  a.v = afDef(a).v[5 - a.t];
}

/* ---------- 展示名 / 估价 / 器魂 ---------- */
/** 未鉴定时连名字都不给看 —— 悬念全压在「鉴」这一下 */
export const nmOf = (it) => (it.ident === false ? '未鉴之器' : it.name);

export function sellPrice(it) {
  if (it.ident === false) return Math.round(Math.pow(it.grade, 2) * 5);
  return Math.round(Math.pow(it.grade, 2) * 10 + it.affixes.reduce((a, af) => a + (6 - af.t) * 5, 0));
}

export function soulOf(it) {
  if (it.ident === false) return 1;
  const base = [0, 1, 2, 4, 8, 15][it.grade] || 1;
  return base + it.affixes.filter((a) => a.t <= 2).length; // 高 T 词条能多榨出点魂
}

/* ---------- 掉落 ---------- */
/** 凡 58 / 灵 26 / 宝 11 / 仙 4 / 道 1。波数越深、难度越高，好货越多 */
export function rollRarity(wave) {
  const t = Math.min(1, (wave || 1) / 35 + Math.max(0, G.diff - 1) * 0.22);
  const r = rand() * 100;
  if (r < 58 - t * 12) return 1;
  if (r < 84 - t * 5) return 2;
  if (r < 95) return 3;
  if (r < 99) return 4;
  return 5;
}

export function fillAffixes(it, n) {
  const targetPre = Math.ceil(n / 2);
  let pre = 0;
  let suf = 0;
  for (let i = 0; i < n; i++) {
    let kind;
    if (pre >= 3) kind = 'suf';
    else if (suf >= 3) kind = 'pre';
    else if (pre < targetPre) kind = 'pre';
    else kind = 'suf';
    it.affixes.push(rollAffix(it.grade, kind, it.x));
    if (kind === 'pre') pre++;
    else suf++;
  }
}

/**
 * 造一件器
 * @param {number} wave 当前波次（决定品级曲线）
 * @param {boolean} [forceBroken]
 * @param {number} [forceGrade]
 */
export function makeItem(wave, forceBroken, forceGrade) {
  const x = XING[Math.floor(rand() * 5)];
  const y = rand() < 0.5 ? '阳' : '阴';
  const grade = forceGrade !== undefined ? forceGrade : rollRarity(wave || 1);
  const broken = forceBroken !== undefined ? forceBroken : rand() < (grade >= 3 ? 0.16 : 0.34);

  const it = { id: G.uid++, x, y, grade, broken, affixes: [], name: '', ident: true };
  fillAffixes(it, RAR_AFFIX[grade]);

  if (grade >= 3) it.inscr = INSCR[Math.floor(rand() * INSCR.length)];
  if (grade >= 4) it.spirit = SPIRIT[Math.floor(rand() * SPIRIT.length)];
  if (grade >= 5) it.curse = CURSE[Math.floor(rand() * CURSE.length)];

  const pool = ITEM_NAMES[x];
  const idx = Math.min(pool.length - 1, grade - 1 + (rand() < 0.5 ? 0 : 1));
  it.base = pool[idx];
  it.name = it.base + (broken ? '·残' : '') + '·' + y + x;

  if (RAR_NEED_IDENT[grade]) it.ident = false; // 捡到时还看不清
  return it;
}

/** 在行囊里按 id 找器 */
export function findItem(id) {
  const inBag = G.bag.find((i) => i.id === id);
  if (inBag) return inBag;
  for (const it of G.slots) if (it && it.id === id) return it;
  return null;
}
