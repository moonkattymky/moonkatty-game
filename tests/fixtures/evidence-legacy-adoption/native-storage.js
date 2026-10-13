/* CI-only observation. Verification reads are explicitly separate from operation reads. */
(() => {
  'use strict';
  const object = window.localStorage, proto = Storage.prototype;
  const native = {get:proto.getItem,set:proto.setItem,remove:proto.removeItem,key:proto.key};
  const rows = [], emit = row => {
    if (rows.length >= 12000) throw Error('legacy-native-observation-limit');
    rows.push({n:rows.length,...row});
    if (window.fixtureStorageEvent) void window.fixtureStorageEvent(rows.at(-1));
  };
  for (const [method,kind] of [['getItem','get'],['setItem','set'],['removeItem','remove']]) proto[method] = function(key,value) {
    if (this !== object) return native[kind].apply(this,arguments);
    key = String(key); const text = kind === 'set' ? String(value) : null;
    const result = native[kind].apply(this,arguments);
    emit({kind,key,bytes:kind === 'get' ? (result?.length || 0)*2 : (text?.length || 0)*2,
      chapterSave:kind === 'set' && key === 'mkty_field_finale_9_v1' && /chapter-space\.js/.test(new Error().stack || '')});
    return result;
  };
  window.__legacyNative = Object.freeze({object,rows,
    read:key => object.getItem(key),
    key:i => native.key.call(object,i),
    get length(){return object.length;},
    // Test-runner inspection does not feed admission/controller restoration.
    inspect:key => native.get.call(object,key),
    mutate(key,value){return value === null ? native.remove.call(object,key) : native.set.call(object,key,String(value));}
  });
})();
