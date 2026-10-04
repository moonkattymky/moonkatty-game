// Legacy controller tests isolate the chapter finale; story.cjs covers the added operations.
// Init scripts run before app scripts, so no production test/bypass flag is required.
module.exports=function storyFinaleFixture(){
 for(let n=1;n<=9;n++){
  const key='mkty_story_plan_'+n+'_v1';if(localStorage.getItem(key))continue;
  localStorage.setItem(key,JSON.stringify({version:1,edition:1,n,seed:n,phase:'core',done:[0,1,2,3,4,5,6,7],tasks:{},coreSeconds:0,createdAt:Date.now()}));
 }
};
