/**
 * 文案格式化：把数据拼成给人看的字符串 / HTML 片段
 *
 * 只做"数据 → 文本"，不碰任何交互。
 */

import { PRE, TIERC, MODN } from '../data/affixes.js';
import { afDef, afUnit } from '../game/item.js';

/** 一条词条：名字 + 数值 + T 级色标 */
export function afLabel(a) {
  const d = afDef(a);
  const u = afUnit(a);
  return (
    '<span style="color:' + d.c + '">' + d.n + ' +' + a.v + u + '</span>' +
    '<span style="color:' + TIERC[a.t - 1] + ';font-weight:700"> T' + a.t + '</span>'
  );
}

/** 修正项一行文字，如「暴击 +12%」 */
export function modTxt(k, v) {
  const nm = MODN[k] || k;
  const u = PRE[k] || k === 'sk' ? '' : '%';
  return nm + ' ' + (v > 0 ? '+' : '') + v + u;
}

/** 一组修正项，用全角空格隔开 */
export function modLine(m, cls) {
  return Object.keys(m || {})
    .map((k) => '<span class="' + cls + '">' + modTxt(k, m[k]) + '</span>')
    .join('　');
}
