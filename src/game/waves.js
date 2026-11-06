/**
 * 波次：敌人编排与站位
 */

import { G, S } from './state.js';
import { rand, pick } from '../core/rng.js';
import { MOBS } from '../data/mobs.js';
import { GROUND, MOB_X0, MOB_GAP } from '../config.js';

/**
 * 站位必须在建波时就定下来：
 * 施法特效以 m.x 为锚点，若等首次绘制才赋值，首帧前放出的招式会打到 x=0 去。
 */
export function layoutMobs() {
  S.mobs.forEach((m, i) => {
    m.x = MOB_X0 + i * MOB_GAP;
    m.y = GROUND - 40;
  });
}

/**
 * 造一波怪
 * 难度是渐入的 —— 一上来就按满难度算，高难度前几波会直接无解。
 */
export function makeWave(n) {
  const ramp = Math.min(1, 0.4 + n * 0.075);
  // 元婴以上再加一档：硬档就得硬，不然"苦"和"死"只是数字好看
  const hard = G.diff > 2 ? 1 + (G.diff - 2) * 0.2 : 1;
  const d = (1 + (G.diff - 1) * ramp) * hard;
  const cnt = Math.min(4, 2 + Math.floor(n / 4));

  const arr = [];
  for (let i = 0; i < cnt; i++) {
    const hp = Math.round((50 + n * 18) * d * (0.85 + rand() * 0.35));
    arr.push({
      name: pick(MOBS),
      hp,
      maxhp: hp,
      atk: Math.round((3.5 + n * 1.35) * d * 10) / 10,
      x: 0,
      y: 0,
      hurt: 0,
      hx: 0,
      dead: false,
      atkAnim: 0,
      def: Math.round(n * 0.8 * d),
    });
  }
  return arr;
}

export const alive = () => S.mobs.filter((m) => !m.dead);
