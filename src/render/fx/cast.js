/**
 * 施法特效：五行 x 技能类型
 *
 * 全部 self-made，无外部素材。
 * 暗场里特效要当"光"来画，所以整体走 lighter 混合；
 * 但土系的石头是实物，必须临时切回 source-over，否则暗底会被吃掉。
 */

import { cv, ctx } from '../canvas.js';
import { S } from '../../game/state.js';
import { GROUND, PLAYER_X } from '../../config.js';
import { hexA } from '../../core/math.js';
import { rand } from '../../core/rng.js';
import { COL_L, ELEM_FX } from '../palette.js';
import { alive } from '../../game/waves.js';


export function spawnCastFX(sk){
  const F=ELEM_FX[sk.elem]||ELEM_FX.木;
  const tgt=alive();
  const px=PLAYER_X+30, py=GROUND-64;
  // 水系是贴着地荡开的，别的系是打在怪身上
  const fy = F.k==='ring'? GROUND-2 : GROUND-46;

  // 自身类：护罩 / 疗伤 / 增益，各给一套
  if(sk.kind==='heal'||sk.kind==='shield'||sk.kind==='buff'){
    if(sk.kind==='shield'){
      S.fx.push({k:'dome', x:PLAYER_X, y:GROUND, col:'#7fc0ff', t:0, life:0.92, r:46});
    } else {
      const col = sk.kind==='heal'? '#8fe0a8' : '#ffd166';
      S.fx.push({k:'aura', x:PLAYER_X, y:GROUND, col, t:0, life:0.86,
               r: sk.kind==='buff'?58:48, leaf: sk.kind==='heal'});
      if(sk.kind==='buff') S.fx.push({k:'spiral', x:PLAYER_X, y:GROUND, col:'#ffd166', t:0, life:0.72});
    }
    return;
  }

  // 全体技：一道弧形气浪推过去，每只怪身上各自开花
  if(sk.kind==='aoe'){
    S.fx.push({k:'wave', x:PLAYER_X, y:GROUND-56, col:F.col, t:0, life:0.62});
    tgt.forEach(m=>{
      S.fx.push({k:'flash', x:m.x, y:GROUND-52, col:F.col, t:0, life:0.26});
      S.fx.push({k:F.k, x:m.x, y:fy, col:F.col, t:0, life:0.56, s:1.15});
    });
    return;
  }

  // 单体技：一道锋芒从人飞向怪，再在怪身上炸开
  const t0=tgt[0];
  if(t0){
    S.fx.push({k:'trail', x1:px, y1:py, x2:t0.x, y2:GROUND-52, col:F.col, t:0, life:0.24});
    S.fx.push({k:'flash', x:t0.x, y:GROUND-52, col:F.col, t:0, life:0.26});
    S.fx.push({k:F.k, x:t0.x, y:fy, col:F.col, t:0, life:0.58, s:1});
  }
}

export function drawFX(){
  if(!S.fx.length) return;
  ctx.save();
  ctx.globalCompositeOperation='lighter';   // 特效当光来画，暗场上才亮得起来
  ctx.lineCap='round';
  S.fx.forEach(e=>{
    const p=Math.min(1,e.t/e.life);
    const a=Math.max(0,1-p*p);

    if(e.k==='flash'){
      // 命中核心爆闪：一帧白，立刻转成本体的颜色
      const r=12+p*54;
      const g=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,r);
      g.addColorStop(0,   hexA('#ffffff',(1-p)*0.95));
      g.addColorStop(0.28,hexA(e.col,(1-p)*0.72));
      g.addColorStop(0.66,hexA(e.col,(1-p)*0.24));
      g.addColorStop(1,   hexA(e.col,0));
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(e.x,e.y,r,0,7); ctx.fill();
      // 一圈被撞开的冲击环
      ctx.strokeStyle=hexA('#ffffff',(1-p)*0.7);
      ctx.lineWidth=2.4*(1-p)+0.5;
      ctx.beginPath(); ctx.arc(e.x,e.y,6+p*36,0,7); ctx.stroke();

    } else if(e.k==='aura'){
      // 自身增益：脚下法阵 + 向上收束的光束 + 上浮符粒
      for(let i=0;i<2;i++){
        const rr=e.r*(0.42+p*0.72+i*0.26);
        ctx.strokeStyle=hexA(e.col, a*(i?0.38:0.95));
        ctx.lineWidth=i?1.4:3;
        ctx.beginPath(); ctx.ellipse(e.x,e.y,rr,rr*0.28,0,0,7); ctx.stroke();
      }
      const hh=124*Math.min(1,p*1.65);
      const bw=e.r*0.70, tw=e.r*0.22;
      const cone=(k,al)=>{
        const lg=ctx.createLinearGradient(0,e.y,0,e.y-hh);
        lg.addColorStop(0,   hexA(e.col,a*al));
        lg.addColorStop(0.45,hexA(e.col,a*al*0.34));
        lg.addColorStop(1,   hexA(e.col,0));
        ctx.fillStyle=lg;
        ctx.beginPath();
        ctx.moveTo(e.x-bw*k, e.y);
        ctx.quadraticCurveTo(e.x-bw*k*0.62, e.y-hh*0.6, e.x-tw*k, e.y-hh);
        ctx.lineTo(e.x+tw*k, e.y-hh);
        ctx.quadraticCurveTo(e.x+bw*k*0.62, e.y-hh*0.6, e.x+bw*k, e.y);
        ctx.closePath(); ctx.fill();
      };
      cone(1.18, 0.20);   // 外晕，宽而淡
      cone(0.62, 0.58);   // 内芯，窄而亮
      ctx.fillStyle=hexA('#ffffff',a*0.13);
      ctx.beginPath();
      ctx.moveTo(e.x-bw*0.34, e.y);
      ctx.quadraticCurveTo(e.x-bw*0.22, e.y-hh*0.6, e.x-tw*0.4, e.y-hh);
      ctx.lineTo(e.x+tw*0.4, e.y-hh);
      ctx.quadraticCurveTo(e.x+bw*0.22, e.y-hh*0.6, e.x+bw*0.34, e.y);
      ctx.closePath(); ctx.fill();
      // 三五道竖直光线，让光柱立起来
      for(let i=0;i<4;i++){
        const ox=(i-1.5)*e.r*0.34;
        const lh=hh*(0.55+0.28*Math.sin(i*2.1+1.1));
        const lg2=ctx.createLinearGradient(0,e.y,0,e.y-lh);
        lg2.addColorStop(0,hexA(i%2?'#ffffff':e.col,a*0.5));
        lg2.addColorStop(1,hexA(e.col,0));
        ctx.fillStyle=lg2;
        ctx.fillRect(e.x+ox-1, e.y-lh, 2, lh);
      }
      // 上浮符粒：疗伤飘叶，增益则是亮点
      for(let i=0;i<14;i++){
        const ph=((p*1.5+i*0.083)%1);
        const xx=e.x+Math.sin(i*1.9+ph*3.6)*e.r*0.82;
        const yy=e.y-ph*132;
        if(e.leaf){
          ctx.save(); ctx.translate(xx,yy); ctx.rotate(ph*3.2+i);
          ctx.fillStyle=hexA(i%3?'#a8f0b8':'#e8ffe8',(1-ph)*a*0.95);
          ctx.fillRect(-3.2,-2.0,6.4,4.0);
          ctx.restore();
        } else {
          const s=2+(i%3);
          ctx.fillStyle=hexA(i%2?'#ffffff':e.col,(1-ph)*a);
          ctx.fillRect(xx-s/2,yy-s/2,s,s);
        }
      }

    } else if(e.k==='dome'){
      // 护罩：扣在身上的半圆穹顶，带两道能量纹
      const R=e.r||48;
      const gr=Math.min(1,p*2.2);
      const rr=R*(0.6+gr*0.42);
      const gg=ctx.createRadialGradient(e.x,e.y-6,rr*0.2,e.x,e.y-6,rr);
      gg.addColorStop(0,hexA(e.col,a*0.05));
      gg.addColorStop(0.72,hexA(e.col,a*0.16));
      gg.addColorStop(1,hexA(e.col,a*0.42));
      ctx.fillStyle=gg;
      ctx.beginPath(); ctx.arc(e.x,e.y-6,rr,Math.PI,Math.PI*2); ctx.fill();
      ctx.strokeStyle=hexA(e.col,a*0.95);
      ctx.lineWidth=2.6*(1-p*0.4);
      ctx.beginPath(); ctx.arc(e.x,e.y-6,rr,Math.PI,Math.PI*2); ctx.stroke();
      for(let i=1;i<=2;i++){
        ctx.strokeStyle=hexA(e.col,a*0.45/i);
        ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.arc(e.x,e.y-6,rr*(1-i*0.2),Math.PI,Math.PI*2); ctx.stroke();
      }
      // 地面支撑环
      ctx.strokeStyle=hexA(e.col,a*0.85);
      ctx.lineWidth=2.6*(1-p*0.4);
      ctx.beginPath(); ctx.ellipse(e.x,e.y,rr*1.02,rr*0.24,0,0,7); ctx.stroke();

    } else if(e.k==='spiral'){
      // 绕身盘旋的符粒
      for(let i=0;i<10;i++){
        const ph=((p*1.2+i*0.1)%1);
        const ang=ph*7.6+i*0.628;
        const rr=27+ph*20;
        const xx=e.x+Math.cos(ang)*rr;
        const yy=e.y-16-ph*92+Math.sin(ang)*7;
        const s=3;
        ctx.fillStyle=hexA(i%3?'#ffd166':'#fff3c0',(1-ph)*a);
        ctx.fillRect(xx-s/2,yy-s/2,s,s);
      }

    } else if(e.k==='wave'){
      // 全体技：一道弧形气浪横扫过去（外晕 / 浪芯 / 白刃 三层同心）
      const R=76;
      const x=e.x+(cv.width-e.x+90)*Math.min(1.06,p*1.32);
      const cx=x-R, A=-0.95, B=0.95;
      const band=(w,col)=>{
        ctx.strokeStyle=col; ctx.lineWidth=w*(1-p*0.5);
        ctx.beginPath(); ctx.arc(cx, e.y, R, A, B); ctx.stroke();
      };
      band(26, hexA(e.col,a*0.30));
      band(11, hexA(e.col,a*0.78));
      band(3.4,hexA('#ffffff',a*0.95));

    } else if(e.k==='trail'){
      // 单体：锋芒破空，身后碎成一道残影
      const q=Math.min(1,p*1.9);
      const x=e.x1+(e.x2-e.x1)*q, y=e.y1+(e.y2-e.y1)*q;
      for(let i=1;i<=8;i++){
        const k=Math.max(0,q-i*0.082);
        const xx=e.x1+(e.x2-e.x1)*k;
        const yy=e.y1+(e.y2-e.y1)*k+Math.sin(i*2.2+p*11)*2.4;
        const s=Math.max(1,5.2-i*0.55);
        ctx.fillStyle=hexA(i%2?'#ffffff':e.col,(1-p)*(1-i/9.5)*0.95);
        ctx.fillRect(xx-s/2,yy-s/2,s,s);
      }
      const rg=ctx.createRadialGradient(x,y,0,x,y,14);
      rg.addColorStop(0,hexA('#ffffff',a));
      rg.addColorStop(1,hexA(e.col,0));
      ctx.fillStyle=rg;
      ctx.beginPath(); ctx.arc(x,y,14,0,7); ctx.fill();

    } else if(e.k==='slash'){
      // 金：两道交错的月牙刀光，刃口走白
      const R=e.s? 64:58;
      // [倾角, 起始角, 方向, 半径系数, 延迟, 强度]
      [[-0.60,-1.30, 1, 1.00, 0.00, 1.0],
       [ 0.70, 1.22,-1, 0.88, 0.13, 0.62]].forEach(([rot,g0,dir,rk,delay,k])=>{
        const p2=Math.max(0,Math.min(1,(p-delay)*2.1));
        if(p2<=0) return;
        const g1=g0+dir*1.62*p2;
        ctx.save();
        ctx.translate(e.x,e.y);
        ctx.rotate(rot);
        // 分三段画，刃尾自然收细
        for(let sg=0;sg<3;sg++){
          const s0=g0+dir*1.62*p2*(sg/3), s1=g0+dir*1.62*p2*((sg+1)/3);
          const w=1-sg*0.30;
          ctx.strokeStyle=hexA(e.col,(1-p)*0.85*k*w);
          ctx.lineWidth=9*(1-p*0.55)*k*w;
          ctx.beginPath(); ctx.ellipse(0,0,R*rk,R*rk*0.26,0,s0,s1,dir<0); ctx.stroke();
          ctx.strokeStyle=hexA('#ffffff',(1-p)*0.95*k*w);
          ctx.lineWidth=2.3*(1-p*0.5)*w;
          ctx.beginPath(); ctx.ellipse(0,0,R*rk,R*rk*0.26,0,s0,s1,dir<0); ctx.stroke();
        }
        ctx.restore();
      });
      // 迸出的火星
      for(let i=0;i<5;i++){
        const ang=-2.3+i*0.96, d=16+p*50;
        ctx.fillStyle=hexA('#ffffff',(1-p)*0.8);
        ctx.fillRect(e.x+Math.cos(ang)*d-1.5, e.y+Math.sin(ang)*d-1.5, 3,3);
      }

    } else if(e.k==='vine'){
      // 木：地里抽出的藤，带斜叶
      for(let i=0;i<4;i++){
        const ox=e.x-21+i*14;
        const h=76*Math.min(1,p*1.55)*(0.78+0.22*Math.sin(i*2.3));
        ctx.fillStyle=hexA(e.col,a*0.26);
        ctx.beginPath(); ctx.ellipse(ox,e.y+7,14,4,0,0,7); ctx.fill();
        ctx.strokeStyle=hexA(e.col,a*0.95);
        ctx.lineWidth=4.2*(1-p*0.32);
        ctx.beginPath();
        for(let k=0;k<=10;k++){
          const yy=e.y-h*k/10;
          const xx=ox+Math.sin(k*0.74+i*1.7+p*4.6)*8.5*(1-k/13);
          k?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);
        }
        ctx.stroke();
        for(let k=2;k<=4;k++){
          const yy=e.y-h*k/4.6;
          const xx=ox+Math.sin((k*2.2)*0.74+i*1.7+p*4.6)*8.5;
          ctx.save(); ctx.translate(xx,yy); ctx.rotate(0.72);
          ctx.fillStyle=hexA('#c8ffd2',a*0.9);
          ctx.fillRect(-3.6,-2.6,7.2,5.2);
          ctx.restore();
        }
      }

    } else if(e.k==='ring'){
      // 水：地面涟漪荡开，水珠被激起
      for(let i=0;i<3;i++){
        const pp=Math.max(0,Math.min(1,(p-i*0.13)/0.85));
        if(pp<=0) continue;
        const r=10+pp*58;
        ctx.strokeStyle=hexA(i===0?'#e6f6ff':e.col,(1-pp)*0.9);
        ctx.lineWidth=3.4*(1-pp)+0.6;
        ctx.beginPath(); ctx.ellipse(e.x,e.y+2,r,r*0.32,0,0,7); ctx.stroke();
      }
      // 水幕：从怪身上垂下的一段帘
      const cur=1-Math.min(1,p*2.2);
      if(cur>0.02){
        ctx.fillStyle=hexA(e.col,cur*0.52);
        ctx.beginPath(); ctx.ellipse(e.x,e.y-40,21,52,0,0,7); ctx.fill();
        ctx.fillStyle=hexA('#dff2ff',cur*0.38);
        ctx.beginPath(); ctx.ellipse(e.x,e.y-48,9,40,0,0,7); ctx.fill();
        // 两道掠过身体的横波
        for(let i=0;i<2;i++){
          const yy=e.y-26-i*34+Math.sin(p*7+i)*5;
          ctx.strokeStyle=hexA('#e6f6ff',cur*0.6*(1-i*0.25));
          ctx.lineWidth=2.2-i*0.6;
          ctx.beginPath(); ctx.ellipse(e.x,yy,26-i*4,6-i,0,0,7); ctx.stroke();
        }
      }
      for(let i=0;i<10;i++){
        const ph=((p*1.15+i*0.1)%1);
        const vx=Math.cos(i*2.1)*28, vy=Math.sin(i*2.1)*8;
        const xx=e.x+vx*ph;
        const yy=e.y-(58*ph-76*ph*ph)*1.15+vy*ph;
        const s=2+(i%3);
        ctx.fillStyle=hexA(i%2?'#e6f6ff':e.col,(1-ph)*a);
        ctx.fillRect(xx-s/2,yy-s/2,s,s);
      }

    } else if(e.k==='flame'){
      // 火：三层火柱 + 地表热斑 + 飞散火星
      const gg=ctx.createRadialGradient(e.x,e.y+12,0,e.x,e.y+12,38);
      gg.addColorStop(0,hexA('#ffb066',a*0.55));
      gg.addColorStop(1,hexA('#ff6a3c',0));
      ctx.fillStyle=gg;
      ctx.beginPath(); ctx.ellipse(e.x,e.y+12,38,13,0,0,7); ctx.fill();
      const H=88*Math.min(1,0.42+p*1.45);
      const CS=['#ff6a3c','#ffa24f','#ffe9a8'];
      for(let i=0;i<3;i++){
        const w=(22-i*5.6)*(1-p*0.22);
        const h=H*(1-i*0.17);
        const lg=ctx.createLinearGradient(e.x,e.y+9,e.x,e.y-h);
        lg.addColorStop(0,hexA(CS[i],a*(0.66-i*0.1)));
        lg.addColorStop(1,hexA(CS[i],0));
        ctx.fillStyle=lg;
        ctx.beginPath();
        ctx.moveTo(e.x-w, e.y+9);
        ctx.quadraticCurveTo(e.x-w*0.62, e.y-h*0.58, e.x+Math.sin(p*6.5+i*1.7)*7, e.y-h);
        ctx.quadraticCurveTo(e.x+w*0.62, e.y-h*0.58, e.x+w, e.y+9);
        ctx.closePath(); ctx.fill();
      }
      // 柱顶飘开的三缕舌尖
      for(let i=0;i<3;i++){
        const ph=((p*1.1+i*0.22)%1);
        const tx=e.x+(i-1)*11+Math.sin(p*5+i*2)*8;
        const ty=e.y-H-ph*34;
        const s=Math.max(1.5,5*(1-ph));
        ctx.fillStyle=hexA(i%2?'#ffe9a8':'#ff8a5c',(1-ph)*a*0.9);
        ctx.fillRect(tx-s/2,ty-s,s,s*1.6);
      }
      for(let i=0;i<9;i++){
        const ph=((p*1.3+i*0.11)%1);
        const xx=e.x+Math.sin(i*2.1+p*4.2)*24*(1-ph*0.45);
        const yy=e.y+6-ph*104;
        const s=Math.max(1.5,4.6*(1-ph));
        ctx.fillStyle=hexA(i%2?'#ffe9a8':'#ff8a5c',(1-ph)*a);
        ctx.fillRect(xx-s/2,yy-s/2,s,s);
      }

    } else if(e.k==='quake'){
      // 土：地裂 + 一块巨石从天砸下 + 落地碎石四溅
      const gy=e.y+46;                       // 地面
      ctx.strokeStyle=hexA(e.col,a*0.85);
      ctx.lineWidth=2.8*(1-p*0.35);
      for(let i=0;i<2;i++){
        const ox=e.x+(i?12:-12);
        ctx.beginPath();
        ctx.moveTo(ox-30,gy-2);
        for(let k=0;k<5;k++) ctx.lineTo(ox-30+(k+1)*12, gy-2+(k%2?5:-4));
        ctx.stroke();
      }
      // 主石：加速下坠
      const fp=Math.min(1,p*1.55);
      const by=gy-16-132*(1-fp*fp);
      const S=27;
      ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=Math.min(1,p*6);
      const tg=ctx.createLinearGradient(0,by-58,0,by);
      tg.addColorStop(0,'rgba(196,168,96,0)');
      tg.addColorStop(1,'rgba(150,124,66,'+(a*0.55).toFixed(3)+')');
      ctx.fillStyle=tg;
      ctx.fillRect(e.x-S*0.22, by-58, S*0.44, 58);
      ctx.fillStyle='#241d12';
      ctx.fillRect(e.x-S/2,by-S/2,S,S);
      ctx.fillStyle='#7d6a44';
      ctx.fillRect(e.x-S/2+1,by-S/2+1,S-2,S-3);
      ctx.fillStyle='#a89066';
      ctx.fillRect(e.x-S/2+1,by-S/2+1,S*0.64,S*0.52);
      ctx.fillStyle='#d9c48a';
      ctx.fillRect(e.x-S/2+1,by-S/2+1,S*0.42,S*0.22);
      ctx.fillStyle='#241d12';
      ctx.fillRect(e.x-2,by-S*0.1,S*0.30,3);      // 石上的一道裂
      ctx.globalAlpha=1;
      ctx.globalCompositeOperation='lighter';
      // 砸到地上的那一刻
      if(fp>0.9){
        const q=(fp-0.9)/0.1;
        ctx.strokeStyle=hexA('#ffe9a8',(1-q)*0.95);
        ctx.lineWidth=3.4*(1-q)+0.8;
        ctx.beginPath(); ctx.ellipse(e.x,gy,14+q*52,4+q*15,0,0,7); ctx.stroke();
        ctx.strokeStyle=hexA(e.col,(1-q)*0.5);
        ctx.lineWidth=2;
        ctx.beginPath(); ctx.ellipse(e.x,gy,(14+q*52)*0.6,(4+q*15)*0.6,0,0,7); ctx.stroke();
        for(let i=0;i<9;i++){
          const ang=-Math.PI*(0.08+0.84*(i/8));
          const d=q*52;
          const px=e.x+Math.cos(ang)*d, py=gy+Math.sin(ang)*d*0.5;
          ctx.fillStyle=hexA(i%2?'#ffe9a8':'#c8b070',(1-q)*0.95);
          ctx.fillRect(px-2,py-2,4,4);
        }
      }
    }
  });
  ctx.restore();
}
