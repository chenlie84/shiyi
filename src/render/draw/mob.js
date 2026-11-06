/**
 * 敌人：山海经里的那几只，以及守着一层的那只妖王
 *
 * 每只怪画在自己的世界坐标上（脚底对齐），逼近一步的滑行用 dx/dy 补，
 * 从外面走进来的那一下用 enter 做淡入放大。
 *
 * 妖王不是"更大的杂兵"：体型放大、配色换成一身的紫与金，
 * 血条也加宽 —— 让玩家一眼就知道这一间的打法要变。
 */

import { ctx } from '../canvas.js';

/** 杂兵与妖王各一套配色 */
const SKIN = {
  mob: { leg: '#4a1c17', body: '#6b2620', trim: '#8a2f2a', head: '#5a1f1a', horn: '#c9a227', eye: '#f0c040', tooth: '#e8e0c8', hit: '#a03a2a' },
  boss: { leg: '#2f0f26', body: '#5a1b46', trim: '#7a2558', head: '#43122f', horn: '#e8c06a', eye: '#ffd166', tooth: '#f5ead0', hit: '#c04a7a' },
};

/** 画一只怪（scene 按脚底 y 排序后逐个调用） */
export function drawMob(m) {
  const K = m.boss ? SKIN.boss : SKIN.mob;
  const sc = m.scale || 1;
  const lunge = m.atkAnim > 0 ? Math.sin((1 - m.atkAnim / 0.3) * Math.PI) * -26 : 0;
  const P = 7.2 * sc;

  // 世界坐标 + 逼近时的滑行残余（m.y 就是脚底，不用再补偏移）
  const x = m.x + (m.hx || 0) + lunge + (m.dx || 0);
  const fy = m.y + (m.dy || 0);

  // 入场：从外面走来时先淡后实，略微放大
  const enter = m.enter || 0;
  const alpha = Math.min(1, (1 - enter) * 1.6 + 0.35);

  ctx.save();
  ctx.globalAlpha = m.dead ? 0.22 * alpha : alpha;
  if (enter > 0) {
    const k = 1 + enter * 0.22;
    ctx.translate(x, fy);
    ctx.scale(k, k);
    ctx.translate(-x, -fy);
  }

  // 受击挤压：纵向压扁、横向撑开，比单纯闪白更有"打到肉"的感觉
  const sq = m.hurt > 0 ? Math.sin((m.hurt / 0.16) * Math.PI) : 0;
  ctx.save();
  ctx.translate(x, fy);
  ctx.scale(1 + sq * 0.16, 1 - sq * 0.15);

  ctx.fillStyle = 'rgba(0,0,0,.38)';
  ctx.beginPath();
  ctx.ellipse(0, 2, P * 2.1, P * 0.55, 0, 0, 7);
  ctx.fill();

  ctx.fillStyle = K.leg;
  ctx.fillRect(-P * 1.1, -P * 1.6, P * 0.85, P * 1.6);
  ctx.fillRect(P * 0.25, -P * 1.6, P * 0.85, P * 1.6);
  ctx.fillStyle = K.body;
  ctx.fillRect(-P * 1.7, -P * 4.6, P * 3.4, P * 3);
  ctx.fillStyle = K.trim;
  ctx.fillRect(-P * 1.9, -P * 4.6, P * 3.8, P * 0.7);
  ctx.fillStyle = K.head;
  ctx.fillRect(-P * 1.1, -P * 6.2, P * 2.2, P * 1.7);
  ctx.fillStyle = K.horn;
  ctx.beginPath();
  ctx.moveTo(-P * 1.1, -P * 6.2);
  ctx.lineTo(-P * 1.6, -P * 7.4);
  ctx.lineTo(-P * 0.6, -P * 6.2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(P * 1.1, -P * 6.2);
  ctx.lineTo(P * 1.6, -P * 7.4);
  ctx.lineTo(P * 0.6, -P * 6.2);
  ctx.fill();
  ctx.fillStyle = K.eye;
  ctx.fillRect(-P * 0.7, -P * 5.5, P * 0.45, P * 0.4);
  ctx.fillRect(P * 0.25, -P * 5.5, P * 0.45, P * 0.4);
  ctx.fillStyle = K.tooth;
  for (let k = 0; k < 3; k++) ctx.fillRect(-P * 0.55 + k * P * 0.45, -P * 4.75, P * 0.22, P * 0.35);

  // 妖王：脚下踩着一圈煞气
  if (m.boss) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22 + Math.sin(Date.now() / 420) * 0.06;
    ctx.fillStyle = '#7a2558';
    ctx.beginPath();
    ctx.ellipse(0, -P * 0.2, P * 2.6, P * 0.9, 0, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  if (m.hurt > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = K.hit;
    ctx.fillRect(-P * 2, -P * 7.6, P * 4, P * 7.7);
    ctx.restore();
  }
  ctx.restore();

  // 血条（贴在世界里，跟着怪走）—— 举到头顶之上，别压在身体上
  const bw = m.boss ? 108 : 64;
  const bx = x - bw / 2;
  const by = fy - P * 8.4;
  ctx.fillStyle = 'rgba(0,0,0,.7)';
  ctx.fillRect(bx - 2, by - 2, bw + 4, 9);
  ctx.fillStyle = '#3a1a17';
  ctx.fillRect(bx, by, bw, 6);
  ctx.fillStyle = m.boss ? '#c04a7a' : '#c9473a';
  ctx.fillRect(bx, by, Math.max(0, m.hp / m.maxhp) * bw, 6);
  // 自愈：把这一回合回上来的那一截涂暗，看得出"白打了"
  if (m.boss && m.regen) {
    ctx.fillStyle = 'rgba(122,74,138,.55)';
    ctx.fillRect(bx, by, Math.min(bw, bw * m.regen * 3), 6);
  }
  ctx.fillStyle = m.boss ? '#e8c06a' : '#c9bda2';
  ctx.font = (m.boss ? 'bold 11px' : '9px') + ' monospace';
  ctx.textAlign = 'center';
  ctx.fillText(m.name + ' ' + Math.max(0, Math.round(m.hp)), x, by - 5);
  ctx.textAlign = 'left';

  ctx.restore();
}
