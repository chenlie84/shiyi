#!/usr/bin/env node
/**
 * 世界层交互探针
 *
 * 实测整条链路：仙魔大战 → 定名 → 入世 → 舆图 → 拜入 → 试炼 → 战果 → 回地宫 → 重塑此世。
 * 跑法：先 npm run dev，再 node tools/probe-world.js
 *
 * 与 probe.js 的分工：那个管三才/熔炉/经脉这些"点了没反应"的老面板，
 * 这个管开局与世界推进；两个都用 CDP 抓页面异常，避免"看着像好的、控制台已经炸了"。
 */
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9344;
const URL = 'http://127.0.0.1:5173/?seed=7'; // 故意不带 nointro：要测的就是首次进入
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--window-size=1200,980', `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/shiyi_world_' + Date.now(), 'about:blank',
], { stdio: 'ignore' });

async function sock() {
  for (let i = 0; i < 80; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = l.find((t) => t.type === 'page');
      if (p && p.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch { /* 还没起来 */ }
    await sleep(150);
  }
  throw new Error('连不上 Chrome CDP');
}

let seq = 0;
const pending = new Map();
const errs = [];

async function main() {
  const ws = new WebSocket(await sock());
  await new Promise((r, j) => {
    ws.addEventListener('open', r, { once: true });
    ws.addEventListener('error', j, { once: true });
  });
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errs.push((d.exception && d.exception.description) || d.text);
      return;
    }
    const p = m.id && pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
  });
  const rpc = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await rpc('Page.enable');
  await rpc('Runtime.enable');
  await rpc('Page.navigate', { url: URL });
  await sleep(1800);
  const run = async (body) => {
    const r = await rpc('Runtime.evaluate', {
      expression: `(async()=>{${body}})()`, returnByValue: true, awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.text + ' ' +
        (r.exceptionDetails.exception && r.exceptionDetails.exception.description || ''));
    }
    return r.result.value;
  };
  const step = (n, title, v) => console.log(`\n${n} ${title}\n  ${JSON.stringify(v)}`);

  step('①', '首屏：仙魔大战开场', await run(`
    return { introOn:document.getElementById('intro').classList.contains('on'),
      atlasOn:document.getElementById('atlas').classList.contains('on'),
      title:document.querySelector('.ititle')?.textContent,
      hasArt:!!document.querySelector('#intro svg'),
      begin:!!document.querySelector('[data-i="begin"]') };`));

  step('②', '点「入世」→ 定名页', await run(`
    document.querySelector('[data-i="begin"]').click();
    return { naming:!!document.querySelector('.iname'), birth:!!document.getElementById('ib-y'),
      likes:document.querySelectorAll('.like').length,
      hero:document.querySelector('#ihero .hname')?.textContent };`));

  step('③', '改生辰 / 选性情 / 再掷一次', await run(`
    const y=document.getElementById('ib-y'); y.value=1988;
    y.dispatchEvent(new Event('input',{bubbles:true}));
    const before=document.querySelector('#ihero .hname').textContent;
    document.querySelector('[data-like="剑"]').click();
    const afterLike=document.querySelector('#ihero .hname').textContent;
    document.querySelector('[data-i="reroll"]').click();
    return { before, afterLike, afterReroll:document.querySelector('#ihero .hname').textContent,
      year:document.getElementById('ib-y').value,
      like:document.querySelector('.like.sel')?.dataset.like };`));

  step('④', '确认入世 → 舆图 / 首批差事 / 玩法说明', await run(`
    document.querySelector('[data-i="enter"]').click();
    return { introOn:document.getElementById('intro').classList.contains('on'),
      atlasOn:document.getElementById('atlas').classList.contains('on'),
      hero:window.__W?.hero?.name, quests:window.__W?.quests?.length,
      goal:document.querySelector('.agoal')?.textContent.slice(0,32),
      helpOn:document.getElementById('mask').classList.contains('on') };`));

  step('⑤', '顶栏「天地」开合', await run(`
    window.closeModal&&window.closeModal();
    document.querySelector('[data-w="close"]').click();
    const closed=!document.getElementById('atlas').classList.contains('on');
    document.querySelector('[data-act="atlas"]').click();
    return { closed, reopened:document.getElementById('atlas').classList.contains('on') };`));

  step('⑥', '拜入流派（数值加成）', await run(`
    document.querySelector('[data-w="sect"]').click();
    return { sect:window.__W.sect, bonus:Object.keys(window.__G.bonus),
      text:document.querySelector('.done-sect')?.textContent.slice(0,26) };`));

  step('⑦', '六试炼：只开第一处 → 单挑妖魔', await run(`
    const ts=[...document.querySelectorAll('[data-w="trial"]')];
    const open=ts.filter(x=>!x.disabled).length;
    ts.find(x=>!x.disabled).click();
    return { openCount:open, atlasOn:document.getElementById('atlas').classList.contains('on'),
      mode:window.__G.waveMode, mobs:window.__S.mobs.length,
      boss:window.__S.mobs[0]?.boss, name:window.__S.mobs[0]?.name };`));

  // ⑧ 打赢：把妖魔血压到 1，出招触发真实结算（winWave → onEncounterWin → 自动掀图）
  let won = null;
  for (let i = 0; i < 9; i++) {
    won = await run(`
      window.autoEquip&&window.autoEquip();
      const m=window.__S.mobs[0];
      if(m){ m.hp=1; m.maxhp=1; m.def=0; m.dead=false; }
      for(let k=0;k<7;k++) window.castSkill&&window.castSkill(k);
      return { trials:window.__W.trials.length,
        atlasOn:document.getElementById('atlas').classList.contains('on') };`);
    if (won.trials > 0 && won.atlasOn) break;
    await sleep(900);
  }
  await sleep(900);
  step('⑧', '打赢 → 战果自动掀开舆图', await run(`
    return { trials:window.__W.trials.length, mode:window.__G.waveMode,
      atlasOn:document.getElementById('atlas').classList.contains('on'),
      result:document.querySelector('.aresult b')?.textContent,
      resultLines:document.querySelectorAll('.aresult p').length,
      goal:document.querySelector('.agoal')?.textContent.slice(0,32) };`));

  step('⑨', '回试炼台（地宫闯关）', await run(`
    document.querySelector('[data-w="dungeon"]').click();
    return { atlasOn:document.getElementById('atlas').classList.contains('on'),
      mode:window.__G.waveMode, mobs:window.__S.mobs.length };`));

  step('⑩', '重塑此世 → 回到开场', await run(`
    document.querySelector('[data-act="atlas"]').click();
    window.confirm=()=>true;
    document.querySelector('[data-w="reborn"]').click();
    return { atlasOn:document.getElementById('atlas').classList.contains('on'),
      introOn:document.getElementById('intro').classList.contains('on'),
      hero:window.__W.hero, trials:window.__W.trials.length };`));

  step('⑪', '再走一遍入世（流程可逆）', await run(`
    document.querySelector('[data-i="begin"]').click();
    document.querySelector('[data-i="enter"]').click();
    return { introOn:document.getElementById('intro').classList.contains('on'),
      atlasOn:document.getElementById('atlas').classList.contains('on'),
      hero:window.__W.hero?.name, quests:window.__W.quests.length, sect:window.__W.sect };`));

  await sleep(250);
  console.log('\n页面异常：', errs.length ? errs.join('\n---\n') : '无');
  ws.close();
  chrome.kill();
  if (errs.length) process.exitCode = 1;
}
main().catch((e) => {
  console.error('失败：' + e.message);
  console.error(errs.join('\n'));
  chrome.kill();
  process.exit(1);
});
