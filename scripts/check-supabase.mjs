import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd());
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
for (const table of ['products', 'categories', 'materials', 'hero_slides', 'product_images', 'profiles', 'reviews', 'orders', 'product_videos', 'social_videos', 'site_settings', 'complaints_book']) {
  const { error, count } = await client.from(table).select('*', { count: 'exact' }).limit(0);
  console.log(JSON.stringify({ table, count, error: error?.message }));
}
const { error: brandError } = await client.from('hero_slides').select('jewelry_tone,background_style,image_fit').limit(0);
const { data: brandSettings, error: settingsError } = await client.from('site_settings').select('key').eq('key', 'storefront').maybeSingle();
console.log(JSON.stringify({ migration: '004_brand_and_storefront.sql', ready: !brandError && !settingsError && Boolean(brandSettings), error: brandError?.message || settingsError?.message }));
