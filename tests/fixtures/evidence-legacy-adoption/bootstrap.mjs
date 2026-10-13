import {bootLegacyAdoptionFixture} from './fixture.mjs';
bootLegacyAdoptionFixture().catch(error=>{
  window.legacyBootstrapError=String(error.stack||error);
  document.getElementById('adoptionStatus').textContent='Recovery blocked: '+String(error.message||error);
  window.legacyFixtureReady=true;
});
