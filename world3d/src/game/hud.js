// Game HUD (DOM): top bar (level ring, ⭐, daily cap, Задания), quest tracker, edge arrow / distance chip,
// context action button (above JET), completion popup, toasts, quests sheet. Mobile-first, keeps joystick + JET clear.
const CSS = `
body.game #title{display:none}
body.game #fuelwrap{top:max(66px,calc(max(env(safe-area-inset-top),var(--tg-inset-top,0px)) + 56px));left:12px;width:118px}
#mk-root{position:fixed;inset:0;pointer-events:none;z-index:4;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#f7f2e7}
#mk-root .pe{pointer-events:auto}
.mk-glass{background:linear-gradient(180deg,rgba(16,32,58,.86),rgba(6,10,22,.86));border:1px solid rgba(233,189,88,.55);box-shadow:0 4px 18px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.06);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
#mk-top{position:absolute;top:max(10px,max(env(safe-area-inset-top),var(--tg-inset-top,0px)));left:10px;display:flex;align-items:center;gap:8px;padding:5px 6px 5px 5px;border-radius:26px}
#mk-ring{position:relative;width:40px;height:40px;flex:none}
#mk-ring svg{position:absolute;inset:0;transform:rotate(-90deg)}
#mk-ring b{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#f7f2e7;line-height:1}
#mk-ring b small{font-size:7.5px;font-weight:700;color:#efd295;letter-spacing:.06em;margin-bottom:1px}
#mk-pts{display:flex;flex-direction:column;gap:3px;min-width:84px}
#mk-pts .v{font-size:15px;font-weight:800;color:#ffd77a;letter-spacing:.02em;white-space:nowrap}
#mk-cap{display:flex;align-items:center;gap:5px;font-size:9.5px;color:rgba(247,242,231,.75);white-space:nowrap}
#mk-capbar{width:44px;height:4px;border-radius:3px;background:rgba(103,215,240,.18);overflow:hidden}
#mk-capbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#67d7f0,#ffd77a)}
#mk-qbtn{border:1px solid rgba(233,189,88,.7);background:linear-gradient(180deg,#f3d58a,#c9973a);color:#1a1406;font-weight:800;font-size:12px;border-radius:18px;padding:8px 11px;letter-spacing:.02em;white-space:nowrap}
#mk-qbtn .dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#67d7f0;margin-left:5px;vertical-align:1px;box-shadow:0 0 6px #67d7f0}
#mk-track{position:absolute;top:max(80px,calc(max(env(safe-area-inset-top),var(--tg-inset-top,0px)) + 70px));left:10px;width:min(232px,62vw);border-radius:14px;padding:9px 11px 10px}
#mk-track .ch{font-size:9.5px;letter-spacing:.14em;color:#efd295;font-weight:700;text-transform:uppercase;display:flex;justify-content:space-between}
#mk-track .t{font-size:14px;font-weight:800;margin:3px 0 2px;display:flex;gap:6px;align-items:center}
#mk-track .d{font-size:11.5px;color:rgba(247,242,231,.82);line-height:1.3}
#mk-track .row{display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:11px}
#mk-track .bar{flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,.12);margin-right:8px;overflow:hidden}
#mk-track .bar i{display:block;height:100%;background:linear-gradient(90deg,#67d7f0,#a8f0ff)}
#mk-track .dist{color:#67d7f0;font-weight:800;white-space:nowrap}
#mk-track .hint{margin-top:5px;font-size:10.5px;color:#ffd77a}
#mk-arrow{position:absolute;left:0;top:0;width:46px;height:46px;margin:-23px 0 0 -23px;display:none}
#mk-arrow .a{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(16,32,58,.9),rgba(6,10,22,.75));border:1.5px solid #67d7f0;box-shadow:0 0 12px rgba(103,215,240,.6)}
#mk-arrow .a svg{position:absolute;inset:0;width:100%;height:100%}
#mk-arrow span{position:absolute;left:50%;top:50px;transform:translateX(-50%);font-size:11px;font-weight:800;color:#a8f0ff;text-shadow:0 1px 3px #000;white-space:nowrap}
#mk-chip{position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:none;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:800;color:#a8f0ff;white-space:nowrap}
#mk-act{position:absolute;right:max(18px,max(env(safe-area-inset-right),var(--tg-inset-right,0px)));bottom:max(212px,calc(max(env(safe-area-inset-bottom),var(--tg-inset-bottom,0px)) + 208px));display:none;min-width:150px;padding:12px 16px;border-radius:24px;border:1.5px solid #67d7f0;background:linear-gradient(180deg,rgba(16,46,74,.92),rgba(6,14,30,.92));color:#f7f2e7;font-weight:800;font-size:14px;overflow:hidden;box-shadow:0 0 16px rgba(103,215,240,.45)}
#mk-act i{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,rgba(103,215,240,.35),rgba(168,240,255,.55))}
#mk-act span{position:relative}
#mk-pop{position:absolute;left:50%;top:28%;transform:translate(-50%,-50%) scale(.9);opacity:0;transition:opacity .25s,transform .25s;width:min(300px,80vw);border-radius:20px;padding:18px 18px 14px;text-align:center}
#mk-pop.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
#mk-pop .ic{font-size:34px;line-height:1}
#mk-pop .h{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#efd295;font-weight:800;margin-top:6px}
#mk-pop .t{font-size:18px;font-weight:800;margin:4px 0 10px}
#mk-pop .rw{display:flex;justify-content:center;gap:10px}
#mk-pop .rw div{padding:6px 12px;border-radius:12px;background:rgba(255,215,122,.12);border:1px solid rgba(255,215,122,.45);font-weight:800;color:#ffd77a}
#mk-pop .rw div.xp{background:rgba(103,215,240,.12);border-color:rgba(103,215,240,.5);color:#a8f0ff}
#mk-pop .s{font-size:10.5px;color:rgba(247,242,231,.6);margin-top:9px}
#mk-pop .lv{margin-top:8px;font-weight:800;color:#a8f0ff}
#mk-toasts{position:absolute;left:50%;bottom:max(258px,calc(max(env(safe-area-inset-bottom),var(--tg-inset-bottom,0px)) + 254px));transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
.mk-toast{padding:6px 12px;border-radius:14px;font-size:12px;font-weight:800;color:#ffd77a;animation:mkt 1.8s forwards;white-space:nowrap}
@keyframes mkt{0%{opacity:0;transform:translateY(8px)}12%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0;transform:translateY(-10px)}}
#mk-sheet{position:absolute;left:0;right:0;bottom:0;max-height:68%;border-radius:22px 22px 0 0;transform:translateY(105%);transition:transform .28s;display:flex;flex-direction:column;padding:10px 14px max(14px,max(env(safe-area-inset-bottom),var(--tg-inset-bottom,0px)));border-bottom:none}
#mk-sheet.on{transform:none}
#mk-scrim{position:absolute;inset:0;background:rgba(2,4,10,.45);opacity:0;transition:opacity .25s;display:none}
#mk-scrim.on{opacity:1}
#mk-sheet .grab{width:40px;height:4px;border-radius:3px;background:rgba(247,242,231,.3);margin:0 auto 10px}
#mk-sheet .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
#mk-sheet .tabs{display:flex;gap:6px}
#mk-sheet .tabs button{border:1px solid rgba(233,189,88,.5);background:rgba(16,32,58,.7);color:#efd295;border-radius:14px;padding:7px 12px;font-size:12px;font-weight:800}
#mk-sheet .tabs button.on{background:linear-gradient(180deg,#f3d58a,#c9973a);color:#1a1406}
#mk-sheet .x{border:none;background:none;color:rgba(247,242,231,.75);font-size:22px;padding:2px 6px}
#mk-sheet .sub{font-size:11px;color:rgba(247,242,231,.7);margin:-4px 0 8px;display:flex;justify-content:space-between}
#mk-sheet .list{overflow-y:auto;display:flex;flex-direction:column;gap:7px;padding-bottom:4px}
.mk-q{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(247,242,231,.1)}
.mk-q.active{border-color:#67d7f0;background:rgba(103,215,240,.08);box-shadow:0 0 10px rgba(103,215,240,.2)}
.mk-q.locked{opacity:.5}
.mk-q .ic{font-size:20px;width:30px;text-align:center}
.mk-q .tx{flex:1;min-width:0}.mk-q .tt{font-size:13px;font-weight:800}.mk-q .dd{font-size:10.5px;color:rgba(247,242,231,.7);margin-top:1px}
.mk-q .rw{text-align:right;font-size:11px;font-weight:800;color:#ffd77a;white-space:nowrap}.mk-q .rw small{display:block;color:#a8f0ff}
.mk-q .st{font-size:9px;letter-spacing:.1em;text-transform:uppercase;margin-top:2px;color:rgba(247,242,231,.6)}
.mk-q.done .st{color:#8fe3a8}.mk-q.active .st{color:#67d7f0}
.mk-soon{padding:22px 12px;text-align:center;color:rgba(247,242,231,.75);font-size:13px;line-height:1.5}
.mk-soon b{display:block;font-size:30px;margin-bottom:6px}
@media (hover:hover) and (pointer:fine){#mk-act{bottom:150px}}
#mk-lives{font-size:12px;font-weight:800;color:#f7f2e7;white-space:nowrap;padding:0 2px}
#mk-lives.hit{animation:mkhit .6s}@keyframes mkhit{30%{transform:scale(1.35);color:#ff8a7a}}
#mk-act2{position:absolute;right:max(18px,max(env(safe-area-inset-right),var(--tg-inset-right,0px)));bottom:max(266px,calc(max(env(safe-area-inset-bottom),var(--tg-inset-bottom,0px)) + 262px));display:none;min-width:150px;padding:10px 14px;border-radius:22px;border:1.5px solid #a98bff;background:linear-gradient(180deg,rgba(40,26,74,.92),rgba(12,8,30,.92));color:#f7f2e7;font-weight:800;font-size:13px;box-shadow:0 0 14px rgba(169,139,255,.45)}
#mk-act.hold{transform:scale(.96);border-color:#ffd77a}
#mk-comp{position:absolute;right:10px;top:max(116px,calc(max(env(safe-area-inset-top),var(--tg-inset-top,0px)) + 106px));display:none;align-items:center;gap:8px;padding:5px 12px 5px 6px;border-radius:22px}
#mk-comp .c{width:34px;height:34px;border-radius:50%;border:1.5px solid #ffd77a;position:relative;background:radial-gradient(circle,rgba(16,32,58,.9),rgba(6,10,22,.8))}
#mk-comp .c svg{position:absolute;inset:0;width:100%;height:100%}
#mk-comp .l{font-size:11px;font-weight:800;color:#ffd77a;white-space:nowrap;line-height:1.2}#mk-comp .l small{display:block;color:rgba(247,242,231,.7);font-weight:700}
#mk-comp.hot .c{border-color:#67d7f0;box-shadow:0 0 12px #67d7f0}#mk-comp.hot .l{color:#a8f0ff}
#mk-sprint{position:absolute;right:10px;top:max(116px,calc(max(env(safe-area-inset-top),var(--tg-inset-top,0px)) + 106px));display:none;padding:6px 14px;border-radius:18px;text-align:center}
#mk-sprint .tm{font-size:22px;font-weight:900;color:#ffd77a;font-variant-numeric:tabular-nums}#mk-sprint .rg{font-size:11px;color:#a8f0ff;font-weight:800}#mk-sprint .stars{font-size:13px;letter-spacing:2px}
#mk-big{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);font-size:64px;font-weight:900;color:#ffd77a;text-shadow:0 0 18px rgba(255,180,60,.8);display:none}
#mk-build{position:absolute;left:50%;bottom:max(300px,calc(max(env(safe-area-inset-bottom),var(--tg-inset-bottom,0px)) + 296px));transform:translateX(-50%);width:min(280px,76vw);border-radius:16px;padding:9px 12px 10px;display:none}
#mk-build .h{font-size:12px;font-weight:800;color:#efd295;display:flex;justify-content:space-between}#mk-build .bar{height:8px;border-radius:5px;background:rgba(255,255,255,.1);margin-top:7px;overflow:hidden}#mk-build .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#67d7f0,#ffd77a)}
#mk-fade{position:absolute;inset:0;background:radial-gradient(circle,rgba(169,139,255,.55),rgba(4,4,12,.97) 60%);opacity:0;transition:opacity .3s;pointer-events:none}
#mk-fade.on{opacity:1}
#mk-auto{position:absolute;right:10px;top:max(70px,calc(max(env(safe-area-inset-top),var(--tg-inset-top,0px)) + 60px));display:none;border:1px solid rgba(103,215,240,.7);background:rgba(6,14,30,.85);color:#a8f0ff;border-radius:16px;padding:7px 10px;font-weight:800;font-size:12px}
.mk-sec{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:14px;background:rgba(255,215,122,.07);border:1px dashed rgba(255,215,122,.45);font-size:12.5px;font-weight:800;color:#ffd77a}
.mk-sec small{font-weight:700;color:rgba(247,242,231,.65);font-size:10.5px;margin-left:6px}
@media (hover:hover) and (pointer:fine){#mk-act2{bottom:204px}}
`;
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function makeHUD(t) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  document.body.classList.add('game');
  const root = document.createElement('div'); root.id = 'mk-root';
  root.innerHTML = `
  <div id="mk-top" class="mk-glass pe">
    <div id="mk-ring"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="none" stroke="rgba(103,215,240,.18)" stroke-width="3.5"/><circle id="mk-ringp" cx="20" cy="20" r="17" fill="none" stroke="url(#mkg)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="106.8" stroke-dashoffset="106.8"/><defs><linearGradient id="mkg"><stop offset="0" stop-color="#67d7f0"/><stop offset="1" stop-color="#ffd77a"/></linearGradient></defs></svg><b><small>${esc(t('level'))}</small><span id="mk-lv">1</span></b></div>
    <div id="mk-pts"><div class="v">⭐ <span id="mk-pv">0</span></div><div id="mk-cap"><div id="mk-capbar"><i></i></div><span id="mk-capt">0/300</span></div></div>
    <div id="mk-lives" title="lives">🐾 <span>9</span></div>
    <button id="mk-qbtn">${esc(t('quests'))}<span class="dot"></span></button>
  </div>
  <div id="mk-track" class="mk-glass pe"></div>
  <div id="mk-chip" class="mk-glass"></div>
  <div id="mk-arrow"><div class="a"><svg viewBox="0 0 46 46"><path d="M23 7 L33 22 L26.5 22 L26.5 36 L19.5 36 L19.5 22 L13 22 Z" fill="#67d7f0"/></svg></div><span></span></div>
  <button id="mk-act" class="pe"><i></i><span></span></button>
  <button id="mk-act2" class="pe"><span></span></button>
  <div id="mk-comp" class="mk-glass"><div class="c"><svg viewBox="0 0 34 34"><path d="M17 4 L23 19 L17 16 L11 19 Z" fill="#ffd77a"/></svg></div><div class="l"></div></div>
  <div id="mk-sprint" class="mk-glass"><div class="tm">0.0</div><div class="rg"></div><div class="stars"></div></div>
  <div id="mk-big"></div>
  <div id="mk-build" class="mk-glass"><div class="h"><span class="n"></span><span class="p"></span></div><div class="bar"><i></i></div></div>
  <button id="mk-auto" class="pe">⏩ AUTO</button>
  <div id="mk-toasts"></div>
  <div id="mk-pop" class="mk-glass pe"></div>
  <div id="mk-scrim" class="pe"></div>
  <div id="mk-fade"></div>
  <div id="mk-sheet" class="mk-glass pe"><div class="grab"></div><div class="hd"><div class="tabs"><button data-tab="ch" class="on">${esc(t('chapter'))}</button><button data-tab="daily">${esc(t('daily'))}</button></div><button class="x" aria-label="${esc(t('close'))}">×</button></div><div class="sub"></div><div class="list"></div></div>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  for (const el of root.querySelectorAll('.pe')) for (const ev of ['pointerdown', 'touchstart', 'wheel']) el.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  const H = {
    root, $,
    setTop({ level, xp, need, points, earned, cap }) {
      $('#mk-lv').textContent = level; $('#mk-ringp').setAttribute('stroke-dashoffset', (106.8 * (1 - Math.min(1, xp / need))).toFixed(1));
      $('#mk-pv').textContent = points.toLocaleString('ru-RU'); $('#mk-capt').textContent = `${earned}/${cap} ${t('today')}`; $('#mk-capbar i').style.width = Math.min(100, earned / cap * 100) + '%';
    },
    setTrack(html) { const el = $('#mk-track'); if (el._h !== html) { el.innerHTML = html; el._h = html; } },
    marker(mode, x, y, rot, label) {
      const a = $('#mk-arrow'), c = $('#mk-chip');
      if (mode === 'arrow') { a.style.display = 'block'; a.style.transform = `translate(${x}px,${y}px)`; a.querySelector('.a').style.transform = `rotate(${rot}rad)`; a.querySelector('span').textContent = label; c.style.display = 'none'; }
      else if (mode === 'chip') { c.style.display = 'block'; c.style.left = x + 'px'; c.style.top = y + 'px'; c.textContent = label; a.style.display = 'none'; }
      else { a.style.display = 'none'; c.style.display = 'none'; }
    },
    lives(n, hit) { const e = $('#mk-lives'); e.querySelector('span').textContent = n; if (hit) { e.classList.remove('hit'); void e.offsetWidth; e.classList.add('hit'); } },
    action2(label) { const b = $('#mk-act2'); if (label == null) { b.style.display = 'none'; return; } b.style.display = 'block'; b.querySelector('span').textContent = label; },
    compass(on, rot, label, sub, hot) { const c = $('#mk-comp'); if (!on) { c.style.display = 'none'; return; } c.style.display = 'flex'; c.classList.toggle('hot', !!hot); c.querySelector('svg').style.transform = `rotate(${rot}rad)`; const h = `${label}<small>${sub || ''}</small>`; const l = c.querySelector('.l'); if (l._h !== h) { l.innerHTML = h; l._h = h; } },
    sprint(on, time, ring, stars) { const e = $('#mk-sprint'); if (!on) { e.style.display = 'none'; return; } e.style.display = 'block'; e.querySelector('.tm').textContent = time.toFixed(1); e.querySelector('.rg').textContent = ring; e.querySelector('.stars').textContent = stars; },
    big(text) { const e = $('#mk-big'); if (!text) { e.style.display = 'none'; return; } e.style.display = 'block'; e.textContent = text; },
    build(on, name, frac) { const e = $('#mk-build'); if (!on) { e.style.display = 'none'; return; } e.style.display = 'block'; e.querySelector('.n').textContent = name; e.querySelector('.p').textContent = Math.round(frac * 100) + '%'; e.querySelector('.bar i').style.width = (frac * 100).toFixed(1) + '%'; },
    fade(on) { $('#mk-fade').classList.toggle('on', on); },
    action(label, frac) { const b = $('#mk-act'); if (label == null) { b.style.display = 'none'; return; } b.style.display = 'block'; b.querySelector('span').textContent = label; b.querySelector('i').style.width = (frac * 100).toFixed(1) + '%'; },
    toast(text) { const d = document.createElement('div'); d.className = 'mk-toast mk-glass'; d.textContent = text; $('#mk-toasts').appendChild(d); setTimeout(() => d.remove(), 1900); },
    popup({ icon, head, title, pts, xp, note, level }, ms = 2800) {
      const p = $('#mk-pop'); p.innerHTML = `<div class="ic">${icon}</div><div class="h">${esc(head)}</div><div class="t">${esc(title)}</div><div class="rw">${pts != null ? `<div>+${pts} ⭐</div>` : ''}${xp != null ? `<div class="xp">+${xp} XP</div>` : ''}</div>${level ? `<div class="lv">${esc(t('levelUp'))} ${esc(t('level'))} ${level}</div>` : ''}${note ? `<div class="s" style="color:#ffd77a">${esc(note)}</div>` : ''}<div class="s">${esc(t('tapToClose'))}</div>`;
      p.classList.add('on'); clearTimeout(p._t); p._t = setTimeout(() => p.classList.remove('on'), ms); p.onclick = () => p.classList.remove('on');
    },
    sheet(open, render) { const s = $('#mk-sheet'), sc = $('#mk-scrim'); if (open) { render && render(); sc.style.display = 'block'; requestAnimationFrame(() => { s.classList.add('on'); sc.classList.add('on'); }); } else { s.classList.remove('on'); sc.classList.remove('on'); setTimeout(() => { if (!s.classList.contains('on')) sc.style.display = 'none'; }, 280); } },
  };
  return H;
}
export { esc };
