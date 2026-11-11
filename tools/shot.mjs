import { chromium } from 'playwright';
const [,, file, out, w='760', h='640'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.goto('file://' + file); await p.screenshot({ path: out }); await b.close();
