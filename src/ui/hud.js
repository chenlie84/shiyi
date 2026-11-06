/**
 * 主界面刷新：顶栏数字、三才槽、属性、七星、行囊
 *
 * 这是 DOM 侧唯一的"全量重绘"入口。game 层通过 presenter.refresh() 触发它。
 */

import { $ } from './dom.js';
import { afLabel } from './format.js';
import { G, S } from '../game/state.js';
import { calcStats, xpNeed, relOf } from '../game/stats.js';
import { nmOf, afText, effGrade } from '../game/item.js';
import {
  buildSkills, isRune, resolve, runeTakenBy, linkCount,
  skillPower, pruneLinks, STARS as SK_STARS,
} from '../game/skills.js';
import { IDENT_COST } from '../game/economy.js';
import { roomName, isBossRoom, toBoss } from '../game/dungeon.js';
import { ROOMS, BOSS_ROOM } from '../data/dungeon.js';
import { MULT, COL } from '../data/elements.js';
import { PATH_N } from '../data/spells.js';
import { RAR_COL, RAR_NAME } from '../data/rarity.js';
import { renderSkillBar } from './skillbar.js';

/** 今天的日子：公历 + 星期。界面上得有个"现在是哪天"的锚 */
export function dateText(d){
  const D = d || new Date();
  const wk = ['日','一','二','三','四','五','六'][D.getDay()];
  return (D.getMonth()+1) + '月' + D.getDate() + '日　周' + wk;
}

export function refresh(){
  const st=calcStats();
  const e=st.e;

  $('date').textContent=dateText();
  $('floor').textContent=G.floor;
  $('floor').title = '最深到过第 ' + (G.best || 0) + ' 层';
  $('turn').textContent=G.turn;
  $('roomname').textContent=roomName();
  // 一层的路线图：走过的填实，当前这一间红着，妖王殿是菱形
  (()=>{
    const rb=$('rooms');
    if(!rb) return;
    let h='';
    for(let i=1;i<=BOSS_ROOM;i++){
      let cls = i===BOSS_ROOM? 'boss' : 'tb';
      if(i<G.room) cls+=' cl';
      if(i===G.room) cls+=' cur';
      h+='<i class="'+cls+'"></i>';
    }
    rb.innerHTML=h;
    rb.title = isBossRoom()
      ? '妖王殿 —— 这一层就剩它了'
      : '一层 '+ROOMS+' 间丹房，还差 '+toBoss()+' 间到妖王殿';
  })();
  $('stones').textContent=G.stones;
  $('soul').textContent=G.soul;
  $('dexn').textContent=Object.keys(G.dex).length;
  $('lv').textContent=G.lv;
  $('xptxt').textContent=G.xp+'/'+xpNeed(G.lv);
  $('pts').textContent=G.pts;

  // 槽
  const box=$('slots'); box.innerHTML='';
  for(let i=0;i<3;i++){
    if(i>0){
      const r=(G.slots[i-1]&&G.slots[i])?relOf(G.slots[i-1],G.slots[i]):'—';
      const d=document.createElement('div'); d.className='conn';
      d.innerHTML='<div class="r" style="color:'+(r==='生'?'var(--gold)':r==='克'?'var(--cin)':'var(--ink2)')+'">'+r+'</div>'+
        '<div style="color:var(--ink2)">'+(r==='—'?'':('×'+MULT[r]))+'</div>';
      box.appendChild(d);
    }
    const it=G.slots[i];
    const d=document.createElement('div'); d.className='slot'+(it?' filled':'');
    if(it){
      const col=RAR_COL[it.grade];
      d.style.borderColor=col;
      d.title=nmOf(it)+'　'+RAR_NAME[it.grade]+(it.broken?'（残）':'')+
        (it.ident===false?'\n未鉴，不入属性':'\n'+afText(it));
    }
    const unid = it && it.ident===false;
    d.innerHTML='<div class="pos">'+['天','人','地'][i]+'位</div>'+
      (it? '<div class="el" style="color:'+(unid?'var(--line)':COL[it.x])+'">'+(unid?'？':it.x)+'</div>'+
           '<div class="fx" style="color:var(--ink);font-size:9.5px;font-weight:700">'+(unid?'未鉴':(it.base||''))+'</div>'+
           '<div class="fx" style="color:'+RAR_COL[it.grade]+';font-weight:700">'+RAR_NAME[it.grade]+(it.broken?'·残':'')+'</div>'+
           '<div class="fx" style="opacity:.8">'+(unid?'待　鉴':'词 '+it.affixes.length+' / 6')+'</div>'
         : '<div class="el" style="color:var(--line)">空</div><div class="fx">　</div>');
    if(it) d.style.borderStyle='solid';
    d.onclick=()=>{ if(G.slots[i]) showItem(G.slots[i].id); };
    box.appendChild(d);
  }

  const mulEl=$('mul');
  mulEl.textContent='×'+e.total.toFixed(2);
  mulEl.style.color=e.total>=4?'var(--gold)':e.total>=2?'var(--jade)':e.total>=1?'var(--ink)':'var(--cin)';
  $('rels').innerHTML = e.partial? '需三件成阵'
    : (e.r1+' → '+e.r2) + (e.total<1? ' <b style="color:var(--cin)">相克压制，换掉克位</b>':'');
  $('school').textContent=(()=>{
    if(e.partial) return '未成阵';
    const {r1,r2}=e;
    if(r1==='生'&&r2==='生') return '周天三生链';
    if(r1==='克'&&r2==='生') return '煞爆流';
    if(r1==='克'&&r2==='克') return '魔道·双滞';
    if(r1==='生'&&r2==='克') return '先扬后抑';
    if(r1==='克'||r2==='克') return '蓄煞·残应';
    if(r1==='比和'&&r2==='比和') return '一元纯体';
    if(r1==='生'||r2==='生') return '单生·正宗';
    return '反哺·守御';
  })();
  $('school').style.color=e.total>=4?'var(--gold)':e.total>=2?'var(--jade)':'var(--ink2)';

  // 属性
  const QL=[['crit','暴击',5,'%'],['critDmg','暴伤',50,'%'],['inc','增伤',0,'%'],['red','减伤',0,'%'],
            ['leech','噬血',0,'%'],['reflect','反伤',0,'%'],['pen','破防',0,'%'],['dbl','连击',0,'%'],
            ['healB','疗愈',0,'%'],['sk','技阶',0,'']];
  let qh='';
  QL.forEach(([k,n,base,u])=>{
    const v = (k==='sk') ? (st.q.sk||0)+(st.q.skMer||0) : (st.q[k]||0);
    if(v<=base) return;                     // 没长出来就不占位置
    qh+='<div><span>'+n+'</span><b style="color:var(--gold)">'+Math.round(v)+u+'</b></div>';
  });
  $('attrs').innerHTML=
    '<div><span>气血</span><b>'+Math.round(st.s.hp)+'</b></div>'+
    '<div><span>攻击</span><b>'+Math.round(st.s.atk)+'</b></div>'+
    '<div><span>法攻</span><b>'+Math.round(st.s.mag)+'</b></div>'+
    '<div><span>防御</span><b>'+Math.round(st.s.def)+'</b></div>'+qh;

  // 七星
  const skBox=$('skills'); skBox.innerHTML='';
  const sk=buildSkills();
  // 配装一变，星位对应的技能就换了，顺手清掉失效的符
  pruneLinks(sk);

  const stars=['★','★★','★★★','★★★★','★★★★★','★★★★★★','★★★★★★★'];
  if(!sk.some(x=>x)){
    skBox.innerHTML='<div style="grid-column:1/3;text-align:center;color:var(--ink2);font-size:11.5px;padding:12px 0">'+
      '三才未成阵，七星不显。<br>点行囊里的「佩」，先装上三件。</div>';
  }
  sk.forEach((s,i)=>{
    const d=document.createElement('div');
    if(!s){ d.className='sk dis'; d.innerHTML='<div class="nm">'+SK_STARS[i]+'</div><div class="ds">未成</div>'; skBox.appendChild(d); return; }

    // 符位：不打人，只改造
    if(isRune(s)){
      const taker=runeTakenBy(i);
      d.className='sk rune';
      d.innerHTML='<div class="nm"><span>'+s.name+' <span class="lv">Lv'+s.lv+'</span></span>'+
        '<span class="star">'+stars[i]+'</span></div>'+
        '<div class="ds">'+s.pos+' · '+s.from+' · 符</div>'+
        '<div class="ds">'+s.desc+'</div>'+
        '<div class="lk dim">'+(taker!=null? '挂于 '+SK_STARS[taker] : '未挂 · 点法术上的「挂符」')+'</div>';
      d.onclick=()=>castSkill(i);   // 点符也给个提示：符不能单独放
      skBox.appendChild(d);
      return;
    }

    const spec=resolve(s,sk);
    const pw=skillPower(s,spec,st.s,e);
    const cnt=linkCount(i);
    d.className='sk'+(G.busy?' dis':'');
    const shot=spec.proj+' 发 · '+PATH_N[spec.path]+(spec.pierce? ' · 穿'+spec.pierce : '')+
      (spec.traitN? ' · '+spec.traitN : '');
    const linkRow='<div class="lk" onclick="event.stopPropagation();pickLink('+i+')">'+
      (cnt? '符 '+cnt+'/2 ▸ '+spec.tags.join('·') : '<span style="color:#8a5a1f">＋ 挂符（0/2）</span>')+'</div>';
    d.innerHTML='<div class="nm"><span>'+s.name+' <span class="lv">Lv'+s.lv+'</span></span>'+
      '<span class="star">'+stars[i]+'</span></div>'+
      '<div class="ds">'+s.pos+' · '+s.from+' · '+(s.elem||'')+(s.crossN? ' · '+s.crossN:'')+
        '<span class="xq" onclick="event.stopPropagation();showSpell('+i+')">详</span></div>'+
      '<div class="ds">'+shot+'</div>'+
      '<div class="pw">约 '+pw+' 点'+(cnt?'<span style="color:#8a5a1f;font-weight:400">（含符）</span>':'')+'</div>'+
      linkRow;
    d.onclick=()=>castSkill(i);
    d.title=(s.lore? s.lore+'　' : '')+(s.desc||'');
    skBox.appendChild(d);
  });

  // 底部快捷栏：和七星同源，只是缩成格子
  renderSkillBar(sk, st, e);

  // 行囊：先按"要不要动手"排 —— 待鉴的顶到前面，再按品级、词条强弱
  const bag=$('bag'); bag.innerHTML='';
  const unidCnt=G.bag.filter(i=>i.ident===false).length;
  $('bagcnt').textContent='（'+G.bag.length+'）'+(unidCnt?' 待鉴 '+unidCnt:'');
  const badge=$('packbadge');
  if(badge) badge.textContent=unidCnt? '· '+unidCnt : '';
  const tvSum=it=>it.affixes.reduce((a,x)=>a+(6-x.t),0);
  const sorted=G.bag.slice().sort((a,b)=>{
    const ua=a.ident===false?1:0, ub=b.ident===false?1:0;
    if(ua!==ub) return ub-ua;
    if(a.grade!==b.grade) return b.grade-a.grade;
    const d=tvSum(b)-tvSum(a);
    if(d) return d;
    return effGrade(b)-effGrade(a);
  });
  sorted.forEach(it=>{
    const d=document.createElement('div');
    const col=RAR_COL[it.grade];
    const unid=it.ident===false;
    d.className='item'+(it.broken?' broken':'')+(unid?' unid':'');
    d.style.borderColor=col;

    if(unid){
      d.title=RAR_NAME[it.grade]+' · 待鉴';
      d.innerHTML='<div class="rar" style="color:'+col+'">'+RAR_NAME[it.grade]+'</div>'+
        '<div class="el" style="color:var(--line);margin-top:6px">？</div>'+
        '<div class="nm">未鉴之器</div>'+
        '<div class="n">不知何物</div>'+
        '<div class="act">'+
          '<button class="sm" onclick="event.stopPropagation();identify('+it.id+')">鉴 '+IDENT_COST+'</button>'+
          '<button class="sm" onclick="event.stopPropagation();sellItem('+it.id+')">卖</button>'+
        '</div>';
    } else {
      d.title=it.name+'　'+RAR_NAME[it.grade]+(it.broken?'（残）':'')+'\n'+afText(it);
      const afs=it.affixes.slice(0,3).map(a=>afLabel(a)).join('<br>');
      const more=it.affixes.length>3?'<div style="color:var(--ink2)">…还有 '+(it.affixes.length-3)+' 条</div>':'';
      let bd='';
      if(it.inscr)  bd+='<i class="b1">铭'+it.inscr.n+'</i>';
      if(it.spirit) bd+='<i class="b2">灵'+it.spirit.n+'</i>';
      if(it.curse)  bd+='<i class="b3">咒'+it.curse.n+'</i>';
      d.innerHTML='<div class="rar" style="color:'+col+'">'+RAR_NAME[it.grade]+'</div>'+
        '<div class="el" style="color:'+COL[it.x]+';margin-top:6px">'+it.x+'</div>'+
        '<div class="nm">'+(it.base||it.x)+'</div>'+
        '<div class="n">'+it.y+it.x+(it.broken?' · 残':'')+'</div>'+
        '<div class="af">'+(afs||'<span style="color:var(--ink2)">无词条</span>')+more+'</div>'+
        (bd?'<div class="bd">'+bd+'</div>':'')+
        '<div class="act">'+
          '<button class="sm" onclick="event.stopPropagation();equipFromBag('+it.id+')">佩</button>'+
          '<button class="sm" onclick="event.stopPropagation();showForge('+it.id+')">炉</button>'+
          '<button class="sm" onclick="event.stopPropagation();salvage('+it.id+')">拆</button>'+
        '</div>';
    }
    d.onclick=()=>showItem(it.id);
    bag.appendChild(d);
  });
  if(!G.bag.length) bag.innerHTML='<div class="sub2">行囊空。打赢一波掉两件。</div>';
}

