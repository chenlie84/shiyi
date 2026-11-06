/**
 * 无头驾驶 —— 替玩家做决策
 *
 * 两种策略：
 *   bare  只自动配装，不鉴定、不熔炼 —— 量"掉落本身能走多远"
 *   full  鉴定、清仓、铸满、淬顶 —— 量"把资源全吃进去能走多远"
 *
 * 两者的差就是这套打造系统的功率。差太小说明打造没用，
 * 差太大说明裸装根本没救，都得回头改数值。
 */

import { G, S } from '../src/game/state.js';
import { calcStats } from '../src/game/stats.js';
import { buildSkills, skillPower } from '../src/game/skills.js';
import { resetAll } from '../src/game/session.js';
import { castSkill } from '../src/game/combat.js';
import { autoEquip } from '../src/game/equip.js';
import { identify, salvage, forge, quenchCost, IDENT_COST, CAST_COST } from '../src/game/economy.js';
import { effGrade, freeKind } from '../src/game/item.js';
import { RAR_NAME } from '../src/data/rarity.js';
import { flush, clearClock } from './harness.js';

/** 一件器的粗打分：品阶权重最大，词条档次其次，凶咒扣分 */
export function score(it) {
  if (it.ident === false) return -1;
  let s = effGrade(it) * 10;
  it.affixes.forEach((a) => {
    s += (6 - a.t) * 3;
  });
  if (it.inscr) s += 6;
  if (it.spirit) s += 12;
  if (it.curse) s -= 7;
  return s;
}

/** 该出哪一招：血低先奶，否则打最疼的一招 */
export function pickSkill(forceAtk) {
  const st = calcStats();
  const e = st.e;
  const sk = buildSkills();
  const hp = st.s.hp;

  if (!forceAtk && S.php / hp < 0.38) {
    let hi = -1;
    let hv = 0;
    for (let i = 0; i < sk.length; i++) {
      const s = sk[i];
      if (!s) continue;
      if (s.kind !== 'heal' && s.kind !== 'shield') continue;
      const v = skillPower(s, st.s, e);
      if (v > hv) {
        hv = v;
        hi = i;
      }
    }
    if (hi >= 0) return hi;
  }

  let bi = -1;
  let bv = -1;
  for (let i = 0; i < sk.length; i++) {
    const s = sk[i];
    if (!s) continue;
    if (s.kind !== 'atk' && s.kind !== 'aoe') continue;
    const v = skillPower(s, st.s, e);
    if (v > bv) {
      bv = v;
      bi = i;
    }
  }
  if (bi < 0) for (let i = 0; i < sk.length; i++) if (sk[i]) return i;
  return bi;
}

/** 熔炉：先把三才上的器铸满，再拿攒下的器魂往上淬 */
export function buildGear() {
  let n = 0;
  for (const it of G.slots.filter(Boolean)) {
    while (n++ < 40 && G.stones >= CAST_COST + 25 && it.affixes.length < 6 && freeKind(it)) {
      forge(it.id, 'c');
    }
  }
  n = 0;
  for (const it of G.slots.filter(Boolean)) {
    while (n++ < 60) {
      let cand = null;
      for (const a of it.affixes) {
        const c = quenchCost(a.t);
        if (c && a.t > 1 && G.soul >= c.o && G.stones >= c.s + 25) {
          cand = a;
          break;
        }
      }
      if (!cand) break;
      forge(it.id, 'q', it.affixes.indexOf(cand));
    }
  }
}

/** 每进一波的经营：鉴定 → 配装 → 清仓 → 打造 */
export function manage(policy) {
  if (policy === 'bare') {
    autoEquip();
    return;
  }

  for (let k = 0; k < 20; k++) {
    const un = G.bag.find((i) => i.ident === false);
    if (!un || G.stones < IDENT_COST) break;
    identify(un.id);
  }

  autoEquip();

  const spare = G.bag.filter((i) => i.ident !== false).sort((a, b) => score(b) - score(a));
  spare.slice(7).forEach((i) => salvage(i.id));

  buildGear();
}

function mobHp() {
  let s = 0;
  for (const m of S.mobs) if (!m.dead) s += m.hp;
  return s;
}

/**
 * 跑一局
 * @param {object} o
 * @param {number} o.diff    难度系数
 * @param {'bare'|'full'} o.policy
 * @param {number} o.maxWave 打到第几波就收手
 */
export function play({ diff, policy, maxWave = 60 }) {
  clearClock();
  G.autoPick = true;
  G.diff = diff;
  resetAll();

  let seen = 0;
  let guard = 0;
  let stall = 0;
  let lastHp = 1e18;
  let stuck = false;

  while (guard++ < 40000) {
    if (G.over) break;
    if (G.wave > maxWave) break;

    // 进新的一波：打理装备
    if (G.wave !== seen) {
      seen = G.wave;
      stall = 0;
      lastHp = 1e18;
      manage(policy);
    }

    if (G.busy) {
      flush();
      continue;
    }

    if (G.turn > 120) {
      stuck = true; // 打不动 = 数值卡死
      break;
    }

    const idx = pickSkill(stall > 3);
    if (idx < 0) {
      flush();
      if (G.busy) continue;
      break;
    }

    castSkill(idx);
    flush();

    const mh = mobHp();
    if (mh < lastHp - 0.5) stall = 0;
    else stall++;
    lastHp = mh;
  }

  const st = calcStats();
  return {
    wave: G.over || stuck ? G.wave : maxWave,
    turn: G.turn,
    best: G.best,
    stuck,
    stones: G.stones,
    soul: G.soul,
    lv: G.lv,
    hp: Math.round(st.s.hp),
    atk: Math.round(st.s.atk),
    red: Math.round(st.q.red),
    slots: G.slots.map((i) =>
      i ? RAR_NAME[i.grade] + '/' + i.affixes.length + '/T' + i.affixes.map((a) => a.t).join('') : '-'
    ),
  };
}
