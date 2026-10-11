import fs from "node:fs";
const P=JSON.parse(fs.readFileSync("pages.json","utf8"));
const urls=P.filter(p=>p.status===200&&p.segs&&p.url.startsWith("/proizvodi/")&&!p.url.includes("varijanta")).map(p=>p.url);
const dec=s=>s.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&nbsp;/g," ");
const strip=s=>dec(s.replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim();
const out=[];let i=0;
await Promise.all(Array.from({length:8},async()=>{while(i<urls.length){const u=urls[i++];const h=(await (await fetch("http://localhost:3220"+u)).text()).replace(/<script[\s\S]*?<\/script>/g,"");
 const dls=[...h.matchAll(/<dl[^>]*>([\s\S]*?)<\/dl>/g)].map(m=>[...m[1].matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)].map(x=>[strip(x[1]),strip(x[2])]));
 out.push({u,dls});}}));
fs.writeFileSync("dl.json",JSON.stringify(out));
const norm=l=>l.toLowerCase().replace(/\s*\(.*?\)\s*/g,"").trim();
const eng=/\b(months?|hours?|weeks?|years?|days?|at \d|approx|dust|touch|dry|free|with|and|the|min\.)\b|\d\.\d/i;
let dup=0,en=0,empty=0;const dupEx={},enEx={},byBrand={};
for(const o of out){const b=(o.u.match(/\/proizvodi\/(?:grupa\/)?([a-z]+)/)||[])[1];const st=byBrand[b]??={pages:0,dupPages:0,enPages:0,emptyPages:0};st.pages++;let d=false,e=false,em=false;
 for(const dl of o.dls){const seen=new Map();for(const [k,v] of dl){const n=norm(k);if(seen.has(n)){d=true;const key=k+" ";dupEx[n]=(dupEx[n]||0)+1}seen.set(n,v);if(eng.test(v)){e=true;enEx[v.slice(0,40)]=(enEx[v.slice(0,40)]||0)+1}if(!v)em=true}}
 if(d){dup++;st.dupPages++}if(e){en++;st.enPages++}if(em){empty++;st.emptyPages++}}
console.log({pages:out.length,dup,en,empty});console.table(byBrand);
console.log(Object.entries(dupEx).sort((a,b)=>b[1]-a[1]).slice(0,25));
console.log(Object.entries(enEx).sort((a,b)=>b[1]-a[1]).slice(0,40));
