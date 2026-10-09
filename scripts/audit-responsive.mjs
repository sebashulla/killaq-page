import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const phase = process.argv[2] || 'after';
const origin = process.argv[3] || 'http://127.0.0.1:3000';
const widths = process.argv[4] ? process.argv[4].split(',').map(Number) : phase === 'before' ? [320, 393, 768, 1024, 1440, 1920] : [320, 360, 375, 393, 414, 430, 768, 820, 1024, 1280, 1440, 1920];
const allRoutes = [
  ['inicio', '/'], ['universo', '/nosotros'], ['catalogo', '/colecciones'],
  ['ofertas', '/ofertas'], ['personalizada', '/atencion-personalizada'],
  ['carrito', '/carrito'], ['login', '/login'], ['registro', '/register'],
  ['reclamaciones', '/libro-reclamaciones'], ['perfil', '/perfil'],
  ['producto-ausente', '/producto/verificacion-responsive-no-existe'],
  ['coleccion', '/colecciones/matrimonio'], ['pagina-ausente', '/verificacion-responsive-no-existe'],
];
const routes = process.argv[5] ? allRoutes.filter(([name]) => process.argv[5].split(',').includes(name)) : allRoutes;
const output = path.resolve('artifacts/responsive', phase);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
let nextWidth = 0;
async function worker() {
  while (nextWidth < widths.length) {
    const width = widths[nextWidth++];
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    await context.addInitScript(() => sessionStorage.setItem('killaq-welcome-v3', 'seen'));
    const page = await context.newPage();
    for (const [name, route] of routes) {
      const errors = [];
      const onError = error => errors.push(error.message);
      page.on('pageerror', onError);
      try {
        const response = await page.goto(origin + route, { waitUntil: 'networkidle', timeout: 45000 });
        if (route === '/perfil') await page.waitForURL('**/login**', { timeout: 10000 });
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
        for (const image of await page.locator('main img, footer img').all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate(element => element.complete ? undefined : new Promise(resolve => { element.addEventListener('load', resolve, { once: true }); element.addEventListener('error', resolve, { once: true }); setTimeout(resolve, 5000); }));
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        const metrics = await page.evaluate(() => {
          const box = element => { const r = element.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; };
          const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
          return {
            width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
            heading: document.querySelector('h1')?.textContent, titleSize: document.querySelector('h1') && getComputedStyle(document.querySelector('h1')).fontSize,
            sections: [...document.querySelectorAll('main > section')].map(element => ({ label: element.getAttribute('aria-label') || element.querySelector('h1,h2')?.textContent, ...box(element) })),
            brokenImages: [...document.images].filter(element => visible(element) && element.complete && !element.naturalWidth).map(element => element.getAttribute('alt')),
            mainTargets: [...document.querySelectorAll('nav button, main button, main select, main summary')].filter(visible).map(element => ({ label: element.getAttribute('aria-label') || element.textContent.trim().slice(0, 70), ...box(element) })),
            footerLinks: [...document.querySelectorAll('footer a')].map(element => ({ label: element.textContent, href: element.getAttribute('href') })),
            clippedText: [...document.querySelectorAll('h1,h2,h3,p,summary,label')].filter(visible).filter(element => element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflowX === 'visible').map(element => element.textContent.slice(0, 90)),
          };
        });
        await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true, animations: 'disabled' });
        results.push({ name, route, url: page.url(), status: response?.status(), ...metrics, errors });
        console.log(JSON.stringify({ phase, name, width, scrollWidth: metrics.scrollWidth, height: metrics.height, errors: errors.length, brokenImages: metrics.brokenImages.length }));
      } catch (error) { results.push({ name, route, width, failure: error.message }); console.log(JSON.stringify({ phase, name, width, failure: error.message })); }
      page.off('pageerror', onError);
    }
    await context.close();
  }
}
try { await Promise.all([worker(), worker()]); } finally { await browser.close(); }
results.sort((a, b) => a.width - b.width || a.name.localeCompare(b.name));
await writeFile(path.join(output, 'audit.json'), JSON.stringify({ phase, origin, capturedAt: new Date().toISOString(), results }, null, 2));
const failures = results.filter(item => item.failure || item.scrollWidth > item.width || item.errors?.length || item.brokenImages?.length || item.clippedText?.length);
console.log(JSON.stringify({ phase, pages: results.length, widths, failures: failures.map(item => ({ name: item.name, width: item.width, failure: item.failure, overflow: item.scrollWidth > item.width, errors: item.errors, brokenImages: item.brokenImages, clippedText: item.clippedText })) }));
if (phase !== 'before' && failures.length) process.exitCode = 1;
