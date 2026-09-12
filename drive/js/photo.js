// Photo mode: hide the HUD, look around, snap a PNG.
// Capture must happen synchronously right after a render
// (no preserveDrawingBuffer needed that way).
export class PhotoMode {
  constructor() {
    this.active = false;
    this.capture = false;
  }

  toggle() {
    this.active = !this.active;
    if (!this.active) this.capture = false;
    return this.active;
  }

  exit() {
    this.active = false;
    this.capture = false;
  }

  snap() {
    this.capture = true;
  }

  maybeCapture(renderer) {
    if (!this.capture) return false;
    this.capture = false;
    try {
      const url = renderer.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'midnight-drive.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch (e) {
      return false;
    }
  }
}
