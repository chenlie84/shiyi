/**
 * 世界推进：人物 / 流派 / 六试炼 / 筑基 / 六残洲 / 主线与随机任务
 *
 * 分层：
 *   这一层只管"在哪、打到哪、下一步是什么"，战斗本身仍然复用
 *   game/combat.js 的回合制 —— 试炼是单挑一头妖魔，任务与游历是打一波杂兵。
 *   战斗通过 bindCombatUI 注入的 onEncounterWin / onEncounterLose 回过头来通知这里。
 *
 *   世界进度存在 W（独立存档），不随顶栏「重来」清空；
 *   一局的装备与地宫层数仍在 G/S，由 resetState 重置。
 */

import { G, S } from './state.js';
import { calcStats } from './stats.js';
import { placePlayer, spawnBoss } from './field.js';
import { makeWave } from './waves.js';
import { startWave, bindCombatUI, resetAggro } from './combat.js';
import { makeItem, nmOf } from './item.js';
import { log, refresh } from '../render/presenter.js';
import { rand, randInt, pick } from '../core/rng.js';
import { nameSeed, questPlace, placeName, demonName } from './naming.js';
import { loadWorld, saveWorld, clearWorld } from '../platform/storage.js';
import { SECTS, TRIALS, REGIONS, VILLAGE, STAGES, QUEST_TEMPLATES } from '../data/world.js';

/** 世界进度（独立存档） */
export const W = {
  hero: null,
  sect: null,
  trials: [],        // 已降伏的试炼 id
  visited: [],       // 游历过的残洲 id
  anchors: [],       // 取回的四极之枢
  quests: [],        // 当前挂着的随机任务
  questDone: 0,
  pills: 0,          // 服下的筑基丹
  merged: false,
  currentTrial: null,
  currentQuest: null,
  currentRegion: null,
  lastResult: null,  // 最近一次遭遇战的战果，给地图面板展示
};

const listeners = new Set();
export function subscribeWorld(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  saveWorld(persistable());
  listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
}
function persistable() {
  const { hero, sect, trials, visited, anchors, quests, questDone, pills, merged } = W;
  return { hero, sect, trials, visited, anchors, quests, questDone, pills, merged };
}

/** 启动时恢复存档；没有人物就返回 false，交给开局流程 */
export function initWorld() {
  const old = loadWorld();
  if (old && old.hero) {
    Object.assign(W, {
      hero: old.hero,
      sect: old.sect || null,
      trials: Array.isArray(old.trials) ? old.trials : [],
      visited: Array.isArray(old.visited) ? old.visited : [],
      anchors: Array.isArray(old.anchors) ? old.anchors : [],
      quests: Array.isArray(old.quests) ? old.quests : [],
      questDone: old.questDone || 0,
      pills: old.pills || 0,
      merged: !!old.merged,
    });
  }
  applyWorldBonus();
  // 战斗流程的两个断点：遭遇战打赢 / 阵亡回村
  bindCombatUI({ onEncounterWin, onEncounterLose });
  return !!W.hero;
}

export function clearProgress() {
  clearWorld();
  W.hero = null; W.sect = null;
  W.trials = []; W.visited = []; W.anchors = []; W.quests = [];
  W.questDone = 0; W.pills = 0; W.merged = false;
  W.currentTrial = W.currentQuest = W.currentRegion = W.lastResult = null;
  applyWorldBonus();
  emit();
}

/** 把人物与流派的小幅加成写进 G.bonus，calcStats() 只读这里 */
export function applyWorldBonus() {
  const b = {};
  const add = (o) => {
    if (!o) return;
    for (const k in o) b[k] = (b[k] || 0) + o[k];
  };
  if (W.hero) add(W.hero.bonus);
  const sect = SECTS.find((s) => s.id === W.sect);
  if (sect) add(sect.bonus);
  G.bonus = b;
}

export function setHero(ch) {
  W.hero = ch;
  W.sect = null;
  W.trials = []; W.visited = []; W.anchors = []; W.quests = [];
  W.questDone = 0; W.pills = 0; W.merged = false;
  W.lastResult = null;
  applyWorldBonus();
  emit();
}

export function setSect(id) {
  const s = SECTS.find((x) => x.id === id);
  if (!s || W.sect) return false; // 拜了就不改，省得刷数值
  W.sect = id;
  applyWorldBonus();
  log('拜入「' + s.n + '」，得『' + s.motto + '』二字。日后能走多远，还得看三才成不成阵。', '#8a5a1f');
  emit();
  return true;
}

export const sectOf = () => SECTS.find((s) => s.id === W.sect) || null;

/* ---------- 主线阶段 ---------- */

/** 阶段由条件推出来，不另存一份状态，免得两边不同步 */
export function stageOf() {
  if (!W.hero) return STAGES[0];
  if (W.trials.length < TRIALS.length) return STAGES[0];
  if (!W.pills) return STAGES[1];
  if (!W.merged) return STAGES[2];
  return STAGES[3];
}
export const stageIndex = () => STAGES.indexOf(stageOf());

/** 当前该做什么的一句话，给地图面板 */
export function nextGoal() {
  if (!W.hero) return '先定下这一世的名姓';
  if (!W.sect) return '往村中拜一个大流派';
  if (W.trials.length < TRIALS.length) {
    return '六试炼已降 ' + W.trials.length + ' / 6 —— 下一处：' + (TRIALS.find((t) => !W.trials.includes(t.id)) || {}).n;
  }
  if (!W.pills) return '六妖伏诛，去长老处取筑基丹';
  if (W.anchors.length < 4) return '出村游历六残洲，取回四极之枢（' + W.anchors.length + ' / 4）';
  if (!W.merged) return '四枢归位，往绝地天柱合四洲之地';
  return '四洲已合，妖魔未尽 —— 随机机缘仍在各处';
}

/* ---------- 遭遇战 ---------- */

function beginEncounter(mode, mobs, tag) {
  G.waveMode = mode;
  Object.assign(W, tag);
  W.lastResult = null;
  placePlayer();
  S.mobs = mobs;
  G.turn = 1;
  G.busy = false;
  G.over = false;
  resetAggro();
  S.php = calcStats().s.hp;
  S.shield = 0; S.buffNext = 0; S.reflect = 0;
  refresh();
  emit();
}

/** 试炼：一头妖魔，单挑。六处按序放开 */
export function trialState(id) {
  const i = TRIALS.findIndex((t) => t.id === id);
  const done = W.trials.includes(id);
  const open = i === 0 || W.trials.includes(TRIALS[i - 1].id);
  return { done, open, locked: !open && !done, index: i + 1 };
}

export function startTrial(id) {
  const t = TRIALS.find((x) => x.id === id);
  if (!t || !W.hero) return false;
  const stt = trialState(id);
  if (!stt.open || stt.done) return false;

  const rng = nameSeed('demon', id, W.hero.name);
  const dn = demonName(rng, t.demon);
  const tier = stt.index;
  const st = calcStats();
  const hp = Math.round((190 + tier * 105) * t.hp * (1 + (G.diff - 1) * 0.25));
  const p = spawnBoss()[0];
  const mob = {
    name: t.ep + '·' + t.demon,
    full: dn.name,
    lore: t.lore,
    boss: true,
    scale: 1.55,
    hp, maxhp: hp,
    atk: Math.round((7 + tier * 2.6) * t.atk * 10) / 10,
    def: Math.round(3 + tier * 1.4),
    red: t.red,
    regen: 0,
    x: p.x, y: p.y,
    hurt: 0, hx: 0, dead: false, atkAnim: 0,
    enter: 1, dx: 0, dy: 0,
  };
  log('入「' + t.n + '」—— ' + mob.name + ' 已在那里等着。', '#a83b2c');
  log('　' + t.desc, '#6b6154');
  beginEncounter('trial', [mob], { currentTrial: id, currentQuest: null, currentRegion: null });
  return true;
}

/* ---------- 随机任务 ---------- */

export function rollQuests(n = 3) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const tpl = pick(QUEST_TEMPLATES);
    const rng = nameSeed('quest', W.hero ? W.hero.name : 'anon', W.questDone + W.quests.length + i, Date.now() >> 10);
    const place = questPlace(rng);
    const tier = 1 + Math.min(5, Math.floor((W.trials.length + W.questDone) / 2));
    out.push({
      id: 'q' + (W.questDone + W.quests.length + i) + '_' + randInt(9999),
      k: tpl.k, n: tpl.n, icon: tpl.icon,
      place, tier,
      title: tpl.title.replace('{n}', place),
      desc: tpl.desc.replace(/\{n\}/g, place),
      reward: { stones: Math.round(tpl.reward.stones * (1 + tier * 0.18)), soul: tpl.reward.soul + tier },
    });
  }
  W.quests = out;
  emit();
  return out;
}

export function startQuest(id) {
  const q = W.quests.find((x) => x.id === id);
  if (!q || !W.hero) return false;
  const mobs = makeWave();
  const scale = 0.7 + q.tier * 0.16;
  mobs.forEach((m) => {
    m.hp = Math.max(20, Math.round(m.hp * scale));
    m.maxhp = m.hp;
    m.atk = Math.round(m.atk * (0.8 + q.tier * 0.08) * 10) / 10;
  });
  log(q.n + ' · ' + q.title, '#8a5a1f');
  beginEncounter('quest', mobs, { currentTrial: null, currentQuest: q, currentRegion: null });
  return true;
}

/* ---------- 游历六残洲 ---------- */

export function regionState(id) {
  const r = REGIONS.find((x) => x.id === id);
  if (!r) return { locked: true };
  if (!W.pills) return { locked: true, why: '筑基之后方可出村' };
  return {
    locked: false,
    visited: W.visited.includes(id),
    anchored: !!r.anchor && W.anchors.includes(r.anchor),
  };
}

export function startRegion(id) {
  const r = REGIONS.find((x) => x.id === id);
  if (!r) return false;
  const stt = regionState(id);
  if (stt.locked) return false;

  const mobs = makeWave();
  const scale = 0.9 + r.danger * 0.24;
  mobs.forEach((m) => {
    m.hp = Math.max(30, Math.round(m.hp * scale));
    m.maxhp = m.hp;
    m.atk = Math.round(m.atk * (0.9 + r.danger * 0.1) * 10) / 10;
  });
  log('游历「' + r.n + '」（' + r.from + '）—— ' + r.sub, '#a8811f');
  log('　' + r.desc, '#6b6154');
  beginEncounter('region', mobs, { currentTrial: null, currentQuest: null, currentRegion: id });
  return true;
}

/* ---------- 战斗回调（由 combat.js 注入） ---------- */

/** 打赢一场遭遇战：结算 → 回地图 */
export function onEncounterWin() {
  const mode = G.waveMode;
  const lines = [];

  if (mode === 'trial') {
    const t = TRIALS.find((x) => x.id === W.currentTrial);
    if (t && !W.trials.includes(t.id)) {
      W.trials.push(t.id);
      G.stones += t.reward.stones;
      G.soul += t.reward.soul;
      lines.push('降伏「' + t.ep + '·' + t.demon + '」，灵石 +' + t.reward.stones + '，器魂 +' + t.reward.soul);
      if (W.trials.length === TRIALS.length) {
        lines.push('六妖尽伏。长老把封了多年的丹炉搬了出来。');
      } else {
        lines.push('回村歇一歇，下一处试炼已经开了。');
      }
    }
    W.lastResult = { title: '试炼 · ' + (t ? t.n : ''), lines };
  } else if (mode === 'quest') {
    const q = W.currentQuest;
    if (q) {
      G.stones += q.reward.stones;
      G.soul += q.reward.soul;
      W.questDone++;
      W.quests = W.quests.filter((x) => x.id !== q.id);
      lines.push(q.n + '毕，灵石 +' + q.reward.stones + '，器魂 +' + q.reward.soul);
      if (rand() < 0.4) {
        const it = makeItem(1 + q.tier, false, 2);
        G.bag.push(it);
        lines.push('顺手拾得一件蒙尘旧器：' + nmOf(it));
      }
      if (!W.quests.length) rollQuests(3);
    }
    W.lastResult = { title: '差事 · ' + (q ? q.n : ''), lines };
  } else if (mode === 'region') {
    const r = REGIONS.find((x) => x.id === W.currentRegion);
    if (r) {
      if (!W.visited.includes(r.id)) W.visited.push(r.id);
      let got = false;
      if (r.anchor && !W.anchors.includes(r.anchor)) {
        W.anchors.push(r.anchor);
        got = true;
        lines.push('于' + r.n + '取回「' + r.anchor + '」（四枢 ' + W.anchors.length + ' / 4）');
      }
      if (!got) lines.push('此地妖气又薄了一层。' + (r.relic ? '听说『' + r.relic + '』还埋着。' : ''));
      G.stones += 20 + r.danger * 8;
      lines.push('游历所得灵石 +' + (20 + r.danger * 8));
    }
    W.lastResult = { title: '游历 · ' + (r ? r.n : ''), lines };
  }

  G.waveMode = 'dungeon';
  W.currentTrial = W.currentQuest = W.currentRegion = null;
  refresh();
  emit();
}

/** 阵亡：不扣进度，回地图重来即可 */
export function onEncounterLose() {
  const mode = G.waveMode;
  if (mode !== 'dungeon') {
    W.lastResult = {
      title: '败归',
      lines: ['这一趟没走完。回村养好伤，换个配装再来 —— 试炼与任务都还留着。'],
    };
    W.currentTrial = W.currentQuest = W.currentRegion = null;
    G.waveMode = 'dungeon';
  }
  emit();
}

/* ---------- 筑基 / 出村 / 合洲 ---------- */

export function canTakePill() {
  return W.trials.length >= TRIALS.length && !W.pills;
}

export function takeFoundationPill() {
  if (!canTakePill()) return false;
  W.pills = 1;
  const st = calcStats();
  S.php = st.s.hp;
  log('长老开炉，筑基丹成。服下之后，气海一沉，天地忽然近了些。', '#a8811f');
  log('出了村才是四洲残地 —— 六块地，四道枢，一条断了的路。', '#6b6154');
  W.lastResult = {
    title: '筑基',
    lines: ['六妖伏诛，长老以残方炼成筑基丹。', '境界入筑基，可以出村了。', '主线：游历六残洲，取回四极之枢，合四洲之地。'],
  };
  emit();
  return true;
}

export function canMerge() {
  return W.pills > 0 && W.anchors.length >= 4 && !W.merged;
}

export function mergeWorld() {
  if (!canMerge()) return false;
  W.merged = true;
  log('四枢归位，绝地天柱的断口合上一线。四洲之地重连，妖魔失了裂缝，退往归墟。', '#a8811f');
  log('天还没通，但路接上了一截。往后的仙缘，得自己去找。', '#6b6154');
  W.lastResult = {
    title: '合四洲',
    lines: ['东极木枢、西极金枢、南极火枢、北极水枢，尽归天柱。', '四洲重连，妖魔退入归墟。', '主线至此告一段落；随机机缘与更深的秘境仍在。'],
  };
  emit();
  return true;
}

/** 战果看过了 */
export function clearResult() {
  W.lastResult = null;
  emit();
}

/** 从地图回试炼台（地宫） */
export function backToDungeon() {
  G.waveMode = 'dungeon';
  W.currentTrial = W.currentQuest = W.currentRegion = null;
  W.lastResult = null;
  startWave();
  emit();
}

export { SECTS, TRIALS, REGIONS, VILLAGE, STAGES, placeName };
