#!/usr/bin/env node
/**
 * 妖魔自主寻敌探针
 *
 * 实测：玩家不出招、不走位时怪会不会自己围上来打；翻面板时会不会停；
 * 以及出招 → 还手这条老链路有没有被带坏。
 * 跑法：先 npm run dev，再 node tools/probe-aggro.js
 */
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9345;
const URL = 'http://127.0.0.1:5173/?nointro&nohelp&seed=7';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--window-size=1000,900', `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/shiyi_aggro_' + Date.now(), 'about:blank',
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
  await sleep(1700);

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
  const snap = () => run(`
    const G=window.__G,S=window.__S;
    const ds=S.mobs.filter(m=>!m.dead).map(m=>Math.round(Math.hypot(m.x-S.px,m.y-S.py)));
    return { hp:Math.round(S.php), turn:G.turn, busy:G.busy, over:G.over,
      alive:ds.length, nearest:Math.min(...ds), dist:ds,
      modalOn:document.body.classList.contains('modal-on') };`);
  const out = (t, v) => console.log(`\n${t}\n  ${JSON.stringify(v)}`);

  const a = await snap();
  out('① 刚进秘境（不出招、不走位）', a);

  await sleep(3600);
  const b = await snap();
  out('② 静置 3.6s 后', b);
  console.log('  判定：', b.nearest < a.nearest ? '✓ 怪自己围上来了' : '✗ 怪没动',
    '|', b.hp < a.hp ? '✓ 主动出手了' : '✗ 没掉血',
    '|', b.turn === a.turn ? '✓ 没偷推回合' : '✗ 回合被推进');

  await run(`window.togglePack(true); return 1;`);
  const c = await snap();
  await sleep(2600);
  const d = await snap();
  out('③ 翻开抽屉静置 2.6s（应暂停）', { before: c.hp, after: d.hp });
  console.log('  判定：', d.hp === c.hp ? '✓ 翻面板不挨打' : '✗ 面板期间还在掉血');

  await run(`window.togglePack(false); return 1;`);
  await sleep(2000);
  const e = await snap();
  out('④ 收起抽屉后 2s（应恢复）', { hp: e.hp, nearest: e.nearest });
  console.log('  判定：', e.hp < d.hp ? '✓ 恢复寻敌' : '· 这一下没打到（怪还在走位）');

  const beforeCast = await snap();
  await run(`window.autoEquip&&window.autoEquip(); for(let k=0;k<7;k++) window.castSkill&&window.castSkill(k); return 1;`);
  await sleep(1600);
  const f = await snap();
  out('⑤ 出一招（老链路）', { turnBefore: beforeCast.turn, turnAfter: f.turn, busy: f.busy, hp: f.hp });
  console.log('  判定：', f.turn > beforeCast.turn ? '✓ 出招 → 还手 → 回合推进' : '✗ 回合没推进',
    '|', !f.busy ? '✓ 没卡 busy' : '✗ busy 没复位');

  // ⑥ 走位仍然能拉开距离 —— 这条是老机制，别被自主寻敌挤没了
  await run(`
    for(const t of [window,document])
      t.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    return 1;`);
  await sleep(1200);
  await run(`
    for(const t of [window,document])
      t.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowRight',bubbles:true}));
    return 1;`);
  const g = await snap();
  out('⑥ 往右跑 1.2s（应能拉开距离）', { nearest: g.nearest, dist: g.dist, hp: g.hp });
  console.log('  判定：', g.nearest > f.nearest ? '✓ 走位能躲' : '✗ 跑不掉');

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
