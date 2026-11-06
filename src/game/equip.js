/**
 * 行囊与三才配装
 */

import { G } from './state.js';
import { log, refresh } from '../render/presenter.js';
import { evaluate } from './stats.js';
import { sellPrice, nmOf } from './item.js';

/** 三件器里有没有能成阵的组合（≥×2） */
export function hasGoodCombo(pool) {
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++)
      for (let k = j + 1; k < pool.length; k++)
        if (evaluate([pool[i], pool[j], pool[k]]).total >= 2) return true;
  return false;
}

/**
 * 从行囊佩到三才
 * @returns {{ok:boolean, reason?:string, item?:object}}
 */
export function equipFromBag(id) {
  const i = G.bag.findIndex((x) => x.id === id);
  if (i < 0) return { ok: false, reason: 'missing' };
  const it = G.bag[i];

  if (it.ident === false) {
    // 蒙尘之器连五行都不明，配不进三才
    log('蒙尘之器，不知五行，佩不进三才 —— 先鉴。', '#a83b2c');
    return { ok: false, reason: 'unidentified', item: it };
  }

  const empty = G.slots.findIndex((s) => !s);
  if (empty < 0) {
    log('三才位已满，先卸一件。', '#a83b2c');
    return { ok: false, reason: 'full' };
  }

  G.slots[empty] = it;
  G.bag.splice(i, 1);
  refresh();
  return { ok: true, slot: empty, item: it };
}

/** 卸下第 i 位 */
export function unequip(i) {
  const it = G.slots[i];
  if (!it) return { ok: false };
  G.slots[i] = null;
  G.bag.push(it);
  refresh();
  return { ok: true, item: it };
}

/** 卖出（只能卖行囊里的） */
export function sellItem(id) {
  const i = G.bag.findIndex((x) => x.id === id);
  if (i < 0) {
    log('佩在身上的先卸下。', '#a83b2c');
    return { ok: false, reason: 'equipped' };
  }
  const it = G.bag[i];
  const p = sellPrice(it);
  G.stones += p;
  G.bag.splice(i, 1);
  log('卖出 ' + nmOf(it) + '，得 ' + p + ' 灵石。');
  refresh();
  return { ok: true, gained: p, item: it };
}

/**
 * 自动配装：暴力搜最优三才。给 ?auto 和无头测试用。
 */
export function autoEquip() {
  G.slots.forEach((it, i) => {
    if (it) {
      G.bag.push(it);
      G.slots[i] = null;
    }
  });

  const pool = G.bag.slice();
  let best = null;
  let bm = -1;
  for (let i = 0; i < pool.length; i++)
    for (let j = 0; j < pool.length; j++)
      for (let k = 0; k < pool.length; k++) {
        if (i === j || j === k || i === k) continue;
        const arr = [pool[i], pool[j], pool[k]];
        const t = evaluate(arr).total;
        if (t > bm) {
          bm = t;
          best = arr;
        }
      }

  if (!best) {
    for (let i = 0; i < 3 && G.bag.length; i++) G.slots[i] = G.bag.shift();
    refresh();
    return;
  }

  best.forEach((it) => {
    const k = G.bag.indexOf(it);
    if (k >= 0) G.bag.splice(k, 1);
  });
  G.slots = best;
  refresh();
}
