import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const before = path.resolve(process.argv[2] || 'artifacts/responsive/before');
const after = path.resolve(process.argv[3] || 'artifacts/responsive/after');
const baseline = JSON.parse(await readFile(path.join(before, 'audit.json'), 'utf8'));
const current = JSON.parse(await readFile(path.join(after, 'audit.json'), 'utf8'));
const desktop = [];
for (const old of baseline.results.filter(item => [1440, 1920].includes(item.width))) {
  const fresh = current.results.find(item => item.name === old.name && item.width === old.width);
  if (!fresh) throw new Error(`Falta captura ${old.name}-${old.width}`);
  const name = `${old.name}-${old.width}.png`;
  const a = await sharp(path.join(before, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(path.join(after, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sameSize = a.info.width === b.info.width && a.info.height === b.info.height;
  let changed = 0, bounds;
  if (sameSize) {
    let left = a.info.width, top = a.info.height, right = -1, bottom = -1;
    for (let i = 0; i < a.data.length; i += 4) {
      if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) {
        changed++; const pixel = i / 4, x = pixel % a.info.width, y = Math.floor(pixel / a.info.width);
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
    if (changed) bounds = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  }
  desktop.push({ name: old.name, width: old.width, sameSize, beforeHeight: old.height, afterHeight: fresh.height, sameSections: JSON.stringify(old.sections) === JSON.stringify(fresh.sections), sameFooterLinks: JSON.stringify(old.footerLinks) === JSON.stringify(fresh.footerLinks), changedPixels: sameSize ? changed : null, changedPercent: sameSize ? Number((100 * changed / (a.info.width * a.info.height)).toFixed(6)) : null, bounds });
}
const mobile = baseline.results.filter(item => item.width === 393).map(old => {
  const fresh = current.results.find(item => item.name === old.name && item.width === old.width);
  return { name: old.name, beforeHeight: old.height, afterHeight: fresh?.height, reductionPercent: fresh ? Number((100 * (old.height - fresh.height) / old.height).toFixed(1)) : null };
});
await mkdir(after, { recursive: true });
await writeFile(path.join(after, 'comparison.json'), JSON.stringify({ before, after, desktop, mobile }, null, 2));
console.log(JSON.stringify({ desktop, mobile }));
if (desktop.some(item => !item.sameSize || !item.sameSections || !item.sameFooterLinks)) process.exitCode = 1;
