#!/usr/bin/env node
/* Runs every tests/*.cjs (except helpers/fixtures) in isolated processes with a generous per-file
   timeout (long playthroughs such as story/worlds/operations take 5–12 min) and limited parallelism.
   Usage: node tests/run-all.cjs [--jobs=3] [--timeout=1500] [filter…] */
const {spawn}=require('child_process'),fs=require('fs'),path=require('path'),os=require('os');
const args=process.argv.slice(2),opt=k=>{const a=args.find(x=>x.startsWith('--'+k+'='));return a?Number(a.split('=')[1]):null;};
const jobs=opt('jobs')||Math.max(1,Math.min(3,os.cpus().length-1)),timeout=(opt('timeout')||1500)*1000,filters=args.filter(a=>!a.startsWith('--'));
const files=fs.readdirSync(__dirname).filter(f=>f.endsWith('.cjs')&&!/helper|fixture|pace-hook|run-all/.test(f)&&(!filters.length||filters.some(x=>f.includes(x)))).sort();
const results=[];let next=0;
function run(f){return new Promise(res=>{const t0=Date.now(),out=fs.mkdtempSync(path.join(os.tmpdir(),'mkty-'+f.replace('.cjs','')+'-'));let log='';
 const c=spawn(process.execPath,[path.join(__dirname,f)],{env:{...process.env,MKTY_TEST_OUTPUT:out},stdio:['ignore','pipe','pipe']});
 c.stdout.on('data',d=>log+=d);c.stderr.on('data',d=>log+=d);
 const timer=setTimeout(()=>{log+=`\n[run-all] timeout after ${timeout/1000}s`;c.kill('SIGKILL');},timeout);
 c.on('close',code=>{clearTimeout(timer);const r={f,ok:code===0,s:((Date.now()-t0)/1000).toFixed(0),out};results.push(r);console.log(`${r.ok?'PASS':'FAIL'} ${f} (${r.s}s)`);if(!r.ok)console.log(log.split('\n').slice(-25).join('\n'));res();});});}
(async()=>{await Promise.all(Array.from({length:jobs},async()=>{while(next<files.length)await run(files[next++]);}));
 const failed=results.filter(r=>!r.ok);console.log(`\n${results.length-failed.length}/${results.length} passed`);process.exit(failed.length?1:0);})();
