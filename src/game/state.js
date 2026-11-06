/**
 * 运行时状态
 *
 * 分两层：
 *   G —— 一局之内会变的"档案"（灵石、行囊、经脉…）。以后要做存档就序列化它。
 *   S —— 每帧都在变的"舞台状态"（怪物、粒子、光柱、镜头抖动…），不存档。
 *
 * 约定：game 层可以随便读写 S；render/ui 层只读，改动要走 game 层的函数。
 */

import { seed, unseed } from '../core/rng.js';

/** 一局的状态 */
export const G = {
  floor: 1,       // 第几层地宫
  room: 1,        // 层内第几间，1..6 为丹房，7 为妖王殿
  turn: 1,
  best: 0,        // 最深到过第几层
  stones: 0,
  diff: 1,
  bag: [],
  slots: [null, null, null],   // 天 / 人 / 地
  lv: 1,
  xp: 0,
  pts: 0,
  mer: {},        // 已点的经脉 node id
  links: {},      // 辅助技 → 主攻技 的链接表
  dex: {},        // 拾遗录：见过的器名
  soul: 0,        // 器魂
  uid: 1,
  busy: false,
  over: false,
  log: [],
  autoPick: false,
};

/** 舞台状态（每帧） */
export const S = {
  mobs: [],
  target: 0,

  // 英雄
  php: 1,          // 当前气血
  shield: 0,
  buffNext: 0,
  reflect: 0,
  pHurt: 0,
  pAnim: 0,

  // 镜头 / 屏效
  shake: 0,
  hitFlash: 0,
  freeze: 0,       // 打击停顿，单位秒

  // 表现对象池
  parts: [],       // 像素碎屑
  floats: [],      // 飘字
  beams: [],       // 掉宝光柱
  fx: [],          // 施法特效
  callouts: [],    // 招式题字

  // 界面
  relicOpen: false,
  modalItem: null,

  // 主循环
  last: 0,
};

/** 开局重置（不含开局装备的生成，那属于 game/session） */
export function resetState() {
  G.floor = 1;
  G.room = 1;
  G.turn = 1;
  G.stones = 0;
  G.bag = [];
  G.slots = [null, null, null];
  G.log = [];
  G.over = false;
  G.busy = false;
  G.lv = 1;
  G.xp = 0;
  G.pts = 0;
  G.mer = {};
  G.links = {};
  G.dex = {};
  G.soul = 0;
  G.uid = 1;

  S.mobs = [];
  S.target = 0;
  S.php = 1;
  S.shield = 0;
  S.buffNext = 0;
  S.reflect = 0;
  S.pHurt = 0;
  S.pAnim = 0;
  S.shake = 0;
  S.hitFlash = 0;
  S.freeze = 0;
  S.parts = [];
  S.floats = [];
  S.beams = [];
  S.fx = [];
  S.callouts = [];
  S.relicOpen = false;
  S.modalItem = null;
}

export { seed, unseed };
