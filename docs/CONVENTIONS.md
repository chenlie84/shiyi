# 代码约定

短，且尽量能被工具检查。

---

## 文件

| 规则 | 说明 |
| --- | --- |
| 全小写 + 短横线 | `relic-panel.js`，不写 `relicPanel.js` |
| 一个文件一件事 | `item.js` 只管道具，`economy.js` 只管钱和熔炉 |
| 文件名 ≈ 主要导出 | `waves.js` → `makeWave / layoutMobs / alive` |
| 数据表放 `data/` | 表里只有 `export const`，不写函数逻辑 |

## 导入

组内按层，组间空一行：

```js
import { G, S } from './state.js';              // 同层
import { calcStats } from './stats.js';

import { rand } from '../core/rng.js';          // 下层
import { delay } from '../platform/scheduler.js';

import { log, refresh } from '../render/presenter.js';  // 唯一的跨层出口
```

- 相对路径，**不用别名**（`@/` 之类）—— 让 `grep` 和编辑器都能直接跳
- `game/` 里除了 `render/presenter.js`，不许出现 `../render/` 或 `../ui/`
- 不用 barrel 文件（`index.js` 汇总导出）：多一跳，循环依赖更难查

## 命名

| 位置 | 风格 | 例 |
| --- | --- | --- |
| 数据表 | 全大写下划线 | `PRE`、`RAR_NAME`、`ELEM_SKILL` |
| 函数 | 小驼峰，动词开头 | `makeItem`、`calcStats`、`rollRelicChoices` |
| 布尔 | `is/has/can` 或直接形容词 | `canLink`、`busy`、`over` |
| 常量 | 全大写 | `CV_W`、`GROUND`、`SAVE_KEY` |
| 单字母 | 只在极短作用域 | `G` `S` `e` `q` `st` `p` `m` |

`G`（档案）`S`（舞台）`st`（stats 结果）`q`（器灵/诅咒系数）`e`（五行）这几个
在 `game/` 里通用，跨文件也这么叫，看到就懂。

## JSDoc

只在**签名不显然**的地方写，不为了覆盖率写。

```js
/**
 * 取一张牌并结算
 * @returns {{ok:boolean, text:string}}
 */
export function applyRelic(r) { ... }
```

`jsconfig.json` 里 `checkJs: false` —— 编辑器能吃到类型提示，但不会因为
漏标一个参数就满屏红线。想单独严格检查某个文件，在文件头加 `// @ts-check`。

## 注释

- 文件头写**这个文件负责什么、不负责什么**（比写"工具函数"有用一百倍）
- 魔法数字要写清来历：`S.shake = 0.55` 旁边说明是"普通命中"，
  `hitStop(0.085)` 旁边说明是"暴击" —— 这些数调一次就忘了
- 踩过的坑写成注释留在原地，别只在聊天记录里

## 状态改动

- 改 `G` / `S` 只能发生在 `game/` 里
- `render/` 只读 `S`，改也只改 `S.parts / floats / beams / fx / callouts`
  这些纯表现池（它们由 render 自己创建、自己回收）
- `ui/` 一律通过 `game/` 的函数改数据，改完调 `refresh()`

## 提交

```
make 掉落生成与词条填充分开
fix  首帧怪物站在 x=0，招式打到画面最左
sim  化神档全投入从 8.2 降到 7.0，难度曲线拉直
docs 补分层红线
```

第一段是动词类目（make / fix / sim / docs / refactor / art），第二段是结果。
不做 `update file`、`fix bug` 这种提交。

## 改数值前

先跑一遍基线并存下来：

```bash
npm run sim:seed > .sim-before.txt
# 改 data/ 或 game/stats.js
npm run sim:seed > .sim-after.txt
diff .sim-before.txt .sim-after.txt
```

固定种子（`--seed=7`）之后两次输出可以直接 diff。浮动种子只能看趋势，
不能拿来说"没影响"。
