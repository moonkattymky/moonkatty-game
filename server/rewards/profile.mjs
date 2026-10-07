/* Leaderboard identity: built only from signature-verified Telegram initData.user. */
const PHOTO_HOSTS=/^(t\.me|telegram\.org|[a-z0-9-]+\.telegram\.org|telesco\.pe|[a-z0-9-]+\.telesco\.pe|[a-z0-9-]+\.telegram-cdn\.org)$/;
export const NAME_MAX=32;
export function cleanText(v,max=NAME_MAX){
 if(typeof v!=='string')return '';
 const s=v.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g,'').replace(/[<>"'`&]/g,'').replace(/\s+/g,' ').trim();
 const chars=[...s];return chars.length>max?chars.slice(0,max-1).join('').trim()+'…':s;
}
export function displayName(user){
 const full=cleanText([user?.first_name,user?.last_name].filter(x=>typeof x==='string').join(' '));
 if(full)return full;
 return typeof user?.username==='string'&&/^[A-Za-z0-9_]{3,32}$/.test(user.username)?'@'+user.username:null;
}
export function safePhoto(v){
 if(typeof v!=='string'||v.length>512)return null;
 try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&PHOTO_HOSTS.test(u.hostname)?u.href:null;}catch{return null;}
}
export function profileFields(user){return {display_name:displayName(user),photo_url:safePhoto(user?.photo_url),profile_updated_at:new Date().toISOString()};}
