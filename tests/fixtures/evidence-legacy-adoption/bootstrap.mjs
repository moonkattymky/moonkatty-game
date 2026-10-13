// Dynamic import makes dependency-load failures reach the explicit ready/error gate.
import('./fixture.mjs').then(({bootLegacyAdoptionFixture})=>bootLegacyAdoptionFixture()).catch(error=>{
  window.legacyBootstrapError=String(error.stack||error);
  document.getElementById('adoptionStatus').textContent='Recovery blocked: '+String(error.message||error);
  window.legacyFixtureReady=true;
});
