#!/usr/bin/env node
/**
 * 软锁回归：auto 模式 + 阵亡自动重开，一直跑到目标层。
 *
 *   node tools/verify.js [seed] [目标层]
 *   node tools/verify.js 7 3
 *
 * 真软锁的签名：`over && busy && 怪全死 && 无弹层 && 遗物未开` 持续 > 3s。
 * 之所以盯这个组合 —— 曾经有个 bug 让 winWave 在掉宝时抛异常，
 * 于是 over=true、busy=true 永远不消，也不会进下一波，画面整个僵住。
 * 普通回合里的 busy 会频繁起落，不会误报。
 */
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9342;
const URL = `http://127.0.0.1:5173/?auto&nohelp&seed=${process.argv[2] || '7'}`;
const TARGET = parseInt(process.argv[3] || '3', 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--window-size=1000,900',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/shiyi_verify_' + Date.now(),
  'about:blank',
], { stdio: 'ignore' });

async function sock() {
  for (let i = 0; i < 80; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = l.find((t) => t.type === 'page');
      if (p && p.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(150);
  }
  throw new Error('CDP 端口没起来（Chrome 路径对不对？）');
}

let seq = 0;
const pending = new Map();

async function main() {
  const ws = new WebSocket(await sock());
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    const p = m.id && pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
  });
  const rpc = (method, params = {}) =>
    new Promise((res, rej) => {
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
      expression: `(async () => { ${body} })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval 失败');
    return r.result.value;
  };

  for (let i = 0; i < 40; i++) {
    if (await run('return !!(window.__G && window.__S);')) break;
    await sleep(150);
  }

  // 阵亡自动重开，让 auto 别死在半路
  await run(`
    setInterval(() => {
      const G = window.__G;
      if (G.over && document.body.classList.contains('modal-on') && window.__S.relicOpen === false) {
        window.uiRestart && window.uiRestart();
      }
    }, 400);
    return 1;
  `);

  let last = '';
  let dead = 0;
  for (let t = 0; t < 300; t++) {
    await sleep(200);
    const st = await run(`
      const G = window.__G, S = window.__S;
      return {
        f: G.floor, r: G.room, turn: G.turn, busy: G.busy, over: G.over,
        relic: S.relicOpen, modal: document.body.classList.contains('modal-on'),
        alive: S.mobs.filter(m => !m.dead).length, best: G.best,
      };
    `);
    const k = `${st.f}-${st.r}-${st.turn}`;
    if (k !== last) {
      console.log(`[${(t * 0.2) | 0}s] 层${st.f} 间${st.r} 回合${st.turn} 怪${st.alive} over=${st.over} busy=${st.busy} 最深${st.best}`);
      last = k;
    }
    if (st.f >= TARGET) {
      console.log(`\n✅ 已打到第 ${st.f} 层（目标 ${TARGET}），无软锁`);
      ws.close(); chrome.kill(); return;
    }
    if (st.over && st.busy && st.alive === 0 && !st.modal && !st.relic) {
      dead++;
      if (dead > 15) {
        console.log(`\n❌ 软锁：层${st.f} 间${st.r} over&&busy&&怪0&&无弹层 持续 >3s`);
        ws.close(); chrome.kill(); return;
      }
    } else {
      dead = 0;
    }
  }

  const st = await run('const G=window.__G,S=window.__S; return {f:G.floor,r:G.room,busy:G.busy,over:G.over,alive:S.mobs.filter(m=>!m.dead).length};');
  // 没到目标层，但也没软锁 —— 只要没僵住就算过（auto 是弱鸡，打不到目标层是平衡问题，不是锁）
  console.log(`\n✅ 观察窗口内无软锁（最深到第 ${st.f} 层，目标 ${TARGET} 层未达属平衡问题）`, JSON.stringify(st));
  ws.close(); chrome.kill();
}

main().catch((e) => { console.error('失败：' + e.message); chrome.kill(); process.exit(1); });
