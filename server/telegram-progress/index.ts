/* Backward-compatible URL, ONE reward engine and ledger. No legacy writes. */
import {createHandler} from '../rewards/core.mjs';
const handle=createHandler({url:Deno.env.get('SUPABASE_URL'),key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')});
Deno.serve(async req=>{
 if(req.method!=='POST')return handle(req);
 try{
  const raw=await req.text();if(raw.length>12000)return new Response('{"ok":false,"error":"body"}',{status:413,headers:{'Access-Control-Allow-Origin':'*','Content-Type':'application/json'}});
  const body=JSON.parse(raw);body.action=body.action==='complete_life'?'life.complete':'player';
  return handle(new Request(req.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
 }catch{return new Response('{"ok":false,"error":"body"}',{status:400,headers:{'Access-Control-Allow-Origin':'*','Content-Type':'application/json'}});}
});
