/**
 * 三才关系与属性结算
 *
 * 一条链：三件器 → evaluate() 出倍率 → calcStats() 出 {s 基础属性, q 修正表, e 三才}
 * 所有战斗数值都必须从这里出，别在战斗代码里另算。
 */

import { G } from './state.js';
import { effGrade } from './item.js';
import { SHENG, MULT, SHA_LOSS, COL } from '../data/elements.js';
import { PRE } from '../data/affixes.js';
import { MER } from '../data/meridian.js';

/* ---------- 境界 / 经脉 ---------- */
export function xpNeed(lv) {
  return 26 + (lv - 1) * 12;
}

/** 经脉加成汇总。二阶「大成」效果 ×1.8 */
export function merBonus() {
  const b = {};
  MER.forEach((nd) => {
    const lv = G.mer[nd.id] || 0;
    if (!lv) return;
    b[nd.t] = (b[nd.t] || 0) + nd.v * (lv >= 2 ? 1.8 : 1);
  });
  return b;
}

/* ---------- 三才 ---------- */
/** 天→人 / 人→地 两段关系 */
export function relOf(a, b) {
  if (a.x === b.x) return '比和';
  if (SHENG[a.x] === b.x) return '生';
  if (SHENG[b.x] === a.x) return '逆生';
  return '克';
}

/**
 * 三件器排出三才
 * 生 ×2 · 克 ×¼ · 阴阳济 ×½；两段都是克会积煞，若末段仍生则「煞转」补一部分回来
 */
export function evaluate(arr) {
  const [a, b, c] = arr;

  if (!a || !b || !c) {
    const rs = [];
    if (a && b) rs.push(relOf(a, b));
    if (b && c) rs.push(relOf(b, c));
    let m = 1;
    rs.forEach((r) => (m *= MULT[r]));
    return { r1: rs[0] || '—', r2: rs[1] || '—', m, total: m, sha: 0, burn: false, partial: true };
  }

  const r1 = relOf(a, b);
  const r2 = relOf(b, c);
  const m = MULT[r1] * MULT[r2];

  let sha = 0;
  if (r1 === '克') sha += SHA_LOSS;
  if (r2 === '克') sha += SHA_LOSS;
  const burn = sha > 0 && r2 === '生';

  const raw = m + (burn ? sha : 0);
  const yyAll = a.y === '阳' && b.y === '阳' && c.y === '阳';
  const yyNone = a.y === '阴' && b.y === '阴' && c.y === '阴';
  const yyMul = yyAll || yyNone ? 0.5 : 1;

  return { r1, r2, m, sha, burn, raw, yyAll, yyNone, yyMul, total: raw * yyMul };
}

/* ---------- 属性 ---------- */
/** 铭文/诅咒/器灵共用这套键：xxPct 走乘算，PRE 里的走绝对值，其余进 q */
export function applyMod(s, q, mods) {
  if (!mods) return;
  for (const k in mods) {
    const v = mods[k];
    if (k === 'atkPct' || k === 'magPct' || k === 'defPct' || k === 'hpPct') q[k] = (q[k] || 0) + v;
    else if (PRE[k]) s[k] = (s[k] || 0) + v;
    else q[k] = (q[k] || 0) + v;
  }
}

/**
 * 结算当前配装
 * @returns {{s:{hp,atk,mag,def}, q:object, e:object}}
 */
export function calcStats() {
  const e = evaluate(G.slots);
  const s = { hp: 66, atk: 13, mag: 8, def: 0 };
  const q = {
    inc: 0, red: 0, leech: 0, reflect: 0, pen: 0,
    crit: 5, critDmg: 50, dbl: 0, sk: 0, skMer: 0, healB: 0,
    hpPct: 0, atkPct: 0, magPct: 0, defPct: 0,
    sp: { aoe: 0, single: 0, low: 0, first: 0, regen: 0, drain: 0, weak: 0 },
  };

  // 经脉先落地
  const mb = merBonus();
  s.hp += mb.hp || 0;
  s.atk += mb.atk || 0;
  s.mag += mb.mag || 0;
  s.def += mb.def || 0;
  q.hpPct += mb.hpPct || 0;
  q.red += mb.red || 0;
  q.crit += mb.crit || 0;
  q.critDmg += mb.critDmg || 0;
  q.pen += mb.pen || 0;
  q.reflect += mb.reflect || 0;
  q.dbl += mb.dbl || 0;
  q.healB += mb.healB || 0;
  q.skMer += mb.sk || 0; // 经脉的技阶单独记，别和装备混

  G.slots.forEach((it) => {
    if (!it || it.ident === false) return; // 没鉴定就没效果，逼你去鉴
    const eg = effGrade(it);
    s.hp += eg * 6;
    s.atk += eg * 1.7;
    s.def += eg * 0.8;

    let skl = 0;
    it.affixes.forEach((a) => {
      if (a.kind === 'pre') s[a.k] = (s[a.k] || 0) + a.v;
      else if (a.k === 'sk') {
        skl += a.v;
        q.sk += a.v; // 技阶只涨技能等级，不进战斗数值
      } else q[a.k] = (q[a.k] || 0) + a.v;
    });
    it.skLv = skl; // 本器技阶

    if (it.inscr) {
      applyMod(s, q, it.inscr.up);
      applyMod(s, q, it.inscr.dn);
    }
    if (it.spirit) {
      applyMod(s, q, it.spirit.dn);
      const sp = it.spirit;
      if (sp.k === 'aoe') q.sp.aoe += sp.v;
      if (sp.k === 'single') q.sp.single += sp.v;
      if (sp.k === 'low') q.sp.low += sp.v;
      if (sp.k === 'first') q.sp.first += sp.v;
      if (sp.k === 'regen') q.sp.regen += sp.v;
      if (sp.k === 'leech') q.leech += sp.v;
    }
    if (it.curse) {
      const c = it.curse;
      if (c.k === 'drain') q.sp.drain += c.v;
      if (c.k === 'red') q.red += c.v;
      if (c.k === 'weak') q.sp.weak += c.v;
    }
  });

  // 乘算类
  s.atk = Math.round(s.atk * (1 + q.inc / 100) * (1 + q.atkPct / 100));
  s.mag = Math.round(s.mag * (1 + q.inc / 100) * (1 + q.magPct / 100));
  s.def = Math.max(0, Math.round(s.def * (1 + q.defPct / 100)));
  s.hp = Math.max(1, Math.round(s.hp * (1 + q.hpPct / 100)));
  q.red = Math.min(60, Math.max(-40, q.red)); // 减伤上限 60%，也能被诅咒压成负数

  return { s, q, e };
}

/** 三才对应的流派名（给界面用） */
export function schoolName(e) {
  if (e.partial) return '未成阵';
  if (e.yyAll) return '纯阳';
  if (e.yyNone) return '纯阴';
  if (e.total >= 4) return '三轮生';
  if (e.total >= 2) return '双生';
  if (e.burn) return '煞转';
  if (e.sha > 0) return '克伐';
  if (e.total < 1) return '逆生';
  return '比和';
}

export const elemColor = (x) => COL[x] || '#8d8474';
