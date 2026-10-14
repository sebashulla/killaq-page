// Loopback-only UI checks. Synthetic catalogue, native video, auth and storage.
// No writes, messages, uploads or fictitious sales reach production.
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.PRODUCT_UI_ORIGIN || 'http://localhost:3001';
const fixture = 'http://127.0.0.1:3100';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) throw Error('Use an isolated loopback preview.');
await fetch(fixture + '/__reset', { method: 'POST' });
await fetch(fixture + '/__seed-product-gallery', { method: 'POST' });
await mkdir('artifacts/product-gallery', { recursive: true });
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {});
const results = [];
try {
  const gen = await browser.newPage();
  await gen.goto(origin);
  const bytes = await gen.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 320;
    const ctx = canvas.getContext('2d'); const stream = canvas.captureStream(12);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const chunks = []; recorder.ondataavailable = event => chunks.push(event.data);
    const recorded = new Promise(resolve => recorder.onstop = resolve); recorder.start();
    const paint = setInterval(() => { ctx.fillStyle = '#151515'; ctx.fillRect(0,0,320,320); ctx.fillStyle = '#d7b96e'; ctx.font='20px sans-serif'; ctx.fillText('VIDEO DE PRUEBA',60,160); ctx.fillText(String(Date.now() % 1000),125,195); }, 80);
    await new Promise(resolve => setTimeout(resolve, 2000)); recorder.stop(); await recorded;
    clearInterval(paint); stream.getTracks().forEach(track => track.stop());
    return [...new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer())];
  });
  const clip = Buffer.from(bytes); await gen.close();
  for (const width of [320, 393, 820, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 1100 }, reducedMotion: 'reduce', hasTouch: width < 701 });
    await context.route('https://media.example.test/**', route => route.fulfill({ contentType: 'video/webm', body: clip }));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/producto/pieza-prueba');
    await expect(page.getByRole('heading', { name: 'Pieza de prueba local', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver imagen 5 de Pieza de prueba local' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^Ver video/ })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: /Piezas que podrían/ })).toHaveCount(0);
    const image = page.getByRole('button', { name: 'Ampliar imagen 1 de Pieza de prueba local' });
    await page.getByRole('button', { name: '6', exact: true }).click();
    await expect(page.getByRole('button', { name: '6', exact: true })).toHaveAttribute('aria-pressed', 'true');
    if (width >= 1440) {
      await image.hover({ position: { x: 80, y: 95 } });
      await expect(image).toHaveAttribute('data-zoomed', 'true');
      expect(await image.locator('img').evaluate(el => getComputedStyle(el).transform)).toContain('1.85');
      const first = await image.evaluate(el => el.style.getPropertyValue('--zoom-x'));
      await image.hover({ position: { x: 180, y: 95 } });
      expect(await image.evaluate(el => el.style.getPropertyValue('--zoom-x'))).not.toBe(first);
    }
    await image.click();
    const dialog = page.getByRole('dialog', { name: 'Vista ampliada de Pieza de prueba local' });
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.locator('img').evaluate(el => el.complete && el.naturalWidth > 0 && el.getBoundingClientRect().height > 0)).toBe(true);
    await expect(dialog.getByRole('button', { name: 'Cerrar vista ampliada' })).toBeFocused();
    // Native modals may pass focus through browser chrome (body), never background controls.
    for (let n=0;n<8;n++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => document.activeElement === document.body || document.activeElement.closest('dialog') !== null)).toBe(true); }
    await dialog.getByRole('button', { name: 'Acercar imagen' }).click();
    await expect(dialog.getByRole('button', { name: 'Alejar imagen' })).toHaveAttribute('aria-pressed', 'true');
    if (width >= 820) { await page.keyboard.press('ArrowRight'); await expect(dialog.getByText('Fotografía 2 de 5')).toBeVisible(); }
    expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
    await dialog.screenshot({ path: `artifacts/product-gallery/lightbox-${width}.png` });
    await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: /^Ampliar imagen/ })).toBeFocused();
    await page.getByRole('button', { name: 'Ver imagen 5 de Pieza de prueba local' }).click();
    await expect(page.getByRole('button', { name: 'Ampliar imagen 5 de Pieza de prueba local' })).toBeVisible();
    await page.getByRole('button', { name: 'Ver video 1 de Pieza de prueba local' }).click();
    const player = page.locator('video[aria-label="Video sintético de prueba"]');
    await expect(player).toHaveAttribute('controls', '');
    expect(await player.getAttribute('autoplay')).toBeNull();
    await player.evaluate(el => el.play());
    await expect.poll(() => player.evaluate(el => el.currentTime)).toBeGreaterThan(.1);
    await page.getByRole('button', { name: 'Ver imagen 1 de Pieza de prueba local' }).click();
    await expect(player).toHaveCount(0);
    await page.getByRole('button', { name: '6', exact: true }).click();
    await page.getByRole('button', { name: 'Añadir al carrito' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Pieza añadida' })).toBeVisible();
    const whatsapp = new URL(await page.getByRole('link', { name: 'Consultar esta pieza' }).getAttribute('href'));
    expect(whatsapp.hostname).toBe('wa.me'); expect(whatsapp.searchParams.get('text')).toContain('talla 6');
    await page.getByText('Detalles de la pieza', { exact: true }).click();
    await expect(page.getByText('Solo para verificar la interfaz, fuera de producción.', { exact: true }).last()).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: `artifacts/product-gallery/product-${width}.png`, fullPage: true });
    await page.goto(origin + '/producto/muestra-prueba');
    await expect(page.getByRole('button', { name: /Muestra digital · no disponible para compra/ })).toBeDisabled();
    await expect(page.getByRole('group', { name: 'Fotografías y videos de la pieza' })).toHaveCount(0);
    await expect(page.getByText('Agotado', { exact: true })).toHaveCount(0);
    await page.getByText('Acerca de esta muestra', { exact: true }).click();
    await expect(page.getByText('KILLAQ-DEMO-QA', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    results.push({ width, gallery: true, nativePlayback: true, sizesAndCart: true, demoProtected: true, a11yViolations: 0 });
    await context.close();
  }
  for (const width of [393, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const p = await context.newPage();
    await p.goto(origin + '/login');
    await p.getByLabel('Correo electrónico').fill('admin@killaq.test');
    await p.getByLabel('Contraseña', { exact: true }).fill('local-test-password');
    await p.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await p.waitForURL('**/admin');
    await p.goto(origin + '/admin/productos');
    await p.getByRole('button', { name: 'Añadir producto', exact: true }).click();
    await p.getByText('Video de la pieza · opcional', { exact: true }).click();
    await p.getByLabel('Subir archivo', { exact: true }).setInputFiles({ name: 'video-prueba.webm', mimeType: 'video/webm', buffer: clip });
    const preview = p.locator('video[aria-label="Vista previa del archivo seleccionado"]');
    await expect(preview).toBeVisible();
    await preview.evaluate(el => el.play());
    await expect.poll(() => preview.evaluate(el => el.currentTime)).toBeGreaterThan(.1);
    await p.getByRole('button', { name: 'Quitar video principal' }).click();
    await expect(preview).toHaveCount(0);
    expect(await p.getByLabel('Subir archivo', { exact: true }).evaluate(el => el.files.length)).toBe(0);
    await expect(p.getByLabel('Enlace del video', { exact: true })).toHaveValue('');
    await p.getByLabel('Subir archivo', { exact: true }).setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid fixture') });
    await expect(p.getByRole('alert').filter({ hasText: 'hasta 100 MB' })).toBeVisible();
    expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    results.push({ width, adminVideoPreview: true, removeBeforeSave: true, invalidFileRejected: true });
    await context.close();
  }
  await writeFile('artifacts/product-gallery/results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
