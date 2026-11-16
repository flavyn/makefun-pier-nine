// Four defenders with five behaviours each: patrol a route, hold a corner and scan it, walk to a
// noise heard, engage what is seen, and take the service corridor behind the attacker.
// Sight is a segment against the map's boxes; shots are a ray with a cone, not a coin flip.

import * as THREE from 'three';
import { ENEMY, PALETTE } from './tuning.js';
import { lineBlocked, pushOutOfWalls } from './map.js';

const BODY = new THREE.CylinderGeometry(0.34, 0.5, 1.42, 8);
const HEAD = new THREE.SphereGeometry(0.24, 10, 8);
const EYE = new THREE.SphereGeometry(0.07, 6, 6);
const ARM = new THREE.BoxGeometry(0.16, 0.16, 0.62);


export class Enemies {
  constructor(scene, map, sound) {
    this.scene = scene;
    this.map = map;
    this.sound = sound;
    this.items = [];
    const suit = new THREE.MeshStandardMaterial({ color: PALETTE.hostile, roughness: 0.95 });
    const eye = new THREE.MeshStandardMaterial({
      color: PALETTE.hostileEye, emissive: PALETTE.hostileEye, emissiveIntensity: 1.6, roughness: 0.4,
    });
    for (let i = 0; i < 6; i += 1) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(BODY, suit);
      body.position.y = 0.71;
      const head = new THREE.Mesh(HEAD, suit);
      head.position.y = 1.56;
      const eyeLeft = new THREE.Mesh(EYE, eye);
      eyeLeft.position.set(-0.085, 1.58, -0.2);
      const eyeRight = new THREE.Mesh(EYE, eye);
      eyeRight.position.set(0.085, 1.58, -0.2);
      const arm = new THREE.Mesh(ARM, suit);
      arm.position.set(0.24, 1.12, -0.3);
      group.add(body, head, eyeLeft, eyeRight, arm);
      group.visible = false;
      scene.add(group);
      this.items.push({
        group, body, alive: false, x: 0, z: 0, yaw: 0, health: ENEMY.health,
        state: 'patrol', patrol: null, patrolIndex: 0, hold: null, holdTimer: 0,
        targetX: 0, targetZ: 0, reaction: 0, burstLeft: 0, burstTimer: 0, shotTimer: 0,
        blind: 0, defusing: false, flankTimer: 0, scanPhase: 0, alertTimer: 0,
      });
    }
  }

  reset() {
    for (const item of this.items) {
      item.alive = false;
      item.group.visible = false;
      item.defusing = false;
    }
    this.aliveCount = 0;
  }

  spawn(count) {
    this.reset();
    for (let i = 0; i < count && i < this.items.length; i += 1) {
      const item = this.items[i];
      const spawn = this.map.defenderSpawns[i % this.map.defenderSpawns.length];
      item.alive = true;
      item.health = ENEMY.health;
      item.x = spawn.x + (i % 2 === 0 ? 0.8 : -0.8);
      item.z = spawn.z;
      item.yaw = 0;
      item.patrol = this.map.patrols[i % this.map.patrols.length];
      item.patrolIndex = 0;
      item.hold = this.map.holds[i % this.map.holds.length];
      item.state = 'patrol';
      item.reaction = 0;
      item.blind = 0;
      item.defusing = false;
      item.flankTimer = 0;
      item.alertTimer = 0;
      item.burstLeft = 0;
      item.burstTimer = 0;
      item.shotTimer = 0;
      item.group.visible = true;
      item.group.position.set(item.x, 0, item.z);
      item.group.rotation.y = item.yaw;
      this.aliveCount += 1;
    }
  }

  // A noise: anyone close enough who is not already shooting turns and walks to it.
  hear(x, z, radius) {
    for (const item of this.items) {
      if (!item.alive || item.state === 'engage') continue;
      if (Math.hypot(item.x - x, item.z - z) > radius) continue;
      item.state = 'investigate';
      item.targetX = x;
      item.targetZ = z;
      item.holdTimer = ENEMY.investigate;
    }
  }

  blind(x, z, radius, seconds) {
    let hit = 0;
    for (const item of this.items) {
      if (!item.alive) continue;
      if (Math.hypot(item.x - x, item.z - z) > radius) continue;
      item.blind = Math.max(item.blind, seconds);
      item.burstLeft = 0;
      hit += 1;
    }
    return hit;
  }

  damage(index, amount) {
    const item = this.items[index];
    if (!item || !item.alive) return false;
    item.health -= amount;
    item.state = 'engage';
    item.reaction = Math.min(item.reaction, 0.05);
    if (item.health > 0) return false;
    item.alive = false;
    item.group.visible = false;
    item.defusing = false;
    this.aliveCount -= 1;
    return true;
  }

  // One fixed step of the whole defence.
  step(dt, ctx) {
    const player = ctx.player;
    const walls = this.map.walls;
    for (const item of this.items) {
      if (!item.alive) continue;
      if (item.blind > 0) {
        item.blind -= dt;
        item.defusing = false;
        item.state = 'blind';
        item.yaw += dt * 1.6;
        item.group.rotation.y = item.yaw;
        item.group.position.set(item.x, Math.sin(item.blind * 3) * 0.04, item.z);
        continue;
      }
      const gap = Math.hypot(player.pos.x - item.x, player.pos.z - item.z);
      const clear = player.alive
        && gap <= ENEMY.sightRange
        && !lineBlocked(item.x, item.z, player.pos.x, player.pos.z, walls);
      // Sight has to latch: a defender on a route turns away within a step, so a bare cone test
      // would mean it never reacts. Four seconds of memory, and it notices anything inside 4.5 m.
      if (clear && facing(item, player, ENEMY.sightFov)) item.alertTimer = 4.0;
      else item.alertTimer = Math.max(0, item.alertTimer - dt);
      if (player.alive && gap < 4.5) item.alertTimer = Math.max(item.alertTimer, 1.2);
      if (clear && item.alertTimer > 0) {
        if (item.state !== 'engage') {
          item.state = 'engage';
          item.reaction = ENEMY.reaction;
        }
        item.targetX = player.pos.x;
        item.targetZ = player.pos.z;
      } else if (item.state === 'engage') {
        item.state = 'investigate';
        item.targetX = player.pos.x;
        item.targetZ = player.pos.z;
        item.holdTimer = ENEMY.investigate;
      }

      item.defusing = false;
      if (item.state === 'engage') {
        this.engage(item, dt, ctx, gap);
      } else if (ctx.bomb && ctx.bomb.planted) {
        this.defuseRun(item, dt, ctx, walls);
      } else if (item.state === 'investigate') {
        item.holdTimer -= dt;
        if (this.stepToward(item, item.targetX, item.targetZ, ENEMY.speed * 0.85, dt, walls)) {
          item.holdTimer = Math.min(item.holdTimer, 0.1);
        }
        if (item.holdTimer <= 0) item.state = 'patrol';
      } else if (item.state === 'hold') {
        item.holdTimer -= dt;
        item.scanPhase += dt * ENEMY.holdScan;
        item.yaw = item.hold.yaw + Math.sin(item.scanPhase) * 0.35;
        item.group.rotation.y = item.yaw;
        if (item.holdTimer <= 0) item.state = 'patrol';
      } else {
        this.patrolStep(item, dt, walls, ctx);
      }

      pushOutOfWalls(item, 0.42, walls);
      item.group.position.set(item.x, 0, item.z);
      if (item.state !== 'hold') item.group.rotation.y = item.yaw;
    }
  }

  patrolStep(item, dt, walls, ctx) {
    const route = item.patrol;
    const point = route[item.patrolIndex % route.length];
    if (this.stepToward(item, point.x, point.z, ENEMY.speed, dt, walls)) {
      item.patrolIndex = (item.patrolIndex + 1) % route.length;
      if (item.patrolIndex === 0 && item.hold) {
        item.state = 'hold';
        item.holdCount = (item.holdCount || 0) + 1;
        item.holdTimer = 3.5 + (((item.index || 0) * 7 + item.holdCount) % 10) * 0.24;
        item.scanPhase = 0;
      }
    }
    if (ctx.flankOrder && item === this.items[1] && item.flankTimer <= 0) {
      item.state = 'flank';
    }
  }

  // Walking a route, turning to face the way it walks: the group's -z is its front.
  stepToward(item, tx, tz, speed, dt, walls) {
    const dx = tx - item.x;
    const dz = tz - item.z;
    const gap = Math.hypot(dx, dz);
    if (gap < 0.55) return true;
    const step = Math.min(gap, speed * dt);
    item.x += (dx / gap) * step;
    item.z += (dz / gap) * step;
    item.yaw = Math.atan2(-dx, -dz);
    item.group.rotation.y = item.yaw;
    return false;
  }

  // Engaged: hold the angle it already has, fire in bursts, and back off when hurt badly.
  engage(item, dt, ctx, gap) {
    const player = ctx.player;
    item.yaw = Math.atan2(-(player.pos.x - item.x), -(player.pos.z - item.z));
    item.group.rotation.y = item.yaw;
    if (item.reaction > 0) {
      item.reaction -= dt;
      return;
    }
    if (gap < 3.5) {
      const push = 1.1 * dt;
      item.x -= (player.pos.x - item.x) / gap * push;
      item.z -= (player.pos.z - item.z) / gap * push;
    }
    item.burstTimer -= dt;
    if (item.burstLeft > 0) {
      item.shotTimer -= dt;
      if (item.shotTimer <= 0) {
        item.shotTimer = 60 / ENEMY.rpm;
        item.burstLeft -= 1;
        this.shootAt(item, ctx, gap);
      }
      return;
    }
    if (item.burstTimer <= 0) {
      item.burstLeft = ENEMY.burst;
      item.burstTimer = ENEMY.burstPause + 0.25;
      item.shotTimer = 0;
    }
  }

  shootAt(item, ctx, gap) {
    const player = ctx.player;
    const targetY = player.crouch ? 0.9 : 1.18;
    const radius = player.crouch ? 0.36 : 0.46;
    const dx = player.pos.x - item.x;
    const dz = player.pos.z - item.z;
    const dy = targetY - 1.4;
    const len = Math.hypot(dx, dy, dz) || 1;
    let dirX = dx / len;
    let dirY = dy / len;
    let dirZ = dz / len;
    const spread = ENEMY.spread * (player.aiming ? 1.15 : 1);
    item.shotCount = (item.shotCount || 0) + 1;
    const swing = (((item.index || 0) * 37 + item.shotCount * 11) % 100) / 100 - 0.5;
    const swing2 = (((item.index || 0) * 53 + item.shotCount * 17) % 100) / 100 - 0.5;
    dirX += swing * spread;
    dirY += swing2 * spread * 0.7;
    dirZ += -swing * spread;
    const norm = Math.hypot(dirX, dirY, dirZ) || 1;
    dirX /= norm;
    dirY /= norm;
    dirZ /= norm;
    const ox = item.x;
    const oy = 1.4;
    const oz = item.z;
    const px = player.pos.x - ox;
    const py = targetY - oy;
    const pz = player.pos.z - oz;
    const t = px * dirX + py * dirY + pz * dirZ;
    if (t > 0 && t < ENEMY.sightRange) {
      const ex = px - dirX * t;
      const ey = py - dirY * t;
      const ez = pz - dirZ * t;
      if (Math.hypot(ex, ey, ez) <= radius) ctx.hurtPlayer(ENEMY.damage);
    }
    if (this.sound) this.sound.shot('smg');
  }

  defuseRun(item, dt, ctx, walls) {
    const bomb = ctx.bomb;
    const gap = Math.hypot(bomb.x - item.x, bomb.z - item.z);
    if (gap <= ENEMY.defuseRange) {
      item.defusing = true;
      item.yaw = Math.atan2(-(bomb.x - item.x), -(bomb.z - item.z));
      item.group.rotation.y = item.yaw;
      return;
    }
    this.stepToward(item, bomb.x, bomb.z, ENEMY.speed, dt, walls);
  }

  get defusers() {
    let count = 0;
    for (const item of this.items) if (item.alive && item.defusing) count += 1;
    return count;
  }
}

function facing(item, player, fov) {
  const dx = player.pos.x - item.x;
  const dz = player.pos.z - item.z;
  const gap = Math.hypot(dx, dz) || 1;
  const frontX = -Math.sin(item.yaw);
  const frontZ = -Math.cos(item.yaw);
  return (dx / gap) * frontX + (dz / gap) * frontZ > Math.cos(fov);
}
