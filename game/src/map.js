// The wharf itself: lanes built from boxes, two sites painted on the deck, and the sight test the
// defenders shoot through. Geometry is built once; the step only reads these boxes.

import * as THREE from 'three';
import { ARENA, MAP, PALETTE } from './tuning.js';

const BLOCKS = [
  // long walls that make the four lanes
  { x: 0, z: 3.0, w: 7.0, d: 1.2, h: 2.6 },
  { x: -6.5, z: -4.0, w: 1.0, d: 9.0, h: 2.8 },
  { x: 6.5, z: -4.0, w: 1.0, d: 9.0, h: 2.8 },
  { x: -6.5, z: -13.0, w: 1.0, d: 4.0, h: 2.8 },
  { x: 6.5, z: -13.0, w: 1.0, d: 4.0, h: 2.8 },
  // service corridor behind the sites
  { x: 0, z: -11.5, w: 11.0, d: 1.0, h: 2.2 },
  // crates worth fighting over
  { x: -10.5, z: 4.5, w: 2.0, d: 2.0, h: 1.7 },
  { x: 10.5, z: 4.5, w: 2.0, d: 2.0, h: 1.7 },
  { x: -15.5, z: -7.0, w: 1.6, d: 1.6, h: 1.9 },
  { x: 15.5, z: -7.0, w: 1.6, d: 1.6, h: 1.9 },
  { x: -3.2, z: -6.0, w: 1.4, d: 1.4, h: 1.5 },
  { x: 3.2, z: -6.0, w: 1.4, d: 1.4, h: 1.5 },
  { x: 0, z: 10.5, w: 3.0, d: 1.4, h: 1.6 },
];

const LAMPS = [
  { x: -12, z: 6 }, { x: 12, z: 6 }, { x: -12, z: -12 }, { x: 12, z: -12 }, { x: 0, z: 2 },
];

export function buildMap(scene) {
  const half = ARENA.half;
  const walls = [];

  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.026);
  scene.background = new THREE.Color(PALETTE.sky);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x06101a, roughness: 0.25, metalness: 0.6 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.6;
  scene.add(water);

  const deck = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 64),
    new THREE.MeshStandardMaterial({ color: PALETTE.deck, roughness: 0.86, metalness: 0.1 }),
  );
  deck.rotation.x = -Math.PI / 2;
  scene.add(deck);

  const crateMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.crate, roughness: 0.82 });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.trim, emissive: PALETTE.trim, emissiveIntensity: 0.5, roughness: 0.5,
  });
  const unit = new THREE.BoxGeometry(1, 1, 1);

  for (const block of BLOCKS) {
    const mesh = new THREE.Mesh(unit, crateMaterial);
    mesh.scale.set(block.w, block.h, block.d);
    mesh.position.set(block.x, block.h / 2, block.z);
    scene.add(mesh);
    walls.push({ cx: block.x, cz: block.z, hw: block.w / 2, hd: block.d / 2 });
  }

  const rim = half + 0.5;
  for (const side of [[0, -rim, half * 2 + 2, 1], [0, rim, half * 2 + 2, 1], [-rim, 0, 1, half * 2 + 2], [rim, 0, 1, half * 2 + 2]]) {
    const mesh = new THREE.Mesh(unit, crateMaterial);
    mesh.scale.set(side[2], 3.4, side[3]);
    mesh.position.set(side[0], 1.7, side[1]);
    scene.add(mesh);
    walls.push({ cx: side[0], cz: side[1], hw: side[2] / 2, hd: side[3] / 2 });
  }

  // Site paint: a ring on the deck is the only "plant zone" marker, and it is readable at a glance.
  const siteMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.paint, emissive: PALETTE.paint, emissiveIntensity: 0.35, roughness: 0.6,
  });
  for (const site of MAP.sites) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(site.radius - 0.35, site.radius, 28), siteMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(site.x, 0.02, site.z);
    scene.add(ring);
    for (let corner = 0; corner < 3; corner += 1) {
      const crate = new THREE.Mesh(unit, crateMaterial);
      crate.scale.set(1.2, 1.2, 1.2);
      const angle = (corner / 3) * Math.PI * 2 + 0.6;
      crate.position.set(site.x + Math.cos(angle) * (site.radius + 0.9), 0.6, site.z + Math.sin(angle) * (site.radius + 0.9));
      scene.add(crate);
      walls.push({ cx: crate.position.x, cz: crate.position.z, hw: 0.6, hd: 0.6 });
    }
  }

  for (const lamp of LAMPS) {
    const post = new THREE.Mesh(unit, crateMaterial);
    post.scale.set(0.18, 2.9, 0.18);
    post.position.set(lamp.x, 1.45, lamp.z);
    scene.add(post);
    const head = new THREE.Mesh(unit, trimMaterial);
    head.scale.set(0.36, 0.14, 0.36);
    head.position.set(lamp.x, 2.85, lamp.z);
    scene.add(head);
    const light = new THREE.PointLight(PALETTE.trim, 9, 13, 2);
    light.position.set(lamp.x, 2.7, lamp.z);
    scene.add(light);
  }

  scene.add(new THREE.AmbientLight(0x44688a, 4.0));
  const moon = new THREE.DirectionalLight(0xb8d6ef, 2.9);
  moon.position.set(-10, 20, -8);
  scene.add(moon);
  scene.add(new THREE.HemisphereLight(0x2d4f6c, 0x0a1119, 1.2));

  return {
    walls,
    sites: MAP.sites,
    holds: MAP.holds,
    patrols: MAP.patrols,
    service: MAP.service,
    playerSpawn: MAP.playerSpawn,
    defenderSpawns: MAP.defenderSpawns,
  };
}

// A segment against the box list: what the defenders can and cannot see through.
export function lineBlocked(ax, az, bx, bz, walls) {
  const dx = bx - ax;
  const dz = bz - az;
  for (let i = 0; i < walls.length; i += 1) {
    const wall = walls[i];
    const minX = wall.cx - wall.hw;
    const maxX = wall.cx + wall.hw;
    const minZ = wall.cz - wall.hd;
    const maxZ = wall.cz + wall.hd;
    let near = 0;
    let far = 1;
    for (let axis = 0; axis < 2; axis += 1) {
      const origin = axis === 0 ? ax : az;
      const delta = axis === 0 ? dx : dz;
      const low = axis === 0 ? minX : minZ;
      const high = axis === 0 ? maxX : maxZ;
      if (Math.abs(delta) < 1e-6) {
        if (origin < low || origin > high) { near = 1; far = 0; break; }
        continue;
      }
      let t0 = (low - origin) / delta;
      let t1 = (high - origin) / delta;
      if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
      if (t0 > near) near = t0;
      if (t1 < far) far = t1;
      if (near > far) break;
    }
    if (near <= far && far > 0 && near < 1) return true;
  }
  return false;
}

export function pushOutOfWalls(pos, radius, walls) {
  for (let i = 0; i < walls.length; i += 1) {
    const wall = walls[i];
    const nearX = Math.max(wall.cx - wall.hw, Math.min(pos.x, wall.cx + wall.hw));
    const nearZ = Math.max(wall.cz - wall.hd, Math.min(pos.z, wall.cz + wall.hd));
    const awayX = pos.x - nearX;
    const awayZ = pos.z - nearZ;
    const gap = awayX * awayX + awayZ * awayZ;
    if (gap >= radius * radius) continue;
    if (gap > 1e-7) {
      const len = Math.sqrt(gap);
      pos.x = nearX + (awayX / len) * radius;
      pos.z = nearZ + (awayZ / len) * radius;
      continue;
    }
    const depthX = wall.hw + radius - Math.abs(pos.x - wall.cx);
    const depthZ = wall.hd + radius - Math.abs(pos.z - wall.cz);
    if (depthX < depthZ) pos.x += pos.x >= wall.cx ? depthX : -depthX;
    else pos.z += pos.z >= wall.cz ? depthZ : -depthZ;
  }
  return pos;
}
