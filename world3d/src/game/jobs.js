import * as THREE from 'three';
// ============================================================================================
// Robot jobs: reusable "work that takes real time" system for every robot type.
//
//   makeProgressLabel(scene)  - compact world-space label that floats above the work site:
//                               "47% · 1:03" + stage name + thin bar. One sprite, constant screen size,
//                               never covers the screen, redraws its canvas only when the text changes.
//   makeRobotJob(opts)        - job clock split into weighted stages. Each stage has a work spot the robot
//                               walks to, and a 0..1 local progress the site uses to reveal itself piece by piece.
//
// Chapter 1 uses it for the BUILDER (storage module: foundation → frame → panels → dome → lights, ~2 min).
// Chapter 2 plan (same API, only the stage list + the site visual change):
//   GEOLOGIST      stages: survey → drill → core samples → analysis; site = drill rig whose mast rises, cores pop out.
//   ARCHAEOLOGIST  stages: grid → dig → brush → lift relic; site = dig pit whose depth/relic reveal follows stageT.
//   ENGINEER       stages: diagnose → open panel → repair → test; site = machine whose panels open / lights recover.
//   Each robot module just does:
//     const job = makeRobotJob({ duration, stages, label: makeProgressLabel(scene), anchor, labelHeight,
//                                onStage: (s, i) => robot.goTo(s.spot), onDone: () => reward() });
//     per frame: job.update(dt); site.setStage(job.value); robot anim = job.walking ? 'walk' : 'work';
//   ?fast=1 keeps short durations so automated tests can skip the wait (pass a small duration).
// ============================================================================================
export const fmtTime = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function makeProgressLabel(scene, { accent = '#6fe7ff', size = 0.075 } = {}) {
  const W = 360, H = 108, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, sizeAttenuation: false });
  const sp = new THREE.Sprite(mat); sp.name = 'job_label'; sp.renderOrder = 20; sp.scale.set(size * W / H, size, 1); sp.center.set(0.5, 0); sp.visible = false; sp.frustumCulled = false; scene.add(sp);
  let last = '';
  const draw = (frac, left, title) => {
    const pct = Math.floor(frac * 100), txt = pct >= 100 ? '100% ✓' : pct + '% · ' + fmtTime(left), key = txt + '|' + title; if (key === last) return; last = key;
    g.clearRect(0, 0, W, H); const r = 22; g.fillStyle = 'rgba(8,14,24,0.72)'; g.beginPath(); g.moveTo(4 + r, 4); g.arcTo(W - 4, 4, W - 4, H - 4, r); g.arcTo(W - 4, H - 4, 4, H - 4, r); g.arcTo(4, H - 4, 4, 4, r); g.arcTo(4, 4, W - 4, 4, r); g.closePath(); g.fill(); g.strokeStyle = 'rgba(111,231,255,0.55)'; g.lineWidth = 2; g.stroke();
    g.textAlign = 'center'; g.fillStyle = '#9fb3c8'; g.font = '600 22px system-ui, -apple-system, sans-serif'; g.fillText(title || '', W / 2, 32);
    g.fillStyle = '#ffffff'; g.font = '700 36px system-ui, -apple-system, sans-serif'; g.fillText(txt, W / 2, 70);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(28, 84, W - 56, 6); g.fillStyle = accent; g.fillRect(28, 84, (W - 56) * Math.min(1, frac), 6);
    tex.needsUpdate = true; };
  return { sprite: sp,
    set(pos, frac, secsLeft, title) { sp.visible = true; sp.position.copy(pos); draw(frac, secsLeft, title); },
    hide() { sp.visible = false; },
    dispose() { scene.remove(sp); tex.dispose(); mat.dispose(); } };
}

// stages: [{ id, title, w (weight), spot: {x, z} }]. value = stage index + local progress (0..stages.length).
export function makeRobotJob({ duration, stages, label = null, anchor = null, labelHeight = 0, onStage = () => { }, onDone = () => { } }) {
  const tot = stages.reduce((a, s) => a + (s.w || 1), 0); let t = 0, idx = -1, finished = false; const pos = new THREE.Vector3();
  const job = { t: 0, frac: 0, value: 0, stage: null, index: -1, stageT: 0, stages, duration,
    update(dt) { if (finished) return job; t = Math.min(duration, t + dt); job.t = t; job.frac = t / duration;
      let acc = 0, f = job.frac * tot, i = 0; for (; i < stages.length - 1; i++) { const w = stages[i].w || 1; if (f < acc + w) break; acc += w; }
      job.stageT = Math.min(1, (f - acc) / (stages[i].w || 1)); job.value = job.frac >= 1 ? stages.length : i + job.stageT;
      if (i !== idx) { idx = i; job.index = i; job.stage = stages[i]; onStage(stages[i], i); }
      if (label && anchor) label.set(pos.set(anchor.x, anchor.y + labelHeight, anchor.z), job.frac, duration - t, stages[i].title || stages[i].id);
      if (job.frac >= 1) { finished = true; onDone(job); }
      return job; },
    get done() { return finished; },
    skip() { t = duration; return job.update(0); } };
  return job;
}
