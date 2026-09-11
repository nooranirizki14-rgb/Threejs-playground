import { fmtRp, fmtClock, fmtOdo } from './utils.js';
import { UPGRADES } from './upgrades.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.toastsEl = $('toasts');
  }

  show() {
    $('hud').classList.remove('hidden');
    $('toolbar').classList.remove('hidden');
  }

  setTouchMode(mode) {
    // mode: 'drive' | 'foot' | null
    $('touch-ui').classList.toggle('hidden', !mode);
    if (!mode) return;
    const drive = mode === 'drive';
    $('t-steer').style.display = drive ? 'flex' : 'none';
    $('t-pedal').style.display = drive ? 'flex' : 'none';
    $('hint').textContent = drive
      ? '◀ ▶ steer · ▲ ▼ pedals · drag to look · E interact'
      : 'left stick walk · drag right to look · E interact';
  }

  setStats(cash, clockMin, odoM) {
    $('cash').textContent = fmtRp(cash);
    $('clock').textContent = '🌙 ' + fmtClock(clockMin);
    $('odo').textContent = fmtOdo(odoM);
  }

  setGPS(fuelLine, restLine) {
    $('gps-1').textContent = fuelLine;
    $('gps-2').textContent = restLine;
  }

  setWarns({ fuel, eng, temp, lights }) {
    $('w-fuel').classList.toggle('hidden', !fuel);
    $('w-eng').classList.toggle('hidden', !eng);
    $('w-temp').classList.toggle('hidden', !temp);
    $('w-light').classList.toggle('on', !!lights);
  }

  setDrive({ speedKmh, gear, fuel01, energy01, food01, inv }) {
    $('speed').textContent = Math.round(Math.abs(speedKmh));
    $('gear').textContent = gear;
    $('fuel-fill').style.width = (fuel01 * 100).toFixed(1) + '%';
    $('energy-fill').style.width = (energy01 * 100).toFixed(1) + '%';
    $('food-fill').style.width = (food01 * 100).toFixed(1) + '%';
    $('inv-kit').textContent = inv.kit;
    $('inv-can').textContent = inv.can;
    $('inv-snack').textContent = inv.snack;
    $('inv-coffee').textContent = inv.coffee;
  }

  setRadio(text) {
    $('radio-chip').classList.toggle('hidden', !text);
    if (text) $('radio-name').textContent = text;
  }

  setAuto(on) {
    $('auto-chip').classList.toggle('hidden', !on);
  }

  setPassenger(text) {
    $('passenger-chip').classList.toggle('hidden', !text);
    if (text) $('passenger-text').textContent = text;
  }

  setPhotoMode(on) {
    document.body.classList.toggle('photo', on);
  }

  prompt(html) {
    const el = $('prompt');
    if (!html) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    el.innerHTML = html;
  }

  progress(frac, label) {
    const el = $('progress');
    if (frac === null || frac === undefined) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    $('progress-fill').style.width = (frac * 100).toFixed(1) + '%';
    $('progress-label').textContent = label || '';
  }

  toast(msg, ms = 2800) {
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = msg;
    this.toastsEl.appendChild(div);
    while (this.toastsEl.children.length > 3) {
      this.toastsEl.removeChild(this.toastsEl.firstChild);
    }
    setTimeout(() => div.classList.add('out'), ms - 500);
    setTimeout(() => div.remove(), ms);
  }

  fade(toBlack, ms = 800) {
    const el = $('fade');
    el.style.transitionDuration = ms / 1000 + 's';
    el.style.opacity = toBlack ? '1' : '0';
  }

  eyelids(f) {
    const h = (f * 22).toFixed(1) + 'vh';
    $('lid-top').style.height = h;
    $('lid-bottom').style.height = h;
  }

  // ---- menus ----
  openShop(title, cash, items) {
    document.querySelector('#shop .menu-title').textContent = title;
    $('shop-cash').textContent = fmtRp(cash);
    const box = $('shop-items');
    box.innerHTML = '';
    for (const it of items) {
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.innerHTML = `<div class="info"><b>${it.icon} ${it.name}</b><span>${it.desc}</span></div>
        <div class="price">${fmtRp(it.price)}</div>`;
      const btn = document.createElement('button');
      btn.className = 'buy-btn';
      btn.textContent = 'BUY';
      btn.disabled = !it.can;
      btn.addEventListener('click', () => it.cb());
      row.appendChild(btn);
      box.appendChild(row);
    }
    $('shop').classList.remove('hidden');
  }

  closeShop() {
    $('shop').classList.add('hidden');
  }

  openRest(cash, items) {
    $('rest-cash').textContent = fmtRp(cash);
    const box = $('rest-items');
    box.innerHTML = '';
    for (const it of items) {
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.innerHTML = `<div class="info"><b>${it.icon} ${it.name}</b><span>${it.desc}</span></div>
        <div class="price">${it.price > 0 ? fmtRp(it.price) : 'FREE'}</div>`;
      const btn = document.createElement('button');
      btn.className = 'buy-btn';
      btn.textContent = 'GO';
      btn.disabled = !it.can;
      btn.addEventListener('click', () => it.cb());
      row.appendChild(btn);
      box.appendChild(row);
    }
    $('rest').classList.remove('hidden');
  }

  closeRest() {
    $('rest').classList.add('hidden');
  }

  openUpgrades(cash, upgrades, health, svcCost, onBuy) {
    $('upg-cash').textContent = fmtRp(cash);
    const box = $('upg-items');
    box.innerHTML = '';
    // full service row
    {
      const row = document.createElement('div');
      row.className = 'shop-item';
      const healthy = health >= 99.5;
      row.innerHTML = `<div class="info"><b>🔧 Full service</b><span>engine ${Math.round(health)}% → 100%</span></div>
        <div class="price">${healthy ? '—' : fmtRp(svcCost)}</div>`;
      const btn = document.createElement('button');
      btn.className = 'buy-btn';
      btn.textContent = healthy ? 'OK' : 'FIX';
      btn.disabled = healthy || cash < svcCost;
      btn.addEventListener('click', () => onBuy('service'));
      row.appendChild(btn);
      box.appendChild(row);
    }
    for (const u of UPGRADES) {
      const maxed = upgrades.maxed(u.key);
      const cost = upgrades.costOf(u.key);
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.innerHTML = `<div class="info"><b>${u.icon} ${u.name} <span class="pips">${upgrades.pips(u.key)}</span></b><span>${u.desc}</span></div>
        <div class="price">${maxed ? 'MAX' : fmtRp(cost)}</div>`;
      const btn = document.createElement('button');
      btn.className = 'buy-btn';
      btn.textContent = maxed ? 'MAX' : 'BUY';
      btn.disabled = maxed || cash < cost;
      btn.addEventListener('click', () => onBuy(u.key));
      row.appendChild(btn);
      box.appendChild(row);
    }
    $('upgrades').classList.remove('hidden');
  }

  closeUpgrades() {
    $('upgrades').classList.add('hidden');
  }

  openSettings(s, onChange) {
    const box = $('settings-rows');
    box.innerHTML = '';
    const mkRow = (icon, label, valText, onMinus, onPlus) => {
      const row = document.createElement('div');
      row.className = 'set-row';
      row.innerHTML = `<div class="info"><b>${icon} ${label}</b></div>`;
      const ctl = document.createElement('div');
      ctl.className = 'set-ctl';
      const minus = document.createElement('button');
      minus.className = 'buy-btn';
      minus.textContent = '−';
      minus.addEventListener('click', onMinus);
      const val = document.createElement('div');
      val.className = 'set-val';
      val.textContent = valText;
      const plus = document.createElement('button');
      plus.className = 'buy-btn';
      plus.textContent = '+';
      plus.addEventListener('click', onPlus);
      ctl.append(minus, val, plus);
      row.appendChild(ctl);
      box.appendChild(row);
    };
    mkRow('🔊', 'Volume', Math.round(s.volume * 100) + '%',
      () => onChange('vol', -0.1), () => onChange('vol', 0.1));
    mkRow('✨', 'Quality', s.quality.toUpperCase(),
      () => onChange('quality', -1), () => onChange('quality', 1));
    mkRow('🖱️', 'Mouse sens', s.sensitivity.toFixed(1),
      () => onChange('sens', -0.2), () => onChange('sens', 0.2));
    $('settings').classList.remove('hidden');
  }

  closeSettings() {
    $('settings').classList.add('hidden');
  }

  showHelp(v) {
    $('help').classList.toggle('hidden', !v);
  }

  setMuteIcon(muted) {
    $('btn-mute').textContent = muted ? '🔇' : '🔊';
  }
}
