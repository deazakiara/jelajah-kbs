import fs from 'fs';
const r = f => fs.readFileSync(new URL('./src/' + f, import.meta.url), 'utf8');
const mode = process.argv[2] || 'full';
const IMPORTS = `import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
`;
const importmap = `<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>`;
let page;
if (mode === 'scene') {
  page = `<title>scene test</title><style>html,body{margin:0;height:100%}#scene{position:fixed;inset:0}</style><div id="scene"></div>${importmap}<script type="module">${IMPORTS}${r('data.js')}\n${r('scene.js')}\nconst S = createScene(document.getElementById('scene'), {}); window.S=S; S.overview(0.01);</script>`;
} else if (mode === 'web') {
  page = r('head-web.html') + `<style>\n${r('web.css')}\n</style>\n` + r('icons.html') + r('web.html') + `\n${importmap}\n<script type="module">\n${IMPORTS}${r('data.js')}\n${r('scene.js')}\n${r('core.js')}\n${r('planner.js')}\n${r('backend.js')}\n${r('webui.js')}\n</script>\n`;
} else {
  page = r('head.html') + `<style>\n${r('style.css')}\n</style>\n` + r('icons.html') + r('body.html') + `\n${importmap}\n<script type="module">\n${IMPORTS}${r('data.js')}\n${r('scene.js')}\n${r('core.js')}\n${r('planner.js')}\n${r('ui.js')}\n</script>\n`;
}
fs.mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
const out = mode === 'scene' ? 'dist/scene-test.html' : mode === 'web' ? 'dist/jelajah-kbs-web.html' : 'dist/jelajah-kbs.html';
fs.writeFileSync(new URL('./' + out, import.meta.url), page);
// local test wrapper (full doc) — artifact adds its own skeleton
fs.writeFileSync(new URL('./' + out.replace('.html', '.local.html'), import.meta.url), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${page}</body></html>`);
console.log('built', out, (page.length / 1024).toFixed(1) + 'KB');
