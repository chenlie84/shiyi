/**
 * 地面与走位
 *
 * 地宫是一块矩形地面（FIELD），人和怪都在上面走。
 * 这个文件只管"位置"——谁在哪、能不能过去、往谁那边挪一步。
 * 伤害与回合不在这里。
 */

import { S } from './state.js';
import { FIELD, PLAYER_SPEED, MOB_STEP, MOB_REACH, SPAWN_R } from '../config.js';
import { clamp } from '../core/math.js';
import { rand } from '../core/rng.js';

/** 两点距离 */
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/** 把一点夹回地面，别走进墙里 */
export function clampField(x, y) {
  return { x: clamp(x, FIELD.x0, FIELD.x1), y: clamp(y, FIELD.y0, FIELD.y1) };
}

/** 玩家到某一点的距离 */
export const distToPlayer = (x, y) => dist(x, y, S.px, S.py);

/** 玩家站到地面正中 */
export function placePlayer() {
  S.px = (FIELD.x0 + FIELD.x1) / 2;
  S.py = (FIELD.y0 + FIELD.y1) / 2;
  S.moveTo = null;
  S.walk = 0;
  S.face = 1;
  S.camSnap = true; // 换房间时镜头直接归位，别从上一间滑过来
}

/**
 * 镜头跟着人走，夹在世界里
 *
 * 带死区：人只在画面正中一小块里动的时候镜头不动 —— 这样"我在走"是看得见的
 * （一直钉在正中会让人觉得画面在执行位移，人没挪窝）。走出死区镜头才跟上，
 * 跟的时候用一点插值，不要一顿一顿地跳。
 *
 * @param {boolean} snap 直接对准（换房间／开局用）
 */
export function updateCam(viewW, viewH, worldW, worldH, snap) {
  const DZ = 96; // 死区半宽（像素）
  const wantX = S.px - viewW / 2;
  const wantY = S.py - viewH / 2 - 30; // 稍微往上看一点，脚下留白

  const hard = snap === undefined ? S.camSnap : snap;
  let nx = S.cam.x;
  let ny = S.cam.y;

  if (hard) {
    nx = wantX;
    ny = wantY;
  } else {
    const dx = wantX - S.cam.x;
    const dy = wantY - S.cam.y;
    if (Math.abs(dx) > DZ) nx = S.cam.x + (dx - Math.sign(dx) * DZ);
    if (Math.abs(dy) > DZ) ny = S.cam.y + (dy - Math.sign(dy) * DZ);
  }

  const maxX = Math.max(0, worldW - viewW);
  const maxY = Math.max(0, worldH - viewH);
  const k = hard ? 1 : 0.2;
  S.cam.x = clamp(S.cam.x + (nx - S.cam.x) * k, 0, maxX);
  S.cam.y = clamp(S.cam.y + (ny - S.cam.y) * k, 0, maxY);
  S.camSnap = false;
}

/**
 * 玩家走路（每帧调用）
 * @param {number} dx 左右推杆 −1..1
 * @param {number} dy 上下推杆 −1..1
 * @param {number} dt 秒
 * @returns {boolean} 这一帧有没有走
 */
export function walkPlayer(dx, dy, dt) {
  if (S.moveTo) {
    // 点地走：朝落点直走，到了就停
    const d = dist(S.px, S.py, S.moveTo.x, S.moveTo.y);
    if (d < 6) {
      S.moveTo = null;
    } else {
      dx = (S.moveTo.x - S.px) / d;
      dy = (S.moveTo.y - S.py) / d;
    }
  }

  const m = Math.hypot(dx, dy);
  if (m < 0.01) {
    S.walk = 0;
    return false;
  }

  // 斜着走不该更快
  const k = (PLAYER_SPEED * dt) / Math.max(1, m);
  const p = clampField(S.px + dx * k, S.py + dy * k);
  S.px = p.x;
  S.py = p.y;
  if (Math.abs(dx) > 0.2) S.face = dx > 0 ? 1 : -1;
  S.walk += dt * 9;
  return true;
}

/** 怪物够得着多近的玩家 */
export const reachOf = (m) => (m.boss ? MOB_REACH * 1.3 : MOB_REACH);

/**
 * 怪物朝玩家挪一步。
 * 不越过去、也不贴脸：停在刚进攻击距离的地方。
 * @returns {boolean} 挪完之后够不够得着
 */
export function stepToPlayer(m) {
  const d = distToPlayer(m.x, m.y);
  const reach = reachOf(m);
  if (d <= reach) return true;

  // 留一点余量停在距离边缘，否则每回合都要贴到人身上
  const want = Math.max(reach * 0.86, d - MOB_STEP);
  const k = want / d;
  const tx = S.px + (m.x - S.px) * k;
  const ty = S.py + (m.y - S.py) * k;
  const p = clampField(tx, ty);

  // 记一份"从哪儿挪过来的"，渲染层拿它做一段滑行，别让怪瞬移
  m.dx = (m.x - p.x) || 0;
  m.dy = (m.y - p.y) || 0;
  m.x = p.x;
  m.y = p.y;
  return distToPlayer(m.x, m.y) <= reach;
}

/**
 * 四方落点：把这一间的怪摊到玩家四周
 *
 * 四个方向轮着来 —— 上、下、左、右各分到一份，走上来的时候就是"围"。
 * @param {number} n 要几个点
 */
export function spawnRing(n) {
  const out = [];
  const base = rand() * Math.PI * 2; // 整间屋子转个角度，别每次都一样
  for (let i = 0; i < n; i++) {
    // 四分之一圆一个方向，方向内部再散开
    const quad = (i % 4) * (Math.PI / 2);
    const jitter = (Math.floor(i / 4) * 0.34 + rand() * 0.5 - 0.25) * (Math.PI / 2);
    const ang = base + quad + jitter;
    const r = SPAWN_R.min + rand() * (SPAWN_R.max - SPAWN_R.min);
    const p = clampField(S.px + Math.cos(ang) * r, S.py + Math.sin(ang) * r * 0.82);
    out.push(p);
  }
  return out;
}

/** 妖王只在对面刷：站在玩家正前方的那条线上 */
export function spawnBoss() {
  const p = clampField(S.px, S.py - 300);
  return [p];
}

