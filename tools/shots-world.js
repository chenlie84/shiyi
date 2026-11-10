#!/usr/bin/env node
/**
 * 开局与世界层的画面验收
 *
 *   npm run dev                # 另开一个终端
 *   node tools/shots-world.js  # 图放 .workbuddy/shots-world/
 *
 * 四张：仙魔大战开场 / 定名 / 舆图·薪火村 / 舆图·残洲详情。
 * 用 ?nohelp 压掉玩法说明弹层，免得挡住舆图；不带 nointro，走真实开局。
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9336;
const URL = process.env.URL || 'http://127.0.0.1:5173/?nohelp&seed=7';
const OUT = process.env.OUT || '.workbuddy/shots-world';
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--window-size=1200,900', `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/shiyi_wshots_' + Date.now(), 'about:blank',
], { stdio: 'ignore' });

async function pageSocket() {
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

async function main() {
  const ws = new WebSocket(await pageSocket());
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
  const rpc = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await rpc('Page.enable');
  await rpc('Runtime.enable');
  await rpc('Emulation.setDeviceMetricsOverride', {
    width: 1200, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await rpc('Page.navigate', { url: URL });
  await sleep(1700);

  const run = async (body) => {
    const r = await rpc('Runtime.evaluate', {
      expression: `(async()=>{${body}})()`, returnByValue: true, awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  };
  const shot = async (name) => {
    const r = await rpc('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64'));
    console.log('  →', `${OUT}/${name}.png`);
  };

  await shot('w1_opening');
  await run(`document.querySelector('[data-i="begin"]').click(); return 1;`);
  await sleep(220);
  await shot('w2_naming');
  await run(`document.querySelector('[data-i="enter"]').click(); return 1;`);
  await sleep(320);
  await shot('w3_atlas_village');
  await run(`document.querySelector('[data-w="pick"][data-id="tianzhu"]').click(); return 1;`);
  await sleep(220);
  await shot('w4_atlas_region');

  console.log(`\n图在 ${OUT}/`);
  ws.close();
  chrome.kill();
}
main().catch((e) => {
  console.error('失败：' + e.message);
  chrome.kill();
  process.exit(1);
});
