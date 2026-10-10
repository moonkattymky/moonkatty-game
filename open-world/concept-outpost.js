/* White-gold Moonkatty outpost, authored from the approved visual reference. */
(function(root){'use strict';const R=root.MoonRenderer.prototype,B=root.MoonOutpostBuilder,C=root.MoonOutpostColors,draw=root.MoonOutpostAssembly,TAU=Math.PI*2;
C.ivory=[.88,.89,.87];C.bright=[.96,.955,.925];C.gold=[.92,.63,.25];C.glass=[.025,.13,.19];C.solar=[.035,.10,.20];C.panel=[.94,.95,.94];C.enamel=[.96,.97,.945];
// Rounded pressure-vessel trim, with curved corners and chamfered front lips.
function roundedPoints(w,h,r){const out=[];for(const [cx,cy,angle]of[[w/2-r,h/2-r,0],[-w/2+r,h/2-r,Math.PI/2],[-w/2+r,-h/2+r,Math.PI],[w/2-r,-h/2+r,Math.PI*1.5]])for(let j=0;j<8;j++){const a=angle+j*Math.PI/14;out.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}return out;}
function roundPanel(b,mat,x,y,z,w,h,d,r=.18){const outline=roundedPoints(w,h,Math.min(r,w/2,h/2)),front=outline.map(([u,v])=>[x+u,y+v,z+d/2]),back=outline.map(([u,v])=>[x+u,y+v,z-d/2]);for(let i=0;i<outline.length;i++){let j=(i+1)%outline.length;b.tri(mat,[x,y,z+d/2],front[i],front[j],[0,0,1]);b.tri(mat,[x,y,z-d/2],back[j],back[i],[0,0,-1]);b.quad(mat,back[i],back[j],front[j],front[i]);}}
function windowFrame(b,x,y,z,w,h){const outer=roundedPoints(w,h,.19),inner=roundedPoints(w-.13,h-.13,.15);for(let i=0;i<outer.length;i++){const j=(i+1)%outer.length,p=(v,zz)=>[x+v[0],y+v[1],z+zz];b.quad('gold',p(outer[i],.06),p(outer[j],.06),p(inner[j],.074),p(inner[i],.074),[0,0,1]);b.quad('steel',p(inner[i],-.10),p(inner[j],-.10),p(inner[j],.074),p(inner[i],.074));}roundPanel(b,'dark',x,y,z-.12,w-.12,h-.12,.025,.14);}
function bolts(b,x,y,z,w,h,n=4){for(const side of[-1,1])for(let j=0;j<n;j++)b.tube('steel',[x+side*w/2,y-h/2+j*h/(n-1),z],[x+side*w/2,y-h/2+j*h/(n-1),z+.014],.024,8);}
function station(ch){const b=new B(),r=ch===1?3.25:2.45,h=ch===1?5.20:4.70,z=r+.27,cy=1.86,rx=ch===1?1.45:1.28;
 b.shell('steel',[[1,0],[1,.055]],r,h,true);b.shell('panel',[[1,.055],[1,.78]],r,h,true);b.shell('ivory',[[1,.78],[.99,.84],[.95,.92],[.86,.99],[.63,1.045],[0,1.075]],r,h);b.shell('gold',[[1.009,.78],[1.009,.801]],r,h);b.shell('gold',[[1.003,.045],[1.003,.067]],r,h);
 // Large recessed airlock, lit inward-facing ribs and warm service corridor.
 for(let i=0;i<5;i++){const zz=z-i*.27;b.ring(i===0?'ivory':'steel',0,cy,zz,rx,1.76,.13,.17,8);b.ring('gold',0,cy,zz+.10,rx*.905,1.58,.057,.045,8);b.ring('amber',0,cy,zz+.13,rx*.835,1.48,.023,.027,8);}
 b.box('dark',0,cy,z-1.42,rx*1.51,2.81,.08);b.box('steel',0,.20,z-.58,rx*1.55,.14,1.44);b.box('ivory',0,3.36,z-.58,rx*1.56,.10,1.44);
 for(const side of[-1,1]){b.box('ivory',side*rx*.68,cy,z-1.37,.31,2.38,.08);b.box('amber',side*rx*.81,cy,z-.6,.033,2.34,.97);b.box('steel',side*rx*.62,.76,z-1.30,.29,.20,.12);b.box('blue',side*rx*.62,1.02,z-1.23,.18,.20,.025);}
 // Open tunnel: a rear interior image is placed separately with UV coordinates.
 for(const side of[-1,1]){b.box('gold',side*.80,1.74,z-.77,.035,2.52,.88);b.box('amber',side*.84,3.10,z-.75,.042,.036,.98);}
 for(let i=0;i<5;i++){b.box('amber',0,3.24,z-.1-i*.23,1.85,.030,.041);b.box('steel',0,.33,z-.1-i*.23,2.05,.020,.038);}

 // Broad curved facade: a glowing paw, dark lettering and chamfered access trims.
 roundPanel(b,'enamel',0,4.17,r+.06,rx*2.23,1.32,.29,.24);bolts(b,0,4.17,r+.23,rx*1.94,1.04,4);b.box('gold',0,4.84,r+.05,rx*2.05,.075,.32);b.paw(0,4.41,r+.230,1.40,'amber');b.paw(0,4.41,r+.251,1.25,'gold');b.text('MOONKATTY',0,3.78,r+.228,.215,'dark');b.box('amber',0,3.59,r+.24,1.64,.041,.030);
 for(const side of[-1,1]){b.box('gold',side*(rx+.15),1.94,z-.12,.15,1.25,.20);b.box('amber',side*(rx+.15),1.94,z+.005,.06,1.06,.037);bolts(b,side*(rx+.15),1.94,z+.04,.082,1.12,5);}
 // Tread plates, brass nosings and slim handrails keep the entrance readable.
 for(let j=0;j<6;j++){const zz=z+.17+j*.17,yy=.28-j*.042;b.box('steel',0,yy,zz,rx*1.93,.085,.22);b.box('gold',0,yy+.049,zz+.081,rx*1.93,.027,.031);for(let k=0;k<11;k++)b.box('dark',(k-5)*rx*.154,yy+.051,zz,.064,.013,.10);}
 for(const side of[-1,1]){for(let j=0;j<3;j++)b.tube('gold',[side*rx,.09,z+.15+j*.31],[side*rx,.75-j*.12,z+.15+j*.31],.035,12);b.tube('gold',[side*rx,.84,z-.14],[side*rx,.48,z+1.02],.043,16);}
 // Side windows have layered frames, mullions, inset blue glass and visible warm interior bars.
 for(let i=0;i<12;i++){const angle=(i+.5)*TAU/12,co=Math.cos(angle),si=Math.sin(angle);if(co>.72)continue;const rr=r*1.008;
  for(const yy of[.45,2.64,4.07])b.box('steel',si*rr,yy,co*rr,.024,.024,.056,angle);
  b.box('gold',si*(rr+.02),2.85,co*(rr+.02),1.12,.74,.14,angle);b.box('dark',si*(rr+.10),2.85,co*(rr+.10),1.01,.63,.036,angle);
  b.box('steel',si*(rr+.148),2.86,co*(rr+.148),.027,.56,.023,angle);b.box('amber',si*(rr+.155),2.62,co*(rr+.155),.78,.022,.019,angle);
  b.box('panel',si*rr,1.23,co*rr,.91,1.46,.035,angle);b.box('gold',si*(rr+.025),.57,co*(rr+.025),.72,.036,.029,angle);b.box('steel',si*(rr+.041),1.31,co*(rr+.041),.29,.41,.027,angle);
 }
 // Window bays and layered pressure skins flank the airlock.
 for(const side of[-1,1]){const xx=side*(rx+.60),zz=r-.54;roundPanel(b,'panel',xx,2.16,zz,.99,2.94,.35,.20);windowFrame(b,xx,2.72,zz+.20,.99,.93);roundPanel(b,'gold',xx,1.04,zz+.23,.56,.15,.037,.06);roundPanel(b,'steel',xx,1.58,zz+.235,.40,.50,.025,.08);bolts(b,xx,2.16,zz+.21,.83,2.65,6);}
 // Layered upper command pod: a real curved shell raised above the lower entrance.
 const upper=new B();upper.shell('panel',[[1,0],[1,.57],[.96,.77],[.79,.96],[.45,1.08],[0,1.13]],r*.61,1.18);upper.shell('gold',[[1.017,.03],[1.017,.09]],r*.61,1.18);upper.shell('gold',[[.985,.67],[.985,.73]],r*.61,1.18);append(b,upper,0,h*.89,-.56);
 for(let i=0;i<8;i++){const a=i*TAU/8;const rr=r*.61+.07,xx=Math.sin(a)*rr,zz=-.56+Math.cos(a)*rr;b.box('gold',xx,h*.89+.56,zz,.88,.58,.075,a);b.box('dark',xx+Math.sin(a)*.052,h*.89+.56,zz+Math.cos(a)*.052,.78,.48,.019,a);b.box('gold',xx+Math.sin(a)*.074,h*.89+.56,zz+Math.cos(a)*.074,.027,.48,.015,a);}
 // Fine roof panel seams and white-gold atmosphere towers.
 for(let i=0;i<20;i++){const a=i*TAU/20;for(let j=0;j<4;j++){const rr=r*(.87-j*.115);b.box('steel',Math.sin(a)*rr,h*(.92+j*.031)+.13,Math.cos(a)*rr,.016,.021,r*.12,a);}}
 for(let i=0;i<3;i++){const x=(i-1)*.59,zz=-r*.50,base=h*.96,top=base+1.0+i*.28;b.tube('ivory',[x,base,zz],[x,top,zz],.135,24);for(const yy of[base+.11,top-.20])b.tube('gold',[x,yy,zz],[x,yy+.065,zz],.156,24);b.tube('steel',[x,top,zz],[x,top+.06,zz],.165,24);b.tube('blue',[x,top+.065,zz],[x,top+.09,zz],.121,24);b.tube('gold',[x,top+.07,zz],[x,top+.41,zz],.025,10);}
 for(let i=0;i<2;i++){const xx=-r-.72-i*2.05,yy=3.05+i*.72,zz=-.94;b.tube('ivory',[xx,.18,zz],[xx,yy,zz],.054,16);b.tube('gold',[xx,yy-.5,zz],[xx,yy,zz],.058,16);append(b,solarPanel(),xx,yy,zz,.10,1.12);}
 // Bolted pressure pods follow the existing footprint outside the cabin.
 for(const side of[-1,1]){const x=side*(r+.57),zz=-.60;b.tube('ivory',[x,.80,zz-.72],[x,.80,zz+.72],.61,32);for(let j=0;j<5;j++)b.tube('gold',[x,.80,zz-.70+j*.34],[x,.80,zz-.661+j*.34],.635,32);b.box('steel',x,.80,zz+.755,.63,.46,.035);b.box('glass',x,.88,zz+.784,.40,.21,.018);b.paw(x,.52,zz+.785,.49,'gold');b.box('steel',x,.13,zz,1.35,.17,1.75);}
 return b;
}
function append(dst,source,x,y,z,yaw=0,pitch=0){const m=root.MoonRenderMath.model(x,y,z,1,1,1,yaw,pitch),transform=(v,normal)=>[m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+(normal?0:m[12]),m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+(normal?0:m[13]),m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+(normal?0:m[14])];for(const[mat,data]of source.groups){let g=dst.groups.get(mat);if(!g)dst.groups.set(mat,g=[]);for(let i=0;i<data.length;i+=6)g.push(...transform(data.slice(i,i+3),false),...transform(data.slice(i+3,i+6),true));}}
function solarPanel(){const b=new B();b.box('steel',0,0,0,2.10,.075,1.30);b.box('solar',0,.046,0,1.95,.015,1.17);for(const side of[-1,1]){b.box('gold',side*1.03,.03,0,.048,.055,1.28);b.box('gold',0,.03,side*.635,2.08,.055,.045);}return b;}
function rover(){const b=new B();b.box('steel',0,.51,0,1.54,.20,2.05);roundPanel(b,'ivory',0,.93,-.16,1.30,.73,1.66,.15);b.box('gold',0,1.33,-.16,1.32,.065,1.67);windowFrame(b,0,1.08,.70,1.00,.48);roundPanel(b,'glass',0,1.08,.777,.85,.35,.012,.09);b.box('gold',0,1.08,.798,.027,.34,.015);b.box('gold',0,.81,.72,1.07,.050,.055);for(let i=0;i<8;i++)b.box('steel',-.34+i*.096,.73,1.087,.027,.086,.016);for(const side of[-1,1]){b.box('steel',side*.73,.61,.80,.09,.08,.35);for(let j=0;j<4;j++)b.tube('gold',[side*.671,.88+j*.09,-.38],[side*.692,.88+j*.09,-.38],.017,8);}for(const side of[-1,1]){b.box('glass',side*.662,1.10,.09,.023,.37,.64);b.box('gold',side*.682,1.32,-.16,.047,.051,1.59);b.box('ivory',side*.61,.72,.91,.26,.26,.32);b.box('amber',side*.50,.81,1.091,.12,.095,.027);b.tube('steel',[side*.55,.53,-.95],[side*.55,.53,.95],.055,16);for(let j=0;j<3;j++){const zz=-.77+j*.78;b.tube('dark',[side*.69,.38,zz],[side*.90,.38,zz],.31,24);b.tube('gold',[side*.905,.38,zz],[side*.922,.38,zz],.19,24);b.tube('steel',[side*.92,.38,zz],[side*.936,.38,zz],.08,16);for(let k=0;k<18;k++){const a=k*TAU/18;b.box('steel',side*.80,.38+Math.sin(a)*.303,zz+Math.cos(a)*.303,.22,.045,.063);}}}
 b.box('ivory',0,1.41,-.26,.69,.12,.81);b.paw(0,.91,-1.01,.57,'gold');b.tube('gold',[.48,1.30,-.65],[.48,2.11,-.65],.019,12);b.tube('blue',[.48,2.10,-.65],[.48,2.17,-.65],.043,16);for(const side of[-1,1]){roundPanel(b,'panel',side*.34,1.56,-.62,.59,.34,.63,.07);b.box('gold',side*.34,1.72,-.62,.58,.032,.64);}for(const vertices of b.groups.values())for(let i=0;i<vertices.length;i+=6){vertices[i]*=1.10;vertices[i+1]*=1.10;vertices[i+2]*=1.10;}return b;}
function rocket(){const b=new B(),h=8.7,r=1.05;b.tube('steel',[0,.005,0],[0,.13,0],3.45,64);b.tube('ivory',[0,.13,0],[0,.17,0],3.30,64);for(let i=0;i<32;i++){const a=i*TAU/32;b.tube('gold',[Math.sin(a)*3.32,.145,Math.cos(a)*3.32],[Math.sin(a+.045)*3.32,.145,Math.cos(a+.045)*3.32],.027,8);}for(let i=0;i<8;i++){const a=i*TAU/8;b.tube('blue',[Math.sin(a)*3.25,.185,Math.cos(a)*3.25],[Math.sin(a)*3.25,.215,Math.cos(a)*3.25],.054,12);}
 b.shell('panel',[[.55,.12],[.92,.20],[1,.28],[1,.73],[.96,.80],[.82,.89],[.60,.98],[.29,1.06],[0,1.105]],r,h);
 for(const yy of[2.52,3.65,6.20])b.shell('gold',[[1.012,yy/h],[1.012,(yy+.053)/h]],r,h);
 b.shell('gold',[[.60,.98],[.29,1.06],[0,1.105]],r,h);b.shell('steel',[[.54,.045],[.55,.14]],r,h);b.shell('gold',[[.57,.06],[.57,.089]],r,h);
 // Rounded black crew window with gold surround on the front face.
 windowFrame(b,0,7.15,1.08,.73,1.51);roundPanel(b,'glass',0,7.15,1.155,.59,1.34,.020,.19);b.box('steel',0,7.15,1.174,.032,1.33,.011);b.paw(0,5.07,1.059,1.25,'gold');
 for(let i=0;i<14;i++){const a=i*TAU/14,x=Math.sin(a)*r,z=Math.cos(a)*r;b.tube('steel',[x,2.81,z],[x,6.18,z],.010,8);for(const yy of[2.75,3.82,6.05])b.tube('gold',[x*1.016,yy,z*1.016],[x*1.026,yy,z*1.026],.025,6);}
 for(const side of[-1,1]){b.box('gold',side*.68,3.05,.81,.18,1.65,.17);b.box('dark',side*.68,3.05,.927,.11,1.42,.03);b.box('blue',side*.68,3.30,.953,.048,.75,.018);b.tube('gold',[side*.70,1.86,.55],[side*.70,6.54,.55],.035,12);}
 // Four real articulated landing legs, feet, compression rods and short stabilising fins.
 for(let i=0;i<4;i++){const a=Math.PI/4+i*TAU/4,dx=Math.sin(a),dz=Math.cos(a),inner=[dx*.91,2.82,dz*.91],foot=[dx*2.05,.23,dz*2.05];b.tube('ivory',inner,foot,.11,20,.095);b.tube('steel',[dx*.90,1.91,dz*.90],[dx*1.77,.45,dz*1.77],.055,16);b.tube('gold',[dx*1.33,1.85,dz*1.33],[dx*1.77,.77,dz*1.77],.12,20);b.box('steel',...foot,.48,.17,.41,a);b.box('gold',foot[0],foot[1]+.102,foot[2],.44,.038,.37,a);b.box('ivory',dx*.95,2.29,dz*.95,.13,1.30,.43,a);}
 b.tube('dark',[0,.39,0],[0,1.31,0],.36,32,.24);b.tube('gold',[0,.36,0],[0,.48,0],.37,32);for(const vertices of b.groups.values())for(let i=0;i<vertices.length;i+=6){vertices[i+1]*=.78;const nx=vertices[i+3],ny=vertices[i+4]/.78,nz=vertices[i+5],length=Math.hypot(nx,ny,nz)||1;vertices[i+3]=nx/length;vertices[i+4]=ny/length;vertices[i+5]=nz/length;}return b;
}
function cargo(){const b=new B();b.box('steel',0,.12,0,1.03,.20,.81);b.box('panel',0,.46,0,.97,.64,.78);b.box('gold',0,.80,0,.99,.058,.79);for(const side of[-1,1]){b.box('gold',side*.34,.47,.411,.093,.59,.043);b.box('gold',side*.34,.47,-.411,.093,.59,.043);}b.box('dark',0,.47,.417,.31,.20,.018);b.box('blue',0,.49,.434,.18,.082,.013);b.paw(0,.58,-.416,.34,'gold');for(const side of[-1,1])for(const z of[-.35,.35]){b.box('gold',side*.44,.48,z,.082,.49,.078);b.tube('steel',[side*.45,.59,z+.04],[side*.45,.59,z+.059],.027,10);}b.tube('steel',[-.17,.84,0],[.17,.84,0],.022,12);return b;}
function companion(){const b=new B();
 b.shell('enamel',[[0,0],[.66,.05],[.90,.19],[1,.45],[.96,.71],[.74,.94],[0,1.02]],.39,.61);
 // Pressure seals, a raised visor frame and four recessed fastening screws.
 b.shell('gold',[[.902,.18],[.943,.23]],.39,.61);b.shell('steel',[[.971,.68],[.954,.71]],.39,.61);
 windowFrame(b,0,.48,.39,.56,.34);roundPanel(b,'dark',0,.48,.46,.45,.25,.017,.09);
 for(const side of[-1,1]){
  b.tube('blue',[side*.105,.48,.479],[side*.105,.54,.479],.035,16);
  for(const yy of[.365,.60]){b.tube('steel',[side*.24,yy,.475],[side*.24,yy,.489],.014,10);b.box('dark',side*.24,yy,.491,.019,.005,.002);}
  // Detailed side propulsion pods have metal collars, an inset turbine and six vanes.
  b.tube('ivory',[side*.31,.42,-.02],[side*.40,.42,-.02],.14,32);
  b.tube('gold',[side*.385,.42,-.02],[side*.425,.42,-.02],.145,32);
  b.tube('steel',[side*.427,.42,-.02],[side*.436,.42,-.02],.112,24);
  b.tube('dark',[side*.438,.42,-.02],[side*.443,.42,-.02],.082,24);
  for(let i=0;i<6;i++){const a=i*TAU/6;b.tube('gold',[side*.449,.42+Math.cos(a)*.034,-.02+Math.sin(a)*.034],[side*.449,.42+Math.cos(a)*.074,-.02+Math.sin(a)*.074],.008,8);}
  b.tube('blue',[side*.449,.42,-.02],[side*.455,.42,-.02],.027,20);
  b.tube('gold',[side*.22,.78,0],[side*.29,.99,.0],.11,3,0);
  b.box('gold',side*.27,.57,-.25,.05,.24,.07);b.box('steel',side*.27,.57,-.29,.024,.17,.014);
  for(let i=0;i<5;i++)b.box('steel',side*.13,.40+i*.03,-.375,.11,.01,.02);
 }
 // Service panel, engraved paw and downward thruster finish the rear and underside.
 roundPanel(b,'panel',0,.61,-.337,.22,.20,.028,.025);b.paw(0,.615,-.357,.20,'gold');
 b.tube('steel',[0,.17,0],[0,.035,0],.095,24,.07);b.tube('gold',[0,.055,0],[0,.015,0],.092,24);b.tube('blue',[0,.012,0],[0,.001,0],.052,20);
 b.tube('gold',[0,.77,-.13],[0,1.0,-.13],.012,10);b.tube('blue',[0,1.,-.13],[0,1.04,-.13],.025,14);return b;
}
R.companion=function(x,y,z,p){this.ensureWorldModels();draw(this,'concept_companion',companion,x,y-.45,z,undefined,(p.yaw||0)+Math.PI);};
R.supplyContainer=function(x,z,ch){this.ensureWorldModels();draw(this,'concept_cargo',cargo,x,this.terrain(x,z,ch),z);};
R.habitat=function(x,z,ch){this.ensureWorldModels();const ground=this.terrain(x,z,ch),r=ch===1?3.25:2.45,rx=ch===1?1.45:1.28;draw(this,'concept_habitat_'+ch,()=>station(ch),x,ground,z);
 // Local unit quads supply unambiguous interior UVs and take part in normal depth testing.
 this.put('cube',x,ground+1.87,z+r-1.10,rx*1.49,2.76,.016,[1,1,1],0,25);
 for(const side of[-1,1])this.put('cube',x+side*(rx+.60),ground+2.72,z+r-.265,.84,.78,.012,[1,1,1],0,24);
 for(let i=0;i<12;i++){const angle=(i+.5)*TAU/12;if(Math.cos(angle)>.72)continue;this.put('cube',x+Math.sin(angle)*(r*1.008+.145),ground+2.85,z+Math.cos(angle)*(r*1.008+.145),.96,.56,.012,[1,1,1],angle,24);}
for(let i=0;i<8;i++){const a=i*TAU/8,rr=r*.61+.135;this.put('cube',x+Math.sin(a)*rr,ground+(ch===1?5.20:4.70)*.89+.56,z-.56+Math.cos(a)*rr,.75,.45,.012,[1,1,1],a,24);}
};
R.expeditionProps=function(ch){this.ensureWorldModels();const x=4,z=4;draw(this,'concept_rover',rover,x,this.terrain(x,z,ch),z);};
R.lander=function(x,z,ch){this.ensureWorldModels();draw(this,'concept_rocket',rocket,x,this.terrain(x,z,ch),z);};
// A small stack of matching cargo is decorative and sits in existing blocked ship/station areas.
const previousScene=R.scene;R.scene=function(state,...args){const out=previousScene.call(this,state,...args),ch=state.chapter,points=ch===1?[[7.9,-7.8],[8.2,-7.1],[8.0,-7.5]]:[[7.3,-7.8],[7.4,-7.3]];for(let i=0;i<points.length;i++){const[x,z]=points[i];draw(this,'concept_cargo',cargo,x,this.terrain(x,z,ch)+(i===2?.86:0),z);}return out;};
// Higher cabins and spacecraft retain their original horizontal navigation footprints.
const oldBlocked=R.blocked;R.blocked=function(x,z,state,alt=0){const ch=state.chapter,sx=-5,sz=-2;if(alt<7.9&&Math.hypot(x-sx,z-sz)<1.5)return true;const sites=ch===1?[[4,-5,3.25]]:[[4,-5,2.45],...(state.buildings.includes('habitat')?[[-5,-7,2.45]]:[])];for(const[hx,hz,r]of sites)if(alt<6.5&&Math.hypot(x-hx,z-hz)<r+.22)return true;return oldBlocked.call(this,x,z,state,alt);};
})(globalThis);
