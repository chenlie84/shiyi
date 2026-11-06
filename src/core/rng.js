/**
 * 全局随机源
 *
 * 默认走 Math.random；调 seed() 可切成确定性 LCG ——
 * 平衡回归测试（tools/sim.js）靠它复现同一局。
 */

let _seed = 0;
let _useLCG = false;

export function seed(n) {
  _seed = (n >>> 0) || 1;
  _useLCG = true;
}

export function unseed() {
  _useLCG = false;
}

/** [0,1) */
export function rand() {
  if (!_useLCG) return Math.random();
  // Numerical Recipes LCG
  _seed = (Math.imul(_seed, 1664525) + 1013904223) >>> 0;
  return _seed / 4294967296;
}

/** [0, n) 整数 */
export function randInt(n) {
  return Math.floor(rand() * n);
}

/** 数组随机取一 */
export function pick(arr) {
  return arr[randInt(arr.length)];
}

/** 概率 p（0~1）命中 */
export function chance(p01) {
  return rand() < p01;
}

/** 百分比概率命中（0~100） */
export function chancePct(pct) {
  return rand() * 100 < pct;
}

/** [a, b) 浮点 */
export function randRange(a, b) {
  return a + rand() * (b - a);
}

/** 以 0 为中心的对称抖动 */
export function jitter(amp) {
  return (rand() - 0.5) * 2 * amp;
}
