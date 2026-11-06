/**
 * 打造经济：鉴定 / 拆解 / 熔炉三档（铸 · 淬 · 引）
 *
 * 打造的核心不是"点一下变强"，而是"拿有限的东西去换你想要的形状"。
 * 这里只改数据并返回结果，弹层交给 ui 层。
 */

import { G } from './state.js';
import { rand } from '../core/rng.js';
import { log, refresh } from '../render/presenter.js';
import { registerDex } from './dex.js';
import {
  findItem, effGrade, freeKind, rollAffix, reTier, soulOf, nmOf,
  cntPre, cntSuf, afDef, afUnit,
} from './item.js';
import { PRE, SUF } from '../data/affixes.js';
import { GNAME } from '../data/rarity.js';

/* ── 价目表 ── */
export const IDENT_COST = 20; // 鉴定
export const CAST_COST = 25; // 铸：随机生一条
export const GUIDE = { s: 70, o: 10, t: 3 }; // 引：定点生一条，固定 T3

/** 淬：把 T t 提到 T(t-1) 的代价 */
export function quenchCost(t) {
  const m = { 5: [20, 2], 4: [32, 3], 3: [50, 5], 2: [80, 8] };
  const x = m[t];
  return x ? { s: x[0], o: x[1] } : null;
}

/* ── 鉴定 ── */
/**
 * @returns {{ok:boolean, reason?:string, item?:object, isNew?:boolean}}
 */
export function identify(id) {
  const it = findItem(id);
  if (!it || it.ident) return { ok: false, reason: 'nothing' };
  if (G.stones < IDENT_COST) {
    log('灵石不足（鉴定需 ' + IDENT_COST + '）。', '#a83b2c');
    return { ok: false, reason: 'cost' };
  }

  G.stones -= IDENT_COST;
  it.ident = true;

  const extra = [];
  if (it.inscr) extra.push('铭文「' + it.inscr.n + '」');
  if (it.spirit) extra.push('器灵「' + it.spirit.n + '」');
  if (it.curse) extra.push('凶咒「' + it.curse.n + '」');

  log(
    '鉴出 ' + it.name + '：' + GNAME[it.grade] + '，' + it.affixes.length + ' 条词条' +
      (extra.length ? '，' + extra.join('、') : ''),
    it.grade >= 4 ? '#7a4a8a' : '#a8811f'
  );

  const isNew = registerDex(it); // 鉴出来了才算识得
  refresh();
  return { ok: true, item: it, isNew };
}

/* ── 拆解 ── */
/** 拆单件。三才上的器拆不动，得先卸下。 */
export function salvage(id) {
  const i = G.bag.findIndex((x) => x.id === id);
  if (i < 0) {
    log('三才上的器，先卸下才拆得动。', '#a83b2c');
    return { ok: false, reason: 'equipped' };
  }
  const it = G.bag[i];
  const n = soulOf(it);
  G.soul += n;
  G.bag.splice(i, 1);
  log('拆解 ' + nmOf(it) + '，得器魂 ' + n + '。', '#7a4a8a');
  refresh();
  return { ok: true, gained: n, item: it };
}

/** 一键拆凡品 */
export function salvageJunk() {
  const junk = G.bag.filter((i) => i.ident !== false && i.grade === 1);
  if (!junk.length) {
    log('行囊里没有凡品可拆。', '#a83b2c');
    return { ok: false, reason: 'empty' };
  }
  let s = 0;
  junk.forEach((i) => {
    s += soulOf(i);
    G.bag.splice(G.bag.indexOf(i), 1);
  });
  G.soul += s;
  log('拆去凡品 ' + junk.length + ' 件，得器魂 ' + s + '。', '#7a4a8a');
  refresh();
  return { ok: true, count: junk.length, gained: s };
}

/* ── 熔炉 ── */
/**
 * @param {number} id 器 id
 * @param {'c'|'q'|'g'} mode 铸 / 淬 / 引
 * @param {number|string} arg 淬的那条词条下标，或引的词条键
 */
export function forge(id, mode, arg) {
  const it = findItem(id);
  if (!it || it.ident === false) return { ok: false, reason: 'locked' };

  if (mode === 'c') {
    // 铸：随机生一条，赌 T
    if (it.affixes.length >= 6 || !freeKind(it)) {
      log('前缀后缀都满了，铸不进去。', '#a83b2c');
      return { ok: false, reason: 'full' };
    }
    if (G.stones < CAST_COST) {
      log('灵石不足（铸需 ' + CAST_COST + '）。', '#a83b2c');
      return { ok: false, reason: 'cost' };
    }
    G.stones -= CAST_COST;
    const kind = freeKind(it);
    const a = rollAffix(effGrade(it), kind, it.x);
    it.affixes.push(a);
    log(
      '铸 ' + it.name + '：成词「' + afDef(a).n + ' +' + a.v + afUnit(a) + '」T' + a.t +
        (a.t <= 2 ? '，是条好词条。' : '。'),
      '#a8811f'
    );
    // 顺手可能把残器的裂口补上
    if (it.broken && rand() < 0.5) {
      it.broken = false;
      it.name = it.name.replace('·残', '');
      log('炉火恰好，' + it.base + ' 的裂口合上了。', '#a8811f');
    }
  } else if (mode === 'q') {
    // 淬：玩家自选哪条提一档，必成
    const a = it.affixes[arg];
    if (!a || a.t <= 1) return { ok: false, reason: 'maxed' };
    const c = quenchCost(a.t);
    if (!c) return { ok: false, reason: 'maxed' };
    if (G.stones < c.s || G.soul < c.o) {
      log('淬火不足（需 ' + c.s + ' 灵石 + ' + c.o + ' 器魂）。', '#a83b2c');
      return { ok: false, reason: 'cost' };
    }
    G.stones -= c.s;
    G.soul -= c.o;
    const from = a.t;
    reTier(a, a.t - 1);
    log('淬 ' + it.name + '：' + afDef(a).n + ' T' + from + ' → T' + a.t + '。', '#a8811f');
  } else if (mode === 'g') {
    // 引：定向指定词条，固定 T3
    const def = PRE[arg] || SUF[arg];
    if (!def) return { ok: false, reason: 'bad-key' };
    const kind = PRE[arg] ? 'pre' : 'suf';
    if (kind === 'pre' && cntPre(it) >= 3) {
      log('前缀满了，引不进。', '#a83b2c');
      return { ok: false, reason: 'full' };
    }
    if (kind === 'suf' && cntSuf(it) >= 3) {
      log('后缀满了，引不进。', '#a83b2c');
      return { ok: false, reason: 'full' };
    }
    if (G.stones < GUIDE.s || G.soul < GUIDE.o) {
      log('引器不足（需 ' + GUIDE.s + ' 灵石 + ' + GUIDE.o + ' 器魂）。', '#a83b2c');
      return { ok: false, reason: 'cost' };
    }
    G.stones -= GUIDE.s;
    G.soul -= GUIDE.o;
    const a = { kind, k: arg, t: GUIDE.t, v: def.v[5 - GUIDE.t] };
    it.affixes.push(a);
    log('引 ' + it.name + '：定向引出「' + def.n + ' +' + a.v + (def.u || '') + '」T' + a.t + '。', '#8a5a1f');
  }

  refresh();
  return { ok: true, item: it };
}
