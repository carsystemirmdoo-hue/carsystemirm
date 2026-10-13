import fs from "node:fs";
import { chromium } from "/Users/miledulic/Carsystem/carsystem/node_modules/playwright-core/index.mjs";
const t=JSON.parse(fs.readFileSync("templates.json","utf8")).map(x=>x[1]).concat(["/kategorije/bazne-boje","/kategorije/prajmeri-i-punioci","/kategorije/ucvrscivaci-i-razredjivaci","/program/priprema-i-abrazivi","/program/pistolji-i-oprema","/program/poliranje","/program/potrosni-materijal"]);
const b=await chromium.launch();
for(const vp of [{width:1440,height:900},{width:390,height:844}]){
 const ctx=await b.newContext({viewport:vp,isMobile:vp.width<500});const p=await ctx.newPage();p.setDefaultTimeout(60000);
 for(const u of t){
  try{await p.goto("http://localhost:3220"+u,{waitUntil:"load",timeout:60000});
  await p.evaluate(async()=>{const H=Math.min(document.body.scrollHeight,120000);for(let s=0;s<H;s+=350){window.scrollTo({top:s,behavior:"instant"});await new Promise(r=>setTimeout(r,70))}});
  await p.waitForTimeout(1500);
  const r=await p.evaluate(()=>{const out=[];for(const e of document.querySelectorAll("main *, body > div *")){const b=e.getBoundingClientRect();if(b.height<150||b.width<150)continue;const s=getComputedStyle(e);if(s.opacity==="0"||s.visibility==="hidden"){if(e.closest("[aria-hidden=true],dialog,[role=dialog],nav,header"))continue;let par=e.parentElement,hiddenAnc=false;while(par){const ps=getComputedStyle(par);if(ps.opacity==="0"||ps.visibility==="hidden"){hiddenAnc=true;break}par=par.parentElement}if(hiddenAnc)continue;out.push({tag:e.tagName,cls:String(e.className).slice(0,60),attr:[...e.attributes].filter(a=>a.name.startsWith("data-")).map(a=>a.name+"="+a.value).join(" ").slice(0,60),h:Math.round(b.height),txt:e.innerText.replace(/\s+/g," ").slice(0,80)})}}return out});
  if(r.length)console.log(vp.width,u,JSON.stringify(r.slice(0,4)));
  }catch(e){console.log(vp.width,u,"ERR",String(e).slice(0,80))}
 }
 await ctx.close();
}
await b.close();console.log("done");
