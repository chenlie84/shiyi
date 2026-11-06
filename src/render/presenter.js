/**
 * 表现层接口（依赖倒置）
 *
 * game 层只认这里的函数名，不知道 canvas 和 DOM 的存在。
 * 好处有三：
 *   1. 平衡回归测试可以不挂任何实现，直接在 node 里跑纯逻辑
 *   2. 以后换渲染（Cocos / WebGL）只需要换一套 impl
 *   3. game 层不会被 document.xxx 污染
 *
 * 默认全是空实现，main.js 里 bindPresenter() 注入真实实现。
 */

const noop = () => {};

let impl = {
  log: noop,          // (text, color)
  refresh: noop,      // ()  重绘所有 DOM 面板
  floatText: noop,    // (x, y, text, color, big, shufa)
  burst: noop,        // (x, y, count, color)
  hitStop: noop,      // (seconds) 打击停顿
  sfx: noop,          // (type)
  spawnCastFX: noop,  // (skill, spec)
  spawnBolts: noop,   // (spec, targets) 投射物
  castCallout: noop,  // (text, elem)
  spawnBeams: noop,   // (items[])
  openModal: noop,    // (html)
  closeModal: noop,   // ()
  showLoot: noop,     // (items[])
  clearLoot: noop,    // ()
  showRelic: noop,    // (relics[])
  toast: noop,        // (text)
};

/** main.js 装配时调用 */
export function bindPresenter(p) {
  impl = Object.assign(impl, p);
}

/** 测试 / 无头环境用：摘掉所有表现 */
export function resetPresenter() {
  for (const k of Object.keys(impl)) impl[k] = noop;
}

export const log = (...a) => impl.log(...a);
export const refresh = (...a) => impl.refresh(...a);
export const floatText = (...a) => impl.floatText(...a);
export const burst = (...a) => impl.burst(...a);
export const hitStop = (...a) => impl.hitStop(...a);
export const sfx = (...a) => impl.sfx(...a);
export const spawnCastFX = (...a) => impl.spawnCastFX(...a);
export const spawnBolts = (...a) => impl.spawnBolts(...a);
export const castCallout = (...a) => impl.castCallout(...a);
export const spawnBeams = (...a) => impl.spawnBeams(...a);
export const openModal = (...a) => impl.openModal(...a);
export const closeModal = (...a) => impl.closeModal(...a);
export const showLoot = (...a) => impl.showLoot(...a);
export const clearLoot = (...a) => impl.clearLoot(...a);
export const showRelic = (...a) => impl.showRelic(...a);
export const toast = (...a) => impl.toast(...a);
