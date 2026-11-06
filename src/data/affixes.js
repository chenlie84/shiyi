/**
 * 仿 PoE 的词条表：前缀（数值）/ 后缀（百分比）/ T 级
 *
 * 纯数据，不含逻辑。调平衡只改这里。
 */
/* ---------- 词条：仿 PoE 的前缀 / 后缀 / T 级 ---------- */
/* 前缀：纯数值，最多 3 条。数组由 T5 排到 T1 */
export const PRE={
  hp :{n:'气血',c:'#a83b2c',v:[15,30,50,75,110]},
  atk:{n:'攻击',c:'#b8432f',v:[4,7,11,16,22]},
  mag:{n:'法攻',c:'#6b4a7a',v:[3,5,8,12,17]},
  def:{n:'防御',c:'#5b7c96',v:[2,4,6,9,13]},
};
/* 后缀：百分比/机制，最多 3 条 */
export const SUF={
  crit   :{n:'暴击',c:'#c9862f',v:[3,5,8,11,15],  u:'%'},
  critDmg:{n:'暴伤',c:'#c9862f',v:[10,18,26,36,48],u:'%'},
  inc    :{n:'增伤',c:'#a83b2c',v:[6,10,15,20,26],u:'%'},
  red    :{n:'减伤',c:'#2f6b52',v:[4,7,10,14,18], u:'%'},
  leech  :{n:'噬血',c:'#2f6b52',v:[3,5,7,10,14],  u:'%'},
  reflect:{n:'反伤',c:'#6b4a7a',v:[5,9,14,19,25], u:'%'},
  pen    :{n:'破防',c:'#5b7c96',v:[6,10,15,20,26],u:'%'},
  dbl    :{n:'连击',c:'#38617f',v:[5,8,12,16,20], u:'%'},
};
/* 稀有后缀：只有它涨技能等级，常规池里抽不到，单独走 16% 稀有通道 */
export const RARE={ sk:{n:'技阶',c:'#8a5a1f',v:[1,1,1,1,2],u:''} };
Object.assign(SUF, RARE);
export const PREK=Object.keys(PRE), SUFK=Object.keys(SUF).filter(k=>k!=='sk');
export const TIERC=['#8d8474','#6b6154','#7a6a3a','#a8811f','#a83b2c'];  // T5 → T1

/** 词条键 → 中文名。modTxt / modLine 用它拼文案 */
export const MODN = {
  hp: '气血', atk: '攻击', mag: '法攻', def: '防御',
  crit: '暴击', critDmg: '暴伤', inc: '增伤', red: '减伤', leech: '噬血', reflect: '反伤',
  pen: '破防', dbl: '连击', sk: '技阶',
  atkPct: '攻击', magPct: '法攻', defPct: '防御', hpPct: '气血',
};
