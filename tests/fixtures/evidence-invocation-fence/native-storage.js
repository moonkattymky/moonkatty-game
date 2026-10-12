/* CI-only native observation. No writes are suppressed, including pagehide writes. */
(() => {
  'use strict';
  const object = window.localStorage, proto = Storage.prototype;
  const native = {get:proto.getItem,set:proto.setItem,remove:proto.removeItem,key:proto.key,
    length:Object.getOwnPropertyDescriptor(proto,'length').get};
  const H = {object,native,mode:'boot',rows:[],fault:null,serial:0,errors:[]};
  const emit = data => { if (window.fenceEvidence) void window.fenceEvidence({...data,realm:location.pathname}).catch(()=>{}); };
  H.emit = emit;
  H.read = key => native.get.call(object,key);
  H.snapshot = () => {
    const out = {}, length = native.length.call(object);
    if (length > 256) throw Error('Native fixture storage key bound');
    for (let i=0;i<length;i++) {const key=native.key.call(object,i);out[key]=H.read(key);}
    return out;
  };
  H.arm = (ordinal,mode='original') => {
    if (!Number.isInteger(ordinal)||ordinal<0||ordinal>=40||H.fault) throw Error('Invalid native fault');
    H.fault={ordinal,mode};
  };
  for (const [method,op] of [['setItem','set'],['removeItem','remove']]) proto[method]=function(key,value) {
    if (this!==object) return native[op].call(this,key,value);
    const row={kind:'native-write',n:H.rows.length,mode:H.mode,op,key:String(key),value:op==='set'?String(value):null,success:false};
    if (H.rows.length>=4096||row.value!==null&&row.value.length*2>65536) {
      H.errors.push('Native observation bound exceeded');throw Error(H.errors.at(-1));
    }
    row.ordinal=H.rows.filter(r=>r.mode===H.mode).length;H.rows.push(row);
    if (H.fault?.mode===H.mode&&H.fault.ordinal===row.ordinal) {
      H.fault=null;row.injected=true;emit(row);throw new DOMException('CI native write failure before operation','QuotaExceededError');
    }
    try {const result=native[op].call(this,key,value);row.success=true;return result;}
    finally {emit(row);}
  };
  // Registered before game listeners. Their original pagehide writes run normally.
  window.addEventListener('pagehide',event=>{
    H.mode='pagehide';emit({kind:'pagehide-start',persisted:event.persisted,native:H.snapshot()});
  });
  window.__fenceNative=H;
})();
