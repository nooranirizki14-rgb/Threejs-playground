import { storeGet, storeSet, clamp } from './utils.js';

const KEY = 'midnight-drive-settings-v1';

// Player settings: volume, render quality, mouse sensitivity. Persisted.
export class Settings {
  constructor() {
    this.volume = 0.8;
    this.quality = 'auto'; // auto | high | low
    this.sensitivity = 1;
    this.load();
  }

  load() {
    try {
      const d = JSON.parse(storeGet(KEY) || 'null');
      if (!d) return;
      if (typeof d.volume === 'number') this.volume = clamp(d.volume, 0, 1);
      if (['auto', 'high', 'low'].includes(d.quality)) this.quality = d.quality;
      if (typeof d.sensitivity === 'number') {
        this.sensitivity = clamp(d.sensitivity, 0.2, 3);
      }
    } catch (e) { /* corrupted settings: keep defaults */ }
  }

  save() {
    storeSet(KEY, JSON.stringify({
      volume: this.volume,
      quality: this.quality,
      sensitivity: this.sensitivity,
    }));
  }
}
