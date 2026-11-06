/**
 * 像素碎屑与飘字
 *
 * burst —— 命中、爆闪时迸的方块
 * floatText —— 伤害数字、飘字；第 5 个参数走毛笔体（破阵 / 招式名）
 */

import { S } from '../../game/state.js';

/** 迸一撮像素碎屑 */
export function burst(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    S.parts.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 260,
      vy: -Math.random() * 200 - 40,
      life: 0.5 + Math.random() * 0.3,
      t: 0,
      c: color,
      s: 2 + Math.random() * 3,
    });
  }
}

/** 飘一条字 */
export function floatText(x, y, txt, color, big, shufa) {
  S.floats.push({ x, y, txt, c: color, t: 0, life: 0.95, big: !!big, shufa: !!shufa });
}
