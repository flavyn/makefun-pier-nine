// The attacker: acceleration, crouch, aim-down-speed, wall collision, health and armour.
// Footsteps are a noise event here, so what the defenders hear follows how the player moves.

import { ARENA, PLAYER } from './tuning.js';
import { pushOutOfWalls } from './map.js';

export class Player {
  constructor() {
    this.pos = { x: 0, y: ARENA.eye, z: 16 };
    this.vel = { x: 0, z: 0 };
    this.yaw = 0;
    this.pitch = -0.03;
    this.crouch = false;
    this.aiming = false;
    this.health = PLAYER.maxHealth;
    this.armor = 0;
    this.alive = true;
    this.hurtTimer = 0;
    this.stepTimer = 0;
    this.bob = 0;
    this.hasBomb = true;
    this.planting = 0;
  }

  reset(spawn) {
    this.pos.x = spawn.x;
    this.pos.z = spawn.z;
    this.vel.x = 0;
    this.vel.z = 0;
    this.yaw = 0;
    this.pitch = -0.03;
    this.health = PLAYER.maxHealth;
    this.alive = true;
    this.hurtTimer = 0;
    this.crouch = false;
    this.aiming = false;
    this.hasBomb = true;
    this.planting = 0;
  }

  look(dx, dy) {
    const aimScale = this.aiming ? 0.6 : 1;
    this.yaw -= dx * 0.0022 * aimScale;
    this.pitch -= dy * 0.0020 * aimScale;
    if (this.pitch > 1.1) this.pitch = 1.1;
    if (this.pitch < -1.1) this.pitch = -1.1;
  }

  step(dt, input, walls, sound) {
    this.crouch = input.held('ControlLeft') || input.held('KeyC');
    this.aiming = input.aiming && !this.crouch ? true : input.aiming;
    const wishX = (input.held('KeyD') ? 1 : 0) - (input.held('KeyA') ? 1 : 0);
    const wishZ = (input.held('KeyS') ? 1 : 0) - (input.held('KeyW') ? 1 : 0);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let ax = wishX * cos + wishZ * sin;
    let az = wishZ * cos - wishX * sin;
    const wish = Math.hypot(ax, az);
    const speedCap = this.crouch ? PLAYER.crouchSpeed : this.aiming ? PLAYER.aimSpeed : PLAYER.maxSpeed;
    if (wish > 0 && !this.aiming) {
      ax /= wish;
      az /= wish;
      const push = PLAYER.accel * (this.crouch ? 0.6 : 1) * dt;
      this.vel.x += ax * push;
      this.vel.z += az * push;
    }
    const drag = Math.max(0, 1 - PLAYER.friction * dt);
    this.vel.x *= drag;
    this.vel.z *= drag;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed > speedCap) {
      this.vel.x = (this.vel.x / speed) * speedCap;
      this.vel.z = (this.vel.z / speed) * speedCap;
    }
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    pushOutOfWalls(this.pos, PLAYER.radius, walls);
    const limit = ARENA.half - 0.6;
    this.pos.x = Math.max(-limit, Math.min(limit, this.pos.x));
    this.pos.z = Math.max(-limit, Math.min(limit, this.pos.z));

    const moving = speed > 0.5;
    if (moving) {
      this.bob += dt * (this.crouch ? 5.0 : 8.6) * (speed / PLAYER.maxSpeed);
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.crouch ? 0.62 : this.aiming ? 0.5 : stepIntervalFor(speed);
        sound.step(!this.crouch && speed > 3.2);
      }
    } else {
      this.bob += dt;
      this.stepTimer = 0;
    }
    const eye = this.crouch ? ARENA.crouchEye : ARENA.eye;
    this.pos.y = eye + Math.sin(this.bob) * (moving ? 0.03 : 0.01);
    if (this.hurtTimer > 0) this.hurtTimer = Math.max(0, this.hurtTimer - dt);
  }

  // What the defenders hear from this position: a crouched walk is nearly silent, a run is loud.
  get noiseRadius() {
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.crouch) return 2.5;
    if (speed > 3.6) return 13;
    if (speed > 0.6) return 7;
    return 0;
  }

  hurt(amount, sound) {
    if (!this.alive) return;
    let left = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.5);
      this.armor -= absorbed;
      left -= absorbed;
    }
    this.health -= left;
    this.hurtTimer = 0.4;
    sound.hurt();
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
  }
}

function stepIntervalFor(speed) {
  return Math.max(0.3, 0.46 - speed * 0.02);
}

export function poseCamera(camera, player) {
  camera.position.set(player.pos.x, player.pos.y, player.pos.z);
  camera.rotation.set(0, 0, 0);
  camera.rotateY(player.yaw);
  camera.rotateX(player.pitch);
  return camera;
}
