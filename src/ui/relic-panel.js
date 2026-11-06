/**
 * 拾遗三选一 —— 每五波弹出
 *
 * 三张牌里只能拿一张，让玩家自己决定这一口往哪边长。
 */

import { G, S } from '../game/state.js';
import { openModal, closeModal } from './modal.js';
import { rollRelicChoices, applyRelic } from '../game/relics.js';
import { startWave } from '../game/combat.js';

let choices = [];
let onPick = null;

/**
 * @param {Function} [after] 取完之后的回调，默认进下一波
 */
export function showRelicPick(after) {
  if (S.relicOpen || G.over === false) return;
  choices = rollRelicChoices();
  onPick = after || startWave;
  S.relicOpen = true;

  let html =
    '<h3>拾　遗</h3>' +
    '<p class="sub2">此处既清，天地间掉下三样东西。只能拿一样。</p>' +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px">';

  choices.forEach((r, i) => {
    html +=
      '<div class="relic" style="border-color:' + r.c + '" onclick="uiTakeRelic(' + i + ')">' +
      '<div style="font-size:13.5px;font-weight:800;letter-spacing:3px;color:' + r.c + '">' + r.n + '</div>' +
      '<div style="font-size:10.5px;color:var(--ink2);line-height:1.65;margin-top:6px">' + r.d + '</div>' +
      '<div class="take" style="color:' + r.c + '">取　之</div></div>';
  });
  html += '</div>';

  openModal(html);

  // 自动模式下随机拿一张，方便跑到高波次做平衡测试
  if (G.autoPick) setTimeout(() => takeRelic(Math.floor(Math.random() * 3)), 400);
}

export function takeRelic(i) {
  const r = choices[i];
  if (!r) return;
  S.relicOpen = false;
  choices = [];
  closeModal();
  applyRelic(r);
  const next = onPick;
  onPick = null;
  if (next) next();
}
