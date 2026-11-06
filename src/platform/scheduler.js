/**
 * 定时器
 *
 * 战斗流程里到处是 setTimeout（敌人逐个还手、破阵后进下一波）。
 * 直接调会让无头测试没法同步推进，所以统一从这里走：
 * 浏览器里是真定时器，平衡测试里换成"任务队列 + 手动推进"。
 */

let impl = (fn, ms) => setTimeout(fn, ms);

/** 替换调度实现（测试用） */
export function setScheduler(fn) {
  impl = fn;
}

/** 恢复真定时器 */
export function useRealClock() {
  impl = (fn, ms) => setTimeout(fn, ms);
}

/** 排一个延时任务 */
export function delay(fn, ms) {
  return impl(fn, ms);
}
