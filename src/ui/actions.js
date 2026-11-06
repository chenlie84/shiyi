/**
 * 界面动作层
 *
 * 所有「按钮按下之后发生什么」都汇总在这里。
 * 页面里的内联 onclick 走一条很薄的桥（installActions 挂到 window），
 * 以后要换成事件委托，只改这个文件即可。
 */

import { $, modalEl } from './dom.js';
import { refresh } from './hud.js';
import { showItem, showForge, openModal, closeModal } from './modal.js';
import { showMeridian, showDex, pickLink, showHelp, showSpell } from './panels.js';
import { takeRelic } from './relic-panel.js';
import { log } from './log.js';
import { G, S } from '../game/state.js';
import { identify, salvage, salvageJunk, forge } from '../game/economy.js';
import { equipFromBag, unequip, sellItem, autoEquip } from '../game/equip.js';
import { onNode, setLink } from '../game/meridian.js';
import { castSkill, restart } from '../game/combat.js';
import { resetAll } from '../game/session.js';
import { makeWave } from '../game/waves.js';
import { sfx } from '../render/sfx.js';

/* ── 鉴定：花灵石 → 摊开给你看 ── */
function uiIdentify(id) {
  const r = identify(id);
  if (!r.ok) return;
  if (r.item.grade >= 4) {
    S.shake = 0.7;
    sfx('crit');
  }
  if (G.autoPick) {
    if (S.modalItem === id) showItem(id);
    return;
  }
  showItem(id);
  const md = modalEl();
  md.classList.remove('reveal');
  void md.offsetWidth;
  md.classList.add('reveal');
}

/* ── 拆解：贵重器要问一声 ── */
function uiSalvage(id) {
  const it = G.bag.find((x) => x.id === id);
  if (it && it.grade >= 3 && !confirm('拆掉「' + (it.name || '未鉴之器') + '」？词条、铭文、器灵都会化成器魂，不可复原。')) {
    return;
  }
  const r = salvage(id);
  if (r.ok && S.modalItem === id) closeModal();
}

/* ── 熔炉：铸 / 淬 / 引 ── */
function uiForge(id, mode, arg) {
  forge(id, mode, arg);
  if (S.modalItem === id) showForge(id);
}

/* ── 佩到三才 ── */
function uiEquip(id) {
  const r = equipFromBag(id);
  if (!r.ok && r.reason === 'unidentified' && r.item) showItem(r.item.id);
}

/* ── 换难度：已经在打的那一波，血量与攻击跟着重排 ── */
function setDiff() {
  G.diff = parseFloat($('diff').value);
  if (S.mobs.length && !G.over) {
    const w = makeWave();
    S.mobs.forEach((m, i) => {
      if (w[i]) {
        m.maxhp = w[i].maxhp;
        m.hp = Math.min(m.hp, w[i].maxhp);
        m.atk = w[i].atk;
      }
    });
  }
  refresh();
}

/* ── 抽屉：三才 / 七星 / 行囊 ── */
export function togglePack(force) {
  const d = document.getElementById('drawer');
  if (!d) return;
  const on = force === undefined ? !d.classList.contains('on') : !!force;
  d.classList.toggle('on', on);
  document.body.classList.toggle('drawer-on', on);
  if (on) {
    S.moveTo = null; // 翻开面板就别再往那个点走了
    refresh(); // 打开时补一次，别让我看到上次的旧数
  }
}

/** 把内联 onclick 需要的东西挂到 window 上 */
export function installActions() {
  Object.assign(window, {
    // 战斗
    castSkill,
    // 面板
    showMeridian,
    showDex,
    showHelp,
    showSpell,
    closeModal,
    pickLink,
    setLink,
    onNode,
    togglePack,
    takeRelic: (i) => takeRelic(i),
    uiTakeRelic: (i) => takeRelic(i),
    // 器
    showItem,
    showForge,
    forge: uiForge,
    identify: uiIdentify,
    salvage: uiSalvage,
    sellItem: (id) => {
      const r = sellItem(id);
      if (r.ok && S.modalItem === id) closeModal();
    },
    equipFromBag: uiEquip,
    unequip,
    salvageJunk,
    // 局
    setDiff,
    resetAll,
    restart,
    uiRestart: restart,
    autoEquip,
    openModal,
    log,
  });

  /* ── 顶栏与抽屉按钮：一处委托，比在每个按钮上写 onclick 稳 ── */
  const ACT = {
    pack: () => togglePack(),
    'pack-close': () => togglePack(false),
    meridian: showMeridian,
    dex: showDex,
    help: showHelp,
    reset: () => resetAll(),
    'salvage-junk': salvageJunk,
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('[data-act]');
    if (btn) {
      const fn = ACT[btn.dataset.act];
      if (fn) {
        e.preventDefault();
        fn();
        return;
      }
    }
    // 点在抽屉外面（画面、顶栏空白）就顺手收起；弹层里的点击不算
    if (!e.target.closest('#drawer') && !e.target.closest('#mask') &&
        document.body.classList.contains('drawer-on')) {
      togglePack(false);
    }
  });

  // 难度下拉：换档立刻重排这一间的怪
  const sel = document.getElementById('diff');
  if (sel) sel.addEventListener('change', setDiff);

  // Esc：先关弹层，再收抽屉
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.body.classList.contains('modal-on')) closeModal();
    else togglePack(false);
  });
}
