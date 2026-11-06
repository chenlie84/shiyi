/**
 * 一局的开始与重开
 */

import { G, S, resetState } from './state.js';
import { rand } from '../core/rng.js';
import { makeItem } from './item.js';
import { hasGoodCombo } from './equip.js';
import { startWave } from './combat.js';
import { clearLoot } from '../render/presenter.js';

/**
 * 重开一局
 * 开局给 6 件凡/灵品且已鉴 —— 好货得自己去捡；
 * 反复重掷直到至少有一组能成阵，避免一上来就卡死。
 */
export function resetAll() {
  resetState();

  G.stones = 40;
  G.best = 0;

  S.beams = [];
  S.freeze = 0;
  clearLoot();

  let tries = 0;
  do {
    G.bag = [];
    for (let i = 0; i < 6; i++) {
      const it = makeItem(1, undefined, rand() < 0.3 ? 2 : 1);
      it.ident = true;
      G.bag.push(it);
    }
    tries++;
  } while (tries < 25 && !hasGoodCombo(G.bag));

  startWave();
}
