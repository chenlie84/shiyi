/**
 * 地宫地面
 *
 * 已经不是"一条地面线"了 —— 整块地是砖铺的，镜头走到哪画到哪。
 * 只画视口能看见的那几行砖，所以世界多大都不影响开销。
 *
 * 装饰（苔、裂纹、碎石）由砖格坐标哈希出来：同一格永远是同一份样子，
 * 不用存档，也不会随镜头移动而闪。
 */

import { cv, ctx } from '../canvas.js';
import { S } from '../../game/state.js';
import { CV_W, CV_H, FIELD } from '../../config.js';

const T = 64; // 砖的边长

/**
 * 砖格哈希 → 0..1，纯函数，同一格永远同一个数
 *
 * 必须用 Math.imul：普通乘法在这里会超过 2^53，低位被 double 舍掉，
 * 哈希退化成"几乎全落在低区间" —— 表现出来就是苔和裂缝少得离谱。
 */
function h2(a, b) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function drawBG() {  const cx = S.cam.x;
  const cy = S.cam.y;

  // 视野底色（墙外就是黑的）
  ctx.fillStyle = '#07070a';
  ctx.fillRect(cx - 8, cy - 8, CV_W + 16, CV_H + 16);

  // ── 地面 ──
  ctx.save();
  ctx.beginPath();
  ctx.rect(FIELD.x0, FIELD.y0, FIELD.x1 - FIELD.x0, FIELD.y1 - FIELD.y0);
  ctx.clip();

  const i0 = Math.floor(Math.max(FIELD.x0, cx) / T);
  const i1 = Math.floor(Math.min(FIELD.x1, cx + CV_W) / T);
  const j0 = Math.floor(Math.max(FIELD.y0, cy) / T);
  const j1 = Math.floor(Math.min(FIELD.y1, cy + CV_H) / T);

  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const n = h2(i, j);
      // 棋盘式的深浅 + 一点点随机，砖才不像贴图平铺
      const base = (i + j) & 1 ? 46 : 40;
      const v = Math.round(base + n * 8);
      ctx.fillStyle = 'rgb(' + (v + 7) + ',' + (v + 3) + ',' + (v - 5) + ')';
      ctx.fillRect(i * T, j * T, T, T);

      // 砖缝
      ctx.fillStyle = 'rgba(0,0,0,.42)';
      ctx.fillRect(i * T, j * T, T, 1.5);
      ctx.fillRect(i * T, j * T, 1.5, T);

      // 隔几格长一处苔或裂一道缝
      if (n > 0.82) {
        // 苔要压暗、切小：亮绿方块看着像贴纸，不像从砖缝里长出来的
        ctx.fillStyle = 'rgba(56,74,42,.22)';
        const ox = i * T + 13 + n * 24;
        const oy = j * T + 15 + h2(j, i) * 26;
        ctx.fillRect(ox, oy, 9 + n * 15, 4 + n * 6);
        ctx.fillStyle = 'rgba(74,96,48,.15)';
        ctx.fillRect(ox + 4, oy - 4, 5, 6);
        ctx.fillRect(ox + 7 + n * 6, oy + 3, 4, 4);
      } else if (n < 0.1) {
        ctx.strokeStyle = 'rgba(0,0,0,.4)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        const ox = i * T + 12 + n * 240;
        const oy = j * T + 8;
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + 12, oy + 16);
        ctx.lineTo(ox + 6, oy + 30);
        ctx.lineTo(ox + 18, oy + 44);
        ctx.stroke();
      }
    }
  }

  // 地面上的一层暖光，别让砖看起来是灰的
  const warm = ctx.createLinearGradient(0, FIELD.y0, 0, FIELD.y1);
  warm.addColorStop(0, 'rgba(132,96,46,.18)');
  warm.addColorStop(0.5, 'rgba(100,72,34,.06)');
  warm.addColorStop(1, 'rgba(44,28,15,.18)');
  ctx.fillStyle = warm;
  ctx.fillRect(FIELD.x0, FIELD.y0, FIELD.x1 - FIELD.x0, FIELD.y1 - FIELD.y0);

  // ── 摆件 ──
  // 砖是均匀铺的，走多远都一个样，人会失去"我在哪"的感觉。
  // 这里按 320 的大格撒火盆／碎石／骸骨，位置由格坐标哈希定死：
  // 走回来还是那几件东西，世界才有"地方"。
  const BIG = 320;
  const a0 = Math.floor((cx - 140) / BIG);
  const a1 = Math.floor((cx + CV_W + 140) / BIG);
  const b0 = Math.floor((cy - 140) / BIG);
  const b1 = Math.floor((cy + CV_H + 140) / BIG);

  for (let b = b0; b <= b1; b++) {
    for (let a = a0; a <= a1; a++) {
      const n = h2(a + 977, b + 313);
      if (n < 0.26) continue; // 四分之一的大格空着，别摆满
      const ox = a * BIG + 50 + h2(a, b + 7) * (BIG - 120);
      const oy = b * BIG + 60 + h2(a + 3, b) * (BIG - 130);
      if (
        ox < FIELD.x0 + 38 || ox > FIELD.x1 - 38 ||
        oy < FIELD.y0 + 34 || oy > FIELD.y1 - 24
      ) continue;
      if (n > 0.68) brazier(ox, oy);
      else if (n > 0.5) rubble(ox, oy);
      else bones(ox, oy);
    }
  }
  ctx.restore();

  // ── 墙沿 ──
  ctx.strokeStyle = '#0a0908';
  ctx.lineWidth = 4;
  ctx.strokeRect(FIELD.x0, FIELD.y0, FIELD.x1 - FIELD.x0, FIELD.y1 - FIELD.y0);
  ctx.strokeStyle = 'rgba(150,116,70,.30)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(FIELD.x0 - 5, FIELD.y0 - 5, FIELD.x1 - FIELD.x0 + 10, FIELD.y1 - FIELD.y0 + 10);
}

/** 火盆：一点地上暖光 + 一簇会跳的火 */
function brazier(x, y) {
  const t = S.clock || 0;
  const fl = 0.74 + Math.sin(t * 6.3 + x * 0.013) * 0.15 + Math.sin(t * 11.9 + y * 0.02) * 0.08;

  const g = ctx.createRadialGradient(x, y - 8, 6, x, y - 8, 104);
  g.addColorStop(0, 'rgba(255,178,74,.24)');
  g.addColorStop(0.45, 'rgba(212,118,40,.10)');
  g.addColorStop(1, 'rgba(120,60,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 104, y - 112, 208, 208);

  ctx.fillStyle = '#241d16';
  ctx.fillRect(x - 9, y - 15, 18, 15);
  ctx.fillStyle = '#3d2f23';
  ctx.fillRect(x - 11, y - 19, 22, 5);

  const h = 24 * fl;
  ctx.fillStyle = 'rgba(238,132,38,.94)';
  ctx.beginPath();
  ctx.moveTo(x - 7, y - 19);
  ctx.quadraticCurveTo(x - 5, y - 19 - h * 0.62, x, y - 19 - h);
  ctx.quadraticCurveTo(x + 5, y - 19 - h * 0.62, x + 7, y - 19);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,228,152,.95)';
  ctx.beginPath();
  ctx.moveTo(x - 3.4, y - 19);
  ctx.quadraticCurveTo(x - 2, y - 19 - h * 0.5, x, y - 19 - h * 0.68);
  ctx.quadraticCurveTo(x + 2, y - 19 - h * 0.5, x + 3.4, y - 19);
  ctx.closePath();
  ctx.fill();
}

/** 碎石堆 */
function rubble(x, y) {
  const CO = ['#5c4c38', '#4a3c2c', '#6d5942', '#3f3326'];
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 3, 27, 8, 0, 0, 7);
  ctx.fill();
  for (let k = 0; k < 5; k++) {
    const n = h2(x + k * 31, y + k * 17);
    const s = 5 + n * 10;
    ctx.fillStyle = CO[k % 4];
    ctx.fillRect(x - 23 + n * 46, y - s + 3, s, s);
  }
}

/** 骸骨：一根长骨、几节骨节、一个头骨 */
function bones(x, y) {
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 21, 6, 0, 0, 7);
  ctx.fill();

  ctx.fillStyle = '#b3a98f';
  ctx.fillRect(x - 15, y - 4, 30, 3);
  ctx.fillRect(x - 3, y - 10, 3, 9);
  ctx.fillStyle = '#c8bea3';
  ctx.fillRect(x - 17, y - 7, 5, 6);
  ctx.fillRect(x + 12, y - 7, 5, 6);

  ctx.fillStyle = '#c0b69b';
  ctx.fillRect(x + 3, y - 15, 10, 9);
  ctx.fillStyle = '#1b1613';
  ctx.fillRect(x + 5, y - 13, 2, 2);
  ctx.fillRect(x + 9, y - 13, 2, 2);
}
