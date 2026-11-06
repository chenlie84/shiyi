/** DOM 短写 */

export const $ = (id) => document.getElementById(id);
export const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/** 弹层根节点：所有 modal 都写在这里 */
export const modalEl = () => $('modal');
export const maskEl = () => $('mask');

/** HTML 转义 —— 器名、词条名以后可能来自外部数据，先挡住 */
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
