/* Targeted in-process DOM for the real locale, daily and chapter scripts.
 * Mutation records are delivered explicitly; interval callbacks never run implicitly.
 * No layout, browser, HTTP server, network, or real account is emulated. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.MKTY_LANGUAGE_TEST_ROOT||path.join(__dirname,'..'));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const P=require(root+'/story-plan.js');
function harness(saved=new Map([['mkty_lang','ru']]),options={}){
 const observers=[],listeners=new Map(),scripts=[],intervals=[],timers=[],writes=[];
 let active='home',random=7100;
 const descendant=(node,ancestor)=>{for(let n=node;n;n=n.parentElement)if(n===ancestor)return true;return false;};
 function notify(record){for(const o of observers)if(o.target&&(record.target===o.target||o.options.subtree&&descendant(record.target,o.target))&&o.options[record.type]&&(!o.options.attributeFilter||record.type!=='attributes'||o.options.attributeFilter.includes(record.attributeName)))o.records.push(record);}
 class Observer{constructor(callback){this.callback=callback;this.records=[];observers.push(this);}observe(target,options){this.target=target;this.options=options;}disconnect(){this.target=null;this.records=[];}}
 class Text{constructor(data){this.nodeType=3;this._data=String(data);this.parentElement=null;}get data(){return this._data;}set data(v){this._data=String(v);notify({type:'characterData',target:this});}get textContent(){return this.data;}set textContent(v){this.data=v;}}
 function matches(el,selector){
  const tag=selector.match(/^[a-z][\w-]*/i)?.[0];if(tag&&el.tagName!==tag.toLowerCase())return false;
  const id=selector.match(/#([\w-]+)/)?.[1];if(id&&el.id!==id)return false;
  for(const match of selector.matchAll(/\.([\w-]+)/g))if(!el.classList.contains(match[1]))return false;
  for(const [,key,value] of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g))if(el.getAttribute(key)===null||value!==undefined&&el.getAttribute(key)!==value)return false;
  return true;
 }
 class Element{
  constructor(tag='div'){this.nodeType=1;this.tagName=tag;this.childNodes=[];this.parentElement=null;this.attributes={};this.dataset={};this.style={setProperty(){}};this.value='';this.disabled=false;this.hidden=false;this.events=new Map();
   this.classList={contains:c=>this.className.split(/\s+/).includes(c),add:c=>{if(!this.classList.contains(c))this.className=(this.className+' '+c).trim();},remove:c=>{this.className=this.className.split(/\s+/).filter(x=>x!==c).join(' ');},toggle:(c,on)=>{on=on??!this.classList.contains(c);this.classList[on?'add':'remove'](c);return on;}};
  }
  setAttribute(k,v){v=String(v);this.attributes[k]=v;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;notify({type:'attributes',target:this,attributeName:k});}
  getAttribute(k){return Object.hasOwn(this.attributes,k)?this.attributes[k]:null;}removeAttribute(k){delete this.attributes[k];}
  get id(){return this.getAttribute('id')||'';}set id(v){this.setAttribute('id',v);}get className(){return this.getAttribute('class')||'';}set className(v){this.setAttribute('class',v);}
  get lang(){return this.getAttribute('lang')||'';}set lang(v){this.setAttribute('lang',v);}get dir(){return this.getAttribute('dir')||'';}set dir(v){this.setAttribute('dir',v);}
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}get firstChild(){return this.childNodes[0];}get lastChild(){return this.childNodes.at(-1);}
  get textContent(){return this.childNodes.map(n=>n.textContent).join('');}set textContent(v){this.replaceChildren(new Text(v));}
  append(...nodes){for(const n of nodes){n.parentElement=this;this.childNodes.push(n);}notify({type:'childList',target:this,addedNodes:nodes});}appendChild(n){this.append(n);return n;}
  replaceChildren(...nodes){for(const n of this.childNodes)n.parentElement=null;this.childNodes=[];this.append(...nodes);}
  set innerHTML(html){this.replaceChildren();const stack=[this];for(const token of html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)||[]){
   if(token.startsWith('<!--'))continue;if(token.startsWith('</')){stack.pop();continue;}
   if(token.startsWith('<')){const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const el=new Element(tag);for(const [,k,a,b]of token.slice(tag.length+1).matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'))?/g))el.setAttribute(k,a??b??'');stack.at(-1).append(el);if(!['input','br','hr','img','source','link','meta'].includes(tag)&&!token.endsWith('/>'))stack.push(el);}
   else stack.at(-1).append(new Text(token.replaceAll('&amp;','&')));
  }}
  querySelectorAll(s){const result=[];const walk=n=>{for(const c of n.children){if(s.split(',').some(x=>matches(c,x.trim())))result.push(c);walk(c);}};walk(this);return result;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  closest(s){for(let n=this;n;n=n.parentElement)if(s.split(',').some(x=>matches(n,x.trim())))return n;return null;}
  addEventListener(type,fn){this.events.set(type,[...(this.events.get(type)||[]),fn]);}
  dispatchEvent(e){e.target??=this;for(const fn of this.events.get(e.type)||[])fn(e);if(e.type==='click')this.onclick?.(e);if(e.bubbles)this.parentElement?.dispatchEvent(e);return true;}
  click(){if(!this.disabled)this.dispatchEvent({type:'click',bubbles:true});}compareDocumentPosition(){return 0;}before(n){this.parentElement?.append(n);}remove(){if(this.parentElement)this.parentElement.childNodes=this.parentElement.childNodes.filter(n=>n!==this);}
 }
 const html=new Element('html'),head=new Element('head'),body=new Element('body');html.append(head,body);
 const document={documentElement:html,head,body,hidden:false,readyState:'complete',createElement:tag=>new Element(tag),createTextNode:s=>new Text(s),getElementById:id=>html.querySelector('#'+id),querySelector:s=>html.querySelector(s),querySelectorAll:s=>html.querySelectorAll(s),addEventListener(){},write:s=>writes.push(s)};
 const app=new Element('main');app.id='app';body.append(app);const source=read('index.html');
 app.innerHTML='<section id="home" class="screen active"><p id="chooseText"></p><p id="welcome"></p><button id="enterBtn"></button><button id="expeditionEntry"></button><b id="points"></b>'+source.slice(source.indexOf('      <section id="dailyOps"'),source.indexOf('      <section id="communityHub"'))+'</section><section id="chapters" class="screen"><div id="chapterList"></div></section>'+Array.from({length:9},(_,i)=>`<section id="mission${i+1}" class="screen"><div id="life${i+1}Complete"></div></section>`).join('');
 const append=head.appendChild.bind(head);head.appendChild=s=>{scripts.push(s);return append(s);};
 const storage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,String(v)),removeItem:k=>saved.delete(k),key:i=>[...saved.keys()][i],get length(){return saved.size;}};
 const show=id=>{ctx.MKTYStory?.onScreen(id);document.getElementById(active)?.classList.remove('active');active=id;document.getElementById(id).classList.add('active');};
 const ctx={console,document,localStorage:storage,URL,URLSearchParams,Blob,Date,Uint32Array,Promise,Node:{TEXT_NODE:3,ELEMENT_NODE:1,DOCUMENT_POSITION_FOLLOWING:4},MutationObserver:Observer,
  Event:class{constructor(type,options={}){this.type=type;Object.assign(this,options);}},MouseEvent:class{constructor(type,options={}){this.type=type;Object.assign(this,options);}},
  addEventListener:(type,fn)=>listeners.set(type,[...(listeners.get(type)||[]),fn]),dispatchEvent:e=>{for(const fn of listeners.get(e.type)||[])fn(e);},
  setInterval:(fn,ms)=>(intervals.push({fn,ms}),intervals.length),setTimeout:(fn,ms)=>(timers.push({fn,ms}),timers.length),clearTimeout(){},queueMicrotask:fn=>Promise.resolve().then(fn),crypto:{getRandomValues:a=>{a[0]=random++;return a;}},
  StoryPlan:P,FieldRules:require(root+'/field-model.js'),MissionRules:require(root+'/mission-rules.js'),ExpeditionRules:require(root+'/expedition-model.js'),FieldArt:{map:(_n,steps)=>steps.map(s=>`<g data-map-step="${s.id}"></g>`).join('')},
  MKTYCampaign:{render(){}},MKTYOps:{pending:()=>false},show,remainingLife1CodeTime:()=>0};
 ctx.window=ctx;vm.createContext(ctx);
 const run=file=>vm.runInContext(read(file),ctx,{filename:file});
 for(const [i,name]of ['openMission','openMission2','openLife3MemoryGate','openMission4','openMission5','openMission6','openMission7','openMission8','openMission9'].entries())ctx[name]=()=>show('mission'+(i+1));
 run('locale-loader.js');const selected=saved.get('mkty_lang')||'en';if(selected!=='en'&&options.preloadSaved!==false)run('locales/runtime/'+selected+'.js');run('i18n.js');run('story.js');run('daily-retention.js');
 // Exercise the complete unmodified selection function, including its immediate
 // hero/preference updates. Other app controllers are outside this DOM fixture.
 const appSource=read('app.js');vm.runInContext(appSource.slice(appSource.indexOf('const copy ='),appSource.indexOf('langs.forEach')),ctx,{filename:'app.js:setLang'});
 async function flush(){for(let i=0;i<20;i++){await Promise.resolve();let count=0;for(const o of observers){const records=o.records.splice(0);if(records.length){count+=records.length;o.callback(records);}}if(!count&&i>=3)return;}throw Error('Mutation queue did not settle');}
 const load=code=>{run('locales/runtime/'+code+'.js');scripts.findLast(s=>s.tagName==='script'&&s.src.includes('/'+code+'.js')).onload();};
 async function select(code){storage.setItem('mkty_lang',code);const job=ctx.MKTYI18n.setLanguage(code);if(job&&!ctx.MKTYI18n.hasLocale(code))load(code);await job;await flush();}
 async function selectApp(code){const job=ctx.setLang(code);if(job&&!ctx.MKTYI18n.hasLocale(code))load(code);await job;await flush();}
 return {ctx,document,selectApp,get:document.getElementById,run,select,load,flush,show,saved,storage,intervals,timers,scripts,writes,active:()=>active};
}
module.exports={harness,root,P};
