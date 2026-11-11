import { chromium } from 'playwright';
import fs from 'fs';
const names = fs.readdirSync('/home/claude/kbs/dist/models-opt').filter(f => f.endsWith('.glb')).map(f => f.replace('.glb', ''));
const page = `<!doctype html><html><body style="margin:0;background:#eef2e6"><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><script type="module">
import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const names = ${JSON.stringify(names)}; const r = new THREE.WebGLRenderer({antialias:true}); r.setSize(1500, 700); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; document.body.append(r.domElement);
const s = new THREE.Scene(); s.background = new THREE.Color(0xeef2e6); s.add(new THREE.HemisphereLight(0xffffff, 0x887755, 1.5)); const dl = new THREE.DirectionalLight(0xffffff, 2); dl.position.set(3, 6, 8); s.add(dl);
const cam = new THREE.PerspectiveCamera(30, 1500/700, 0.1, 200); cam.position.set(0, 9, 34); cam.lookAt(0, 2, 0);
const L = new GLTFLoader(); let i = 0;
for (const n of names) { const g = await L.loadAsync('/home/claude/kbs/dist/models-opt/' + n + '.glb'); const o = g.scene; const col = i % 9, row = Math.floor(i / 9); o.position.set(-16 + col * 4, 0, -row * 7 + 2); o.rotation.y = -0.6; s.add(o); i++; }
r.render(s, cam); window.done = true;
</script></body></html>`;
fs.writeFileSync('/home/claude/kbs/tools/glbcheck.html', page);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1500, height: 700 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => { const u = new URL(route.request().url()); route.fulfill({ body: fs.readFileSync('/home/claude/kbs/node_modules/three/' + u.pathname.replace('/npm/three@0.160.0/', '')), contentType: 'application/javascript' }); });
await p.goto('file:///home/claude/kbs/tools/glbcheck.html'); await p.waitForFunction('window.done === true', null, { timeout: 60000 }).catch(e => errs.push('timeout'));
await p.screenshot({ path: '/home/claude/kbs/tools/glbs.png' }); console.log(errs.join('\n') || 'ok'); await b.close();
