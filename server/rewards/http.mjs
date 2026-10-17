/* Shared HTTP helpers for the Edge Functions.
   CORS: the game is served only from GitHub Pages. Authentication never relies on
   cookies (signed Telegram initData / session token in the body), so CORS is an
   extra layer, not the primary control. Localhost is allowed for local development
   and the automated browser tests. */
export const SITE_ORIGIN='https://moonkattymky.github.io';
const LOCAL_ORIGIN=/^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;
export function allowedOrigin(origin){
 return typeof origin==='string'&&(origin===SITE_ORIGIN||LOCAL_ORIGIN.test(origin))?origin:SITE_ORIGIN;
}
export function corsHeaders(origin){
 return {'Access-Control-Allow-Origin':allowedOrigin(origin),'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Vary':'Origin'};
}
export function jsonResponder(request,extra={}){
 const cors=corsHeaders(request?.headers?.get?.('Origin'));
 const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra,...headers}});
 return {cors,json};
}
