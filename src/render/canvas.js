/**
 * 画布与 2D 上下文
 *
 * 只在这里拿一次 ctx，其他地方一律 import 它。
 */

export let cv = null;
export let ctx = null;

export function initCanvas(id) {
  cv = document.getElementById(id || 'cv');
  ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { cv, ctx };
}

