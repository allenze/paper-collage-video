#!/usr/bin/env node
/*
 * Self-contained renderer:
 *  1. Unzip scene sources from .trae-html-share-packages to /tmp/dog-work
 *  2. Fix .scene height (already in backed-up index.html)
 *  3. Patch sc01 GSAP timeline registration if missing
 *  4. Launch HTTP server + Puppeteer, render 3240 frames
 *  5. FFmpeg encode MP4
 *  6. Copy final MP4 + 9 scene previews to /workspace/public/projects/
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');

const SHARE_PKG = '/workspace/.trae-html-share-packages/projects/dog-guilt-truth/hyperframes-video';
const WORK_DIR = '/tmp/dog-work';
const PROJECT_DIR = path.join(WORK_DIR, 'hyperframes-video');
const TMP_FRAMES = '/tmp/dog-guilt-frames-final';
const OUT_DIR = '/workspace/public/projects/dog-guilt-truth/hyperframes-video';
const OUTPUT_MP4 = path.join(OUT_DIR, 'dog-guilt-truth-watercolor-final.mp4');
const PREV_DIR = path.join(OUT_DIR, 'scene-previews');
const FPS = 24;
const TOTAL_SEC = 135;
const TOTAL_FRAMES = FPS * TOTAL_SEC;
const VIEW_W = 1280;
const VIEW_H = 720;
const CHROME_BIN = '/root/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome';

console.log('[render] === STEP 1: Unzip sources ===');
fs.rmSync(WORK_DIR, { recursive: true, force: true });
fs.mkdirSync(PROJECT_DIR, { recursive: true });
fs.mkdirSync(path.join(PROJECT_DIR, 'compositions'), { recursive: true });

// Unzip index.html
execFileSync('unzip', ['-o', path.join(SHARE_PKG, 'index.html.zip'), '-d', WORK_DIR], { stdio: 'inherit' });
// The zip contains absolute paths, so move files to correct location
function moveNested(baseDir, targetDir) {
  const nested = path.join(baseDir, 'projects/dog-guilt-truth/hyperframes-video');
  if (fs.existsSync(nested)) {
    for (const item of fs.readdirSync(nested)) {
      const src = path.join(nested, item);
      const dst = path.join(targetDir, item);
      if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
      fs.renameSync(src, dst);
    }
    // Clean up nested dirs
    let p = nested;
    while (p !== baseDir && p !== '/') {
      try { fs.rmdirSync(p); } catch(e) {}
      p = path.dirname(p);
    }
  }
}
moveNested(WORK_DIR, PROJECT_DIR);

// Unzip 9 scenes - zips contain absolute paths like projects/dog-guilt-truth/hyperframes-video/compositions/sc01.html
for (const id of ['sc01','sc02','sc03','sc04','sc05','sc06','sc07','sc08','sc09']) {
  const zipPath = path.join(SHARE_PKG, 'compositions', `${id}.html.zip`);
  const compDir = path.join(PROJECT_DIR, 'compositions');
  // Unzip to a temp dir, then find the .html file and move it
  const tmpUnzip = path.join(compDir, `_tmp_${id}`);
  fs.mkdirSync(tmpUnzip, { recursive: true });
  execFileSync('unzip', ['-o', zipPath, '-d', tmpUnzip], { stdio: 'ignore' });
  // Find the .html file recursively
  function findHtml(dir) {
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) {
        const found = findHtml(full);
        if (found) return found;
      } else if (item === `${id}.html`) {
        return full;
      }
    }
    return null;
  }
  const htmlFile = findHtml(tmpUnzip);
  if (htmlFile) {
    const dst = path.join(compDir, `${id}.html`);
    fs.copyFileSync(htmlFile, dst);
    console.log(`[render]   ${id}.html extracted OK`);
  } else {
    console.error(`[render]   ${id}.html NOT FOUND in zip!`);
  }
  fs.rmSync(tmpUnzip, { recursive: true, force: true });
}
console.log('[render] sources unzipped to', PROJECT_DIR);
console.log('[render] index.html exists:', fs.existsSync(path.join(PROJECT_DIR, 'index.html')));
console.log('[render] scenes:', fs.readdirSync(path.join(PROJECT_DIR, 'compositions')).join(', '));

console.log('\n[render] === STEP 2: Patch sc01 GSAP timeline if missing ===');
const sc01Path = path.join(PROJECT_DIR, 'compositions/sc01.html');
let sc01Content = fs.readFileSync(sc01Path, 'utf8');
if (!sc01Content.includes('window.__timelines["sc01"]') && !sc01Content.includes("window.__timelines['sc01']")) {
  console.log('[render] sc01 missing timeline registration, patching...');
  // Find the <script src="...gsap..."> line and insert our script before it
  const gsapScriptTag = '<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>';
  const patchScript = `<script>
window.__timelines = window.__timelines || {};
if (window.gsap) {
  const tl = gsap.timeline({ paused: true });
  tl.fromTo(".l1-bg .sky-gradient", { opacity: 0.85 }, { opacity: 1, duration: 3.5, ease: "sine.inOut" }, 0.1);
  tl.to(".l1-bg .moon-halo", { scale: 1.08, opacity: 0.85, duration: 8, ease: "sine.inOut", repeat: 1, yoyo: true }, 1.0);
  tl.fromTo(".l1-bg .gold-dust", { opacity: 0.5 }, { opacity: 0.95, duration: 6, ease: "sine.inOut", repeat: 2, yoyo: true }, 0.5);
  tl.to(".l1-bg", { y: 6, duration: 9, ease: "sine.inOut", repeat: 1, yoyo: true }, 0);
  tl.from(".l2-frame", { y: -10, opacity: 0, duration: 1.05, ease: "power3.out" }, 0.2);
  tl.to(".l2-frame", { x: 4, y: -3, duration: 6, ease: "power1.inOut", repeat: 1, yoyo: true }, 1.4);
  tl.from(".l2-frame circle, .l2-frame path", { opacity: 0, duration: 0.9, ease: "power2.out", stagger: 0.04 }, 0.35);
  tl.from(".hallway, .floor", { y: -20, opacity: 0, duration: 0.9, ease: "power2.out" }, 0.4);
  tl.from(".shard", { scale: 0, rotation: (index) => (index*37)%80-40, x: (index) => (index%2===0?-30-index*8:30+index*10), y: (index) => -40-index*10, opacity: 0, duration: 0.9, ease: "back.out(1.8)", stagger: 0.08 }, 0.7);
  tl.to(".shard", { x: (index) => (index*5)%10-5, y: (index) => -3+(index%3), rotation: (index) => (index%2===0?-1:1)*4, duration: 4, ease: "sine.inOut", repeat: 2, yoyo: true, stagger: 0.15 }, 1.9);
  tl.from(".dog", { scale: 0.82, opacity: 0, y: 20, duration: 1.05, ease: "expo.out" }, 1.0);
  tl.to(".dog-body", { y: 3, duration: 3.5, ease: "sine.inOut", repeat: 3, yoyo: true }, 2.2);
  tl.fromTo(".dog-head", { rotation: -2 }, { rotation: 3, duration: 2.8, ease: "sine.inOut", repeat: 3, yoyo: true }, 2.0);
  tl.from(".eye-l, .eye-r, .nose", { opacity: 0, duration: 0.7, ease: "power2.out", stagger: 0.12 }, 1.6);
  tl.from(".l4-flora", { x: 30, y: -15, opacity: 0, scale: 0.95, duration: 1.0, ease: "power3.out" }, 0.55);
  tl.to(".l4-flora", { x: -10, y: 6, duration: 7, ease: "sine.inOut", repeat: 1, yoyo: true }, 1.8);
  tl.fromTo(".l4-flora ellipse, .l4-flora path", { opacity: 0 }, { opacity: 1, duration: 0.9, ease: "power2.out", stagger: 0.06 }, 0.7);
  window.__timelines["sc01"] = tl;
}
</script>\n${gsapScriptTag}`;
  sc01Content = sc01Content.replace(gsapScriptTag, patchScript);
  fs.writeFileSync(sc01Path, sc01Content);
  console.log('[render] sc01 patched OK');
} else {
  console.log('[render] sc01 already has timeline registration');
}

// Verify .scene height in index.html
const idxContent = fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8');
if (!idxContent.includes('.scene {') || !idxContent.includes('height: 720px')) {
  console.log('[render] WARNING: .scene height rule missing in index.html!');
  // Patch it
  const patched = idxContent.replace(
    /<style>/,
    '<style>\n  .scene { width: 1280px; height: 720px; position: relative; overflow: hidden; }'
  );
  fs.writeFileSync(path.join(PROJECT_DIR, 'index.html'), patched);
  console.log('[render] index.html .scene height patched');
} else {
  console.log('[render] index.html .scene height OK');
}

console.log('\n[render] === STEP 3: Start HTTP server + Puppeteer ===');
const MIME = { '.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.wav':'audio/wav','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const filePath = path.join(PROJECT_DIR, p);
  if (!filePath.startsWith(PROJECT_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(res => server.listen(0, '127.0.0.1', res));
const PORT = server.address().port;
const BASE_URL = `http://127.0.0.1:${PORT}`;

fs.rmSync(TMP_FRAMES, { recursive: true, force: true });
fs.mkdirSync(TMP_FRAMES, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(PREV_DIR, { recursive: true });

const browser = await puppeteer.default.launch({ executablePath: CHROME_BIN, headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars','--mute-audio',`--window-size=${VIEW_W},${VIEW_H}`] });
const page = await browser.newPage();
await page.setViewport({ width: VIEW_W, height: VIEW_H, deviceScaleFactor: 1 });
page.on('pageerror', err => console.error('[browser-error]', err.message));
page.on('console', msg => { if (msg.type() === 'error') console.error('[browser-console-err]', msg.text()); });
await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise(r => setTimeout(r, 3000));

const bootResult = await page.evaluate(async (sceneIds) => {
  for (const id of sceneIds) {
    try {
      const r = await fetch(`compositions/${id}.html`);
      const txt = await r.text();
      const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
      let m;
      while ((m = re.exec(txt)) !== null) {
        if (m[1].trim().length === 0) continue;
        try { (new Function(m[1]))(); } catch(e) { console.error(`eval ${id}:`, e && e.message ? e.message : String(e).substring(0,80)); }
      }
    } catch(e) {}
  }
  if (typeof registerTimeline === 'function') registerTimeline();
  await new Promise(r => setTimeout(r, 500));
  return Object.keys(window.__timelines || {});
}, ["sc01","sc02","sc03","sc04","sc05","sc06","sc07","sc08","sc09"]);
console.log('[render] boot TLs:', bootResult.join(','), 'count=', bootResult.length);
if (bootResult.length < 10) {
  console.error('[render] FATAL: not all TLs registered!');
  await browser.close();
  server.close();
  process.exit(1);
}

const SCENES = [["sc01",0],["sc02",15],["sc03",30],["sc04",45],["sc05",60],["sc06",75],["sc07",90],["sc08",105],["sc09",120]];

console.log('\n[render] === STEP 4: Generate 9 scene previews ===');
const midTs = [12, 27, 42, 54, 69, 84, 99, 114, 129];
const prevMd5 = {};
for (let i = 0; i < SCENES.length; i++) {
  const t = midTs[i];
  const [id] = SCENES[i];
  await page.evaluate(async (targetT, scenes) => {
    scenes.forEach(([sid, start]) => {
      const stl = window.__timelines?.[sid];
      if (!stl) return;
      const local = targetT - start;
      if (local < 0) { stl.progress(0); return; }
      if (local >= 15) { stl.progress(1); return; }
      stl.seek(local);
    });
    const root = window.__timelines?.root;
    if (root) root.seek(targetT);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }, t, SCENES);
  await new Promise(r => setTimeout(r, 150));
  const buf = await page.screenshot({ type: 'jpeg', quality: 92, clip: { x:0,y:0,width:VIEW_W,height:VIEW_H } });
  fs.writeFileSync(path.join(PREV_DIR, `${id}.jpg`), buf);
  const md5 = crypto.createHash('md5').update(buf).digest('hex');
  prevMd5[id] = md5;
  console.log(`[preview] ${id} @ ${t}s  md5=${md5}  ${(buf.length/1024).toFixed(0)}KB`);
}
console.log('[preview] unique MD5s:', new Set(Object.values(prevMd5)).size, '/ 9');

// Write gallery.html
const labels = [
  'SC01 (0-15s) 回到家——开门见花瓶碎片',
  'SC02 (15-30s) 回忆双页——快乐 vs 内疚',
  'SC03 (30-45s) 怒斥 vs 屈服双分屏',
  'SC04 (45-60s) 科学图鉴——大脑回路示意图',
  'SC05 (60-75s) 数据柱状图——误读冠军',
  'SC06 (75-90s) 三格漫画——事件发生',
  'SC07 (90-105s) 共识玫瑰——六瓣花框',
  'SC08 (105-120s) 和解——平视对视',
  'SC09 (120-135s) 拥抱——暖夕阳台灯光晕'
];
const gallery = `<!doctype html>
<html><head><meta charset="utf-8"/><title>9 Scenes Gallery · 狗认知真相 · 欧洲经典文学绘本水彩风</title>
<style>
body{margin:0;padding:24px;background:#2D2416;font-family:'Noto Serif SC',serif;color:#E6D7B8;}
h1{text-align:center;font-size:22px;margin:4px 0 24px;letter-spacing:2px;color:#F4C26B;}
.sub{text-align:center;color:#A15C3A;font-size:13px;margin:-12px 0 20px;}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;max-width:1360px;margin:0 auto;}
.card{background:#1A1510;border-radius:10px;overflow:hidden;border:1px solid #8C5F20;}
.card img{width:100%;display:block;}
.card .label{padding:10px 14px;font-size:13px;text-align:center;border-top:1px solid #7A5A34;color:#F2E9D6;background:linear-gradient(180deg,#2D2416,#1A1510);}
.foot{max-width:1360px;margin:28px auto 0;text-align:center;font-size:12px;color:#B98A78;}
</style></head><body>
<h1>✦ 狗认知真相 · 9 场景动画 ✦</h1>
<p class="sub">欧洲经典文学绘本水彩风 · 720p 16:9 · 135s (24fps) · 无字幕无旁白</p>
<div class="grid">
${SCENES.map((s,i)=>`<div class="card"><img src="${s[0]}.jpg"/><div class="label">${labels[i]}</div></div>`).join('\n')}
</div>
<p class="foot">四层纸雕深度 (0.18 / 0.42 / 0.62 / 0.92) · 棉浆纸纹 + 湿画法晕染 + 赭石土褐调色 · gentle 节奏 · wet-fade 水彩转场</p>
</body></html>`;
fs.writeFileSync(path.join(PREV_DIR, 'gallery.html'), gallery);
console.log('[preview] gallery.html written');

console.log('\n[render] === STEP 5: Full 3240 frames ===');
const framePad = 5;
let lastLogAt = -1;
const captureStart = Date.now();
for (let i = 0; i < TOTAL_FRAMES; i++) {
  const t = i / FPS;
  await page.evaluate(async (targetT, scenes) => {
    scenes.forEach(([id, start]) => {
      const stl = window.__timelines?.[id];
      if (!stl) return;
      const local = targetT - start;
      if (local < 0) { stl.progress(0); return; }
      if (local >= 15) { stl.progress(1); return; }
      stl.seek(local);
    });
    const root = window.__timelines?.root;
    if (root) root.seek(targetT);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, t, SCENES);
  const buf = await page.screenshot({ type: 'jpeg', quality: 92, clip: { x:0,y:0,width:VIEW_W,height:VIEW_H } });
  fs.writeFileSync(path.join(TMP_FRAMES, `f${String(i).padStart(framePad,'0')}.jpg`), buf);
  const pct = Math.floor((i + 1) / TOTAL_FRAMES * 100);
  if (pct !== lastLogAt && pct % 5 === 0) {
    lastLogAt = pct;
    const elapsed = (Date.now() - captureStart) / 1000;
    const perFrame = elapsed / (i + 1);
    const eta = Math.round((TOTAL_FRAMES - i - 1) * perFrame);
    console.log(`[render] ${pct.toString().padStart(3,' ')}%  frame ${i+1}/${TOTAL_FRAMES}  t=${t.toFixed(2)}s  elapsed=${elapsed.toFixed(0)}s  eta=${eta}s`);
  }
}
console.log(`[render] all ${TOTAL_FRAMES} frames in ${((Date.now()-captureStart)/1000).toFixed(0)}s`);
await browser.close();
server.close();

console.log('\n[render] === STEP 6: FFmpeg encode ===');
const encStart = Date.now();
const ffmpegArgs = ['-y','-framerate',String(FPS),'-i',path.join(TMP_FRAMES,`f%0${framePad}d.jpg`),'-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart','-vf',`scale=${VIEW_W}:${VIEW_H}`,OUTPUT_MP4];
console.log('[render] ffmpeg', ffmpegArgs.join(' '));
const ffmpegProc = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore','pipe','pipe'] });
ffmpegProc.stdout.on('data', d => process.stdout.write(d.toString()));
ffmpegProc.stderr.on('data', d => process.stderr.write(d.toString()));
const exitCode = await new Promise((resolve) => { ffmpegProc.on('close', resolve); });
console.log(`[render] ffmpeg exit=${exitCode}  elapsed=${((Date.now()-encStart)/1000).toFixed(0)}s`);

if (fs.existsSync(OUTPUT_MP4)) {
  const sz = fs.statSync(OUTPUT_MP4).size;
  console.log(`\n[render] === SUCCESS ===`);
  console.log(`MP4: ${OUTPUT_MP4}  (${(sz/1024/1024).toFixed(2)} MB)`);
  try {
    const probe = execFileSync('ffprobe', ['-v','error','-show_entries','stream=codec_name,width,height,r_frame_rate,duration','-of','default=noprint_wrappers=1',OUTPUT_MP4], { encoding: 'utf8' });
    console.log('ffprobe:\n' + probe.trim());
  } catch(e){}
} else {
  console.error('[render] FAILED: no mp4 output');
  process.exit(1);
}
fs.rmSync(TMP_FRAMES, { recursive: true, force: true });
console.log('[render] temp frames cleaned');
console.log('[render] === ALL DONE ===');
