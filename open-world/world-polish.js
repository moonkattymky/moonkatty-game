/* Silver dawn palette and detailed equipment assemblies, preserving world routes. */
(function(root){'use strict';
const R=root.MoonRenderer.prototype,oldModels=R.ensureWorldModels,oldLander=R.lander,oldPut=R.put;
const GOLD=[.84,.62,.30],IVORY=[.91,.915,.88],DARK=[.055,.09,.12],CYAN=[.035,.59,.83];
R.ensureWorldModels=function(){
 oldModels.call(this);if(this.silverDawnReady)return;this.silverDawnReady=true;
 // Cut the six corners into narrow optical bevels, keeping broad flat prism faces.
 const outline=[];
 for(let i=0;i<6;i++){const a=i*Math.PI/3,c=[Math.cos(a),Math.sin(a)];for(const side of[-1,1]){const b=a+side*Math.PI/3;outline.push([c[0]*.90+Math.cos(b)*.10,c[1]*.90+Math.sin(b)*.10]);}}
 for(let variant=0;variant<3;variant++){const vertices=[],profile=[[.72,-.50],[.98,-.36],[1,.22],[.94,.43],variant===2?[.75,.59]:[.54,.66],variant===2?[.51,.66]:variant===1?[.12,.84]:[0,.85]];
 const point=(j,i)=>{const [r,y]=profile[j],q=outline[i%12],offset=Math.max(0,y-.22);return[q[0]*r-offset*(.18+variant*.05),y+(variant===2&&j>=4?q[0]*r*.14:0),q[1]*r+offset*.09];};
 const tri=(a,b,c)=>{let n=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])],length=Math.hypot(...n);if(length<1e-8)return;n=n.map(q=>q/length);for(const p of[a,b,c])vertices.push(...p,...n);};
 for(let j=0;j<profile.length-1;j++)for(let i=0;i<12;i++){const a=point(j,i),b=point(j,i+1),c=point(j+1,i+1),d=point(j+1,i);tri(a,c,b);tri(a,d,c);}
 for(let i=0;i<12;i++)tri([0,-.50,0],point(0,i),point(0,i+1));
 if(variant)for(let i=0;i<12;i++)tri(point(5,0).map((v,k)=>k===1?profile[5][1]:k===0?-(profile[5][1]-.22)*(.18+variant*.05):(profile[5][1]-.22)*.09),point(5,i+1),point(5,i));this.addMesh(variant?'crystal'+variant:'crystal',vertices);}

 const glow=[];for(let i=0;i<40;i++){const a=i*Math.PI/20,b=(i+1)*Math.PI/20;for(const p of[[0,0,0],[Math.cos(b),0,Math.sin(b)],[Math.cos(a),0,Math.sin(a)]])glow.push(...p,0,1,0);}this.addMesh('mineralGlow',glow);
};
R.crystalDeposit=function(resource,ch,t){
 const x=resource.x,z=resource.z,y=this.terrain(x,z,ch),seed=Number(resource.id.slice(3)),yaw=seed*.71;
 this.put('geology1',x,y+.10,z,.66,.32,.54,[.37,.39,.405],yaw,4);
 this.put('mineralGlow',x,y+.025,z,1.04,1,.88,[.12,.40,1.0],0,22,.23);
 const shards=[[0,0,.235,1.20,0,0],[.30,.12,.16,.82,.15,-.26],[-.31,.05,.19,.96,-.12,.27],[.10,-.28,.145,.75,-.23,-.13],[-.17,.31,.14,.64,.25,.08],[.43,-.16,.065,.34,.34,-.41],[-.43,-.21,.075,.40,-.21,.47],[.18,.45,.06,.28,.40,.18],[.26,.30,.05,.24,.5,-.2],[-.24,-.36,.05,.22,-.4,.3],[.52,.08,.045,.20,.2,-.6],[-.50,.14,.05,.26,-.3,.55]];
 for(let i=0;i<shards.length;i++){const [dx,dz,width,height,pitch,roll]=shards[i],c=Math.cos(yaw),s=Math.sin(yaw),xx=x+c*dx+s*dz,zz=z-s*dx+c*dz,yy=this.terrain(xx,zz,ch)+height*.48;
  this.put(i%3?'crystal'+(i%3):'crystal',xx,yy,zz,width,height,width*(.78+(i%3)*.10),[.08+.015*(i%3),.30+.025*(i%2),.95+.02*(i%3)],yaw+i*.83,13,.16+Math.sin(t*.8+seed)*.012,pitch,roll);
 }
};
R.put=function(shape,x,y,z,sx,sy,sz,color,yaw=0,kind=0,glow=0,pitch=0,roll=0){
 if(shape==='cube'&&sx===3&&sy===.09&&sz===1.7)kind=15;
 return oldPut.call(this,shape,x,y,z,sx,sy,sz,color,yaw,kind,glow,pitch,roll);
};
R.lander=function(x,z,ch){
 oldLander.call(this,x,z,ch);const y=this.terrain(x,z,ch),put=this.put.bind(this);
 // Two narrow collars follow the elliptical pressure hull rather than covering it.
 put('torus',x,y+1.11,z,1.028,.50,.945,GOLD);
 put('torus',x,y+2.02,z,1.13,.42,1.04,GOLD);
 for(let i=0;i<4;i++){
  const a=Math.PI*.25+i*Math.PI*.5,dx=Math.sin(a),dz=Math.cos(a);
  put('round',x+dx*1.08,y+1.60,z+dz*.99,.035,.36,.023,GOLD,a);
  put('smooth',x+dx*1.56,y+.33,z+dz*1.56,.055,.045,.055,CYAN,0,12,.45);
  put('round',x+dx*1.55,y+.20,z+dz*1.55,.19,.036,.12,DARK,a);
 }
 put('round',x,y+2.66,z+1.107,.21,.012,.008,GOLD);
 put('round',x,y+2.40,z+1.13,.24,.014,.010,IVORY);
 put('smooth',x,y+3.76,z+.405,.047,.025,.022,CYAN,0,12,.38);
};
})(globalThis);
