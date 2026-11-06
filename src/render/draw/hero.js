/**
 * 主角：一个拿剑的像素小人
 *
 * 站在世界坐标 (S.px, S.py) 上，脚底对齐 —— 所谓"站得深不深"就是这两个数。
 * 走路时两腿交替 + 身子轻微起伏，看着才像在走，不像在滑。
 */

import { ctx } from '../canvas.js';
import { S } from '../../game/state.js';

export function drawHero() {
  const P = 8.5;
  const step = S.walk ? Math.sin(S.walk) : 0;
  const bob = Math.abs(step) * 1.6;
  const face = S.face < 0 ? -1 : 1;
  const x = S.px + (S.pAnim > 0 ? face * Math.sin((1 - S.pAnim / 0.3) * Math.PI) * 30 : 0);
  const fy = S.py - bob;

  ctx.save();
  ctx.translate(x, fy);

  // 影子留在地面，不跟着起伏走
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.beginPath();
  ctx.ellipse(0, bob + 2, P * 2.2, P * 0.6, 0, 0, 7);
  ctx.fill();

  // 腿：交替抬起
  ctx.fillStyle = '#20293a';
  ctx.fillRect(-P * 1.3, -P * 2 - Math.max(0, step) * 3, P, P * 2);
  ctx.fillRect(P * 0.3, -P * 2 - Math.max(0, -step) * 3, P, P * 2);

  // 身
  ctx.fillStyle = '#2f4055';
  ctx.fillRect(-P * 1.6, -P * 4.8, P * 3.2, P * 3);
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fillRect(-P * 0.7, -P * 4.8, P * 1.4, P * 1.1);
  // 腰带
  ctx.fillStyle = '#8a7a4a';
  ctx.fillRect(-P * 1.6, -P * 2.6, P * 3.2, P * 0.45);

  // 头
  ctx.fillStyle = '#e6cdaa';
  ctx.fillRect(-P, -P * 6.4 - bob * 0.4, P * 2, P * 1.7);
  ctx.fillStyle = '#241f18';
  ctx.fillRect(-P * 1.15, -P * 6.8 - bob * 0.4, P * 2.3, P * 0.8);
  ctx.fillStyle = '#1e1a14';
  ctx.fillRect(-P * 0.5, -P * 5.7 - bob * 0.4, P * 0.35, P * 0.4);
  ctx.fillRect(P * 0.2, -P * 5.7 - bob * 0.4, P * 0.35, P * 0.4);

  // 剑：按朝向换边
  ctx.fillStyle = '#cfc7b2';
  ctx.fillRect(face > 0 ? P * 1.7 : -P * 2.0, -P * 5.4, P * 0.3, P * 3.4);

  if (S.pHurt > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#8a4a3a';
    ctx.fillRect(-P * 1.8, -P * 7, P * 3.9, P * 7.1);
    ctx.restore();
  }
  ctx.restore();

  if (S.shield > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(120,180,220,.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, fy - 28, 34, 42, 0, 0, 7);
    ctx.stroke();
    ctx.restore();
  }
}
