/** 战报：倒序滚动，最多留 40 条 */

import { $ } from './dom.js';
import { G } from '../game/state.js';

export function log(txt, cls) {
  G.log.unshift('<div>' + (cls ? '<span style="color:' + cls + '">' : '') + txt + (cls ? '</span>' : '') + '</div>');
  if (G.log.length > 40) G.log.pop();
  $('log').innerHTML = G.log.join('');
}
