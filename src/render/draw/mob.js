/**
 * 敌人：山海经里的那几只
 */

import { ctx } from '../canvas.js';
import { S } from '../../game/state.js';
import { layoutMobs } from '../../game/waves.js';

export function drawMobs(){
  const n=S.mobs.length;
  layoutMobs();
  S.mobs.forEach((m,i)=>{
    if(m.dead){
      ctx.save(); ctx.globalAlpha=.22;
    }
    const lunge = m.atkAnim>0? Math.sin((1-m.atkAnim/0.3)*Math.PI)*-26 : 0;
    const P=7.2, x=m.x+(m.hx||0)+lunge, fy=m.y+40;
    // 受击挤压：纵向压扁、横向撑开，比单纯闪白更有"打到肉"的感觉
    const sq=m.hurt>0? Math.sin((m.hurt/0.16)*Math.PI) : 0;
    ctx.save(); ctx.translate(x,fy); ctx.scale(1+sq*0.16, 1-sq*0.15);
    ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0,2,P*2.1,P*.55,0,0,7); ctx.fill();
    ctx.fillStyle='#4a1c17'; ctx.fillRect(-P*1.1,-P*1.6,P*.85,P*1.6); ctx.fillRect(P*.25,-P*1.6,P*.85,P*1.6);
    ctx.fillStyle='#6b2620'; ctx.fillRect(-P*1.7,-P*4.6,P*3.4,P*3);
    ctx.fillStyle='#8a2f2a'; ctx.fillRect(-P*1.9,-P*4.6,P*3.8,P*.7);
    ctx.fillStyle='#5a1f1a'; ctx.fillRect(-P*1.1,-P*6.2,P*2.2,P*1.7);
    ctx.fillStyle='#c9a227';
    ctx.beginPath(); ctx.moveTo(-P*1.1,-P*6.2); ctx.lineTo(-P*1.6,-P*7.4); ctx.lineTo(-P*.6,-P*6.2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(P*1.1,-P*6.2); ctx.lineTo(P*1.6,-P*7.4); ctx.lineTo(P*.6,-P*6.2); ctx.fill();
    ctx.fillStyle='#f0c040'; ctx.fillRect(-P*.7,-P*5.5,P*.45,P*.4); ctx.fillRect(P*.25,-P*5.5,P*.45,P*.4);
    ctx.fillStyle='#e8e0c8'; for(let k=0;k<3;k++) ctx.fillRect(-P*.55+k*P*.45,-P*4.75,P*.22,P*.35);
    if(m.hurt>0){ ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=.45;
      ctx.fillStyle='#a03a2a'; ctx.fillRect(-P*2,-P*7.6,P*4,P*7.7); ctx.restore(); }
    ctx.restore();

    // 血条
    const bw=64, bx=x-bw/2, by=m.y-16;
    ctx.fillStyle='rgba(0,0,0,.7)'; ctx.fillRect(bx-2,by-2,bw+4,9);
    ctx.fillStyle='#3a1a17'; ctx.fillRect(bx,by,bw,6);
    ctx.fillStyle='#c9473a'; ctx.fillRect(bx,by,Math.max(0,m.hp/m.maxhp)*bw,6);
    ctx.fillStyle='#c9bda2'; ctx.font='9px monospace'; ctx.textAlign='center';
    ctx.fillText(m.name+' '+Math.max(0,Math.round(m.hp)), x, by-5);
    ctx.textAlign='left';
    if(m.dead) ctx.restore();
  });
}
