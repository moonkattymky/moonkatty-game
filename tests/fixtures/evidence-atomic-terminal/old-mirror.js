// TEST ONLY: unchanged storage.js overlay is allowed to flush stale native keys
// in a second disposable realm. It has no access to the canonical owner cache.
(() => {
  const original=Storage.prototype.setItem;
  let deny=false;
  Storage.prototype.setItem=function(key,value){if(deny)throw new DOMException('Disposable mirror fault','QuotaExceededError');return original.call(this,key,value);};
  window.oldMirror={
    stage(){deny=true;localStorage.setItem('mkty_points','77777');localStorage.setItem('mkty_story_plan_9_v1','stale overlay');return this.facts();},
    flush(){deny=false;const retried=MKTYStorage.retry();return {retried,...this.facts()};},
    facts(){return {persistent:MKTYStorage.persistent,logical:localStorage.getItem('mkty_points'),native:oldNativeStorage.getItem('mkty_points'),queue:oldNativeStorage.getItem('mkty_pending_v2_unrelated')};}
  };
  window.oldMirrorReady=true;
})();
