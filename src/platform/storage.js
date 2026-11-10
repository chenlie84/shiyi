/**
 * 本地存档
 *
 * 只存"世界进度"（人物、流派、试炼、主线），不存一局的装备与地宫层数 ——
 * 顶栏「重来」本来就是重开一局，角色得留着。
 *
 * 隐私模式 / 沙箱里 localStorage 可能直接抛，全部吞掉当没存档。
 */

import { WORLD_KEY } from '../config.js';

export function loadWorld() {
  try {
    const raw = localStorage.getItem(WORLD_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveWorld(data) {
  try {
    localStorage.setItem(WORLD_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearWorld() {
  try {
    localStorage.removeItem(WORLD_KEY);
  } catch { /* 写不进去就算了 */ }
}
