// Public support is a plain, user-initiated mailto link in every interface language.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const email='moonkattymky@gmail.com',href='mailto:'+email;
const labels={en:['Support','Questions or data requests:'],ru:['Поддержка','Вопросы и запросы о данных:'],uk:['Підтримка','Питання та запити щодо даних:'],es:['Ayuda','Preguntas o solicitudes sobre datos:'],pt:['Suporte','Dúvidas ou solicitações sobre dados:'],de:['Hilfe','Fragen oder Datenanfragen:'],fr:['Assistance','Questions ou demandes concernant vos données :'],it:['Assistenza','Domande o richieste sui dati:'],tr:['Destek','Sorular veya veri talepleri:'],he:['תמיכה','שאלות או בקשות בנוגע למידע:'],ar:['الدعم','للأسئلة أو طلبات البيانات:'],ko:['고객 지원','문의 또는 데이터 요청:'],zh:['支持','问题或数据请求：']};
function mailLinks(html){return [...html.matchAll(/<a\b([^>]*\bhref="mailto:[^"]*"[^>]*)>([\s\S]*?)<\/a>/g)].map(([,attrs,text])=>({attrs,text}));}
function checkLinks(html,count){const links=mailLinks(html);assert.equal(links.length,count);for(const link of links){assert(link.attrs.includes('href="'+href+'"'),'only the project mailbox, with no prefilled message or player data');assert(!/\bon\w+=|\btarget=/.test(link.attrs),'no script handler or new window');}return links;}
const html=read('index.html');assert.equal(checkLinks(html,1)[0].text,'Support');assert(html.includes('data-support-link'));
for(const file of ['terms.html','privacy.html']){
 const articles=[...read(file).matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)];assert.equal(articles.length,2,file+' retains RU and EN articles');
 for(const [,article] of articles)for(const link of checkLinks(article,file==='terms.html'?1:2)){assert.equal(link.text,email);assert(link.attrs.includes('dir="ltr"'));assert(link.attrs.includes('translate="no"'));}
}
// Evaluate the real i18n runtime and More/contact renderer without browser sockets.
const ctx={document:{body:{classList:{toggle(){}}},documentElement:{},getElementById(){return null;}},localStorage:{getItem(){return 'en';}},MutationObserver:class{disconnect(){}observe(){}},Event:class{},dispatchEvent(){},COMMUNITY_LINKS:{telegram:'https://t.me/moonkattymkty'},esc:s=>s};
ctx.window=ctx;vm.createContext(ctx);
for(const lang of Object.keys(labels).filter(x=>x!=='en'))vm.runInContext(read('locales/runtime/'+lang+'.js'),ctx);
vm.runInContext(read('i18n.js'),ctx);ctx.tr=ctx.MKTYI18n.tr;
const source=read('mission-control.js'),start=source.indexOf(' function moreLinks()'),end=source.indexOf(' function more(){');assert(start>=0&&end>start);vm.runInContext(source.slice(start,end),ctx);
for(const [lang,[label,questions]] of Object.entries(labels)){
 ctx.MKTYI18n.setLanguage(lang);assert.equal(ctx.MKTYI18n.t('Support'),label);assert.equal(ctx.MKTYI18n.t('Questions or data requests:'),questions);
 assert.equal(ctx.document.documentElement.dir,['he','ar'].includes(lang)?'rtl':'ltr');
 const rendered=vm.runInContext('moreInfo()',ctx),links=checkLinks(rendered,2),button=links.find(l=>l.attrs.includes('data-support-link')),address=links.find(l=>l.text===email);
 assert.equal(button?.text,label,lang+' support button');assert(rendered.includes(questions),lang+' contact description');assert(address?.attrs.includes('dir="ltr"'),lang+' email remains LTR');assert(address?.attrs.includes('translate="no"'),lang+' email is never translated');
 assert(rendered.includes('href="terms.html"')&&rendered.includes('href="privacy.html"'),'legal links retained');
}
const loader=read('locale-loader.js');assert(loader.includes('20261011-support-1'));assert(html.includes('locale-loader.js?v=20261011-support-1')&&html.includes('mission-control.js?v=20261011-support-1'),'updated UI and runtime packs invalidate their old cache URLs');
console.log('PASS: project-only mailto links, RU/EN legal contacts, all 13 support translations, RTL/LTR email isolation and updated cache URLs');
