/**
 * 拾遗 · 试炼台 —— 入口
 *
 * 这里只做三件事：拿画布、把各层接到一起、开跑。
 * 任何玩法规则都不该写在这个文件里。
 */

import './ui/styles.css';
import './ui/world.css';

import { initCanvas } from './render/canvas.js';
import { bindPresenter } from './render/presenter.js';
import { loop } from './render/scene.js';
import { sfx } from './render/sfx.js';
import { floatText, burst } from './render/fx/particles.js';
import { spawnCastFX } from './render/fx/cast.js';
import { spawnBolts } from './render/fx/bolt.js';
import { castCallout } from './render/fx/callout.js';
import { spawnBeams } from './render/fx/beams.js';

import { G, S } from './game/state.js';
import { resetAll } from './game/session.js';
import { bindCombatUI, castSkill } from './game/combat.js';
import { buildSkills } from './game/skills.js';
import { initWorld, rollQuests, W } from './game/world.js';

import { refresh } from './ui/hud.js';
import { log } from './ui/log.js';
import { openModal, closeModal } from './ui/modal.js';
import { showLoot, clearLoot } from './ui/loot.js';
import { showHelp } from './ui/panels.js';
import { showRelicPick } from './ui/relic-panel.js';
import { showDeath, closeDeath } from './ui/death-panel.js';
import { installActions } from './ui/actions.js';
import { installAtlas, openAtlas } from './ui/worldmap.js';
import { showIntro, setIntroDone } from './ui/intro.js';

import { readFlags, FLAGS } from './platform/flags.js';
import { installInput } from './platform/input.js';
import { seed } from './core/rng.js';
import { HELP_KEY } from './config.js';

/** 玩法说明是不是已经看过（localStorage 不可用时当作没看过） */
function seenHelp() {
  try {
    return localStorage.getItem(HELP_KEY) === '1';
  } catch {
    return false;
  }
}
function markHelpSeen() {
  try {
    localStorage.setItem(HELP_KEY, '1');
  } catch {
    /* 隐私模式下写不进去，那就会每次都弹，也没办法 */
  }
}

/** 弹一次玩法说明：只在没看过、且没开 ?nohelp 时 */
function helpOnce() {
  if (FLAGS.nohelp || seenHelp()) return;
  showHelp();
  markHelpSeen();
}

function boot() {
  readFlags();
  if (FLAGS.seed) seed(FLAGS.seed);

  initCanvas('cv');
  // 点地走：画面坐标 + 镜头位置 = 世界坐标（输入层不认识游戏状态，所以这里补上）
  installInput(document.getElementById('cv'), (sx, sy) => {
    S.moveTo = { x: sx + S.cam.x, y: sy + S.cam.y };
  });

  // 把表现层接到 game 上（game 只认这组函数名，不知道 DOM 的存在）
  bindPresenter({
    log,
    refresh,
    floatText,
    burst,
    hitStop: (s) => {
      S.freeze = Math.max(S.freeze, s);
    },
    sfx,
    spawnCastFX,
    spawnBolts,
    castCallout,
    spawnBeams,
    openModal,
    closeModal,
    showLoot,
    clearLoot,
  });

  // 战斗流程里需要 UI 的两个断点：拾遗三选一、阵亡
  bindCombatUI({ showRelicPick, showDeath, closeDeath });

  installActions();
  installAtlas();

  // 调试口：控制台里能直接看运行状态（也方便抓特效截图）
  window.__G = G;
  window.__S = S;
  window.__W = W;

  // 首屏
  resetAll();
  requestAnimationFrame(loop);

  // 世界层：读回独立存档，并把遭遇战的胜/败断点接回战斗流程
  const returning = initWorld();

  /** 「入世」之后：发第一批差事 → 掀开舆图 → 首次玩法说明 */
  function onboard() {
    if (!W.quests.length) rollQuests(3);
    openAtlas();
    helpOnce();
  }
  setIntroDone(onboard);

  // ?auto 跑平衡、?nointro 跑截图与探针，都别让开局流程挡住地宫
  if (!FLAGS.auto && !FLAGS.nointro) {
    if (returning) onboard();
    else showIntro();
  }

  // ?auto —— 自动出招 / 自动配装，跑平衡用
  if (FLAGS.auto) {
    G.autoPick = true;
    window.autoEquip();
    setInterval(() => {
      if (G.busy || G.over || !S.mobs.some((m) => !m.dead)) return;
      // 有钱先鉴 —— 蒙尘的东西佩上了也是白佩
      const un = G.bag.find((i) => i.ident === false);
      if (un && G.stones >= 20) {
        window.identify(un.id);
        return;
      }
      const sk = buildSkills();
      let pick = -1;
      for (let i = 0; i < sk.length; i++) {
        if (sk[i] && sk[i].kind !== 'heal' && sk[i].kind !== 'shield') {
          pick = i;
          break;
        }
      }
      if (pick < 0) for (let i = 0; i < sk.length; i++) if (sk[i]) { pick = i; break; }
      if (pick >= 0) castSkill(pick);
    }, 760);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
