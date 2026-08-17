/**
 * Device tilt + haptics — the mobile half of "cursor-reactive".
 *
 * On a phone there is no cursor, so the environment loses its main input.
 * Gyroscope tilt stands in for it: the parallax layers lean, and the aurora's
 * glow follows the angle of the device via an 'ae:tilt' event.
 *
 * iOS 13+ requires an explicit user gesture to grant motion access, so this
 * never auto-prompts — it exposes `request()` for the command palette to call.
 * Android and desktop-with-sensors just work once started.
 */
(function (global) {
  'use strict';

  const { clamp, lerp, prefersReducedMotion } = global.AEUtils;

  function needsPermission() {
    return typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function';
  }

  function initDeviceTilt(root = document.documentElement) {
    if (prefersReducedMotion()) return { supported: false, request: async () => false };
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      return { supported: false, request: async () => false };
    }

    let listening = false;
    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;
    let received = false;

    function onOrientation(e) {
      if (e.gamma == null || e.beta == null) return;
      received = true;
      // gamma: left/right (-90..90), beta: front/back (-180..180).
      targetX = clamp(e.gamma / 45, -1, 1);
      targetY = clamp((e.beta - 45) / 45, -1, 1);
    }

    function frame() {
      if (!listening) return;
      x = lerp(x, targetX, 0.08);
      y = lerp(y, targetY, 0.08);
      root.style.setProperty('--tilt-x', x.toFixed(4));
      root.style.setProperty('--tilt-y', y.toFixed(4));
      if (received) {
        document.dispatchEvent(new CustomEvent('ae:tilt', { detail: { x, y } }));
      }
      requestAnimationFrame(frame);
    }

    function start() {
      if (listening) return true;
      listening = true;
      window.addEventListener('deviceorientation', onOrientation, { passive: true });
      requestAnimationFrame(frame);
      root.classList.add('ae-tilt-active');
      return true;
    }

    async function request() {
      if (needsPermission()) {
        try {
          const result = await DeviceOrientationEvent.requestPermission();
          if (result !== 'granted') return false;
        } catch {
          return false;
        }
      }
      return start();
    }

    // Where no permission gate exists, start immediately — a phone held still
    // simply reports a constant angle, so there's nothing to opt into.
    if (!needsPermission()) start();

    return {
      supported: true,
      needsPermission: needsPermission(),
      request,
      isActive: () => listening && received,
    };
  }

  /**
   * Haptics: a short pulse on the page's genuinely notable moments only.
   * Anything more frequent turns into buzzing noise in someone's hand.
   */
  function initHaptics() {
    if (!('vibrate' in navigator)) return null;

    let lastBuzz = 0;
    function buzz(pattern) {
      const now = performance.now();
      if (now - lastBuzz < 400) return; // never stack pulses
      lastBuzz = now;
      try {
        navigator.vibrate(pattern);
      } catch {
        /* some browsers reject vibrate outside a gesture — harmless */
      }
    }

    document.addEventListener('attention:reward', () => buzz([18, 60, 34]));
    document.addEventListener('attention:evolve', () => buzz(14));
    document.addEventListener('ae:secret-found', () => buzz([12, 40, 12, 40, 26]));

    return { buzz };
  }

  global.AEDeviceTilt = { initDeviceTilt, initHaptics };
})(window);
