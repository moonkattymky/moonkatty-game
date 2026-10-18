// Applies the world3d migration on PGlite with a minimal players table; checks CAS, size cap and grants.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
 await db.exec("create role anon; create role authenticated; create role service_role; create table public.players(telegram_id bigint primary key);insert into public.players values(42);");
 const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261018170000_world3d_saves.sql'),'utf8');
 await db.exec(sql);await db.exec(sql); // idempotent re-apply
 const q=async(s,p)=>(await db.query(s,p)).rows[0].r;
 assert.deepEqual(await q("select public.mkty_world_save(42) r"),{revision:0,snapshot:{}});
 assert.deepEqual(await q("select public.mkty_world_save(42,0,'{\"a\":1}') r"),{revision:1});
 assert.equal((await q("select public.mkty_world_save(42,0,'{\"a\":2}') r")).conflict,true);
 assert.equal((await q("select public.mkty_world_save(42,1,jsonb_build_object('x',repeat('a',70000))) r")).error,'snapshot');
 assert.deepEqual(await q("select public.mkty_world_save(42) r"),{revision:1,snapshot:{a:1}});
 const g=(await db.query("select has_function_privilege('anon','public.mkty_world_save(bigint,bigint,jsonb,timestamptz)','execute') a, has_table_privilege('anon','public.mkty_world_saves','select') b, has_function_privilege('service_role','public.mkty_world_save(bigint,bigint,jsonb,timestamptz)','execute') c")).rows[0];
 assert.deepEqual(g,{a:false,b:false,c:true});
 console.log('world-sql: migration checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
