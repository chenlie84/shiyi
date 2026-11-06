/**
 * 回合制战斗：出手 → 敌人还手 → 回合结算
 *
 * 这个文件只算数值和流程，屏幕上发生什么全部走 presenter。
 */

import { G, S } from './state.js';
import { calcStats, xpNeed } from './stats.js';
import { makeItem, nmOf } from './item.js';
import { buildSkills, auxOf, canLink, skillPower } from './skills.js';
import { makeWave, layoutMobs, alive } from './waves.js';
import { registerDex } from './dex.js';
import { rand, chancePct } from '../core/rng.js';
import { GROUND, PLAYER_X } from '../config.js';
import { FLAGS } from '../platform/flags.js';
import { delay } from '../platform/scheduler.js';
import {
  log, refresh, floatText, burst, hitStop, sfx,
  spawnCastFX, castCallout, spawnBeams, showLoot,
} from '../render/presenter.js';

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

/** 出一招 */
export function castSkill(idx) {
  if (G.busy || G.over) return;
  const list = buildSkills();
  const sk = list[idx];
  if (!sk) return;

  const st = calcStats();
  const e = st.e;
  const q = st.q;
  const aux = canLink(sk.kind) ? auxOf(idx, list) : null;

  G.busy = true;
  S.pAnim = 0.3;

  const p = skillPower(sk, st.s, e);
  const targets = sk.kind === 'aoe' ? alive() : [alive()[0]].filter(Boolean);
  if (!targets.length) {
    G.busy = false;
    return;
  }

  spawnCastFX(sk); // 五行 + 技能类型 决定这一招长什么样
  castCallout(sk.name, sk.elem); // 招式名：毛笔字，斜着题

  const healB = 1 + (q.healB || 0) / 100;
  const linkMul = aux ? 1 + (aux.lv || 1) * 0.06 : 1; // 辅助技等级 → 主攻威力
  const linkBuff = aux && aux.kind === 'buff' ? 1.3 : 1; // 蓄势类链接：本击 +30%

  // 链接的辅助技随这一招同步触发，按六成强度
  if (aux) {
    if (aux.kind === 'heal') {
      const h = Math.round(skillPower(aux, st.s, e) * 0.9 * 0.6 * healB);
      S.php = Math.min(st.s.hp, S.php + h);
      floatText(PLAYER_X, GROUND - 120, '链 +' + h, '#6cbb8c');
      log('　链·' + aux.name + '：回气血 ' + h, '#2f6b52');
    } else if (aux.kind === 'shield') {
      const v = Math.round(skillPower(aux, st.s, e) * 0.8 * 0.6 * healB);
      S.shield += v;
      floatText(PLAYER_X, GROUND - 120, '链 盾 ' + v, '#6fa8c9');
      log('　链·' + aux.name + '：护盾 ' + v, '#38617f');
    } else {
      floatText(PLAYER_X, GROUND - 120, '链 蓄势', '#c9a227');
      log('　链·' + aux.name + '：本击助势 ×1.3', '#a8811f');
    }
  }

  if (sk.kind === 'heal') {
    const heal = Math.round(p * 0.9 * healB);
    S.php = Math.min(st.s.hp, S.php + heal);
    floatText(PLAYER_X, GROUND - 96, '+' + heal, '#6cbb8c', true);
    burst(PLAYER_X, GROUND - 40, 12, '#6cbb8c');
    sfx('heal');
    log(sk.name + ' Lv' + sk.lv + '：回气血 ' + heal);
  } else if (sk.kind === 'shield') {
    const sv = Math.round(p * 0.8 * healB);
    S.shield += sv;
    floatText(PLAYER_X, GROUND - 96, '护盾 ' + sv, '#6fa8c9', true);
    sfx('heal');
    log(sk.name + ' Lv' + sk.lv + '：护盾 ' + sv);
  } else if (sk.kind === 'buff') {
    S.buffNext = 2;
    floatText(PLAYER_X, GROUND - 96, '蓄势', '#c9a227', true);
    sfx('heal');
    log(sk.name + ' Lv' + sk.lv + '：下一击威力翻倍');
  } else {
    const doubled = S.buffNext > 0;
    if (doubled) S.buffNext = 0;
    let top = 0;

    // 器灵 / 诅咒：整体伤害乘数
    const sp = q.sp;
    let spiritMul = 1 + ((sk.kind === 'aoe' ? sp.aoe : sp.single) || 0) / 100;
    if (sp.low && S.php / st.s.hp < 0.3) spiritMul *= 1 + sp.low / 100; // 回天
    if (sp.first && G.turn === 1) spiritMul *= 1 + sp.first / 100; // 承影
    spiritMul *= 1 - (sp.weak || 0) / 100; // 诅咒·耗

    const strike = (m, scale, extra) => {
      let dmg = p * (0.85 + rand() * 0.3);
      if (sk.kind !== 'aoe') dmg *= 1.15;
      if (doubled) dmg *= 2;
      dmg *= scale * linkMul * linkBuff * spiritMul;
      // 破防：按比例削减目标气防，等效增伤
      dmg *= 1 + (q.pen / 100) * 0.6;

      const crit = chancePct(q.crit);
      if (crit) dmg *= 1 + q.critDmg / 100;

      const v = Math.max(1, Math.round(dmg));
      m.hp -= v;
      m.hurt = 0.16;
      m.hx = 12;
      burst(m.x, m.y - 10, crit ? 16 : 10, crit ? '#ffd166' : '#e8b04a');
      floatText(
        m.x + (rand() - 0.5) * 24,
        m.y - 24 - (extra ? 15 : 0),
        (extra || '') + (crit ? '暴 ' : '') + v,
        crit ? '#ffd166' : doubled ? '#ffe9a8' : '#f0e6c0',
        crit || doubled
      );
      if (crit) {
        sfx('crit');
        S.shake = Math.max(S.shake, 0.7);
      }
      top = Math.max(top, v);

      // 噬血
      if (q.leech > 0) {
        const h = Math.round((v * q.leech) / 100);
        if (h > 0) {
          S.php = Math.min(st.s.hp, S.php + h);
          floatText(PLAYER_X + (rand() - 0.5) * 18, GROUND - 104, '+' + h, '#6cbb8c');
        }
      }

      if (m.hp <= 0) {
        m.dead = true;
        m.hp = 0;
      }

      // 打击停顿：普通 45ms、暴击 85ms、击杀 100ms —— 整个画面定住一下，手感就出来了
      hitStop(m.dead ? 0.1 : crit ? 0.085 : 0.045);
    };

    targets.forEach((m) => {
      strike(m, 1, '');
      // 连击：额外一记半伤
      if (!m.dead && chancePct(q.dbl)) strike(m, 0.55, '连 ');
    });

    S.shake = Math.max(S.shake, 0.55);
    sfx('hit');
    log(
      sk.name + ' Lv' + sk.lv + '：造成约 ' + Math.round(p * linkMul * linkBuff * spiritMul) +
        ' 点伤害' + (doubled ? '（蓄势×2）' : '') + (top ? '　最高 ' + top : '')
    );
  }

  refresh();

  if (alive().length === 0) {
    winWave();
    return;
  }

  delay(() => enemyTurn(), 520);
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
