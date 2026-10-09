/* MOONKATTY daily retention: login streak, «Сигнал Луны» Morse cipher, YouTube code word.
   Server (rewards Edge Function + Telegram initData) is authoritative.
   Without initData (browser preview) a clearly-labelled DEMO mode keeps local-only state. */
(() => {
 const $ = id => document.getElementById(id);
 const T = (en, vars) => { let s = window.MKTYI18n?.t ? window.MKTYI18n.t(en) : en; for (const [k, v] of Object.entries(vars || {})) s = s.split('{' + k + '}').join(v); return s; };
 const MORSE = {A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..'};
 const FROM = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
 const SCALE = [3,5,7,10,12,15,25], CIPHER_POINTS = 15, MAX_ATTEMPTS = 5;
 const DEMO_WORDS = ['MOON','KATTY','ORBIT','BEACON','SIGNAL','CREW','VOID'];
 const DEMO_CODE = 'MOONTEST';
 const utcDay = (d = Date.now()) => new Date(d).toISOString().slice(0, 10);
 const dayNum = s => Math.floor(Date.parse(s + 'T00:00:00Z') / 864e5);
 const isoWeek = s => { const d = new Date(s + 'T00:00:00Z'); const wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd + 3); const y = d.getUTCFullYear(); const f = new Date(Date.UTC(y, 0, 4)); return y + '-W' + String(1 + Math.round(((d - f) / 864e5 - 3 + ((f.getUTCDay() + 6) % 7)) / 7)).padStart(2, '0'); };
 const glyph = m => [...m].map(c => c === '.' ? '•' : '—').join('');
 const locked = () => localStorage.getItem('mkty_life9') === 'complete';
 const online = () => !!window.Telegram?.WebApp?.initData && !!window.MKTYRewards;

 let state = null, input = [], letters = [], busy = false, flash = '';

 // ---------- DEMO (local only) ----------
 function demo() {
  let d;try{d=JSON.parse(localStorage.getItem('mkty_daily_demo')||'{}');}catch{}
  if(!d||typeof d!=='object'||Array.isArray(d))d={};
  d.attempts=Number.isInteger(d.attempts)?Math.max(0,Math.min(MAX_ATTEMPTS,d.attempts)):0;
  d.streak=Number.isSafeInteger(d.streak)&&d.streak>=0?d.streak:0;
  d.solved=d.solved===true;d.codes=Array.isArray(d.codes)?d.codes.filter(x=>typeof x==='string'):[];
  if(typeof d.last_day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.last_day)||!Number.isFinite(dayNum(d.last_day)))delete d.last_day;
  return d;
 }
 function saveDemo(d) { localStorage.setItem('mkty_daily_demo', JSON.stringify(d)); }
 function demoPoints(n) { if (locked() || n <= 0) return; const p = Number(localStorage.getItem('mkty_points') || 0) + n; localStorage.setItem('mkty_points', String(p)); if ($('points')) $('points').textContent = p + ' ⭐'; }
 function demoWord(day) { return DEMO_WORDS[((dayNum(day) % DEMO_WORDS.length) + DEMO_WORDS.length) % DEMO_WORDS.length]; }
 function demoStreakView(d, today) {
  const week = isoWeek(today), gap = d.last_day ? dayNum(today) - dayNum(d.last_day) : 99;
  const alive = gap <= 1 || (gap === 2 && d.shield_week !== week);
  const cur = alive ? (d.streak || 0) : 0;
  return { streak: cur, claimed_today: d.last_day === today, shield_available: d.shield_week !== week, next_reward: SCALE[Math.min(cur + 1, 7) - 1], scale: SCALE };
 }
 function demoStatus() {
  const today = utcDay(), d = demo(); if (d.cday !== today) { d.cday = today; d.attempts = 0; d.solved = false; saveDemo(d); }
  const w = demoWord(today);
  return { demo: true, day: today, cipher: { morse: [...w].map(c => MORSE[c]), length: w.length, attempts_left: MAX_ATTEMPTS - d.attempts, solved: d.solved, points: CIPHER_POINTS }, streak: demoStreakView(d, today) };
 }
 function demoSolve(ans) {
  const d = demo(), today = utcDay(); if (d.solved) return { correct: true, awarded: false };
  if ((d.attempts || 0) >= MAX_ATTEMPTS) return { error: 'no_attempts' };
  d.attempts = (d.attempts || 0) + 1;
  const ok = ans === demoWord(today); if (ok) { d.solved = true; demoPoints(CIPHER_POINTS); }
  saveDemo(d); return { correct: ok, awarded: ok, points: ok ? CIPHER_POINTS : 0, attempts_left: MAX_ATTEMPTS - d.attempts };
 }
 function demoCheckin() {
  const d = demo(), today = utcDay(); if (d.last_day === today) return { awarded: false, duplicate: true };
  const week = isoWeek(today), gap = d.last_day ? dayNum(today) - dayNum(d.last_day) : 99; let streak = 1, shield = false;
  if (gap === 1) streak = (d.streak || 0) + 1; else if (gap === 2 && d.shield_week !== week) { streak = (d.streak || 0) + 1; shield = true; d.shield_week = week; }
  d.streak = streak; d.last_day = today; saveDemo(d); const pts = SCALE[Math.min(streak, 7) - 1]; demoPoints(pts);
  return { awarded: true, points: pts, shield_used: shield };
 }
 function demoRedeem(code) {
  const d = demo(); d.codes = d.codes || [];
  if (code !== DEMO_CODE) return { valid: false };
  if (d.codes.includes(code)) return { valid: true, awarded: false, duplicate: true };
  d.codes.push(code); saveDemo(d); demoPoints(5); return { valid: true, awarded: true, points: 5 };
 }

 // ---------- server ----------
 async function api(action, payload) {
  if (!online()) return null;
  const body = await window.MKTYRewards.call(action, payload || {});
  return body || { error: 'offline' };
 }
 async function load() {
  const body = await api('daily.status');
  state = body?.ok && body.streak && body.cipher ? body : {...demoStatus(), offline:online()};
  render();
 }

 // ---------- render ----------
 function setText(el, s) { if (el && el.textContent !== s) el.textContent = s; }
 function render() {
  if (!state) return;
  const box = $('dailyOps'); if (!box) return;
  box.classList.toggle('is-demo', !!state.demo);
  setText($('dopsMode'), state.offline ? T('Connection lost — try again') : state.demo ? T('DEMO · local preview — rewards verified only in Telegram') : T('SERVER VERIFIED · Telegram'));
  // streak
  const s = state.streak, cur = s.streak, base = cur >= 7 ? cur - 6 : 1;
  setText($('streakCount'), T('Day {n}', { n: cur }));
  const pips = $('streakPips'); pips.innerHTML = '';
  for (let i = 0; i < 7; i++) {
   const day = s.claimed_today ? Math.max(1, cur - 6) + i : base + i; const n = Math.min(day, 7);
   const el = document.createElement('div'); el.className = 'streak-pip';
   const reached = s.claimed_today ? day <= cur : day <= cur; const next = !s.claimed_today && day === cur + 1;
   el.classList.toggle('done', reached); el.classList.toggle('next', next);
   el.innerHTML = '<small></small><b></b>'; el.firstChild.textContent = T('D{n}', { n: day }); el.lastChild.textContent = '+' + SCALE[n - 1];
   pips.appendChild(el);
  }
  setText($('streakShield'), s.shield_available ? T('🛡 Shield ready — saves 1 missed day this week') : T('🛡 Shield used this week'));
  $('streakShield').classList.toggle('used', !s.shield_available);
  const sb = $('streakBtn'); sb.disabled = s.claimed_today || locked() || busy || state.offline;
  setText(sb, locked() ? T('BALANCE LOCKED') : s.claimed_today ? T('CHECKED IN ✓') : T('CHECK IN +{n} ⭐', { n: s.next_reward }));
  // cipher
  const c = state.cipher;
  const tape = $('cipherTape'); const key = c.morse.join(' ');
  if (tape.dataset.k !== key) { tape.dataset.k = key; tape.innerHTML = ''; c.morse.forEach((m, i) => { const g = document.createElement('button'); g.type = 'button'; g.className = 'cipher-glyph'; g.dataset.i = i; g.innerHTML = '<span dir="ltr"></span><b></b>'; g.firstChild.textContent = glyph(m); tape.appendChild(g); }); }
  [...tape.children].forEach((g, i) => { setText(g.lastChild, letters[i] || '·'); g.classList.toggle('filled', !!letters[i]); g.classList.toggle('cursor', i === Math.min(letters.findIndex(x => !x) < 0 ? letters.length : letters.findIndex(x => !x), c.length - 1) && !c.solved); });
  setText($('cipherInput'), input.length ? glyph(input.join('')) : '—');
  setText($('cipherAttempts'), c.solved ? T('Decoded ✓ +{n} ⭐', { n: c.points }) : T('Attempts left: {n} / {m}', { n: c.attempts_left, m: MAX_ATTEMPTS }));
  const sub = $('cipherSubmit'), done = c.solved || c.attempts_left <= 0 || locked();
  box.querySelector('.cipher-card').classList.toggle('solved', c.solved);
  for (const b of box.querySelectorAll('[data-morse],#cipherSubmit,#cipherText')) b.disabled = done || busy || state.offline;
  setText(sub, c.solved ? T('SIGNAL DECODED ✓') : c.attempts_left <= 0 ? T('NO ATTEMPTS — NEW SIGNAL AT 00:00 UTC') : T('TRANSMIT ANSWER +{n} ⭐', { n: c.points }));
  setText($('dopsFlash'), flash);
 }
 function word() { return letters.map(x => x || '').join(''); }
 function commitLetter() {
  const L = FROM[input.join('')]; input = [];
  if (!L) { flash = T('Unknown Morse letter — try again'); render(); return; }
  const i = letters.findIndex(x => !x); const at = i < 0 ? letters.length : i; if (at >= state.cipher.length) return;
  letters[at] = L; $('cipherText').value = word(); flash = ''; render();
 }
 async function submitCipher() {
  const ans = ($('cipherText').value || word()).toUpperCase().replace(/[^A-Z]/g, '');
  if (ans.length !== state.cipher.length) { flash = T('Need {n} letters', { n: state.cipher.length }); render(); return; }
  busy = true; render();
  const r = state.demo && !online() ? demoSolve(ans) : await api('cipher.solve', { answer: ans });
  busy = false;
  if (r?.error === 'no_attempts') flash = T('No attempts left today');
  else if (r?.correct) { flash = r.awarded ? T('Signal decoded! +{n} ⭐', { n: r.points }) : T('Already decoded today'); }
  else if (r && 'correct' in r) { flash = T('Wrong word — signal distorted'); letters = []; $('cipherText').value = ''; }
  else flash = T('Connection lost — try again');
  await load();
 }
 async function checkin() {
  busy = true; render();
  const r = state.demo && !online() ? demoCheckin() : await api('streak.checkin');
  busy = false;
  flash = r?.awarded ? (r.shield_used ? T('Shield saved your streak! +{n} ⭐', { n: r.points }) : T('Check-in +{n} ⭐', { n: r.points })) : r?.duplicate ? T('Already checked in today') : T('Connection lost — try again');
  await load();
 }
 async function redeem() {
  const code = ($('ytCode').value || '').normalize('NFKC').trim().toUpperCase().replace(/[\s\-_.]+/g, '');
  const msg = $('ytMsg');
  if (!/^[A-Z0-9]{3,32}$/.test(code)) { setText(msg, T('Enter the code word from the video')); return; }
  $('ytBtn').disabled = true;
  const r = state?.demo && !online() ? demoRedeem(code) : await api('youtube.redeem', { code });
  $('ytBtn').disabled = false;
  setText(msg, r?.awarded ? T('Code accepted! +{n} ⭐', { n: r.points }) : r?.duplicate ? T('You already used this code') : r && r.valid === false ? T('Unknown or expired code') : r?.error === 'locked' ? T('BALANCE LOCKED') : r?.error === 'no_attempts' ? T('No attempts left today') : T('Connection lost — try again'));
  $('ytMsg').classList.toggle('ok', !!r?.awarded);
  if (r?.awarded) $('ytCode').value = '';
 }

 function mount() {
  const box = $('dailyOps'); if (!box) return;
  box.addEventListener('click', ev => {
   const m = ev.target.closest('[data-morse]'); if (m && !m.disabled) {
    const k = m.dataset.morse;
    if (k === '.' || k === '-') { if (input.length < 5) input.push(k); }
    else if (k === 'ok') { commitLetter(); return; }
    else if (k === 'del') { if (input.length) input.pop(); else { letters = letters.filter(Boolean).slice(0, -1); $('cipherText').value = word(); } }
    render(); return;
   }
   const g = ev.target.closest('.cipher-glyph'); if (g) { blink(state.cipher.morse[Number(g.dataset.i)], g); return; }
   if (ev.target.closest('#cipherSubmit')) submitCipher();
   if (ev.target.closest('#streakBtn')) checkin();
   if (ev.target.closest('#ytBtn')) redeem();
   if (ev.target.closest('#cipherRefToggle')) $('cipherRef').hidden = !$('cipherRef').hidden;
  });
  $('cipherText').addEventListener('input', e => { const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, state?.cipher?.length || 16); e.target.value = v; letters = [...v]; render(); });
  const ref = $('cipherRef'); ref.innerHTML = Object.entries(MORSE).map(([k, v]) => '<span><b>' + k + '</b>' + glyph(v) + '</span>').join('');
  load(); setInterval(() => { if (state && state.day !== utcDay()) { letters = []; load(); } else render(); }, 2000);
 }
 // visual tap-playback of one Morse letter
 function blink(m, el) {
  if (!m || el.classList.contains('playing')) return; el.classList.add('playing'); let t = 0;
  for (const c of m) { const d = c === '.' ? 160 : 420; setTimeout(() => el.classList.add('on'), t); setTimeout(() => el.classList.remove('on'), t + d); t += d + 140; }
  setTimeout(() => el.classList.remove('playing'), t);
  try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light'); } catch {}
 }
 window.MKTYDaily = { reload: load, _demoStatus: demoStatus, MORSE };
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
