// DOM mini-games for Chapter 1 (phone-first, one thumb): mining timing bar + reactor pipe puzzle.
const CSS = `
#mk-mine{position:absolute;left:50%;bottom:max(300px,calc(env(safe-area-inset-bottom) + 296px));transform:translateX(-50%);width:min(300px,78vw);border-radius:16px;padding:10px 12px 11px;display:none;text-align:center}
#mk-mine .h{font-size:12px;font-weight:800;color:#efd295;letter-spacing:.04em}
#mk-mine .bar{position:relative;height:22px;border-radius:11px;background:rgba(255,255,255,.08);border:1px solid rgba(247,242,231,.25);margin:8px 0 6px;overflow:hidden}
#mk-mine .zone{position:absolute;top:0;bottom:0;background:linear-gradient(180deg,rgba(110,236,140,.75),rgba(60,190,95,.75));border-left:1px solid #b6ffc6;border-right:1px solid #b6ffc6}
#mk-mine .perf{position:absolute;top:0;bottom:0;background:rgba(255,236,150,.85)}
#mk-mine .nd{position:absolute;top:-3px;bottom:-3px;width:4px;margin-left:-2px;border-radius:2px;background:#fff;box-shadow:0 0 8px #67d7f0}
#mk-mine .s{font-size:11px;color:rgba(247,242,231,.8);min-height:14px}
#mk-mine .s.ok{color:#8fe3a8;font-weight:800}#mk-mine .s.bad{color:#ff8a7a;font-weight:800}#mk-mine .s.perfect{color:#ffd77a;font-weight:800}
#mk-mine .pips{display:flex;justify-content:center;gap:5px;margin-top:4px}#mk-mine .pips i{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.18)}#mk-mine .pips i.on{background:#67d7f0;box-shadow:0 0 6px #67d7f0}
#mk-puz{position:absolute;left:50%;top:50%;transform:translate(-50%,-55%);width:min(318px,88vw);border-radius:20px;padding:12px 14px 14px;display:none;text-align:center}
#mk-puz .h{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#efd295;font-weight:800}
#mk-puz .d{font-size:11.5px;color:rgba(247,242,231,.8);margin:4px 0 10px}
#mk-puz .wrap{position:relative;display:flex;align-items:center;justify-content:center;gap:4px}
#mk-puz .grid{display:grid;grid-template-columns:repeat(3,72px);grid-template-rows:repeat(3,72px);gap:4px}
#mk-puz .tile{width:72px;height:72px;border-radius:12px;background:rgba(16,32,58,.9);border:1px solid rgba(233,189,88,.35);padding:0;touch-action:manipulation}
#mk-puz .tile svg{width:100%;height:100%;transition:transform .15s}
#mk-puz .tile.on{border-color:#67d7f0;box-shadow:0 0 10px rgba(103,215,240,.45) inset}
#mk-puz .io{width:22px;height:22px;border-radius:50%;font-size:12px;line-height:22px}
#mk-puz .io.src{background:#ffb347;box-shadow:0 0 10px #ffb347}#mk-puz .io.dst{background:rgba(103,215,240,.25);border:1px solid #67d7f0}#mk-puz .io.dst.on{background:#67d7f0;box-shadow:0 0 12px #67d7f0}
#mk-puz .row2{display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:11px;color:rgba(247,242,231,.7)}
#mk-puz .row2 button{border:1px solid rgba(233,189,88,.5);background:rgba(16,32,58,.7);color:#efd295;border-radius:12px;padding:6px 10px;font-size:11px;font-weight:800}
#mk-puz.win .grid{animation:mkwin .6s}@keyframes mkwin{50%{transform:scale(1.05)}}
`;
// ---------- mining timing bar: hold -> needle sweeps; release in the (drifting) green zone. Perfect band = bonus, miss = crystal cracks ----------
export function makeMiner(root, t, fast) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'mk-mine'; el.className = 'mk-glass'; el.innerHTML = `<div class="h">⛏️ ${t('mineHead')}</div><div class="bar"><div class="zone"></div><div class="perf"></div><div class="nd"></div></div><div class="s"></div><div class="pips"></div>`;
  root.appendChild(el); const $ = s => el.querySelector(s);
  let ZW = fast ? 0.7 : 0.2, PW = fast ? 0.3 : 0.055; const ZW0 = ZW; let open = false, holding = false, needle = 0, dirN = 1, zc = 0.5, time = 0, msgT = 0;
  const M = { easy(v) { ZW = v ? Math.max(ZW0, 0.34) : ZW0; }, get open() { return open; }, get holding() { return holding; }, zone: () => ({ c: zc, w: ZW, pw: PW }), get needle() { return needle; },
    show(done, need) { open = true; el.style.display = 'block'; M.pips(done, need); if (!msgT) M.msg(t('mineHint'), ''); },
    hide() { open = false; holding = false; el.style.display = 'none'; },
    pips(done, need) { $('.pips').innerHTML = Array.from({ length: need }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join(''); },
    msg(s, cls) { const m = $('.s'); m.textContent = s; m.className = 's ' + (cls || ''); msgT = cls ? 1.4 : 0; },
    press() { if (!open) return; holding = true; needle = 0; dirN = 1; },
    // returns 'perfect' | 'ok' | 'miss' | null
    release(force) { if (!open || !holding) return null; holding = false; if (force != null) needle = force; const d = Math.abs(needle - zc); const r = d <= PW / 2 ? 'perfect' : d <= ZW / 2 ? 'ok' : 'miss'; return r; },
    update(dt) { if (!open) return; time += dt; if (msgT > 0) { msgT -= dt; if (msgT <= 0) { msgT = 0; M.msg(t('mineHint'), ''); } }
      zc = 0.5 + (fast ? 0.05 : 0.3) * Math.sin(time * 1.25); if (holding) { needle += dirN * dt * 0.85; if (needle > 1) { needle = 2 - needle; dirN = -1; } if (needle < 0) { needle = -needle; dirN = 1; } }
      $('.zone').style.left = ((zc - ZW / 2) * 100).toFixed(2) + '%'; $('.zone').style.width = (ZW * 100).toFixed(2) + '%'; $('.perf').style.left = ((zc - PW / 2) * 100).toFixed(2) + '%'; $('.perf').style.width = (PW * 100).toFixed(2) + '%'; $('.nd').style.left = (needle * 100).toFixed(2) + '%'; } };
  return M;
}

// ---------- reactor pipe puzzle: 3x3 tiles, tap to rotate 90°, connect the power source (left) to the reactor (right) ----------
// tile connection masks: N=1 E=2 S=4 W=8
const ROT = (m) => ((m << 1) | (m >> 3)) & 15;
const SVG = (m, on) => { const c = on ? '#67d7f0' : '#8a8f99', g = on ? 'filter:drop-shadow(0 0 4px #67d7f0)' : ''; const seg = { 1: 'M36 36 V2', 2: 'M36 36 H70', 4: 'M36 36 V70', 8: 'M36 36 H2' };
  return `<svg viewBox="0 0 72 72" style="${g}"><g stroke="${c}" stroke-width="11" stroke-linecap="round" fill="none">${[1, 2, 4, 8].filter(b => m & b).map(b => `<path d="${seg[b]}"/>`).join('')}</g><circle cx="36" cy="36" r="8" fill="${on ? '#a8f0ff' : '#5b606a'}"/></svg>`; };
export function makePuzzle(root, t, onSolved) {
  const el = document.createElement('div'); el.id = 'mk-puz'; el.className = 'mk-glass pe';
  el.innerHTML = `<div class="h">⚡ ${t('puzHead')}</div><div class="d">${t('puzDesc')}</div><div class="wrap"><div class="io src">⚡</div><div class="grid"></div><div class="io dst">☢</div></div><div class="row2"><span class="mv"></span><button class="cl">${t('close')}</button></div>`;
  root.appendChild(el); for (const ev of ['pointerdown', 'touchstart', 'wheel']) el.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  // solution path: enter (1,0) from W, exit (1,2) to E: (1,0)->(0,0)->(0,1)->(1,1)->(2,1)->(2,2)->(1,2)
  const sol = [ [2 | 4, 8 | 4, 0], [8 | 1, 1 | 4, 4 | 2], [0, 1 | 2, 8 | 1] ]; // (row,col) masks for path cells
  sol[1][0] = 8 | 1; sol[0][0] = 4 | 2; sol[0][1] = 8 | 4; sol[1][1] = 1 | 4; sol[2][1] = 1 | 2; sol[2][2] = 8 | 1; sol[1][2] = 4 | 2; sol[0][2] = 2 | 8; sol[2][0] = 1 | 2; // decoys on (0,2),(2,0)
  let tiles = [], solved = false, moves = 0, open = false;
  const flow = () => { // BFS from the source (enters (1,0) from W)
    const on = new Set(); const mask = (r, c) => tiles[r * 3 + c]; if (!(mask(1, 0) & 8)) return { on, done: false };
    const q = [[1, 0]]; on.add('1,0'); const D = [[1, -1, 0, 4], [2, 0, 1, 8], [4, 1, 0, 1], [8, 0, -1, 2]];
    while (q.length) { const [r, c] = q.shift(); const m = mask(r, c); for (const [b, dr, dc, back] of D) { if (!(m & b)) continue; const rr = r + dr, cc = c + dc; if (rr < 0 || rr > 2 || cc < 0 || cc > 2) continue; if (!(mask(rr, cc) & back)) continue; const k = rr + ',' + cc; if (!on.has(k)) { on.add(k); q.push([rr, cc]); } } }
    return { on, done: on.has('1,2') && !!(mask(1, 2) & 2) }; };
  const render = () => { const { on, done } = flow(); const g = el.querySelector('.grid'); g.innerHTML = tiles.map((m, i) => `<button class="tile ${on.has(Math.floor(i / 3) + ',' + i % 3) ? 'on' : ''}" data-i="${i}">${SVG(m, on.has(Math.floor(i / 3) + ',' + i % 3))}</button>`).join('');
    el.querySelector('.dst').classList.toggle('on', done); el.querySelector('.mv').textContent = `${t('puzMoves')}: ${moves}`; return done; };
  const scramble = () => { tiles = sol.flat(); let guard = 0; do { tiles = tiles.map(m => { let x = m; const k = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < k; i++) x = ROT(x); return x; }); } while (flow().done && guard++ < 20); moves = 0; solved = false; };
  el.querySelector('.grid').addEventListener('click', e => { const b = e.target.closest('.tile'); if (!b || solved) return; const i = +b.dataset.i; tiles[i] = ROT(tiles[i]); moves++; if (render()) { solved = true; el.classList.add('win'); setTimeout(() => { P.hide(); onSolved && onSolved(moves); }, 650); } });
  el.querySelector('.cl').addEventListener('click', () => P.hide());
  const P = { get open() { return open; }, get solved() { return solved; }, show() { if (!tiles.length || solved) scramble(); el.classList.remove('win'); render(); el.style.display = 'block'; open = true; }, hide() { el.style.display = 'none'; open = false; },
    tiles: () => tiles.slice(), rotate(i) { el.querySelector(`.tile[data-i="${i}"]`)?.click(); },
    // test/fast helper: the minimal taps that solve it (rotations per tile)
    solution() { const out = []; tiles.forEach((m, i) => { const want = sol.flat()[i]; let x = m, k = 0; while (x !== want && k < 4) { x = ROT(x); k++; } if (i === 2 || i === 6) k = 0; for (let j = 0; j < k; j++) out.push(i); }); return out; } };
  return P;
}
