import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeStorefrontSettings, resolveHeroBackground, isLegacyCampaign } from '../src/utils/storefront.ts';

test('Missing settings keep the opening campaign fixed and both intros enabled', () => {
  const settings = normalizeStorefrontSettings(null);
  assert.equal(settings.hero_autoplay, false);
  assert.equal(settings.welcome_enabled, true);
  assert.equal(settings.artisan_enabled, true);
});
test('Saved disabled motion survives normalization and malformed contact cannot enter a URL', () => {
  const settings = normalizeStorefrontSettings({ welcome_enabled: false, artisan_enabled: false, whatsapp_number: '123?text=other', hero_interval: NaN });
  assert.equal(settings.welcome_enabled, false);
  assert.equal(settings.artisan_enabled, false);
  assert.equal(settings.whatsapp_number, '51912964356');
  assert.equal(settings.hero_interval, 9);
});
test('Automatic jewelry backgrounds and explicit owner selections coexist', () => {
  assert.equal(resolveHeroBackground('auto', 'gold'), 'black');
  assert.equal(resolveHeroBackground('auto', 'silver'), 'gold');
  assert.equal(resolveHeroBackground('black', 'silver'), 'black');
  assert.equal(resolveHeroBackground('white', 'gold'), 'white');
});
test('Owner campaigns using original assets are kept when their copy was customized', () => {
  const legacy = { title: 'Colección Matrimonio', image_url: '/images/hero-bg.png', subtitle: 'Sella tu promesa con el brillo de nuestros diamantes exclusivos.', cta_text: 'VER CATÁLOGO', cta_url: '/colecciones/matrimonio' };
  assert.equal(isLegacyCampaign({ title: 'Our new launch', image_url: '/images/hero-bg.png' }), false);
  assert.equal(isLegacyCampaign({ title: 'Colección Matrimonio', image_url: 'https://example.com/own.jpg' }), false);
  assert.equal(isLegacyCampaign(legacy), true);
  assert.equal(isLegacyCampaign({ ...legacy, subtitle: 'A message edited by the owner' }), false);
  assert.equal(isLegacyCampaign({ ...legacy, cta_url: '/new-collection' }), false);
});
