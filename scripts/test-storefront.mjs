import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeStorefrontSettings, resolveHeroBackground, isLegacyCampaign, canShowExclusive } from '../src/utils/storefront.ts';
import { presentCategories } from '../src/data/taxonomy.ts';

test('Missing settings enable the new carousel while the exclusive block stays hidden', () => {
  const settings = normalizeStorefrontSettings(null);
  assert.equal(settings.hero_autoplay, true);
  assert.equal(settings.exclusive_enabled, false);
  assert.equal(settings.welcome_enabled, true);
  assert.equal(settings.artisan_enabled, true);
});
test('Exclusive section requires an explicitly selected published product, image and active collection', () => {
  const id = '00000000-0000-0000-0000-000000000011';
  const settings = normalizeStorefrontSettings({exclusive_enabled:true, exclusive_product_id:id});
  const product = {id, is_active:true, collection_id:3, collections:{is_active:true}, product_images:[{url:'real.jpg'}]};
  assert.equal(canShowExclusive(settings,product),true);
  for (const invalid of [null, {...product,id:'other'}, {...product,is_active:false}, {...product,collection_id:null}, {...product,collections:{is_active:false}}, {...product,product_images:[]}, {...product,sku:'KILLAQ-DEMO-QA'}]) assert.equal(canShowExclusive(settings,invalid),false);
  assert.equal(canShowExclusive({...settings,exclusive_enabled:false},product),false);
  assert.equal(normalizeStorefrontSettings({exclusive_product_id:'/fake'}).exclusive_product_id,'');
});
test('Category references preserve owner images and explicitly hidden Charms', () => {
  assert.equal(presentCategories(null).length,5);
  const own = {id:17,slug:'anillos',name:'Anillos',image_url:'https://example.com/own.webp'};
  const rows = presentCategories([own]);
  assert.equal(rows[0].image_url,own.image_url);
  assert.equal(rows[1].slug,'charms');
  assert.equal(presentCategories([own,{id:27,slug:'charms',name:'Charms',is_active:false}]).length,1);
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
