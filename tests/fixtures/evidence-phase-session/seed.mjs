// One synthetic prerequisite seed; none of the five finale checkpoints is seeded.
export const sourceKey=n=>`mkty_field_finale_${n}_v1`;
export const storyKey=n=>`mkty_story_plan_${n}_v1`;
// Fixed synthetic prerequisites: the three legacy preparation rounds have
// already ended. Their original finale completion rewrite is exercised below.
export const preparedOperations=n=>JSON.stringify({version:1,n,seed:731,round:3,phase:'core',input:null,
  confirmed:false,actions:0,hints:0,errors:0,seconds:0});
export const preState=()=>({mkty_points:'100',mkty_global_lives:'9',mkty_life8:null,mkty_life9:null,
  mkty_life8_awarded:null,mkty_life9_awarded:null,mkty_life8_completed_at:null,mkty_life9_completed_at:null,
  mkty_spatial_report_8:null,mkty_spatial_report_9:null,mkty_final_moon_points:null,mkty_points_locked_at:null,
  mkty_pace_ack_8:null,mkty_pace_ack_9:null,mkty_life9_coordinates:null,
  mkty_operations_8_v1:preparedOperations(8),mkty_operations_9_v1:preparedOperations(9)});
export const backgroundKeys=['mkty_lang','mkty_control_sound','mkty_light_fx','mkty_expeditions_v1','mkty_daily_demo','mkty_pace_skip_9'];
export const targetKeys=[...Object.keys(preState()),...backgroundKeys,'mkty_current_chapter','mkty_legacy_v1','mkty_life7',
  'mkty_campaign_checkpoint_8','mkty_campaign_checkpoint_9','mkty_life_restore_at',
  ...Array.from({length:9},(_,i)=>storyKey(i+1)),sourceKey(8),sourceKey(9)];
export function createSeed({StoryPlan:P,FieldRules:R,ExpeditionRules:E},now=Date.now()){
  const plan=n=>({...P.fresh(n,9000+n,2),createdAt:1,phase:'core',done:[0,1,2,3,4,5,6,7],tasks:{}});
  const seed={mkty_lang:'en',mkty_control_sound:'no',mkty_light_fx:'yes',mkty_points:'100',mkty_global_lives:'9',mkty_life7:'complete',
    mkty_expeditions_v1:JSON.stringify(E.restore(null)),
    mkty_daily_demo:JSON.stringify({attempts:0,streak:0,solved:false,codes:[],cday:new Date(now).toISOString().slice(0,10)}),
    mkty_pace_skip_9:'yes', // Explicit synthetic prerequisite, not an earned skip.
    mkty_legacy_v1:JSON.stringify({version:1,lead:'navigator',airlock:'crew',echo:null,decodeNoise:null,
      events:{1:'antenna',3:'record',5:'keep',6:'tow',7:'rescue',9:'wait'}})};
  for(let n=1;n<=9;n++)seed[storyKey(n)]=JSON.stringify(plan(n));
  const full=plan(8);for(const task of P.plan(8,2).steps)full.tasks[task.id]={kind:task.kind,attempt:0,seconds:3,hints:0,errors:0};
  const proof=R.create(8,0,P.seedFor(full,0));proof.trace=[];
  const act=(action,value)=>{proof.trace.push(['act',action,value??null]);R.act(proof,action,value);};
  const layout=R.layout(proof);for(let i=0;i<3;i++){act('station',i);act('angle',Math.round(layout.bearings[i]));act('sample');}
  act('pin',layout.source);act('locate');full.tasks[0]={...full.tasks[0],proof,performance:R.performance(proof)};
  proof.trace=[...Array.from({length:900},()=>['act','station',0]),...proof.trace];
  const replay=R.create(8,0,proof.seed);for(const row of proof.trace)R.act(replay,row[1],row[2]);
  const text=JSON.stringify(full);
  if(proof.trace.length!==911||text.length*2!==38628||!R.won(replay)||!R.restore(proof,8,0,proof.seed)||
    full.tasks[0].performance.precise!==true)throw Error('Exact synthetic 911-row prerequisite differs');
  seed[storyKey(8)]=text;
  for(const n of [8,9])seed[`mkty_operations_${n}_v1`]=preparedOperations(n);
  for(const n of [8,9])seed[sourceKey(n)]=JSON.stringify({version:1,n,phase:0,seed:731,seconds:0});
  return seed;
}
