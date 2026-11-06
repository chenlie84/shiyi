/**
 * 地宫推进
 *
 * 一局只有"在哪"这一件事：第几层、第几间。
 * 所有数值曲线都吃 prog() —— 一间一间往上走，等价于以前"一波一波"。
 *
 * 这样分层的好处：房间是"位置"，进度是"数值"，UI 只读位置，平衡只看进度。
 */

import { G } from './state.js';
import { BOSS_ROOM, ROOM_NAME, ROOM_HINT } from '../data/dungeon.js';

/** 当前这一间是不是妖王殿 */
export const isBossRoom = () => G.room >= BOSS_ROOM;

/** 等效进度：第 1 层第 1 间 = 1，第 2 层第 1 间 = 8。数值曲线全用它 */
export const prog = () => (G.floor - 1) * BOSS_ROOM + G.room;

/** 这一间的名字 */
export function roomName(room = G.room) {
  return ROOM_NAME[Math.min(Math.max(1, room), BOSS_ROOM) - 1] || '';
}

/** 这一间的氛围句 */
export function roomHint(room = G.room) {
  return ROOM_HINT[Math.min(Math.max(1, room), BOSS_ROOM) - 1] || '';
}

/** 顶栏用的一句话位置：「第 3 层 · 幽泉丹井」 */
export function where() {
  return '第 ' + G.floor + ' 层 · ' + roomName();
}

/** 还差几间到妖王殿（已到则 0） */
export const toBoss = () => Math.max(0, BOSS_ROOM - G.room);

/**
 * 打完一间，往前走一格
 * @returns {'room'|'floor'} 是进了下一间，还是妖王已伏、下到更深一层
 */
export function advanceRoom() {
  if (isBossRoom()) {
    G.floor++;
    G.room = 1;
    return 'floor';
  }
  G.room++;
  return 'room';
}

/** 回到一层的开头（重开一局用） */
export function enterDungeon() {
  G.floor = 1;
  G.room = 1;
}

export { BOSS_ROOM };
