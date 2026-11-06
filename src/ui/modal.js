/**
 * 弹层：单件详情与熔炉
 *
 * 装备的所有信息都摊在这里 —— 词条、铭文、器灵、凶咒四段分明，
 * 让「这件东西到底值不值得留」变成一个能看懂的决定。
 */

import { $, modalEl, maskEl } from './dom.js';
import { afLabel, modLine } from './format.js';
import { refresh } from './hud.js';
import { G, S } from '../game/state.js';
import { calcStats, relOf } from '../game/stats.js';
import { nmOf, afText, effGrade, cntPre, cntSuf } from '../game/item.js';
import { forge, identify, quenchCost, CAST_COST, GUIDE } from '../game/economy.js';
import { RAR_COL, RAR_NAME, RAR_BG } from '../data/rarity.js';
import { PRE, SUF, PREK, SUFK, TIERC } from '../data/affixes.js';
import { COL } from '../data/elements.js';
import { SK_MAX } from '../game/skills.js';

export function openModal(html){ modalEl().innerHTML=html; maskEl().classList.add('on'); }
export function closeModal(){ S.modalItem=null; maskEl().classList.remove('on'); }

export function showItem(id){
  const it=findItem(id);
  if(!it){ closeModal(); return; }
  S.modalItem=id;
  const inSlot=G.slots.indexOf(it);
  const col=RAR_COL[it.grade];

  /* —— 未鉴：什么都不给看，只给品级 —— */
  if(it.ident===false){
    openModal(
      '<h3 style="color:'+col+'">未鉴之器　<span class="tag" style="color:'+col+'">'+RAR_NAME[it.grade]+'</span></h3>'+
      '<p>器身蒙尘，年月不可辨。只看气机，是件'+RAR_NAME[it.grade]+'。</p>'+
      '<div class="unkrow">'+new Array(RAR_AFFIX[it.grade]).fill('<i>？</i>').join('')+'</div>'+
      '<p class="tip">鉴定之后才知道：它是哪一件古器、属哪一行、带几条词条，'+
        '有没有铭文、有没有器灵 —— 又或者，带着摘不掉的凶咒。</p>'+
      '<div class="row">'+
        '<button onclick="identify('+it.id+')">鉴定 · '+IDENT_COST+' 灵石</button>'+
        '<button onclick="closeModal();sellItem('+it.id+')">卖出 '+sellPrice(it)+'</button>'+
        '<button onclick="closeModal()">关上</button></div>');
    return;
  }

  /* —— 已鉴 —— */
  let html='<h3 style="color:'+col+'">'+it.name+
    '　<span class="tag" style="color:'+col+'">'+RAR_NAME[it.grade]+'</span></h3>'+
    '<p>'+it.x+'行 · '+it.y+' · 词条 '+it.affixes.length+' / 6（前 '+cntPre(it)+' · 后 '+cntSuf(it)+'）'+
    (it.broken?'　<b style="color:var(--cin)">残器 · 按低一阶算</b>':'')+
    (inSlot>=0?'　<b style="color:var(--jade)">已佩「'+['天','人','地'][inSlot]+'位」</b>':'')+'</p>';

  html+='<div class="sec">词　条</div>';
  if(it.affixes.length){
    it.affixes.forEach(a=>{
      const d=afDef(a);
      html+='<div class="afrow"><span style="color:'+d.c+'">'+d.n+' +'+a.v+afUnit(a)+
        '<span style="color:'+TIERC[a.t-1]+';font-weight:700"> T'+a.t+'</span></span>'+
        '<span class="k">'+(a.kind==='pre'?'前缀':'后缀')+'</span></div>';
    });
  } else {
    html+='<div class="sub2">无词条。拿到熔炉里铸一条。</div>';
  }

  if(it.inscr){
    html+='<div class="sec">铭　文</div>'+
      '<div class="modrow" style="color:#a8811f"><b>「'+it.inscr.n+'」</b>　'+
      modLine(it.inscr.up,'up')+'　'+modLine(it.inscr.dn,'dn')+'</div>';
  }
  if(it.spirit){
    html+='<div class="sec">器　灵</div>'+
      '<div class="modrow" style="color:#7a4a8a"><b>「'+it.spirit.n+'」</b>　'+it.spirit.d+'</div>';
  }
  if(it.curse){
    html+='<div class="sec">凶　咒</div>'+
      '<div class="modrow" style="color:#a83b2c"><b>「'+it.curse.n+'」</b>　'+it.curse.d+
      '　<span style="font-size:10px;opacity:.75">摘不掉</span></div>';
  }

  html+='<div class="val"><span>卖出 '+sellPrice(it)+' 灵石</span>'+
    (inSlot<0?'<span>拆解 +'+soulOf(it)+' 器魂</span>':'')+
    '<span>引器 '+GUIDE.s+' 石 · 淬火 20 石起</span></div>';

  html+='<div class="row">'+
    (inSlot>=0
      ? '<button onclick="closeModal();unequip('+inSlot+')">卸下</button>'
      : '<button onclick="closeModal();equipFromBag('+it.id+')">佩上三才</button>')+
    '<button onclick="showForge('+it.id+')" style="border-color:#8a5a1f">开　炉</button>'+
    (inSlot<0?'<button onclick="salvage('+it.id+')">拆解</button>':'')+
    '<button onclick="closeModal();sellItem('+it.id+')">卖出</button>'+
    '<button onclick="closeModal()">关上</button></div>';
  openModal(html);
}

/* ---------- 弹层：熔炉 ---------- */
export function showForge(id){
  const it=findItem(id);
  if(!it){ closeModal(); return; }
  S.modalItem=id;
  const col=RAR_COL[it.grade];

  if(it.ident===false){
    openModal('<h3>熔炉</h3><p>未鉴之物进炉，只会烧成一堆灰。</p>'+
      '<div class="row"><button onclick="showItem('+it.id+')">回去鉴</button>'+
      '<button onclick="closeModal()">关上</button></div>');
    return;
  }

  const full = it.affixes.length>=6 || !freeKind(it);
  let html='<h3 style="color:'+col+'">熔炉 · '+it.name+'</h3>'+
    '<p>灵石 <b>'+G.stones+'</b>　器魂 <b style="color:#7a4a8a">'+G.soul+'</b>　'+
    '词条 '+it.affixes.length+'/6（前 '+cntPre(it)+' · 后 '+cntSuf(it)+'）</p>';

  /* 淬 */
  html+='<div class="sec">淬 · 提一档（你自己挑哪条）</div>';
  if(!it.affixes.length){
    html+='<div class="sub2">还没有词条，先铸。</div>';
  } else {
    it.affixes.slice().sort((a,b)=>b.t-a.t).forEach(a=>{
      const d=afDef(a), idx=it.affixes.indexOf(a), c=quenchCost(a.t);
      if(!c){
        html+='<div class="row2"><span>'+d.n+' +'+a.v+afUnit(a)+
          ' <span style="color:'+TIERC[a.t-1]+';font-weight:700">T1</span></span>'+
          '<span class="sub2">已至顶</span></div>';
        return;
      }
      const ok=G.stones>=c.s && G.soul>=c.o;
      html+='<div class="row2"><span>'+d.n+' +'+a.v+afUnit(a)+
        ' <span style="color:'+TIERC[a.t-1]+';font-weight:700">T'+a.t+'</span>'+
        ' <span class="sub2">→</span> '+
        '<span style="color:'+TIERC[a.t-2]+';font-weight:700">T'+(a.t-1)+'</span></span>'+
        '<button class="sm" '+(ok?'':'disabled')+' onclick="forge('+it.id+',\'q\','+idx+')">'+c.s+'石 + '+c.o+'魂</button></div>';
    });
  }

  /* 铸 */
  html+='<div class="sec">铸 · 随机生一条（赌 T 级）</div>'+
    '<div class="row2"><span class="sub2">品级越高，越容易铸出高 T</span>'+
    '<button class="sm" '+((!full&&G.stones>=CAST_COST)?'':'disabled')+' onclick="forge('+it.id+',\'c\')">'+
    (full?'词条已满':'铸 · '+CAST_COST+' 石')+'</button></div>';

  /* 引 */
  const have=new Set(it.affixes.map(a=>a.k));
  let picks='';
  PREK.concat(SUFK).forEach(k=>{
    if(have.has(k)) return;
    const isPre=!!PRE[k];
    if(isPre && cntPre(it)>=3) return;
    if(!isPre && cntSuf(it)>=3) return;
    const d=PRE[k]||SUF[k];
    const ok=!full && G.stones>=GUIDE.s && G.soul>=GUIDE.o;
    picks+='<button class="sm" '+(ok?'':'disabled')+' onclick="forge('+it.id+',\'g\',\''+k+'\')">'+d.n+'</button>';
  });
  html+='<div class="sec">引 · 定向指定（固定 T'+GUIDE.t+'）</div>'+
    '<div class="row2"><span class="sub2">'+GUIDE.s+' 灵石 + '+GUIDE.o+' 器魂。技阶引不出来，那是天给的。</span></div>'+
    '<div class="pickgrid">'+(picks||'<span class="sub2">没有能引的词条了</span>')+'</div>';

  html+='<div class="row"><button onclick="showItem('+it.id+')">看详情</button>'+
    (G.slots.indexOf(it)<0?'<button onclick="salvage('+it.id+')">拆解 +'+soulOf(it)+'</button>':'')+
    '<button onclick="closeModal()">关上</button></div>';
  openModal(html);
}

/* ---------- 配装 ---------- */
