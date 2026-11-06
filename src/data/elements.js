/**
 * 五行与三才：生克关系、倍率、配色、词条倾向
 *
 * 纯数据，不含逻辑。调平衡只改这里。
 */
export const XING=['木','火','土','金','水'];
export const SHENG={木:'火',火:'土',土:'金',金:'水',水:'木'};
export const KE={木:'土',土:'水',水:'火',火:'金',金:'木'};
export const COL={木:'#4d8a5e',火:'#b8432f',土:'#a8811f',金:'#5b7c96',水:'#6b4a7a'};
export const MULT={生:2,逆生:1,比和:1,克:0.25};
export const SHA_LOSS=0.75;

/* 五行底子倾向：同一种五行，更容易长出贴合它的词条。
   金主锐 → 攻击/破防；木主生 → 气血/噬血；水主柔 → 法攻/减伤；
   火主烈 → 攻击/暴伤；土主厚 → 防御/反伤。 */
export const ELEM_PREF={
  金:{pre:['atk','atk','def'],   suf:['pen','pen','crit','critDmg','inc']},
  木:{pre:['hp','hp','atk'],     suf:['leech','leech','red','dbl','inc']},
  水:{pre:['mag','mag','hp'],    suf:['red','red','leech','leech','dbl']},
  火:{pre:['atk','atk','mag'],   suf:['critDmg','critDmg','inc','crit','dbl']},
  土:{pre:['def','def','hp'],    suf:['reflect','reflect','red','leech','inc']},
};
