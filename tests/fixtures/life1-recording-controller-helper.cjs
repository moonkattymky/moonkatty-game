'use strict';
// Socket-free test integration of instrumented original controller statements.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../..'),fixturePath=path.join(__dirname,'life1-recording-source-controller.cjs');
const M=require('../../prototypes/life1-capture/pr47/life1-model.js');
const DEFAULT_CONTEXT=Object.freeze({life1_profile:M.NATIVE_PROFILE,route:'00000000-0000-4000-8000-000000000571',life:1,edition:2,challenge_version:2,seed:571});
let source=fs.readFileSync(fixturePath,'utf8');
const replace=(a,b)=>{if(source.split(a).length!==2)throw Error('Fixture seam '+a);source=source.replace(a,b);};
source="const {instrument}=require('./life1-recording-instrument.cjs');const Recorder=require('../../prototypes/life1-capture/prototype/chapter1-recorder.cjs');\n"+source;
replace('function createController({width = 362, height = 360, random = () => .5} = {}) {','function createController({width = 402, height = 402, random = () => .5, storageSeed={}, recordingContext, limits} = {}) {');
replace("const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');","const source = instrument(fs.readFileSync(path.join(root, 'app.js'), 'utf8'),'app.js');");
replace("const experience = fs.readFileSync(path.join(root, 'experience.js'), 'utf8');","const experience = instrument(fs.readFileSync(path.join(root, 'experience.js'), 'utf8'),'experience.js');");
replace('const timers = new Map(), frames = new Map(), storage = new Map();','const timers = new Map(), frames = new Map(), storage = new Map(Object.entries(storageSeed)), saveControl={refuse:false};');
replace('setItem: (key, value) => storage.set(key, String(value))','setItem: (key, value) => {if(saveControl.refuse&&key===\'mkty_test_life1_recording_v1\')throw Error(\'fixture quota\');return storage.set(key, String(value));}');
replace('  run("show(\'mission1\'); resetLife1Mission();");',`
  context.LocalLife1Recorder=Recorder;context.TextEncoder=TextEncoder;
  run(fs.readFileSync(path.join(root,'prototypes/life1-capture/controller-adapter.js'),'utf8'));
  if(!storage.has('mkty_test_life1_recording_v1'))context.__C1Capture.armFresh(recordingContext,limits);
  run("show('mission1'); resetLife1Mission();");
  const campaign=instrument(fs.readFileSync(path.join(root,'campaign.js'),'utf8'),'campaign.js');
  const start=campaign.indexOf(" const key=n=>'mkty_campaign_checkpoint_'+n;"),end=campaign.indexOf(' function needsCode(){',start);
  if(start<0||end<0)throw Error('Campaign seam');
  run('window.MKTYCampaign=(()=>{'+campaign.slice(start,end)+'current=1;return {save,restore,onScreen(){}};})();');
  if(storage.has('mkty_campaign_checkpoint_1'))run('MKTYCampaign.restore(1);');
`);
replace('    snapshot,\n    setClock(timestamp)','    snapshot, capture:()=>context.__C1Capture, storage:()=>Object.fromEntries(storage), save:()=>run(\'MKTYCampaign.save();\'), refuseStorage:value=>{saveControl.refuse=value;}, dualFrame(frameTime,dispatchTime,x,y){time(dispatchTime);context.fixtureNow=frameTime;context.fixtureX=x;context.fixtureY=y;run(\'l1MoveX=fixtureX;l1MoveY=fixtureY;life1MoveLoop(fixtureNow);\');return snapshot();},\n    setClock(timestamp)');
const compiled=new Module(fixturePath,module);compiled.filename=fixturePath;compiled.paths=Module._nodeModulePaths(__dirname);compiled._compile(source,fixturePath);
function create(options={}){const context=options.context||DEFAULT_CONTEXT;return compiled.exports.createController({...options,recordingContext:context,random:M.random(M.challengeSeed(context))});}
module.exports={create,DEFAULT_CONTEXT};
