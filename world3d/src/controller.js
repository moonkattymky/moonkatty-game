import * as THREE from 'three';
import { groundAt } from './terrain.js';

// Third-person controller: WASD/arrows + touch joystick, jetpack on Space/button, orbit camera.
export class Controller {
  constructor(camera, dom, colliders) {
    this.cam = camera; this.dom = dom; this.colliders = colliders;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.onGround = true;
    this.fuel = 1; this.thrusting = false; this.keys = new Set(); this.joy = new THREE.Vector2(); this.jumpHeld = false; this._jumpPrev = false;
    this.speedMul = 1; /* game ?fast=1 test aid; 1 = normal controls */ this.camYaw = 0; this.camPitch = 0.28; this.camDist = 7.5; this.camTarget = new THREE.Vector3(); this.enabled = true; this.camFree = true; this.camShift = 0; /* lateral framing offset (m, camera-right); 0 = cat centred */
    addEventListener('keydown', e => { this.keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    // orbit by drag
    let drag = null;
    dom.addEventListener('pointerdown', e => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; dom.setPointerCapture(e.pointerId); });
    dom.addEventListener('pointermove', e => { if (!drag || drag.id !== e.pointerId) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; this.camYaw -= dx * 0.006; this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.004, -0.15, 1.3); });
    dom.addEventListener('pointerup', () => drag = null); dom.addEventListener('pointercancel', () => drag = null);
    dom.addEventListener('wheel', e => { this.camDist = THREE.MathUtils.clamp(this.camDist * (1 + Math.sign(e.deltaY) * 0.1), 3, 40); e.preventDefault(); }, { passive: false });
  }
  bindTouch(joyEl, knobEl, jumpEl) {
    let id = null, cx = 0, cy = 0; const R = 55;
    const move = e => { const dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.min(R, Math.hypot(dx, dy)); const a = Math.atan2(dy, dx); const kx = Math.cos(a) * l, ky = Math.sin(a) * l; knobEl.style.transform = `translate(${kx}px,${ky}px)`; this.joy.set(kx / R, -ky / R); };
    joyEl.addEventListener('pointerdown', e => { id = e.pointerId; const r = joyEl.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; joyEl.setPointerCapture(id); move(e); e.stopPropagation(); });
    joyEl.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    const end = e => { if (e.pointerId !== id) return; id = null; this.joy.set(0, 0); knobEl.style.transform = ''; };
    joyEl.addEventListener('pointerup', end); joyEl.addEventListener('pointercancel', end);
    jumpEl.addEventListener('pointerdown', e => { this.jumpHeld = true; jumpEl.setPointerCapture(e.pointerId); e.stopPropagation(); });
    const je = () => this.jumpHeld = false; jumpEl.addEventListener('pointerup', je); jumpEl.addEventListener('pointercancel', je);
  }
  // spawn / teleport / respawn: the requested spot is pushed to the nearest free one (never inside a rock, cliff or prop) and the cat stands on whatever is under it
  place(x, z, yaw, resolve = true) { const S = this.solids; if (S && resolve) { const f = S.nearestFree(x, z); x = f.x; z = f.z; this.lastPlaceMove = f.moved; }
    this.pos.set(x, S ? S.standAt(x, z) : groundAt(x, z), z); this.vel.set(0, 0, 0); this.onGround = true; this.yaw = yaw; this.camYaw = yaw + Math.PI; this.camTarget.copy(this.pos).add(new THREE.Vector3(0, 1.3, 0)); }
  floorAt(x, z, y) { return this.solids ? this.solids.floorAt(x, z, y) : groundAt(x, z); }
  // horizontal move with world collision (rocks, cliffs, buildings, rovers, rockets, pylons, crates, fences...): a cell column rising more than a
  // step above the feet blocks, as does any overhead slab overlapping the capsule (jetpack flight too); when blocked the move is turned along
  // the obstacle (slide / go around), lower solids are stepped onto. Moves that leave an overlapping spot are always allowed (never trapped).
  _hit(x, z, footY) { const S = this.solids, C = S.CAT; return S.top(x, z, C.rb) > footY + C.step || S.slabHit(x, z, footY + 0.05, footY + 1.45) < Infinity; }
  moveXZ(dx, dz, footY) { const S = this.solids, p = this.pos; if (!S) { p.x += dx; p.z += dz; return false; }
    const L = Math.hypot(dx, dz); if (L < 1e-6) return false; const n = Math.max(1, Math.ceil(L / 0.2)); const sx = dx / n, sz = dz / n; let bumped = false;
    for (let i = 0; i < n; i++) { if (!this._hit(p.x + sx, p.z + sz, footY) || this._hit(p.x, p.z, footY)) { p.x += sx; p.z += sz; continue; }
      bumped = true; let ok = false;
      for (const a of [0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4]) { const c = Math.cos(a), s = Math.sin(a); const tx = (sx * c - sz * s) * c, tz = (sx * s + sz * c) * c; if (!this._hit(p.x + tx, p.z + tz, footY)) { p.x += tx; p.z += tz; ok = true; break; } }
      if (!ok) break; }
    if (bumped) { const vx = this.vel.x, vz = this.vel.z; const mx = p.x - this._px, mz = p.z - this._pz, ml = Math.hypot(mx, mz); if (ml > 1e-5) { const k = (vx * mx + vz * mz) / (ml * ml); this.vel.x = mx * Math.max(0, k); this.vel.z = mz * Math.max(0, k); } else { this.vel.x = 0; this.vel.z = 0; } }
    this.bumped = bumped; return bumped; }
  update(dt) {
    const k = this.keys; let ix = this.joy.x, iy = this.joy.y;
    if (k.has('KeyW') || k.has('ArrowUp')) iy += 1; if (k.has('KeyS') || k.has('ArrowDown')) iy -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) ix += 1; if (k.has('KeyA') || k.has('ArrowLeft')) ix -= 1;
    const il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
    const run = k.has('ShiftLeft') || k.has('ShiftRight') || Math.hypot(this.joy.x, this.joy.y) > 0.95;
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw), rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
    const mx = rx * ix + fx * iy, mz = rz * ix + fz * iy; const speed = (run ? 9 : 5) * this.speedMul * Math.min(1, Math.hypot(ix, iy) * 1.2);
    const ml = Math.hypot(mx, mz) || 1; const tx = mx / ml * speed, tz = mz / ml * speed;
    const acc = this.onGround ? 10 : 3; this.vel.x += (tx - this.vel.x) * Math.min(1, acc * dt); this.vel.z += (tz - this.vel.z) * Math.min(1, acc * dt);
    const jump = this.jumpHeld || k.has('Space');
    if (jump && !this._jumpPrev && this.onGround) { this.vel.y = 6.5; this.onGround = false; }
    this.thrusting = false;
    if (jump && !this.onGround && this.fuel > 0 && this.vel.y < 6) { this.vel.y += 24 * dt; this.fuel = Math.max(0, this.fuel - dt * 0.4 / (this.fuelMul || 1)); this.thrusting = true; }
    this._jumpPrev = jump;
    this.vel.y -= 11 * dt;
    const footY = this.pos.y; this.pos.y += this.vel.y * dt;
    if (this.solids && this.vel.y > 0) { const lo = this.solids.slabHit(this.pos.x, this.pos.z, footY + 1.45, this.pos.y + 1.45, this.solids.CAT.rs); if (lo < Infinity) { this.pos.y = Math.max(footY, lo - 1.46); this.vel.y = 0; } } // jetpack / jump: head stops under overhangs
    this._px = this.pos.x; this._pz = this.pos.z; this.moveXZ(this.vel.x * dt, this.vel.z * dt, Math.max(footY, this.pos.y));
    for (const c of this.colliders) { if (c.walk) continue; const dx = this.pos.x - c.x, dz = this.pos.z - c.z, d = Math.hypot(dx, dz), r = c.r + 0.45; if (d < r && d > 1e-4 && this.pos.y < groundAt(c.x, c.z) + (c.h || 8)) { this.pos.x = c.x + dx / d * r; this.pos.z = c.z + dz / d * r; this.bumped = true; } }
    const rr = Math.hypot(this.pos.x, this.pos.z); if (rr > 1050) { this.pos.x *= 1050 / rr; this.pos.z *= 1050 / rr; }
    const g = this.floorAt(this.pos.x, this.pos.z, Math.max(footY, this.pos.y));
    if (this.pos.y < g - 3) { this.place(this.pos.x, this.pos.z, this.yaw); return; } // safety respawn: never left buried (nearest free spot)
    if (this.pos.y <= g) { this.pos.y = g; if (this.vel.y < 0) this.vel.y = 0; this.onGround = true; } else if (this.pos.y > g + 0.05) this.onGround = false;
    if (this.onGround) this.fuel = Math.min(1, this.fuel + dt * 0.5);
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.3 && speed > 0.1) { const ty = Math.atan2(this.vel.x, this.vel.z); let d = ty - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, 10 * dt); }
    this.speed = hs;
    if (this.camFree) this.updateCamera(dt);
  }
  updateCamera(dt) {
    const want = this.pos.clone().add(new THREE.Vector3(0, 1.3, 0));
    this.camTarget.lerp(want, Math.min(1, dt * 8));
    const cp = Math.cos(this.camPitch); const off = new THREE.Vector3(Math.sin(this.camYaw) * cp, Math.sin(this.camPitch), Math.cos(this.camYaw) * cp).multiplyScalar(this.camDist);
    const look = this.camShift ? this.camTarget.clone().add(new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw)).multiplyScalar(this.camShift)) : this.camTarget;
    let p = look.clone().add(off); const S = this.solids;
    if (S) { /* camera never ends up inside a boulder / wall: slide in along the boom to the farthest clear point */ const n = Math.ceil(this.camDist / 0.3); for (let i = n; i >= 1; i--) { const t = i / n; const x = look.x + off.x * t, y = look.y + off.y * t, z = look.z + off.z * t; if (S.top(x, z, 0.3) <= y - 0.35 || i === 1) { if (i < n) p = new THREE.Vector3(x, Math.max(y, S.top(x, z, 0.3) + 0.35), z); break; } } }
    const gy = groundAt(p.x, p.z) + 0.6; if (p.y < gy) p.y = gy;
    this.cam.position.copy(p); this.cam.lookAt(look);
  }
}
