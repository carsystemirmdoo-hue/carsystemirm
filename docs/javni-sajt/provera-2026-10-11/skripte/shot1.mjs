import { chromium } from "/Users/miledulic/Carsystem/carsystem/node_modules/playwright-core/index.mjs";
const [,,u,out,scheme]=process.argv;
const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844},colorScheme:scheme,isMobile:true,hasTouch:true});const p=await c.newPage();
await p.goto("http://localhost:3220"+u,{waitUntil:"networkidle",timeout:90000});
await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){window.scrollTo({top:y,behavior:"instant"});await new Promise(r=>setTimeout(r,60))}window.scrollTo({top:0,behavior:"instant"})});
await p.waitForTimeout(800);await p.screenshot({path:out,fullPage:true});await b.close();
