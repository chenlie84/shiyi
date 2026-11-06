/**
 * 投射物
 *
 * 一式法术发出几枚弹，每枚怎么飞，全由 spec.path 决定：
 *   line    直线
 *   arc     抛射，抬手再落
 *   zigzag  折线乱行（逆克）
 *   homing  追踪，绕个弧再俯冲
 *   orbit   先绕身一周再出手（环流符）
 *   skyfall 从天而落（天坠符 / 周天璇玑）
 *
 * 只负责"看起来怎么飞"；伤害早在 game 层算完了。
 */

import { ctx } from '../canvas.js';
import { S } from '../../game/state.js';
import { GROUND, PLAYER_X } from '../../config.js';
import { hexA } from '../../core/math.js';
import { rand } from '../../core/rng.js';
import { ELEM_FX } from '../palette.js';
import { alive } from '../../game/waves.js';

const X0 = PLAYER_X + 26;
const Y0 = GROUND - 64;

/** 每种的飞行时长（秒）与起步错开（秒） */
const FLIGHT = { line: 0.15, arc: 0.2, zigzag: 0.19, homing: 0.26, orbit: 0.4, skyfall: 0.2 };

/**
 * 生成这一式的所有投射物
 * @param {object} spec composeSpell 结果
 * @param {Array} targets 存活怪（按位置）
 */
export function spawnBolts(spec, targets) {
  if (!spec || !targets || !targets.length) return;
  const n = spec.proj;
  const F = ELEM_FX[spec.elem] || ELEM_FX.木;
  const path = spec.path || 'line';

  for (let i = 0; i < n; i++) {
    const tg = targets[Math.min(i, targets.length - 1)] || alive()[0];
    if (!tg) continue;
    const tx = tg.x;
    const ty = GROUND - 52;

    // 多发时略微散开，别叠成一条线
    const spread = n > 1 ? (i - (n - 1) / 2) * (path === 'arc' ? 12 : 22) : 0;

    S.fx.push({
      k: 'bolt',
      path,
      col: F.col,
      elem: spec.elem,
      trait: spec.trait,
      t: 0,
      d0: i * 0.095, // 连珠感：一发接一发
      fly: (FLIGHT[path] || 0.16) / Math.max(0.6, spec.spd * 0.85),
      x0: X0,
      y0: Y0,
      x1: tx + spread,
      y1: ty + (path === 'arc' ? -6 : 0),
      s: Math.max(0.55, Math.min(1.9, spec.size)),
      seed: rand() * 6.28,
      hit: false,
    });
    // 存活期 = 起步延迟 + 飞行时间（updateVisual 按 life 回收）
    S.fx[S.fx.length - 1].life = i * 0.095 + (FLIGHT[path] || 0.16) / Math.max(0.6, spec.spd * 0.85);
  }
}

/** 落点开花：爆闪 + 该五行的本体 */
function landing(e) {
  const F = ELEM_FX[e.elem] || ELEM_FX.木;
  const fy = F.k === 'ring' ? GROUND - 2 : GROUND - 46;
  S.fx.push({ k: 'flash', x: e.x1, y: e.y1, col: e.col, t: 0, life: 0.24 });
  S.fx.push({ k: F.k, x: e.x1, y: fy, col: e.col, t: 0, life: 0.5, s: e.s * 0.95 });
}

/** 某一时刻弹在哪儿 */
function pos(e, p) {
  const { x0, y0, x1, y1 } = e;
  const dx = x1 - x0;
  const dy = y1 - y0;

  switch (e.path) {
    case 'arc': {
      const lift = 58 + Math.abs(dx) * 0.08;
      return [x0 + dx * p, y0 + dy * p - Math.sin(Math.PI * p) * lift];
    }
    case 'zigzag': {
      const wob = Math.sin(p * Math.PI * 3.2) * 20 * (1 - p * 0.35);
      return [x0 + dx * p, y0 + dy * p + wob];
    }
    case 'homing': {
      // 先向左上绕出去，再俯冲回来
      const cx = x0 + dx * 0.12;
      const cy = y0 - 96;
      const u = 1 - p;
      return [
        u * u * x0 + 2 * u * p * cx + p * p * x1,
        u * u * y0 + 2 * u * p * cy + p * p * y1,
      ];
    }
    case 'orbit': {
      // 前三成绕身一圈，之后直线射出
      if (p < 0.32) {
        const q = p / 0.32;
        const ang = -Math.PI / 2 + q * Math.PI * 2;
        return [x0 + Math.cos(ang) * 34, y0 + Math.sin(ang) * 22];
      }
      const q = (p - 0.32) / 0.68;
      return [x0 + dx * q, y0 + dy * q - Math.sin(Math.PI * q) * 16];
    }
    case 'skyfall': {
      const q = Math.min(1, p * 1.15);
      return [x1, y1 - 300 * (1 - q * q)];
    }
    default:
      return [x0 + dx * p, y0 + dy * p];
  }
}

/** 画一枚弹（由 cast.js 的 drawFX 调用） */
export function drawBolt(e, p, a) {
  if (p <= 0.02) return;
  const [x, y] = pos(e, p);
  const r = 7 * e.s;

  // 拖尾：短促的几段，越远越细越淡（太长会糊成一团烟）
  for (let i = 1; i <= 4; i++) {
    const q = Math.max(0, p - i * 0.045);
    if (q <= 0) break;
    const [tx, ty] = pos(e, q);
    const s = Math.max(1.4, 4.6 * e.s - i * 0.9);
    ctx.fillStyle = hexA(i === 1 ? '#ffffff' : e.col, (1 - i / 5) * a * 0.8);
    ctx.fillRect(tx - s / 2, ty - s / 2, s, s);
  }

  // 弹体：外晕 + 白心
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
  g.addColorStop(0, hexA(e.col, a * 0.95));
  g.addColorStop(0.45, hexA(e.col, a * 0.55));
  g.addColorStop(1, hexA(e.col, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.2, 0, 7);
  ctx.fill();

  ctx.fillStyle = hexA('#ffffff', a * 0.92);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.48, 0, 7);
  ctx.fill();

  // 金系给一道刃光，土系给实体块，其余留光点
  if (e.elem === '金') {
    ctx.strokeStyle = hexA('#ffffff', a * 0.9);
    ctx.lineWidth = 2.2 * e.s;
    ctx.beginPath();
    ctx.moveTo(x - 13 * e.s, y + 5 * e.s);
    ctx.lineTo(x + 9 * e.s, y - 5 * e.s);
    ctx.stroke();
  } else if (e.elem === '土') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#7d6a44';
    ctx.fillRect(x - 5 * e.s, y - 5 * e.s, 10 * e.s, 10 * e.s);
    ctx.fillStyle = '#d9c48a';
    ctx.fillRect(x - 5 * e.s + 1, y - 5 * e.s + 1, 4 * e.s, 4 * e.s);
    ctx.globalCompositeOperation = 'lighter';
  }

  // 落地那一瞬
  if (p > 0.88 && !e.hit) {
    e.hit = true;
    landing(e);
  }
}
