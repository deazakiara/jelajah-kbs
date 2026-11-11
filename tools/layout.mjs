import fs from 'fs';
const src = fs.readFileSync(new URL('../src/data.js', import.meta.url), 'utf8');
const DATA = new Function(src + '; return DATA;')();
const W = DATA.world;
function inPoly(p, poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,zi]=poly[i],[xj,zj]=poly[j];if(((zi>p[1])!=(zj>p[1]))&&(p[0]<(xj-xi)*(p[1]-zi)/(zj-zi)+xi))c=!c;}return c;}
function segDist(p,a,b){const vx=b[0]-a[0],vz=b[1]-a[1];const t=Math.max(0,Math.min(1,((p[0]-a[0])*vx+(p[1]-a[1])*vz)/(vx*vx+vz*vz)));const x=a[0]+t*vx,z=a[1]+t*vz;return Math.hypot(p[0]-x,p[1]-z);}
function inLake(p,pad=0){return W.lakes.some(l=>((p[0]-l.c[0])/(l.rx+pad))**2+((p[1]-l.c[1])/(l.rz+pad))**2<1);}
const issues=[];
const skip=new Set(['plaza','perahu','aoudad','gerbang','selatan','pos12']);
for(const z of DATA.zones){ if(!inPoly(z.pos,W.land)) issues.push('zone outside land '+z.id); if(!DATA.nodes[z.node]) issues.push('bad node '+z.id);
  for(const z2 of DATA.zones){ if(z2.id<=z.id) continue; const d=Math.hypot(z.pos[0]-z2.pos[0],z.pos[1]-z2.pos[1]); if(d<z.r+z2.r+0.5 && !skip.has(z.id)&&!skip.has(z2.id)) issues.push(`overlap ${z.id}-${z2.id} d=${d.toFixed(1)}`);}
  if(!skip.has(z.id) && inLake(z.pos, z.r)) issues.push('zone near lake '+z.id);
}
for(const [id,p] of Object.entries(DATA.nodes)){ if(id!=='PL' && !inPoly(p,W.land)) issues.push('node outside '+id); if(inLake(p,0.6)) issues.push('node in lake '+id);}
for(const e of DATA.edges){const a=DATA.nodes[e[0]],b=DATA.nodes[e[1]]; if(!a||!b){issues.push('bad edge '+e);continue;}
  for(const z of DATA.zones){ if(skip.has(z.id)) continue; const d=segDist(z.pos,a,b); if(d<z.r+0.6) issues.push(`edge ${e[0]}-${e[1]} crosses ${z.id} d=${d.toFixed(2)} r=${z.r}`);}
  // lake crossing sample
  if(!(e[2]&&e[2].s)) for(let t=0.05;t<1;t+=0.05){const p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]; if(inLake(p,0.4)){issues.push(`edge ${e[0]}-${e[1]} crosses lake`);break;}}
}
for(const p of DATA.pois){ if(!p.id.startsWith('foto-surabaya') && p.id!=='loket-utama' && !inPoly(p.pos,W.land)) issues.push('poi outside '+p.id); if(inLake(p.pos,0.3)&&p.id!=='foto-jembatan') issues.push('poi in lake '+p.id);
  for(const z of DATA.zones){ if(skip.has(z.id)) continue; const d=Math.hypot(p.pos[0]-z.pos[0],p.pos[1]-z.pos[1]); if(d<z.r+0.3) issues.push(`poi ${p.id} inside ${z.id}`);} }
console.log(issues.length? issues.join('\n') : 'OK no issues');
// SVG
const S=6, ox=62, oz=52; const tx=x=>(x+ox)*S, tz=z=>(z+oz)*S;
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${124*S}" height="${106*S}" style="background:#ddd;font:9px sans-serif">`;
for(const r of W.roads) svg+=`<polyline points="${r.pts.map(p=>tx(p[0])+','+tz(p[1])).join(' ')}" fill="none" stroke="#666" stroke-width="${r.w*S}"/>`;
svg+=`<polygon points="${W.land.map(p=>tx(p[0])+','+tz(p[1])).join(' ')}" fill="#9c6"/>`;
for(const l of W.lakes) svg+=`<ellipse cx="${tx(l.c[0])}" cy="${tz(l.c[1])}" rx="${l.rx*S}" ry="${l.rz*S}" fill="#4ac"/>`;
for(const e of DATA.edges){const a=DATA.nodes[e[0]],b=DATA.nodes[e[1]]; svg+=`<line x1="${tx(a[0])}" y1="${tz(a[1])}" x2="${tx(b[0])}" y2="${tz(b[1])}" stroke="#f5deb3" stroke-width="${1.6*S}" stroke-linecap="round"/>`;}
for(const z of DATA.zones) svg+=`<circle cx="${tx(z.pos[0])}" cy="${tz(z.pos[1])}" r="${z.r*S}" fill="${z.cat==='satwa'?'#363':z.cat==='wahana'?'#c90':z.cat==='staf'?'#888':'#29a'}" fill-opacity=".55"/><text x="${tx(z.pos[0])}" y="${tz(z.pos[1])}" text-anchor="middle" fill="#fff" font-weight="bold">${z.id}</text>`;
for(const [id,p] of Object.entries(DATA.nodes)) svg+=`<text x="${tx(p[0])+4}" y="${tz(p[1])-4}" fill="#a00">${id}</text><circle cx="${tx(p[0])}" cy="${tz(p[1])}" r="2.5" fill="#a00"/>`;
for(const p of DATA.pois) svg+=`<rect x="${tx(p.pos[0])-3}" y="${tz(p.pos[1])-3}" width="6" height="6" fill="#00f"/>`;
svg+='</svg>';
fs.writeFileSync(new URL('../tools/layout.svg', import.meta.url), svg);
