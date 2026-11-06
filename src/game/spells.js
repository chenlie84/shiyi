/**
 * 法术推演与合成
 *
 * 两件事：
 *   1. deriveSpell(主行, 副行) —— 按五行关系推出一式法术（25 式就在这张表里）
 *   2. composeSpell(法术, 符[]) —— 把挂上去的符叠进这一式的最终规格
 *
 * 最终规格 spec 是 combat / fx 唯一认的东西：
 *   { proj, pow, perShot, path, spd, pierce, size, trait, pen, crit, leech, onHit, castHeal ... }
 */

import { SPELL_BODY, CROSS, SUB_TRAIT, SPELL_NAME } from '../data/spells.js';
import { RUNES, RUNE_POOL } from '../data/runes.js';
import { XING, SHENG, KE } from '../data/elements.js';

/** 发射数越多，单发越薄。总伤 ∝ 威力 × proj^(1-FALLOFF) */
export const PROJ_FALLOFF = 0.45;

/** 主行 → 副行 是哪种关系 */
export function crossOf(main, sub) {
  if (main === sub) return '同气';
  if (SHENG[main] === sub) return '我生'; // 我去生它，气就泄了
  if (SHENG[sub] === main) return '生我'; // 它来生我，势就盛了
  if (KE[main] === sub) return '我克'; // 我克它，能贯过去
  if (KE[sub] === main) return '克我'; // 它克我，弹道就乱
  return '同气';
}

/**
 * 交叉推演一式法术
 * @param {string} main 主行（体）
 * @param {string} sub 副行（性）
 * @returns {object} 法术模板（不含等级、不含符）
 */
export function deriveSpell(main, sub) {
  const body = SPELL_BODY[main] || SPELL_BODY.木;
  const cross = crossOf(main, sub);
  const cr = CROSS[cross];
  const tr = SUB_TRAIT[sub] || SUB_TRAIT.木;
  const rec = (SPELL_NAME[main] || {})[sub] || {};

  return {
    name: rec.n || body.body,
    lore: rec.lore || '',
    desc: rec.d || '',
    body: body.body,
    elem: main,
    sub,
    cross,
    crossN: cr.n,
    pow: body.pow * cr.powMul,
    proj: Math.max(1, body.proj + cr.proj),
    path: cr.path || body.path,
    spd: body.spd,
    pierce: body.pierce + cr.pierce,
    size: body.size,
    trait: tr.k,
    traitN: tr.n,
    traitD: tr.d,
    note: cr.d,
  };
}

/**
 * 由两件的五行与它们的关系，定这一位抽出的是什么符。
 * 确定性：同样的配装永远给同样的符，玩家能规划。
 * @param {string} rel 关系（生 / 逆生 / 克 / 比和）
 * @param {object} a 前一件
 * @param {object} b 后一件
 * @param {number} lv 符等级
 */
export function runeFor(rel, a, b, lv = 1) {
  const pool = RUNE_POOL[rel] || RUNE_POOL['比和'];
  const ia = Math.max(0, XING.indexOf(a ? a.x : '木'));
  const ib = Math.max(0, XING.indexOf(b ? b.x : '木'));
  const key = pool[(ia * 5 + ib) % pool.length];
  const def = RUNES[key];
  if (!def) return null;
  return {
    key,
    n: def.n,
    tag: def.tag,
    col: def.col,
    d: def.d,
    mod: def.mod,
    lv,
    rel,
  };
}

/**
 * 把符叠进法术，得到最终规格
 * @param {object} spell deriveSpell 的结果
 * @param {Array<object|null>} runes 已挂的符
 * @returns {object} spec
 */
export function composeSpell(spell, runes = []) {
  const spec = {
    proj: spell.proj,
    pow: spell.pow,
    path: spell.path,
    spd: spell.spd,
    pierce: spell.pierce,
    size: spell.size,
    trait: spell.trait,
    traitN: spell.traitN,
    pen: 0,
    crit: 0,
    critDmg: 0,
    leech: 0,
    onHit: null,
    castHeal: 0,
    castShield: 0,
    castBuff: 0,
    tags: [],
  };

  runes.forEach((r) => {
    if (!r || !r.mod) return;
    const m = r.mod;
    const k = 1 + ((r.lv || 1) - 1) * 0.15; // 符等级放大"偏离 1"的部分
    const off = (v) => 1 + (v - 1) * k;

    if (m.proj) spec.proj += m.proj;
    if (m.pierce) spec.pierce += m.pierce;
    if (m.path) spec.path = m.path;
    if (m.powMul) spec.pow *= off(m.powMul);
    if (m.spd) spec.spd *= off(m.spd);
    if (m.size) spec.size *= off(m.size);
    if (m.pen) spec.pen += m.pen * k;
    if (m.crit) spec.crit += m.crit * k;
    if (m.critDmg) spec.critDmg += m.critDmg * k;
    if (m.leech) spec.leech += m.leech * k;
    if (m.onHit) spec.onHit = m.onHit;
    if (m.castHeal) spec.castHeal += m.castHeal * k;
    if (m.castShield) spec.castShield += m.castShield * k;
    if (m.castBuff) spec.castBuff += 1;

    spec.tags.push(r.n);
  });

  spec.proj = Math.max(1, Math.min(9, Math.round(spec.proj)));
  spec.pierce = Math.max(0, Math.min(5, Math.round(spec.pierce)));
  spec.size = Math.max(0.6, Math.min(3.2, spec.size));
  spec.spd = Math.max(0.5, Math.min(2.6, spec.spd));

  // 多发衰减：发数上去了，每发就得薄一点，否则加发数等于白送伤害
  spec.perShot = Math.pow(1 / spec.proj, PROJ_FALLOFF);
  return spec;
}

/** 这一式的"等效总威力"系数，给 UI 估算与无头驱动用 */
export function spellWeight(spec) {
  return spec.pow * spec.proj * spec.perShot;
}
