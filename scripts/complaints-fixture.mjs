import { PGlite } from '@electric-sql/pglite';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import ts from 'typescript';
export const admin = '00000000-0000-0000-0000-000000000001';
export const customer = '00000000-0000-0000-0000-000000000002';
export const fakeConfig = { brand:'KILLAQ · PRUEBA AISLADA',ruc:'20100000009',legalName:'Proveedor ficticio de pruebas',address:'Domicilio ficticio 123, Perú',email:'atencion@example.invalid',bookCode:'TEST-WEB',privacyEmail:'privacidad@example.invalid',territory:'Perú, solo pruebas',payments:'Sin cobros en la prueba.',invoices:'Procedimiento ficticio de validación.',deliveries:'Sin entregas reales en la prueba.',personalized:'Sin pedidos reales en la prueba.',voluntaryReturns:'Condiciones ficticias, solo QA.',refunds:'Sin transacciones monetarias.',retention:'Criterios ficticios para revisión del layout.',processors:'Supabase local simulado, sin usuarios reales.',transfers:'Datos aislados en localhost.',dataBanks:'Banco ficticio de pruebas.',effectiveDate:'2026-10-09',approved:true,identityVerified:true };
export async function compileModules() {
  const target = new URL('../artifacts/legal-modules/',import.meta.url); await mkdir(target,{recursive:true});
  for (const [source,name] of [['complaints/core','core'],['legal-config','legal-config'],['complaints/server','server'],['legal-documents','legal-documents']]) {
    let code = ts.transpileModule(await readFile(new URL(`../src/lib/${source}.ts`,import.meta.url),'utf8'),{ compilerOptions:{ module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022 } }).outputText;
    code=code.replace(/import ["']server-only["'];?\s*/g,'').replace(/from "\.\.\/legal-config"/g,'from "./legal-config.mjs"').replace(/from "\.\/complaints\/core"/g,'from "./core.mjs"').replace(/from "\.\/core"/g,'from "./core.mjs"').replace(/from "\.\/legal-config"/g,'from "./legal-config.mjs"');
    await writeFile(new URL(`${name}.mjs`,target),code);
  }
  return target;
}
export async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE public.profiles(id UUID PRIMARY KEY,role TEXT);
    INSERT INTO public.profiles VALUES ('${admin}','admin'),('${customer}','customer');
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin') $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    GRANT SELECT ON public.profiles TO service_role;`);
  await db.exec(await readFile(new URL('../src/sql/003_restore_complaints_book.sql',import.meta.url),'utf8'));
  await db.exec("INSERT INTO public.complaints_book(full_name,document_number,phone,detail,request,response,status) VALUES ('Hoja antigua ficticia','00000000','000000000','Detalle original de prueba','Pedido original de prueba','Respuesta antigua intacta','answered')");
  const migration = await readFile(new URL('../src/sql/006_secure_complaints.sql',import.meta.url),'utf8');
  await db.exec(migration); await db.exec(migration);
  const state = { failDatabase:false,mailFailed:false,accepted:[],calls:[] };
  let queue=Promise.resolve();
  function locked(fn) { const task=queue.then(fn); queue=task.catch(()=>{}); return task; }
  const rpcArgs = {
    register_complaint:['p_data','p_provider','p_submission','p_hash','p_ip_hash','p_document_hash','p_team'],
    record_complaint_action:['p_id','p_actor','p_kind','p_body','p_evidence'],
    lease_complaint_mail:['p_limit','p_case'],complete_complaint_mail:['p_id','p_attempt','p_provider_id','p_error'],enqueue_complaint_reminders:['p_team'],
  };
  const server=createServer(async(req,res) => {
    res.setHeader('Content-Type','application/json'); res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Headers','*');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    const url=new URL(req.url,'http://localhost'); const send=(status,data)=>{res.writeHead(status);res.end(JSON.stringify(data));};
    if(url.pathname==='/auth/v1/user') {
      const token=req.headers.authorization?.replace('Bearer ','');
      if(!['admin-token','customer-token'].includes(token)) return send(401,{message:'Invalid token'});
      return send(200,{id:token==='admin-token'?admin:customer,email:'qa@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-10-09T00:00:00Z'});
    }
    let body={}; if(req.method==='POST'){let text='';for await(const chunk of req)text+=chunk;try{body=JSON.parse(text);}catch{return send(400,{message:'Invalid JSON'});}}
    try {
      const data=await locked(async()=> {
        const functionName=url.pathname.split('/rpc/')[1];
        if(functionName) {
          if(!rpcArgs[functionName]) throw Error('Unsupported RPC');
          if(state.failDatabase && functionName==='register_complaint') throw Error('Isolated database failure');
          state.calls.push(functionName);
          const values=rpcArgs[functionName].map(key=>body[key]??null);
          const casts=functionName==='register_complaint'?['jsonb','jsonb','uuid','text','text','text','text']:functionName==='record_complaint_action'?['bigint','uuid','text','text','text']:functionName==='lease_complaint_mail'?['integer','bigint']:functionName==='complete_complaint_mail'?['bigint','integer','text','text']:['text'];
          const result=await db.query(`SELECT ${functionName==='lease_complaint_mail'?'*':'public.'+functionName+'('+values.map((_,i)=>'$'+(i+1)+'::'+casts[i]).join(',')+') AS result'} ${functionName==='lease_complaint_mail'?'FROM public.'+functionName+'('+values.map((_,i)=>'$'+(i+1)+'::'+casts[i]).join(',')+')':''}`,values);
          return functionName==='lease_complaint_mail'?result.rows:result.rows[0]?.result;
        }
        const table=url.pathname.split('/rest/v1/')[1];
        if(!['profiles','complaints_book','complaint_events','complaint_outbox'].includes(table)) return [];
        const columns=(url.searchParams.get('select')||'*').split(',');
        if(columns.some(column=>!/^\*|[a-z_]+$/.test(column)))throw Error('Invalid columns');
        const values=[]; const where=[];
        for(const [key,value]of url.searchParams){if(['select','order','limit'].includes(key))continue;if(!/^[a-z_]+$/.test(key))throw Error('Invalid key');const operator=value.split('.')[0]; if(!['eq','lt','gte','lte'].includes(operator))continue;values.push(value.slice(operator.length+1));where.push(`"${key}" ${{eq:'=',lt:'<',gte:'>=',lte:'<='}[operator]} $${values.length}`);}
        const order=url.searchParams.get('order')||''; const sort=/^[a-z_]+\.(asc|desc)$/.test(order)?` ORDER BY "${order.split('.')[0]}" ${order.endsWith('desc')?'DESC':'ASC'}`:'';
        const result=await db.query(`SELECT ${columns.join(',')} FROM public.${table}${where.length?' WHERE '+where.join(' AND '):''}${sort} LIMIT ${Math.min(Number(url.searchParams.get('limit')||200),200)}`,values);
        return req.headers.accept?.includes('application/vnd.pgrst.object+json')?(result.rows[0]||null):result.rows;
      }); send(200,data);
    } catch(error) { send(500,{code:'P0001',message:error.message}); }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  return {db,state,origin,close:async()=>{await new Promise(resolve=>server.close(resolve));await db.close();}};
}
