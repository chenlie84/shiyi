/**
 * 四洲残地 · 天地舆图
 *
 * 世界层的主界面：主线阶段、六块残地、新手村六试炼、流派、筑基丹、
 * 出村游历、四极之枢、随机差事，都在这一个覆盖层里。
 *
 * 点「挑战 / 游历 / 差事」会关掉地图、切到现有回合制战斗；
 * 打赢（或阵亡）后 world.js 通过 subscribeWorld 把地图自动掀开，显示战果。
 */

import {
  W, SECTS, TRIALS, REGIONS, VILLAGE, STAGES,
  subscribeWorld, stageOf, stageIndex, nextGoal, sectOf,
  trialState, startTrial, regionState, startRegion,
  rollQuests, startQuest, clearResult,
  canTakePill, takeFoundationPill, canMerge, mergeWorld,
  setSect, backToDungeon, clearProgress,
} from '../game/world.js';
import { showIntro } from './intro.js';

let root = null;
let sel = 'village'; // village | region id
let bound = false;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 舆图：六残洲按方位铺开，薪火村居中，归墟在底下 */
function mapGrid() {
  const cell = (r) => {
    const st = regionState(r.id);
    const cls = 'mcell' + (st.locked ? ' lock' : '') + (st.anchored ? ' anchored' : '') +
      (st.visited ? ' seen' : '') + (sel === r.id ? ' sel' : '');
    return `<button class="${cls}" data-w="pick" data-id="${r.id}" style="--rc:${r.color}"
      ${st.locked ? 'title="筑基之后方可出村"' : ''}>
      <i>${r.from}</i><b>${r.n}</b><em>${st.locked ? '未至' : st.anchored ? '枢已取' : st.visited ? '已游历' : r.sub}</em>
    </button>`;
  };
  const byId = (id) => REGIONS.find((r) => r.id === id);
  const vcls = 'mcell mvillage' + (sel === 'village' ? ' sel' : '');
  return `
<div class="mgrid">
  ${cell(byId('bei'))}
  ${cell(byId('tianzhu'))}
  ${cell(byId('dong'))}
  ${cell(byId('xi'))}
  <button class="${vcls}" data-w="pick" data-id="village"><i>${VILLAGE.sub}</i><b>${VILLAGE.n}</b><em>此世所出</em></button>
  ${cell(byId('nan'))}
  <div class="mwide">${cell(byId('guixu'))}</div>
</div>`;
}

/** 舆图下方的一小栏：把散在 W 里的进度摆到一处，也填掉地图下面的空 */
function trailBlock() {
  const item = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
  return `<div class="mtrail">
    <div class="mtrail-t">此 世 行 踪</div>
    <div class="mtrail-g">
      ${item('境界', W.merged ? '金丹' : W.pills ? '筑基' : '炼气')}
      ${item('六妖', W.trials.length + ' / 6')}
      ${item('四枢', W.anchors.length + ' / 4')}
      ${item('游历', W.visited.length + ' / 6')}
      ${item('差事', W.questDone)}
      ${item('合洲', W.merged ? '已成' : '未成')}
    </div>
  </div>`;
}

function stageBar() {
  const cur = stageIndex();
  return `<div class="stages">${STAGES.map((s, i) =>
    `<div class="st${i === cur ? ' on' : ''}${i < cur ? ' done' : ''}"><i>${i + 1}</i><span>${s.n}</span></div>`
  ).join('')}</div>`;
}

function sectBlock() {
  const mine = sectOf();
  if (mine) {
    return `<div class="done-sect">已拜 <b>${mine.n}</b> · 『${mine.motto}』<span>${mine.desc}</span></div>`;
  }
  return `<div class="sects">${SECTS.map((s) => `
    <button class="sect" data-w="sect" data-id="${s.id}">
      <b>${s.n}</b><i>『${s.motto}』</i><span>${s.desc}</span>
      <em>${Object.entries(s.bonus).map(([k, v]) => {
        const nm = { hpPct: '气血', atkPct: '攻击', magPct: '法攻', defPct: '防御', crit: '暴击', stonesPct: '灵石' }[k] || k;
        return nm + (v > 0 ? '+' : '') + v + '%';
      }).join('　')}</em>
    </button>`).join('')}</div>
    <div class="fhint">拜入只给少量数值，日后三才成阵、七星挂符走什么路，仍由你自己的配装定。</div>`;
}

function trialBlock() {
  return `<div class="trials">${TRIALS.map((t, i) => {
    const s = trialState(t.id);
    const cls = 'trial' + (s.done ? ' done' : s.locked ? ' lock' : ' open') + (i + 1 === TRIALS.length ? ' last' : '');
    return `<button class="${cls}" data-w="trial" data-id="${t.id}" ${s.done || s.locked ? 'disabled' : ''}
      title="${esc(t.lore)}">
      <i>${['一', '二', '三', '四', '五', '六'][i]}</i>
      <b>${t.n}</b>
      <em>${s.done ? '已伏' : s.locked ? '未开' : t.ep + '·' + t.demon}</em>
      <span>${s.done ? '✓' : s.locked ? '锁' : '战'}</span>
    </button>`;
  }).join('')}</div>`;
}

function pillBlock() {
  if (W.pills) return `<div class="done-sect">已服筑基丹 · 境界入筑基，可以出村了。</div>`;
  if (canTakePill()) {
    return `<button class="pill" data-w="pill">◈　长老开炉 · 取筑基丹</button>
      <div class="fhint">六妖尽伏，丹方虽残，还够炼一颗。</div>`;
  }
  return `<div class="fhint">六妖未伏，丹炉不开。先把村外六处试炼走完。</div>`;
}

function mergeBlock() {
  if (W.merged) return `<div class="done-sect">四洲已合 · 妖魔退入归墟。主线告一段落。</div>`;
  if (canMerge()) return `<button class="pill grand" data-w="merge">◈　四枢归位 · 合四洲之地</button>`;
  return `<div class="fhint">四极之枢 ${W.anchors.length} / 4　·　${W.anchors.join('、') || '一道未取'}</div>`;
}

function villagePanel() {
  const st = stageOf();
  return `
<div class="ptitle">${VILLAGE.n}<span>${VILLAGE.sub}</span></div>
<p class="pdesc">${VILLAGE.desc}</p>
<p class="plore">${VILLAGE.lore}</p>
<div class="psec">拜　入 <i>只影响少量数值</i></div>
${sectBlock()}
<div class="psec">六 试 炼 <i>${W.trials.length} / 6</i></div>
<div class="fhint">${st.id === 'qi' ? '筑基之前都在村里苦修。六处试炼逐个降伏，长老才会开炉。' : '六妖已尽伏。'}</div>
${trialBlock()}
<div class="psec">筑　基</div>
${pillBlock()}
<div class="psec">合　洲</div>
${mergeBlock()}`;
}

function regionPanel(r) {
  const s = regionState(r.id);
  return `
<div class="ptitle" style="color:${r.color}">${r.n}<span>${r.from} · ${r.sub}</span></div>
<p class="pdesc">${r.desc}</p>
<p class="plore">${r.lore}</p>
<div class="pmeta">
  <div><span>危</span><b>${'◆'.repeat(r.danger)}${'◇'.repeat(5 - r.danger)}</b></div>
  <div><span>行</span><b>${r.elem}</b></div>
  <div><span>遗</span><b>${r.relic}</b></div>
  <div><span>枢</span><b>${r.anchor || '无'}${s.anchored ? ' · 已取' : ''}</b></div>
</div>
${s.locked
    ? `<div class="fhint">${s.why || '尚未至'}。先在薪火村降伏六妖、服下筑基丹。</div>`
    : `<button class="pill" data-w="region" data-id="${r.id}">◈　游历此地 · 清妖气</button>
       <div class="fhint">游历即是一场遭遇战；取胜可推进四极之枢。</div>`}
<div class="psec">随 机 机 缘</div>
<p class="fhint">裂缝里漂着散落的仙魔兵器与残功法。走在路边，也可能撞见。</p>`;
}

function questBlock() {
  if (!W.quests.length) return `<div class="fhint">眼下没有差事。<button class="lnk" data-w="rerollq">去村口问问</button></div>`;
  return `<div class="quests">${W.quests.map((q) => `
    <div class="quest">
      <i>${q.icon}</i>
      <div><b>${esc(q.title)}</b><span>${esc(q.desc)}</span></div>
      <em>石 ${q.reward.stones} · 魂 ${q.reward.soul}</em>
      <button class="sm" data-w="quest" data-id="${q.id}">去</button>
    </div>`).join('')}</div>
    <button class="lnk" data-w="rerollq">换一批差事</button>`;
}

function heroLine() {
  const h = W.hero;
  if (!h) return '';
  const s = sectOf();
  return `<div class="ahero">
    <b>${h.name}</b><span>字 ${h.style}</span>
    <i>${W.merged ? '金丹' : W.pills ? '筑基' : '炼气'}</i>
    <i>${s ? s.n : '未拜门'}</i>
    <i>秉${h.elem}气</i>
  </div>`;
}

function render() {
  if (!root) return;
  const r = REGIONS.find((x) => x.id === sel);
  const result = W.lastResult;
  root.innerHTML = `
<div class="abox">
  <div class="ahead">
    <div class="atitle">四 洲 残 地 <span>绝地天通之后</span></div>
    ${heroLine()}
    <button class="sm" data-w="close">收起</button>
  </div>
  ${stageBar()}
  <div class="agoal"><b>眼下</b>${esc(nextGoal())}<i>${stageOf().goal}</i></div>
  ${result ? `<div class="aresult"><b>${esc(result.title)}</b>
      <div>${result.lines.map((x) => '<p>' + esc(x) + '</p>').join('')}</div>
      <button class="sm" data-w="ok">知道了</button></div>` : ''}
  <div class="abody">
    <div class="amap">
      <div class="mtitle">舆　图 <span>六块残地 · 一村</span></div>
      ${mapGrid()}
      ${trailBlock()}
      <div class="mlegend">四洲碎于仙魔大战，天柱断口在中，裂缝汇于归墟。点一块地看详情。</div>
    </div>
    <div class="apanel">
      ${r ? regionPanel(r) : villagePanel()}
      <div class="psec">村 中 差 事 <i>随机</i></div>
      ${questBlock()}
    </div>
  </div>
  <div class="afoot">
    <button data-w="dungeon">回试炼台（地宫闯关）</button>
    <span>世界进度自动留存 · 顶栏「天地」随时掀开舆图</span>
    <button class="lnk" data-w="reborn">重塑此世</button>
  </div>
</div>`;
}

export function openAtlas() {
  root = $('atlas');
  if (!root) return;
  root.classList.add('on');
  document.body.classList.add('atlas-on');
  render();
}

export function hideAtlas() {
  if (!root) root = $('atlas');
  if (!root) return;
  root.classList.remove('on');
  document.body.classList.remove('atlas-on');
}

export function installAtlas() {
  root = $('atlas');
  if (!root || bound) return;
  bound = true;

  root.onclick = (e) => {
    const b = e.target.closest('[data-w]');
    if (!b) return;
    const act = b.dataset.w;
    const id = b.dataset.id;
    if (act === 'close') { hideAtlas(); return; }
    if (act === 'reborn') {
      if (!confirm('重塑此世会清掉当前人物、流派与主线进度，重新走一遍开场。确定？')) return;
      hideAtlas();
      clearProgress();
      showIntro(); // 回调由 main.js 的 setIntroDone 注册，入世后照常掀舆图
      return;
    }
    if (act === 'ok') { clearResult(); render(); return; }
    if (act === 'pick') { sel = id; render(); return; }
    if (act === 'dungeon') { hideAtlas(); backToDungeon(); return; }
    if (act === 'rerollq') { rollQuests(3); render(); return; }
    if (act === 'sect') { setSect(id); render(); return; }
    if (act === 'pill') { takeFoundationPill(); render(); return; }
    if (act === 'merge') { mergeWorld(); render(); return; }
    if (act === 'trial') {
      clearResult();
      if (startTrial(id)) hideAtlas();
      return;
    }
    if (act === 'region') {
      clearResult();
      if (startRegion(id)) hideAtlas();
      return;
    }
    if (act === 'quest') {
      clearResult();
      if (startQuest(id)) hideAtlas();
      return;
    }
  };

  // 遭遇战结束（胜 / 败）自动掀开舆图看战果
  subscribeWorld(() => {
    if (W.lastResult && root && !root.classList.contains('on')) {
      sel = W.currentTrial || W.currentRegion || 'village';
      openAtlas();
      return;
    }
    if (root && root.classList.contains('on')) render();
  });
}
