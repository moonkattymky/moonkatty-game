'use strict';
/* Socket-free controller fixture. The production controller and model are unmodified.
 * This small DOM adapter parses their control markup, bubbles dispatched input/click
 * events and detects replacement of a focused node. It does not implement native
 * range keyboard behavior, browser layout, hit testing or a screen reader. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../field-model.js');
const root=path.resolve(__dirname,'..'),clone=value=>JSON.parse(JSON.stringify(value));
const BASELINE=path.join(__dirname,'fixtures/triangulation-baseline-field-missions.js');
const BASELINE_SHA256='87ae7505443efcaa76ec1cf8c9b0293493a8d3b32ded761d08f8fae280bbf168';
function fixture({source=path.join(root,'field-missions.js'),seed=0,stage=0,lang='en',saved=null}={}){
 let document;
 class Events{
  constructor(){this.listeners=new Map();}
  addEventListener(type,callback){const callbacks=this.listeners.get(type)||[];callbacks.push(callback);this.listeners.set(type,callbacks);}
  dispatchEvent(event){
   event.target??=this;event.preventDefault??=()=>{event.defaultPrevented=true;};
   event.stopPropagation??=()=>{event.stopped=true;};
   for(const callback of this.listeners.get(event.type)||[])callback(event);
   this['on'+event.type]?.(event);
   if(event.bubbles&&!event.stopped)this.parentElement?.dispatchEvent(event);
   return !event.defaultPrevented;
  }
 }
 const decode=text=>text.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
 class Element extends Events{
  constructor(tag='div'){
   super();this.tagName=tag.toUpperCase();this.attributes={};this.dataset={};this.children=[];
   this.parentElement=null;this.style={};this.disabled=false;this.hidden=false;this.open=false;this._text='';this._value='';
   this.classList={contains:name=>this.className.split(/\s+/).includes(name),
    add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},
    remove:(...names)=>{this.className=this.className.split(/\s+/).filter(x=>!names.includes(x)).join(' ');}};
  }
  get id(){return this.attributes.id||'';}set id(value){this.setAttribute('id',value);}
  get className(){return this.attributes.class||'';}set className(value){this.setAttribute('class',value);}
  get value(){return this._value;}set value(value){this._value=String(value);}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set textContent(value){this.disconnectChildren();this._text=String(value);}
  get isConnected(){return this===document?.body||!!this.parentElement?.isConnected;}
  setAttribute(name,value){
   this.attributes[name]=String(value);
   if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);
   if(name==='value')this.value=value;if(name==='disabled')this.disabled=true;if(name==='hidden')this.hidden=true;
  }
  getAttribute(name){return Object.hasOwn(this.attributes,name)?this.attributes[name]:null;}
  removeAttribute(name){delete this.attributes[name];if(name==='disabled')this.disabled=false;if(name==='hidden')this.hidden=false;}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  contains(node){return this===node||this.children.some(child=>child.contains(node));}
  disconnectChildren(){
   if(document?.activeElement&&this.children.some(child=>child.contains(document.activeElement)))document.activeElement=document.body;
   for(const child of this.children)child.parentElement=null;this.children=[];
  }
  set innerHTML(html){
   this.disconnectChildren();this._html=String(html);this._text='';const stack=[this];
   for(const token of this._html.match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+/g)||[]){
    if(token.startsWith('<!--'))continue;
    if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}
    if(token.startsWith('<')){
     const match=token.match(/^<([\w-]+)/);if(!match)continue;const node=new Element(match[1]);
     for(const attr of token.slice(match[0].length).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/>]+)))?/g))node.setAttribute(attr[1],decode(attr[2]??attr[3]??attr[4]??''));
     stack.at(-1).append(node);if(!/\/$/.test(token.slice(0,-1))&&!['INPUT','BR','HR','IMG','META','LINK'].includes(node.tagName))stack.push(node);
    }else stack.at(-1)._text+=decode(token);
   }
  }
  get innerHTML(){return this._html||'';}
  matches(selector){
   if(selector.includes(','))return selector.split(',').some(part=>this.matches(part.trim()));
   const parts=selector.trim().split(/\s+/),leaf=parts.pop();
   const attrs=[...leaf.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)];
   const base=leaf.replace(/\[[^\]]+\]/g,'');
   if(base.startsWith('#')&&this.id!==base.slice(1))return false;
   if(base.startsWith('.')&&!this.classList.contains(base.slice(1)))return false;
   if(base&&!/^[#.]/.test(base)&&this.tagName!==base.toUpperCase())return false;
   if(attrs.some(([,name,value])=>this.getAttribute(name)===null||value!==undefined&&this.getAttribute(name)!==value))return false;
   return !parts.length||!!this.parentElement?.closest(parts.join(' '));
  }
  closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  focus(){if(!this.disabled)document.activeElement=this;}
  click(){if(!this.disabled)this.dispatchEvent({type:'click',bubbles:true});}
  showModal(){this.open=true;}close(){this.open=false;}getAnimations(){return [];}
  getScreenCTM(){return {inverse:()=>({a:2,b:0,c:0,d:4/3,e:-160,f:-160/3})};}
  createSVGPoint(){return {x:0,y:0,matrixTransform(m){return {x:m.a*this.x+m.c*this.y+m.e,y:m.b*this.x+m.d*this.y+m.f};}};}
 }
 document=Object.assign(new Events(),{body:new Element('body'),hidden:false,activeElement:null,createElement:tag=>new Element(tag),
  getElementById:id=>document.body.querySelector('#'+id)});
 const app=new Element();app.id='app';document.body.append(app);document.activeElement=document.body;
 const data=new Map([['mkty_lang',lang]]),saves=[],completions=[],signals=[];
 const localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value))};
 const context=Object.assign(new Events(),{console,document,localStorage,structuredClone,FieldRules:R,
  // Geometry and SVG coordinate conversion are boundary adapters. Art is deliberately not tested here.
  FieldArt:{scene:()=>'<svg viewBox="0 0 600 450">'+[0,1,2].map(i=>`<g role="button" tabindex="0" data-field-cell="${i}"></g>`).join('')+'</svg>'},
  setInterval(){},requestAnimationFrame(){return 1;},cancelAnimationFrame(){},matchMedia:()=>({matches:true}),
  MouseEvent:class{constructor(type,init){this.type=type;Object.assign(this,init);}},MKTYExperience:{signal:value=>signals.push(value)}});
 context.window=context;context.show=id=>{for(const node of app.children)node.classList.remove('active');document.getElementById(id).classList.add('active');};
 vm.createContext(context);vm.runInContext(fs.readFileSync(source,'utf8'),context,{filename:path.relative(root,source)});
 const $=id=>{const node=document.getElementById(id);assert(node,'Fixture expected #'+id);return node;};
 const task={chapter:8,id:0,fieldStage:stage,seed,title:['Триангуляция','Triangulation'],save:value=>saves.push(clone(value)),complete:value=>completions.push(clone(value)),exit:()=>context.show('fieldMission')};
 const open=checkpoint=>context.MKTYField.open(task,checkpoint);
 open(saved);
 const range=name=>$('fieldControls').querySelector(`[data-field-slider="${name}"]`);
 const rangeInput=(name,value,{focus=true}={})=>{
  const element=range(name);assert(element,'Rendered range missing: '+name);
  if(focus)element.focus();element.value=value;element.dispatchEvent({type:'input',bubbles:true});return element;
 };
 const activate=(action,value)=>{
  const selector=`[data-field-action="${action}"]`+(value===undefined?'':`[data-value="${value}"]`);
  const element=$('fieldControls').querySelector(selector);assert(element,'Rendered action missing: '+selector);
  element.focus();element.click();return element;
 };
 const pointer=(x,y)=>$('fieldWorld').querySelector('svg').dispatchEvent({type:'click',bubbles:true,clientX:80+x*.5,clientY:40+y*.75});
 return {context,document,$,range,rangeInput,activate,pointer,saves,completions,signals,open,
  snapshot:()=>clone(context.MKTYField.snapshot()),saved:()=>clone(saves.at(-1)),resume:()=>$('fieldResume').click(),
  submit:()=>$('fieldSubmit').click(),pause:()=>$('fieldPause').click(),hide:()=>context.dispatchEvent({type:'pagehide'}),
  inactive:()=>{$('fieldMission').classList.remove('active');},active:()=>{$('fieldMission').classList.add('active');}};
}
function lockBearings(h){
 const bearings=R.layout(h.snapshot()).bearings;
 for(let station=0;station<3;station++){
  h.activate('station',station);h.rangeInput('angle',Math.round(bearings[station]));h.activate('sample');
  assert.equal(h.snapshot().samples[station],true,'Bearing must be earned through production controls');
 }
 assert(h.snapshot().samples.every(Boolean));
}
module.exports={fixture,lockBearings,BASELINE,BASELINE_SHA256,R,clone};
