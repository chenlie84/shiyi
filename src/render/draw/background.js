/**
 * 夜山与地面
 */

import { cv, ctx } from '../canvas.js';
import { GROUND } from '../../config.js';

export function drawBG(){
  const g=ctx.createLinearGradient(0,0,0,GROUND);
  g.addColorStop(0,'#14161d'); g.addColorStop(.6,'#1e2028'); g.addColorStop(1,'#2c2a2c');
  ctx.fillStyle=g; ctx.fillRect(0,0,cv.width,GROUND);
  const layers=[{c:'#1b1d24',h:110,o:0},{c:'#22242c',h:78,o:40},{c:'#282a30',h:52,o:90}];
  layers.forEach((L,li)=>{
    ctx.fillStyle=L.c; ctx.beginPath(); ctx.moveTo(-40,GROUND);
    for(let i=0;i<=9;i++){
      const bx=-40+i*80+L.o, bh=L.h*(0.6+((i*47+li*31)%70)/100);
      ctx.lineTo(bx,GROUND-bh); ctx.lineTo(bx+40,GROUND-bh*0.55);
    }
    ctx.lineTo(cv.width+40,GROUND); ctx.fill();
  });
  ctx.save(); ctx.globalAlpha=.85;
  ctx.fillStyle='#efe7cd'; ctx.beginPath(); ctx.arc(520,54,16,0,7); ctx.fill();
  ctx.fillStyle='#14161d'; ctx.beginPath(); ctx.arc(527,48,14,0,7); ctx.fill();
  ctx.restore();
  ctx.fillStyle='#241f1a'; ctx.fillRect(0,GROUND,cv.width,16);
  ctx.fillStyle='#191510'; ctx.fillRect(0,GROUND+16,cv.width,cv.height-GROUND-16);
  ctx.fillStyle='#332b22';
  for(let x=0;x<cv.width;x+=22) ctx.fillRect(x,GROUND,11,2);
  for(let i=0;i<24;i++){
    const x=(i*61+17)%cv.width, h=3+((i*29)%4);
    ctx.fillStyle='#20281f';
    ctx.fillRect(x,GROUND-h,1.5,h); ctx.fillRect(x+3,GROUND-h+1,1.5,h-1);
  }
}
