/**
 * 人物创建：生辰 + 性情 → 一个确定的人
 *
 * 设计约束：
 *   · 同一个生辰 + 性情 + 性别 + salt = 同一个人（不吃全局 rand，战斗消耗不影响）
 *   · 只给小幅数值（±10% 内）。流派也一样 —— 开局的选择不该决定后期玩法，
 *     真正决定强弱的是三才成阵与七星配符。
 *   · 命格、身世、字号只写在面板上，不额外叠数值，免得开局就出现"最优解"。
 */

import { localRng } from '../core/hashrng.js';
import * as N from '../data/names.js';
import { VILLAGE } from '../data/world.js';
import { personName } from './naming.js';

export const GENDERS = [
  { k: 'male', n: '男' },
  { k: 'female', n: '女' },
  { k: 'any', n: '不拘' },
];

export const DEFAULT_BIRTH = { y: 1996, m: 4, d: 12 };

/** 年的干支，只作生辰文案 */
export function ganzhiOf(y) {
  const yi = ((y - 4) % 10 + 10) % 10;
  const yz = ((y - 4) % 12 + 12) % 12;
  return N.TIANGAN[yi] + N.DIZHI[yz];
}

/** 校验并夹一下生日，避免表单里填出 13 月 40 日 */
export function normBirth(b) {
  const y = Math.min(2100, Math.max(1900, Math.round(Number(b?.y) || DEFAULT_BIRTH.y)));
  const m = Math.min(12, Math.max(1, Math.round(Number(b?.m) || DEFAULT_BIRTH.m)));
  const d = Math.min(31, Math.max(1, Math.round(Number(b?.d) || DEFAULT_BIRTH.d)));
  return { y, m, d };
}

/**
 * @param {object} o
 * @param {{y:number,m:number,d:number}} o.birth
 * @param {string} o.like     LIKES 里的 k
 * @param {string} o.gender   male / female / any
 * @param {number} o.salt     再掷一次用的扰动
 */
export function createCharacter(o = {}) {
  const birth = normBirth(o.birth);
  const like = N.LIKES.find((x) => x.k === o.like) || N.LIKES[0];
  const gender = GENDERS.some((g) => g.k === o.gender) ? o.gender : 'any';
  const salt = Math.max(0, Math.round(Number(o.salt) || 0));
  const rng = localRng(`hero|${birth.y}-${birth.m}-${birth.d}|${like.k}|${gender}|${salt}`);

  const who = personName(rng, gender);
  const season = N.SEASON_ELEM[birth.m - 1];
  const fate = rng.pick(N.FATE);
  const origin = rng.pick(N.ORIGIN);

  // 四围：只决定面板上的描述与一点小幅加成
  const traits = {
    根骨: 3 + rng.int(8),
    悟性: 3 + rng.int(8),
    气海: 3 + rng.int(8),
    福缘: 3 + rng.int(8),
  };

  // 季节定主行，性情作偏；两者相生则主行不变，相克则主行让给性情
  const elem = season[1] === like.elem ? season[1] : (rng.rand() < 0.62 ? season[1] : like.elem);

  const bonus = Object.assign({}, like.bonus);
  bonus.hpPct = (bonus.hpPct || 0) + Math.round((traits.根骨 - 5) * 0.6);
  bonus.magPct = (bonus.magPct || 0) + Math.round((traits.悟性 - 5) * 0.5);
  bonus.atkPct = (bonus.atkPct || 0) + Math.round((traits.气海 - 5) * 0.5);
  bonus.stonesPct = (bonus.stonesPct || 0) + Math.round((traits.福缘 - 5) * 1.2);

  const gz = ganzhiOf(birth.y);
  const monthN = N.MONTH_NAME[birth.m - 1];

  return {
    name: who.name,
    surname: who.surname,
    given: who.given,
    style: who.style,
    gender,
    birth,
    ganzhi: gz,
    monthN,
    season: season[0],
    seasonElem: season[1],
    elem,
    like: { k: like.k, n: like.n, d: like.d, elem: like.elem },
    fate,
    origin,
    home: VILLAGE.n,
    traits,
    bonus,
    intro: `${gz}年${monthN}生，${season[0]}令，秉${elem}气。${origin}${like.n}，${like.d}。`
      + `村中长老说，命格「${fate}」不算好也不算坏 —— 绝地天通之后，谁都一样，得自己走。`,
  };
}

export { N as NAME_DATA };
