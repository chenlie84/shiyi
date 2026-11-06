/**
 * 掉宝光柱：宝是从地里冒出来的，不是凭空刷在字里
 *
 * 画法要点：径向渐变 + ctx.scale(1, h/R) 竖着拉长 + rect 裁剪，
 * 用 fillRect 直接画会变成一根硬边灰棍。
 */

import { ctx } from '../canvas.js';
import { S } from '../../game/state.js';
import { BEAM_OFF } from '../../config.js';
import { hexA } from '../../core/math.js';
import { rand } from '../../core/rng.js';
import { RAR_COL } from '../../data/rarity.js';
import { burst } from '../fx/particles.js';
import { sfx } from '../sfx.js';

export function spawnBeams(items){
  items.forEach((it,i)=>{
    const g=it.grade, x=S.px+BEAM_OFF[i%3]+(Math.random()-0.5)*14;
    const y=S.py+6;
    const scale = g===1? 0.55 : 1;
    S.beams.push({
      x, y, col:RAR_COL[g], w:(13+g*7)*scale, h:(120+g*46)*scale,
      t:0, life: g>=4? 6.4 : 3.8,
      seed: Math.random()*6.283, g
    });
    burst(x, y-4, 8+g*5, RAR_COL[g]);
  });
  if(S.beams.length>6) S.beams=S.beams.slice(-6);        // 别堆成一堵光墙
  if(items.some(i=>i.grade>=3)) sfx('loot');
}
export function drawBeams(){
  if(!S.beams.length) return;
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  S.beams.forEach(b=>{
    const k=b.t/b.life;
    const fade = k<0.08 ? k/0.08 : (k>0.74 ? (1-k)/0.26 : 1);
    const grow = Math.min(1, k*6);                     // 拔地而起
    const h = b.h*(0.3+0.7*grow);
    const pulse = 0.86+0.14*Math.sin(b.t*8+b.seed);
    // 凡品只留一缕白烟，好货才有颜色 —— 光柱本身就是稀有度的语言
    const dim = b.g===1? 0.34 : b.g===2? 0.72 : 1;
    const A = fade*pulse*dim;
    const R = b.w;
    const cy = b.y-h*0.5;

    // 柔边柱体：圆形径向渐变竖着拉长，再裁掉地面以下
    const glow=(rad, alpha)=>{
      ctx.save();
      ctx.beginPath(); ctx.rect(b.x-rad, b.y-h, rad*2, h); ctx.clip();
      ctx.translate(b.x, cy);
      ctx.scale(1, h/rad);
      const rg=ctx.createRadialGradient(0,0,0, 0,0,rad);
      rg.addColorStop(0,    hexA(b.col, 1.0*alpha));
      rg.addColorStop(0.18, hexA(b.col, 0.80*alpha));
      rg.addColorStop(0.42, hexA(b.col, 0.34*alpha));
      rg.addColorStop(0.70, hexA(b.col, 0.10*alpha));
      rg.addColorStop(1,    hexA(b.col, 0));
      ctx.fillStyle=rg;
      ctx.beginPath(); ctx.arc(0,0,rad,0,7); ctx.fill();
      ctx.restore();
    };
    glow(R*1.7, A*0.34);        // 外晕
    glow(R*0.85, A*0.95);       // 内柱

    // 亮芯
    ctx.fillStyle=hexA('#fff6dc', 0.85*A);
    ctx.fillRect(b.x-1.7, b.y-h*0.95, 3.4, h*0.95);
    ctx.fillStyle=hexA(b.col, 0.95*A);
    ctx.fillRect(b.x-3.2, b.y-h*0.55, 6.4, h*0.55);

    // 地面光斑
    ctx.fillStyle=hexA(b.col, 0.7*A);
    ctx.beginPath(); ctx.ellipse(b.x, b.y+1, R*0.95, R*0.26, 0, 0, 7); ctx.fill();
    ctx.fillStyle=hexA('#fff6dc', 0.55*A);
    ctx.beginPath(); ctx.ellipse(b.x, b.y+1, R*0.34, R*0.11, 0, 0, 7); ctx.fill();

    // 上升的光尘
    for(let i=0;i<7;i++){
      const ph=((b.t*0.5 + i*0.16 + b.seed)%1);
      const yy=b.y-ph*h*0.95;
      const xx=b.x+Math.sin((b.t+i*1.7)*2.2+b.seed)*R*0.7;
      ctx.fillStyle=hexA(b.col, (1-ph)*A);
      ctx.fillRect(xx, yy, 2, 2);
    }
  });
  ctx.restore();
}
