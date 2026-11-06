/**
 * 落宝浮层：右上角那一摞
 *
 * 不随换波清空，最多留 5 张，随时能点开看 —— 掉宝得看得见、留得住。
 */

import { $ } from './dom.js';
import { S } from '../game/state.js';
import { RAR_COL, RAR_NAME } from '../data/rarity.js';
import { nmOf } from '../game/item.js';
import { sfx } from '../render/sfx.js';

export function lootCard(it){
  const col=RAR_COL[it.grade];
  const unid = it.ident===false;
  let hint='';
  if(unid){
    hint='<span class="hint" style="color:'+col+'">蒙尘 · 待鉴</span>';
  }else if(it.curse){
    hint='<span class="hint" style="color:#c9862f">煞气外溢</span>';
  }else if(it.spirit){
    hint='<span class="hint" style="color:#a58ac0">灵息流转</span>';
  }else if(it.inscr){
    hint='<span class="hint" style="color:#c9a227">铭痕隐现</span>';
  }
  return '<div class="lootcard" style="border-color:'+col+'" onclick="showItem('+it.id+')">'+
    '<b style="color:'+col+'">'+RAR_NAME[it.grade]+'</b>'+
    '<span style="color:#e8dfc9">'+(unid?'未鉴之器':it.name)+'</span>'+hint+'</div>';
}
export function showLoot(items){
  const box=$('loot');
  box.innerHTML=items.map(lootCard).join('')+box.innerHTML;
  while(box.children.length>5) box.removeChild(box.lastChild);   // 留着，随时点开看
  const top=Math.max.apply(null,items.map(i=>i.grade));
  if(top>=4){ S.shake=Math.max(S.shake,1.0); S.hitFlash=0.55; sfx('win'); }  // 仙品以上：整屏震一下
  else if(top>=3){ S.shake=Math.max(S.shake,0.6); sfx('crit'); }
}
export function clearLoot(){ $('loot').innerHTML=''; }
