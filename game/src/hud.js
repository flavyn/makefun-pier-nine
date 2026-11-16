// The HUD: bars, the ammunition counter, the round clock, the buy cards and the four screens.
// Every write is compared with the last value first, so a quiet frame touches no DOM node.

import { ARMOR, GRENADE, WEAPONS } from './tuning.js';
import { STATE } from './rounds.js';

export class Hud {
  constructor() {
    this.healthFill = document.getElementById('health-fill');
    this.healthText = document.getElementById('health-text');
    this.armorFill = document.getElementById('armor-fill');
    this.armorText = document.getElementById('armor-text');
    this.mag = document.getElementById('mag');
    this.reserve = document.getElementById('reserve');
    this.weaponName = document.getElementById('weapon-name');
    this.score = document.getElementById('score');
    this.round = document.getElementById('round');
    this.timer = document.getElementById('timer');
    this.money = document.getElementById('money');
    this.bomb = document.getElementById('bomb');
    this.fuse = document.getElementById('fuse');
    this.toast = document.getElementById('toast');
    this.crosshair = document.getElementById('crosshair');
    this.hurt = document.getElementById('hurt');
    this.flashbang = document.getElementById('flashbang');
    this.plant = document.getElementById('plant');
    this.plantFill = document.getElementById('plant-fill');
    this.overlays = {
      title: document.getElementById('title'),
      shop: document.getElementById('shop'),
      result: document.getElementById('result'),
      match: document.getElementById('match'),
    };
    this.shopMoney = document.getElementById('shop-money');
    this.shopCards = document.getElementById('shop-cards');
    this.resultTitle = document.getElementById('result-title');
    this.resultReason = document.getElementById('result-reason');
    this.resultScore = document.getElementById('result-score');
    this.resultKills = document.getElementById('result-kills');
    this.resultMoney = document.getElementById('result-money');
    this.resultNext = document.getElementById('result-next');
    this.matchTitle = document.getElementById('match-title');
    this.matchScore = document.getElementById('match-score');
    this.cache = { mag: -1, reserve: -1, health: -1, armor: -1, timer: '', weapon: '', score: '', overlay: 'title', money: -1, round: -1 };
  }

  bar(node, share) {
    node.style.transform = `scaleX(${Math.max(0, Math.min(1, share))})`;
  }

  clock(seconds) {
    const whole = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(whole / 60);
    const rest = whole % 60;
    return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
  }

  update(round, player, weapons, spread) {
    const healthShare = player.health / 100;
    if (this.cache.health !== Math.round(healthShare * 100)) {
      this.cache.health = Math.round(healthShare * 100);
      this.bar(this.healthFill, healthShare);
      this.healthText.textContent = `${Math.round(player.health)}`;
    }
    if (this.cache.armor !== Math.round(player.armor)) {
      this.cache.armor = Math.round(player.armor);
      this.bar(this.armorFill, player.armor / ARMOR.max);
      this.armorText.textContent = `${Math.round(player.armor)}`;
    }
    const profile = weapons.profile;
    const mag = weapons.mag[profile.id];
    const reserve = weapons.reserve[profile.id];
    if (this.cache.mag !== mag || this.cache.reserve !== reserve) {
      this.cache.mag = mag;
      this.cache.reserve = reserve;
      this.mag.textContent = `${mag}`;
      this.reserve.textContent = `${reserve}`;
    }
    if (this.cache.weapon !== profile.id) {
      this.cache.weapon = profile.id;
      this.weaponName.textContent = profile.name;
    }
    const timerText = this.clock(round.state === STATE.PLANTED ? round.bomb.fuse : round.phaseTimer);
    if (this.cache.timer !== timerText) {
      this.cache.timer = timerText;
      this.timer.textContent = timerText;
    }
    const scoreText = `${round.you} – ${round.them}`;
    if (this.cache.score !== scoreText) {
      this.cache.score = scoreText;
      this.score.textContent = scoreText;
    }
    if (this.cache.money !== round.money) {
      this.cache.money = round.money;
      this.money.textContent = `${round.money}`;
      this.shopMoney.textContent = `${round.money}`;
    }
    if (this.cache.round !== round.round) {
      this.cache.round = round.round;
      this.round.textContent = `${round.round}`;
    }
    this.bomb.classList.toggle('on', round.state === STATE.PLANTED);
    if (round.state === STATE.PLANTED) this.fuse.textContent = `${Math.max(0, Math.ceil(round.bomb.fuse))}`;
    this.toast.textContent = round.toast;
    this.toast.classList.toggle('on', round.state === STATE.SHOP || round.toast === 'go');
    this.crosshair.style.setProperty('--gap', `${6 + spread * 900}px`);
    this.hurt.style.opacity = player.hurtTimer > 0 ? '0.6' : '0';
    this.plant.style.opacity = round.plantProgress > 0 ? '1' : '0';
    this.plantFill.style.transform = `scaleX(${Math.min(1, round.plantProgress / 3.2)})`;
    this.showOverlay(round);
  }

  showOverlay(round) {
    const wanted = round.state === STATE.TITLE ? 'title'
      : round.state === STATE.SHOP ? 'shop'
        : round.state === STATE.RESULT ? 'result'
          : round.state === STATE.MATCH ? 'match' : '';
    if (this.cache.overlay === wanted) {
      if (wanted === 'result') this.resultNext.textContent = `next round in ${Math.ceil(round.phaseTimer)}`;
      return;
    }
    this.cache.overlay = wanted;
    for (const key of Object.keys(this.overlays)) this.overlays[key].classList.toggle('on', key === wanted);
    if (wanted === 'shop') this.renderShop(round);
    if (wanted === 'result') this.renderResult(round);
    if (wanted === 'match') this.renderMatch(round);
  }

  renderShop(round) {
    const cards = [
      { key: '1', id: 'pistol', name: WEAPONS.pistol.name, text: 'one tap, tight cone, cheap', price: WEAPONS.pistol.price },
      { key: '2', id: 'smg', name: WEAPONS.smg.name, text: 'holds a lane, wide cone', price: WEAPONS.smg.price },
      { key: '3', id: 'rifle', name: WEAPONS.rifle.name, text: 'burst, kills on one head hit', price: WEAPONS.rifle.price },
      { key: '4', id: 'flash', name: GRENADE.name, text: `blinds for ${GRENADE.blind}s in ${GRENADE.radius}m`, price: GRENADE.price },
      { key: '5', id: 'armor', name: ARMOR.name, text: 'halves what reaches health', price: ARMOR.price },
    ];
    this.shopCards.textContent = '';
    for (const card of cards) {
      const node = document.createElement('div');
      node.className = `card${card.price > round.money ? ' short' : ''}`;
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = card.key;
      const title = document.createElement('h3');
      title.textContent = card.name;
      const text = document.createElement('p');
      text.textContent = card.text;
      const price = document.createElement('div');
      price.className = 'price';
      price.textContent = `$${card.price}`;
      node.append(key, title, text, price);
      this.shopCards.append(node);
    }
  }

  renderResult(round) {
    this.resultTitle.textContent = round.result.won ? 'Round won' : 'Round lost';
    this.resultTitle.style.color = round.result.won ? '#4fd8c8' : '#ff9d6b';
    this.resultReason.textContent = round.result.reason;
    this.resultScore.textContent = `${round.you} – ${round.them}`;
    this.resultKills.textContent = `${round.kills}`;
    this.resultMoney.textContent = `$${round.money}`;
    this.resultNext.textContent = `next round in ${Math.ceil(round.phaseTimer)}`;
  }

  renderMatch(round) {
    this.matchTitle.textContent = round.matchWon ? 'Match won' : 'Match lost';
    this.matchTitle.style.color = round.matchWon ? '#4fd8c8' : '#ff9d6b';
    this.matchScore.textContent = `${round.you} – ${round.them}`;
  }

  flashScreen(seconds) {
    this.flashbang.style.opacity = `${seconds}`;
  }
}
