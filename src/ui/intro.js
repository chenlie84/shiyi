/**
 * 开局：仙魔大战 → 定名（生辰 / 性情）→ 人物初始信息 → 入世
 *
 * 独立全屏层，不占现有弹层（modal）与抽屉（drawer）的位子。
 * 人物由 game/character.js 按「生辰 + 性情 + 性别 + salt」确定性生成，
 * 点「再掷一次」只换 salt，所以同一个生辰永远能掷回同一个人。
 */

import { createCharacter, GENDERS } from '../game/character.js';
import { LIKES } from '../data/names.js';
import { VILLAGE } from '../data/world.js';
import { setHero } from '../game/world.js';

let root = null;
let scene = 0;
let salt = 0;
let form = { y: 1996, m: 4, d: 12, like: '山', gender: 'any' };
let onDone = () => {};

const $ = (id) => document.getElementById(id);

/** 开场插画：断天柱、四洲碎片、仙魔两道光 */
function battleArt() {
  return `
<svg class="introsvg" viewBox="0 0 760 250" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#171b26"/><stop offset=".62" stop-color="#3a2a28"/><stop offset="1" stop-color="#17120f"/>
    </linearGradient>
    <linearGradient id="pillar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6b5a44"/><stop offset=".5" stop-color="#c9bda2"/><stop offset="1" stop-color="#4a3c2c"/>
    </linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".85"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="760" height="250" fill="url(#sky)"/>
  <circle cx="380" cy="96" r="92" fill="url(#glow)" opacity=".5"/>
  <!-- 断裂的天柱 -->
  <path d="M362 250 L366 118 L358 96 L374 74 L370 52 L386 34 L380 0 L400 0 L394 40 L404 62 L390 92 L398 116 L402 250 Z" fill="url(#pillar)" opacity=".92"/>
  <path d="M358 96 L374 74 L370 52" stroke="#a83b2c" stroke-width="2" fill="none" opacity=".8"/>
  <!-- 仙魔交错的两道光 -->
  <path d="M40 210 Q220 130 366 62" stroke="#c9e0ea" stroke-width="2" fill="none" opacity=".75"/>
  <path d="M720 208 Q540 128 394 60" stroke="#e2795c" stroke-width="2" fill="none" opacity=".75"/>
  <path d="M40 210 Q220 130 366 62" stroke="#c9e0ea" stroke-width="9" fill="none" opacity=".10"/>
  <path d="M720 208 Q540 128 394 60" stroke="#e2795c" stroke-width="9" fill="none" opacity=".10"/>
  <!-- 四洲碎片 -->
  <g fill="#2e2922" stroke="#8a7a5a" stroke-width="1.4">
    <path d="M60 196 L152 178 L196 200 L164 226 L88 224 Z"/>
    <path d="M604 180 L700 194 L716 220 L638 230 L588 210 Z"/>
    <path d="M212 214 L300 206 L322 236 L238 244 Z"/>
    <path d="M452 208 L540 202 L566 232 L478 242 Z"/>
  </g>
  <!-- 落下的兵刃与火 -->
  <g stroke="#c9a227" stroke-width="1.6" opacity=".9">
    <path d="M150 40 l16 30"/><path d="M600 52 l-14 28"/><path d="M266 26 l10 22"/><path d="M500 34 l-8 24"/>
  </g>
  <g fill="#e2795c" opacity=".8">
    <circle cx="186" cy="150" r="2"/><circle cx="556" cy="142" r="2.4"/><circle cx="320" cy="118" r="1.6"/>
    <circle cx="452" cy="160" r="1.8"/><circle cx="96" cy="120" r="1.5"/><circle cx="672" cy="128" r="1.7"/>
  </g>
  <rect width="760" height="250" fill="none" stroke="#8a7a5a" stroke-width="2"/>
</svg>`;
}

function stageDot(n, label, active) {
  return `<div class="istage${active ? ' on' : ''}"><i>${n}</i><span>${label}</span></div>`;
}

function renderOpening() {
  root.innerHTML = `
<div class="ibox iopen">
  ${battleArt()}
  <div class="ititle">绝 地 天 通</div>
  <div class="isub">拾　遗 · 四 洲 残 地</div>
  <div class="istory">
    远古绝地天通，仙界与人界断了联系。人界传承断绝，功法残缺，妖魔横行。<br>
    那一日仙魔大战，天柱崩折，四洲被击得四分五裂；<br>
    仙魔兵器与残卷散落进无数空间裂缝，偶尔有幸运儿走在路边便得了机缘，从此脱了凡胎。<br>
    人族守着最后一点薪火，为那一丝仙缘，艰难求生。
  </div>
  <div class="iq">仙魔之器不离五行阴阳，不离相生相克。悟得相生，仙途如左脚踩右脚；反之，寸步难行。</div>
  <div class="iacts"><button class="ibig" data-i="begin">入　世</button></div>
  <div class="ifoot">${stageDot(1, '观大战', true)}${stageDot(2, '定名姓', false)}${stageDot(3, '入薪火村', false)}</div>
</div>`;
}

function readForm() {
  form.y = Math.min(2100, Math.max(1900, parseInt($('ib-y').value, 10) || 1996));
  form.m = Math.min(12, Math.max(1, parseInt($('ib-m').value, 10) || 4));
  form.d = Math.min(31, Math.max(1, parseInt($('ib-d').value, 10) || 12));
}

function heroCard(h) {
  const t = h.traits;
  const bar = (k, v) => `<div class="htr"><span>${k}</span><div class="hbar"><i style="width:${v * 10}%"></i></div><b>${v}</b></div>`;
  const bonusLine = Object.entries(h.bonus)
    .filter(([, v]) => v)
    .map(([k, v]) => {
      const nm = { hpPct: '气血', atkPct: '攻击', magPct: '法攻', defPct: '防御', crit: '暴击', critDmg: '暴伤', stonesPct: '灵石' }[k] || k;
      return `<span>${nm} ${v > 0 ? '+' : ''}${v}${k === 'crit' || k === 'critDmg' ? '' : '%'}</span>`;
    }).join('');
  return `
<div class="hcard">
  <div class="hname">${h.name}<span class="hstyle">字 · ${h.style}</span></div>
  <div class="hline"></div>
  <div class="hrow"><span>生辰</span><b>${h.ganzhi}年　${h.monthN}　${h.birth.d}日</b></div>
  <div class="hrow"><span>时令</span><b>${h.season}令 · 秉${h.seasonElem}气</b></div>
  <div class="hrow"><span>性情</span><b>${h.like.n}　${h.like.d}</b></div>
  <div class="hrow"><span>命格</span><b>${h.fate}</b></div>
  <div class="hrow"><span>籍贯</span><b>${h.home}（${VILLAGE.sub}）</b></div>
  <div class="hrow"><span>主行</span><b class="helem">${h.elem}</b></div>
  <div class="hsec">资　质</div>
  ${bar('根骨', t.根骨)}${bar('悟性', t.悟性)}${bar('气海', t.气海)}${bar('福缘', t.福缘)}
  <div class="hsec">先　天</div>
  <div class="hbonus">${bonusLine || '<span>平平无奇</span>'}</div>
  <p class="hintro">${h.intro}</p>
</div>`;
}

function renderNaming() {
  const h = createCharacter({ ...form, salt });
  root.innerHTML = `
<div class="ibox iname">
  <div class="ihead">
    <div><div class="ititle2">定　名</div><div class="isub2">仙魔大战之后，人界已无谱牒。名姓由生辰与性情推出来。</div></div>
    <div class="ifoot2">${stageDot(1, '观大战', false)}${stageDot(2, '定名姓', true)}${stageDot(3, '入薪火村', false)}</div>
  </div>
  <div class="icols">
    <div class="iform">
      <div class="flabel">生　辰</div>
      <div class="frow">
        <input id="ib-y" type="number" min="1900" max="2100" value="${form.y}" aria-label="年"><i>年</i>
        <input id="ib-m" type="number" min="1" max="12" value="${form.m}" aria-label="月"><i>月</i>
        <input id="ib-d" type="number" min="1" max="31" value="${form.d}" aria-label="日"><i>日</i>
      </div>
      <div class="fhint">时令定五行偏向：春木 · 夏火 · 长夏土 · 秋金 · 冬水</div>

      <div class="flabel">性　情</div>
      <div class="likes">
        ${LIKES.map((l) => `<div class="like${form.like === l.k ? ' sel' : ''}" data-like="${l.k}">
          <b>${l.n}</b><span>${l.d}</span><i>${l.elem}</i></div>`).join('')}
      </div>
      <div class="fhint">性情只给一点先天数值，不决定日后走什么流派。</div>

      <div class="flabel">形　貌</div>
      <div class="genders">
        ${GENDERS.map((g) => `<button class="gd${form.gender === g.k ? ' sel' : ''}" data-gd="${g.k}">${g.n}</button>`).join('')}
      </div>

      <div class="iacts2">
        <button data-i="reroll">再掷一次</button>
        <button class="ibig" data-i="enter">入　世</button>
      </div>
    </div>
    <div class="ipreview">
      <div class="flabel">此　世</div>
      <div id="ihero">${heroCard(h)}</div>
      <div class="fhint">同一个生辰与性情，推出来的始终是同一个人；「再掷一次」只换名号与资质。</div>
    </div>
  </div>
</div>`;
}

function rerender() {
  if (scene === 0) renderOpening();
  else renderNaming();
}

/** 注册「入世」回调；重塑此世再走一遍开场时也用得上 */
export function setIntroDone(fn) {
  onDone = fn || (() => {});
}

/** 打开开局流程；传了 done 就覆盖 setIntroDone 注册的那一个 */
export function showIntro(done) {
  root = $('intro');
  if (!root) return;
  if (done) setIntroDone(done);
  scene = 0;
  salt = 0;
  root.classList.add('on');
  document.body.classList.add('intro-on');
  rerender();

  root.onclick = (e) => {
    const like = e.target.closest('[data-like]');
    if (like) { readForm(); form.like = like.dataset.like; rerender(); return; }
    const gd = e.target.closest('[data-gd]');
    if (gd) { readForm(); form.gender = gd.dataset.gd; rerender(); return; }
    const btn = e.target.closest('[data-i]');
    if (!btn) return;
    const act = btn.dataset.i;
    if (act === 'begin') { scene = 1; rerender(); return; }
    if (act === 'reroll') { readForm(); salt++; rerender(); return; }
    if (act === 'enter') {
      readForm();
      const h = createCharacter({ ...form, salt });
      setHero(h);
      hideIntro();
      onDone(h);
    }
  };

  // 输入框改动只重算右侧人物卡，别把输入框本身重建了（光标会跳）
  root.oninput = (e) => {
    if (!e.target.id || !e.target.id.startsWith('ib-')) return;
    readForm();
    const card = $('ihero');
    if (card) card.innerHTML = heroCard(createCharacter({ ...form, salt }));
  };
}

export function hideIntro() {
  if (!root) root = $('intro');
  if (!root) return;
  root.classList.remove('on');
  root.innerHTML = '';
  document.body.classList.remove('intro-on');
}

export { createCharacter };
