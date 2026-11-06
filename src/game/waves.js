/**
 * 造怪：一圈围上来
 *
 * 寻常房间的怪摊在玩家四周（上 / 下 / 左 / 右各分到一份），
 * 妖王一个人站在正对面 —— 它不需要围，它就在那儿等着。
 *
 * 出生点由 field.spawnRing 给，位置建波时就定死（特效拿它当锚点）。
 */

import { G, S } from './state.js';
import { rand, pick } from '../core/rng.js';
import { MOBS, BOSSES } from '../data/mobs.js';
import { isBossRoom, prog } from './dungeon.js';
import { spawnRing, spawnBoss } from './field.js';

/** 第几层出哪只妖王 */
const bossOf = (floor) => BOSSES[(Math.max(1, floor) - 1) % BOSSES.length];

/** 这一间几只（越往里越挤） */
const countOf = (room) => Math.min(5, 3 + Math.floor((room - 1) / 2));

/** 从外面走进来的那一下：渲染层拿 enter 做淡入、dx/dy 做滑行 */
const entering = () => ({ enter: 1, dx: 0, dy: 0 });

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
    const p = spawnBoss()[0];
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
        red: b.red, // 减伤：刀砍上去只有七成多
        regen: b.regen, // 每回合自愈
        x: p.x,
        y: p.y,
        hurt: 0,
        hx: 0,
        dead: false,
        atkAnim: 0,
        ...entering(),
      },
    ];
  }

  const ramp = Math.min(1, 0.4 + n * 0.075);
  // 元婴以上再加一档：硬档就得硬，不然"苦"和"死"只是数字好看
  const hard = G.diff > 2 ? 1 + (G.diff - 2) * 0.2 : 1;
  const d = (1 + (G.diff - 1) * ramp) * hard;
  const cnt = countOf(G.room);
  const pts = spawnRing(cnt);

  const arr = [];
  for (let i = 0; i < cnt; i++) {
    const hp = Math.round((54 + n * 20) * d * (0.85 + rand() * 0.35));
    arr.push({
      name: pick(MOBS),
      hp,
      maxhp: hp,
      atk: Math.round((4.2 + n * 1.6) * d * 10) / 10,
      x: pts[i].x,
      y: pts[i].y,
      hurt: 0,
      hx: 0,
      dead: false,
      atkAnim: 0,
      def: Math.round(n * 0.8 * d),
      ...entering(),
    });
  }
  return arr;
}

export const alive = () => S.mobs.filter((m) => !m.dead);
