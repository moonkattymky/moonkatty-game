// SOURCE ONLY. Bounded observation of legacy.js precise(), not proof of past play.
import * as C from './contract.mjs';
import {measureFinaleData} from './finale-context-v1.mjs';
import {requirePhaseBudget} from './phase-budget.mjs';
export function observePrecision({readItem,budget,current}){
  requirePhaseBudget(budget);
  if(typeof readItem!=='function'||typeof current!=='function'||
    budget.snapshot().reservations['original-read-workspace']!==196608)C.fail('precision-workspace');
  const parse=JSON.parse;
  let count=0,total=0,text=null,plan=null,tasks=null;
  try{
    for(let n=1;n<=8;n++){
      if(!current())C.fail('precision-stale');budget.allocate('original-read-workspace',196608);
      text=readItem(`mkty_story_plan_${n}_v1`);
      if(text!==null&&(typeof text!=='string'||text.length*2>65536))C.fail('precision-limit');
      // The fixed supported fixture requires valid bounded source. Unlike the
      // original display helper, this admission refuses unreadable input.
      try{plan=parse(text);}catch{C.fail('precision-source');}
      measureFinaleData([plan],65536,{nodes:16384});text=null;
      tasks=plan?.tasks||{};
      if(!tasks||typeof tasks!=='object'||Array.isArray(tasks)||Object.keys(tasks).length>8)C.fail('precision-tasks');
      for(const task of Object.values(tasks))if(task?.performance){total++;if(task.performance.precise===true)count++;}
      tasks=null;plan=null;if(!current())C.fail('precision-stale');
    }
    return Object.freeze({count,total});
  }finally{text=null;plan=null;tasks=null;}
}
