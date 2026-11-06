/**
 * 特效配色
 *
 * COL 是"底子色"（暗、用于 UI 文字），COL_L 是"光源色"（亮、用于 canvas 特效）。
 * 同一个五行在两处亮度不一样，别混用。
 */

export const COL_L = { 木: '#8fe0a8', 火: '#ff9d6b', 土: '#ffd166', 金: '#e8eef8', 水: '#8fc9ef' };

/** 五行 → 施法特效原型 */
export const ELEM_FX = {
  金: { k: 'slash', col: '#e8eef8' },
  木: { k: 'vine', col: '#7fd49a' },
  水: { k: 'ring', col: '#8fc4ea' },
  火: { k: 'flame', col: '#ff8a5c' },
  土: { k: 'quake', col: '#e8bf4c' },
};
