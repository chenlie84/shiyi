/**
 * 古代名物创建器
 *
 * 人名 / 字号 / 地名 / 聚落名 / 妖魔号 / 任务地点，都从这里出。
 * 传入 localRng() 得到的随机源 —— 同一个 key 永远生成同一批名字，
 * 换 key（比如创建面板上的「再掷一次」）就换一批。
 */

import { localRng } from '../core/hashrng.js';
import * as N from '../data/names.js';

/** 用若干段信息拼一个确定性随机源 */
export const nameSeed = (...parts) => localRng(parts.join('|'));

/**
 * 人名 + 字号
 * @param {object} rng localRng()
 * @param {'male'|'female'|'any'} gender
 */
export function personName(rng, gender = 'any') {
  const sur = rng.pick(N.SURNAME);
  const dbl = N.SURNAME_DOUBLE.includes(sur);
  const pool = gender === 'male' ? N.GIVEN_MALE
    : gender === 'female' ? N.GIVEN_FEMALE
      : N.GIVEN_NEUTRAL;
  let given = rng.pick(pool);
  // 复姓配单字名更顺；单姓配双字名更顺，做个轻量偏好
  if (dbl && given.length > 1 && rng.rand() < 0.6) given = rng.pick(N.GIVEN_MALE.concat(N.GIVEN_FEMALE, N.GIVEN_NEUTRAL)).slice(0, 1);
  if (!dbl && given.length === 1 && rng.rand() < 0.45) given = rng.pick(N.GIVEN_NEUTRAL);

  const style = rng.pick(N.STYLE_HEAD) + rng.pick(N.STYLE_TAIL);
  return { surname: sur, given, name: sur + given, style };
}

/** 山野地名：意象 + 地形 */
export function placeName(rng) {
  return rng.pick(N.PLACE_HEAD) + rng.pick(N.PLACE_TAIL);
}

/** 聚落名：意象 + 村/坞/堡… */
export function settleName(rng) {
  return rng.pick(N.SETTLE_HEAD) + rng.pick(N.SETTLE_TAIL);
}

/** 妖魔全名：冠一个堕落后得的号 */
export function demonName(rng, base) {
  const b = base || rng.pick(N.DEMON_BASE);
  return { base: b, epithet: rng.pick(N.DEMON_EPITHET), name: rng.pick(N.DEMON_EPITHET) + '·' + b };
}

/** 随机任务里的地名：加个残破的前缀，不占用正式地名 */
export function questPlace(rng) {
  const hint = rng.pick(N.QUEST_PLACE_HINT);
  // 有时是荒村废驿，有时是断崖野渡 —— 两种地名换着来
  if (rng.rand() < 0.35) return hint + settleName(rng);
  return hint + rng.pick(N.PLACE_HEAD).slice(1) + rng.pick(N.PLACE_TAIL);
}

export { localRng };
