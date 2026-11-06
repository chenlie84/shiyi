/**
 * 阵亡结算
 */

import { G } from '../game/state.js';
import { openModal, closeModal } from './modal.js';

export function showDeath() {
  openModal(
    '<h3>道消</h3>' +
      '<p>第 <b>' + G.wave + '</b> 波，第 <b>' + G.turn + '</b> 回合倒下。最高 <b>' + G.best + '</b> 波。</p>' +
      '<p class="tip">装备都留着。回去看看是不是气血太薄，或者技能威力不够。</p>' +
      '<div class="row"><button onclick="uiRestart()">重整旗鼓</button></div>'
  );
}

export function closeDeath() {
  closeModal();
}
