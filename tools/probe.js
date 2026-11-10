#!/usr/bin/env node
/** 交互探针：实测「三才卸下 / 熔炉 / 经脉」三步，抓页面异常 */
import { spawn } from 'node:child_process';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9343;
const URL = 'http://127.0.0.1:5173/?nohelp&nointro&seed=7';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--hide-scrollbars','--window-size=1000,900',`--remote-debugging-port=${PORT}`,'--user-data-dir=/tmp/shiyi_probe_'+Date.now(),'about:blank'], {stdio:'ignore'});
async function sock(){for(let i=0;i<80;i++){try{const l=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page');if(p&&p.webSocketDebuggerUrl)return p.webSocketDebuggerUrl;}catch{}await sleep(150);}throw new Error('no cdp');}
let seq=0;const pending=new Map();const errs=[];
async function main(){
  const ws=new WebSocket(await sock());
  await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
  ws.addEventListener('message',(ev)=>{const m=JSON.parse(ev.data);
    if(m.method==='Runtime.exceptionThrown'){const d=m.params.exceptionDetails;errs.push((d.exception&&d.exception.description)||d.text);return;}
    const p=m.id&&pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.rej(new Error(m.error.message)):p.res(m.result);});
  const rpc=(method,params={})=>new Promise((res,rej)=>{const id=++seq;pending.set(id,{res,rej});ws.send(JSON.stringify({id,method,params}));});
  await rpc('Page.enable');await rpc('Runtime.enable');
  await rpc('Page.navigate',{url:URL});await sleep(1600);
  const run=async(body)=>{const r=await rpc('Runtime.evaluate',{expression:`(async()=>{${body}})()`,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text+' '+(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||''));return r.result.value;};

  console.log('准备：装配 + 开抽屉');
  await run(`window.autoEquip(); window.togglePack(true); return 1;`);
  await sleep(300);

  // ① 三才槽点击 → 装备详情
  console.log('\n① 点三才第 1 格');
  console.log('  结果:', await run(`
    const s=document.querySelectorAll('#slots .slot')[0];
    s.click();
    return { maskOn:document.getElementById('mask').classList.contains('on'),
             modalLen:document.getElementById('modal').innerHTML.length,
             hasX:!!document.querySelector('#modal .mx'),
             hasUnload:document.getElementById('modal').innerHTML.includes('卸下') };
  `));
  // ② 点卸下
  console.log('\n② 点「卸下」');
  console.log('  结果:', await run(`
    const b=[...document.querySelectorAll('#modal button')].find(x=>x.textContent.includes('卸下'));
    if(!b) return {err:'找不到卸下按钮'};
    b.click();
    return { slot0:window.__G.slots[0]===null, bagLen:window.__G.bag.length,
             maskOn:document.getElementById('mask').classList.contains('on') };
  `));
  // ③ 行囊第一件的「炉」
  console.log('\n③ 点行囊第一件「炉」');
  console.log('  结果:', await run(`
    window.closeModal && window.closeModal();
    const b=[...document.querySelectorAll('#bag button')].find(x=>x.textContent.includes('炉'));
    if(!b) return {err:'找不到炉按钮'};
    b.click();
    return { maskOn:document.getElementById('mask').classList.contains('on'),
             modalLen:document.getElementById('modal').innerHTML.length,
             hasCast:document.getElementById('modal').innerHTML.includes('铸') };
  `));
  // ④ 熔炉「铸」
  console.log('\n④ 点熔炉「铸」');
  console.log('  结果:', await run(`
    const b=[...document.querySelectorAll('#modal button')].find(x=>x.textContent.trim().startsWith('铸'));
    if(!b) return {err:'找不到铸按钮', html:document.getElementById('modal').innerHTML.slice(0,200)};
    const before=window.__G.stones;
    b.click();
    return { stonesBefore:before, stonesAfter:window.__G.stones,
             maskOn:document.getElementById('mask').classList.contains('on') };
  `));
  // ⑤ 经脉
  console.log('\n⑤ 点顶栏「经脉」');
  console.log('  结果:', await run(`
    window.closeModal && window.closeModal();
    const b=document.querySelector('[data-act="meridian"]');
    b.click();
    return { maskOn:document.getElementById('mask').classList.contains('on'),
             modalLen:document.getElementById('modal').innerHTML.length,
             hasSvg:!!document.querySelector('#modal svg'),
             hasX:!!document.querySelector('#modal .mx') };
  `));

  // ⑥ 其余面板逐个打开，确保统一改造没漏（先重新装满三才，才有法术可看）
  console.log('\n⑥ 其余面板');
  await run(`window.autoEquip(); return 1;`);
  for (const [nm, code] of [
    ['拾遗录', 'window.showDex()'],
    ['法术详情', 'window.showSpell(0)'],
    ['挂符', 'window.pickLink(0)'],
    ['玩法', 'window.showHelp()'],
    ['装备详情', 'window.showItem(window.__G.bag[0].id)'],
    ['熔炉', 'window.showForge(window.__G.bag[0].id)'],
  ]) {
    const r = await run(`window.closeModal&&window.closeModal();${code};return {on:document.getElementById('mask').classList.contains('on'),len:document.getElementById('modal').innerHTML.length,x:!!document.querySelector('#modal .mx')};`);
    console.log('  ' + nm + ':', JSON.stringify(r));
  }

  // ⑦ 经脉点节点
  console.log('\n⑦ 经脉点节点');
  console.log('  ', await run(`
    window.closeModal&&window.closeModal();
    window.__G.pts=3;
    window.showMeridian();
    const n=document.querySelector('#modal .node.on');
    if(!n) return {err:'没有可点节点'};
    const before=Object.keys(window.__G.mer).length;
    n.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    return {before,after:Object.keys(window.__G.mer).length,pts:window.__G.pts};
  `));

  await sleep(300);
  console.log('\n页面异常：', errs.length? errs.join('\n---\n') : '无');
  ws.close();chrome.kill();
}
main().catch(e=>{console.error('失败：'+e.message);console.error(errs.join('\n'));chrome.kill();process.exit(1);});
