import fs from "node:fs";
const out=JSON.parse(fs.readFileSync("dl.json","utf8"));const inv=JSON.parse(fs.readFileSync("inventory.json","utf8"));
const by=new Map();for(const p of inv.products){by.set(p.canonical,p);by.set("/proizvodi/"+p.slug,p)}
const fam=new Map(inv.families.map(f=>[ "/proizvodi/grupa/"+f.slug,f]));
const brandOf=u=>by.get(u)?.brand ?? (u.match(/grupa\/(baslac|cosmos-lac|rm|norbin|carsystem|carfit|befar|sata|rupes)/)||[])[1] ?? "?";
const norm=l=>l.toLowerCase().replace(/\s*\(.*?\)\s*/g,"").trim();
const eng=/\b(months?|hours?|weeks?|years?|days?|at \d+|approx\.?|dust[- ]?free|touch[- ]?dry|with|and|the)\b/i;
const decpt=/\d\.\d+\s?(mm|bar|h|kg|l|L|µm|μm|min|s)\b|\d\.\d+\s?-|-\d\.\d/;
const res=[];
for(const o of out){const b=brandOf(o.u);const dups=[],ens=[],dps=[];
 for(const dl of o.dls){const seen=new Map();for(const [k,v] of dl){const n=norm(k);if(seen.has(n)&&seen.get(n)!==v)dups.push(`${k}: „${seen.get(n)}” / „${v}”`);seen.set(n,v);if(eng.test(v))ens.push(`${k}: ${v}`);else if(decpt.test(v))dps.push(`${k}: ${v}`)}}
 res.push({u:o.u,b,dups,ens,dps});}
fs.writeFileSync("dl-findings.json",JSON.stringify(res));
const agg={};for(const r of res){const a=agg[r.b]??={pages:0,dup:0,en:0,decimalPoint:0};a.pages++;if(r.dups.length)a.dup++;if(r.ens.length)a.en++;if(r.dps.length)a.decimalPoint++}
console.table(agg);
for(const b of Object.keys(agg)){const ex=res.filter(r=>r.b===b&&(r.dups.length||r.ens.length||r.dps.length)).slice(0,2);for(const e of ex)console.log(b,e.u,"| dup:",e.dups.slice(0,2).join(" ; "),"| en:",e.ens.slice(0,2).join(" ; "),"| dp:",e.dps.slice(0,2).join(" ; "))}
