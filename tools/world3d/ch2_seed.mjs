// helper: seed a save at a given Chapter 2 point and load the page. usage in other tools: await seed(p, { done: [...], level })
export async function seed(p, q = '', o = {}) {
  const url = 'http://localhost:' + (process.env.MKPORT || 47321) + '/index.html?view=play&fast=1' + q;
  await p.goto(url + '&reset=1'); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready, null, { timeout: 150000 });
  await p.evaluate((o) => { const s = JSON.parse(localStorage.getItem('mkty_world_v1')); s.ch1.done = ['power', 'canyon', 'crystals', 'parts', 'dish', 'reactor', 'launch', 'secret', 'home']; s.base.built = ['depot'];
    const c = s.ch2; c.on = true; c.done = o.done || []; c.level = o.level || 1; c.res = o.res || { cry: 40, ore: 60 }; c.storage = { cry: 10, ore: 14, t: Date.now() }; if (o.robots) c.robots = o.robots; if (o.museum) c.museum = o.museum; localStorage.setItem('mkty_world_v1', JSON.stringify(s)); }, o);
  await p.goto(url); await p.waitForFunction(() => window.MK && MK.ready && MK.game && MK.game.ready && MK.game.ch2.on, null, { timeout: 150000 });
}
