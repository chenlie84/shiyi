/**
 * 走位输入：键盘推杆 + 点地走路
 *
 * 只管"玩家想往哪走"，不碰位置本身（那在 game/field.js）。
 * 读键盘是浏览器的事，所以归 platform —— 于是这里一个游戏状态都不许引：
 * 点地的坐标换算由组合根注入（它知道镜头在哪）。
 */

import { CV_W, CV_H } from '../config.js';

const KEY_LEFT = ['ArrowLeft', 'a', 'A', 'h', 'H'];
const KEY_RIGHT = ['ArrowRight', 'd', 'D', 'l', 'L'];
const KEY_UP = ['ArrowUp', 'w', 'W', 'k', 'K'];
const KEY_DOWN = ['ArrowDown', 's', 'S', 'j', 'J'];

const held = new Set();

/** 焦点在输入框里就别抢方向键 */
function typing(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
}

function onKey(e, down) {
  if (typing(e)) return;
  const k = e.key;
  const known =
    KEY_LEFT.includes(k) || KEY_RIGHT.includes(k) || KEY_UP.includes(k) || KEY_DOWN.includes(k);
  if (!known) return;
  // 方向键默认会滚页面，这里全部吃掉
  e.preventDefault();
  if (down) held.add(k);
  else held.delete(k);
}

const any = (list) => list.some((k) => held.has(k));

/** 面板挡着画面：走位要停，妖魔的自主寻敌也该停，别在翻背包时挨打 */
export function uiPaused() {
  const b = document.body.classList;
  return b.contains('modal-on') || b.contains('drawer-on') ||
    b.contains('intro-on') || b.contains('atlas-on');
}

/**
 * 当前推杆，−1..1。
 * 开着弹层或抽屉就不许走 —— 那时玩家在翻面板，方向键该留给滚动条。
 */
export function axis() {
  let x = 0;
  let y = 0;
  if (uiPaused()) return { x, y };
  if (any(KEY_LEFT)) x -= 1;
  if (any(KEY_RIGHT)) x += 1;
  if (any(KEY_UP)) y -= 1; // 屏幕上 = 世界 y 变小
  if (any(KEY_DOWN)) y += 1;
  return { x, y };
}

/**
 * 装输入
 * @param {HTMLCanvasElement} canvas
 * @param {(x: number, y: number) => void} onTap 点了画面哪一点（画布设计坐标）
 */
export function installInput(canvas, onTap) {
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  // 失焦时把按键状态清干净，否则切回来会一直往一个方向走
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    // 画布可能被 CSS 缩放过，得换算回设计分辨率
    const sx = ((e.clientX - r.left) / r.width) * CV_W;
    const sy = ((e.clientY - r.top) / r.height) * CV_H;
    if (onTap) onTap(sx, sy);
  });
}
