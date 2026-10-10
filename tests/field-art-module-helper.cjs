/* In-process DOM/clock fixture for the actual optional-art loader and controller.
   No browser, network, listener, extracted functions, or renderer substitution. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),R=require('../field-model.js');
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
function fixture({controller=false,loader=true,loaderURL='https://preview.example/game/field-art-loader.js?v=test'}={}){
 const nodes=new Map(),scripts=[],timers=new Map(),intervals=new Map(),frames=new Map(),storage=new Map(),writes=[],events=[],saves=[],calls={act:0,tick:0,clearInput:0};let serial=0;
 function node(tag='div',id=''){
  const listeners=new Map(),classes=new Set(),attrs=new Map();let html='',text='';
  const e={tagName:tag.toUpperCase(),id,dataset:{},style:{},open:false,hidden:false,disabled:false,value:'',parentNode:null,
   classList:{contains:k=>classes.has(k),add:(...ks)=>ks.forEach(k=>classes.add(k)),remove:(...ks)=>ks.forEach(k=>classes.delete(k)),toggle(k,on){if(on===undefined)on=!classes.has(k);on?classes.add(k):classes.delete(k);}},
   addEventListener(type,fn){const a=listeners.get(type)||[];a.push(fn);listeners.set(type,a);},removeEventListener(type,fn){listeners.set(type,(listeners.get(type)||[]).filter(f=>f!==fn));},
   dispatchEvent(event){event.target??=this;event.preventDefault??=()=>{};for(const fn of listeners.get(event.type)||[])fn(event);this['on'+event.type]?.(event);return true;},
   setAttribute(k,v){attrs.set(k,String(v));if(k==='src')this.src=String(v);},getAttribute:k=>attrs.get(k)??null,
   append(...children){for(const c of children){c.parentNode=this;if(c.id)nodes.set(c.id,c);if(c.tagName==='SCRIPT')scripts.push(c);}},appendChild(c){this.append(c);return c;},removeChild(c){c.parentNode=null;},remove(){this.parentNode=null;},
   getAnimations:()=>[],querySelectorAll(selector){if(selector==='.held'){calls.clearInput++;return [];}if(this.id==='fieldControls')return [...nodes.values()].filter(n=>n.dataset.fieldSlider||n.dataset.fieldAction);return [];},
   querySelector(selector){const m=selector.match(/\[data-field-(slider|read)="([^"]+)"\]/);if(m)return nodes.get((m[1]==='slider'?'slider:':'read:')+m[2])||null;return null;},
   matches:selector=>tag==='input'&&selector.includes('input'),closest:()=>null,
   focus(){context.document.activeElement=this;events.push({type:'focus',id:this.id});},showModal(){this.open=true;events.push({type:'showModal',id:this.id});},close(){this.open=false;events.push({type:'close',id:this.id});},animate(){return {finish(){}};},setPointerCapture(){}};
  Object.defineProperties(e,{innerHTML:{get:()=>html,set(v){html=String(v);writes.push({id:this.id,value:html});for(const m of html.matchAll(/\bid="([^"]+)"/g))if(!nodes.has(m[1]))nodes.set(m[1],node(m[1]==='fieldDialog'?'dialog':'div',m[1]));if(this.id==='fieldControls'){for(const [k,n]of nodes)if(n.dataset.fieldSlider||k.startsWith('read:'))nodes.delete(k);for(const m of html.matchAll(/<input\b([^>]+)>/g)){const a=m[1],name=a.match(/data-field-slider="([^"]+)"/)[1],index=a.match(/data-index="([^"]*)"/)?.[1]||'',input=node('input','slider:'+name+index);input.dataset={fieldSlider:name,index};input.value=a.match(/value="([^"]*)"/)?.[1]||'';nodes.set(input.id,input);const read=node('b','read:'+name+index);nodes.set(read.id,read);}}}},textContent:{get:()=>text,set(v){text=String(v);writes.push({id:this.id,text});}},className:{get:()=>[...classes].join(' '),set(v){classes.clear();String(v).split(/\s+/).filter(Boolean).forEach(k=>classes.add(k));}}});
  if(id)nodes.set(id,e);return e;
 }
 const app=node('div','app'),head=node('head'),docListeners=new Map(),windowListeners=new Map();
 const document={head,body:node('body'),currentScript:{src:loaderURL},hidden:false,activeElement:null,baseURI:'https://preview.example/game/index.html',createElement:tag=>node(tag),getElementById:id=>nodes.get(id)||null,querySelector:()=>null,addEventListener(type,fn){docListeners.set(type,fn);}};
 const context={console,URL,Promise,structuredClone,Set,Map,performance:{now:()=>0},document,location:new URL(document.baseURI),FieldRules:{...R,act(...args){calls.act++;return R.act(...args);},tick(...args){calls.tick++;return R.tick(...args);}},localStorage:{getItem:k=>storage.get(k)??null,setItem(k,v){storage.set(k,String(v));events.push({type:'storage',key:k});}},setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval(fn,ms){const id=++serial;intervals.set(id,{fn,ms});return id;},clearInterval:id=>intervals.delete(id),requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),matchMedia:()=>({matches:true}),addEventListener(type,fn){const a=windowListeners.get(type)||[];a.push(fn);windowListeners.set(type,a);},show(id){for(const n of nodes.values())if(n.classList.contains('screen'))n.classList.toggle('active',n.id===id);events.push({type:'show',id});},MouseEvent:class{constructor(type,opts){this.type=type;Object.assign(this,opts);}}};
 context.window=context;vm.createContext(context);
 const run=(file,script=document.currentScript)=>{document.currentScript=script;try{return vm.runInContext(source(file),context,{filename:file,timeout:1500});}finally{document.currentScript=null;}};
 run('field-art.js');const core={...context.FieldArt};if(loader)run('field-art-loader.js',{src:loaderURL});
 if(controller)run('field-missions.js');
 const task=(overrides={})=>({chapter:3,mechanic:3,id:0,fieldStage:0,seed:401,title:['Проверка','Fixture'],save:s=>saves.push(structuredClone(s)),exit:()=>context.show('chapters'),complete:()=>context.show('chapters'),...overrides});
 const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 return {context,nodes,scripts,timers,intervals,frames,storage,writes,events,saves,calls,core,run,task,settle,
  get art(){return context.FieldArt;},get modules(){return context.MKTYFieldArtModules;},get field(){return context.MKTYField;},
  register(render,{script=scripts.at(-1),n=3,api=1,version='20261010-flight-1'}={}){document.currentScript=script;try{return context.MKTYFieldArtModules.register(n,api,version,render);}finally{document.currentScript=null;}},
  load(script=scripts.at(-1)){run('art-scenes/trajectory.js',script);script.onload?.();},
  fire(type,event={}){for(const fn of windowListeners.get(type)||[])fn({type,target:node(),preventDefault(){},...event});},
  timeout(){for(const [id,t]of [...timers]){timers.delete(id);t.fn();}},
  input(name,value){const target=nodes.get('slider:'+name);target.value=String(value);nodes.get('fieldMission').dispatchEvent({type:'input',target});},
  snap:()=>structuredClone(context.MKTYField.snapshot()),
  observable:()=>JSON.stringify({state:context.MKTYField?.snapshot(),saves,calls,events,storage:[...storage],controls:nodes.get('fieldControls')?.innerHTML,focus:document.activeElement?.id,dialog:nodes.get('fieldDialog')?.open})
 };
}
module.exports={fixture,source,root,R};
