/**
 * 全局常量
 *
 * 画布尺寸与站位是"设计分辨率"，逻辑层算位置也用它，
 * 所以放在根目录，不归 render 独有。
 */

/** 设计分辨率（逻辑像素，和 canvas 的 width/height 一致） */
export const CV_W = 640;
export const CV_H = 520;

/** 地面线 */
export const GROUND = 386;

/** 英雄站立点 */
export const PLAYER_X = 150;

/** 怪物起始站位：第 i 只 = MOB_X0 + i * MOB_GAP */
export const MOB_X0 = 296;
export const MOB_GAP = 82;

/** 掉落光柱的三个落点 */
export const BEAM_X = [190, 330, 470];

/** 存档键 */
export const SAVE_KEY = 'shiyi.meta.v1';
