import { chromium } from 'playwright';
import fs from 'fs';
const r = f => fs.readFileSync('/home/claude/kbs/src/' + f, 'utf8');
const SPEC = { komodo: { L: 2.6 }, harimau: { h: 1.0 }, harimauputih: { h: 1.0 }, singa: { h: 1.2 }, gajah: { h: 2.8 }, jerapah: { h: 5.0 }, zebra: { h: 1.4 }, unta: { h: 2.0 }, rusa: { h: 1.3 }, banteng: { h: 1.6 }, kudanil: { h: 1.5 }, babi: { h: 0.8 }, beruang: { h: 0.75 }, domba: { h: 0.9 }, kelinci: { h: 0.3 }, buaya: { L: 4.5 }, monyet: { h: 0.6 }, bekantan: { h: 0.7 }, orangutan: { h: 1.3 }, jalakbali: { h: 0.25 }, kakatua: { h: 0.4 }, rangkong: { h: 0.9 }, flamingo: { h: 1.2 }, pelikan: { h: 1.5 }, burungunta: { h: 2.3 } };
const page = `<!doctype html><html><body><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><script type="module">
import * as THREE from 'three'; import { MapControls } from 'three/addons/controls/MapControls.js'; import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'; import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
${r('data.js')}
${r('scene.js')}
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true });
window.exportOne = async (key, spec) => {
  RAND = mulberry32(42); const o = MODEL[key](); const root = new THREE.Group(); root.name = 'kbs_' + key; root.add(o); o.rotation.y = -Math.PI / 2; o.userData = {};
  o.traverse(m => { m.userData = {}; if (m.isMesh) { const g = m.geometry.clone(); g.computeVertexNormals(); m.geometry = g; m.material = MAT; m.castShadow = true; } });
  root.updateMatrixWorld(true); let box = new THREE.Box3().setFromObject(root, true); const size = box.getSize(new THREE.Vector3());
  const s = spec.h ? spec.h / size.y : spec.L / Math.max(size.x, size.z); root.scale.setScalar(s); root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(root, true); o.position.set(-(box.min.x + box.max.x) / 2 / s, -box.min.y / s, -(box.min.z + box.max.z) / 2 / s); root.updateMatrixWorld(true);
  const glb = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true });
  const b = new Uint8Array(glb); let bin = ''; for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]); return btoa(bin);
};
window.ready = true;
</script></body></html>`;
fs.writeFileSync('/home/claude/kbs/tools/export.html', page);
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await br.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => { const u = new URL(route.request().url()); route.fulfill({ body: fs.readFileSync('/home/claude/kbs/node_modules/three/' + u.pathname.replace('/npm/three@0.160.0/', '')), contentType: 'application/javascript' }); });
await p.goto('file:///home/claude/kbs/tools/export.html'); await p.waitForFunction('window.ready === true', null, { timeout: 30000 });
let total = 0;
for (const [k, spec] of Object.entries(SPEC)) { const b64 = await p.evaluate(([k, s]) => window.exportOne(k, s), [k, spec]); const buf = Buffer.from(b64, 'base64'); fs.writeFileSync(`/home/claude/kbs/dist/models/${k}.glb`, buf); total += buf.length; process.stdout.write(`${k}:${(buf.length / 1024).toFixed(0)}KB `); }
console.log('\ntotal', (total / 1024).toFixed(0) + 'KB', errs.join(' | '));
await br.close();
