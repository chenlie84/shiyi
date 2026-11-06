/**
 * 无头测试台
 *
 * 浏览器里靠 rAF + setTimeout 推进战斗，node 里没有这些。
 * 这里做两件事就够了：
 *   1. 把 platform/scheduler.js 的定时器换成同步优先队列（flush 一口气跑完）
 *   2. 把 combat 需要 UI 注入的几个钩子接上（拾遗三选一、阵亡面板）
 *
 * 不桩 DOM —— 因为 src/game/** 本来就不碰 DOM。这是分层带来的红利，
 * 一旦有人往 game 层写 document.xxx，这里会立刻炸，等于免费的架构守卫。
 */

import { setScheduler } from '../src/platform/scheduler.js';
import { bindCombatUI, startWave } from '../src/game/combat.js';
import { rollRelicChoices, applyRelic } from '../src/game/relics.js';
import { randInt } from '../src/core/rng.js';

const queue = [];
let clock = 0;
let seq = 0;

setScheduler((fn, ms) => {
  const id = ++seq;
  queue.push({ t: clock + (ms || 0), id, fn });
  return id;
});

/**
 * 跑完队列里所有待执行的回调。
 * 队列空掉 = 轮到玩家操作了，这正是驱动循环等待的信号。
 */
export function flush(limit = 300000) {
  let n = 0;
  while (queue.length) {
    if (n++ > limit) throw new Error('调度队列失控：超过 ' + limit + ' 个回调');

    let bi = 0;
    for (let i = 1; i < queue.length; i++) {
      const a = queue[i];
      const b = queue[bi];
      if (a.t < b.t || (a.t === b.t && a.id < b.id)) bi = i;
    }
    const job = queue.splice(bi, 1)[0];
    clock = job.t;
    job.fn();
  }
}

/** 当前虚拟时钟（毫秒） */
export const now = () => clock;

/** 清空队列（换一局之前调用） */
export function clearClock() {
  queue.length = 0;
  clock = 0;
}

/**
 * 装好无头环境：优先队列 + UI 钩子。
 * 拾遗三选一按浏览器 ?auto 的行为随机拿一张。
 */
export function installHeadless() {
  clearClock();
  bindCombatUI({
    showRelicPick: () => {
      const cs = rollRelicChoices();
      applyRelic(cs[randInt(cs.length)] || cs[0]);
      startWave();
    },
    showDeath: () => {},
    closeDeath: () => {},
  });
  return { flush, now, clearClock };
}
