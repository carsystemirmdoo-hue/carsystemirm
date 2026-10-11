import fs from "node:fs";
import { chromium } from "/Users/miledulic/Carsystem/carsystem/node_modules/playwright-core/index.mjs";
const BASE="http://localhost:3220";
const pages=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const combos=[["desktop","light",{width:1440,height:900}],["desktop","dark",{width:1440,height:900}],["mobile","light",{width:390,height:844}],["mobile","dark",{width:390,height:844}]];
const browser=await chromium.launch();
for(const [mode,scheme,vp] of combos){
  const ctx=await browser.newContext({viewport:vp,colorScheme:scheme,isMobile:mode==="mobile",hasTouch:mode==="mobile"});
  const page=await ctx.newPage(); page.setDefaultTimeout(60000);
  for(const [name,u] of pages){
    try{await page.goto(BASE+u,{waitUntil:"networkidle",timeout:60000});
      await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){window.scrollTo({top:y,behavior:"instant"});await new Promise(r=>setTimeout(r,80))}window.scrollTo({top:0,behavior:"instant"})});
      await page.waitForTimeout(900);
      await page.screenshot({path:`shots/${name}__${mode}-${scheme}.jpg`,fullPage:true,type:"jpeg",quality:55});
    }catch(e){console.error(name,mode,scheme,String(e).slice(0,120))}
  }
  await ctx.close();
}
await browser.close();console.log("ok");
