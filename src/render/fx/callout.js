/**
 * 招式题字：毛笔字，斜着题
 *
 * 字体是马善政毛笔楷书（Google Fonts · OFL），子集化后 base64 内嵌在 CSS 里。
 * 注意：不能用 strokeText 描边 —— 会把细笔锋糊成黑块，要用 shadowBlur 投影。
 */

import { ctx } from '../canvas.js';
import { S } from '../../game/state.js';
import { GROUND } from '../../config.js';
import { hexA } from '../../core/math.js';
import { COL_L } from '../palette.js';

export const SHUFA = '"Shufa","STKaiti","KaiTi","Songti SC",serif';

export function castCallout(txt, elem){
  // 同一招连放就重题一次，别把同名字排成三行
  S.callouts = S.callouts.filter(c=>c.txt!==txt);
  S.callouts.push({txt, t:0, life:1.18, x:114, y:GROUND-188,
    col: elem? (COL_L[elem]||'#f0e6c0') : '#f0e6c0'});
  if(S.callouts.length>2) S.callouts=S.callouts.slice(-2);
}
export function drawCallout(){
  if(!S.callouts.length) return;
  ctx.save();
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  S.callouts.forEach(c=>{
    const p=Math.min(1,c.t/c.life);
    const n=[...c.txt].length;
    const size = n>=5? 32 : n===4? 37 : 41;
    const sc = p<0.13 ? 1.5-(p/0.13)*0.5 : 1;
    const rise = p*28;
    const a = p<0.13 ? p/0.13 : (p>0.6 ? Math.max(0,(1-p)/0.4) : 1);
    ctx.save();
    ctx.translate(c.x, c.y-rise);
    ctx.rotate(-0.135);                       // 斜着题
    ctx.scale(sc,sc);
    ctx.font='400 '+size+'px '+SHUFA;
    ctx.lineJoin='round';
    // 先落一层投影（不描边，描边会吃掉毛笔的细笔锋）
    ctx.shadowColor='rgba(0,0,0,.9)';
    ctx.shadowBlur=9; ctx.shadowOffsetX=2.5; ctx.shadowOffsetY=3;
    ctx.fillStyle=hexA(c.col, a);
    ctx.fillText(c.txt,0,0);
    // 再补一遍本体，边缘更干净
    ctx.shadowBlur=0; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;
    ctx.fillStyle=hexA(c.col, a);
    ctx.fillText(c.txt,0,0);
    ctx.restore();
  });
  ctx.restore();
}
