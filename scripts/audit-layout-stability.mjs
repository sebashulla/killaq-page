import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const origin = process.argv[2] || 'http://127.0.0.1:3000';
const output = path.resolve('artifacts/responsive', origin.startsWith('https://') ? 'stability-published' : 'stability');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [320, 393, 820, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', hasTouch: width < 1100, isMobile: width < 700 });
    await context.addInitScript(() => {
      sessionStorage.setItem('killaq-welcome-v3', 'seen');
      window.__killaqShifts = [];
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__killaqShifts.push({ value: entry.value, time: entry.startTime }); }).observe({ type: 'layout-shift', buffered: true });
    });
    const page = await context.newPage();
    for (const route of ['/', '/nosotros', '/atencion-personalizada']) {
      await page.goto(origin + route, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1500);
      const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, shifts: window.__killaqShifts, cls: window.__killaqShifts.reduce((sum, shift) => sum + shift.value, 0), images: [...document.querySelectorAll('main img')].filter(image => image.getBoundingClientRect().top < innerHeight).map(image => ({ alt: image.alt, loading: image.loading, complete: image.complete, naturalWidth: image.naturalWidth, width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height, fit: getComputedStyle(image).objectFit, sizes: image.sizes, srcset: Boolean(image.srcset) })) }));
      results.push({ route, ...metrics }); console.log(JSON.stringify({ route, width, cls: metrics.cls, readyImages: metrics.images.every(image => image.complete && image.naturalWidth > 0) }));
    }
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(path.join(output, 'results.json'), JSON.stringify({ origin, results }, null, 2));
if (results.some(result => result.scrollWidth > result.width || result.cls > .1 || result.images.some(image => !image.complete || !image.naturalWidth))) process.exitCode = 1;
