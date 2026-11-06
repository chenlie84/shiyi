/**
 * 音效：全部用 WebAudio 现场合成，不加载任何音频文件
 *
 * 单文件游戏的音频要么内联成巨大的 base64，要么现场算。
 * 这里选后者 —— 几十行就够，而且随时能调音色。
 */

let AC = null;

export function sfx(type) {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime;
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.connect(g);
    g.connect(AC.destination);

    if (type === 'hit') {
      o.type = 'square';
      o.frequency.setValueAtTime(190, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.09);
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      o.start(t);
      o.stop(t + 0.12);
    } else if (type === 'crit') {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(430, t);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.15);
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
      o.start(t);
      o.stop(t + 0.18);
    } else if (type === 'hurt') {
      o.type = 'triangle';
      o.frequency.setValueAtTime(95, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.15);
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.start(t);
      o.stop(t + 0.19);
    } else if (type === 'win') {
      o.type = 'square';
      o.frequency.setValueAtTime(320, t);
      o.frequency.setValueAtTime(480, t + 0.07);
      o.frequency.setValueAtTime(640, t + 0.14);
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.start(t);
      o.stop(t + 0.32);
    } else if (type === 'heal') {
      o.type = 'sine';
      o.frequency.setValueAtTime(520, t);
      o.frequency.linearRampToValueAtTime(760, t + 0.18);
      g.gain.setValueAtTime(0.04, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.start(t);
      o.stop(t + 0.24);
    } else if (type === 'loot') {
      o.type = 'sine';
      o.frequency.setValueAtTime(280, t);
      o.frequency.exponentialRampToValueAtTime(880, t + 0.26);
      g.gain.setValueAtTime(0.045, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      o.start(t);
      o.stop(t + 0.44);
    }
  } catch (e) {
    /* 音频不可用就算了，不影响玩 */
  }
}
