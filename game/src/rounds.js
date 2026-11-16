// A round of Pier Nine: a buy phase, a live phase, a planted charge with its fuse and its defusers,
// then the result and the next round. Money, score and every transition live here.

import { ARMOR, BOMB, ECONOMY, ENEMY, GRENADE, MAP, ROUND, WEAPONS } from './tuning.js';

export const STATE = {
  TITLE: 'title',
  SHOP: 'shop',
  LIVE: 'live',
  PLANTED: 'planted',
  RESULT: 'result',
  MATCH: 'match',
};

export class Round {
  constructor(api, rng) {
    this.api = api;
    this.rng = rng;
    this.state = STATE.TITLE;
    this.round = 0;
    this.you = 0;
    this.them = 0;
    this.money = ECONOMY.start;
    this.phaseTimer = 0;
    this.kills = 0;
    this.lossStreak = 0;
    this.plantProgress = 0;
    this.result = { won: false, reason: '' };
    this.bomb = { planted: false, x: 0, z: 0, siteId: '', fuse: 0, defuseProgress: 0 };
    this.toast = '';
    this.matchWon = false;
  }

  start() {
    this.you = 0;
    this.them = 0;
    this.money = ECONOMY.start;
    this.kills = 0;
    this.lossStreak = 0;
    this.round = 0;
    this.matchWon = false;
    this.api.weapons.reset();
    this.beginRound();
  }

  beginRound() {
    this.round += 1;
    this.state = STATE.SHOP;
    this.phaseTimer = ROUND.buyTime;
    this.plantProgress = 0;
    this.bomb = { planted: false, x: 0, z: 0, siteId: '', fuse: 0, defuseProgress: 0 };
    this.result = { won: false, reason: '' };
    this.toast = 'buy phase';
    this.api.player.reset(MAP.playerSpawn);
    this.api.weapons.refillMags();
    this.api.enemies.spawn(ROUND.defenders);
    this.api.sound.buy();
  }

  startLive() {
    if (this.state !== STATE.SHOP) return;
    this.state = STATE.LIVE;
    this.phaseTimer = ROUND.liveTime;
    this.toast = 'go';
  }

  // Buying is only legal in the buy phase, and only with money that is actually on hand.
  buy(id) {
    if (this.state !== STATE.SHOP) return false;
    const weapons = this.api.weapons;
    let price = 0;
    if (WEAPONS[id]) price = WEAPONS[id].price;
    else if (id === 'flash') price = GRENADE.price;
    else if (id === 'armor') price = ARMOR.price;
    else return false;
    if (id === 'armor' && this.api.player.armor >= ARMOR.max) return false;
    if (id === 'flash' && weapons.flashes >= GRENADE.max) return false;
    if (WEAPONS[id] && weapons.has(id)) return false;
    if (this.money < price) return false;
    this.money -= price;
    if (id === 'armor') this.api.player.armor = ARMOR.max;
    else if (id === 'flash') weapons.grant('flash');
    else weapons.grant(id);
    this.toast = `${id} bought`;
    this.api.sound.buy();
    return true;
  }

  siteNear(x, z) {
    for (const site of MAP.sites) {
      if (Math.hypot(site.x - x, site.z - z) <= site.radius) return site;
    }
    return null;
  }

  plantCharge(site) {
    this.bomb.planted = true;
    this.bomb.x = site.x;
    this.bomb.z = site.z;
    this.bomb.siteId = site.id;
    this.bomb.fuse = BOMB.fuse;
    this.bomb.defuseProgress = 0;
    this.money = Math.min(ECONOMY.cap, this.money + ECONOMY.plant);
    this.state = STATE.PLANTED;
    this.phaseTimer = 0;
    this.toast = `charge planted at ${site.id}`;
    this.api.sound.plant();
  }

  addKill() {
    this.kills += 1;
    this.money = Math.min(ECONOMY.cap, this.money + ECONOMY.kill);
  }

  endRound(won, reason) {
    if (this.state === STATE.RESULT || this.state === STATE.MATCH) return;
    this.result = { won, reason };
    this.state = STATE.RESULT;
    this.phaseTimer = ROUND.resultTime;
    if (won) {
      this.you += 1;
      this.money = Math.min(ECONOMY.cap, this.money + ECONOMY.win);
      this.lossStreak = 0;
      this.api.sound.win();
    } else {
      this.them += 1;
      this.money = Math.min(ECONOMY.cap, this.money + ECONOMY.lose + this.lossStreak * ECONOMY.loseStep);
      this.lossStreak = Math.min(3, this.lossStreak + 1);
      this.api.sound.lose();
    }
    this.toast = reason;
  }

  step(dt, input) {
    const player = this.api.player;
    const enemies = this.api.enemies;
    const ctx = {
      player,
      walls: this.api.map.walls,
      bomb: this.bomb.planted ? this.bomb : null,
      hurtPlayer: (amount) => player.hurt(amount, this.api.sound),
    };
    if (this.state === STATE.SHOP) {
      this.phaseTimer -= dt;
      if (input && input.consume('Enter')) this.startLive();
      if (this.phaseTimer <= 0) this.startLive();
      return;
    }
    if (this.state === STATE.LIVE) {
      this.phaseTimer -= dt;
      enemies.step(dt, ctx);
      const site = this.siteNear(player.pos.x, player.pos.z);
      const holding = input && input.held('KeyE') && site !== null && player.alive;
      if (holding) {
        this.plantProgress += dt;
        if (this.plantProgress >= BOMB.plantTime) {
          this.plantProgress = 0;
          // The plant ends the live phase there and then: the checks below belong to a live round,
          // and phaseTimer is zero once the charge is down.
          this.plantCharge(site);
          return;
        }
      } else {
        this.plantProgress = Math.max(0, this.plantProgress - dt * 1.6);
      }
      if (!player.alive) return this.endRound(false, 'you were killed');
      if (enemies.aliveCount === 0) return this.endRound(true, 'the site is clear');
      if (this.phaseTimer <= 0) return this.endRound(false, 'time ran out');
      return;
    }
    if (this.state === STATE.PLANTED) {
      enemies.step(dt, ctx);
      this.bomb.fuse -= dt;
      if (enemies.defusers > 0) {
        this.bomb.defuseProgress += dt * enemies.defusers;
        if (this.bomb.defuseProgress >= ENEMY.defuseTime) {
          return this.endRound(false, 'the charge was defused');
        }
      } else {
        this.bomb.defuseProgress = Math.max(0, this.bomb.defuseProgress - dt * 0.5);
      }
      if (this.bomb.fuse <= 0) return this.endRound(true, 'the charge detonated');
      if (!player.alive) return this.endRound(false, 'you were killed');
      if (enemies.aliveCount === 0) return this.endRound(true, 'the last defender went down');
      return;
    }
    if (this.state === STATE.RESULT) {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        if (this.you >= ROUND.roundsToWin || this.them >= ROUND.roundsToWin) {
          this.state = STATE.MATCH;
          this.matchWon = this.you > this.them;
        } else {
          this.beginRound();
        }
      }
    }
  }

  get bombBeep() {
    if (!this.bomb.planted) return 0;
    return this.bomb.fuse > 0 ? Math.max(0.12, this.bomb.fuse / BOMB.fuse) : 0;
  }
}
