/**
 * 各类面板：经脉图 / 拾遗录 / 挂辅助 / 玩法说明
 */

import { $, modalEl, maskEl } from './dom.js';
import { refresh } from './hud.js';
import { openModal, closeModal } from './modal.js';
import { G, S } from '../game/state.js';
import { calcStats } from '../game/stats.js';
import { buildSkills, STARS } from '../game/skills.js';
import { merState, onNode, setLink, linkCandidates } from '../game/meridian.js';
import { RUNE_MAX } from '../data/runes.js';
import { MER } from '../data/meridian.js';
import { XING, COL } from '../data/elements.js';
import { RAR_COL, GNAME } from '../data/rarity.js';
import { ITEM_NAMES } from '../data/items.js';
import { RELICS } from '../data/relics.js';
import { dexCount } from '../game/dex.js';

export function showMeridian(){
  const litN=MER.filter(n=>G.mer[n.id]).length;
  const deepN=MER.filter(n=>G.mer[n.id]>=2).length;
  let lines='', nodes='';
  MER.forEach(nd=>{
    if(!nd.req) return;
    const p=MER.find(n=>n.id===nd.req), on=!!G.mer[nd.id];
    lines+='<line x1="'+p.x+'" y1="'+p.y+'" x2="'+nd.x+'" y2="'+nd.y+'" stroke="'+(on?'#8a5a1f':'#d9d0b8')+
      '" stroke-width="'+(on?2.6:1.4)+'"'+(on?'':' stroke-dasharray="3 3"')+'/>';
  });
  MER.forEach(nd=>{
    const st=merState(nd);
    const on=(st==='on'||st==='deep');
    const ready=(st==='ready'||st==='on') && G.pts>0;   // 已通还能再淬一次
    const deep=st==='deep';
    const fill=deep?'#5c3a10':st==='on'?'#8a5a1f':(ready?'#fffdf7':'#e7dcc2');
    const scol=deep?'#a8811f':st==='on'?'#5c3a10':(ready?'#8a5a1f':'#c3b795');
    const right=nd.x>170;
    const lx=right? nd.x+11 : nd.x-11;
    const anc=right?'start':'end';
    const tip=nd.n+'　'+nd.d+(deep?'（大成）':st==='on'?'（已通，可再淬）':
      st==='lock'?'（需先通'+MER.find(n=>n.id===nd.req).n+'）':'（需 1 点）');
    nodes+='<g class="node'+(ready?' on':'')+'" '+(ready?'onclick="onNode(\''+nd.id+'\')"':'')+'>'+
      '<title>'+tip+'</title>'+
      (deep?'<circle cx="'+nd.x+'" cy="'+nd.y+'" r="10" fill="none" stroke="#a8811f" stroke-width="1.6"/>':'')+
      '<circle cx="'+nd.x+'" cy="'+nd.y+'" r="7" fill="'+fill+'" stroke="'+scol+'" stroke-width="'+(st==='on'&&ready?'2.6':'2')+'"/>'+
      (on?'<circle cx="'+nd.x+'" cy="'+nd.y+'" r="2.6" fill="'+(deep?'#e8c06a':'#f4efe2')+'"/>':'')+
      '<text x="'+lx+'" y="'+(nd.y+3.2)+'" text-anchor="'+anc+'" font-size="9" fill="'+
        (deep?'#a8811f':on?'#5c3a10':ready?'#8a5a1f':'#9a9077')+'" font-family="PingFang SC,monospace"'+
        ' stroke="#faf6ea" stroke-width="2.6" paint-order="stroke" stroke-linejoin="round">'+nd.n+'</text>'+
      '</g>';
  });
  const body=
    '<svg viewBox="0 0 320 460" width="320" height="460" style="display:block">'+
      '<g fill="#e4d9bd" stroke="#bfae8a" stroke-width="1.3" stroke-linejoin="round">'+
        '<circle cx="160" cy="62" r="26"/>'+
        '<rect x="151" y="84" width="18" height="14"/>'+
        '<path d="M118 100 Q160 90 202 100 L194 176 Q188 216 190 252 L130 252 Q132 216 126 176 Z"/>'+
        '<path d="M118 102 L103 114 L95 178 L110 183 L123 126 Z"/>'+
        '<path d="M202 102 L217 114 L225 178 L210 183 L197 126 Z"/>'+
        '<path d="M131 250 L124 404 L147 404 L152 250 Z"/>'+
        '<path d="M169 250 L173 404 L196 404 L189 250 Z"/>'+
      '</g>'+
      lines+nodes+
    '</svg>';

  let list='';
  MER.forEach(nd=>{
    const lv=G.mer[nd.id]||0;
    if(!lv) return;
    const d=lv>=2? nd.d.replace(/([+\d.]+)/, m=>'+'+Math.round(parseFloat(m)*1.8)) : nd.d;
    list+='<div class="mrow"><span>'+nd.n+(lv>=2?' <span style="color:#a8811f;font-size:10px">大成</span>':'')+
      '</span><b style="color:#8a5a1f">'+d+'</b></div>';
  });
  modalEl().innerHTML=
    '<h3>经脉图</h3>'+
    '<div class="merbar">境界 <b>Lv'+G.lv+'</b>'+
      '<div class="xpbar"><i style="width:'+Math.min(100,G.xp/xpNeed(G.lv)*100)+'%"></i></div>'+
      '<span class="sub2">'+G.xp+' / '+xpNeed(G.lv)+'</span>'+
      '<span style="margin-left:auto">可点 <b style="color:#8a5a1f">'+G.pts+'</b> 点 · 已通 '+litN+' / '+MER.length+
      ' · 大成 '+deepN+'</span></div>'+
    '<div class="merwrap"><div class="merbody">'+body+'</div>'+
      '<div class="merinfo">'+
        '<h4>已通</h4>'+(list||'<div class="sub2">尚未通任何经脉。先点「会阴」。</div>')+
        '<h4>怎么得点</h4><div class="sub2">破阵涨修为，修为满一级，境界 +1，得 1 点经脉点。<br>'+
        '已通的穴还能再点一次「大成」，效果 ×1.8。<br>经脉加成是永久的，重开一局会清空。</div>'+
      '</div></div>'+
    '<div class="row"><button onclick="closeModal()">关上</button></div>';
  maskEl().classList.add('on');
}

/* ---------- 技能链接弹层 ---------- */

export function showDex(){
  const got=Object.keys(G.dex).length;
  let html='<h3>拾遗录</h3>'+
    '<p class="sub2">已识 <b style="color:#3f7a6a">'+got+'</b> / 30 器　每集齐 5 器，得 1 点经脉点。</p>';
  XING.forEach(x=>{
    html+='<div style="margin-top:9px;font-size:11px;font-weight:700;color:'+COL[x]+'">'+x+'　行</div><div class="dexgrid">';
    ITEM_NAMES[x].forEach(nm=>{
      const d=G.dex[nm];
      html+='<div class="dexcell'+(d?' got':'')+'" '+(d?'style="border-color:'+RAR_COL[d.rar]+'"':'')+'>'+
        (d? nm : '？')+
        '<div style="font-size:8.5px;font-weight:400;color:'+(d?RAR_COL[d.rar]:'var(--ink2)')+'">'+
        (d? GNAME[d.rar]+' · 波'+d.wave : '未识')+'</div></div>';
    });
    html+='</div>';
  });
  html+='<div class="row"><button onclick="closeModal()">关上</button></div>';
  modalEl().innerHTML=html;
  maskEl().classList.add('on');
}

export function pickLink(mainIdx){
  const sk=buildSkills();
  const main=sk[mainIdx];
  if(!main||main.kind!=='spell') return;

  const cands=linkCandidates(mainIdx);
  const cnt=cands.filter(c=>c.current).length;

  let html='<h3>「'+main.name+'」挂符</h3>'+
    '<p class="tip">符不自己打人，它改这一式的<b>形状</b>：多发、加重、拐弯、穿透、命中留东西。<br>'+
    '一式最多挂 <b>'+RUNE_MAX+'</b> 道；一道符只能挂一式。当前 <b>'+cnt+' / '+RUNE_MAX+'</b>。</p>'+
    '<div style="display:flex;flex-direction:column;gap:5px;margin:10px 0">';

  let any=false;
  cands.forEach(c=>{
    any=true;
    const busy=c.takenBy!=null;
    const full=!c.current && cnt>=RUNE_MAX;
    const dis=busy||full;
    html+='<button '+(dis?'disabled':'')+' onclick="setLink('+mainIdx+','+c.idx+')" style="text-align:left">'+
      (c.current?'▣ ':'▢ ')+c.star+' · '+c.rune.n+
      ' <b style="color:'+c.rune.col+'">Lv'+c.lv+'</b>'+
      ' <span style="color:var(--ink2);font-size:10px">['+c.rune.tag+']</span>　'+
      (busy? '<span style="color:var(--cin)">已挂于'+STARS[c.takenBy]+'</span>'
           : full? '<span style="color:var(--cin)">这一式已满</span>'
           : '<span style="color:var(--ink2)">'+c.rune.d+'</span>')+
      '</button>';
  });
  if(!any) html+='<div class="sub2">这一套里没有符位。符由天/人、人/地 两对关系推出来 —— 把相生的两位凑齐，才有符。</div>';

  html+='</div><div class="row">'+
    (cnt? '<button onclick="setLink('+mainIdx+',null)">拆尽</button>':'')+
    '<button onclick="closeModal()">关上</button></div>';
  modalEl().innerHTML=html;
  maskEl().classList.add('on');
}

export function showHelp(){
  modalEl().innerHTML=
    '<h3>怎么玩</h3>'+
    '<p><b>1. 配</b>：三件装备分天、人、地。相邻两件「相生」×2，「相克」×¼。</p>'+
    '<p><b>2. 出招</b>：七星全部由三才推导——<b>1-3 位</b>是三件各出一式<b>本源法术</b>（自己五行为体、下一位五行为性，交叉推演）；<b>4-5 位</b>是两道<b>符</b>（由两对关系推出来）；<b>6 位</b>阵技，<b>7 位</b>劫技。点法术出招，符不能单独放。</p>'+
    '<p><b>3. 打</b>：点技能出招，敌人会一起还手。打空一波，下一波更多、更硬。</p>'+
    '<p><b>4. 掉宝</b>：打赢一波落两件（两成几率多一件）。掉率是陡的：<b>凡品 58%</b> → <b>灵品 26%</b> → <b>宝品 11%</b> → <b>仙品 4%</b> → <b>道品 1%</b>。波数越深、难度越高，好货越多。落宝浮层会一直挂着，点开就能看。<br>'+
    '　<b>每过五波，天地掉下三样东西，只能拿一样</b>：天赐宝光（一件宝品／仙品的蒙尘之器）、器魂、灵石、经脉点、地火余温（白提一档词条），或者古器名录（直接识得一件没见过的器）。</p>'+
    '<p><b>5. 鉴</b>：<b style="color:#a8811f">宝品以上捡到手是蒙尘的</b>，看不见名字、五行和词条，也吃不到属性。花 20 灵石「鉴」，才知道你捡到的到底是什么。</p>'+
    '<p><b>6. 品级</b>：词条数量随品级走（凡 0～2 条，道品 6 条）。词条分<b>前缀</b>（气血／攻击／法攻／防御，加数值，最多 3 条）与<b>后缀</b>（暴击／暴伤／增伤／减伤／噬血／反伤／破防／连击，按百分比，最多 3 条），合计 6 条上限。T1 最强、T5 最弱。</p>'+
    '<p><b>7. 熔炉</b>：<b>铸</b>（25 灵石，随机生一条，赌 T）／<b>淬</b>（20～80 灵石 + 2～8 器魂，你自己挑一条提一档，必定成）／<b>引</b>（70 灵石 + 10 器魂，定向指定词条，固定 T3）。<b style="color:#7a4a8a">器魂</b>靠拆解不要的装备来，越拆越会打。</p>'+
    '<p><b>8. 铭 / 灵 / 咒</b>：宝品起必带一条<b style="color:#a8811f">铭文</b>——很猛，但有代价，逼你取舍。仙品起多一条<b style="color:#7a4a8a">器灵</b>，它不讲数值，直接改规则。道品必带一条<b style="color:#a83b2c">凶咒</b>，摘不掉。</p>'+
    '<p><b>9. 底子</b>：五行决定词条倾向——金主锐（攻击／破防）、木主生（气血／噬血）、水主柔（法攻／减伤）、火主烈（攻击／暴伤）、土主厚（防御／反伤）。想要什么词条，先去找对应五行的底子。</p>'+
    '<p><b>10. 技阶</b>：稀有后缀「技阶」涨技能等级；本源技看自己那件装备，合击技取两边均值，阵技／劫技取三件均值。技能上限 <b>Lv7</b>，每级威力 +18%。</p>'+
    '<p><b>11. 符</b>：一式法术最多挂 <b>2</b> 道符，一道符只能挂一式。符改的是<b>形状</b>而不是纯数值：分光符 +1 发、烈阳符 +45% 威力、追魂符改追踪、贯日符 +2 穿透、分魂符命中分裂。发数越多单发越薄（总伤 ∝ 发数^0.45），所以"多"和"重"是两条路。</p>'+
    '<p><b>12. 经脉</b>：破阵涨修为，满一级升境界、得 1 点经脉点。点顶部「经脉」开图，从「会阴」起手，任督上行入百会，两臂由膻中分出，下肢一路到涌泉。十二穴给的是永久属性；已通的穴还能再点一次「大成」，效果 ×1.8。</p>'+
    '<p><b>13. 拾遗录</b>：五行 × 六器 = 30 格图鉴。鉴出一件新器就记一笔，每集齐 5 器得 1 点经脉点。</p>'+
    '<p class="tip">三才决定「能打出多少倍」，词条决定「这一倍里有多少料」。<br>'+
    '前期先凑相生把倍率拉到 ×2 以上；中期开始攒器魂，用「引」把缺的那条补齐；后期就是为一件道品反复淬火。<br>'+
    '前缀 3 条 + 后缀 3 条是硬上限——想全都塞进去，得先捡到一件好底子。</p>'+
    '<div class="row"><button onclick="closeModal()">开始</button></div>';
  maskEl().classList.add('on');
}

/* ---------- 重置 ---------- */
/* 手上是否凑得出乘算 ≥2 的三件 */
