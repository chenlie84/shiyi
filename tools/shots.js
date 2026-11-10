#!/usr/bin/env node
/**
 * 画面验收：用 CDP 驱动无头 Chrome，真实时间跑一遍，逐张截图
 *
 *   npm run dev            # 另开一个终端
 *   node tools/shots.js    # 默认打 http://127.0.0.1:5173
 *
 * 为什么不直接 `chrome --screenshot`：那个必须配 `--virtual-time-budget` 才能
 * 等到画面，而虚拟时间会把 requestAnimationFrame 冻住 —— 走位、弹道、回合
 * 全都停在原地，测不出"人有没有动"。这里用 CDP 真实等待。
 *
 * 环境变量：
 *   URL     要打的地址（默认 http://127.0.0.1:5173/?nohelp&seed=7）
 *   OUT     图放哪（默认 .workbuddy/shots）
 *   CHROME  浏览器路径
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHROME =
  process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9335;
const URL = process.env.URL || 'http://127.0.0.1:5173/?nohelp&nointro&seed=7';
const OUT = process.env.OUT || '.workbuddy/shots';

mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--window-size=1000,900',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/shiyi_shots_' + Date.now(),
    'about:blank',
  ],
  { stdio: 'ignore' }
);

async function pageSocket() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(150);
  }
  throw new Error('CDP 端口没起来（Chrome 路径对不对？）');
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

  const rpc = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await rpc('Page.enable');
  await rpc('Runtime.enable');
  await rpc('Emulation.setDeviceMetricsOverride', {
    width: 1000,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await rpc('Page.navigate', { url: URL });
  await sleep(1600);

  /** 在页面里跑一段代码（可以是 async） */
  const run = async (body) => {
    const r = await rpc('Runtime.evaluate', {
      expression: `(async () => { ${body} })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval 失败');
    return r.result.value;
  };

  const shot = async (name) => {
    const r = await rpc('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64'));
  };

  const state = () =>
    run(`
      const S = window.__S, G = window.__G;
      return { 层: G.floor, 间: G.room, 回合: G.turn,
               pos: [Math.round(S.px), Math.round(S.py)],
               cam: [Math.round(S.cam.x), Math.round(S.cam.y)],
               怪: S.mobs.map(m => m.name + ' ' + Math.round(m.hp)) };`);

  const key = (k, down) =>
    run(`
      for (const t of [window, document])
        t.dispatchEvent(new KeyboardEvent('${down ? 'keydown' : 'keyup'}', { key: '${k}', bubbles: true }));
      return 1;`);

  console.log('① 首屏   ', JSON.stringify(await state()));
  await shot('s1_home');

  await key('ArrowRight', true);
  await sleep(1100);
  await key('ArrowRight', false);
  await sleep(160);
  console.log('② 走位后 ', JSON.stringify(await state()));
  await shot('s2_walk');

  await run(`
    const cv = document.getElementById('cv');
    const r = cv.getBoundingClientRect();
    cv.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: r.left + 120, clientY: r.top + 140, bubbles: true,
    }));
    return 1;`);
  await sleep(1400);
  console.log('③ 点地后 ', JSON.stringify(await state()));
  await shot('s3_tap');

  await run(`window.togglePack(true); return 1;`);
  await sleep(420);
  console.log('④ 抽屉   ', await run(`return document.body.classList.contains('drawer-on');`));
  await shot('s4_drawer');
  await run(`window.togglePack(false); return 1;`);
  await sleep(260);

  // 装配 → 跳到第 5 间（4 只围上来）→ 出招看弹道
  await run(`window.autoEquip(); return 1;`);
  await sleep(300);
  await run(`
    window.__G.room = 5;
    const m = await import('/src/game/waves.js');
    window.__S.mobs = m.makeWave();
    window.refresh && window.refresh();
    return window.__S.mobs.length;`);
  await sleep(260);
  await shot('s5_ring');
  console.log('⑤ 四只围上', JSON.stringify(await state()));

  await run(`window.castSkill(0); return 1;`);
  await sleep(150);
  await shot('s6_cast');
  await sleep(220);
  await shot('s6b_cast');
  await sleep(400);
  await shot('s6c_cast');
  console.log('⑥ 出招后 ', JSON.stringify(await state()));

  console.log(`\n图在 ${OUT}/`);
  ws.close();
  chrome.kill();
}

main().catch((e) => {
  console.error('失败：' + e.message);
  chrome.kill();
  process.exit(1);
});
