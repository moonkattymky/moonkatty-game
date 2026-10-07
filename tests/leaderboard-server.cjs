const assert=require('node:assert/strict');
(async()=>{
 const {createHandler}=await import('../server/mission-control/core.mjs');
 const {displayName,safePhoto,cleanText}=await import('../server/mission-control/profile.mjs');
 const R=await import('../server/rewards/profile.mjs');assert.equal(R.displayName({first_name:'A'}),'A');
 // Name rules: first+last, then @username, sanitized, length-limited.
 assert.equal(displayName({first_name:'Igor',last_name:'Sh'}),'Igor Sh');
 assert.equal(displayName({username:'moon_cat'}),'@moon_cat');
 assert.equal(displayName({username:'bad name<'}),null);
 const evil=displayName({first_name:'<img src=x onerror=alert(1)>',last_name:'"Bob"'});assert(!/[<>"'&]/.test(evil));
 assert([...displayName({first_name:'X'.repeat(200)})].length<=32);assert.equal(cleanText('a\u202eb\u0000c'),'abc');
 assert.equal(safePhoto('https://t.me/i/userpic/320/a.jpg'),'https://t.me/i/userpic/320/a.jpg');
 assert.equal(safePhoto('https://cdn4.telesco.pe/file/a.jpg'),'https://cdn4.telesco.pe/file/a.jpg');
 for(const bad of ['http://t.me/a.jpg','https://evil.com/a.jpg','https://t.me.evil.com/a','javascript:alert(1)','https://u:p@t.me/a','https://t.me:444/a',123])assert.equal(safePhoto(bad),null);
 // Handler: visible players show name/photo, hidden show callsign, no photo; caller profile is refreshed.
 let rows=[{telegram_id:1,moon_points:900,story_life:5,display_name:'Igor Sh',photo_url:'https://t.me/i/userpic/320/a.jpg',leaderboard_hidden:false},
  {telegram_id:2,moon_points:500,story_life:2,display_name:'Secret Person',photo_url:'https://t.me/i/userpic/320/b.jpg',leaderboard_hidden:true},
  {telegram_id:3,moon_points:100,story_life:1,display_name:null,photo_url:null,leaderboard_hidden:false}];
 const patches=[];const fetcher=async(url,opts)=>{if(opts.method==='PATCH'){patches.push({id:new URL(url).searchParams.get('telegram_id'),body:JSON.parse(opts.body)});const p=JSON.parse(opts.body);const r=rows.find(x=>'eq.'+x.telegram_id===new URL(url).searchParams.get('telegram_id'));if(r)Object.assign(r,p);return new Response(null,{status:204});}
  return new Response(JSON.stringify(rows),{headers:{'Content-Range':'0-2/3'}});};
 const user={id:2,first_name:'<b>New</b>',last_name:'Name',photo_url:'https://evil.com/x.png'};
 const h=createHandler({url:'https://example.supabase.co',key:'k',fetcher,verify:async x=>{if(x!=='ok')throw Error('auth');return user;}});
 const pub=await (await h(new Request('https://x.test'))).json();
 assert.equal(pub.entries[0].name,'Igor Sh');assert.equal(pub.entries[0].photo,'https://t.me/i/userpic/320/a.jpg');
 assert.equal(pub.entries[1].hidden,true);assert.match(pub.entries[1].name,/^PILOT-[0-9A-F]{8}$/);assert.equal(pub.entries[1].name,pub.entries[1].callsign);assert.equal(pub.entries[1].photo,null);
 assert(!JSON.stringify(pub).includes('Secret Person'));assert(!JSON.stringify(pub).includes('telegram_id'));assert.equal(pub.entries[2].name,pub.entries[2].callsign);
 // Verified session refreshes name/photo; unsafe name escaped, foreign photo dropped.
 const own=await (await h(new Request('https://x.test',{method:'POST',body:JSON.stringify({initData:'ok'})}))).json();
 assert.equal(patches.length,1);assert.equal(patches[0].id,'eq.2');assert.equal(patches[0].body.display_name,'bNew/b Name');assert.equal(patches[0].body.photo_url,null);assert(!('leaderboard_hidden' in patches[0].body));
 assert.equal(own.hidden,true);assert.equal(own.self.self,true);assert.match(own.self.name,/^PILOT-/);
 // Privacy toggle persisted server-side.
 const shown=await (await h(new Request('https://x.test',{method:'POST',body:JSON.stringify({initData:'ok',action:'privacy',hidden:false})}))).json();
 assert.equal(patches[1].body.leaderboard_hidden,false);assert.equal(shown.hidden,false);assert.equal(shown.self.name,'bNew/b Name');assert(!/[<>]/.test(JSON.stringify(shown)));
 assert.equal((await h(new Request('https://x.test',{method:'POST',body:JSON.stringify({initData:'forged',action:'privacy',hidden:true})}))).status,401);assert.equal(patches.length,2);
 console.log('PASS: names, @username fallback, sanitizing, photo host allow-list, hidden callsign, profile refresh, privacy toggle, forged rejected');
})().catch(e=>{console.error(e);process.exitCode=1;});
