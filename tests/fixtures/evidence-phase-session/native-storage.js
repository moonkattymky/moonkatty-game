/* CI-only, below-facade first-order observation. Never retains PLAYING values.
   Every native mutation gets a bounded metadata row; finite writer rows retain
   exact values. Test observations are outside the component representation ledger. */
(() => {
  'use strict';
  const object=window.localStorage,proto=Storage.prototype;
  const native={get:proto.getItem,set:proto.setItem,remove:proto.removeItem};
  const finite=new Set(['OPENING','DISPATCH','ENTRY_NAVIGATION','ENTRY_CONFIRM','EPILOGUE']);
  const background=new Set(['mkty_global_lives','mkty_life_restore_at','mkty_expeditions_v1','mkty_daily_demo','mkty_campaign_checkpoint_8','mkty_campaign_checkpoint_9']);
  const H={object,native,rows:[],exactRows:[],lastTargets:Object.create(null),errors:[],state:()=> 'BOOT',mode:()=> 'boot',finite,background};
  H.read=key=>native.get.call(object,key);
  for(const [method,kind]of [['setItem','set'],['removeItem','remove']])proto[method]=function(key,value){
    if(this!==object)return native[kind].call(this,key,value);
    key=String(key);const text=kind==='set'?String(value):null,state=H.state();
    const row={n:H.rows.length,state,mode:H.mode(),kind,key,bytes:text?.length*2||0,success:false,exact:finite.has(state)&&!background.has(key)};
    if(H.rows.length>=12000){H.errors.push('native-observation-row-limit');throw Error(H.errors.at(-1));}
    H.rows.push(row);
    if(row.exact){
      if(H.exactRows.length>=160||text!==null&&text.length*2>65536){H.errors.push('native-finite-observation-limit');throw Error(H.errors.at(-1));}
      row.value=text;H.exactRows.push(row);
    }
    const result=native[kind].call(this,key,value);row.success=true;
    if(H.targetKeys?.has(key))H.lastTargets[key]=text;
    return result;
  };
  window.__phaseNative=H;
})();
