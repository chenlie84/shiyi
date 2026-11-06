/**
 * 经脉图：人形十二穴与前置关系
 *
 * 纯数据，不含逻辑。调平衡只改这里。
 */
/* ---------- 经脉：人形十二穴 ---------- */
/* 会阴为总根，任督上行入百会，两臂由膻中分出，下肢由会阴下行 */
export const MER=[
  {id:'huiyin',  n:'会阴',  x:160, y:246, req:null,        t:'hp',      v:30, d:'气血 +30'},
  {id:'qihai',   n:'气海',  x:160, y:208, req:'huiyin',    t:'hpPct',   v:12, d:'气血 +12%'},
  {id:'zhongwan',n:'中脘',  x:160, y:170, req:'qihai',     t:'def',     v:4,  d:'防御 +4'},
  {id:'danzhong',n:'膻中',  x:160, y:132, req:'zhongwan',  t:'red',     v:6,  d:'减伤 +6%'},
  {id:'chengjiang',n:'承浆',x:160, y:94,  req:'danzhong',  t:'healB',   v:15, d:'疗愈 +15%'},
  {id:'baihui',  n:'百会',  x:160, y:46,  req:'chengjiang',t:'sk',      v:1,  d:'全技阶 +1'},
  {id:'jianjing',n:'肩井',  x:126, y:106, req:'danzhong',  t:'atk',     v:4,  d:'攻击 +4'},
  {id:'quchi',   n:'曲池',  x:108, y:166, req:'jianjing',  t:'crit',    v:6,  d:'暴击 +6%'},
  {id:'rjianjing',n:'右肩井',x:194, y:106,req:'danzhong',  t:'mag',     v:4,  d:'法攻 +4'},
  {id:'rquchi',  n:'右曲池',x:212, y:166, req:'rjianjing', t:'critDmg', v:20, d:'暴伤 +20%'},
  {id:'zusanli', n:'足三里',x:160, y:332, req:'huiyin',    t:'reflect', v:10, d:'反伤 +10%'},
  {id:'yongquan',n:'涌泉',  x:160, y:406, req:'zusanli',   t:'dbl',     v:8,  d:'连击 +8%'},
];
