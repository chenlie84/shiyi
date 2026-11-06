/**
 * 画布内的气血条与护盾条
 */

import { cv, ctx } from '../canvas.js';
import { S } from '../../game/state.js';
import { calcStats } from '../../game/stats.js';

export function drawBottom(){
  const st=calcStats();
  // 抬高一点，底下那 60px 让给技能快捷栏（.hudbar 是 DOM 覆盖层）
  const w=216,x=24,y=cv.height-78;

  // 槽：外框 + 内凹 + 底，做成像素血槽而不是一条扁色块
  ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(x-4,y-4,w+8,16);
  ctx.fillStyle='#191310'; ctx.fillRect(x-2,y-2,w+4,12);
  ctx.fillStyle='#2a1b18'; ctx.fillRect(x,y,w,8);

  const p=Math.min(1,Math.max(0,S.php/st.s.hp));
  const hw=w*p;
  if(hw>0){
    ctx.fillStyle='#3f7a55'; ctx.fillRect(x,y,hw,8);
    ctx.fillStyle='#5cae76'; ctx.fillRect(x,y,hw,4);
    ctx.fillStyle='rgba(206,255,220,.5)'; ctx.fillRect(x,y,hw,1.5);
  }
  // 八等分刻度：看得出还剩几分
  ctx.fillStyle='rgba(0,0,0,.34)';
  for(let k=1;k<8;k++) ctx.fillRect(x+w*k/8,y,1,8);

  // 数字挪到槽的右边一行，省下竖着的一行给技能栏
  const txt='气血 '+Math.max(0,Math.round(Math.min(S.php,st.s.hp)))+' / '+Math.round(st.s.hp);
  ctx.font='10px monospace';
  ctx.fillStyle='rgba(0,0,0,.75)';
  ctx.fillText(txt, x+w+9, y+9);
  ctx.fillStyle='#c9bda2';
  ctx.fillText(txt, x+w+8, y+8);

  if(S.shield>0){
    ctx.fillStyle='#6fa8c9'; ctx.fillRect(x,y-14,w*Math.min(1,S.shield/60),5);
    ctx.fillStyle='#6fa8c9'; ctx.font='9px monospace'; ctx.fillText('护盾 '+Math.round(S.shield), x+2, y-18);
  }
}
