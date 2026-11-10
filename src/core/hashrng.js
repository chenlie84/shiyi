/**
 * 由字符串派生的确定性随机源
 *
 * 角色创建要「同一个生辰 + 同一个喜好 = 同一个人」，
 * 不能吃全局 rand()（那会被战斗、掉落一路消耗掉，同名不同人）。
 * 这里把 key 散成 32 位种子，再走一条自己的 LCG。
 */

/** FNV-1a，够用且短 */
export function hashKey(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}

/**
 * @returns {{rand:()=>number, int:(n:number)=>number, pick:<T>(arr:T[])=>T, range:(a:number,b:number)=>number}}
 */
export function localRng(key) {
  let s = hashKey(key);
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const int = (n) => Math.floor(rand() * n);
  const pick = (arr) => arr[int(arr.length)];
  const range = (a, b) => a + rand() * (b - a);
  return { rand, int, pick, range };
}
