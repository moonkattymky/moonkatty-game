/* PREPARED, NOT ACTIVE: YouTube subscription check through Google OAuth (scope youtube.readonly).
   Enabled only when YOUTUBE_OAUTH_ENABLED=true AND GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET /
   YOUTUBE_CHANNEL_ID / YOUTUBE_REDIRECT_URI are set. See server/youtube-oauth.md. Until then the
   YouTube subscribe action pays nothing; YouTube points come only from code words. */
export const YT_SUBSCRIBE_POINTS=5;
export function youtubeConfig(env){
 const c={enabled:String(env.YOUTUBE_OAUTH_ENABLED||'').toLowerCase()==='true',clientId:env.GOOGLE_CLIENT_ID||'',clientSecret:env.GOOGLE_CLIENT_SECRET||'',channelId:env.YOUTUBE_CHANNEL_ID||'',redirectUri:env.YOUTUBE_REDIRECT_URI||''};
 c.enabled=c.enabled&&!!(c.clientId&&c.clientSecret&&c.channelId&&c.redirectUri);
 return c;
}
export function authUrl(cfg,state){
 const q=new URLSearchParams({client_id:cfg.clientId,redirect_uri:cfg.redirectUri,response_type:'code',scope:'https://www.googleapis.com/auth/youtube.readonly',access_type:'online',prompt:'consent',state});
 return 'https://accounts.google.com/o/oauth2/v2/auth?'+q;
}
/** Exchange code -> token, then subscriptions.list(mine=true, forChannelId). Token is never stored. */
export async function isSubscribed(cfg,code,fetcher=fetch){
 const tr=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:cfg.clientId,client_secret:cfg.clientSecret,redirect_uri:cfg.redirectUri,grant_type:'authorization_code'})});
 const tok=await tr.json().catch(()=>({}));
 if(!tok.access_token)throw Error('oauth');
 const r=await fetcher('https://www.googleapis.com/youtube/v3/subscriptions?part=id&mine=true&forChannelId='+encodeURIComponent(cfg.channelId),{headers:{Authorization:'Bearer '+tok.access_token}});
 const body=await r.json().catch(()=>({}));
 if(!r.ok)throw Error('oauth');
 return (body.items||[]).length>0;
}
