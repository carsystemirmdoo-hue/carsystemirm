import fs from "node:fs";
import { chromium } from "/Users/miledulic/Carsystem/carsystem/node_modules/playwright-core/index.mjs";
const BASE="http://localhost:3220";
const [,, mode="mobile", scheme="light", listFile="", outFile="browse.json"] = process.argv;
const P=JSON.parse(fs.readFileSync("pages.json","utf8"));
let urls = listFile ? JSON.parse(fs.readFileSync(listFile,"utf8")) : P.filter(p=>p.status===200&&p.segs).map(p=>p.url);
const vp = mode==="mobile"?{width:390,height:844}:{width:1440,height:900};
const browser=await chromium.launch();
const out=fs.existsSync(outFile)?JSON.parse(fs.readFileSync(outFile,"utf8")):[]; const done=new Set(out.map(o=>o.u)); urls=urls.filter(u=>!done.has(u)); let i=0;
async function worker(){
  const ctx=await browser.newContext({viewport:vp,colorScheme:scheme,deviceScaleFactor:1,isMobile:mode==="mobile",hasTouch:mode==="mobile"});
  const page=await ctx.newPage(); page.setDefaultTimeout(30000); page.on("dialog",d=>d.dismiss().catch(()=>{}));
  let errs=[]; page.on("console",m=>{if(m.type()==="error")errs.push(m.text().slice(0,200))}); page.on("pageerror",e=>errs.push("PAGEERROR "+String(e).slice(0,200)));
  const failed=[]; page.on("response",r=>{if(r.status()>=400&&!r.url().includes("/_next/static"))failed.push(r.status()+" "+r.url().slice(0,200))});
  while(i<urls.length){const u=urls[i++]; errs=[]; failed.length=0;
    try{ await page.goto(BASE+u,{waitUntil:"load",timeout:45000});
      await Promise.race([new Promise(r=>setTimeout(r,15000)), page.evaluate(async()=>{ for(let y=0,n=0;y<document.body.scrollHeight&&n<30;y+=700,n++){window.scrollTo({top:y,behavior:"instant"});await new Promise(r=>setTimeout(r,60))} window.scrollTo({top:0,behavior:"instant"}); })]);
      await page.waitForTimeout(400);
      const r=await Promise.race([new Promise((_,j)=>setTimeout(()=>j(new Error("eval timeout")),20000)), page.evaluate(()=>{const de=document.documentElement;const vw=window.innerWidth;
        const imgs=[...document.images].filter(im=>im.complete&&im.naturalWidth===0&&im.getAttribute("src")).map(im=>im.currentSrc||im.src);
        const over=[];for(const el of document.querySelectorAll("body *")){const b=el.getBoundingClientRect();if(b.width>0&&b.right>vw+2&&getComputedStyle(el).position!=="fixed"){let p=el.parentElement,clipped=false;while(p){const s=getComputedStyle(p);if(/(hidden|auto|scroll|clip)/.test(s.overflowX)){const pb=p.getBoundingClientRect();if(pb.right<=vw+2){clipped=true;break}}p=p.parentElement}if(!clipped)over.push((el.className&&el.className.baseVal===undefined?String(el.className):el.tagName).slice(0,80)+" r="+Math.round(b.right))}}
        return {sw:de.scrollWidth,vw,brokenImgs:imgs.slice(0,10),overflow:over.slice(0,5),theme:de.dataset.theme||null,bg:getComputedStyle(document.body).backgroundColor}})]);
      out.push({u,...r,errs:[...errs].slice(0,5),failed:[...failed].slice(0,5)});
    }catch(e){out.push({u,error:String(e).slice(0,200)})}
    if(out.length%100===0){console.error(out.length+"/"+urls.length);fs.writeFileSync(outFile,JSON.stringify(out))}
  }
  await ctx.close();
}
await Promise.all(Array.from({length:4},worker));
await browser.close();
fs.writeFileSync(outFile,JSON.stringify(out));
console.log("done",out.length);
