/**
 * 技能快捷栏：气血条正下方那一排方格子
 *
 * 就是传奇那种底部快捷栏 —— 不打开抽屉也能出招。格子只放"现在能放什么":
 * 首字（五行色）、星位序号、预估威力。想看发数、弹道、典故，还得开抽屉看卡片。
 *
 * 这里只负责画，不负责算：技能列表由 hud.refresh() 算好后传进来，
 * 免得一次刷新里 buildSkills 跑两遍。
 */

import { castSkill } from '../game/combat.js';
import { isRune, resolve, skillPower, runeTakenBy, STARS } from '../game/skills.js';
import { COL } from '../data/elements.js';
import { G } from '../game/state.js';

/**
 * @param {Array} sk   buildSkills() 结果（7 位，空位是 null）
 * @param {object} st  calcStats() 结果
 * @param {object} e   三才关系带来的倍率上下文
 */
export function renderSkillBar(sk, st, e) {
  const bar = document.getElementById('hudbar');
  if (!bar) return;
  bar.innerHTML = '';

  sk.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'slot';

    // 空位：三才没配齐
    if (!s) {
      d.className = 'slot off';
      d.innerHTML = '<i class="n">' + (i + 1) + '</i>';
      d.title = STARS[i] + ' · 未成（三才没配齐，先佩三件）';
      bar.appendChild(d);
      return;
    }

    // 符位：不单独放，点了也只是提醒
    if (isRune(s)) {
      const taker = runeTakenBy(i);
      d.className = 'slot rune';
      d.innerHTML = '<i class="n">' + (i + 1) + '</i><b>符</b>';
      d.title =
        s.name +
        '　符不能单独放' +
        (taker != null ? '，挂在 ' + STARS[taker] + ' 上' : '，点法术卡上的「挂符」挂上去');
      d.onclick = () => castSkill(i);
      bar.appendChild(d);
      return;
    }

    const spec = resolve(s, sk);
    const pw = skillPower(s, spec, st.s, e);
    const col = COL[s.elem] || '#e8dfc9';

    d.innerHTML =
      '<i class="n">' + (i + 1) + '</i>' +
      '<b style="color:' + col + '">' + s.name.slice(0, 1) + '</b>' +
      '<i class="pw">' + pw + '</i>';
    d.title =
      s.name + '　' + s.pos + ' · ' + s.from + '\n约 ' + pw + ' 点 · ' +
      spec.proj + ' 发 · ' + (spec.path || '') + (s.desc ? '\n' + s.desc : '');
    if (G.busy) d.classList.add('cool');
    d.onclick = () => castSkill(i);
    bar.appendChild(d);
  });
}
