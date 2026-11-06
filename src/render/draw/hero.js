/**
 * 主角：一个拿剑的像素小人
 */

import { ctx } from '../canvas.js';
import { S } from '../../game/state.js';
import { GROUND, PLAYER_X } from '../../config.js';

export function drawHero(){
  const P=8.5, x=PLAYER_X+(S.pAnim>0?Math.sin((1-S.pAnim/0.3)*Math.PI)*34:0);
  ctx.save(); ctx.translate(x,GROUND);
  ctx.fillStyle='rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0,2,P*2.2,P*0.6,0,0,7); ctx.fill();
  ctx.fillStyle='#20293a'; ctx.fillRect(-P*1.3,-P*2,P*1,P*2); ctx.fillRect(P*0.3,-P*2,P*1,P*2);
  ctx.fillStyle='#2f4055'; ctx.fillRect(-P*1.6,-P*4.8,P*3.2,P*3);
  ctx.fillStyle='rgba(255,255,255,.18)'; ctx.fillRect(-P*.7,-P*4.8,P*1.4,P*1.1);
  ctx.fillStyle='#8a7a4a'; ctx.fillRect(-P*1.6,-P*2.6,P*3.2,P*.45);
  ctx.fillStyle='#e6cdaa'; ctx.fillRect(-S,-P*6.4,P*2,P*1.7);
  ctx.fillStyle='#241f18'; ctx.fillRect(-P*1.15,-P*6.8,P*2.3,P*.8);
  ctx.fillStyle='#1e1a14'; ctx.fillRect(-P*.5,-P*5.7,P*.35,P*.4); ctx.fillRect(P*.2,-P*5.7,P*.35,P*.4);
  ctx.fillStyle='#cfc7b2'; ctx.fillRect(P*1.7,-P*5.4,P*.3,P*3.4);
  if(S.pHurt>0){ ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=.42;
    ctx.fillStyle='#8a4a3a'; ctx.fillRect(-P*1.8,-P*7,P*3.9,P*7.1); ctx.restore(); }
  ctx.restore();
  if(S.shield>0){
    ctx.save(); ctx.strokeStyle='rgba(120,180,220,.75)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(x,GROUND-28,34,42,0,0,7); ctx.stroke(); ctx.restore();
  }
}
