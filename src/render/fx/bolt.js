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
 * 这一版起弹是从玩家世界坐标飞向目标世界坐标 —— 全 2D，能横穿整个屏幕。
 * 只负责"看起来怎么飞"；伤害早在 game 层算完了。
 */

import { ctx } from '../canvas.js';
import { S } from '../../game/state.js';
import { hexA } from '../../core/math.js';
import { rand } from '../../core/rng.js';
import { ELEM_FX } from '../palette.js';
import { alive } from '../../game/waves.js';

/**
 * 每种弹道的基准飞行时长（秒）
 *
 * 要比"打击感"更慢一点：地宫是整屏游走的，弹得看得见它从身上飞出去、
 * 越过半个屏幕才砸到怪身上，才有"满屏在动"的感觉。太快就只剩一闪。
 */
const FLIGHT = { line: 0.26, arc: 0.34, zigzag: 0.32, homing: 0.44, orbit: 0.56, skyfall: 0.36 };

/** 弹从胸口出来，不是从脚底出来 */
const HAND_UP = 64;

/**
 * 生成这一式的所有投射物
 * @param {object} spec composeSpell 结果
 * @param {Array} targets 存活怪（已按远近排好）
 */
export function spawnBolts(spec, targets) {
  if (!spec || !targets || !targets.length) return;
  const n = spec.proj;
  const F = ELEM_FX[spec.elem] || ELEM_FX.木;
  const path = spec.path || 'line';

  const x0 = S.px;
  const y0 = S.py - HAND_UP;

  for (let i = 0; i < n; i++) {
    const tg = targets[Math.min(i, targets.length - 1)] || alive()[0];
    if (!tg) continue;
    const x1 = tg.x;
    const y1 = tg.y - 52;

    // 多发时沿着"垂直于飞行方向"散开，别叠成一条线
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.max(1, Math.hypot(dx, dy));
    const spread = n > 1 ? (i - (n - 1) / 2) * (path === 'arc' ? 12 : 24) : 0;
    const ox = (-dy / len) * spread;
    const oy = (dx / len) * spread;

    // 远的目标飞久一点，不然半屏外的怪像被"秒贴"了一下
    const fly = ((FLIGHT[path] || 0.28) + len * 0.00042) / Math.max(0.6, spec.spd * 0.85);
    const d0 = i * 0.095; // 连珠感：一发接一发

    S.fx.push({
      k: 'bolt',
      path,
      col: F.col,
      elem: spec.elem,
      trait: spec.trait,
      t: 0,
      d0,
      fly,
      x0,
      y0,
      x1: x1 + ox,
      y1: y1 + oy,
      gy: tg.y, // 落地时用的地面高度（怪物的脚底）
      s: Math.max(0.55, Math.min(1.9, spec.size)),
      seed: rand() * 6.28,
      hit: false,
      life: d0 + fly,
    });
  }
}

/** 落点开花：爆闪 + 该五行的本体 */
function landing(e) {
  const F = ELEM_FX[e.elem] || ELEM_FX.木;
  S.fx.push({ k: 'flash', x: e.x1, y: e.y1, col: e.col, t: 0, life: 0.24 });
  S.fx.push({ k: F.k, x: e.x1, y: e.y1, gy: e.gy, col: e.col, t: 0, life: 0.5, s: e.s * 0.95 });
}

/** 某一时刻弹在哪儿 */
function pos(e, p) {
  const { x0, y0, x1, y1 } = e;
  const dx = x1 - x0;
  const dy = y1 - y0;

  switch (e.path) {
    case 'arc': {
      const lift = 58 + Math.hypot(dx, dy) * 0.08;
      return [x0 + dx * p, y0 + dy * p - Math.sin(Math.PI * p) * lift];
    }
    case 'zigzag': {
      const wob = Math.sin(p * Math.PI * 3.2) * 20 * (1 - p * 0.35);
      const len = Math.max(1, Math.hypot(dx, dy));
      return [x0 + dx * p + (-dy / len) * wob, y0 + dy * p + (dx / len) * wob];
    }
    case 'homing': {
      // 先往侧上绕出去，再俯冲回来
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
        return [x0 + Math.cos(ang) * 34, y0 + Math.sin(ang) * 24];
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
  const r = 8.4 * e.s;

  // 拖尾：从弹体往起点方向铺一串小方点。
  // 地宫是整屏走的，尾得够长才看得出弹是从人身上飞出去、一路划过去的。
  const TAIL = 9;
  for (let i = 1; i <= TAIL; i++) {
    const q = Math.max(0, p - i * 0.024);
    if (q <= 0) break;
    const [tx, ty] = pos(e, q);
    const f = 1 - i / (TAIL + 1.5);
    const s = Math.max(1.2, 5.8 * e.s * f);
    ctx.fillStyle = hexA(i <= 2 ? '#ffffff' : e.col, f * f * a * 0.9);
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
