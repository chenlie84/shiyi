# 架构

这份文档只讲一件事：**东西该放哪、以及为什么**。
规矩一旦写下来就尽量别绕，绕一次之后就再也回不去了。

---

## 1 分层与依赖方向

```
                  ┌──────────────────────────────┐
   浏览器 ───────► │  main.js（装配，不含规则）     │
                  └───────────┬──────────────────┘
                              ▼
   ┌──────────┐        ┌────────────┐        ┌──────────────┐
   │  ui/     │───────►│  render/   │───────►│  canvas      │
   │ DOM 面板 │        │ 画面 / 音效 │        │  ctx         │
   └────┬─────┘        └─────┬──────┘        └──────────────┘
        │                    │ 只读 S、只调自己的 draw
        │                    ▼
        │              ┌────────────┐
        └─────────────►│   game/    │   ← 逻辑层：只有数，没有像素
                       └──┬──────┬──┘
                          ▼      ▼
                    ┌──────┐  ┌──────┐
                    │ data/│  │ core/│
                    └──────┘  └──────┘
```

四条红线（`npm run check` 会逐条断言）：

| 红线 | 理由 |
| --- | --- |
| `game/` 不许 import `ui/` | 逻辑一旦会开面板，就没法在 node 里跑，也没法做服务器校验 |
| `game/` 只许 import `render/presenter.js` | 见下一节：依赖倒置 |
| `data/` 不许 import 任何逻辑 | 数据表要能被任何人（含未来的服务端、工具脚本）直接吃 |
| `core/` 不许 import 任何内部模块 | 零依赖工具，谁都可以安全引用它，包括测试 |
| `platform/` 只许 import `core/`（和 `config.js` 常量） | 输入、调度、URL 开关都是"贴着浏览器"的东西，一旦知道游戏状态，就没法在无头环境里换掉 |

`ui/` 可以引一切，但**没人可以引 `ui/`**（`main.js` 除外）。
所以 `combat.js` 需要弹「拾遗三选一」时，用的是注入的回调，不是 `import`：

```js
// src/game/combat.js 末尾
let showRelicPick = () => {};
export function bindCombatUI(hooks) {
  if (hooks.showRelicPick) showRelicPick = hooks.showRelicPick;
  // ...
}
```

## 2 依赖倒置：presenter

`game/` 想说「打出了 130 点伤害」时，它并不知道屏幕上要飘字、要震屏、要响一下。
它只调 `presenter.floatText(...)`，而 presenter 默认是**空实现**：

```js
// src/render/presenter.js
const noop = () => {};
let impl = { log: noop, refresh: noop, floatText: noop, /* ... */ };
export function bindPresenter(p) { impl = Object.assign(impl, p); }
export const floatText = (...a) => impl.floatText(...a);
```

`main.js` 在启动时把真实现注入进去；`tools/sim.js` **什么都不注入**。
这带来三个直接好处：

1. 平衡回归可以在 node 里跑纯逻辑，不需要桩 DOM
2. 将来换渲染（Cocos / WebGL / 原生）只换一套 impl，game 一行不改
3. `game/` 里出现 `document` 的瞬间，无头测试立刻炸 —— 免费的架构守卫

presenter 的完整清单（`log / refresh / floatText / burst / hitStop / sfx /
spawnCastFX / castCallout / spawnBeams / openModal / closeModal / showLoot /
clearLoot / showRelic / toast`）就是 game 能对世界说的全部话。

## 3 两个状态对象

```js
G // 一局档案：波次、灵石、行囊、三才、经脉、拾遗录…… 全部可序列化
S // 每帧舞台：怪物、气血、粒子、光柱、镜头抖动…… 不存档
```

- `G` 是**可以 JSON 化的**。要不要做存档，取决于什么时候把 `G` 写进
  `localStorage[SAVE_KEY]`；`SAVE_KEY` 已经在 `config.js` 里留好了。
- `S` 里允许放纯表现对象（`parts / floats / beams / fx / callouts`），
  它们的存在寿命只有几帧，序列化它们毫无意义。
- 约定：**game 层随便读写 S；render / ui 只读，要改就走 game 的函数。**
  唯一例外是 `S.freeze`（打击停顿），由 `main.js` 注入的 `hitStop` 直接写 ——
  因为它是个渲染开关，不是游戏状态。

## 3.5 世界坐标 / 视口坐标 / 镜头

地宫是**一整块地**（`WORLD_W × WORLD_H` = 1800 × 1280），镜头只看得见其中
`CV_W × CV_H` = 900 × 560 的一格（正好是 canvas 的 width/height）。
于是有两套坐标，混用一次就会画歪：

| 名字 | 存在哪 | 谁用 |
| --- | --- | --- |
| **世界坐标** | `S.px / S.py`、`mob.x / mob.y`、弹道的 `x0/x1`、光柱 | 一切进战场的实体 |
| **镜头** | `S.cam.x / S.cam.y` = 视口左上角在世界里的位置 | `game/field.js` 的 `updateCam()` |
| **视口坐标** | 0..`CV_W` / 0..`CV_H` | 气血槽、招式题字、径向暗角 —— 该贴在镜头上的东西 |

渲染因此分**两趟**（`render/scene.js`）：

```js
ctx.save(); ctx.translate(-S.cam.x, -S.cam.y); drawWorld(); ctx.restore(); // 世界趟
drawScreen();                                                             // 屏幕趟
```

世界趟里，人和怪**按脚底 y 排序后再画** —— 站在下面的挡住站在上面的，才有纵深。

镜头带 **96px 死区**：人在画面正中一小块范围内动的时候镜头不动，走出死区才跟，
跟的时候用 0.2 的插值。一直把人钉在正中，玩家会以为"画面在动、我没动"。
换房间／开局时 `S.camSnap = true`，镜头直接归位，不从上一间滑过来。

`platform/input.js` 只管两件事：推杆往哪边（`axis()`）、点了画面哪一点。
它**不认识游戏状态** —— 点地走要加镜头偏移才能得到世界坐标，这步由 `main.js` 注入：

```js
installInput(canvas, (sx, sy) => { S.moveTo = { x: sx + S.cam.x, y: sy + S.cam.y }; });
```

## 4 一次出招的完整链路

```
玩家点按钮
  └─ ui/actions.js  → window.castSkill(i) → game/combat.js castSkill
       ├─ calcStats()            三才结算 → 最终属性、五行、器灵系数
       ├─ buildSkills()          七星技能位 → 招式列表（含链接的辅助技）
       ├─ spawnCastFX(sk)        → render/fx/cast.js 生成特效对象，塞进 S.fx
       ├─ castCallout(sk.name)   → render/fx/callout.js 生成毛笔题字
       ├─ 结算伤害 / 治疗 / 护盾  → 改 S.mobs / S.php，调 floatText、burst、hitStop
       ├─ refresh()              → ui/hud.js 重绘所有面板
       └─ delay(enemyTurn, 520)  → platform/scheduler.js
            └─ 敌人逐个还手（i * 120ms）→ 回合末结算 → G.turn++
```

注意最后一步走的是 `delay()` 而不是 `setTimeout()`。这一层间接是**为了让测试
能同步推进时间**（下一节）。

## 5 时间与无头测试

`platform/scheduler.js` 只暴露一个 `delay(fn, ms)`。浏览器里是真定时器；
`tools/harness.js` 把它换成「优先队列 + 手动 flush」：

```js
setScheduler((fn, ms) => queue.push({ t: clock + ms, id: ++seq, fn }));

// 队列空掉 = 轮到玩家操作了，这就是驱动循环在等的信号
while (queue.length) { /* 取最小 t 的回调，clock = t，执行 */ }
```

于是 `tools/driver.js` 能写出这样的循环：

```js
while (!G.over && G.room <= maxRoom) {
  if (G.busy) { flush(); continue; }   // 敌方回合，推完时间再回来
  manage(policy);                       // 鉴定 / 配装 / 清仓 / 熔炉
  castSkill(pickSkill());               // 玩家出招
  flush();
}
```

同一份 `combat.js`：浏览器里是动画，`npm run sim` 里是每秒几万局的纯数值。

## 6 渲染顺序（`render/scene.js`）

```
世界趟（ctx 已平移 −cam）
  地砖与摆件 → 掉宝光柱 → 【怪物 / 人物 按脚底 y 排序】 → 招式特效 → 粒子 → 飘字

屏幕趟（restore 之后）
  气血槽 → 招式题字 → 径向暗角（以人所在位置为心）

最后
  受击红闪、镜头抖动
```

地砖和摆件**只画视口覆盖到的那几行几列**（`i0..i1 / j0..j1` 由 `S.cam` 算），
世界再大也不影响开销。摆件的位置由格坐标哈希定死，走回来还是那几样东西。

光柱排在人物之前，人就成了逆光剪影 —— 这是刻意的。整个 `drawFX()` 跑在
`globalCompositeOperation = 'lighter'` 下（叠加发光），只有土系的石头会临时
切回 `source-over`，否则会变成一坨发光的黄块。

打击停顿的做法是**把 dt 归零**而不是暂停逻辑：

```js
if (S.freeze > 0) { S.freeze -= raw; dt = 0; }  // 整帧定住，但战斗定时器照走
```

这样"定住"只是画面静止，不会把回合流程锁死。

## 7 扩展点

### 加一种招式特效

1. `data/skills.js` 里加招式（五行 + 类型决定长什么样）
2. `render/palette.js` 的 `ELEM_FX` 补该五行的配色
3. 需要新形态就在 `render/fx/cast.js` 的 `drawFX()` 里加一个 `k`，`spawnCastFX()`
   里按 `sk.kind` 决定用哪个

`game/` 完全不用改 —— 它只负责把 `sk` 递给 `spawnCastFX`。

### 加一张词条

1. `data/affixes.js` 的 `PRE` / `SUF` 加一项，`v:[T5..T1]` 五个档位由弱到强
2. `game/stats.js` 的 `applyMod()` 里把它翻译成属性
3. `ui/format.js` 管显示文案（若有单位，写进 `u`）

### 加一个敌人

只动 `data/mobs.js`。数值受 `G.diff` 与波次缩放，缩放逻辑在 `game/waves.js`。

### 换美术

`render/draw/*` 四个文件（background / hero / mob / hud）是唯一画像素的地方。
将来换成贴图，也只换这四个 + `render/canvas.js`。

### 打包

`vite.config.js` 用 `vite-plugin-singlefile` 把 CSS、JS、字体全部内联，
产出**一个可双击的 `dist/index.html`**。要拆成常规多文件部署，把
`viteSingleFile()` 去掉即可，其余代码不用动。
