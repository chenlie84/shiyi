/** 常用数学工具 */

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const lerp = (a, b, t) => a + (b - a) * t;

/** 把 #rrggbb 转成 rgba(...)，特效和光柱大量用到 */
export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + clamp(a, 0, 1) + ')';
}

/** 缓动：先快后慢 */
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
/** 缓动：先慢后快（下落、砸击用它才有重量） */
export const easeIn = (t) => t * t;

export const TAU = Math.PI * 2;
export const PI = Math.PI;
