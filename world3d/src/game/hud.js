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
/* ===== v43 skin: space-glass bars (navy #0B1530, stars, thin gold rim, gold numerals, cyan accents) + ivory (#F3EAD7) / gold (#C8912A) panels ===== */
#mk-root{--iv:#F3EAD7;--gd:#C8912A;--gd2:#E9C46A;--nv:#0B1530;--cy:#67d7f0;--ink:#3a2a12}
.mk-space{background:radial-gradient(1px 1px at 12% 30%,rgba(255,255,255,.75),transparent 60%),radial-gradient(1px 1px at 37% 70%,rgba(255,255,255,.55),transparent 60%),radial-gradient(1.2px 1.2px at 63% 22%,rgba(255,255,255,.7),transparent 60%),radial-gradient(1px 1px at 82% 64%,rgba(190,220,255,.6),transparent 60%),radial-gradient(1px 1px at 92% 18%,rgba(255,255,255,.5),transparent 60%),radial-gradient(1px 1px at 24% 88%,rgba(255,255,255,.45),transparent 60%),radial-gradient(120% 160% at 30% 0%,rgba(40,60,120,.55),transparent 60%),linear-gradient(180deg,rgba(11,21,48,.86),rgba(6,11,28,.88));border:1px solid rgba(200,145,42,.85);box-shadow:0 0 0 1px rgba(0,0,0,.35),0 4px 18px rgba(0,0,0,.45),inset 0 1px 0 rgba(233,196,106,.25),inset 0 0 14px rgba(103,215,240,.08);backdrop-filter:blur(8px) saturate(1.2);-webkit-backdrop-filter:blur(8px) saturate(1.2)}
#mk-top{padding:4px 6px 4px 4px;gap:10px;border-radius:24px}
#mk-ring{width:44px;height:44px;border-radius:50%;background:radial-gradient(circle,#13214a 58%,#0b1530 60%);box-shadow:0 0 0 2px var(--gd),0 0 10px rgba(200,145,42,.45)}
#mk-ring b{color:#fff3d6}#mk-ring b small{color:var(--gd2)}
#mk-pts .v,#mk-cry .v{font-size:16px;font-weight:900;color:var(--gd2);text-shadow:0 1px 0 #000,0 0 8px rgba(233,196,106,.35);display:flex;align-items:center;gap:5px}
#mk-pts .v .st{font-size:17px;filter:drop-shadow(0 0 4px rgba(255,200,80,.7))}
#mk-cry{display:flex;align-items:center;padding-left:9px;border-left:1px solid rgba(200,145,42,.35)}
#mk-cry svg{width:16px;height:20px;filter:drop-shadow(0 0 5px rgba(80,170,255,.9))}
#mk-cap{color:rgba(168,240,255,.8)}#mk-capbar{background:rgba(103,215,240,.15)}#mk-capbar i{background:linear-gradient(90deg,var(--cy),var(--gd2))}
#mk-lives{color:#a8f0ff;padding-left:9px;border-left:1px solid rgba(200,145,42,.35)}
#mk-qbtn{width:auto;height:30px;border-radius:16px;border:1.5px solid var(--gd);background:radial-gradient(circle at 50% 30%,#fff8e6,var(--iv) 55%,#d9c7a2);color:var(--ink);font-size:12px;padding:0 11px;box-shadow:0 0 8px rgba(200,145,42,.5)}
/* quest card: holographic tablet (concept: translucent cyan holo glass, glowing edge, scanlines) in a thin gold bezel with ivory corners */
#mk-track{border-radius:10px;border:1.5px solid rgba(103,215,240,.85);background:repeating-linear-gradient(0deg,rgba(103,215,240,.06) 0 1px,transparent 1px 3px),linear-gradient(160deg,rgba(30,90,140,.55),rgba(8,24,54,.72) 55%,rgba(20,70,120,.55));box-shadow:0 0 0 2px rgba(200,145,42,.55),0 0 18px rgba(103,215,240,.45),inset 0 0 18px rgba(103,215,240,.22);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);color:#e8fbff;text-shadow:0 0 6px rgba(103,215,240,.35)}
#mk-track::before,#mk-track::after{content:'';position:absolute;width:14px;height:14px;border:2.5px solid var(--iv);filter:drop-shadow(0 0 3px rgba(200,145,42,.9))}
#mk-track::before{left:-4px;top:-4px;border-right:none;border-bottom:none;border-top-left-radius:6px}
#mk-track::after{right:-4px;bottom:-4px;border-left:none;border-top:none;border-bottom-right-radius:6px}
#mk-track .ch{color:#a8f0ff}#mk-track .d{color:rgba(232,251,255,.85)}#mk-track .hint{color:var(--gd2)}
/* ivory-gold panels: popup, quests sheet (chapter 1/2 hub), build card, compass, sprint, toasts */
#mk-pop,#mk-sheet,#mk-build,#mk-comp,#mk-sprint,.mk-toast,#mk-chip{background:linear-gradient(180deg,#fbf5e8,var(--iv) 60%,#e8dcc0);border:1.5px solid var(--gd);box-shadow:0 0 0 1px rgba(255,255,255,.6) inset,0 6px 20px rgba(0,0,0,.4),0 0 12px rgba(200,145,42,.35);color:var(--ink);backdrop-filter:none;text-shadow:none}
#mk-pop .h,#mk-build .h,#mk-sheet .tabs button{color:#8a5c12}
#mk-pop .t{color:#2a1d08}#mk-pop .s{color:rgba(58,42,18,.65)}#mk-pop .lv{color:#1f7fa0}
#mk-pop .rw div{background:rgba(200,145,42,.14);border-color:var(--gd);color:#8a5c12}#mk-pop .rw div.xp{background:rgba(103,215,240,.15);border-color:#3aa9c9;color:#1f7fa0}
.mk-toast{color:#8a5c12}#mk-chip{color:#1f7fa0}
#mk-comp .l{color:#8a5c12}#mk-comp .l small{color:rgba(58,42,18,.65)}#mk-sprint .tm{color:#9a6a12}#mk-sprint .rg{color:#1f7fa0}
#mk-build .bar{background:rgba(58,42,18,.12)}
#mk-sheet .grab{background:rgba(200,145,42,.5)}#mk-sheet .x{color:#8a5c12}#mk-sheet .sub{color:rgba(58,42,18,.7)}
#mk-sheet .tabs button{background:rgba(255,255,255,.55);border-color:var(--gd)}
#mk-sheet .tabs button.on,#mk-sheet .c2-btn.go{background:linear-gradient(180deg,#f0cf7a,var(--gd));color:#2a1a04;border-color:#a87420}
#mk-sheet .mk-q,#mk-sheet .c2-card{background:rgba(255,255,255,.55);border:1px solid rgba(200,145,42,.45)}
#mk-sheet .mk-q.active,#mk-sheet .c2-card.hl{border-color:#3aa9c9;background:rgba(103,215,240,.12);box-shadow:0 0 10px rgba(103,215,240,.35)}
#mk-sheet .mk-q .dd,#mk-sheet .mk-q .st,#mk-sheet .c2-row small,#mk-sheet .c2-tag{color:rgba(58,42,18,.68)}
#mk-sheet .mk-q .rw,#mk-sheet .c2-btn small,#mk-sheet [style*="ffd77a"]{color:#9a6a12!important}#mk-sheet .mk-q .rw small{color:#1f7fa0}
#mk-sheet .mk-q.done .st{color:#2f8a4c}#mk-sheet .mk-q.active .st{color:#1f7fa0}
#mk-sheet .c2-btn{background:rgba(255,255,255,.7);color:var(--ink);border-color:var(--gd)}#mk-sheet .c2-btn.go small{color:#2a1a04!important}
#mk-sheet .c2-bar{background:rgba(58,42,18,.12)}#mk-sheet .c2-stub{border-color:rgba(58,42,18,.3)}
#mk-sheet .mk-sec{background:rgba(200,145,42,.1);border-color:var(--gd);color:#8a5c12}#mk-sheet .mk-sec small{color:rgba(58,42,18,.65)}
#mk-sheet .mk-soon{color:rgba(58,42,18,.75)}
#mk-scrim{background:rgba(4,8,22,.5)}
/* round action buttons: ivory-gold with cyan glow */
#mk-act{border:2px solid var(--gd);background:linear-gradient(180deg,#fbf5e8,var(--iv) 60%,#e2d3b2);color:var(--ink);box-shadow:0 0 0 2px rgba(103,215,240,.55),0 0 16px rgba(103,215,240,.55)}
#mk-act i{background:linear-gradient(90deg,rgba(103,215,240,.45),rgba(103,215,240,.7))}
#mk-crewbtn{border:1.5px solid var(--gd)!important;background:radial-gradient(circle at 50% 30%,#fff8e6,var(--iv) 55%,#d9c7a2)!important;color:var(--ink)!important}
#mk-crewbtn.ask{box-shadow:0 0 10px rgba(255,140,80,.7)!important}
/* wrist-map button (concept: square ivory tile, gold rim, parchment map) */
#mk-map{position:absolute;left:max(26px,max(env(safe-area-inset-left),var(--tg-inset-left,0px)));bottom:max(176px,calc(max(env(safe-area-inset-bottom),var(--tg-inset-bottom,0px)) + 172px));width:58px;height:62px;border-radius:14px;border:2px solid var(--gd);background:radial-gradient(circle at 50% 25%,#fffaf0,var(--iv) 55%,#dccba6);box-shadow:0 0 0 1px rgba(255,255,255,.6) inset,0 4px 12px rgba(0,0,0,.45),0 0 10px rgba(200,145,42,.45);padding:5px 0 0;color:var(--ink);font-weight:900;font-size:10px;letter-spacing:.06em;display:flex;flex-direction:column;align-items:center;gap:1px}
#mk-map svg{width:36px;height:34px}
/* ornate gold joystick + jetpack-thruster JET button */
body.game #joy{width:132px;height:132px;background:radial-gradient(circle,rgba(11,21,48,.55) 52%,rgba(11,21,48,.35) 62%,transparent 63%),conic-gradient(from 0deg,#8a5c12,#f0cf7a,#C8912A,#fff1c8,#a87420,#f0cf7a,#8a5c12);-webkit-mask:radial-gradient(circle,#000 70%,transparent 71%);mask:radial-gradient(circle,#000 70.5%,transparent 71%);border:none;box-shadow:none}
body.game #joy::before{content:'';position:absolute;inset:10px;border-radius:50%;border:1.5px solid rgba(240,207,122,.8);box-shadow:inset 0 0 12px rgba(0,0,0,.55);background:repeating-conic-gradient(rgba(240,207,122,.0) 0 13deg,rgba(240,207,122,.55) 13deg 15deg) border-box;-webkit-mask:radial-gradient(circle,transparent 82%,#000 83%);mask:radial-gradient(circle,transparent 82%,#000 83%)}
body.game #knob{left:38px;top:38px;width:56px;height:56px;background:radial-gradient(circle at 34% 28%,#fff6d8 0,#f5d27a 18%,#C8912A 52%,#6e4810 92%);box-shadow:0 4px 10px rgba(0,0,0,.6),0 0 0 2px #8a5c12,0 0 14px rgba(240,190,80,.55)}
body.game #jump{width:92px;height:92px;border:3px solid var(--gd,#C8912A);background:radial-gradient(circle at 50% 40%,#1d3266,#0B1530 70%);box-shadow:0 0 0 2px #f0cf7a inset,0 0 0 1px #6e4810,0 0 18px rgba(103,215,240,.65),0 6px 14px rgba(0,0,0,.5);padding:0;overflow:visible;color:#fff3d6;font-weight:900;font-size:15px;letter-spacing:.06em}
body.game #jump svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
body.game #jump b{position:absolute;left:0;right:0;top:27px;text-align:center;text-shadow:0 1px 2px #000,0 0 8px rgba(103,215,240,.8);pointer-events:none}
body.game #jump .fl{position:absolute;left:50%;bottom:-16px;width:26px;height:30px;margin-left:-13px;border-radius:50% 50% 50% 50%/30% 30% 70% 70%;background:radial-gradient(ellipse at 50% 20%,#fff,#a8f0ff 30%,rgba(103,215,240,.6) 55%,transparent 72%);filter:blur(1px);animation:mkfl .18s infinite alternate;pointer-events:none}
@keyframes mkfl{to{transform:scaleY(1.2) scaleX(.9);opacity:.8}}
@media (hover:hover) and (pointer:fine){body.game #joy,body.game #jump{opacity:.55}}
/* v44 quest panel 1:1 with concept 1eb41bee (right panel): compact holo tablet top-left, perspective tilt, chamfered frame, cyan glow, MOONKATTY 9 header, QUEST: + title */
#mk-track{top:max(78px,calc(max(env(safe-area-inset-top),var(--tg-inset-top,0px)) + 68px));left:12px;width:min(40vw,176px);padding:9px 11px 9px 12px;border-radius:0;border:none;background:none;box-shadow:none;transform:perspective(520px) rotateY(16deg) rotateZ(-0.6deg);transform-origin:0 50%;filter:drop-shadow(0 0 7px rgba(80,200,255,.75));color:#dff8ff;text-shadow:0 0 5px rgba(110,220,255,.55);font-family:"Segoe UI",Roboto,system-ui,sans-serif}
#mk-track::before{content:'';position:absolute;inset:0;left:0;top:0;width:auto;height:auto;border:none;border-radius:0;filter:none;z-index:-1;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);background:linear-gradient(90deg,rgba(130,230,255,.95),rgba(80,190,255,.85))}
#mk-track::after{content:'';position:absolute;inset:1.6px;right:1.6px;bottom:1.6px;width:auto;height:auto;border:none;border-radius:0;filter:none;z-index:-1;clip-path:polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px);background:repeating-linear-gradient(0deg,rgba(110,220,255,.07) 0 1px,transparent 1px 3px),linear-gradient(160deg,rgba(14,52,96,.86),rgba(5,18,44,.9) 60%,rgba(12,48,90,.86))}
#mk-track .ch{font-size:8px;letter-spacing:.08em;color:#bfefff;font-weight:600;opacity:.95}
#mk-track .ch span:first-child::before{content:'MOONKATTY 9 · ';font-weight:700;color:#e6fbff}
#mk-track .qh{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#e6fbff;margin-top:5px}
#mk-track .t{font-size:12.5px;font-weight:500;margin:1px 0 2px;color:#e6fbff;line-height:1.2}
#mk-track .d{display:none}
#mk-track .row{font-size:9.5px;margin-top:4px}
#mk-track .row:has(.dist){display:none}
#mk-track .bar{height:3px;background:rgba(110,220,255,.18)}
#mk-track .hint{font-size:9px;margin-top:3px;color:#9fe6ff;line-height:1.25}
#mk-track{top:max(104px,calc(max(env(safe-area-inset-top),var(--tg-inset-top,0px)) + 94px));width:min(47vw,196px);padding:11px 13px 12px 14px}
#mk-track .ch{display:block;font-size:7.5px;letter-spacing:.06em;color:#8fd8f0;font-weight:500;text-transform:none}
#mk-track .ch span:first-child::before{content:'MOONKATTY 9';display:block;font-size:12.5px;letter-spacing:.02em;font-weight:500;color:#e6fbff;margin-bottom:1px;text-transform:uppercase}
#mk-track .ch span:last-child{display:none}
#mk-track .qh{font-size:15px;font-weight:500;letter-spacing:.02em;margin-top:9px}
#mk-track .t{font-size:13.5px;font-weight:400}
#mk-pts .v,#mk-cry .v{font-size:18px}#mk-pts .v .st{font-size:20px}#mk-cry svg{width:18px;height:22px}

#mk-track{top:max(92px,calc(max(env(safe-area-inset-top),var(--tg-inset-top,0px)) + 82px));left:13px;width:150px;min-height:0;max-height:150px;padding:9px 11px 10px 12px;transform:perspective(420px) rotateY(14deg);transform-origin:0 50%;pointer-events:auto;cursor:pointer;overflow:hidden}
#mk-track .ch{font-size:6.5px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mk-track .ch span:first-child::before{font-size:11px;margin-bottom:1px}
#mk-track .qh{font-size:13.5px;margin-top:8px;display:flex;justify-content:space-between;align-items:baseline}
#mk-track .qh .qn{font-size:9.5px;color:#9fe6ff;font-weight:500;letter-spacing:0}
#mk-track .t{font-size:12.5px;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:0}
#mk-track .row,#mk-track .hint{display:none}
#mk-track.x{max-height:none}#mk-track.x .hint{display:block}#mk-track.x .row:not(:has(.dist)){display:flex}
#mk-track.c{width:auto;padding:7px 10px}#mk-track.c .t,#mk-track.c .ch span:first-child{display:none}#mk-track.c .qh{margin-top:0}
@media (min-width:900px){#mk-track{top:96px;left:18px;width:168px}#mk-track .qh{font-size:14.5px}#mk-track .t{font-size:13.5px}}

#mk-track{width:182px;min-height:142px;max-height:none;padding:30px 16px 22px 28px;box-sizing:border-box;transform:perspective(380px) rotateY(22deg);background:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 156 142' preserveAspectRatio='none'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%23123a66' stop-opacity='.78'/><stop offset='.55' stop-color='%23061630' stop-opacity='.82'/><stop offset='1' stop-color='%230e3460' stop-opacity='.78'/></linearGradient></defs><path d='M15 1.5H148L154.5 8V40L151.5 44V128L144 140.5H23L17 134.5H7L1.5 129V61L4.5 57V12Z' fill='url(%23g)' stroke='%2388e6ff' stroke-width='1.7' vector-effect='non-scaling-stroke'/><path d='M18 7H144L148.5 11.5V125L141.5 135H24L11 128V60L9.5 58V17Z' fill='none' stroke='%2370d8ff' stroke-opacity='.6' stroke-width='1' vector-effect='non-scaling-stroke'/><path d='M24 134.5H70M148 22V36' stroke='%23c8f4ff' stroke-width='2' vector-effect='non-scaling-stroke'/></svg>") 0 0/100% 100% no-repeat;filter:drop-shadow(0 0 5px rgba(90,210,255,.75)) drop-shadow(0 0 14px rgba(60,170,255,.35));font-family:"Roboto Condensed","Arial Narrow","Segoe UI",Roboto,system-ui,sans-serif;font-stretch:condensed}
#mk-track::before,#mk-track::after{content:none;display:none}
#mk-track .ch span:first-child::before{font-size:12.5px;font-weight:400;letter-spacing:0;color:#d8f6ff}
#mk-track .ch{font-size:6px;color:#5fb8d8;opacity:.9}
#mk-track .qh{font-size:16.5px;font-weight:500;margin-top:14px;color:#e8fbff}
#mk-track .t{font-size:14px;font-weight:400;margin-top:1px;color:#e8fbff;letter-spacing:-.01em}
#mk-track{padding-right:14px;padding-left:28px}
#mk-track.c{min-height:0;padding:9px 14px 9px 18px}
@media (min-width:900px){#mk-track{top:96px;left:18px;width:196px;min-height:150px}}

@font-face{font-family:"MK Oswald";font-style:normal;font-weight:300 600;font-display:swap;src:url(assets/fonts/oswald-cyr.woff2) format("woff2");unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}
@font-face{font-family:"MK Oswald";font-style:normal;font-weight:300 600;font-display:swap;src:url(assets/fonts/oswald-lat.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
#mk-track{width:194px;font-family:"MK Oswald","Roboto Condensed","Arial Narrow",sans-serif;font-stretch:normal}
#mk-track .ch span:first-child::before{font-weight:400;font-size:12.5px;letter-spacing:.03em}
#mk-track .qh{font-weight:500;font-size:16.5px;letter-spacing:.02em}
#mk-track .t{font-weight:300;font-size:14.5px;letter-spacing:.01em}
@media (min-width:900px){#mk-track{width:208px}}
#mk-cap{display:none}
#mk-top{padding-left:0;overflow:visible}
#mk-ring{width:54px;height:54px;margin:-9px 0 -9px -7px;z-index:1;background:radial-gradient(circle at 50% 32%,#1d3168,#0b1530 68%);box-shadow:0 0 0 2.5px #f0cf7a,0 0 0 4.5px #a8721e,0 0 0 5.5px rgba(255,236,180,.55),0 0 14px rgba(200,145,42,.65),0 3px 8px rgba(0,0,0,.55)}
#mk-ring b{font-family:"MK Oswald",sans-serif;font-size:21px;font-weight:500;color:#fff;text-shadow:0 1px 2px #000}
#mk-ring b small{font-family:"MK Oswald",sans-serif;font-size:9.5px;font-weight:500;letter-spacing:.1em;color:#f3d58a;margin-bottom:0}
#mk-capline{display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;color:#6b4a14;margin:-4px 0 8px}
#mk-capline .b{flex:1;height:6px;border-radius:3px;background:rgba(107,74,20,.18);overflow:hidden}#mk-capline .b i{display:block;height:100%;background:linear-gradient(90deg,#e9b448,#ffd77a)}
#mk-map{border-radius:16px;border:2.5px solid #e2b553;background:radial-gradient(ellipse at 50% 18%,rgba(255,255,255,.38),transparent 46%),radial-gradient(circle at 50% 60%,#8a5a2c,#5a3516 62%,#3a210c);box-shadow:0 0 0 1.5px #7a4f12,0 0 0 3px rgba(255,226,150,.35),inset 0 2px 1px rgba(255,240,200,.5),inset 0 -4px 6px rgba(0,0,0,.45),0 5px 10px rgba(0,0,0,.55),0 0 12px rgba(200,145,42,.5);color:#fff1cf;text-shadow:0 1px 1px #000}
#mk-map svg{filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))}
body.game #jump{background:radial-gradient(ellipse at 50% 20%,rgba(255,255,255,.35),transparent 42%),radial-gradient(circle at 50% 42%,#25408a,#0f1d48 62%,#081030);border:3.5px solid #e9c46a;box-shadow:0 0 0 2px #8a5a14,0 0 0 4px #f3d58a,0 0 0 5px rgba(110,72,16,.9),inset 0 3px 2px rgba(255,255,255,.35),inset 0 -6px 10px rgba(0,0,0,.55),0 0 20px rgba(103,215,240,.7),0 7px 14px rgba(0,0,0,.6)}
body.game #jump b{font-family:"MK Oswald",sans-serif;font-weight:600;font-size:17px;letter-spacing:.08em}


`;
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function makeHUD(t) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  document.body.classList.add('game');
  const root = document.createElement('div'); root.id = 'mk-root';
  root.innerHTML = `
  <div id="mk-top" class="mk-glass mk-space pe">
    <div id="mk-ring"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="none" stroke="rgba(103,215,240,.18)" stroke-width="3.5"/><circle id="mk-ringp" cx="20" cy="20" r="17" fill="none" stroke="url(#mkg)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="106.8" stroke-dashoffset="106.8"/><defs><linearGradient id="mkg"><stop offset="0" stop-color="#67d7f0"/><stop offset="1" stop-color="#ffd77a"/></linearGradient></defs></svg><b><small>${esc(t('level'))}</small><span id="mk-lv">1</span></b></div>
    <div id="mk-pts"><div class="v"><span class="st">⭐</span><span id="mk-pv">0</span></div><div id="mk-cap"><div id="mk-capbar"><i></i></div><span id="mk-capt">0/300</span></div></div>
    <div id="mk-cry"><div class="v"><svg viewBox="0 0 16 20"><path d="M8 0 L14 6 L12 17 L8 20 L4 17 L2 6 Z" fill="#2a7bff"/><path d="M8 0 L14 6 L8 8 Z" fill="#9fe6ff"/><path d="M8 0 L2 6 L8 8 Z" fill="#5fb4ff"/><path d="M8 8 L12 17 L8 20 Z" fill="#1d4fd6"/><path d="M8 8 L4 17 L8 20 Z" fill="#3f8cff"/></svg><span id="mk-cv">0</span></div></div>
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
  <button id="mk-map" class="pe" aria-label="map"><svg viewBox="0 0 36 34"><path d="M3 6 L12 3 L24 7 L33 4 L33 28 L24 31 L12 27 L3 30 Z" fill="#e9d3a0" stroke="#8a5c12" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 3 L12 27 M24 7 L24 31" stroke="#b08a48" stroke-width="1.2"/><path d="M6 22 Q11 14 17 18 T29 10" fill="none" stroke="#C8912A" stroke-width="1.8" stroke-dasharray="2.5 2"/><path d="M27 8 l4 4 m0 -4 l-4 4" stroke="#c0392b" stroke-width="1.8"/><circle cx="7" cy="22" r="1.8" fill="#1f7fa0"/></svg><span id="mk-mapl">MAP</span></button>
  <button id="mk-auto" class="pe">⏩ AUTO</button>
  <div id="mk-toasts"></div>
  <div id="mk-pop" class="mk-glass pe"></div>
  <div id="mk-scrim" class="pe"></div>
  <div id="mk-fade"></div>
  <div id="mk-sheet" class="mk-glass pe"><div class="grab"></div><div class="hd"><div class="tabs"><button data-tab="ch" class="on">${esc(t('chapter'))}</button><button data-tab="daily">${esc(t('daily'))}</button></div><button class="x" aria-label="${esc(t('close'))}">×</button></div><div id="mk-capline">⭐ <span id="mk-capt2">0/300</span><div class="b"><i></i></div></div><div class="sub"></div><div class="list"></div></div>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s); { const j = document.getElementById('jump'); if (j) j.innerHTML = '<svg viewBox="0 0 92 92"><g fill="none" stroke-linejoin="round"><rect x="16" y="22" width="14" height="42" rx="7" fill="#d8c08a" stroke="#6e4810" stroke-width="2"/><rect x="62" y="22" width="14" height="42" rx="7" fill="#d8c08a" stroke="#6e4810" stroke-width="2"/><path d="M18 30 h10 M18 38 h10 M64 30 h10 M64 38 h10" stroke="#8a5c12" stroke-width="1.6"/><path d="M28 18 Q46 10 64 18 L66 60 Q46 70 26 60 Z" fill="#1c3a78" stroke="#C8912A" stroke-width="2.5"/><path d="M34 58 L36 70 L56 70 L58 58" fill="#9aa6b8" stroke="#6e4810" stroke-width="2"/><ellipse cx="46" cy="70" rx="10" ry="3" fill="#a8f0ff" stroke="#67d7f0" stroke-width="1.5"/></g></svg><b>JET</b><i class="fl"></i>'; } $('#mk-mapl').textContent = t('map') === 'map' ? 'MAP' : t('map'); $('#mk-map').addEventListener('click', () => H.onMap ? H.onMap() : H.toast && H.toast('🗺️ ' + (t('mapSoon') === 'mapSoon' ? '…' : t('mapSoon'))));
  for (const el of root.querySelectorAll('.pe')) for (const ev of ['pointerdown', 'touchstart', 'wheel']) el.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  const H = {
    root, $,
    setTop({ level, xp, need, points, earned, cap, cry = 0 }) {
      $('#mk-lv').textContent = level; $('#mk-ringp').setAttribute('stroke-dashoffset', (106.8 * (1 - Math.min(1, xp / need))).toFixed(1));
      $('#mk-pv').textContent = points.toLocaleString('ru-RU'); $('#mk-cv').textContent = (cry | 0).toLocaleString('ru-RU'); $('#mk-capt').textContent = `${earned}/${cap} ${t('today')}`; $('#mk-capbar i').style.width = Math.min(100, earned / cap * 100) + '%'; $('#mk-capt2').textContent = `${earned}/${cap} ${t('today')}`; $('#mk-capline .b i').style.width = Math.min(100, earned / cap * 100) + '%';
    },
    setTrack(html) { const el = $('#mk-track'); if (el._h !== html) { el.innerHTML = html.replace(/(<div class="t">)/, `<div class="qh"><span>${esc(t('mapQuest'))}:</span></div>$1`); el._h = html; const n = [...el.querySelectorAll('.row span')].map(x => x.textContent).find(x => /^\d+\/\d+$/.test(x.trim())); const qh = el.querySelector('.qh'); if (n && qh) qh.insertAdjacentHTML('beforeend', `<span class="qn">${esc(n)}</span>`); } if (!el._tap) { el._tap = 1; el.addEventListener('click', () => el.classList.toggle('x')); } },
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
