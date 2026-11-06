/**
 * 全局常量
 *
 * 这一版起，游戏有了「世界」和「镜头」两套坐标：
 *   世界坐标 —— 地宫是一整块地（WORLD_W × WORLD_H），人、怪、弹都在这里走
 *   屏幕坐标 —— 视口（CV_W × CV_H），只有镜头能看到的那一块
 *
 * 渲染时 ctx 先平移 -cam 再画世界，所以画世界的东西一律用世界坐标；
 * 血条、题字这类贴在镜头上的东西，在 restore 之后用屏幕坐标画。
 */

/** 视口（= canvas 的 width/height） */
export const CV_W = 900;
export const CV_H = 560;

/** 地宫整块地的尺寸 */
export const WORLD_W = 1800;
export const WORLD_H = 1280;

/** 可行走的地面：再往外就是墙 */
export const FIELD = { x0: 150, x1: WORLD_W - 150, y0: 230, y1: WORLD_H - 120 };

/** 玩家走得多快（像素/秒） */
export const PLAYER_SPEED = 240;

/** 怪物每回合逼近多远、离多近才动手 */
export const MOB_STEP = 168;
export const MOB_REACH = 98;

/** 怪物刷在离玩家多远的圈上（四方落点） */
export const SPAWN_R = { min: 250, max: 340 };

/** 掉落光柱的落点（相对玩家的三处偏移） */
export const BEAM_OFF = [-64, 0, 64];

/** 存档键 */
export const SAVE_KEY = 'shiyi.meta.v1';
