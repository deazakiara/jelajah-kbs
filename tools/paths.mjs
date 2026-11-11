import fs from 'fs';
const DATA = new Function(fs.readFileSync('src/data.js','utf8') + '; return DATA;')();
const N = DATA.nodes; const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const ADJ={}; DATA.edges.forEach(([a,b,f={}])=>{ (ADJ[a]=ADJ[a]||[]).push({n:b,d:d(N[a],N[b]),f}); (ADJ[b]=ADJ[b]||[]).push({n:a,d:d(N[a],N[b]),f}); });
function dj(src, closed){ const D={},P={},Q=new Set(Object.keys(N)); for(const k of Q) D[k]=1e9; D[src]=0; while(Q.size){let u=null,b=1e9; for(const k of Q) if(D[k]<b){b=D[k];u=k;} if(!u) break; Q.delete(u); for(const e of ADJ[u]){ if(closed && e.f.id) continue; const nd=D[u]+e.d; if(nd<D[e.n]){D[e.n]=nd;P[e.n]=u;} } } return {D,P}; }
for (const src of ['A','AB','T']) { const o=dj(src,false), c=dj(src,true); for (const z of DATA.zones) { const diff=(c.D[z.node]-o.D[z.node])*5; if (diff>5) console.log(src, z.id, Math.round(o.D[z.node]*5)+'m', '+'+Math.round(diff)+'m'); } }
