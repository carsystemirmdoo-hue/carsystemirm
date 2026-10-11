import fs from "node:fs";
const L=JSON.parse(fs.readFileSync("links.json","utf8"));
const list=L.external.filter(r=>String(r.st).startsWith("200")&&!/youtube|studio-one/.test(r.u));let i=0;const out=[];
await Promise.all(Array.from({length:8},async()=>{while(i<list.length){const r=list[i++];try{const x=await fetch(r.u,{headers:{"user-agent":"Mozilla/5.0","range":"bytes=0-1023"},signal:AbortSignal.timeout(20000)});const b=Buffer.from(await x.arrayBuffer());out.push({u:r.u,ct:x.headers.get("content-type"),pdf:b.slice(0,5).toString()==="%PDF-",final:x.url,sample:r.sample})}catch(e){out.push({u:r.u,err:String(e)})}}}));
fs.writeFileSync("ctype.json",JSON.stringify(out));
const c={};for(const o of out){const k=new URL(o.u).hostname+" "+(o.pdf?"PDF":"NOT-PDF:"+o.ct);c[k]=(c[k]||0)+1}console.log(c);
for(const o of out.filter(o=>!o.pdf).slice(0,15))console.log(o.ct,o.u,"<=",o.sample)
