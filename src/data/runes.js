/**
 * 改造符
 *
 * 符不自己打人。它挂在某个法术上，把那一式的形状改掉：
 * 多发、加重、拐弯、穿透、命中留东西、出招回气。
 *
 * 七星里第 4 位与第 5 位是两个符位 —— 由天/人、人/地 两对关系推出来，
 * 关系不同，能抽到的符也不同（见 RUNE_POOL）。
 *
 * 纯数据，不含逻辑。
 */

/** 全部符。mod 里的数字是 T1 基准值，符等级会把"偏离 1 的部分"放大。 */
export const RUNES = {
  /* ── 量：改发数 ── */
  fen: { n: '分光符', tag: '量', col: '#c9a227', d: '投射 +1，单发转薄，总量仍增', mod: { proj: 1, powMul: 0.95 } },
  lian: { n: '连珠符', tag: '量', col: '#c9a227', d: '投射 +2，单发更薄，总量仍增', mod: { proj: 2, powMul: 0.85 } },
  ju: { n: '聚风符', tag: '量', col: '#c9a227', d: '聚气成形，体积 +40%，威力 +30%', mod: { powMul: 1.3, size: 1.4 } },

  /* ── 力：改分量 ── */
  lie: { n: '烈阳符', tag: '力', col: '#b8432f', d: '威力 +35%', mod: { powMul: 1.35 } },
  ji: { n: '疾风符', tag: '力', col: '#5b7c96', d: '弹速 +80%，威力 -5%', mod: { spd: 1.8, powMul: 0.95 } },
  ling: { n: '巨灵符', tag: '力', col: '#a8811f', d: '体积 +70%，威力 +20%，弹速 -20%', mod: { size: 1.7, powMul: 1.2, spd: 0.8 } },

  /* ── 轨：改弹道 ── */
  zhui: { n: '追魂符', tag: '轨', col: '#6b4a7a', d: '弹道改为追踪，暴击 +8%', mod: { path: 'homing', crit: 8 } },
  zhe: { n: '折光符', tag: '轨', col: '#6b4a7a', d: '弹道改为折线乱行，暴击 +10%', mod: { path: 'zigzag', crit: 10 } },
  huan: { n: '环流符', tag: '轨', col: '#6b4a7a', d: '先绕身一周再出手，威力 +15%', mod: { path: 'orbit', powMul: 1.15 } },
  zhuiT: { n: '天坠符', tag: '轨', col: '#6b4a7a', d: '从天上砸下，破防 +25%', mod: { path: 'skyfall', pen: 25 } },
  guan: { n: '贯日符', tag: '轨', col: '#5b7c96', d: '穿透 +2，威力 +10%', mod: { pierce: 2, powMul: 1.1 } },

  /* ── 命：改命中 ── */
  hun: { n: '分魂符', tag: '命', col: '#7a4a8a', d: '命中后分裂两枚小弹（四成威力）', mod: { onHit: 'split' } },
  zhen: { n: '震魂符', tag: '命', col: '#7a4a8a', d: '命中溅开，波及相邻四成', mod: { onHit: 'splash' } },
  shi: { n: '噬血符', tag: '命', col: '#7a4a8a', d: '命中回血 12%', mod: { leech: 12 } },
  ning: { n: '凝神符', tag: '命', col: '#7a4a8a', d: '暴击 +18%，暴伤 +30%', mod: { crit: 18, critDmg: 30 } },

  /* ── 法：改出招时 ── */
  hui: { n: '回春符', tag: '法', col: '#4d8a5e', d: '出招时回气血（两成半）', mod: { castHeal: 0.25 } },
  hu: { n: '护身符', tag: '法', col: '#5b7c96', d: '出招时得护盾（两成半）', mod: { castShield: 0.25 } },
  xu: { n: '蓄势符', tag: '法', col: '#c9a227', d: '本击六成，下一击翻倍', mod: { powMul: 0.6, castBuff: 1 } },
};

/**
 * 关系 → 可抽的符。键与 stats.relOf 的返回值一一对应（生 / 逆生 / 克 / 比和）。
 * 我生它（气泄）多给"量"，它生我（得助）多给"力"，相克给"轨"，同气给"命"。
 * 规矩：上面 RUNES 里的每一道符，至少得出现在下面某一个池子里，否则就是死数据。
 */
export const RUNE_POOL = {
  生: ['fen', 'lian', 'huan', 'hui', 'hu'],
  逆生: ['lie', 'ling', 'zhui', 'xu'],
  克: ['guan', 'zhuiT', 'zhe', 'ning', 'ji'],
  比和: ['ju', 'zhen', 'hun', 'shi'],
};

export const RUNE_MAX = 2; // 一式法术最多挂两道符
