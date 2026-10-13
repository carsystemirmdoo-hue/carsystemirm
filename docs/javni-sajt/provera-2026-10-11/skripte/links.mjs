import fs from "node:fs";
const BASE="http://localhost:3220";
const P=JSON.parse(fs.readFileSync("pages.json","utf8"));
const crawled=new Map(P.map(p=>[p.url,p.status]));
const internal=new Map(), external=new Map(), imgs=new Map(), mailtel=new Map();
for(const p of P){ if(!p.hrefs) continue;
  for(const h of p.hrefs){ if(/^(mailto|tel):/.test(h)){mailtel.set(h,(mailtel.get(h)||0)+1);continue}
    if(/^https?:/.test(h)&&!h.startsWith("https://carsystemirm.com")){ if(!external.has(h)) external.set(h,[]); external.get(h).push(p.url); continue }
    if(h.startsWith("#")) continue;
    const u=h.replace("https://carsystemirm.com",""); if(!internal.has(u)) internal.set(u,[]); internal.get(u).push(p.url);}
  for(const i of p.imgs){ if(!i.src) continue; if(!imgs.has(i.src)) imgs.set(i.src,[]); imgs.get(i.src).push(p.url)}
  if(p.ogImage){const u=p.ogImage.replace("https://carsystemirm.com",""); if(!imgs.has(u)) imgs.set(u,[]); imgs.get(u).push(p.url)}
}
async function check(map, mk){ const out=[]; const list=[...map.keys()]; let i=0;
  await Promise.all(Array.from({length:8},async()=>{while(i<list.length){const u=list[i++]; let st;
    if(crawled.has(u)&&mk==="int") st=crawled.get(u); else { try{ const r=await fetch(mk==="ext"?u:BASE+u,{redirect:"manual",method:mk==="ext"?"HEAD":"GET",headers:{"user-agent":"Mozilla/5.0 carsystem-audit"},signal:AbortSignal.timeout(20000)}); st=r.status; if(st>=300&&st<400) st+=" -> "+r.headers.get("location"); if(mk==="ext"&&(r.status===405||r.status===403)){const r2=await fetch(u,{headers:{"user-agent":"Mozilla/5.0","range":"bytes=0-0"},signal:AbortSignal.timeout(20000)});st=r2.status+" (GET)"} else if(mk!=="ext") await r.arrayBuffer().catch(()=>{}); }catch(e){st="ERR "+e.name}}
    out.push({u,st,refs:map.get(u).length,sample:map.get(u)[0]});}}));
  return out;}
const res={internal:await check(internal,"int"), images:await check(imgs,"img")};
if(process.argv[2]==="ext") res.external=await check(external,"ext");
res.mailtel=[...mailtel.entries()];
fs.writeFileSync("links.json",JSON.stringify(res));
for(const k of ["internal","images","external"]) if(res[k]) { const c={}; for(const r of res[k]){const s=String(r.st).split(" ")[0]; c[s]=(c[s]||0)+1} console.log(k,res[k].length,c); }
console.log(res.mailtel);
