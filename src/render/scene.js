/**
 * 场景装配：更新 → 绘制 → 主循环
 *
 * 绘制顺序有讲究：背景 → 光柱 → 怪物 → 人物 → 特效 → 底部 HUD，
 * 光柱排在人前面，人就成了逆光剪影。
 */

import { cv, ctx } from './canvas.js';
import { S } from '../game/state.js';
import { GROUND } from '../config.js';
import { drawBG } from './draw/background.js';
import { drawHero } from './draw/hero.js';
import { drawMobs } from './draw/mob.js';
import { drawBottom } from './draw/hud.js';
import { drawBeams } from './fx/beams.js';
import { drawFX } from './fx/cast.js';
import { drawCallout, SHUFA } from './fx/callout.js';

export function updateVisual(dt){
  if(S.shake>0) S.shake=Math.max(0,S.shake-dt*2.6);
  if(S.hitFlash>0) S.hitFlash=Math.max(0,S.hitFlash-dt*3);
  if(S.pHurt>0) S.pHurt=Math.max(0,S.pHurt-dt);
  if(S.pAnim>0) S.pAnim=Math.max(0,S.pAnim-dt);
  S.mobs.forEach(m=>{
    if(m.hurt>0) m.hurt=Math.max(0,m.hurt-dt);
    if(m.hx) m.hx*=Math.pow(0.0009,dt);
    if(m.atkAnim>0) m.atkAnim=Math.max(0,m.atkAnim-dt);
  });
  if(dt>0){
    S.beams.forEach(b=>{ b.t+=dt; });
    S.beams=S.beams.filter(b=>b.t<b.life);
  }
  S.parts.forEach(p=>{ p.t+=dt; p.vy+=560*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; });
  S.parts=S.parts.filter(p=>p.t<p.life);
  S.floats.forEach(f=>{ f.t+=dt; f.y-=38*dt; });
  S.floats=S.floats.filter(f=>f.t<f.life);
  if(dt>0){
    S.fx.forEach(e=>{ e.t+=dt; });
    S.fx=S.fx.filter(e=>e.t<e.life);
    S.callouts.forEach(c=>{ c.t+=dt; });
    S.callouts=S.callouts.filter(c=>c.t<c.life);
  }
}

export function render(){
  const sx=(Math.random()-0.5)*S.shake*18, sy=(Math.random()-0.5)*S.shake*18;
  ctx.save(); ctx.translate(sx,sy);
  drawBG(); drawBeams(); drawMobs(); drawHero(); drawFX(); drawBottom();
  S.parts.forEach(p=>{ ctx.globalAlpha=Math.max(0,1-p.t/p.life); ctx.fillStyle=p.c; ctx.fillRect(p.x,p.y,p.s,p.s); });
  ctx.globalAlpha=1;
  S.floats.forEach(f=>{
    ctx.globalAlpha=Math.max(0,1-Math.pow(f.t/f.life,2));
    ctx.font = f.shufa ? '400 42px '+SHUFA : (f.big?'bold 22px':'bold 15px')+' monospace';
    ctx.fillStyle=f.c; ctx.textAlign='center';
    if(f.shufa){ ctx.save(); ctx.strokeStyle='rgba(10,8,6,.85)'; ctx.lineWidth=6;
      ctx.lineJoin='round'; ctx.strokeText(f.txt,f.x,f.y); ctx.restore(); }
    ctx.fillText(f.txt,f.x,f.y);
  });
  ctx.globalAlpha=1; ctx.textAlign='left';
  drawCallout();
  if(S.hitFlash>0){ ctx.fillStyle='rgba(200,40,30,'+(S.hitFlash*0.25)+')'; ctx.fillRect(0,0,cv.width,cv.height); }
  ctx.restore();
}
/**
 * 主循环
 * 打击停顿靠 freeze：命中瞬间把 dt 归零，整帧定住，
 * 但绝不能卡住战斗里的 setTimeout —— 那只冻渲染，不冻逻辑。
 */
export function loop(t){
  const raw=Math.min(0.05,(t-S.last)/1000||0); S.last=t;
  let dt=raw;
  if(S.freeze>0){ S.freeze=Math.max(0,S.freeze-raw); dt=0; }   // 命中瞬间：整个世界定住几十毫秒
  updateVisual(dt); render(); requestAnimationFrame(loop);
}

