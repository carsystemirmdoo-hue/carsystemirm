import fs from "node:fs";
import { chromium } from "/Users/miledulic/Carsystem/carsystem/node_modules/playwright-core/index.mjs";
const BASE="http://localhost:3220";
const brands=["rm","carsystem","baslac","norbin","cosmos-lac","befar","carfit","sata","rupes","3m","sia","molotow"];
const cats=["boje","abrazivi","kitovi","maskiranje","sprejevi","oprema","pribor","lepkovi","ciscenje","zastita","poliranje","radionica"];
const progs=["boje-i-lakovi","priprema-i-abrazivi","pistolji-i-oprema","poliranje","potrosni-materijal"];
const queries=["bezbojni lak","lak","kit","brusni papir","P80","A 2P35","C 2A40","152.596","N15-V25","45-W1010","RX253A","satajet 5000","SATAjet","Agilis","Onyx","polir pasta","maskirna folija","prajmer za plastiku","učvršćivač","razredjivac","3M","sia","Molotow","Mirka","sunđer","zastitno odelo","RAL 9005","sprej crni mat","xyzneki"];
const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:1440,height:900}});const page=await ctx.newPage(); page.setDefaultTimeout(20000);
const status=async()=>{await page.waitForTimeout(900);return (await page.locator('[role=status][aria-live=polite]').first().textContent().catch(()=>null))?.replace(/\s+/g," ").trim()};
const firstCards=async()=>page.evaluate(()=>{const s=document.querySelector('[role=status][aria-live=polite]');const root=s?.parentElement?.parentElement;return [...(root?.querySelectorAll("a[href^='/proizvodi']")??[])].slice(0,3).map(a=>a.getAttribute("aria-label")||a.textContent.replace(/\s+/g," ").trim().slice(0,60))});
const out=[];
for(const b of brands){await page.goto(`${BASE}/katalog?brend=${b}`,{waitUntil:"load"});out.push({kind:"brend",v:b,status:await status(),url:page.url().replace(BASE,"")})}
for(const c of cats){await page.goto(`${BASE}/katalog?kategorija=${c}`,{waitUntil:"load"});out.push({kind:"kategorija",v:c,status:await status(),url:page.url().replace(BASE,"")})}
for(const c of progs){await page.goto(`${BASE}/katalog?program=${c}`,{waitUntil:"load"});out.push({kind:"program",v:c,status:await status(),url:page.url().replace(BASE,"")})}
await page.goto(`${BASE}/katalog`,{waitUntil:"load"});out.push({kind:"all",v:"",status:await status()});
for(const q of queries){await page.goto(`${BASE}/katalog?q=${encodeURIComponent(q)}`,{waitUntil:"load"});const s1=await status();const c1=await firstCards();
  await page.goto(`${BASE}/katalog`,{waitUntil:"load"});await page.fill("#catalog-search",q);const s2=await status();const c2=await firstCards();
  out.push({kind:"q",v:q,urlStatus:s1,typedStatus:s2,cards:c2.length?c2:c1})}
// header search dialog
await page.goto(`${BASE}/`,{waitUntil:"load"});
const btn=page.getByRole("button",{name:/Pretra/}).first();let dialog=null;
try{await btn.click();await page.waitForTimeout(500);await page.keyboard.type("satajet");await page.waitForTimeout(1200);dialog=await page.evaluate(()=>{const d=document.querySelector("[role=dialog]");return d?d.innerText.replace(/\s+/g," ").slice(0,600):null})}catch(e){dialog="ERR "+e}
out.push({kind:"header-search",v:"satajet",text:dialog});
fs.writeFileSync("filters.json",JSON.stringify(out,null,1));
for(const o of out)console.log(o.kind,o.v,"|",o.status??"",o.urlStatus??"",o.typedStatus?"| typed: "+o.typedStatus:"",o.cards?"| "+o.cards.join(" ; "):"",o.text??"",o.url&&o.url!==`/katalog?${o.kind}=${o.v}`?"| URL "+o.url:"");
await browser.close();
