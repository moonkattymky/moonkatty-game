// No original writer evaluates before native canonical hydration.
import {bootEarnedDailyFixture} from './fixture.mjs';
bootEarnedDailyFixture().catch(error=>{
  document.getElementById('atomicLoadingStatus').textContent='Recovery blocked: '+String(error.message||error);
  window.atomicBootstrapError=String(error.stack||error);window.atomicFixtureReady=true;
});
