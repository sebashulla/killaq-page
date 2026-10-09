import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const origin = process.argv[2] || 'http://127.0.0.1:3000';
const fixture = process.argv[3];
const selectedCases = process.argv[4]?.split(',');
if (fixture && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(fixture)) throw new Error('Las pruebas con datos ficticios solo se permiten en localhost.');
const output = path.resolve('artifacts/responsive', selectedCases ? 'interactions-focused' : origin.startsWith('https://') ? 'interactions-published' : 'interactions');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [], accessibility = [];
async function scenario(name, width, run, base = origin, motion = 'reduce') {
  if (selectedCases && !selectedCases.includes(name)) return;
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: motion });
  await context.addInitScript(() => sessionStorage.setItem('killaq-welcome-v3', 'seen'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const go = async route => { await page.goto(base + route, { waitUntil: 'networkidle' }); await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' }); };
  try {
    await run(page, go);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    results.push({ name, width, passed: true });
  } catch (error) {
    results.push({ name, width, passed: false, error: error.message, errors });
    await page.screenshot({ path: path.join(output, `failure-${name}-${width}.png`), fullPage: true }).catch(() => {});
  } finally { await context.close(); }
  console.log(JSON.stringify(results.at(-1)));
}
async function capture(page, name) { await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true, animations: 'disabled' }); }
async function axe(page, name, width) {
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  accessibility.push({ name, width, violations: audit.violations.map(item => ({ id: item.id, impact: item.impact, help: item.help, url: item.helpUrl, nodes: item.nodes.map(node => ({ target: node.target, html: node.html, summary: node.failureSummary })) })), incomplete: audit.incomplete.map(item => ({ id: item.id, nodes: item.nodes.length })) });
}

try {
  for (const width of [320, 393, 820, 1024]) {
    await scenario('navigation', width, async (page, go) => {
      await go('/');
      const toggle = page.getByRole('button', { name: 'Abrir menú', exact: true });
      const box = await toggle.boundingBox(); expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      await toggle.click();
      await expect(page.getByRole('link', { name: 'Ingresar a mi cuenta', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Tienda', exact: true }).click();
      await expect(page.getByRole('button', { name: '← Volver al menú' })).toBeFocused();
      await expect(page.locator('#shop-menu').getByRole('link', { name: 'Charms', exact: false }).first()).toBeVisible();
      await capture(page, `menu-${width}`);
      await axe(page, 'menu-categorias', width);
      await page.getByRole('button', { name: '← Volver al menú' }).click();
      await expect(page.getByRole('button', { name: 'Tienda', exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeFocused();
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.getByRole('button', { name: 'Abrir menú' }).click();
      await page.getByRole('button', { name: 'Tienda', exact: true }).click();
      const positions = await page.evaluate(() => ({ nav: document.querySelector('nav[aria-label="Navegación principal"]').getBoundingClientRect().bottom, menu: document.querySelector('#shop-menu').getBoundingClientRect().top }));
      expect(Math.abs(positions.nav - positions.menu)).toBeLessThanOrEqual(2);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Buscar', exact: true }).click();
      await expect(page.getByRole('searchbox', { name: 'Buscar joyas' })).toBeFocused();
      await page.getByRole('searchbox').fill('oro & plata');
      await page.locator('#site-search').getByRole('button', { name: 'Buscar' }).click();
      await expect(page).toHaveURL(/search=oro(?:\+|%20)%26(?:\+|%20)plata/);
      await expect(page.getByRole('link', { name: 'Quitar Búsqueda: oro & plata' })).toBeVisible();
    });
  }
  for (const width of [320, 393, 820]) {
    await scenario('filters', width, async (page, go) => {
      await go('/colecciones?category=anillos&subcategory=anillos-compromiso&sort=price-desc');
      const toggle = page.getByRole('button', { name: /^Filtros/ });
      await toggle.click();
      const dialog = page.getByRole('dialog', { name: 'Filtrar joyas' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Cerrar filtros' })).toBeFocused();
      await dialog.getByRole('checkbox', { name: 'Oro 18k', exact: true }).check();
      await capture(page, `filtros-${width}`); await axe(page, 'filtros-abiertos', width);
      // Native modal dialogs may pass focus through the browser chrome (body).
      // Background controls must remain unreachable while the modal is open.
      for (let i = 0; i < 30; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => document.activeElement === document.body || document.activeElement.closest('dialog') !== null)).toBe(true); }
      await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(toggle).toBeFocused();
      await toggle.click(); await dialog.getByRole('button', { name: 'Cerrar filtros' }).click(); await expect(dialog).not.toBeVisible(); await expect(toggle).toBeFocused();
      await page.getByRole('button', { name: 'Quitar Material: Oro 18k' }).click();
      await expect(page.getByRole('button', { name: 'Quitar Material: Oro 18k' })).toHaveCount(0);
      await page.getByRole('link', { name: /^Quitar Estilo:/ }).click();
      await expect(page).not.toHaveURL(/subcategory=/);
      await page.getByRole('link', { name: 'Limpiar filtros', exact: true }).click();
      await expect(page).toHaveURL(/colecciones\?sort=price-desc$/);
      await page.getByRole('combobox', { name: 'Ordenar joyas' }).selectOption('price-asc');
      await expect(page.getByRole('combobox', { name: 'Ordenar joyas' })).toHaveValue('price-asc');
    });
  }
  for (const width of [320, 393, 430]) {
    await scenario('categories-footer-faq', width, async (page, go) => {
      await go('/');
      const styles = page.getByRole('button', { name: /^Estilos/ });
      expect(await styles.count()).toBe(5);
      await styles.first().click(); await expect(styles.first()).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('main').getByRole('link', { name: 'Compromiso', exact: true })).toBeVisible();
      const footer = page.locator('footer');
      await footer.getByRole('button', { name: 'Explora' }).click();
      await footer.getByRole('button', { name: 'Tu experiencia' }).click();
      for (const link of await footer.getByRole('link').all()) { await expect(link).toBeVisible(); expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44); }
      const baseline = JSON.parse(await readFile(new URL('./fixtures/responsive-footer.json', import.meta.url), 'utf8'));
      const links = await footer.locator('a').evaluateAll(items => items.map(item => ({ label: item.textContent, href: item.getAttribute('href') })));
      expect(links).toEqual(baseline); await capture(page, `categorias-footer-${width}`); await axe(page, 'footer-abierto', width);
      await go('/nosotros');
      const question = page.locator('main summary').first(); await question.focus(); await page.keyboard.press('Enter');
      await expect(page.locator('main details').first()).toHaveAttribute('open', '');
      await page.keyboard.press('Enter'); await expect(page.locator('main details').first()).not.toHaveAttribute('open', '');
    });
  }
  await scenario('carousel-reduced-motion', 393, async (page, go) => {
    await go('/'); const hero = page.getByRole('region', { name: 'El universo Killaq' });
    const title = await hero.locator('h1').textContent(); const height = (await hero.boundingBox()).height;
    await page.getByRole('button', { name: 'Siguiente campaña' }).click();
    await expect(hero.locator('h1')).not.toHaveText(title);
    expect(Math.abs((await hero.boundingBox()).height - height)).toBeLessThanOrEqual(35);
    expect(await hero.locator('img').last().getAttribute('loading')).toBe('eager');
    await capture(page, 'segunda-campana-393');
    await page.getByRole('button', { name: 'Campaña anterior' }).click(); await expect(hero.locator('h1')).toHaveText(title);
    await go('/atencion-personalizada');
    await expect(page.locator('[aria-label="Proceso artesanal ilustrativo: Acabado"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Repetir proceso artesanal' })).toHaveCount(0);
    await page.getByLabel('La pieza que imaginas').selectOption('Pulsera');
    await page.locator('#metal').selectOption('Plata');
    await page.getByLabel('Tu idea', { exact: false }).fill('Un detalle & una inicial');
    const href = await page.getByRole('link', { name: 'Conversar por WhatsApp' }).getAttribute('href');
    const message = new URL(href).searchParams.get('text'); expect(message).toContain('Pieza: Pulsera'); expect(message).toContain('Material: Plata'); expect(message).toContain('Un detalle & una inicial');
  });
  await scenario('welcome-artisan-motion', 393, async (page, go) => {
    await go('/'); await page.getByRole('button', { name: 'Ver bienvenida' }).click();
    const welcome = page.getByRole('dialog', { name: 'Bienvenida a Killaq' }); await expect(welcome).toBeVisible();
    await expect(page.getByRole('button', { name: 'Omitir bienvenida' })).toBeFocused();
    expect(await page.locator('[data-storefront]').evaluate(element => element.inert)).toBe(true);
    await page.keyboard.press('Escape'); await expect(welcome).not.toBeVisible(); await expect(page.getByRole('button', { name: 'Ver bienvenida' })).toBeFocused();
    await go('/atencion-personalizada'); await page.getByRole('button', { name: 'Pausar proceso artesanal' }).click();
    await page.getByRole('button', { name: /Engaste/ }).click(); await expect(page.locator('[aria-label="Proceso artesanal ilustrativo: Engaste"]')).toBeVisible();
    await page.getByRole('button', { name: 'Repetir proceso artesanal' }).click(); await expect(page.locator('[aria-label="Proceso artesanal ilustrativo: Boceto"]')).toBeVisible();
  }, origin, 'no-preference');
  await scenario('desktop-sidebar', 1440, async (page, go) => {
    await go('/colecciones'); await expect(page.locator('aside')).toBeVisible(); await expect(page.getByRole('button', { name: /^Filtros/ })).not.toBeVisible();
    await page.locator('aside').getByRole('link', { name: 'Anillos', exact: true }).click(); await expect(page).toHaveURL(/category=anillos/);
  });
  const routes = ['/', '/nosotros', '/colecciones', '/ofertas', '/atencion-personalizada', '/carrito', '/login', '/register', '/libro-reclamaciones', '/producto/verificacion-responsive-no-existe', '/colecciones/matrimonio', '/verificacion-responsive-no-existe'];
  for (const width of [393, 1440]) await scenario('accessibility-pages', width, async (page, go) => {
    for (const route of routes) { await go(route); await axe(page, route, width); }
  });
  if (fixture) {
    for (const width of [320, 360, 375, 393, 414, 430, 768, 820, 1024, 1280, 1440, 1920]) await scenario('product-cart-local-only', width, async (page, go) => {
      await go('/producto/pieza-prueba');
      await expect(page.getByRole('heading', { name: 'Pieza de prueba local', exact: true, level: 1 })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Selecciona una talla' })).toBeDisabled();
      await page.getByRole('button', { name: 'Ver imagen 2 de Pieza de prueba local' }).click(); await expect(page.getByRole('button', { name: 'Ver imagen 2 de Pieza de prueba local' })).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: '7', exact: true }).click(); await page.getByRole('button', { name: 'Añadir al carrito', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Pieza añadida' })).toBeVisible(); await capture(page, `producto-local-${width}`); await axe(page, 'producto-local', width);
      await page.getByRole('link', { name: 'Ver mi carrito →' }).click();
      await expect(page.getByText('Talla 7', { exact: true })).toBeVisible();
      const plus = page.getByRole('button', { name: 'Aumentar cantidad de Pieza de prueba local' }); await plus.click(); await plus.click(); await expect(plus).toBeDisabled();
      await expect(page.getByRole('link', { name: 'Coordinar por WhatsApp' })).toBeVisible();
      expect(new URL(await page.getByRole('link', { name: 'Coordinar por WhatsApp' }).getAttribute('href')).searchParams.get('text')).toContain('3 x Pieza de prueba local talla 7');
      await capture(page, `carrito-local-${width}`); await axe(page, 'carrito-local', width);
      await page.getByRole('button', { name: 'Quitar', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Tu carrito está vacío' })).toBeVisible();
    }, fixture);
    for (const width of [320, 393, 820, 1024, 1440, 1920]) await scenario('admin-guarded-local-only', width, async (page, go) => {
      await go('/login'); await page.getByLabel('Correo electrónico').fill('admin@killaq.test'); await page.getByLabel('Contraseña', { exact: true }).fill('local-fixture'); await page.getByRole('button', { name: 'Iniciar sesión' }).click(); await expect(page).toHaveURL(/\/admin$/);
      for (const route of ['/admin', '/admin/productos', '/admin/carrusel', '/admin/experiencia', '/admin/exclusivos', '/admin/videos', '/perfil']) {
        await go(route); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        if (route === '/admin/productos' && width <= 1024) {
          const table = page.getByRole('region', { name: 'Listado de productos' }); await table.focus(); await page.keyboard.press('ArrowRight');
          await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
        }
        await capture(page, `local-${route.replaceAll('/', '-')}-${width}`); await axe(page, `admin-local:${route}`, width);
      }
    }, fixture);
  }
} finally { await browser.close(); }
await writeFile(path.join(output, 'results.json'), JSON.stringify({ origin, fixtureUsed: Boolean(fixture), results, accessibility }, null, 2));
const failed = results.filter(item => !item.passed), violations = accessibility.filter(item => item.violations.length);
console.log(JSON.stringify({ scenarios: results.length, failures: failed.length, accessibilityStates: accessibility.length, statesWithViolations: violations.map(item => ({ name: item.name, width: item.width, violations: item.violations.map(v => v.id) })) }));
if (failed.length || violations.length) process.exitCode = 1;
