/**
 * 拾遗三选一
 *
 * 每五波掉一次，只能拿一样 —— 让玩家自己决定这一口往哪边长。
 */

import { G } from './state.js';
import { prog } from './dungeon.js';
import { rand } from '../core/rng.js';
import { log, refresh } from '../render/presenter.js';
import { makeItem, reTier, afDef } from './item.js';
import { quenchCost } from './economy.js';
import { registerDex } from './dex.js';
import { RELICS } from '../data/relics.js';
import { RAR_NAME } from '../data/rarity.js';
import { XING } from '../data/elements.js';
import { ITEM_NAMES } from '../data/items.js';

/** 洗三张牌 */
export function rollRelicChoices() {
  const pick = RELICS.slice();
  for (let i = pick.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pick[i], pick[j]] = [pick[j], pick[i]];
  }
  return pick.slice(0, 3);
}

/**
 * 取一张牌并结算
 * @returns {{ok:boolean, text:string}}
 */
export function applyRelic(r) {
  if (!r) return { ok: false, text: '' };
  let text = '';

  if (r.k === 'item') {
    const it = makeItem(prog(), false, rand() < 0.3 ? 4 : 3);
    G.bag.push(it);
    text = '宝光落地：' + RAR_NAME[it.grade] + '，器身蒙尘。';
    log(text, '#a8811f');
  } else if (r.k === 'soul') {
    G.soul += 16;
    text = '器魂 +16（共 ' + G.soul + '）。';
    log(text, '#7a4a8a');
  } else if (r.k === 'stone') {
    G.stones += 120;
    text = '灵石 +120（共 ' + G.stones + '）。';
    log(text, '#3f7a6a');
  } else if (r.k === 'mer') {
    G.pts++;
    text = '得经脉点 1（共 ' + G.pts + '）。';
    log(text, '#a83b2c');
  } else if (r.k === 'quench') {
    // 地火余温：三才上最弱的一条词条，白提一档
    let best = null;
    let bi = null;
    G.slots.forEach((it) => {
      if (!it || it.ident === false) return;
      it.affixes.forEach((a) => {
        const c = quenchCost(a.t);
        if (c && a.t > 1 && (!best || a.t > best.t)) {
          best = a;
          bi = it;
        }
      });
    });
    if (best) {
      const from = best.t;
      reTier(best, best.t - 1);
      text = '地火：' + bi.name + ' 的 ' + afDef(best).n + ' T' + from + ' → T' + best.t + '。';
      log(text, '#c9862f');
    } else {
      G.soul += 20;
      text = '三才上已无可淬之物，化作器魂 +20。';
      log(text, '#7a4a8a');
    }
  } else if (r.k === 'dex') {
    // 古器名录：随机识得一件未见之器，并直接到手
    const miss = [];
    XING.forEach((x) =>
      ITEM_NAMES[x].forEach((nm) => {
        if (!G.dex[nm]) miss.push({ x, nm });
      })
    );

    if (miss.length) {
      const m = miss[Math.floor(rand() * miss.length)];
      const idx = ITEM_NAMES[m.x].indexOf(m.nm);
      let it = null;
      for (let t = 0; t < 60; t++) {
        const c = makeItem(prog(), false, Math.min(5, Math.max(3, Math.round(idx / 1.2) + 2)));
        if (c.base === m.nm) {
          it = c;
          break;
        }
      }
      if (!it) it = makeItem(prog(), false, 4);
      it.base = m.nm;
      it.name = m.nm + (it.broken ? '·残' : '') + '·' + it.y + it.x;
      it.ident = true;
      G.bag.push(it);
      registerDex(it);
      text = '名录所载：' + m.nm + ' 现世。';
      log(text, '#5b7c96');
    } else {
      G.soul += 20;
      text = '名录已满，化作器魂 +20。';
      log(text, '#7a4a8a');
    }
  }

  refresh();
  return { ok: true, text };
}
