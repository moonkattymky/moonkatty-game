import * as THREE from 'three';
// One 1024² texture atlas shared by ALL static architecture (hub + world) -> 1 draw call.
// Three canvases: albedo (sRGB, alpha used by lattice), emissive (sRGB), ORM (G=roughness, B=metalness).
const S = 1024;
export const EMISSIVE_INTENSITY = 5;
// pixel rects [x, y, w, h] (canvas coords, y down)
export const R = {
  ivory: [0, 0, 128, 128], gold: [128, 0, 128, 128], dark: [256, 0, 128, 128], glass: [384, 0, 128, 128],
  glow: [512, 0, 512, 128],
  domeCap: [0, 128, 1024, 256], domeWall: [0, 384, 1024, 128], reactorWall: [0, 512, 1024, 128],
  corridor: [0, 640, 1024, 96], rocket: [0, 736, 1024, 160],
  tower: [0, 896, 512, 128], lattice: [512, 896, 128, 128], panel: [640, 896, 192, 128], solar: [832, 896, 192, 128],
};
const GLOW_HUES = [['#ffb347', 'orange'], ['#67d7f0', 'cyan'], ['#ff5533', 'red'], ['#ffe08a', 'yellow'], ['#fff4e0', 'white'], ['#7af0c8', 'mint'], ['#ff7414', 'amber']];
const GLOW_ROWS = 8;
export function rectUV(name) { const [x, y, w, h] = R[name]; return [x / S, 1 - (y + h) / S, (x + w) / S, 1 - y / S]; } // u0,v0,u1,v1
export function swatchUV(name) { const [u0, v0, u1, v1] = rectUV(name); return [(u0 + u1) / 2, (v0 + v1) / 2]; }
const _c = new THREE.Color(), _h = {};
export function glowUV(color, intensity) {
  _c.set(color); const hsl = _c.getHSL(_h); let best = 0, bd = 1e9;
  GLOW_HUES.forEach(([hex], i) => { const o = new THREE.Color(hex).getHSL({}); let dh = Math.abs(o.h - hsl.h); dh = Math.min(dh, 1 - dh); const d = dh * 3 + Math.abs(o.s - hsl.s) * 0.6 + Math.abs(o.l - hsl.l) * 0.8; if (d < bd) { bd = d; best = i; } });
  const lvl = THREE.MathUtils.clamp(intensity * Math.max(_c.r, _c.g, _c.b) / EMISSIVE_INTENSITY, 0.02, 1);
  const row = THREE.MathUtils.clamp(Math.round(lvl * (GLOW_ROWS - 1)), 0, GLOW_ROWS - 1);
  const [x, y, w, h] = R.glow; const cw = w / GLOW_HUES.length, rh = h / GLOW_ROWS;
  return [(x + cw * (best + 0.5)) / S, 1 - (y + rh * (row + 0.5)) / S];
}

export function makeAtlas() {
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const A = mk(), E = mk(), M = mk(); const a = A.getContext('2d'), e = E.getContext('2d'), m = M.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, S, S); m.fillStyle = 'rgb(0,128,5)'; m.fillRect(0, 0, S, S);
  const orm = (r, mt) => `rgb(0,${Math.round(r * 255)},${Math.round(mt * 255)})`;
  // paint helper: albedo, emissive, rough, metal
  const P = (x, y, w, h, alb, emi = null, rough = 0.5, metal = 0.02) => { a.fillStyle = alb; a.fillRect(x, y, w, h); e.fillStyle = emi || '#000'; e.fillRect(x, y, w, h); m.fillStyle = orm(rough, metal); m.fillRect(x, y, w, h); };
  const GOLD = '#e9bd58', GOLD2 = '#f3d58e', GOLDD = '#b8873c', IV = '#dcdde0', IVL = '#b6b9bf', IVD = '#9a9ea6';
  const gold = (x, y, w, h, c = GOLD) => P(x, y, w, h, c, null, 0.28, 0.95);
  const win = (x, y, w, h, frame = 2) => { gold(x - frame, y - frame, w + frame * 2, h + frame * 2); const g = a.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#ffcf7a'); g.addColorStop(1, '#d0782a'); a.fillStyle = g; a.fillRect(x, y, w, h); const ge = e.createLinearGradient(0, y, 0, y + h); ge.addColorStop(0, '#b07a40'); ge.addColorStop(1, '#94501e'); e.fillStyle = ge; e.fillRect(x, y, w, h); m.fillStyle = orm(0.2, 0.0); m.fillRect(x, y, w, h); };
  const lines = (x, y, w, h, stepX, stepY, col = IVL, lw = 2, stagger = false) => { a.fillStyle = col; if (stepY) for (let yy = y; yy < y + h; yy += stepY) a.fillRect(x, yy, w, lw); if (stepX) for (let yy = y, row = 0; yy < y + h; yy += (stepY || h), row++) for (let xx = x + (stagger && row % 2 ? stepX / 2 : 0); xx < x + w; xx += stepX) a.fillRect(xx, yy, lw, Math.min(stepY || h, y + h - yy)); };
  // solids
  P(...R.ivory, '#ffffff', null, 0.48, 0.02); P(...R.gold, '#ffffff', null, 0.28, 0.93); P(...R.dark, '#ffffff', null, 0.75, 0.15); P(...R.glass, '#ffffff', null, 0.1, 0.3);
  // glow ramp (albedo dim, emissive rows from dark to full)
  { const [x, y, w, h] = R.glow; const cw = w / GLOW_HUES.length, rh = h / GLOW_ROWS;
    GLOW_HUES.forEach(([hex], i) => { for (let r = 0; r < GLOW_ROWS; r++) { const lin = (r + 0.5) / GLOW_ROWS; const c = new THREE.Color(hex); const k = Math.max(0.0001, lin); const ce = new THREE.Color(c.r * k, c.g * k, c.b * k); // linear
      P(Math.floor(x + cw * i), y + rh * r, Math.ceil(cw), rh, '#' + new THREE.Color(c.r * 0.25, c.g * 0.25, c.b * 0.25).getHexString(), '#' + ce.getHexString(), 0.95, 0); } }); }
  // dome cap (concept: soft grey-beige shell, subtle segmented panels, thin gold band near the base, no vertical gold ribs)
  { const [x, y, w, h] = R.domeCap; P(x, y, w, h, IV, null, 0.5, 0.02);
    const g = a.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,250,240,0.18)'); g.addColorStop(1, 'rgba(90,82,70,0.12)'); a.fillStyle = g; a.fillRect(x, y, w, h);
    const seam = (sx, sy, sw, sh) => { a.fillStyle = '#857a66'; a.fillRect(sx, sy, sw, sh); a.fillStyle = 'rgba(255,250,238,0.55)'; if (sw > sh) a.fillRect(sx, sy + sh, sw, 1); else a.fillRect(sx + sw, sy, 1, sh); }; // dark groove + lit bevel edge (reads at distance after mipmapping)
    for (let b = 0; b < 7; b++) { const y0 = y + 26 + b * 30; seam(x, y0, w, 3); for (let xx = (b % 2) * 42; xx < w; xx += 85) seam(x + xx, y0, 3, 30); }
    for (let k = 0; k < 12; k++) seam(x + k * 85 + 20, y + 16, 4, h - 16); // main segment seams
    gold(x, y, w, 12, GOLDD); gold(x, y + h - 30, w, 8, GOLD); gold(x, y + h - 10, w, 10, GOLDD);
    for (let k = 0; k < 24; k++) win(x + k * 42.6 + 14, y + h - 50, 12, 9, 2); /* lit porthole ring low on the cap */
    gold(x, y + h - 58, w, 3, GOLD2); }
  // dome wall (short base ring with small warm windows + darker plinth)
  { const [x, y, w, h] = R.domeWall; P(x, y, w, h, IV, null, 0.5, 0.02); lines(x, y, w, h, 85, 0, IVL, 2);
    gold(x, y, w, 8, GOLD); a.fillStyle = '#6b6658'; a.fillRect(x, y + h - 26, w, 26); gold(x, y + h - 30, w, 5, GOLDD);
    for (let k = 0; k < 32; k++) win(x + k * 32 + 9, y + 34, 13, 20, 2); for (let k = 0; k < 32; k++) win(x + k * 32 + 13, y + 70, 6, 8, 1); }
  // reactor wall
  { const [x, y, w, h] = R.reactorWall; P(x, y, w, h, IV, null, 0.45, 0.02); a.fillStyle = IVL; a.fillRect(x, y + 24, w, 2); a.fillRect(x, y + 98, w, 2);
    gold(x, y, w, 8); gold(x, y + h - 10, w, 10, GOLDD);
    for (let k = 0; k < 24; k++) { const xx = x + k * (w / 24); gold(xx, y, 6, h, GOLDD); for (const cx of [xx + 14, xx + 34]) { const cy = y + 62; const el = (ctx, c, rx, ry) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill(); }; el(a, GOLD, 7, 17); el(a, '#e8b468', 4.8, 11.5); el(e, '#7a4f24', 4.8, 11.5); m.fillStyle = orm(0.2, 0); m.beginPath(); m.ellipse(cx, cy, 4.8, 11.5, 0, 0, 7); m.fill(); } } }
  // corridor segment (u around, v along)
  { const [x, y, w, h] = R.corridor; P(x, y, w, h, IV, null, 0.45, 0.02);
    for (let k = 0; k < 6; k++) { const yy = y + 8 + k * 13.3; const g = a.createLinearGradient(0, yy, 0, yy + 13); g.addColorStop(0, '#f1e6cf'); g.addColorStop(0.45, IV); g.addColorStop(1, '#a8977a'); a.fillStyle = g; a.fillRect(x, yy, w, 13); }
    gold(x, y, w, 8); gold(x, y + h - 8, w, 8); gold(x, y + h / 2 - 2, w, 4, GOLD2); for (const u of [0.125, 0.375, 0.625, 0.875]) win(x + u * w - 16, y + 30, 32, 36, 3); }
  // rocket (u around, v along; nose at top of region)
  { const [x, y, w, h] = R.rocket; P(x, y, w, h, IV, null, 0.4, 0.02);
    const Y = v => y + (1 - v) * h; // v 0..1 bottom->top
    for (let k = 0; k < 8; k++) { a.fillStyle = IVL; a.fillRect(x + k * 128, y, 2, h); }
    for (let i = 1; i < 16; i++) { a.fillStyle = IVL; a.fillRect(x, Y(i / 16), w, 1); }
    for (const [v, t] of [[0.2, 5], [0.86, 7], [0.04, 8]]) gold(x, Y(v) - t / 2, w, t);
    gold(x, y, w, 10, GOLD2); // nose tip
    for (const u of [0.125, 0.375, 0.625, 0.875]) { const cx = x + u * w, cy = Y(0.7); const el = (c, rx, ry, ctx) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill(); };
      el(GOLD, 84, 12, a); el(orm(0.28, 0.95), 84, 12, m); el('#ffcf7a', 62, 8.5, a); el('#c08848', 62, 8.5, e); el('#fff0c8', 22, 3, a); }
    a.save(); a.fillStyle = GOLDD; a.font = 'bold 20px sans-serif'; a.translate(x + w * 0.25, Y(0.5)); a.rotate(-Math.PI / 2); a.fillText('MK-01 ALPHA', -60, 7); a.restore(); }
  // tower segment (8 sides around)
  { const [x, y, w, h] = R.tower; P(x, y, w, h, IV, null, 0.45, 0.02); for (let k = 0; k < 8; k++) { a.fillStyle = IVL; a.fillRect(x + k * w / 8, y, 2, h); win(x + k * w / 8 + 22, y + 36, 20, 50, 2); }
    a.strokeStyle = GOLDD; a.lineWidth = 2; for (let k = 0; k < 8; k++) { const x0 = x + k * w / 8 + 3; a.beginPath(); a.moveTo(x0, y + 12); a.lineTo(x0 + 16, y + 34); a.moveTo(x0 + 16, y + 12); a.lineTo(x0, y + 34); a.moveTo(x0 + 46, y + 90); a.lineTo(x0 + 60, y + 116); a.moveTo(x0 + 60, y + 90); a.lineTo(x0 + 46, y + 116); a.stroke(); } /* filigree bracing */
    gold(x, y, w, 10); gold(x, y + h - 8, w, 8, GOLDD); }
  // lattice (alpha)
  { const [x, y, w, h] = R.lattice; a.clearRect(x, y, w, h); a.strokeStyle = '#efe7d6'; a.lineWidth = 9; a.strokeRect(x + 5, y + 5, w - 10, h - 10); a.lineWidth = 7; a.beginPath(); a.moveTo(x + 6, y + 6); a.lineTo(x + w - 6, y + h - 6); a.moveTo(x + w - 6, y + 6); a.lineTo(x + 6, y + h - 6); a.stroke(); a.lineWidth = 3; a.strokeStyle = '#e9bd58'; a.beginPath(); a.moveTo(x + w / 2, y + 8); a.lineTo(x + w - 8, y + h / 2); a.lineTo(x + w / 2, y + h - 8); a.lineTo(x + 8, y + h / 2); a.closePath(); a.moveTo(x + 8, y + h / 2); a.lineTo(x + w - 8, y + h / 2); a.stroke(); /* inner diamond + mid rail: filigree gantries */
    a.fillStyle = GOLD; for (const [px, py] of [[8, 8], [w - 8, 8], [8, h - 8], [w - 8, h - 8], [w / 2, h / 2]]) { a.beginPath(); a.arc(x + px, y + py, 7, 0, 7); a.fill(); }
    m.fillStyle = orm(0.4, 0.4); m.fillRect(x, y, w, h); }
  // generic panel facade + solar cells
  { const [x, y, w, h] = R.panel; P(x, y, w, h, IV, null, 0.5, 0.02); lines(x, y, w, h, 48, 32, IVL, 2, true); gold(x, y, w, 6); for (let k = 0; k < 4; k++) win(x + 10 + k * 46, y + 50, 28, 26, 2); }
  { const [x, y, w, h] = R.solar; P(x, y, w, h, '#18375a', null, 0.25, 0.5); a.fillStyle = '#9fb3c8'; for (let k = 0; k <= 8; k++) { a.fillRect(x + k * w / 8, y, 2, h); a.fillRect(x, y + k * h / 8, w, 2); } }
  // pass 41: decals + lights painted into the shared atlas (zero geometry / draw calls): paw + moon emblems, warm LED strips, window light spill, subtle grime
  { const rr = (() => { let q = 41; return () => (q = (q * 16807) % 2147483647) / 2147483647; })();
    const paw = (ctx, cx, cy, s, sx, col) => { ctx.save(); ctx.translate(cx, cy); ctx.scale(sx, 1); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, s * 0.28, s * 0.42, s * 0.34, 0, 0, 7); ctx.fill();
      for (const [tx, ty, tr] of [[-0.42, -0.12, 0.15], [-0.16, -0.38, 0.16], [0.16, -0.38, 0.16], [0.42, -0.12, 0.15]]) { ctx.beginPath(); ctx.ellipse(tx * s, ty * s, tr * s, tr * s * 1.2, 0, 0, 7); ctx.fill(); } ctx.restore(); };
    const moon = (ctx, cx, cy, r, sx, col) => { ctx.save(); ctx.translate(cx, cy); ctx.scale(sx, 1); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.arc(r * 0.42, -r * 0.18, r * 0.86, 0, 7, true); ctx.fill('evenodd'); ctx.restore(); };
    const badge = (cx, cy, rad, sx, kind) => { a.save(); a.translate(cx, cy); a.scale(sx, 1); a.fillStyle = GOLDD; a.beginPath(); a.arc(0, 0, rad + 3, 0, 7); a.fill(); a.fillStyle = '#efe6d2'; a.beginPath(); a.arc(0, 0, rad, 0, 7); a.fill(); a.restore();
      m.save(); m.translate(cx, cy); m.scale(sx, 1); m.fillStyle = orm(0.28, 0.95); m.beginPath(); m.arc(0, 0, rad + 3, 0, 7); m.fill(); m.fillStyle = orm(0.45, 0.02); m.beginPath(); m.arc(0, 0, rad, 0, 7); m.fill(); m.restore();
      e.save(); e.translate(cx, cy); e.scale(sx, 1); e.strokeStyle = '#6a4418'; e.lineWidth = 1.5; e.beginPath(); e.arc(0, 0, rad + 1.5, 0, 7); e.stroke(); e.restore(); /* faint lit rim */
      if (kind === 'paw') paw(a, cx, cy + 1, rad * 1.1, sx, GOLD); else moon(a, cx, cy, rad * 0.78, sx, GOLD); };
    const spill = (cx, cy, rx, ry, k) => { const g = e.createRadialGradient(cx, cy, 0, cx, cy, ry); g.addColorStop(0, `rgba(120,70,28,${k})`); g.addColorStop(1, 'rgba(120,70,28,0)'); e.save(); e.globalCompositeOperation = 'lighter'; e.translate(cx, cy); e.scale(rx / ry, 1); e.translate(-cx, -cy); e.fillStyle = g; e.fillRect(cx - ry, cy - ry, ry * 2, ry * 2); e.restore(); };
    const led = (x, y, w, h, col = '#c8843c') => { a.fillStyle = '#ffe2a8'; a.fillRect(x, y, w, h); e.fillStyle = col; e.fillRect(x, y, w, h); m.fillStyle = orm(0.2, 0); m.fillRect(x, y, w, h); };
    const grime = (x, y, w, h, k) => { const g = a.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(60,52,40,0)'); g.addColorStop(1, `rgba(60,52,40,${k})`); a.fillStyle = g; a.fillRect(x, y, w, h);
      for (let i = 0; i < w / 6; i++) { const sx = x + rr() * w, sw = 1 + rr() * 3, sh = h * (0.3 + rr() * 0.7); a.fillStyle = `rgba(70,60,46,${(0.04 + rr() * 0.07).toFixed(3)})`; a.fillRect(sx, y + h - sh, sw, sh); } };
    { const [x, y, w, h] = R.domeWall; grime(x, y + 56, w, h - 86, 0.16);
      for (let k = 0; k < 32; k++) { spill(x + k * 32 + 15.5, y + 44, 10, 20, 0.6); spill(x + k * 32 + 16, y + 74, 6, 10, 0.4); }
      for (let k = 0; k < 4; k++) { const cx = x + k * 256 + 128 + 7; a.fillStyle = IV; a.fillRect(cx - 24, y + 28, 48, 54); e.fillStyle = '#000'; e.fillRect(cx - 24, y + 28, 48, 54); m.fillStyle = orm(0.5, 0.02); m.fillRect(cx - 24, y + 28, 48, 54); badge(cx, y + 54, 17, 0.62, k % 2 ? 'moon' : 'paw'); }
      led(x, y + h - 34, w, 2); for (let k = 0; k < 64; k++) led(x + k * 16 + 6, y + h - 16, 4, 3, '#a8662c'); }
    { const [x, y, w, h] = R.reactorWall; grime(x, y + 70, w, h - 80, 0.14); led(x, y + 101, w, 2); led(x, y + 10, w, 2, '#a8662c');
      for (let k = 0; k < 24; k++) { const xx = x + k * (w / 24); for (const cx of [xx + 14, xx + 34]) spill(cx, y + 62, 11, 28, 0.5); } }
    { const [x, y, w, h] = R.corridor; grime(x, y + 60, w, 28, 0.12); for (let k = 0; k < 32; k++) led(x + k * 32 + 14, y + h / 2 - 1, 5, 2); for (const u of [0.125, 0.375, 0.625, 0.875]) spill(x + u * w, y + 48, 28, 28, 0.45); }
    { const [x, y, w, h] = R.domeCap; for (let k = 0; k < 12; k++) { const sx = x + k * 85 + 22; for (let j = 0; j < 3; j++) { const g = a.createLinearGradient(0, y + 30 + j * 60, 0, y + 90 + j * 60); g.addColorStop(0, 'rgba(70,60,46,0.10)'); g.addColorStop(1, 'rgba(70,60,46,0)'); a.fillStyle = g; a.fillRect(sx - 2 + rr() * 30, y + 30 + j * 60, 2 + rr() * 3, 60); } } }
    { const [x, y, w, h] = R.panel; badge(x + w - 30, y + 98, 18, 1.0, 'paw'); a.fillStyle = GOLDD; a.font = 'bold 15px sans-serif'; a.fillText('BASE ALPHA', x + 10, y + 104); led(x, y + 8, w, 2); grime(x, y + 80, w, 48, 0.12); }
  }
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; return t; };
  return { map: tex(A, true), emissiveMap: tex(E, true), ormMap: tex(M, false), canvases: { A, E, M } };
}
