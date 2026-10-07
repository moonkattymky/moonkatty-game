/* A short-lived Telegram launch proof is exchanged for a bounded application session.
   HMAC domain separation; no client IDs are trusted, no service key leaves the server.
   Sessions expire after 12h and cannot refresh without a fresh Telegram launch proof. */
const enc=new TextEncoder(),dec=new TextDecoder(),TTL=12*60*60*1000;
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const un64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
async function key(secret){if(!secret)throw Error('auth');return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function issueSession(user,secret,now=Date.now()){
 const expires=now+TTL,payload=b64(enc.encode(JSON.stringify({v:1,aud:'mkty-session',iat:now,exp:expires,user})));
 const sig=await crypto.subtle.sign('HMAC',await key(secret),enc.encode('mkty-session-v1:'+payload));
 return {token:payload+'.'+b64(new Uint8Array(sig)),expires_at:expires};
}
export async function verifySession(token,secret,now=Date.now()){
 try{
  if(typeof token!=='string'||token.length>6000)throw Error();
  const parts=token.split('.');if(parts.length!==2)throw Error();
  if(!await crypto.subtle.verify('HMAC',await key(secret),un64(parts[1]),enc.encode('mkty-session-v1:'+parts[0])))throw Error();
  const p=JSON.parse(dec.decode(un64(parts[0])));
  if(p.v!==1||p.aud!=='mkty-session'||!Number.isFinite(p.exp)||!Number.isFinite(p.iat)||p.iat>now+60000||p.exp<=now||p.exp-p.iat!==TTL||!Number.isSafeInteger(p.user?.id)||p.user.id<=0)throw Error();
  return p.user;
 }catch{throw Error('auth');}
}
