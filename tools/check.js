#!/usr/bin/env node
/**
 * 结构自检 —— 不跑游戏，只查地基
 *
 *   npm run check
 *
 * 查四件事：
 *   1. 语法     每个 .js 让 node 自己解析一遍
 *   2. 引用     所有 import 指到的文件真的存在
 *   3. 环       模块之间不许绕回自己
 *   4. 分层     data 不许引逻辑、game 不许碰 ui、game → render 只许走 presenter
 *
 * 顺手报一下"导出了但没人用"的符号 —— 通常是重构后的遗骸。
 *
 * 分层规矩写在 docs/ARCHITECTURE.md，这里只是把它变成可执行的断言。
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const TOOLS = join(ROOT, 'tools');

const QUIET = process.argv.includes('--quiet');

let errors = 0;
let warns = 0;

const c = {
  ok: (s) => '\x1b[32m' + s + '\x1b[0m',
  bad: (s) => '\x1b[31m' + s + '\x1b[0m',
  warn: (s) => '\x1b[33m' + s + '\x1b[0m',
  dim: (s) => '\x1b[2m' + s + '\x1b[0m',
};

const rel = (p) => relative(ROOT, p);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === 'legacy') continue;
      walk(p, out);
    } else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

/* ── 1. 语法 ───────────────────────────────────────────────── */

const files = [...walk(SRC), ...walk(TOOLS)];
let syntaxBad = 0;

for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    syntaxBad++;
    errors++;
    const msg = (e.stderr || '').toString().split('\n').slice(0, 4).join('\n');
    console.log(c.bad('✗ 语法 ') + rel(f) + '\n' + c.dim(msg));
  }
}
if (!syntaxBad) console.log(c.ok('✓ 语法') + `  ${files.length} 个模块全部通过`);

/* ── 2 & 3. 引用 + 环 ──────────────────────────────────────── */

const RE_IMPORT =
  /(?:^|[\n;])\s*import\s+(?:[\s\S]*?\sfrom\s*)?['"]([^'"]+)['"]/g;
const RE_EXPORT_FROM = /(?:^|[\n;])\s*export\s+(?:\*|\{[\s\S]*?\})\s*from\s*['"]([^'"]+)['"]/g;
const RE_DYNAMIC = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

const graph = new Map(); // abs file -> [abs deps]
const missing = [];

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const deps = new Set();
  for (const re of [RE_IMPORT, RE_EXPORT_FROM, RE_DYNAMIC]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue; // 裸模块（node 内建等）不管
      const abs = resolve(dirname(f), spec);
      if (!existsSync(abs)) {
        missing.push({ from: f, spec });
        continue;
      }
      deps.add(abs);
    }
  }
  graph.set(f, [...deps]);
}

if (missing.length) {
  errors += missing.length;
  missing.forEach((m) => console.log(c.bad('✗ 找不到 ') + rel(m.from) + ' → ' + m.spec));
} else {
  console.log(c.ok('✓ 引用') + '  所有 import 都能落地');
}

// DFS 找环
const state = new Map(); // 0 未访问 1 在栈上 2 完成
const stack = [];
const cycles = [];

function dfs(f) {
  state.set(f, 1);
  stack.push(f);
  for (const d of graph.get(f) || []) {
    const st = state.get(d) || 0;
    if (st === 1) {
      const i = stack.indexOf(d);
      cycles.push(stack.slice(i).concat(d));
    } else if (st === 0) dfs(d);
  }
  stack.pop();
  state.set(f, 2);
}

for (const f of files) if (!state.get(f)) dfs(f);

if (cycles.length) {
  errors += cycles.length;
  const seen = new Set();
  cycles.forEach((cy) => {
    const key = cy.map(rel).sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    console.log(c.bad('✗ 循环依赖 ') + cy.map(rel).join(' → '));
  });
} else {
  console.log(c.ok('✓ 无环') + '  模块图是 DAG');
}

/* ── 4. 分层 ───────────────────────────────────────────────── */

/** 某文件属于哪一层 */
function layerOf(abs) {
  const r = relative(SRC, abs).split('/');
  if (r.length === 1) return 'root'; // src/config.js、src/main.js
  return r[0]; // core / data / platform / game / render / ui
}

/**
 * 允许的跨层引用。
 * 「—」= 不许引。
 */
const RULES = {
  core: { data: false, platform: false, game: false, render: false, ui: false },
  data: { core: false, platform: false, game: false, render: false, ui: false },
  platform: { data: false, game: false, render: false, ui: false },
  game: { render: 'presenter', ui: false }, // 只许经 presenter 说话
  render: { ui: false },
  ui: {},
  root: {},
};

const layerBad = [];

for (const [from, deps] of graph) {
  const la = layerOf(from);
  const rule = RULES[la];
  if (!rule) continue;

  for (const d of deps) {
    if (!d.startsWith(SRC)) continue; // 引到 tools 之外的东西不管
    const lb = layerOf(d);

    if (lb === 'root') continue; // config.js 谁都能引
    if (lb === 'ui' && la !== 'ui' && la !== 'root') {
      layerBad.push({ from, d, why: `只有 ui 层才能引 ui（${la} 不许）` });
      continue;
    }
    if (lb === 'game' && (la === 'render' || la === 'core' || la === 'data' || la === 'platform')) {
      // render 读 game 状态是允许的；core/data/platform 反过来引 game 不行
      if (la !== 'render') {
        layerBad.push({ from, d, why: `${la} 不该反过来依赖 game` });
      }
      continue;
    }
    const allow = rule[lb];
    if (allow === false) {
      layerBad.push({ from, d, why: `${la} 层禁止引用 ${lb} 层` });
    } else if (typeof allow === 'string' && basename(d, '.js') !== allow) {
      layerBad.push({ from, d, why: `game 只能经 render/${allow}.js 触达表现层` });
    }
  }
}

if (layerBad.length) {
  errors += layerBad.length;
  layerBad.forEach((v) =>
    console.log(c.bad('✗ 分层 ') + rel(v.from) + ' → ' + rel(v.d) + c.dim('　' + v.why))
  );
} else {
  console.log(c.ok('✓ 分层') + '  data/core 纯净，game 未越界到 ui 或具体渲染');
}

/* ── 5. 没人用的导出（只提示） ─────────────────────────────── */

const RE_EXPORT_DECL = /\bexport\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g;
const RE_EXPORT_LIST = /\bexport\s*\{([^}]*)\}/g;
// 分开写：具名 import 和默认 import，免得被 `import './x.css'` 这种副作用导入带跑
const RE_IMPORT_NAMED = /\bimport\s*\{([^}]*)\}\s*from\s*['"]/g;
const RE_IMPORT_DEFAULT = /\bimport\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\})?\s*from\s*['"]/g;

const exportNames = new Map(); // file -> Set(names)
const importedNames = new Set();

/** 'a, b as c, {d}' → ['a','b','d'] */
function splitNames(clause) {
  return clause
    .replace(/[{}]/g, ' ')
    .split(',')
    .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
    .filter((nm) => /^[A-Za-z_$][\w$]*$/.test(nm));
}

for (const f of files) {
  const src = readFileSync(f, 'utf8');

  const set = new Set();
  let m;

  RE_EXPORT_DECL.lastIndex = 0;
  while ((m = RE_EXPORT_DECL.exec(src))) set.add(m[1]);

  RE_EXPORT_LIST.lastIndex = 0;
  while ((m = RE_EXPORT_LIST.exec(src))) splitNames(m[1]).forEach((nm) => set.add(nm));

  exportNames.set(f, set);

  RE_IMPORT_NAMED.lastIndex = 0;
  while ((m = RE_IMPORT_NAMED.exec(src))) splitNames(m[1]).forEach((nm) => importedNames.add(nm));

  RE_IMPORT_DEFAULT.lastIndex = 0;
  while ((m = RE_IMPORT_DEFAULT.exec(src))) splitNames(m[1]).forEach((nm) => importedNames.add(nm));
}

/**
 * 明知没人用、但故意留着的导出。
 * 作用不是"消灭提示"，而是把提示变成信号：名单之外的孤儿导出一定是重构留下的残骸。
 */
const KNOWN_UNUSED = new Set([
  // 表 / 常量：拆文件时留全，保证数据表本身完整
  'CV_W', 'CV_H', 'SAVE_KEY', 'KE',
  // 数学与随机小工具：做新特效、新掉落时会用到
  'lerp', 'easeOut', 'easeIn', 'TAU',
  'chance', 'randRange', 'jitter',
  // 预留接口：经脉连招候选、流派命名、五行配色
  'linkCandidates', 'schoolName', 'elemColor',
  // 测试钩子：切回真实时钟、卸掉全部表现
  'useRealClock', 'resetPresenter',
  // DOM 小工具
  '$$', 'esc',
]);

const unused = [];
for (const [f, names] of exportNames) {
  if (basename(f) === 'main.js') continue; // 入口本来就是终点
  const src = readFileSync(f, 'utf8');
  for (const nm of names) {
    if (importedNames.has(nm)) continue;
    if (KNOWN_UNUSED.has(nm)) continue;
    // 同一个文件里出现过两次以上 = 本文件自己在用
    const hits = src.split(new RegExp('\\b' + nm.replace(/\$/g, '\\$') + '\\b')).length - 1;
    if (hits > 1) continue;
    unused.push({ f, nm });
  }
}

if (unused.length) {
  warns += unused.length;
  console.log(c.warn('⚠ 未被引用的导出 ') + `共 ${unused.length} 个`);
  if (!QUIET) {
    const byFile = new Map();
    unused.forEach((u) => {
      if (!byFile.has(u.f)) byFile.set(u.f, []);
      byFile.get(u.f).push(u.nm);
    });
    for (const [f, list] of byFile) console.log('   ' + rel(f) + c.dim('　' + list.join(', ')));
  }
} else {
  console.log(c.ok('✓ 导出') + '  没有孤儿导出');
}

/* ── 收尾 ──────────────────────────────────────────────────── */

console.log('');
if (errors) {
  console.log(c.bad(`✗ ${errors} 个错误`) + (warns ? c.warn(`, ${warns} 个提示`) : ''));
  process.exit(1);
}
console.log(c.ok('✓ 地基检查通过') + (warns ? c.warn(`　（${warns} 个提示）`) : ''));
