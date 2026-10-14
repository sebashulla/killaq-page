import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const origin=process.argv[2]||'http://localhost:3002';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))throw Error('Release checks only allow localhost, never production complaints.');
for(const route of ['/terminos-y-condiciones','/cambios-y-devoluciones','/politica-de-privacidad']){
  const response=await fetch(origin+route);assert.equal(response.status,200);const text=await response.text();assert.ok(text.includes('Este documento aún no está publicado como política definitiva.'));assert.ok(text.includes('noindex'));assert.ok(!text.includes('[PENDIENTE DE CONFIRMACIÓN:'));assert.ok(!text.includes('Vista local de revisión.'));console.log('PASS production publication gate:',route);
}
const book=await fetch(origin+'/libro-reclamaciones');const html=await book.text();assert.equal(book.status,200);assert.ok(html.includes('registro virtual aún no está habilitado'));assert.ok(html.includes('10714330573'));
const form={full_name:'Prueba aislada de habilitación',document_type:'dni',document_number:'00000000',email:'qa@example.invalid',detail:'Solo prueba local; no existe una compra.',item_type:'producto',claim_type:'reclamo',response_channel:'email'};
const response=await fetch(origin+'/api/reclamaciones',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({form,submission_id:randomUUID()})});assert.equal(response.status,503);const json=await response.json();assert.ok(!json.receipt);assert.ok(json.error.includes('no se ha registrado'));assert.ok(response.headers.get('cache-control').includes('no-store'));console.log('PASS unconfigured local release blocks registration without a false receipt');
for(const route of ['/api/admin/reclamaciones','/api/cron/reclamaciones'])assert.equal((await fetch(origin+route)).status,401);
console.log('PASS server authorization on actual local Next route handlers');
