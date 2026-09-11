const KEY = 'midnight-drive-save-v1';

export function saveGame(d) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, at: Date.now(), ...d }));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return null;
    const d = JSON.parse(s);
    return d && d.v === 1 ? d : null;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}
