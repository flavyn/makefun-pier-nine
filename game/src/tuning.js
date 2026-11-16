// Every number Pier Nine balances on, in one file: weapon profiles, economy, bomb timings, the map.
// The three weapons differ in role, not only in price: a pistol that rewards one tap, an SMG that
// rewards holding a lane, a rifle that rewards stopping to aim.

export const PALETTE = {
  sky: 0x070d14,
  fog: 0x0c1721,
  deck: 0x233240,
  crate: 0x3a4b58,
  trim: 0xffc46b,
  paint: 0x4fd8c8,
  hostile: 0x9fb4c4,
  hostileEye: 0xff9d6b,
  site: 0x3f6f8a,
};

export const ARENA = { half: 20, eye: 1.62, crouchEye: 1.06 };

export const PLAYER = {
  radius: 0.42,
  accel: 62,
  maxSpeed: 5.5,
  crouchSpeed: 2.45,
  aimSpeed: 2.7,
  friction: 10.5,
  maxHealth: 100,
  maxArmor: 100,
  stepInterval: 0.42,
};

// How the four multipliers stack: crouching and aiming both tighten the cone, moving opens it wide.
export const SPREAD = { crouchMul: 0.45, aimMul: 0.4, moveMul: 1.0, recoilMul: 0.9 };

export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'Pier Sidearm', price: 700, mode: 'semi',
    damage: 24, headMul: 2.6, rpm: 320, mag: 12, reserve: 48, reload: 1.4,
    spreadStill: 0.0035, spreadMove: 0.030, recoil: 0.010, recover: 7.0, range: 40,
  },
  smg: {
    id: 'smg', name: 'Dock SMG', price: 1250, mode: 'auto',
    damage: 18, headMul: 2.2, rpm: 720, mag: 25, reserve: 75, reload: 1.9,
    spreadStill: 0.0065, spreadMove: 0.022, recoil: 0.0072, recover: 9.0, range: 32,
  },
  rifle: {
    id: 'rifle', name: 'Quay Rifle', price: 2700, mode: 'burst', burst: 3,
    damage: 34, headMul: 2.6, rpm: 600, mag: 30, reserve: 90, reload: 2.3,
    spreadStill: 0.0022, spreadMove: 0.026, recoil: 0.0125, recover: 6.0, range: 55,
  },
};

export const GRENADE = {
  id: 'flash', name: 'Flash Charge', price: 250, radius: 9.0, blind: 2.6,
  throwSpeed: 17, fuse: 1.05, max: 2,
};

export const ARMOR = { id: 'armor', name: 'Plated Vest', price: 650, max: 100 };

export const ENEMY = {
  health: 100, headMul: 2.0, sightRange: 27, sightFov: 1.05,
  hearShot: 26, hearStepWalk: 7, hearStepRun: 14, hearStepCrouch: 2.5,
  damage: 6, rpm: 420, burst: 3, burstPause: 0.62, spread: 0.032,
  reaction: 0.28, speed: 3.1, holdScan: 0.5, investigate: 4.2,
  defuseRange: 1.5, defuseTime: 6.5,
};

export const BOMB = { plantTime: 3.2, fuse: 40, siteRange: 3.4 };

export const ECONOMY = {
  start: 800, cap: 9000, win: 3250, lose: 1400, loseStep: 300, kill: 300, plant: 300,
};

export const ROUND = { buyTime: 12, liveTime: 105, roundsToWin: 3, resultTime: 4.5, defenders: 4 };

// The wharf: two charges to plant, four lanes between them, and one service corridor behind the sites.
export const MAP = {
  playerSpawn: { x: 0, z: 16.5 },
  defenderSpawns: [{ x: -2, z: -16.5 }, { x: 2, z: -16.5 }, { x: 0, z: -15 }, { x: -6, z: -16 }],
  sites: [
    { id: 'A', x: -12.5, z: -7.0, radius: BOMB.siteRange },
    { id: 'B', x: 12.5, z: -7.0, radius: BOMB.siteRange },
  ],
  holds: [
    { x: -11.0, z: -2.0, yaw: 0.20 },
    { x: 11.0, z: -2.0, yaw: -0.20 },
    { x: 0.0, z: -9.5, yaw: 0.0 },
    { x: -4.0, z: -13.0, yaw: 0.45 },
  ],
  patrols: [
    [{ x: -11, z: -2 }, { x: -11, z: -12 }, { x: -1, z: -12 }, { x: 0, z: -4 }],
    [{ x: 11, z: -2 }, { x: 11, z: -12 }, { x: 2, z: -12 }, { x: 0, z: -4 }],
    [{ x: 0, z: -9 }, { x: 6, z: -13 }, { x: 0, z: -16 }, { x: -6, z: -13 }],
  ],
  service: [{ x: 0, z: 8 }, { x: 0, z: -1 }, { x: 9, z: -14 }, { x: 13, z: -9 }],
};
