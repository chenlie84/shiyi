/**
 * 造怪：一间房一间房地造
 *
 * 寻常房间是一群杂兵，妖王殿只有一只 —— 但它减伤、自愈，
 * 是一道"输出不够就过不去"的门槛。
 *
 * 数值曲线一律吃 prog()（等效进度），所以房间怎么排都不影响难度手感。
 */

import { G, S } from './state.js';
import { rand, pick } from '../core/rng.js';
import { MOBS, BOSSES } from '../data/mobs.js';
import { isBossRoom, prog } from './dungeon.js';
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

/** 第几层出哪只妖王 */
const bossOf = (floor) => BOSSES[(Math.max(1, floor) - 1) % BOSSES.length];

/**
 * 造这一间的怪
 * 难度是渐入的 —— 一上来就按满难度算，高难度前几间会直接无解。
 */
export function makeWave() {
  const n = prog();

  if (isBossRoom()) {
    const b = bossOf(G.floor);
    const d = 1 + (G.diff - 1) * 0.85; // 妖王不渐入，难度直给
    const hp = Math.round((320 + n * 54) * d * b.hp);
    return [
      {
        name: b.n,
        lore: b.lore,
        boss: true,
        scale: 1.62,
        hp,
        maxhp: hp,
        atk: Math.round((8.0 + n * 2.0) * d * b.atk * 10) / 10,
        def: Math.round((4 + n * 1.1) * d),
        red: b.red,        // 减伤：刀砍上去只有七成多
        regen: b.regen,    // 每回合自愈
        x: 0,
        y: 0,
        hurt: 0,
        hx: 0,
        dead: false,
        atkAnim: 0,
      },
    ];
  }

  const ramp = Math.min(1, 0.4 + n * 0.075);
  // 元婴以上再加一档：硬档就得硬，不然"苦"和"死"只是数字好看
  const hard = G.diff > 2 ? 1 + (G.diff - 2) * 0.2 : 1;
  const d = (1 + (G.diff - 1) * ramp) * hard;
  // 越往里越挤：第 1 间 2 只，第 4 间起 3 只，第 6 间 4 只
  const cnt = Math.min(4, 2 + Math.floor((G.room - 1) / 2));

  const arr = [];
  for (let i = 0; i < cnt; i++) {
    const hp = Math.round((54 + n * 20) * d * (0.85 + rand() * 0.35));
    arr.push({
      name: pick(MOBS),
      hp,
      maxhp: hp,
      atk: Math.round((4.2 + n * 1.6) * d * 10) / 10,
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
