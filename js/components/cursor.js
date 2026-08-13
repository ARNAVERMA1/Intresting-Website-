/**
 * Custom magnetic cursor. Pointer devices only — bails out completely on
 * touch. Snaps toward elements marked [data-magnetic] and breathes with
 * the current attention mode via CSS variables set on the cursor node
 * itself (not global state), so its motion never fights the engine's.
 */
(function (global) {
  'use strict';

  const { clamp, lerp, isTouchDevice, throttle } = global.AEUtils;

  function initCursor() {
    if (isTouchDevice()) return null;

    const dot = document.createElement('div');
    dot.className = 'ae-cursor-dot';
    const ring = document.createElement('div');
    ring.className = 'ae-cursor-ring';
    document.body.append(ring, dot);

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let dotX = mouseX;
    let dotY = mouseY;
    let ringX = mouseX;
    let ringY = mouseY;
    let ringScale = 1;
    let targetScale = 1;
    let magnetTarget = null;
    let visible = false;

    const hitTest = throttle((x, y) => {
      const el = document.elementFromPoint(x, y);
      const magnet = el?.closest?.('[data-magnetic]');
      magnetTarget = magnet || null;

      const interactive = el?.closest?.('a, button, [data-magnetic], .card, input, textarea');
      targetScale = magnetTarget ? 1.8 : interactive ? 1.4 : 1;
      ring.classList.toggle('is-active', !!interactive);
    }, 40);

    function onMove(e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!visible) {
        visible = true;
        ring.classList.add('is-visible');
        dot.classList.add('is-visible');
      }
      hitTest(mouseX, mouseY);
    }

    function onLeave() {
      visible = false;
      ring.classList.remove('is-visible');
      dot.classList.remove('is-visible');
    }

    function onDown() {
      ring.classList.add('is-pressed');
    }
    function onUp() {
      ring.classList.remove('is-pressed');
    }

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.addEventListener('mouseleave', onLeave);

    function frame() {
      dotX = lerp(dotX, mouseX, 0.35);
      dotY = lerp(dotY, mouseY, 0.35);

      let targetRingX = mouseX;
      let targetRingY = mouseY;

      if (magnetTarget) {
        const rect = magnetTarget.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const pull = 0.35;
        targetRingX = lerp(mouseX, cx, pull);
        targetRingY = lerp(mouseY, cy, pull);
      }

      ringX = lerp(ringX, targetRingX, 0.16);
      ringY = lerp(ringY, targetRingY, 0.16);
      ringScale = lerp(ringScale, targetScale, 0.18);

      dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(${ringScale})`;

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    document.addEventListener('attention:modechange', (e) => {
      ring.dataset.mode = e.detail.mode;
    });

    return { dot, ring };
  }

  global.AECursor = { initCursor };
})(window);
