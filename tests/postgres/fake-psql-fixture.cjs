/* Pipe-only driver fixture. This is not SQL and cannot create a database/socket. */
const readline=require('node:readline');
let stop=true,state='00000',message='',hung=false,chunked=false;
readline.createInterface({input:process.stdin}).on('line',line=>{
 if(hung)return;
 if(line==='\\set ON_ERROR_STOP off')stop=false;
 else if(line==='\\set ON_ERROR_STOP on')stop=true;
 else if(line==='HANG;')hung=true;
 else if(line==='EXIT;')process.exit(2);
 else if(line==='FAIL;'){
  state='P0001';message='weekly';
  if(stop){process.stderr.write('synthetic SQL failure\n');process.exit(3);}
 }else if(line==='SUCCESS;'||line==='CHUNKED;'){
  state='00000';chunked=line==='CHUNKED;';process.stdout.write('{"ok":true}\n');
 }else if(line.startsWith('\\echo ')){
  const output=`${line.split(' ')[1]} ${state} ${message}\n`;
  if(chunked){process.stdout.write(output.slice(0,11));setTimeout(()=>process.stdout.write(output.slice(11)),10);chunked=false;}
  else process.stdout.write(output);
 }
});
