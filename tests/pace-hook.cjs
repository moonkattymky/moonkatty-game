/* Test hook: playthrough tests are not about calendar pacing or life loss, so every page they open
   starts with localStorage.mkty_test_no_pacing=yes (honoured only by the client demo layer; the server
   still enforces pacing). tests/pace-ui.cjs and tests/pace-server.cjs cover pacing itself. */
const pw=require('playwright');
if(!pw.chromium.__mktyPaceHook){
 const launch=pw.chromium.launch.bind(pw.chromium);
 pw.chromium.launch=async(...a)=>{const browser=await launch(...a),newPage=browser.newPage.bind(browser);
  browser.newPage=async(...o)=>{const page=await newPage(...o);await page.addInitScript(()=>{try{localStorage.setItem('mkty_test_no_pacing','yes');}catch{}});return page;};return browser;};
 pw.chromium.__mktyPaceHook=true;
}
module.exports=pw;
