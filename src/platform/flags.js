/**
 * 运行时开关（从 URL 读，或测试里直接改）
 *
 * ?auto     —— 自动出招 / 自动配装 / 自动选拾遗，用来快速跑到高波次
 * ?nohelp   —— 不弹玩法说明
 * ?nointro  —— 跳过开局与舆图，直接进地宫（截图、交互探针等工具用）
 * ?seed=N   —— 固定随机种子，便于复现某一局
 */

export const FLAGS = {
  auto: false,
  nohelp: false,
  nointro: false,
  seed: 0,
};

export function readFlags(search) {
  const q = search || (typeof location !== 'undefined' ? location.search : '');
  FLAGS.auto = q.includes('auto');
  FLAGS.nohelp = q.includes('nohelp');
  FLAGS.nointro = q.includes('nointro');
  const m = q.match(/seed=(\d+)/);
  FLAGS.seed = m ? parseInt(m[1], 10) : 0;
  return FLAGS;
}
