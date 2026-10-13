// Dedicated entry: no legacy script may evaluate before canonical hydration.
import {bootAtomicFixture} from './fixture.mjs';
bootAtomicFixture().catch(error=>{
  document.getElementById('atomicLoadingStatus').textContent='Recovery blocked: '+String(error.message||error);
  window.atomicBootstrapError=String(error.stack||error);
  window.atomicFixtureReady=true;
});
