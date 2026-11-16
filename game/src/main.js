// Bootstrap and the one loop: a fixed step for the game and a frame for the picture.
// The firing pipeline lives here so the hit test, the noise the defenders hear and the tracer all
// describe the same shot.

import * as THREE from 'three';
import { ENEMY, GRENADE } from './tuning.js';
import { buildMap } from './map.js';
import { Player, poseCamera } from './player.js';
import { Weapons, damageFor } from './weapons.js';
import { Enemies } from './enemies.js';
import { Round, STATE } from './rounds.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { Sound } from './audio.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.2;
const IDLE = { held: () => false, consume: () => false, aiming: false };

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.08, 300);
scene.add(camera);

const lamp = new THREE.PointLight(0xffe0b0, 1.1, 5, 2.0);
lamp.position.set(0.1, 0.05, -0.2);
camera.add(lamp);

const muzzle = new THREE.PointLight(0xffc46b, 0, 8, 2);
muzzle.position.set(0.32, -0.18, -0.8);
camera.add(muzzle);

// A viewmodel only as detailed as it needs to be to read as a weapon in a screenshot.
const viewmodel = new THREE.Group();
const gunBody = new THREE.Mesh(
  new THREE.BoxGeometry(0.12, 0.12, 0.5),
  new THREE.MeshStandardMaterial({ color: 0x1d2329, roughness: 0.85, metalness: 0.05 }),
);
const gunBarrel = new THREE.Mesh(
  new THREE.BoxGeometry(0.055, 0.055, 0.42),
  new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.9, metalness: 0.05 }),
);
gunBarrel.position.set(0, 0.02, -0.44);
viewmodel.add(gunBody, gunBarrel);
viewmodel.position.set(0.3, -0.34, -0.7); viewmodel.scale.setScalar(0.66);
camera.add(viewmodel);

const map = buildMap(scene);
const sound = new Sound();
const player = new Player();
const weapons = new Weapons(sound);
const enemies = new Enemies(scene, map, sound);
const hud = new Hud();
const input = new Input(canvas);

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;
const rng = makeRng(seed);

const api = { player, weapons, enemies, sound, map, hud };
const round = new Round(api, rng);
window.__watch = { camera, player, weapons, enemies, round, map, scene };

const tracer = new THREE.Mesh(
  new THREE.BoxGeometry(0.025, 0.025, 1),
  new THREE.MeshBasicMaterial({ color: 0xffe6b8, transparent: true, opacity: 0.9 }),
);
tracer.visible = false;
scene.add(tracer);

const flashLight = new THREE.PointLight(0xfff4d0, 0, 26, 1.6);
scene.add(flashLight);

const grenadeMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.11, 8, 6),
  new THREE.MeshStandardMaterial({ color: 0xf2f6ff, emissive: 0xbfd8ff, emissiveIntensity: 2.2 }),
);
grenadeMesh.visible = false;
scene.add(grenadeMesh);

const grenade = { alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, fuse: 0 };
const forward = new THREE.Vector3();
let tracerTimer = 0;
let flashTimer = 0;
let noiseTimer = 0;
let frozen = false;

function makeRng(initial) {
  let state = initial >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function showTracer(origin, dir, distance, color) {
  tracer.visible = true;
  tracerTimer = 0.05;
  tracer.material.color.setHex(color);
  tracer.scale.set(1, 1, Math.max(0.2, distance));
  tracer.position.set(
    origin.x + dir.x * distance * 0.5,
    origin.y + dir.y * distance * 0.5,
    origin.z + dir.z * distance * 0.5,
  );
  tracer.lookAt(origin.x + dir.x * distance, origin.y + dir.y * distance, origin.z + dir.z * distance);
}

// One shot: the weapon's own cone, a ray against head, torso and legs, and the noise it makes.
function fireShot() {
  const profile = weapons.fire();
  if (!profile) return;
  camera.updateMatrixWorld();
  forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
  const moving = Math.hypot(player.vel.x, player.vel.z) > 0.6;
  const spread = weapons.spreadNow(moving, player.crouch, player.aiming);
  forward.x += (rng() - 0.5) * spread;
  forward.y += (rng() - 0.5) * spread;
  forward.z += (rng() - 0.5) * spread;
  forward.normalize();
  muzzle.intensity = 10;
  player.pitch = Math.min(1.05, player.pitch + profile.recoil * 0.45);
  enemies.hear(player.pos.x, player.pos.z, ENEMY.hearShot);
  const hit = weapons.raycastEnemies(camera.position, forward, enemies, profile.range);
  if (!hit) {
    showTracer(camera.position, forward, profile.range, 0xb9c9d4);
    return;
  }
  const damage = damageFor(profile, hit.part);
  const killed = enemies.damage(hit.index, damage);
  sound.hit(hit.part === 'head');
  if (killed) round.addKill();
  showTracer(camera.position, forward, hit.distance, hit.part === 'head' ? 0xfff2c8 : 0xffc46b);
}

function throwFlash() {
  if (weapons.flashes <= 0 || grenade.alive) return;
  weapons.flashes -= 1;
  camera.updateMatrixWorld();
  forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
  grenade.alive = true;
  grenade.x = camera.position.x + forward.x * 0.4;
  grenade.y = camera.position.y + forward.y * 0.4;
  grenade.z = camera.position.z + forward.z * 0.4;
  grenade.vx = forward.x * GRENADE.throwSpeed;
  grenade.vy = forward.y * GRENADE.throwSpeed + 2.4;
  grenade.vz = forward.z * GRENADE.throwSpeed;
  grenade.fuse = GRENADE.fuse;
  grenadeMesh.visible = true;
  grenadeMesh.position.set(grenade.x, grenade.y, grenade.z);
}

function burstFlash() {
  const blinded = enemies.blind(grenade.x, grenade.z, GRENADE.radius, GRENADE.blind);
  flashLight.position.set(grenade.x, 1.6, grenade.z);
  flashTimer = 0.45;
  sound.flash();
  const gap = Math.hypot(player.pos.x - grenade.x, player.pos.z - grenade.z);
  if (gap < GRENADE.radius * 0.8 && !player.aiming) hud.flashScreen(0.35);
  round.toast = `flash: ${blinded} defenders blinded`;
}

function stepGrenade(dt) {
  if (!grenade.alive) return;
  grenade.fuse -= dt;
  grenade.vy -= 15 * dt;
  grenade.x += grenade.vx * dt;
  grenade.y = Math.max(0.12, grenade.y + grenade.vy * dt);
  grenade.z += grenade.vz * dt;
  if (grenade.y <= 0.13) {
    grenade.vy = Math.abs(grenade.vy) * 0.3;
    grenade.vx *= 0.6;
    grenade.vz *= 0.6;
  }
  grenadeMesh.position.set(grenade.x, grenade.y, grenade.z);
  if (grenade.fuse <= 0) {
    grenade.alive = false;
    grenadeMesh.visible = false;
    burstFlash();
  }
}

function readInput(dt) {
  if (input.consume('KeyM')) sound.setMuted(!sound.muted);
  input.takeLook();
  if (input.lookX !== 0 || input.lookY !== 0) player.look(input.lookX, input.lookY);
  const turn = 130 * dt;
  if (input.held('ArrowLeft')) player.look(-turn, 0);
  if (input.held('ArrowRight')) player.look(turn, 0);
  if (input.held('ArrowUp')) player.look(0, -turn * 0.7);
  if (input.held('ArrowDown')) player.look(0, turn * 0.7);
}

function handleArms() {
  if (round.state === STATE.SHOP) {
    if (input.consume('Digit1')) round.buy('pistol');
    if (input.consume('Digit2')) round.buy('smg');
    if (input.consume('Digit3')) round.buy('rifle');
    if (input.consume('Digit4')) round.buy('flash');
    if (input.consume('Digit5')) round.buy('armor');
    return;
  }
  if (round.state !== STATE.LIVE && round.state !== STATE.PLANTED) return;
  if (input.consume('Digit1')) weapons.equip('pistol');
  if (input.consume('Digit2')) weapons.equip('smg');
  if (input.consume('Digit3')) weapons.equip('rifle');
  if (input.consume('KeyR')) weapons.beginReload();
  if (input.consume('KeyG')) throwFlash();
  if (input.firing) {
    if (weapons.canFire()) fireShot();
    else if (weapons.empty) weapons.beginReload();
  }
}

function stepOnce(dt) {
  readInput(dt);
  if (round.state === STATE.TITLE) {
    if (input.consume('Enter') || input.consume('Space')) {
      sound.unlock();
      sound.startAmbience();
      round.start();
      input.lock();
    }
    return;
  }
  if (round.state === STATE.MATCH) {
    if (input.consume('KeyR') || input.consume('Enter')) round.start();
    return;
  }
  handleArms();
  if (round.state === STATE.LIVE || round.state === STATE.PLANTED) {
    player.step(dt, input, map.walls, sound);
    noiseTimer -= dt;
    const noise = player.noiseRadius;
    if (noise > 0 && noiseTimer <= 0) {
      noiseTimer = player.crouch ? 0.7 : 0.45;
      enemies.hear(player.pos.x, player.pos.z, noise);
    }
  }
  weapons.step(dt);
  stepGrenade(dt);
  round.step(dt, input);
  if (tracerTimer > 0) {
    tracerTimer -= dt;
    if (tracerTimer <= 0) tracer.visible = false;
  }
  if (muzzle.intensity > 0) muzzle.intensity = Math.max(0, muzzle.intensity - dt * 80);
  if (flashTimer > 0) {
    flashTimer -= dt * 1.4;
    flashLight.intensity = Math.max(0, flashTimer * 60);
  } else {
    flashLight.intensity = 0;
  }
  if (round.state === STATE.PLANTED || round.state === STATE.LIVE) {
    const beepEvery = round.state === STATE.PLANTED ? Math.max(0.22, round.bomb.fuse / 40) : 0;
    if (beepEvery > 0) {
      player.beepTimer = (player.beepTimer || 0) - dt;
      if (player.beepTimer <= 0) {
        player.beepTimer = beepEvery;
        sound.beep(round.bomb.fuse < 10 ? 1100 : 760);
      }
    }
  }
  input.endStep();
}

function render() {
  poseCamera(camera, player);
  const profile = weapons.profile;
  gunBarrel.scale.z = profile.id === 'rifle' ? 1.35 : profile.id === 'smg' ? 0.8 : 0.6;
  gunBody.position.z = profile.id === 'rifle' ? 0.06 : 0;
  viewmodel.position.y = -0.26 + Math.sin(player.bob) * 0.006 - (player.aiming ? 0.02 : 0);
  viewmodel.position.x = 0.3 - (player.aiming ? 0.12 : 0);
  hud.update(round, player, weapons, weapons.spreadNow(Math.hypot(player.vel.x, player.vel.z) > 0.6, player.crouch, player.aiming));
  renderer.render(scene, camera);
}

// The four shots are posed with the game's own state, then the step is frozen so the frame holds.
function poseShot() {
  if (!shot) return;
  if (shot === 'start') {
    player.pos.x = -11;
    player.pos.z = 6.5;
    player.yaw = 0.05;
    player.pitch = -0.02;
  } else if (shot === 'shop') {
    round.start();
    round.money = 4300;
    round.state = STATE.SHOP;
    round.phaseTimer = 9.4;
    hud.cache.overlay = '';
  } else if (shot === 'play') {
    round.start();
    round.startLive();
    round.money = 3900;
    round.you = 1;
    round.them = 1;
    round.kills = 3;
    round.phaseTimer = 78;
    player.pos.x = -11;
    player.pos.z = 2.2;
    player.yaw = 0.06;
    player.pitch = -0.03;
    player.armor = 100;
    weapons.grant('rifle');
    weapons.mag.rifle = 24;
    enemies.spawn(4);
    placeEnemy(0, -11.8, -3.2, 0.1);
    placeEnemy(1, -10.4, -5.6, -0.15);
    placeEnemy(2, -12.6, -7.2, 0.3);
    placeEnemy(3, -9.2, -8.4, 0.5);
    for (let i = 0; i < 24; i += 1) round.step(STEP, IDLE);
    round.phaseTimer = 78;
    aimAtDefender(4.0);
    fireShot();
    fireShot();
  } else if (shot === 'result') {
    round.start();
    round.startLive();
    round.you = 1;
    round.them = 1;
    round.kills = 6;
    round.money = 4650;
    round.endRound(true, 'the charge detonated');
    round.toast = '';
    hud.cache.overlay = '';
  }
  if (shot === 'play') muzzle.intensity = 5;
  frozen = true;
}

function placeEnemy(index, x, z, yaw) {
  const item = enemies.items[index];
  item.alive = true;
  item.health = ENEMY.health;
  item.x = x;
  item.z = z;
  item.yaw = yaw;
  item.state = 'hold';
  item.hold = { x, z, yaw };
  item.holdTimer = 6;
  item.scanPhase = 0;
  item.group.visible = true;
  item.group.position.set(x, 0, z);
  item.group.rotation.y = yaw;
}

function aimAtDefender(closest) {
  let best = -1;
  let bestGap = Infinity;
  for (let i = 0; i < enemies.items.length; i += 1) {
    const item = enemies.items[i];
    if (!item.alive) continue;
    const gap = Math.hypot(item.x - player.pos.x, item.z - player.pos.z);
    if (gap < closest || gap >= bestGap) continue;
    bestGap = gap;
    best = i;
  }
  if (best < 0) return;
  const item = enemies.items[best];
  const dx = item.x - player.pos.x;
  const dz = item.z - player.pos.z;
  player.yaw = Math.atan2(-dx, -dz);
  player.pitch = -Math.atan2(1.2, Math.max(2, Math.hypot(dx, dz))) * 0.6;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}

addEventListener('resize', onResize);
addEventListener('mousedown', () => {
  if (round.state === STATE.LIVE || round.state === STATE.PLANTED) input.lock();
});

let last = performance.now();
let accumulated = 0;
let frames = 0;

function frame(now) {
  const delta = Math.min(MAX_FRAME, Math.max(0, (now - last) / 1000));
  last = now;
  accumulated += delta;
  let guard = 0;
  while (!frozen && accumulated >= STEP && guard < 8) {
    stepOnce(STEP);
    accumulated -= STEP;
    guard += 1;
  }
  if (frozen) accumulated = 0;
  render();
  frames += 1;
  if (shot && frames >= 3) window.__shotReady = true;
  requestAnimationFrame(frame);
}

poseShot();
render();
requestAnimationFrame(frame);
