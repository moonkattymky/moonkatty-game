/* Static expedition objects are solid meshes: no camera-facing planes or view switching. */
(function(root){'use strict';
const R=root.MoonRenderer.prototype,B=root.MoonOutpostBuilder,draw=root.MoonOutpostAssembly;
function solar(){const b=new B();
 // One mechanically connected assembly: feet, tripod, pivot, tilted panel.
 b.box('steel',0,.11,0,1.55,.22,1.40);b.box('panel',0,.25,0,1.10,.12,1.04);
 for(const side of[-1,1])for(const zz of[-.54,.54]){b.box('gold',side*.63,.21,zz,.24,.12,.29);b.tube('gold',[side*.59,.28,zz],[0,1.18,0],.050,16);b.box('dark',side*.64,.055,zz,.28,.10,.31);}
 b.tube('steel',[0,.28,0],[0,1.32,0],.14,24);b.tube('gold',[0,1.02,0],[0,1.12,0],.16,24);
 b.tube('gold',[-.55,1.34,0],[.55,1.34,0],.085,24);b.box('panel',0,.53,.47,.64,.51,.23);b.box('dark',0,.59,.594,.43,.21,.018);b.box('blue',0,.64,.609,.22,.031,.013);
 const panel=new B();panel.box('steel',0,0,0,3.04,.115,1.77);panel.box('solar',0,.066,0,2.91,.023,1.64);
 for(const side of[-1,1]){panel.box('gold',side*1.485,.05,0,.065,.11,1.79);panel.box('gold',0,.05,side*.867,2.98,.11,.057);}
 for(let i=0;i<10;i++)panel.box('steel',-1.42+i*.315,.083,0,.014,.007,1.60);
 for(let i=0;i<5;i++)panel.box('steel',0,.086,-.79+i*.394,2.88,.007,.012);
 panel.box('gold',0,.081,0,.042,.018,1.66);
 for(const side of[-1,1])for(let j=0;j<4;j++)panel.tube('steel',[side*1.48,.11,-.71+j*.47],[side*1.48,.125,-.71+j*.47],.022,8);
 const tilt=.62,co=Math.cos(tilt),si=Math.sin(tilt);
 for(const[mat,data]of panel.groups){let out=b.groups.get(mat);if(!out)b.groups.set(mat,out=[]);for(let i=0;i<data.length;i+=6){const x=data[i],y=data[i+1],z=data[i+2],nx=data[i+3],ny=data[i+4],nz=data[i+5];out.push(x,1.42+y*co-z*si,y*si+z*co,nx,ny*co-nz*si,ny*si+nz*co);}}
 for(const side of[-1,1])b.tube('gold',[side*.55,1.00,-.12],[side*.55,1.65,-.38],.035,12);
 return b;
}
function cell(){const b=new B();b.shell('steel',[[.95,0],[1,.09],[1,.85],[.92,.96],[0,.99]],.29,1.08);b.shell('panel',[[1.025,.13],[1.025,.75]],.29,1.08);for(let i=0;i<6;i++){const a=i*Math.PI/3,x=Math.sin(a)*.275,z=Math.cos(a)*.275;b.box('gold',x,.50,z,.06,.77,.05,a);b.box('blue',x*1.04,.61,z*1.04,.035,.31,.02,a);}for(const y of[.10,.85])b.shell('gold',[[1.04,y],[1.04,y+.055]],.29,1.08);b.tube('gold',[-.12,1.09,0],[.12,1.09,0],.026,12);return b;}
function antenna(){const b=new B();b.box('steel',0,.16,0,2.10,.32,1.70);b.box('panel',0,.64,0,1.44,.78,1.15);b.box('gold',0,1.03,0,1.48,.09,1.19);b.box('dark',0,.72,.583,.78,.35,.02);for(let j=0;j<3;j++)b.box('blue',-.24+j*.24,.74,.603,.10,.06,.02);for(const side of[-1,1])b.tube('steel',[side*.72,.18,0],[0,5.68,0],.07,16);b.tube('gold',[0,.95,0],[0,7.12,0],.095,20);for(let i=0;i<6;i++){const y=1.30+i*.79;b.tube('gold',[-.7+y*.075,y,0],[.7-y*.075,y,0],.035,12);}b.shell('ivory',[[0,6.44],[.32,6.50],[.70,6.56],[1,6.66]],1.16,1);b.shell('gold',[[1,6.66],[1,6.71]],1.16,1);b.tube('steel',[0,6.96,0],[.74,7.5,.42],.035,12);b.tube('blue',[.74,7.5,.42],[.74,7.6,.42],.075,16);b.box('solar',-1.14,.95,0,.72,.055,1.15);return b;}
R.solarArray=function(x,z,ch){this.ensureWorldModels();draw(this,'solid_solar',solar,x,this.terrain(x,z,ch),z);};
R.powerCell=function(x,z,ch){this.ensureWorldModels();draw(this,'solid_powercell',cell,x,this.terrain(x,z,ch),z);};
R.scienceAntenna=function(x,z,ch){this.ensureWorldModels();draw(this,'solid_antenna',antenna,x,this.terrain(x,z,ch),z);};
})(globalThis);
