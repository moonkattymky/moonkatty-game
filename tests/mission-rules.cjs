const assert=require('node:assert/strict'),R=require('../mission-rules.js');
let checked=0;
for(let seed=1;seed<=80;seed++)for(let n=4;n<=9;n++)for(let round=0;round<3;round++){
 const b=R.board(n,round,seed*99991),p=R.initial(b);
 assert(R.validate(b,p),`invalid initial board ${n}/${round}/${seed}`);
 assert(!R.solved(b,p),`already solved ${n}/${round}/${seed}`);
 if(n===4)p.path=b.path.slice();
 if(n===5)b.path.forEach(i=>p.turns[i]=0);
 if(n===6)p.tiles=b.target.slice();
 if(n===7){const moves=R.solveShield(b,p);assert(moves);for(const i of moves){R.toggle(p.lamps,i,b.n);p.history.push(i);}}
 if(n===8)p.history.push(b.secret.slice());
 if(n===9){const order=R.solveSystems(b,p);assert(order,`unsolvable systems ${round}/${seed}`);p.order=order;}
 assert(R.validate(b,p));assert(R.solved(b,p));checked++;
 assert(!R.validate(b,{}));
}
// An affordable first action can still create a dead end: undo must preserve recovery.
const b=R.board(9,0,1),p={order:[5]};assert(R.stock(b,p));assert.equal(R.solveSystems(b,p),null);p.order.pop();assert(R.solveSystems(b,p));
assert.deepEqual(R.feedback([0,1,2,3],[1,0,2,4]),{exact:1,near:2});
console.log(JSON.stringify({solvableBoards:checked,corruptInputsRejected:true,resourceDeadEndRecoverable:true}));
