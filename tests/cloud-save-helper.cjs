/* Await the result of each flush before deciding whether to poll again. Playwright's
   waitForFunction treats an async predicate's Promise as truthy, even if it resolves false. */
async function waitForCloud(page, state, {timeout = 10000, polling = 100} = {}) {
  if (!['saved', 'conflict'].includes(state)) throw Error('Unknown cloud condition: ' + state);
  let stopped = false, deadline, pause;
  const expired = new Promise((_, reject) => {
    deadline = setTimeout(() => {
      stopped = true;
      reject(Error(`Cloud ${state} was not acknowledged within ${timeout}ms`));
    }, timeout);
  });
  const checking = (async () => {
    while (!stopped) {
      const ready = await page.evaluate(async state => {
        await MKTYCloud.flush();
        return state === 'saved' ? localStorage.getItem('mkty_cloud_dirty') !== 'yes'
          : !!document.querySelector('#cloudSaveStatus button');
      }, state);
      if (stopped) return;
      if (ready) return true;
      await new Promise(resolve => {pause = setTimeout(resolve, polling);});
    }
  })();
  try {return await Promise.race([checking, expired]);}
  finally {stopped = true; clearTimeout(deadline); clearTimeout(pause);}
}
module.exports = {waitForCloud};
