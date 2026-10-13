import { chromium } from "/Users/miledulic/Carsystem/carsystem/node_modules/playwright-core/index.mjs";
const [,,u,out,scheme,mode]=process.argv;const vp=mode==="mobile"?{width:390,height:844}:{width:1440,height:900};
const b=await chromium.launch();const c=await b.newContext({viewport:vp,colorScheme:scheme,isMobile:mode==="mobile",hasTouch:mode==="mobile"});const p=await c.newPage();
await p.goto("http://localhost:3220"+u,{waitUntil:"networkidle",timeout:90000});await p.waitForTimeout(1200);
await p.screenshot({path:out,fullPage:true,clip:{x:0,y:0,width:vp.width,height:6000},type:"jpeg",quality:55});await b.close();
