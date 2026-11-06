/**
 * 画布内的气血条与护盾条
 */

import { ctx } from '../canvas.js';
import { S } from '../../game/state.js';
import { calcStats } from '../../game/stats.js';

export function drawBottom(){
  const st=calcStats();
  const w=216,x=24,y=456;
  ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(x-3,y-3,w+6,14);
  ctx.fillStyle='#2a1b18'; ctx.fillRect(x,y,w,8);
  ctx.fillStyle='#4f9e73'; ctx.fillRect(x,y,w*Math.min(1,Math.max(0,S.php/st.s.hp)),8);
  ctx.fillStyle='#c9bda2'; ctx.font='10px monospace';
  ctx.fillText('气血 '+Math.max(0,Math.round(Math.min(S.php,st.s.hp)))+' / '+Math.round(st.s.hp), x, y+22);
  if(S.shield>0){
    ctx.fillStyle='#6fa8c9'; ctx.fillRect(x,y-14,w*Math.min(1,S.shield/60),5);
    ctx.fillStyle='#6fa8c9'; ctx.font='9px monospace'; ctx.fillText('护盾 '+Math.round(S.shield), x+2, y-18);
  }
}
