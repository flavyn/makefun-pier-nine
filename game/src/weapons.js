// Fire control and ballistics: magazines, reserve, reload, burst fire, recoil that climbs while the
// trigger is held, and a spread cone that widens with movement and tightens when crouched or aimed.
// Hits are checked against head, torso and legs, so damage follows where the shot lands.

import { SPREAD, WEAPONS } from './tuning.js';

const PART_MUL = { head: 0, torso: 1.0, legs: 0.72 };

export class Weapons {
  constructor(sound) {
    this.sound = sound;
    this.reset();
  }

  reset() {
    this.owned = { pistol: true, smg: false, rifle: false };
    this.mag = { pistol: WEAPONS.pistol.mag, smg: 0, rifle: 0 };
    this.reserve = { pistol: WEAPONS.pistol.reserve, smg: 0, rifle: 0 };
    this.current = 'pistol';
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.burstLeft = 0;
    this.burstGap = 0;
    this.recoil = 0;
    this.flashes = 0;
    this.kick = 0;
  }

  get profile() {
    return WEAPONS[this.current];
  }

  has(id) {
    return this.owned[id] === true;
  }

  // A new round starts with full magazines in every weapon this round's buyer owns; reserve carries over.
  refillMags() {
    for (const id of Object.keys(WEAPONS)) {
      if (!this.owned[id]) continue;
      this.mag[id] = WEAPONS[id].mag;
      this.reserve[id] = Math.max(this.reserve[id], WEAPONS[id].reserve * 0.5);
    }
    this.reloadTimer = 0;
    this.burstLeft = 0;
    this.recoil = 0;
    this.cooldown = 0.2;
  }

  grant(id) {
    if (id === 'flash') {
      this.flashes = Math.min(2, this.flashes + 1);
      return;
    }
    if (!WEAPONS[id]) return;
    this.owned[id] = true;
    this.mag[id] = WEAPONS[id].mag;
    this.reserve[id] = WEAPONS[id].reserve;
    this.current = id;
    this.reloadTimer = 0;
    this.burstLeft = 0;
  }

  equip(id) {
    if (!this.owned[id]) return false;
    if (this.current === id) return false;
    this.current = id;
    this.reloadTimer = 0;
    this.burstLeft = 0;
    this.cooldown = 0.25;
    this.recoil = 0;
    return true;
  }

  get reloading() {
    return this.reloadTimer > 0;
  }

  get burstPending() {
    return this.burstLeft > 0;
  }

  // The cone the next shot leaves from: still, moving, crouched, aimed, with the recoil already in it.
  spreadNow(moving, crouch, aiming) {
    const profile = this.profile;
    let spread = profile.spreadStill + (moving ? profile.spreadMove * SPREAD.moveMul : 0) + this.recoil * SPREAD.recoilMul;
    if (crouch) spread *= SPREAD.crouchMul;
    if (aiming) spread *= SPREAD.aimMul;
    return spread;
  }

  step(dt) {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    this.recoil *= Math.exp(-this.profile.recover * dt);
    if (this.recoil < 0.0002) this.recoil = 0;
    this.kick *= Math.exp(-9 * dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
      return;
    }
    if (this.burstLeft > 0) {
      this.burstGap -= dt;
    }
  }

  canFire() {
    const profile = this.profile;
    if (this.reloadTimer > 0) return false;
    if (this.cooldown > 0) return false;
    if (this.burstLeft > 0) return this.burstGap <= 0;
    return this.mag[profile.id] > 0;
  }

  beginReload() {
    const profile = this.profile;
    if (this.reloadTimer > 0) return false;
    if (this.mag[profile.id] >= profile.mag) return false;
    if (this.reserve[profile.id] <= 0) return false;
    this.reloadTimer = profile.reload;
    this.burstLeft = 0;
    this.sound.reload();
    return true;
  }

  finishReload() {
    const profile = this.profile;
    const want = profile.mag - this.mag[profile.id];
    const take = Math.min(want, this.reserve[profile.id]);
    this.mag[profile.id] += take;
    this.reserve[profile.id] -= take;
  }

  get empty() {
    const profile = this.profile;
    return this.mag[profile.id] === 0 && this.reserve[profile.id] === 0;
  }

  // One trigger pull: costs a round, adds recoil and a camera kick, and returns the profile fired.
  fire() {
    const profile = this.profile;
    if (!this.canFire()) return null;
    if (this.burstLeft === 0) this.mag[profile.id] -= 1;
    this.cooldown = 60 / profile.rpm;
    this.recoil = Math.min(0.09, this.recoil + profile.recoil);
    this.kick = Math.min(0.05, this.kick + profile.recoil * 0.55);
    if (profile.mode === 'burst') {
      if (this.burstLeft === 0) this.burstLeft = profile.burst - 1;
      else this.burstLeft -= 1;
      this.burstGap = 0.1;
    }
    this.sound.shot(profile.id);
    return profile;
  }

  // A ray against the hit spheres of living defenders: nearest part wins, head first at equal range.
  raycastEnemies(origin, dir, enemies, range) {
    let best = null;
    for (let i = 0; i < enemies.items.length; i += 1) {
      const enemy = enemies.items[i];
      if (!enemy.alive) continue;
      const parts = [
        { part: 'head', x: enemy.x, y: 1.58, z: enemy.z, r: 0.24 },
        { part: 'torso', x: enemy.x, y: 1.12, z: enemy.z, r: 0.42 },
        { part: 'legs', x: enemy.x, y: 0.55, z: enemy.z, r: 0.36 },
      ];
      for (const sphere of parts) {
        const lx = sphere.x - origin.x;
        const ly = sphere.y - origin.y;
        const lz = sphere.z - origin.z;
        const t = lx * dir.x + ly * dir.y + lz * dir.z;
        if (t <= 0 || t > range) continue;
        const px = lx - dir.x * t;
        const py = ly - dir.y * t;
        const pz = lz - dir.z * t;
        if (px * px + py * py + pz * pz > sphere.r * sphere.r) continue;
        if (best === null || t < best.distance) {
          best = { index: i, part: sphere.part, distance: t, x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t };
        }
      }
    }
    return best;
  }
}

export function damageFor(profile, part) {
  if (part === 'head') return profile.damage * profile.headMul;
  return profile.damage * PART_MUL[part];
}
