/* Rendering-only capability boundary. Never expose Horizons progression APIs. */
(function(root){'use strict';const source=root.MoonCore;
const api={};for(const key of ['WORLD','REGIONS','POINTS','FIELD','BARRIERS','resources','height','surfaceHeight','relief','obstacleAt'])api[key]=source[key];
Object.assign(api,{quest:()=>({targets:[]}),level:()=>0,scanRadius:()=>0,droneRadius:()=>0,discoveries:()=>[]});
for(const key of ['WORLD','REGIONS','POINTS','FIELD','BARRIERS','resources']){const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};freeze(api[key]);}
Object.defineProperty(root,'MoonCore',{value:Object.freeze(api),writable:false,configurable:false});
})(globalThis);
