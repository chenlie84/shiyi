/**
 * 回合制战斗：出招 → 敌人还手 → 回合结算
 *
 * 出招不再是一击了事：一式法术按 spec 发出 proj 枚投射物，
 * 依次落地、逐发结算，穿够的还能一路穿过去。
 *
 * 这个文件只算数值和流程，屏幕上发生什么全部走 presenter。
 */

import { G, S } from './state.js';
import { calcStats, xpNeed } from './stats.js';
import { makeItem, nmOf } from './item.js';
import { buildSkills, skillPower, resolve } from './skills.js';
import { makeWave, layoutMobs, alive } from './waves.js';
import { registerDex } from './dex.js';
import { rand, chancePct } from '../core/rng.js';
import { GROUND, PLAYER_X } from '../config.js';
import { delay } from '../platform/scheduler.js';
import {
  log, refresh, floatText, burst, hitStop, sfx,
  spawnCastFX, spawnBolts, castCallout, spawnBeams, showLoot,
} from '../render/presenter.js';

const SHOT_GAP = 95; // 每发之间的间隔（毫秒）
const SHOT_LAG = 150; // 第一发飞行的余量

/** 开一波 */
export function startWave() {
  S.mobs = makeWave(G.wave);
  layoutMobs();
  G.turn = 1;
  G.busy = false;
  G.over = false;

  const st = calcStats();
  S.php = st.s.hp;
  S.shield = 0;
  S.buffNext = 0;
  S.reflect = 0;

  log('第 ' + G.wave + ' 波 · 来了 ' + S.mobs.length + ' 只。', '#a83b2c');
  refresh();
}

/** 出手目标：站得最前、还活着的那个 */
function front() {
  const list = alive();
  return list.length ? list[0] : null;
}

/** 命中的那只之外，站得最近的两只（给"溅"用） */
function neighbors(m) {
  return alive().filter((x) => x !== m).sort((a, b) => Math.abs(a.x - m.x) - Math.abs(b.x - m.x));
}

/**
 * 一发落地：算伤害、算命中效果、写飘字
 * @returns {number} 实伤
 */
function land(m, base, spec, q, extra = 1, label = '') {
  if (!m || m.dead) return 0;

  let dmg = base * (0.85 + rand() * 0.3) * extra;
  dmg *= 1 + ((q.pen + spec.pen) / 100) * 0.6; // 破防：按比例削气防，等效增伤

  // 金·裂：该发自带破甲
  if (spec.trait === 'rend') dmg *= 1.25;

  const crit = chancePct((q.crit || 0) + spec.crit);
  if (crit) dmg *= 1 + ((q.critDmg || 0) + spec.critDmg) / 100;

  const v = Math.max(1, Math.round(dmg));
  m.hp -= v;
  m.hurt = 0.16;
  m.hx = 12;
  burst(m.x, m.y - 10, crit ? 16 : 10, crit ? '#ffd166' : '#e8b04a');
  floatText(
    m.x + (rand() - 0.5) * 24,
    m.y - 24 - (extra < 1 ? 14 : 0),
    (label || '') + (crit ? '暴 ' : '') + v,
    crit ? '#ffd166' : '#f0e6c0',
    crit
  );
  if (crit) {
    sfx('crit');
    S.shake = Math.max(S.shake, 0.7);
  }
  hitStop(v > 0 ? (crit ? 0.085 : 0.045) : 0);

  // 噬血（词条 + 符）
  const lc = (q.leech || 0) + spec.leech;
  if (lc > 0) {
    const h = Math.round((v * lc) / 100);
    if (h > 0) {
      S.php = Math.min(calcStats().s.hp, S.php + h);
      floatText(PLAYER_X + (rand() - 0.5) * 18, GROUND - 104, '+' + h, '#6cbb8c');
    }
  }

  /* 副行的"性" */
  if (spec.trait === 'burn') {
    const b = Math.max(1, Math.round(v * 0.35));
    m.hp -= b;
    floatText(m.x + 16, m.y - 40, '燃 ' + b, '#ff8a5c');
  } else if (spec.trait === 'splash') {
    const nb = neighbors(m);
    if (nb.length) {
      const s = Math.max(1, Math.round(v * 0.4));
      nb[0].hp -= s;
      nb[0].hurt = 0.16;
      floatText(nb[0].x, nb[0].y - 26, '溅 ' + s, '#8fc4ea');
      if (nb[0].hp <= 0) { nb[0].dead = true; nb[0].hp = 0; }
    }
  } else if (spec.trait === 'bind') {
    m.atkDown = Math.max(m.atkDown || 0, 0.85);
  } else if (spec.trait === 'stagger') {
    m.atkDown = Math.max(m.atkDown || 0, 0.5);
  }

  /* 符的命中效果 */
  if (spec.onHit === 'splash') {
    const nb = neighbors(m);
    if (nb.length) {
      const s = Math.max(1, Math.round(v * 0.4));
      nb[0].hp -= s;
      nb[0].hurt = 0.16;
      floatText(nb[0].x, nb[0].y - 26, '震 ' + s, '#9b7ab0');
      if (nb[0].hp <= 0) { nb[0].dead = true; nb[0].hp = 0; }
    }
  } else if (spec.onHit === 'split') {
    const nb = neighbors(m);
    const tgt = nb[0] || m;
    for (let i = 0; i < 2; i++) {
      if (tgt.dead) break;
      land(tgt, base * 0.4, { ...spec, onHit: null, trait: null }, q, 0.9, '魂 ');
    }
  }

  if (m.hp <= 0) {
    m.dead = true;
    m.hp = 0;
  }
  return v;
}

/** 出一招 */
export function castSkill(idx) {
  if (G.busy || G.over) return;
  const list = buildSkills();
  const sk = list[idx];
  if (!sk) return;
  if (sk.kind === 'rune') {
    log('「' + sk.name + '」是符，不能单独施放 —— 挂到一式法术上。', '#a83b2c');
    return;
  }

  const st = calcStats();
  const e = st.e;
  const spec = resolve(sk, list);
  const targets = alive();
  if (!targets.length || !spec) return;

  G.busy = true;
  S.pAnim = 0.3;

  const power = skillPower(sk, spec, st.s, e); // 整式总威力
  const per = power * spec.perShot; // 单发威力

  spawnCastFX(sk, spec); // 起手式
  spawnBolts(spec, targets); // 投射物
  castCallout(sk.name, sk.elem);

  /* 施法时结算的符效 */
  if (spec.onCastHeal) {
    const h = Math.round(power * spec.onCastHeal);
    S.php = Math.min(st.s.hp, S.php + h);
    floatText(PLAYER_X, GROUND - 120, '+' + h, '#6cbb8c');
    log('　符·回春：气血 +' + h, '#2f6b52');
  }
  if (spec.onCastShield) {
    const v = Math.round(power * spec.onCastShield);
    S.shield += v;
    floatText(PLAYER_X, GROUND - 120, '盾 ' + v, '#6fa8c9');
    log('　符·护身：护盾 +' + v, '#38617f');
  }
  if (spec.onCastBuff) {
    S.buffNext = 2;
    floatText(PLAYER_X, GROUND - 120, '蓄势', '#c9a227');
    log('　符·蓄势：下一击翻倍', '#a8811f');
  }

  /* 逐发落地 */
  const doubled = S.buffNext > 0;
  if (doubled) S.buffNext = 0;
  const shotMul = doubled ? 2 : 1;

  let pending = spec.proj;
  for (let i = 0; i < spec.proj; i++) {
    delay(
      () => {
        pending--;
        let m = front();
        if (m) {
          let shot = per * shotMul;
          let pierced = 0;
          // 穿透：一路打过去，每穿一次衰减两成半
          for (;;) {
            land(m, shot, spec, st.q, 1);
            const nxt = front();
            if (!nxt || pierced >= spec.pierce) break;
            m = nxt;
            shot *= 0.75;
            pierced++;
          }
        }
        refresh();
        // 怪物提前死光时后续几发打空，也必须把这一式收尾
        if (pending === 0) finishCast(spec, power);
      },
      SHOT_LAG + i * SHOT_GAP
    );
  }

  sfx('hit');
  S.shake = Math.max(S.shake, 0.55);
  log(
    sk.name + ' Lv' + sk.lv + '：' + spec.proj + ' 发' +
      (spec.pierce ? '，穿透 ' + spec.pierce : '') +
      (doubled ? '（蓄势×2）' : '') +
      '，单发约 ' + Math.round(per * shotMul) +
      (spec.tags.length ? '　符：' + spec.tags.join('·') : ''),
    '#8a5a1f'
  );
  refresh();
}

/** 这一式走完：要么破阵，要么轮到敌人 */
function finishCast(spec, power) {
  const st = calcStats();
  if (spec.selfHurt) {
    const d = Math.max(1, Math.round(power * spec.selfHurt));
    S.php -= d;
    floatText(PLAYER_X, GROUND - 88, '-' + d, '#a83b2c');
    if (S.php <= 0) { S.php = 0; onDeath(); return; }
  }
  if (alive().length === 0) {
    winWave();
    return;
  }
  delay(() => enemyTurn(), 240);
}

/** 敌人一起还手 */
export function enemyTurn() {
  const st = calcStats();
  const q = st.q;

  alive().forEach((m, i) => {
    delay(() => {
      if (m.dead || G.over) return;
      m.atkAnim = 0.3;

      let raw = Math.max(1, m.atk - st.s.def * 0.5);
      raw = Math.round(raw * (1 - q.red / 100)); // 减伤
      if (m.atkDown) {
        raw = Math.max(1, Math.round(raw * m.atkDown)); // 缠 / 坠
        m.atkDown = 0;
      }

      let d = raw;
      if (S.shield > 0) {
        const absorb = Math.min(S.shield, d);
        S.shield -= absorb;
        d -= absorb;
        if (d > 0) S.php -= d;
        floatText(PLAYER_X, GROUND - 70, absorb ? '盾挡 ' + absorb : '', '#6fa8c9');
      } else {
        S.php -= d;
      }

      if (d > 0) {
        S.hitFlash = 0.45;
        S.shake = 0.4;
        S.pHurt = 0.16;
        hitStop(0.035);
        floatText(PLAYER_X + (rand() - 0.5) * 20, GROUND - 80, '-' + d, '#e07a6a');
        sfx('hurt');
      }

      // 反伤：按挨到的伤害回敬
      if (q.reflect > 0 && raw > 0) {
        const rf = Math.max(1, Math.round((raw * q.reflect) / 100));
        m.hp -= rf;
        m.hurt = 0.16;
        burst(m.x, m.y - 10, 6, '#9b7ab0');
        floatText(m.x, m.y - 30, '反 ' + rf, '#9b7ab0');
        if (m.hp <= 0) {
          m.dead = true;
          m.hp = 0;
        }
      }

      refresh();
      if (S.php <= 0) {
        S.php = 0;
        onDeath();
      }
    }, i * 120);
  });

  delay(() => {
    if (G.over) return;
    if (alive().length === 0) {
      winWave();
      return;
    }

    // 器灵·不息 / 诅咒·贪：回合末结算
    const now = calcStats();
    const sp = now.q.sp;
    if (sp.regen > 0) {
      const h = Math.round((now.s.hp * sp.regen) / 100);
      S.php = Math.min(now.s.hp, S.php + h);
      floatText(PLAYER_X, GROUND - 110, '息 +' + h, '#6cbb8c');
    }
    if (sp.drain > 0) {
      const dmg = Math.max(1, Math.round((now.s.hp * sp.drain) / 100));
      S.php -= dmg;
      floatText(PLAYER_X, GROUND - 88, '蚀 -' + dmg, '#a83b2c');
      if (S.php <= 0) {
        S.php = 0;
        onDeath();
        return;
      }
    }

    if (S.buffNext > 0) S.buffNext--;
    G.turn++;
    G.busy = false;
    refresh();
  }, alive().length * 120 + 420);
}

/** 破阵：结算掉落、修为，进下一波 */
export function winWave() {
  G.over = true;
  sfx('win');
  S.shake = 0.8;
  burst(400, GROUND - 60, 40, '#c9a227');
  floatText(320, 150, '破阵', '#ffd166', true, true);

  const st = calcStats();
  S.php = Math.min(st.s.hp, S.php + Math.round(st.s.hp * 0.3));
  G.best = Math.max(G.best, G.wave);

  const gain = Math.round((8 + G.wave * 4) * G.diff); // 难度越高，灵石给得越多
  G.stones += gain;

  // 落宝：稳压两件，另有几率多掉一件
  const drops = [makeItem(G.wave), makeItem(G.wave)];
  if (rand() < 0.22) drops.push(makeItem(G.wave));

  // 未鉴的先不进拾遗录 —— 鉴出来才算「识得此器」
  drops.forEach((it) => {
    G.bag.push(it);
    if (it.ident !== false) registerDex(it);
  });

  spawnBeams(drops); // 宝从地里冒出来
  showLoot(drops);
  log('破阵！得 ' + drops.map((d) => nmOf(d)).join('、') + '，灵石 +' + gain, '#2f6b52');

  const relic = G.wave % 5 === 0;
  G.wave++;

  // 修为：破阵涨修为，满一级升境界、给 1 点经脉点
  const xg = 12 + G.wave * 4;
  G.xp += xg;
  let ups = 0;
  while (G.xp >= xpNeed(G.lv)) {
    G.xp -= xpNeed(G.lv);
    G.lv++;
    G.pts++;
    ups++;
  }
  if (ups) log('修为 +' + xg + '　境界升至 Lv' + G.lv + '，得经脉点 ' + ups + '。', '#8a5a1f');
  else log('修为 +' + xg + '（' + G.xp + '/' + xpNeed(G.lv) + '）', '#6b6154');

  refresh();

  if (relic) {
    // 每五波：三选一，让你自己挑这一口
    delay(() => showRelicPick(), 620);
    return;
  }

  delay(() => {
    if (G.over === false) return;
    startWave();
  }, 1400);
}

/** 阵亡 */
export function onDeath() {
  if (G.over) return;
  G.over = true;
  sfx('hurt');
  showDeath({
    wave: G.wave,
    turn: G.turn,
    best: G.best,
  });
  refresh();
}

/** 重整旗鼓：波次归零重开，装备与灵石都留着 */
export function restart() {
  closeDeath();
  G.wave = 1;
  startWave();
}

/* ── 与 UI 的桥：这两处必须由 ui 层注入，避免 game → ui 反向依赖 ── */
let showRelicPick = () => {};
let showDeath = () => {};
let closeDeath = () => {};

export function bindCombatUI(hooks) {
  if (hooks.showRelicPick) showRelicPick = hooks.showRelicPick;
  if (hooks.showDeath) showDeath = hooks.showDeath;
  if (hooks.closeDeath) closeDeath = hooks.closeDeath;
}

export { alive };
