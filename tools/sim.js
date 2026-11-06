#!/usr/bin/env node
/**
 * 平衡回归 CLI
 *
 *   npm run sim                      # 每档 5 局，最多打到 60 间
 *   npm run sim -- 8 60              # 每档 8 局
 *   npm run sim -- 8 60 --seed=7     # 固定种子，数字可复现
 *
 * 逻辑都在 tools/driver.js，这里只管参数和表格。
 */

import { seed, unseed } from '../src/core/rng.js';
import { installHeadless } from './harness.js';
import { play } from './driver.js';

installHeadless();

const argv = process.argv.slice(2);
const opt = {};
const pos = [];
argv.forEach((a) => {
  if (a.startsWith('--')) {
    const [k, v] = a.slice(2).split('=');
    opt[k] = v === undefined ? true : v;
  } else pos.push(a);
});

const N = parseInt(pos[0] || '5', 10);
const MAXW = parseInt(pos[1] || '60', 10);
const BASE = opt.seed !== undefined ? parseInt(opt.seed, 10) : 0;

const DIFFS = [
  [0.7, '练气·易'],
  [1, '筑基·常'],
  [1.5, '金丹·难'],
  [2.2, '元婴·苦'],
  [3.2, '化神·死'],
];

function batch(diff, policy, n) {
  const out = [];
  for (let t = 0; t < n; t++) {
    if (BASE) seed(BASE * 1000 + t);
    else unseed();
    out.push(play({ diff, policy, maxWave: MAXW }));
  }
  return out;
}

// 中文按 2 格宽计，否则表格必歪
const wide = (s) => [...String(s)].reduce((n, c) => n + (c.charCodeAt(0) > 127 ? 2 : 1), 0);
const pad = (s, n) => String(s) + ' '.repeat(Math.max(1, n - wide(s)));
const avg = (x) => x.reduce((s, r) => s + r.wave, 0) / x.length;
const mx = (x) => Math.max(...x.map((r) => r.wave));

console.log(`拾遗 · 平衡回归　每档 ${N} 局　上限 ${MAXW} 间` + (BASE ? `　种子 ${BASE}` : '　随机'));
console.log('');
console.log(pad('难度', 16) + pad('裸装 均值/最高', 18) + pad('全投入 均值/最高', 18) + '末局 血/攻/减伤');
console.log('─'.repeat(84));

for (const [d, nm] of DIFFS) {
  const a = batch(d, 'bare', N);
  const b = batch(d, 'full', N);
  const fb = b[b.length - 1];
  console.log(
    pad(nm, 16) +
      pad(avg(a).toFixed(1) + ' / ' + mx(a), 18) +
      pad(avg(b).toFixed(1) + ' / ' + mx(b), 18) +
      `${fb.hp} / ${fb.atk} / ${fb.red}%　Lv${fb.lv}　石${fb.stones}　魂${fb.soul}`
  );
  if (fb.stuck) console.log(pad('', 16) + '⚠ 末局打不动（回合 > 120），查数值');
}

console.log('');
console.log('末局三才：' + batch(DIFFS[1][0], 'full', 1)[0].slots.join('　'));
