// TEST ONLY. Errors and readiness stay explicit even when bootstrap is blocked.
import('./fixture.mjs').then(({bootSharedFixture})=>bootSharedFixture()).catch(error=>{
  window.sharedBootstrapError=String(error.stack||error);
  document.getElementById('sharedStatus').textContent='Recovery blocked: '+String(error.message||error);
  window.sharedFixtureReady=true;
});
