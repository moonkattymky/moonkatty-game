/* CI-only native faults below the unchanged MKTYStorage facade. */
(() => {
 'use strict';
 const object=window.localStorage,proto=Storage.prototype;
 const native={get:proto.getItem,set:proto.setItem,remove:proto.removeItem,key:proto.key,length:Object.getOwnPropertyDescriptor(proto,'length').get};
 const H={object,native,mode:null,rows:[],outside:[],fault:null,readFault:null,serial:0};
 H.snapshot=()=>{const data={};for(let i=0;i<native.length.call(object);i++){const k=native.key.call(object,i);data[k]=native.get.call(object,k);}return data;};
 H.arm=(ordinal,mode='continuation')=>{H.fault={ordinal,mode};};
 proto.getItem=function(key){if(this===object&&H.readFault===String(key)){H.readFault=null;throw new DOMException('CI native read fault','SecurityError');}return native.get.call(this,key);};
 for(const [method,name] of [['setItem','set'],['removeItem','remove']])proto[method]=function(key,value){
  if(this!==object)return native[name].call(this,key,value);
  const row={mode:H.mode,kind:name,key:String(key),value:name==='set'?String(value):null,success:false};
  if(H.mode){row.ordinal=H.rows.filter(r=>r.mode===H.mode).length;H.rows.push(row);if(row.ordinal>=40)throw Error('Native finite write bound exceeded');}
  else{H.outside.push(row);if(H.outside.length>2000)throw Error('Unexpected native background mutation volume');}
  if(H.fault&&H.mode===H.fault.mode&&row.ordinal===H.fault.ordinal){H.fault=null;row.injected=true;throw new DOMException('CI below-facade write fault','QuotaExceededError');}
  const result=native[name].call(this,key,value);row.success=true;return result;
 };
 window.__finaleNative=H;
})();
