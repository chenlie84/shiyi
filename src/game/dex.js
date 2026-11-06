/**
 * 拾遗录：收集本身就是目标
 *
 * 每识得一件新器名记一笔；每集齐 5 器给 1 点经脉点。
 */

import { G } from './state.js';
import { log } from '../render/presenter.js';

/** @returns {boolean} 是否首次识得 */
export function registerDex(it) {
  const first = !G.dex[it.base];
  if (first) G.dex[it.base] = { floor: G.floor, rar: it.grade };
  else G.dex[it.base].rar = Math.max(G.dex[it.base].rar, it.grade);

  if (first) {
    const n = Object.keys(G.dex).length;
    log('拾遗录新识：' + it.base + '（' + n + '/30）', '#3f7a6a');
    if (n % 5 === 0) {
      G.pts++;
      log('拾遗录集齐 ' + n + ' 器，得经脉点 1。', '#8a5a1f');
    }
  }
  return first;
}

export const dexCount = () => Object.keys(G.dex).length;
