/**
 * 场景装配：更新 → 绘制 → 主循环
 *
 * 这一版多了镜头：世界比视口大，人走到哪镜头跟到哪。
 * 绘制分两趟：
 *   世界趟 —— ctx 平移 −cam，画地面、光柱、人、怪、弹、飘字（全用世界坐标）
 *   屏幕趟 —— restore 之后画血条、题字、暗角（这三样该贴在镜头上）
 *
 * 人和怪在同一趟里按"脚底 y"排序 —— 站在下面的挡住站在上面的，才有纵深。
 */

import { cv, ctx } from './canvas.js';
import { S } from '../game/state.js';
import { CV_W, CV_H, WORLD_W, WORLD_H } from '../config.js';
import { updateCam, walkPlayer } from '../game/field.js';
import { axis } from '../platform/input.js';
import { drawBG } from './draw/background.js';
import { drawHero } from './draw/hero.js';
import { drawMob } from './draw/mob.js';
import { drawBottom } from './draw/hud.js';
import { drawBeams } from './fx/beams.js';
import { drawFX } from './fx/cast.js';
import { drawCallout, SHUFA } from './fx/callout.js';

export function updateVisual(dt) {
  // 走位（弹层开着时 axis() 会给 0）
  walkPlayer(axis().x, axis().y, dt);
  updateCam(CV_W, CV_H, WORLD_W, WORLD_H);
  S.clock += dt;

  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 2.6);
  if (S.hitFlash > 0) S.hitFlash = Math.max(0, S.hitFlash - dt * 3);
  if (S.pHurt > 0) S.pHurt = Math.max(0, S.pHurt - dt);
  if (S.pAnim > 0) S.pAnim = Math.max(0, S.pAnim - dt);

  S.mobs.forEach((m) => {
    if (m.hurt > 0) m.hurt = Math.max(0, m.hurt - dt);
    if (m.hx) m.hx *= Math.pow(0.0009, dt);
    if (m.atkAnim > 0) m.atkAnim = Math.max(0, m.atkAnim - dt);
    // 逼近一步的滑行：位置已经跳过去了，这里把"从哪来的"补成一段位移
    if (m.dx) m.dx *= Math.pow(0.00004, dt);
    if (m.dy) m.dy *= Math.pow(0.00004, dt);
    if (Math.abs(m.dx) < 0.4) m.dx = 0;
    if (Math.abs(m.dy) < 0.4) m.dy = 0;
    // 从外面走进来的淡入
    if (m.enter > 0) m.enter = Math.max(0, m.enter - dt * 2.4);
  });

  if (dt > 0) {
    S.beams.forEach((b) => {
      b.t += dt;
    });
    S.beams = S.beams.filter((b) => b.t < b.life);
  }
  S.parts.forEach((p) => {
    p.t += dt;
    p.vy += 560 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  });
  S.parts = S.parts.filter((p) => p.t < p.life);
  S.floats.forEach((f) => {
    f.t += dt;
    f.y -= 38 * dt;
  });
  S.floats = S.floats.filter((f) => f.t < f.life);
  if (dt > 0) {
    S.fx.forEach((e) => {
      e.t += dt;
    });
    S.fx = S.fx.filter((e) => e.t < e.life);
    S.callouts.forEach((c) => {
      c.t += dt;
    });
    S.callouts = S.callouts.filter((c) => c.t < c.life);
  }
}

/** 世界趟：全部用世界坐标 */
function drawWorld() {
  drawBG();
  drawBeams();

  // 纵深排序：脚底越靠下越后画
  const list = S.mobs.map((m) => ({ y: m.y + (m.dy || 0), f: () => drawMob(m) }));
  list.push({ y: S.py, f: drawHero });
  list.sort((a, b) => a.y - b.y).forEach((o) => o.f());

  drawFX();

  S.parts.forEach((p) => {
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x, p.y, p.s, p.s);
  });
  ctx.globalAlpha = 1;

  S.floats.forEach((f) => {
    ctx.globalAlpha = Math.max(0, 1 - Math.pow(f.t / f.life, 2));
    ctx.font = f.shufa ? '400 42px ' + SHUFA : (f.big ? 'bold 22px' : 'bold 15px') + ' monospace';
    ctx.fillStyle = f.c;
    ctx.textAlign = 'center';
    // 描一圈暗边：深红伤害数字直接压在深棕地砖上根本看不清
    ctx.save();
    ctx.strokeStyle = f.shufa ? 'rgba(10,8,6,.85)' : 'rgba(12,9,7,.9)';
    ctx.lineWidth = f.shufa ? 6 : 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(f.txt, f.x, f.y);
    ctx.restore();
    ctx.fillText(f.txt, f.x, f.y);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

/** 屏幕趟：贴在镜头上的东西 */
function drawScreen() {
  drawBottom();
  drawCallout();

  // 暗角：镜头正中（人站的地方）亮一点，越靠边越黑。
  // 只压一点点 —— 压狠了地砖就看不见了，走位会失去参照。
  const px = S.px - S.cam.x;
  const py = S.py - S.cam.y;
  const g = ctx.createRadialGradient(px, py, 120, px, py, Math.max(CV_W, CV_H) * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.6, 'rgba(0,0,0,.08)');
  g.addColorStop(1, 'rgba(0,0,0,.46)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cv.width, cv.height);
}

export function render() {
  const sx = (Math.random() - 0.5) * S.shake * 18;
  const sy = (Math.random() - 0.5) * S.shake * 18;
  ctx.save();
  ctx.translate(sx, sy);

  ctx.save();
  ctx.translate(-S.cam.x, -S.cam.y);
  drawWorld();
  ctx.restore();

  drawScreen();

  if (S.hitFlash > 0) {
    ctx.fillStyle = 'rgba(200,40,30,' + S.hitFlash * 0.25 + ')';
    ctx.fillRect(0, 0, cv.width, cv.height);
  }
  ctx.restore();
}

/**
 * 主循环
 * 打击停顿靠 freeze：命中瞬间把 dt 归零，整帧定住，
 * 但绝不能卡住战斗里的 setTimeout —— 那只冻渲染，不冻逻辑。
 */
export function loop(t) {
  const raw = Math.min(0.05, (t - S.last) / 1000 || 0);
  S.last = t;
  let dt = raw;
  if (S.freeze > 0) {
    S.freeze = Math.max(0, S.freeze - raw); // 命中瞬间：整个世界定住几十毫秒
    dt = 0;
  }
  updateVisual(dt);
  render();
  requestAnimationFrame(loop);
}
