import { chromium } from "/Users/miledulic/Carsystem/carsystem/node_modules/playwright-core/index.mjs";
const [,,u,scheme,mode,...ys]=process.argv;const vp=mode==="mobile"?{width:390,height:844}:{width:1440,height:900};
const b=await chromium.launch();const c=await b.newContext({viewport:vp,colorScheme:scheme,isMobile:mode==="mobile",hasTouch:mode==="mobile"});const p=await c.newPage();
await p.goto("http://localhost:3220"+u,{waitUntil:"networkidle",timeout:90000});
for(const y of ys){
  // scroll gradually to y so scroll-triggered sections run
  await p.evaluate(async(Y)=>{for(let s=window.scrollY;s<Y;s+=300){window.scrollTo({top:s,behavior:"instant"});await new Promise(r=>setTimeout(r,90))}window.scrollTo({top:Y,behavior:"instant"})},+y);
  await p.waitForTimeout(1500);
  const info=await p.evaluate(()=>{const el=document.elementFromPoint(innerWidth/2,innerHeight/2);let s=[];let e=el;for(let i=0;i<4&&e;i++){s.push(e.tagName+"."+String(e.className).slice(0,50));e=e.parentElement}return s.join(" < ")});
  console.log(y,info);
  await p.screenshot({path:`probe_${u.replace(/\W+/g,"_")}_${mode}_${scheme}_${y}.jpg`,type:"jpeg",quality:60});
}
await b.close();
